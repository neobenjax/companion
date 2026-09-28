import pytest
from backend.storage.session_db import SessionStorage
from backend.agent.orchestrator import (
    AgentOrchestrator,
    DEFAULT_HIGHLIGHT_SYSTEM_INSTRUCTION,
    DEFAULT_VISION_SYSTEM_INSTRUCTION,
)
from backend.bridge import CompanionBridge


def test_session_custom_prompts_persistence():
    storage = SessionStorage()

    # 1. Create session with custom prompts
    sess = storage.create_session(
        title="Interview Note",
        prompt_highlight="Act as an interviewer.",
        prompt_image="Explain UI layout as frontend lead.",
    )
    assert sess["id"] is not None
    assert sess["prompt_highlight"] == "Act as an interviewer."
    assert sess["prompt_image"] == "Explain UI layout as frontend lead."

    # 2. Get session
    fetched = storage.get_session(sess["id"])
    assert fetched is not None
    assert fetched["prompt_highlight"] == "Act as an interviewer."
    assert fetched["prompt_image"] == "Explain UI layout as frontend lead."

    # 3. Check list_sessions flags custom prompts
    all_sess = storage.list_sessions()
    item = next((s for s in all_sess if s["id"] == sess["id"]), None)
    assert item is not None
    assert item["has_custom_prompts"] is True

    # 4. Update session to change prompts
    storage.update_session(
        sess["id"],
        prompt_highlight="Act as executive summary writer.",
        prompt_image="",
    )
    updated = storage.get_session(sess["id"])
    assert updated["prompt_highlight"] == "Act as executive summary writer."
    assert updated["prompt_image"] == ""

    # 5. Clean up
    storage.delete_session(sess["id"])
    assert storage.get_session(sess["id"]) is None


def test_session_prompts_default_fallback():
    storage = SessionStorage()

    # Create session with no prompts
    sess = storage.create_session(title="Standard Note")
    fetched = storage.get_session(sess["id"])
    assert fetched["prompt_highlight"] == ""
    assert fetched["prompt_image"] == ""

    # list_sessions should report has_custom_prompts False
    all_sess = storage.list_sessions()
    item = next((s for s in all_sess if s["id"] == sess["id"]), None)
    assert item is not None
    assert item["has_custom_prompts"] is False

    storage.delete_session(sess["id"])


def test_agent_orchestrator_default_and_custom_instructions():
    agent = AgentOrchestrator(api_key="")

    # Verify default constants exist and are non-empty
    assert "ambient Copilot" in DEFAULT_HIGHLIGHT_SYSTEM_INSTRUCTION
    assert "ambient multimodal" in DEFAULT_VISION_SYSTEM_INSTRUCTION

    # In offline fallback mode, analyze_intent succeeds and returns content
    res = agent.analyze_intent("Can you calculate 12 * 12?")
    assert "144" in res["content"]

    # analyze_vision offline fallback succeeds
    res_vis = agent.analyze_vision("nonexistent.png", target_title="Terminal")
    assert "Terminal" in res_vis["content"]


def test_bridge_opacity_and_prompts():
    bridge = CompanionBridge()

    # 1. get_default_prompts returns both highlight and image templates
    prompts = bridge.get_default_prompts()
    assert "highlight" in prompts
    assert "image" in prompts
    assert DEFAULT_HIGHLIGHT_SYSTEM_INSTRUCTION == prompts["highlight"]
    assert DEFAULT_VISION_SYSTEM_INSTRUCTION == prompts["image"]

    # 2. set_window_opacity clamps values to [0.5, 1.0]
    res_low = bridge.set_window_opacity(0.05)
    assert res_low["opacity"] == 0.5
    assert bridge.get_window_opacity() == 0.5

    res_high = bridge.set_window_opacity(1.5)
    assert res_high["opacity"] == 1.0
    assert bridge.get_window_opacity() == 1.0

    res_mid = bridge.set_window_opacity(0.65)
    assert res_mid["opacity"] == 0.65
    assert bridge.get_window_opacity() == 0.65

    # Reset back to 1.0
    bridge.set_window_opacity(1.0)
    assert bridge.get_window_opacity() == 1.0
