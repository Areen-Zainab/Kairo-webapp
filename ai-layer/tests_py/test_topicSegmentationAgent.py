# ai-layer/tests_py/test_topicSegmentationAgent.py - Tests for TopicSegmentationAgent
import pytest
from agents.topic_segmentation_agent import TopicSegmentationAgent


def test_empty_transcript():
    agent = TopicSegmentationAgent()
    result = agent.run("")
    assert result == []


def test_basic_paragraph_segmentation():
    agent = TopicSegmentationAgent()

    transcript = (
        "This is the first topic block discussing project updates.\n\n"
        "This is the second block with more content."
    )

    result = agent.run(transcript)

    assert len(result) == 2

    # Check first segment
    first = result[0]
    assert "first topic block" in first["title"].lower()
    assert first["start_char"] == 0

    # Check second segment roughly placed after "\n\n"
    second = result[1]
    assert "second block" in second["title"].lower()
    assert second["start_char"] > first["end_char"]


def test_cue_phrase_split():
    agent = TopicSegmentationAgent()

    transcript = (
        "We discussed design improvements. Next topic, we reviewed testing. "
        "Moving on, deployment strategy was finalized."
    )

    result = agent.run(transcript)

    # Cue triggers splitting into sentences
    assert len(result) >= 3

    titles = [seg["title"].lower() for seg in result]

    assert any("we discussed design improvements" in t for t in titles)
    assert any("next topic, we reviewed testing" in t for t in titles)
    assert any("moving on, deployment strategy was finalized" in t for t in titles)


def test_title_inference_short_sentence():
    agent = TopicSegmentationAgent()

    transcript = "Short topic sentence with enough words."

    result = agent.run(transcript)
    title = result[0]["title"]

    # Should use entire sentence if <= 8 words
    assert title == "Short topic sentence with enough words."


def test_title_inference_long_sentence():
    agent = TopicSegmentationAgent()

    transcript = (
        "This is a very long sentence that clearly contains more than eight words "
        "and should be truncated for the title."
    )

    result = agent.run(transcript)
    title = result[0]["title"]

    # First 8 words + ellipsis
    assert title.startswith("This is a very long sentence that clearly…")


def test_snippet_trimming_and_newline_removal():
    agent = TopicSegmentationAgent()

    transcript = "A long block\nwith a newline should produce a snippet without newlines."

    result = agent.run(transcript)

    snippet = result[0]["snippet"]

    # Snippet must not contain newline characters
    assert "\n" not in snippet
    assert snippet.startswith("A long block with a newline")


def test_start_end_offsets_increase_monotonically():
    agent = TopicSegmentationAgent()

    transcript = (
        "First topic sentence.\n\n"
        "Next topic sentence. Moving on to another topic."
    )

    result = agent.run(transcript)

    # Ensure each segment has advancing start positions
    for i in range(1, len(result)):
        assert result[i]["start_char"] >= result[i - 1]["start_char"]
