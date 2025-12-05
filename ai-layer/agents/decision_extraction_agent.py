"""
Decision Extraction Agent
-------------------------

Extracts simple "decision" statements from a transcript.
This is intentionally conservative and heuristic-based for now.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Dict, Any


@dataclass
class Decision:
    id: int
    text: str
    rationale: str
    owner: str | None = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DecisionExtractionAgent:
    """Finds and documents key decisions from a transcript."""

    CUE_PHRASES = (
        "we decided",
        "we've decided",
        "we will",
        "we'll",
        "we agree",
        "we agreed",
        "decision is",
        "the plan is",
        "let's go with",
        "we are going to",
    )

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        """
        Extract decision-like sentences from the transcript.

        For a first pass we:
        - split on sentences
        - keep those containing decision cue phrases
        """
        if not transcript:
            return []

        sentences = self._split_sentences(transcript)
        decisions: List[Decision] = []

        for sentence in sentences:
            lowered = sentence.lower()
            if any(phrase in lowered for phrase in self.CUE_PHRASES):
                rationale = "Detected decision cue phrase in sentence."
                decisions.append(
                    Decision(
                        id=len(decisions),
                        text=sentence.strip(),
                        rationale=rationale,
                        owner=None,
                    )
                )

        return [d.to_dict() for d in decisions]

    def _split_sentences(self, text: str) -> List[str]:
        raw = [s.strip() for s in text.replace("?", ".").replace("!", ".").split(".")]
        return [s for s in raw if s]


