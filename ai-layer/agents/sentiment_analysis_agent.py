"""
Sentiment Analysis Agent
------------------------

Performs a very lightweight sentiment + engagement pass over the transcript.
This is a heuristic implementation intended to be fast and dependency‑free
for now – you can later swap this out for a proper ML model.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, Any


@dataclass
class SentimentSummary:
    overall: str
    positive_score: float
    negative_score: float
    neutral_score: float
    engagement: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SentimentAnalysisAgent:
    """Evaluates basic emotional tone and engagement."""

    POSITIVE_WORDS = {
        "great",
        "good",
        "awesome",
        "excited",
        "happy",
        "love",
        "excellent",
        "nice",
        "cool",
        "amazing",
    }
    NEGATIVE_WORDS = {
        "bad",
        "concern",
        "worried",
        "problem",
        "issue",
        "sad",
        "angry",
        "frustrated",
        "annoyed",
        "hate",
        "blocked",
    }

    def run(self, transcript: str) -> Dict[str, Any]:
        if not transcript:
            return SentimentSummary(
                overall="neutral",
                positive_score=0.0,
                negative_score=0.0,
                neutral_score=1.0,
                engagement="low",
            ).to_dict()

        words = [w.strip(".,!?").lower() for w in transcript.split()]
        total = max(len(words), 1)
        pos = sum(1 for w in words if w in self.POSITIVE_WORDS)
        neg = sum(1 for w in words if w in self.NEGATIVE_WORDS)
        pos_score = pos / total
        neg_score = neg / total
        neu_score = max(0.0, 1.0 - pos_score - neg_score)

        if pos_score > neg_score * 1.5 and pos_score > 0.01:
            overall = "positive"
        elif neg_score > pos_score * 1.5 and neg_score > 0.01:
            overall = "negative"
        else:
            overall = "neutral"

        # Naive engagement proxy: average sentence length in words
        sentences = [s.strip() for s in transcript.replace("?", ".").replace("!", ".").split(".") if s.strip()]
        if sentences:
            avg_len = sum(len(s.split()) for s in sentences) / len(sentences)
        else:
            avg_len = len(words)

        if avg_len > 20:
            engagement = "high"
        elif avg_len > 8:
            engagement = "medium"
        else:
            engagement = "low"

        summary = SentimentSummary(
            overall=overall,
            positive_score=round(pos_score, 4),
            negative_score=round(neg_score, 4),
            neutral_score=round(neu_score, 4),
            engagement=engagement,
        )
        return summary.to_dict()


