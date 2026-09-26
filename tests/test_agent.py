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
