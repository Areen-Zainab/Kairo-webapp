"""
Action Item Agent
-----------------

Identifies simple task-like statements in a transcript and attributes
them to a (possibly implicit) owner.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Dict, Any


@dataclass
class ActionItem:
    id: int
    description: str
    owner: str | None
    due: str | None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ActionItemAgent:
    """Extracts action items / follow-ups from the transcript."""

    OWNER_CUES = ("i will", "i'll", "i can", "i'll take", "let me")
    GENERIC_CUES = ("we need to", "let's", "todo", "action item", "follow up")

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        if not transcript:
            return []

        sentences = self._split_sentences(transcript)
        actions: List[ActionItem] = []

        for s in sentences:
            lowered = s.lower()
            owner: str | None = None

            if any(cue in lowered for cue in self.OWNER_CUES):
                owner = "speaker"
            elif any(cue in lowered for cue in self.GENERIC_CUES):
                owner = "team"
            else:
                continue

            actions.append(
                ActionItem(
                    id=len(actions),
                    description=s.strip(),
                    owner=owner,
                    due=None,
                )
            )

        return [a.to_dict() for a in actions]

    def _split_sentences(self, text: str) -> List[str]:
        raw = [s.strip() for s in text.replace("?", ".").replace("!", ".").split(".")]
        return [s for s in raw if s]


