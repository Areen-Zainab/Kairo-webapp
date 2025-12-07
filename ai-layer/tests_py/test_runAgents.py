# ai-layer/tests_py/test_runAgents.py - Tests for run_agents.py
import json
import builtins
import pytest
from unittest.mock import patch, MagicMock
from io import StringIO

# Import using relative path since your run_agents.py uses relative imports
from agents.run_agents import run_all, main


@pytest.fixture
def mock_agents():
    """
    Patch all agent classes inside run_agents.py so we don't run real logic.
    """
    with patch("agents.run_agents.TopicSegmentationAgent") as topic_mock, \
         patch("agents.run_agents.DecisionExtractionAgent") as decision_mock, \
         patch("agents.run_agents.ActionItemAgent") as action_mock, \
         patch("agents.run_agents.SentimentAnalysisAgent") as sentiment_mock, \
         patch("agents.run_agents.SummaryAgent") as summary_mock:

        # Fake objects and their return values
        topic_mock.return_value.run.return_value = ["topic1"]
        decision_mock.return_value.run.return_value = ["decision1"]
        action_mock.return_value.run.return_value = ["action1"]
        sentiment_mock.return_value.run.return_value = {"sentiment": "neutral"}

        summary_mock.return_value.run.return_value = {
            "summary": "This is summary"
        }

        yield {
            "topic": topic_mock,
            "decision": decision_mock,
            "action": action_mock,
            "sentiment": sentiment_mock,
            "summary": summary_mock,
        }


# -----------------------------
# TEST run_all()
# -----------------------------
def test_run_all(mock_agents):
    transcript = "This is a dummy transcript."

    result = run_all(transcript)

    assert result["topics"] == ["topic1"]
    assert result["decisions"] == ["decision1"]
    assert result["action_items"] == ["action1"]
    assert result["sentiment"] == {"sentiment": "neutral"}
    assert result["summary"] == {"summary": "This is summary"}


# -----------------------------
# TEST CLI full output
# -----------------------------
def test_cli_full_output(mock_agents, monkeypatch, capsys):
    fake_input = "hello world"
    monkeypatch.setattr("sys.stdin", StringIO(fake_input))
    monkeypatch.setattr("sys.argv", ["run_agents.py"])

    main()

    output = capsys.readouterr().out.strip()
    parsed = json.loads(output)

    assert parsed["topics"] == ["topic1"]
    assert parsed["decisions"] == ["decision1"]
    assert parsed["action_items"] == ["action1"]
    assert parsed["sentiment"] == {"sentiment": "neutral"}


# -----------------------------
# TEST CLI specific agent selection
# -----------------------------
def test_cli_specific_agent(mock_agents, monkeypatch, capsys):
    fake_input = "hello world"
    monkeypatch.setattr("sys.stdin", StringIO(fake_input))
    monkeypatch.setattr("sys.argv", ["run_agents.py", "decisions"])

    main()

    output = capsys.readouterr().out.strip()
    parsed = json.loads(output)

    assert parsed == ["decision1"]
