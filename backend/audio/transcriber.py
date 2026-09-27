import time
import queue
import threading
import numpy as np
from typing import Optional, Callable
from backend.audio.buffer import TranscriptSegment, RollingTranscriptBuffer

class TranscriberWorker:
    def __init__(
        self,
        buffer: RollingTranscriptBuffer,
        model_size: str = "base.en",
        on_segment: Optional[Callable[[TranscriptSegment], None]] = None,
    ):
        self.buffer = buffer
        self.model_size = model_size
        self.on_segment = on_segment
        self._queue = queue.Queue()
        self._stop_event = threading.Event()
        self._model = None
        self._worker_thread = None
        self._model_loading = False

    def set_model_size(self, new_model_size: str):
        if self.model_size != new_model_size:
            print(f"[Transcriber] Switching Whisper model from '{self.model_size}' to '{new_model_size}'...", flush=True)
            self.model_size = new_model_size
            self._model = None

    def _ensure_model(self):
        if self._model is None and not self._model_loading:
            self._model_loading = True
            try:
                import os
                os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
                from faster_whisper import WhisperModel

                resolved_model = self.model_size
                if resolved_model == "whisper-large-v3-turbo":
                    resolved_model = "deepdml/faster-whisper-large-v3-turbo-ct2"

                print(f"[Transcriber] Initializing Whisper model '{resolved_model}'...", flush=True)

                # Attempt auto/GPU first, fallback to CPU (int8) if CUDA libraries (e.g. cublas64_12.dll) are missing
                try:
                    m = WhisperModel(
                        resolved_model,
                        device="auto",
                        compute_type="int8",
                        cpu_threads=4,
                    )
                    # Verify model runs on dummy slice
                    dummy_audio = np.zeros(1600, dtype=np.float32)
                    list(m.transcribe(dummy_audio, language="en")[0])
                    self._model = m
                    print(f"[Transcriber] Whisper model '{resolved_model}' loaded successfully with GPU acceleration.", flush=True)
                except Exception as cuda_err:
                    print(f"[Transcriber] GPU acceleration unavailable ({cuda_err}). Loading CPU engine (INT8)...", flush=True)
                    self._model = WhisperModel(
                        resolved_model,
                        device="cpu",
                        compute_type="int8",
                        cpu_threads=4,
                    )
                    print(f"[Transcriber] Whisper model '{resolved_model}' loaded successfully on CPU.", flush=True)
            except Exception as e:
                print(f"[Transcriber] Failed to load faster-whisper model: {e}")
                self._model = None
            finally:
                self._model_loading = False

    def start(self):
        if self._worker_thread is not None and self._worker_thread.is_alive():
            return
        self._stop_event.clear()
        self._worker_thread = threading.Thread(target=self._run, daemon=True)
        self._worker_thread.start()

    def stop(self):
        self._stop_event.set()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)
        self._worker_thread = None

    def enqueue_chunk(self, audio: np.ndarray, speaker: str, timestamp: float):
        """
        Enqueues a float32 16kHz mono audio array.
        """
        self._queue.put((audio, speaker, timestamp))

    def _run(self):
        self._ensure_model()
        while not self._stop_event.is_set():
            try:
                item = self._queue.get(timeout=0.2)
            except queue.Empty:
                continue

            audio, speaker, timestamp = item
            if self._model is None:
                self._ensure_model()
                if self._model is None:
                    time.sleep(1.0)
                    continue

            try:
                # Prompt conditioning: extract recent transcript words to condition language model on speaker accent & vocabulary
                recent_info = self.buffer.get_recent_text(duration_sec=30.0)
                raw_text = recent_info.get("text", "")
                # Strip bracketed speaker tags e.g. [ME]: or [CALLER]:
                clean_words = [w for w in raw_text.split() if not (w.startswith("[") and w.endswith("]:"))]
                initial_prompt = " ".join(clean_words[-25:]) if clean_words else None

                # Transcribe chunk with 2026 optimized inference parameters
                segments, info = self._model.transcribe(
                    audio,
                    beam_size=1,
                    language="en",
                    initial_prompt=initial_prompt,
                    condition_on_previous_text=False,  # Prevents repetitive hallucination loops
                    vad_filter=False,  # We already filtered via VAD in capture
                )
                for s in segments:
                    cleaned_text = s.text.strip()
                    # Filter common Whisper artifacts or empty strings
                    if not cleaned_text or cleaned_text in ["...", ".", "[BLANK_AUDIO]"]:
                        continue
                    segment_obj = TranscriptSegment(
                        id=f"seg_{int(timestamp * 1000)}_{speaker}_{int(s.start * 100)}",
                        timestamp=timestamp + s.start,
                        speaker=speaker,
                        text=cleaned_text,
                    )
                    self.buffer.append(segment_obj)
                    if self.on_segment:
                        try:
                            self.on_segment(segment_obj)
                        except Exception as cb_err:
                            print(f"[Transcriber] Callback error: {cb_err}")
            except Exception as e:
                print(f"[Transcriber] Error during transcription: {e}")
