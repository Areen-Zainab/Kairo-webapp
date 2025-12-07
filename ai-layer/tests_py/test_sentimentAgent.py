# ai-layer/tests_py/test_sentimentAgent.py - Tests for SentimentAnalysisAgent
import pytest
from agents.sentiment_analysis_agent import SentimentAnalysisAgent


def test_empty_transcript():
    agent = SentimentAnalysisAgent()
    result = agent.run("")

    assert result["overall"] == "neutral"
    assert result["positive_score"] == 0.0
    assert result["negative_score"] == 0.0
    assert result["neutral_score"] == 1.0
    assert result["engagement"] == "low"


def test_positive_sentiment():
    agent = SentimentAnalysisAgent()
    transcript = "This is a great and awesome day. Everyone is happy and excited."

    result = agent.run(transcript)

    assert result["overall"] == "positive"
    assert result["positive_score"] > result["negative_score"]
    assert result["positive_score"] > 0.01


def test_negative_sentiment():
    agent = SentimentAnalysisAgent()
    transcript = (
        "We are worried about this problem. It is a bad issue and people are frustrated."
    )

    result = agent.run(transcript)

    assert result["overall"] == "negative"
    assert result["negative_score"] > result["positive_score"]
    assert result["negative_score"] > 0.01


def test_neutral_sentiment():
    agent = SentimentAnalysisAgent()
    transcript = "We discussed the meeting notes and reviewed the timeline."

    result = agent.run(transcript)

    assert result["overall"] == "neutral"
    assert result["positive_score"] == 0.0
    assert result["negative_score"] == 0.0


def test_score_calculation_correct():
    agent = SentimentAnalysisAgent()
    transcript = "good bad neutral words here"

    # Expected:
    # words = 5
    # pos = 1, neg = 1
    # pos_score = 1/5 = 0.2
    # neg_score = 1/5 = 0.2
    # neutral = 1 - 0.4 = 0.6

    result = agent.run(transcript)

    assert result["positive_score"] == 0.2
    assert result["negative_score"] == 0.2
    assert round(result["neutral_score"], 4) == 0.6
    assert result["overall"] == "neutral"  # since scores equal


def test_engagement_low():
    agent = SentimentAnalysisAgent()
    transcript = "short sentence."

    result = agent.run(transcript)

    assert result["engagement"] == "low"


def test_engagement_medium():
    agent = SentimentAnalysisAgent()
    transcript = "This is a sentence with a moderate number of words that should classify as medium engagement."

    result = agent.run(transcript)

    assert result["engagement"] == "medium"


def test_engagement_high():
    agent = SentimentAnalysisAgent()
    transcript = (
        "This sentence is intentionally very long and contains more than twenty words so that the agent "
        "classifies it as having high engagement based on average sentence length and discussion detail."
    )

    result = agent.run(transcript)

    assert result["engagement"] == "high"
