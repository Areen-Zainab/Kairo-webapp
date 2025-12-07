# ai-layer/tests_py/test_decisionExtractionAgent.py - Tests for DecisionExtractionAgent
import pytest
from agents.decision_extraction_agent import DecisionExtractionAgent


def test_empty_transcript():
    """Agent should return empty list for empty input."""
    agent = DecisionExtractionAgent()
    result = agent.run("")
    assert result == []


def test_single_decision_extraction():
    """Detects a single decision sentence."""
    agent = DecisionExtractionAgent()
    transcript = "We decided to move forward with the new design."
    result = agent.run(transcript)

    assert len(result) == 1
    assert "decided" in result[0]["text"].lower()
    assert result[0]["id"] == 0
    assert result[0]["rationale"] != ""


def test_multiple_decisions():
    """Detects multiple decisions in a long transcript."""
    agent = DecisionExtractionAgent()
    transcript = (
        "We decided to upgrade the server. "
        "The plan is to deploy it next week. "
        "This is unrelated. "
        "We agreed to postpone the UI redesign."
    )
    result = agent.run(transcript)

    assert len(result) == 3
    assert result[0]["id"] == 0
    assert result[1]["id"] == 1
    assert result[2]["id"] == 2


def test_no_false_positives():
    """Sentences without cue phrases should not be extracted."""
    agent = DecisionExtractionAgent()
    transcript = "The weather is nice today. The team discussed many topics."
    result = agent.run(transcript)
    assert result == []


def test_sentence_splitting():
    """Verify that sentence splitting works correctly."""
    agent = DecisionExtractionAgent()
    output = agent._split_sentences("Hello world! We decided to test. Great.")

    assert output == [
        "Hello world",
        "We decided to test",
        "Great"
    ]
