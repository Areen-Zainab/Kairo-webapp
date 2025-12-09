"""
Decision Extraction Agent
-------------------------

Uses GROQ Cloud API (xAI) to extract key decisions from meeting transcripts.
Falls back to simple pattern matching if API is unavailable.
"""

from __future__ import annotations

import os
import sys
import json
import time
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
    """Finds and documents key decisions from a transcript using GROQ Cloud API."""

    # GROQ API configuration
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL = "openai/gpt-oss-120b"  # Updated per Groq API
    GROQ_API_KEY_ENV = "GROQ_API_KEY"

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
        # Multi-key rotation
        self.api_keys = []
        key1 = os.getenv(self.GROQ_API_KEY_ENV)
        key2 = os.getenv("GROQ_API_KEY_2")
        if key1:
            self.api_keys.append(key1)
        if key2:
            self.api_keys.append(key2)

        self.current_key_index = 0
        self.use_api = len(self.api_keys) > 0
        if not self.use_api:
            print("Error: GROQ_API_KEY not set; decision agent will use fallback mode.", file=sys.stderr)
        elif len(self.api_keys) > 1:
            print(f"Info: {len(self.api_keys)} Groq API keys configured for rotation.", file=sys.stderr)

    def _get_next_api_key(self) -> str:
        if not self.api_keys:
            return None
        key = self.api_keys[self.current_key_index]
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        return key

    def _call_groq_api(self, payload: Dict[str, Any], timeout: int = 60) -> Dict[str, Any]:
        """
        Call Groq API with key rotation and retry on timeout/429.
        Multiple rounds with backoff. If 429 supplies Retry-After, we honor it.
        Improved: Try all keys first before sleeping to avoid unnecessary delays.
        """
        if not self.api_keys:
            raise ValueError("No Groq API keys configured")

        total_keys = len(self.api_keys)
        max_rounds = 3  # first pass + two retries
        base_wait_seconds = 5
        last_error = None
        retry_after_hint = None  # Track retry-after from any 429 response

        for round_idx in range(max_rounds):
            # Try all keys in this round
            for attempt_in_round in range(total_keys):
                api_key = self._get_next_api_key()
                try:
                    response = requests.post(
                        self.GROQ_API_URL,
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json"
                        },
                        json=payload,
                        timeout=timeout
                    )
                    response.raise_for_status()
                    return response.json()

                except requests.exceptions.Timeout as e:
                    last_error = e
                    print(f"Timeout with key {attempt_in_round + 1}/{total_keys} (round {round_idx + 1}); trying next key...", file=sys.stderr)
                    continue

                except requests.exceptions.HTTPError as e:
                    last_error = e
                    if e.response is not None and e.response.status_code == 429:
                        # Capture retry-after but don't sleep yet - try other keys first
                        retry_after = e.response.headers.get("Retry-After")
                        if retry_after:
                            try:
                                retry_after_hint = int(retry_after)
                            except Exception:
                                retry_after_hint = None
                        print(f"Rate limit (429) with key {attempt_in_round + 1}/{total_keys} (round {round_idx + 1}); trying next key...", file=sys.stderr)
                        if retry_after_hint:
                            print(f"Server suggests waiting {retry_after_hint}s.", file=sys.stderr)
                        continue
                    raise

                except Exception as e:
                    last_error = e
                    raise

            # After trying all keys, if we got 429s, wait before next round
            if round_idx < max_rounds - 1:
                if retry_after_hint:
                    # Cap wait time at 1 minute to avoid long blocking
                    # Server may suggest longer, but we'll try again after 1 min
                    wait_seconds = min(retry_after_hint, 60)  # Cap at 1 minute
                    print(f"All keys rate-limited in round {round_idx + 1}. Waiting {wait_seconds}s before retry (server suggested {retry_after_hint}s, capped at 60s)...", file=sys.stderr)
                    time.sleep(wait_seconds)
                    retry_after_hint = None  # Reset after using it
                else:
                    # Use exponential backoff if no retry-after hint
                    wait_seconds = base_wait_seconds * (round_idx + 1)
                    print(f"All keys failed in round {round_idx + 1}. Waiting {wait_seconds}s before retry...", file=sys.stderr)
                    time.sleep(wait_seconds)

        if last_error:
            raise last_error
        raise RuntimeError("Groq API failed after retries.")

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract decisions from transcript using GROQ API or fallback method."""
        if not transcript:
            return []

        # Try GROQ API first if API key is available
        if self.use_api:
            try:
                result = self._extract_with_GROQ(transcript)
                if result:
                    return result
                # If empty, return explicit no-decisions message
                return [self._no_decisions_placeholder()]
            except Exception as e:
                print(f"Warning: GROQ API decision extraction failed: {e}. Falling back to pattern matching.", file=sys.stderr)

        # Fallback to simple pattern matching
        pattern_results = self._extract_with_patterns(transcript)
        if pattern_results:
            return pattern_results
        return [self._no_decisions_placeholder()]

    def _extract_with_GROQ(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract decisions using GROQ Cloud API."""
        prompt = self._build_extraction_prompt(transcript)

        payload = {
            "model": self.GROQ_MODEL,
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

        result = self._call_groq_api(payload, timeout=60)

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
        
        # Basic sanity check before parsing
        if not content.lstrip().startswith(("{", "[")):
            raise ValueError(f"Groq response was not JSON: {content[:100]}")
        
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
            
            if not normalized:
                return [self._no_decisions_placeholder()]
            return normalized
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse GROQ API JSON response: {e}")

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

    def _no_decisions_placeholder(self) -> Dict[str, Any]:
        """Return a clear placeholder when no decisions are identified."""
        return {
            "decision": "No decisions identified.",
            "context": "",
            "impact": "Low",
            "participants": [],
            "timestamp": None,
            "confidence": 0.5
        }

    def _split_sentences(self, text: str) -> List[str]:
        raw = [s.strip() for s in text.replace("?", ".").replace("!", ".").split(".")]
        return [s for s in raw if s]


