import pytest
from backend.agent.orchestrator import AgentOrchestrator
from backend.agent.tools import execute_math, execute_tool


def test_execute_math():
    res = execute_math("20 * 4")
    assert res["result"] == 80

    res2 = execute_math("25 x 16")
    assert res2["result"] == 400


def test_agent_math_intent():
    orchestrator = AgentOrchestrator(api_key="")
    text = "Caller asked: how much is 20x4 in total?"

    intent = orchestrator.analyze_intent(text_excerpt=text, is_hotkey=True, segment_ids=["seg_1"])

    assert "80" in intent["content"]
    assert len(intent["action_cards"]) >= 1
    # Check that copy or action card is generated
    tool_names = [card["toolName"] for card in intent["action_cards"]]
    assert "copy_clipboard" in tool_names


def test_agent_question_intent():
    orchestrator = AgentOrchestrator(api_key="")
    text = "What is the project deadline for next week?"

    intent = orchestrator.analyze_intent(text_excerpt=text, is_hotkey=True)

    assert len(intent["action_cards"]) >= 1
    tool_names = [card["toolName"] for card in intent["action_cards"]]
    assert "web_search" in tool_names or "copy_clipboard" in tool_names


def test_agent_vision_sandbox():
    orchestrator = AgentOrchestrator(api_key="")
    res = orchestrator.analyze_vision(image_path="nonexistent.png", prompt="Explain this", target_title="VS Code")
    assert "thought" in res
    assert "content" in res
    assert "Sandbox Mode" in res["thought"]
    assert "sandbox mode" in res["content"].lower()


def test_agent_vision_payload_downscaling(tmp_path):
    from PIL import Image

    # Create a dummy 4K resolution image
    img_path = tmp_path / "test_4k.png"
    img = Image.new("RGB", (3840, 2160), color="blue")
    img.save(img_path)

    orchestrator = AgentOrchestrator(api_key="")
    # Check that disk image resolution is preserved untouched
    res = orchestrator.analyze_vision(image_path=str(img_path), prompt="Explain this", target_title="Display 1")
    assert "Sandbox Mode" in res["thought"]
    assert "sandbox mode" in res["content"].lower()

    # Verify original file on disk remains 3840x2160
    reloaded = Image.open(img_path)
    assert reloaded.size == (3840, 2160)


def test_agent_response_lean_word_budget():
    orchestrator = AgentOrchestrator(api_key="")
    # Check vision sandbox response adheres to lean constraints
    res_vision = orchestrator.analyze_vision(image_path="test.png", prompt="Explain", target_title="Notepad")
    word_count_vision = len(res_vision["content"].split())
    assert word_count_vision < 150
    assert "---" not in res_vision["content"]
    assert "Purpose:" in res_vision["content"]

    # Check intent heuristic response adheres to lean constraints
    res_intent = orchestrator.analyze_intent(text_excerpt="What does TL;DR mean?", is_hotkey=True)
    word_count_intent = len(res_intent["content"].split())
    assert word_count_intent < 150
    assert "---" not in res_intent["content"]

