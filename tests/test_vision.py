import os
import pytest
from backend.vision.capture import VisionCaptureManager


def test_vision_target_enumeration():
    manager = VisionCaptureManager()
    targets = manager.list_capture_targets()
    assert "screens" in targets
    assert "applications" in targets
    assert isinstance(targets["screens"], list)
    assert isinstance(targets["applications"], list)
    assert len(targets["screens"]) >= 1


def test_vision_window_capture():
    manager = VisionCaptureManager()
    targets = manager.list_capture_targets()
    if targets["applications"]:
        target = targets["applications"][0]
        snap = manager.capture_target(
            target_type="window",
            target_id=target["id"],
            target_name=target["name"],
        )
        if snap is not None:
            assert "image_path" in snap
            assert os.path.exists(snap["image_path"])
            assert "thumbnail_url" in snap
            assert snap["thumbnail_url"].startswith("data:image/jpeg;base64,")

            # Test clipboard copy
            copied = manager.copy_image_to_clipboard(snap["image_path"])
            assert copied is True

            # Clean up test file
            try:
                os.remove(snap["image_path"])
            except Exception:
                pass
