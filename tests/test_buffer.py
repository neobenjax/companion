import time
import pytest
from backend.audio.buffer import RollingTranscriptBuffer, TranscriptSegment


def test_transcript_buffer_append_and_slice():
    buffer = RollingTranscriptBuffer(max_retention_sec=60.0)

    now = time.time()
    seg1 = TranscriptSegment(id="1", timestamp=now - 25, speaker="me", text="Hello caller")
    seg2 = TranscriptSegment(id="2", timestamp=now - 8, speaker="caller", text="Hi, how much is 20 times 4?")
    seg3 = TranscriptSegment(id="3", timestamp=now - 2, speaker="me", text="Let me check")

    buffer.append(seg1)
    buffer.append(seg2)
    buffer.append(seg3)

    # Request last 10 seconds of transcribed speech
    slice_10s = buffer.get_recent_text(duration_sec=10.0)

    assert len(slice_10s["segments"]) == 2
    assert slice_10s["segment_ids"] == ["2", "3"]
    assert "20 times 4" in slice_10s["text"]
    assert "Hello caller" not in slice_10s["text"]


def test_transcript_buffer_prune():
    buffer = RollingTranscriptBuffer(max_retention_sec=10.0)

    now = time.time()
    old_seg = TranscriptSegment(id="old", timestamp=now - 20, speaker="me", text="Old speech")
    new_seg = TranscriptSegment(id="new", timestamp=now, speaker="caller", text="Recent speech")

    buffer.append(old_seg)
    buffer.append(new_seg)

    all_segments = buffer.get_all()
    # Old segment should be pruned
    assert len(all_segments) == 1
    assert all_segments[0]["id"] == "new"


def test_transcript_buffer_word_lookback():
    buffer = RollingTranscriptBuffer(max_retention_sec=600.0)

    # Simulated speech that occurred minutes ago
    past = time.time() - 120.0
    seg1 = TranscriptSegment(id="1", timestamp=past - 20, speaker="caller", text="This template is used by the AI to generate summaries.")
    seg2 = TranscriptSegment(id="2", timestamp=past - 5, speaker="caller", text="We run the initial TLDR function to summarize Asimov's laws.")
    seg3 = TranscriptSegment(id="3", timestamp=past, speaker="me", text="What does TLDR mean? Can you explain it?")

    buffer.append(seg1)
    buffer.append(seg2)
    buffer.append(seg3)

    # Word-budget extraction of last 25 words
    res = buffer.get_recent_text(max_words=25)
    assert len(res["segments"]) >= 2
    assert "TLDR" in res["text"]
    assert "What does TLDR mean?" in res["text"]
