import time
import queue
import threading
import collections
import numpy as np
from typing import Optional, List, Dict, Any, Callable
import pyaudiowpatch as pyaudio

from backend.audio.vad import VadGate
from backend.audio.transcriber import TranscriberWorker


class AudioCaptureManager:
    SAMPLE_RATE = 16000
    CHUNK_DURATION_MS = 64  # ~64ms buffer chunk

    def __init__(
        self,
        transcriber: TranscriberWorker,
        on_speech_activity: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.transcriber = transcriber
        self.on_speech_activity = on_speech_activity
        self._is_speaking_state: Dict[str, bool] = {"me": False, "caller": False}
        self.vad_me = VadGate(sample_rate=self.SAMPLE_RATE, threshold=0.35)
        self.vad_caller = VadGate(sample_rate=self.SAMPLE_RATE, threshold=0.35)

        self._p: Optional[pyaudio.PyAudio] = pyaudio.PyAudio()
        self._is_recording = False
        self._is_paused = False

        self._mic_stream: Optional[pyaudio.Stream] = None
        self._loopback_stream: Optional[pyaudio.Stream] = None

        self._mic_queue = queue.Queue()
        self._loopback_queue = queue.Queue()

        self._mic_worker_thread: Optional[threading.Thread] = None
        self._loopback_worker_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        self.input_device_index: Optional[int] = None
        self.loopback_device_index: Optional[int] = None

    def _set_speaking_state(self, speaker: str, is_speaking: bool):
        if self._is_speaking_state.get(speaker) != is_speaking:
            self._is_speaking_state[speaker] = is_speaking
            if self.on_speech_activity:
                try:
                    self.on_speech_activity({"is_speaking": is_speaking, "speaker": speaker})
                except Exception as e:
                    print(f"[Capture] Error in on_speech_activity callback: {e}", flush=True)

    def get_audio_devices(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Enumerates input devices and loopback devices using PyAudioWPatch.
        """
        p = self._p or pyaudio.PyAudio()
        input_devices = []
        loopback_devices = []
        try:
            wasapi_info = p.get_host_api_info_by_type(pyaudio.paWASAPI)
            wasapi_index = wasapi_info["index"]

            for i in range(p.get_device_count()):
                dev = p.get_device_info_by_index(i)
                if dev["hostApi"] == wasapi_index:
                    if dev["maxInputChannels"] > 0:
                        if dev.get("isLoopbackDevice", False):
                            loopback_devices.append({
                                "index": i,
                                "name": dev["name"],
                                "is_default": (i == wasapi_info.get("defaultOutputDevice")),
                            })
                        else:
                            input_devices.append({
                                "index": i,
                                "name": dev["name"],
                                "is_default": (i == wasapi_info.get("defaultInputDevice")),
                            })
        except Exception as e:
            print(f"[Capture] Error enumerating devices: {e}")
            for i in range(p.get_device_count()):
                try:
                    dev = p.get_device_info_by_index(i)
                    if dev["maxInputChannels"] > 0:
                        input_devices.append({
                            "index": i,
                            "name": dev["name"],
                            "is_default": False,
                        })
                except Exception:
                    pass

        return {
            "inputs": input_devices,
            "loopbacks": loopback_devices,
        }

    def start(self, input_index: Optional[int] = None, loopback_index: Optional[int] = None):
        if self._is_recording:
            self._is_paused = False
            return

        self.input_device_index = input_index
        self.loopback_device_index = loopback_index

        if self._p is None:
            self._p = pyaudio.PyAudio()

        self._stop_event.clear()
        while not self._mic_queue.empty():
            self._mic_queue.get_nowait()
        while not self._loopback_queue.empty():
            self._loopback_queue.get_nowait()

        self._is_recording = True
        self._is_paused = False

        self.transcriber.start()

        p = self._p

        # 1. Initialize Microphone Stream
        try:
            device_index = self.input_device_index
            if device_index is None:
                try:
                    wasapi_info = p.get_host_api_info_by_type(pyaudio.paWASAPI)
                    default_dev = p.get_default_input_device_info()
                    device_index = default_dev["index"]
                except Exception:
                    device_index = None

            if device_index is not None:
                dev_info = p.get_device_info_by_index(device_index)
                mic_rate = int(dev_info.get("defaultSampleRate", 48000))
                mic_channels = int(dev_info.get("maxInputChannels", 2))
                mic_name = dev_info.get("name", "Mic")
            else:
                mic_rate = 48000
                mic_channels = 2
                mic_name = "Default Mic"

            mic_chunk = int(mic_rate * (self.CHUNK_DURATION_MS / 1000.0))

            def mic_callback(in_data, frame_count, time_info, status):
                if not self._is_paused and in_data:
                    self._mic_queue.put(in_data)
                return (None, pyaudio.paContinue)

            print(f"[Capture] Opening Mic: '{mic_name}' ({mic_rate}Hz, {mic_channels}ch, idx={device_index})...", flush=True)
            self._mic_stream = p.open(
                format=pyaudio.paInt16,
                channels=mic_channels,
                rate=mic_rate,
                input=True,
                input_device_index=device_index,
                frames_per_buffer=mic_chunk,
                stream_callback=mic_callback,
            )
            self._mic_stream.start_stream()
            print("[Capture] Microphone stream running!", flush=True)

            self._mic_worker_thread = threading.Thread(
                target=self._process_stream_worker,
                args=(self._mic_queue, mic_rate, mic_channels, self.vad_me, "me"),
                daemon=True,
            )
            self._mic_worker_thread.start()
        except Exception as e:
            print(f"[Capture] Failed to start microphone: {e}", flush=True)

        # 2. Initialize Loopback Stream
        try:
            device_index = self.loopback_device_index
            if device_index is None:
                try:
                    wasapi_info = p.get_host_api_info_by_type(pyaudio.paWASAPI)
                    default_speakers = p.get_device_info_by_index(wasapi_info["defaultOutputDevice"])
                    if not default_speakers.get("isLoopbackDevice", False):
                        for loopback in p.get_loopback_device_info_generator():
                            if default_speakers["name"] in loopback["name"]:
                                device_index = loopback["index"]
                                break
                    else:
                        device_index = default_speakers["index"]
                except Exception as e:
                    print(f"[Capture] Auto loopback detection note: {e}")

            if device_index is not None:
                dev_info = p.get_device_info_by_index(device_index)
                loop_rate = int(dev_info.get("defaultSampleRate", 48000))
                loop_channels = int(dev_info.get("maxInputChannels", 2))
                loop_name = dev_info.get("name", "Loopback")

                loop_chunk = int(loop_rate * (self.CHUNK_DURATION_MS / 1000.0))

                def loopback_callback(in_data, frame_count, time_info, status):
                    if not self._is_paused and in_data:
                        self._loopback_queue.put(in_data)
                    return (None, pyaudio.paContinue)

                print(f"[Capture] Opening Loopback: '{loop_name}' ({loop_rate}Hz, {loop_channels}ch, idx={device_index})...", flush=True)
                self._loopback_stream = p.open(
                    format=pyaudio.paInt16,
                    channels=loop_channels,
                    rate=loop_rate,
                    input=True,
                    input_device_index=device_index,
                    frames_per_buffer=loop_chunk,
                    stream_callback=loopback_callback,
                )
                self._loopback_stream.start_stream()
                print("[Capture] Speakers Loopback stream running!", flush=True)

                self._loopback_worker_thread = threading.Thread(
                    target=self._process_stream_worker,
                    args=(self._loopback_queue, loop_rate, loop_channels, self.vad_caller, "caller"),
                    daemon=True,
                )
                self._loopback_worker_thread.start()
            else:
                print("[Capture] No loopback device available; caller capture skipped.", flush=True)
        except Exception as e:
            print(f"[Capture] Failed to start loopback: {e}", flush=True)

    def pause(self):
        self._is_paused = True
        self._set_speaking_state("me", False)
        self._set_speaking_state("caller", False)

    def resume(self):
        self._is_paused = False

    def stop(self):
        """
        Gracefully stops audio streams without crashing native PortAudio library.
        """
        if not self._is_recording:
            return

        self._is_recording = False
        self._is_paused = False
        self._set_speaking_state("me", False)
        self._set_speaking_state("caller", False)
        self._stop_event.set()

        # Stop and close PortAudio streams
        for stream_ref in [self._mic_stream, self._loopback_stream]:
            if stream_ref:
                try:
                    stream_ref.stop_stream()
                    stream_ref.close()
                except Exception:
                    pass
        self._mic_stream = None
        self._loopback_stream = None

        if self._mic_worker_thread and self._mic_worker_thread.is_alive():
            self._mic_worker_thread.join(timeout=1.0)
        if self._loopback_worker_thread and self._loopback_worker_thread.is_alive():
            self._loopback_worker_thread.join(timeout=1.0)

        self._mic_worker_thread = None
        self._loopback_worker_thread = None

    def cleanup(self):
        self.stop()
        if self._p:
            try:
                self._p.terminate()
            except Exception:
                pass
            self._p = None

    def is_recording(self) -> bool:
        return self._is_recording and not self._is_paused

    def is_paused(self) -> bool:
        return self._is_paused

    def _process_stream_worker(
        self,
        audio_queue: queue.Queue,
        native_rate: int,
        native_channels: int,
        vad_gate: VadGate,
        speaker: str,
    ):
        """
        Processes audio byte chunks from the non-blocking callback queue,
        downmixes to mono, resamples to 16kHz, applies VAD, and pools speech chunks
        optimally (1.5s - 3.5s) for high-accuracy Whisper transcription.
        """
        pre_speech_chunks = collections.deque(maxlen=4)  # ~256ms pre-speech onset padding
        buffer_chunks = []
        speech_frames_count = 0
        silence_frames_count = 0

        while not self._stop_event.is_set():
            try:
                data = audio_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            if not data or len(data) == 0:
                continue

            # Convert to float32
            audio_np = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0

            # Downmix multi-channel to mono
            if native_channels > 1:
                audio_np = audio_np.reshape(-1, native_channels).mean(axis=1)

            # High-fidelity linear interpolation resampling to 16kHz (anti-aliased)
            if native_rate != self.SAMPLE_RATE:
                target_len = int(round(len(audio_np) * self.SAMPLE_RATE / native_rate))
                if target_len > 0:
                    x_orig = np.linspace(0, 1, len(audio_np), endpoint=False)
                    x_target = np.linspace(0, 1, target_len, endpoint=False)
                    audio_np = np.interp(x_target, x_orig, audio_np).astype(np.float32)

            is_voice = vad_gate.is_speech(audio_np)
            if is_voice:
                if speech_frames_count == 0:
                    # Speech just started -> Notify UI to show animated 3 dots
                    self._set_speaking_state(speaker, True)
                    # Prepend pre-speech padding buffer so initial consonants aren't clipped
                    buffer_chunks.extend(list(pre_speech_chunks))
                    pre_speech_chunks.clear()

                speech_frames_count += 1
                silence_frames_count = 0
                buffer_chunks.append(audio_np)
            else:
                if speech_frames_count == 0:
                    # Rolling pre-speech onset buffer while idle
                    pre_speech_chunks.append(audio_np)
                else:
                    # Speech underway, user briefly paused
                    silence_frames_count += 1
                    buffer_chunks.append(audio_np)

                    # Emit after ~0.64s silence (10 frames) AND at least ~0.76s speech (12 frames)
                    if silence_frames_count >= 10 and len(buffer_chunks) >= 12:
                        self._set_speaking_state(speaker, False)
                        full_chunk = np.concatenate(buffer_chunks)
                        timestamp = time.time() - (len(full_chunk) / self.SAMPLE_RATE)
                        self.transcriber.enqueue_chunk(full_chunk, speaker=speaker, timestamp=timestamp)
                        buffer_chunks = []
                        speech_frames_count = 0
                        silence_frames_count = 0

            # Cap continuous speech chunks at ~3.2s (50 frames) for fast, consistent streaming
            if len(buffer_chunks) >= 50:
                full_chunk = np.concatenate(buffer_chunks)
                timestamp = time.time() - (len(full_chunk) / self.SAMPLE_RATE)
                self.transcriber.enqueue_chunk(full_chunk, speaker=speaker, timestamp=timestamp)
                buffer_chunks = []
                speech_frames_count = 0
                silence_frames_count = 0
