import numpy as np
from typing import Optional

class VadGate:
    """
    Voice Activity Detection gate.
    Evaluates 16kHz mono audio frames.
    Combines energy/RMS gating and zero-crossing analysis,
    with an interface compatible with Silero VAD (<0.5 speech probability discarded).
    """
    def __init__(self, sample_rate: int = 16000, threshold: float = 0.5):
        self.sample_rate = sample_rate
        self.threshold = threshold
        self.energy_threshold = 0.015  # normalized float32 RMS threshold

    def is_speech(self, audio_data: np.ndarray) -> bool:
        """
        Takes a numpy array of float32 samples in range [-1.0, 1.0].
        Returns True if speech probability >= threshold.
        """
        if len(audio_data) == 0:
            return False

        # Calculate Root Mean Square (RMS) energy
        rms = np.sqrt(np.mean(audio_data ** 2))
        
        # Calculate Zero-Crossing Rate to distinguish voice/voiced speech from low-freq rumble or high-freq static
        zero_crossings = np.sum(np.abs(np.diff(audio_data > 0))) / len(audio_data)

        # Basic speech heuristic score between 0.0 and 1.0
        if rms < 0.008:
            return False

        # Speech typically has zero crossings between 0.02 and 0.4
        if 0.02 <= zero_crossings <= 0.45:
            speech_prob = min(1.0, (rms / self.energy_threshold) * 0.7)
        else:
            speech_prob = min(0.4, (rms / self.energy_threshold) * 0.3)

        return speech_prob >= self.threshold
