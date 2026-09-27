import numpy as np
from unittest.mock import MagicMock
from backend.audio.buffer import RollingTranscriptBuffer
from backend.audio.transcriber import TranscriberWorker
from backend.audio.capture import AudioCaptureManager
from backend.bridge import CompanionBridge


def test_transcriber_set_model_size():
    buf = RollingTranscriptBuffer()
    worker = TranscriberWorker(buffer=buf, model_size="base.en")
    assert worker.model_size == "base.en"

    worker.set_model_size("small.en")
    assert worker.model_size == "small.en"
    assert worker._model is None


def test_audio_capture_speech_activity_callback():
    buf = RollingTranscriptBuffer()
    worker = TranscriberWorker(buffer=buf, model_size="base.en")
    activity_events = []

    def on_activity(data):
        activity_events.append(data)

    capture = AudioCaptureManager(transcriber=worker, on_speech_activity=on_activity)
    
    # Trigger speaking state change
    capture._set_speaking_state("me", True)
    assert len(activity_events) == 1
    assert activity_events[0] == {"is_speaking": True, "speaker": "me"}

    # Repeated state should not fire duplicate event
    capture._set_speaking_state("me", True)
    assert len(activity_events) == 1

    # Transition to False
    capture._set_speaking_state("me", False)
    assert len(activity_events) == 2
    assert activity_events[1] == {"is_speaking": False, "speaker": "me"}


def test_bridge_resize_window_custom_width():
    bridge = CompanionBridge()
    mock_window = MagicMock()
    mock_window.width = 560
    mock_window.height = 720
    mock_window.x = 100
    mock_window.y = 50

    def mock_resize(w, h):
        mock_window.width = w
        mock_window.height = h

    mock_window.resize.side_effect = mock_resize
    bridge.set_window(mock_window)

    # Expand with custom width (e.g. 650 sidepanel -> 540 + 650 = 1190)
    res = bridge.resize_window(expand=True, width=1190)
    assert res["status"] == "ok"
    assert res["expanded"] is True
    assert res["width"] == 1190
    assert mock_window.width == 1190

    # Collapse (expand=False)
    res_col = bridge.resize_window(expand=False)
    assert res_col["status"] == "ok"
    assert res_col["expanded"] is False
    assert res_col["width"] == 560
    assert mock_window.width == 560
