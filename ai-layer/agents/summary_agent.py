"""
Summary Agent
-------------

Synthesizes a high-level summary from the transcript and (optionally) from
other agent outputs. For now this is a simple extractive summary that picks
representative sentences.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Optional


@dataclass
class SummaryResult:
    short_summary: str
    detailed_summary: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SummaryAgent:
    """Produces short and detailed textual summaries."""

    def run(
        self,
        transcript: str,
        *,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate both a short and a slightly more detailed summary.

        All extra agent outputs are optional; when present they help
        structure the summary text.
        """
        if not transcript:
            return SummaryResult(
                short_summary="No transcript content available.",
                detailed_summary="The meeting transcript was empty, so no summary could be generated.",
            ).to_dict()

        # Very primitive extractive summary: pick first N non-trivial sentences.
        sentences = [
            s.strip()
            for s in transcript.replace("?", ".").replace("!", ".").split(".")
            if len(s.strip().split()) > 4
        ]

        short = " ".join(sentences[:2]) if sentences else transcript[:200]

        sections: List[str] = []
        sections.append(f"Overall, the meeting covered approximately {len(sentences)} substantial discussion points.")

        if topic_segments:
            titles = [seg.get("title") for seg in topic_segments[:5] if seg.get("title")]
            if titles:
                sections.append("Key topics included: " + "; ".join(titles) + ".")

        if decisions:
            sections.append(f"{len(decisions)} notable decisions were recorded.")

        if action_items:
            sections.append(f"{len(action_items)} follow-up action items were identified.")

        if sentiment:
            overall = sentiment.get("overall", "neutral")
            engagement = sentiment.get("engagement", "medium")
            sections.append(
                f"The overall sentiment of the discussion was {overall}, with {engagement} participant engagement."
            )

        # Add a bit of raw extractive context at the end
        tail = " ".join(sentences[:5]) if sentences else transcript[:600]
        sections.append("Discussion highlights: " + tail)

        detailed = "\n".join(sections)

        return SummaryResult(short_summary=short, detailed_summary=detailed).to_dict()


