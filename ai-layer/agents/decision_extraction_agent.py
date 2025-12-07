"""
Decision Extraction Agent
-------------------------

Uses Grok Cloud API (xAI) to extract key decisions from meeting transcripts.
Falls back to simple pattern matching if API is unavailable.
"""

from __future__ import annotations

import os
import json
import requests
from dataclasses import dataclass, asdict
from typing import List, Dict, Any


@dataclass
class Decision:
    decision: str
    context: str
    impact: str  # "High", "Medium", or "Low"
    participants: List[str]
    timestamp: float | None
    confidence: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DecisionExtractionAgent:
    """Finds and documents key decisions from a transcript using Grok Cloud API."""

    # Grok API configuration
    GROK_API_URL = "https://api.x.ai/v1/chat/completions"
    GROK_MODEL = "grok-4.1-fast"  # Most cost-effective model
    GROK_API_KEY_ENV = "GROK_API_KEY"

    # Fallback pattern matching cues
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

    def __init__(self):
        self.api_key = os.getenv(self.GROK_API_KEY_ENV)
        self.use_api = bool(self.api_key)

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract decisions from transcript using Grok API or fallback method."""
        if not transcript:
            return []

        # Try Grok API first if API key is available
        if self.use_api:
            try:
                return self._extract_with_grok(transcript)
            except Exception as e:
                print(f"Warning: Grok API decision extraction failed: {e}. Falling back to pattern matching.")
                # Fall through to pattern matching

        # Fallback to simple pattern matching
        return self._extract_with_patterns(transcript)

    def _extract_with_grok(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract decisions using Grok Cloud API."""
        prompt = self._build_extraction_prompt(transcript)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.GROK_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert at analyzing meeting transcripts and extracting key decisions. Always respond with valid JSON only, no additional text."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,  # Lower temperature for more consistent extraction
            "max_tokens": 3000
        }

        response = requests.post(
            self.GROK_API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )

        response.raise_for_status()
        result = response.json()

        # Extract the content from the response
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        
        # Clean content - remove markdown code blocks if present
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]  # Remove ```json
        if content.startswith("```"):
            content = content[3:]   # Remove ```
        if content.endswith("```"):
            content = content[:-3]  # Remove closing ```
        content = content.strip()
        
        # Parse JSON response
        try:
            parsed = json.loads(content)
            decisions_data = parsed.get("decisions", [])
            
            # Normalize the format
            normalized = []
            for idx, decision_item in enumerate(decisions_data):
                # Extract participants - handle both list and string formats
                participants = decision_item.get("participants", [])
                if isinstance(participants, str):
                    participants = [p.strip() for p in participants.split(",")]
                elif not isinstance(participants, list):
                    participants = []
                
                # Normalize impact level
                impact = decision_item.get("impact", "Medium")
                if isinstance(impact, str):
                    impact = impact.capitalize()
                    if impact not in ["High", "Medium", "Low"]:
                        impact = "Medium"
                
                # Get timestamp if available
                timestamp = decision_item.get("timestamp")
                if timestamp is not None:
                    try:
                        timestamp = float(timestamp)
                    except (ValueError, TypeError):
                        timestamp = None
                
                normalized_decision = Decision(
                    decision=decision_item.get("decision", "") or decision_item.get("text", ""),
                    context=decision_item.get("context", ""),
                    impact=impact,
                    participants=participants,
                    timestamp=timestamp,
                    confidence=float(decision_item.get("confidence", 0.8))
                )
                normalized.append(normalized_decision.to_dict())
            
            return normalized
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Grok API JSON response: {e}")

    def _build_extraction_prompt(self, transcript: str) -> str:
        """Build the prompt for decision extraction."""
        # Truncate transcript if too long (keep last 10000 chars for context)
        max_length = 10000
        if len(transcript) > max_length:
            transcript = "..." + transcript[-max_length:]

        return f"""Analyze the following meeting transcript and extract all key decisions made during the meeting.

For each decision, identify:
1. **decision**: The actual decision statement (what was decided)
2. **context**: When/where in the meeting this decision was discussed (e.g., "Discussed during slide 3 presentation", "Technical discussion during slide 2")
3. **impact**: The impact level - "High" (affects major outcomes/timelines), "Medium" (moderate impact), or "Low" (minor impact)
4. **participants**: List of speaker names or identifiers who were involved in making this decision
5. **timestamp**: Approximate time in seconds when this decision was made (if you can infer from context, otherwise null)
6. **confidence**: Your confidence in this extraction (0.0 to 1.0)

Return ONLY a JSON object with this exact structure:
{{
  "decisions": [
    {{
      "decision": "Decision statement here",
      "context": "Context description",
      "impact": "High|Medium|Low",
      "participants": ["Speaker1", "Speaker2"],
      "timestamp": 123.5,
      "confidence": 0.9
    }}
  ]
}}

Transcript:
{transcript}

JSON Response:"""

    def _extract_with_patterns(self, transcript: str) -> List[Dict[str, Any]]:
        """Fallback: Extract decisions using simple pattern matching."""
        sentences = self._split_sentences(transcript)
        decisions: List[Dict[str, Any]] = []

        for idx, sentence in enumerate(sentences):
            lowered = sentence.lower()
            if any(phrase in lowered for phrase in self.CUE_PHRASES):
                decisions.append({
                    "decision": sentence.strip(),
                    "context": "Detected decision cue phrase in transcript",
                    "impact": "Medium",  # Default for fallback
                    "participants": [],
                    "timestamp": None,
                    "confidence": 0.5
                })

        return decisions

    def _split_sentences(self, text: str) -> List[str]:
        raw = [s.strip() for s in text.replace("?", ".").replace("!", ".").split(".")]
        return [s for s in raw if s]


