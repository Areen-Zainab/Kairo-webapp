"""
Topic Segmentation Agent
------------------------

Very lightweight, heuristic topic segmentation for meeting transcripts.
This is a placeholder implementation – it uses simple rules such as
paragraph boundaries and cue phrases to split the transcript into segments.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List, Dict, Any


@dataclass
class TopicSegment:
    id: int
    title: str
    start_char: int
    end_char: int
    snippet: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class TopicSegmentationAgent:
    """Identifies coarse-grained topic boundaries in a transcript."""

    CUE_PHRASES = (
        "next topic",
        "moving on",
        "let's move on",
        "the next point",
        "new topic",
        "agenda item",
    )

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        """
        Segment the transcript into topic blocks.

        For now, this uses a very naive heuristic:
        - Split into paragraphs on double newlines
        - Further split large paragraphs if they contain cue phrases
        """
        if not transcript:
            return []

        segments: List[TopicSegment] = []
        cursor = 0
        raw_blocks = transcript.split("\n\n")

        for block_index, block in enumerate(raw_blocks):
            block = block.strip()
            if not block:
                cursor += 2  # account for skipped double newlines
                continue

            # Look for cue phrases; if present, we treat each sentence
            # containing a cue as a potential segment start.
            sub_blocks = [block]
            lowered = block.lower()
            if any(phrase in lowered for phrase in self.CUE_PHRASES):
                sub_blocks = [s.strip() for s in block.split(".") if s.strip()]

            local_offset = 0
            for sub in sub_blocks:
                start = cursor + local_offset
                end = start + len(sub)
                snippet = sub[:160].replace("\n", " ")
                title = self._infer_title(sub, default=f"Topic {len(segments) + 1}")

                segments.append(
                    TopicSegment(
                        id=len(segments),
                        title=title,
                        start_char=start,
                        end_char=end,
                        snippet=snippet,
                    )
                )
                local_offset += len(sub) + 1  # +1 for the split character

            cursor += len(block) + 2  # +2 for the double newline we split on

        return [s.to_dict() for s in segments]

    def _infer_title(self, text: str, default: str) -> str:
        """Infer a rough title from the first short sentence fragment."""
        text = text.strip()
        if not text:
            return default

        # Take up to ~8 words as a title
        words = text.split()
        if len(words) <= 8:
            return text
        return " ".join(words[:8]) + "…"


