# ai-layer/tests_py/test_actionItemAgent.py - Tests for ActionItemAgent
import pytest
from unittest.mock import patch, MagicMock
from agents.action_item_agent import ActionItemAgent


# -----------------------------
#  TEST: Fallback Pattern Extraction
# -----------------------------
def test_extract_with_patterns_basic():
    agent = ActionItemAgent()

    transcript = """
    I will send the report tomorrow.
    Let's finalize the budget next week.
    This is just normal text.
    """

    result = agent.run(transcript)

    assert len(result) == 2

    # First item → OWNER_CUES → assignee="speaker"
    assert result[0]["assignee"] == "speaker"
    assert "send the report" in result[0]["description"].lower()

    # Second item → GENERIC_CUES → assignee="team"
    assert result[1]["assignee"] == "team"
    assert "finalize the budget" in result[1]["description"].lower()


# -----------------------------
#  TEST: Empty transcript returns []
# -----------------------------
def test_empty_transcript_returns_empty():
    agent = ActionItemAgent()
    assert agent.run("") == []


# -----------------------------
#  TEST: Mock Grok API success flow
# -----------------------------
@patch("agents.action_item_agent.requests.post")
def test_extract_with_grok_success(mock_post):
    agent = ActionItemAgent()

    # Enable API mode artificially
    agent.use_api = True
    agent.api_key = "FAKE_KEY"

    # Fake API JSON response
    fake_json = {
        "choices": [
            {
                "message": {
                    "content": """
                    {
                        "action_items": [
                            {
                                "title": "Send report",
                                "description": "Send the financial report",
                                "assignee": "Areeba",
                                "dueDate": "2025-12-10",
                                "confidence": 0.9
                            }
                        ]
                    }
                    """
                }
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.json.return_value = fake_json
    mock_resp.raise_for_status.return_value = None
    mock_post.return_value = mock_resp

    result = agent.run("Please send the report.")

    assert len(result) == 1
    assert result[0]["title"] == "Send report"
    assert result[0]["assignee"] == "Areeba"
    assert result[0]["dueDate"] == "2025-12-10"
    assert result[0]["confidence"] == 0.9


# -----------------------------
#  TEST: If API fails → fallback pattern extraction
# -----------------------------
@patch("agents.action_item_agent.requests.post", side_effect=Exception("API DOWN"))
def test_grok_failure_falls_back_to_patterns(mock_post):
    agent = ActionItemAgent()
    agent.use_api = True
    agent.api_key = "FAKE_KEY"

    transcript = "I will handle the presentation."

    result = agent.run(transcript)

    assert len(result) == 1
    assert result[0]["assignee"] == "speaker"
    assert "presentation" in result[0]["description"].lower()
