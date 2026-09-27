import pytest
from backend.storage.session_db import SessionStorage


def test_session_storage():
    storage = SessionStorage()

    sess = storage.create_session(title="Interview with Carla")
    assert sess["id"] is not None
    assert sess["title"] == "Interview with Carla"

    # Update session notes and messages
    updated = storage.update_session(
        sess["id"],
        title="Interview with Carla (Updated)",
        notes="Discussed Agentic SDK",
        messages=[{"id": "m1", "content": "Hello world"}],
    )
    assert updated is True

    fetched = storage.get_session(sess["id"])
    assert fetched["title"] == "Interview with Carla (Updated)"
    assert fetched["notes"] == "Discussed Agentic SDK"
    assert len(fetched["messages"]) == 1

    # Cleanup
    storage.delete_session(sess["id"])
    assert storage.get_session(sess["id"]) is None


def test_session_highlights():
    storage = SessionStorage()
    sess = storage.create_session(title="Highlight Test")

    # Add highlight
    hl1 = {
        "id": "hl_1",
        "messageId": "msg_1",
        "text": "semantic kernel is really easy",
        "speaker": "caller",
        "timestamp": 12345.0,
        "is_saved": True,
    }
    highlights = storage.add_or_update_highlight(sess["id"], hl1)
    assert len(highlights) == 1
    assert highlights[0]["id"] == "hl_1"

    # Update highlight with AI response
    hl1_update = {
        "id": "hl_1",
        "ai_response": "Semantic Kernel is an open-source SDK from Microsoft.",
        "thought": "Explaining Semantic Kernel framework.",
    }
    updated_hls = storage.add_or_update_highlight(sess["id"], hl1_update)
    assert len(updated_hls) == 1
    assert updated_hls[0]["ai_response"] == "Semantic Kernel is an open-source SDK from Microsoft."
    assert updated_hls[0]["text"] == "semantic kernel is really easy"

    # Test delete highlight
    remaining_hls = storage.delete_highlight(sess["id"], "hl_1")
    assert len(remaining_hls) == 0
    assert len(storage.get_highlights(sess["id"])) == 0

    # Cleanup
    storage.delete_session(sess["id"])


def test_session_json_backup():
    from backend.storage.session_db import BACKUP_FILE
    import json
    storage = SessionStorage()
    sess = storage.create_session(title="Backup Verification Note")
    storage.update_session(sess["id"], messages=[{"id": "m1", "content": "Backup speech chunk"}])
    assert BACKUP_FILE.exists()
    with open(BACKUP_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    found = any(s["id"] == sess["id"] for s in data)
    assert found is True
    storage.delete_session(sess["id"])
