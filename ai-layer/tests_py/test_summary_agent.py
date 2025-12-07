# ai-layer/tests_py/test_summary_agent.py - Tests for SummaryAgent
import pytest
from agents.summary_agent import SummaryAgent


def test_empty_transcript():
    agent = SummaryAgent()
    result = agent.run("")

    assert "short_summary" in result
    assert "detailed_summary" in result

    assert result["short_summary"] == "No transcript content available."
    assert "empty" in result["detailed_summary"].lower()


def test_basic_summary():
    agent = SummaryAgent()

    transcript = (
        "We discussed the launch timeline of the new feature. "
        "The team agreed to move testing earlier. "
        "Several challenges were highlighted during development."
    )

    result = agent.run(transcript)

    # Required keys
    assert "short_summary" in result
    assert "detailed_summary" in result

    short = result["short_summary"]
    detailed = result["detailed_summary"]

    # Short summary should contain first good sentences
    assert "We discussed the launch timeline" in short

    # Detailed summary must contain discussion count
    assert "substantial discussion points" in detailed


def test_summary_with_agent_inputs():
    agent = SummaryAgent()

    transcript = (
        "We discussed progress on multiple tasks. "
        "We agreed to finalize the deployment by Friday. "
        "The team reviewed design decisions."
    )

    topic_segments = [
        {"title": "Project Progress"},
        {"title": "Deployment Strategy"},
    ]

    decisions = [
        {"id": 0, "text": "Finalize deployment", "rationale": "deadline"},
        {"id": 1, "text": "Review design", "rationale": "quality"}
    ]

    action_items = [
        {"id": 0, "title": "Fix UI bug"},
        {"id": 1, "title": "Update API docs"}
    ]

    sentiment = {"overall": "positive", "engagement": "high"}

    result = agent.run(
        transcript,
        topic_segments=topic_segments,
        decisions=decisions,
        action_items=action_items,
        sentiment=sentiment,
    )

    detailed = result["detailed_summary"]

    # Topic section included
    assert "Key topics included" in detailed
    assert "Project Progress" in detailed

    # Decisions counted
    assert "2 notable decisions" in detailed

    # Action items counted
    assert "2 follow-up action items" in detailed

    # Sentiment included
    assert "positive" in detailed
    assert "engagement" in detailed


def test_sentence_selection_logic():
    agent = SummaryAgent()

    transcript = (
        "Short. "
        "This sentence has more than five words for extraction. "
        "Another qualifying sentence appears here with enough length. "
        "Tiny. End."
    )

    result = agent.run(transcript)

    short = result["short_summary"]

    # Only long sentences appear in summary
    assert "more than five words" in short
    assert "Another qualifying" in short
    assert "Short." not in short
    assert "Tiny." not in short
