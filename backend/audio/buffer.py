import time
import threading
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    id: str
    timestamp: float = Field(default_factory=time.time)
    speaker: str  # "me" | "caller"
    text: str


class RollingTranscriptBuffer:
    def __init__(self, max_retention_sec: float = 900.0):  # 15 minutes default
        self.max_retention_sec = max_retention_sec
        self._segments: List[TranscriptSegment] = []
        self._lock = threading.Lock()

    def append(self, segment: TranscriptSegment) -> None:
        with self._lock:
            self._segments.append(segment)
            self._prune()

    def _prune(self) -> None:
        if not self._segments:
            return
        # Prune older than retention window relative to the latest segment
        anchor = self._segments[-1].timestamp
        cutoff = anchor - self.max_retention_sec
        idx = 0
        while idx < len(self._segments) and self._segments[idx].timestamp < cutoff:
            idx += 1
        if idx > 0:
            self._segments = self._segments[idx:]

    def get_recent_text(
        self,
        duration_sec: Optional[float] = 10.0,
        max_words: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Extracts recent transcribed speech text from the tail of the conversation.
        If `max_words` is specified, extracts up to the last `max_words` words.
        Otherwise, extracts segments within `duration_sec` anchored to the latest speech timestamp.
        """
        with self._lock:
            if not self._segments:
                return {
                    "text": "",
                    "segment_ids": [],
                    "segments": [],
                    "duration_sec": duration_sec or 10.0,
                    "word_count": 0,
                }

            if max_words is not None and max_words > 0:
                # Word-based extraction from the conversation tail
                selected = []
                total_w = 0
                for s in reversed(self._segments):
                    selected.insert(0, s)
                    total_w += len(s.text.split())
                    if total_w >= max_words:
                        break
            else:
                # Time-based extraction anchored to the last spoken segment
                anchor_time = self._segments[-1].timestamp
                cutoff_time = anchor_time - (duration_sec or 10.0)
                selected = [s for s in self._segments if s.timestamp >= cutoff_time]

            # Format combined text with speaker tags
            combined_text = "\n".join([f"[{s.speaker.upper()}]: {s.text}" for s in selected])
            return {
                "text": combined_text,
                "segment_ids": [s.id for s in selected],
                "segments": [s.model_dump() for s in selected],
                "duration_sec": duration_sec or 10.0,
                "word_count": sum(len(s.text.split()) for s in selected),
            }

    def get_all(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [s.model_dump() for s in self._segments]

    def clear(self) -> None:
        with self._lock:
            self._segments.clear()
