"""
Action Item Agent
-----------------

Uses Grok Cloud API (xAI) to extract action items from meeting transcripts.
Falls back to simple pattern matching if API is unavailable.
"""

from __future__ import annotations

import os
import json
import requests
from typing import List, Dict, Any, Optional


class ActionItemAgent:
    """Extracts action items / follow-ups from the transcript using Grok Cloud API."""

    # Grok API configuration
    GROK_API_URL = "https://api.x.ai/v1/chat/completions"
    GROK_MODEL = "grok-4.1-fast"  # Most cost-effective model
    GROK_API_KEY_ENV = "GROK_API_KEY"

    # Fallback pattern matching cues
    OWNER_CUES = ("i will", "i'll", "i can", "i'll take", "let me")
    GENERIC_CUES = ("we need to", "let's", "todo", "action item", "follow up")

    def __init__(self):
        self.api_key = os.getenv(self.GROK_API_KEY_ENV)
        self.use_api = bool(self.api_key)

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract action items from transcript using Grok API or fallback method."""
        if not transcript:
            return []

        # Try Grok API first if API key is available
        if self.use_api:
            try:
                return self._extract_with_grok(transcript)
            except Exception as e:
                print(f"Warning: Grok API extraction failed: {e}. Falling back to pattern matching.")
                # Fall through to pattern matching

        # Fallback to simple pattern matching
        return self._extract_with_patterns(transcript)

    def _extract_with_grok(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract action items using Grok Cloud API."""
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
                    "content": "You are an expert at analyzing meeting transcripts and extracting actionable items. Always respond with valid JSON only, no additional text."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,  # Lower temperature for more consistent extraction
            "max_tokens": 2000
        }

        response = requests.post(
            self.GROK_API_URL,
            headers=headers,
            json=payload,
            timeout=30
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
            action_items = parsed.get("action_items", [])
            
            # Normalize the format to match expected structure
            normalized = []
            for idx, item in enumerate(action_items):
                normalized_item = {
                    "id": idx,
                    "title": item.get("title") or item.get("description", "")[:100] or "Untitled Action Item",
                    "description": item.get("description") or item.get("title") or "",
                    "assignee": item.get("assignee") or item.get("assigned_to") or item.get("assignee_name") or None,
                    "dueDate": item.get("dueDate") or item.get("due_date") or None,
                    "confidence": float(item.get("confidence", 0.8))
                }
                normalized.append(normalized_item)
            
            return normalized
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Grok API JSON response: {e}")

    def _build_extraction_prompt(self, transcript: str) -> str:
        """Build the prompt for action item extraction."""
        # Truncate transcript if too long (keep last 8000 chars for context)
        max_length = 8000
        if len(transcript) > max_length:
            transcript = "..." + transcript[-max_length:]

        return f"""Analyze the following meeting transcript and extract all action items, tasks, and follow-up items mentioned.

For each action item, identify:
1. **title**: A concise title (max 100 chars)
2. **description**: The full description of what needs to be done
3. **assignee**: The person responsible (if mentioned, otherwise null)
4. **dueDate**: Any deadline or due date mentioned (ISO format YYYY-MM-DD or null)
5. **confidence**: Your confidence in this extraction (0.0 to 1.0)

Return ONLY a JSON object with this exact structure:
{{
  "action_items": [
    {{
      "title": "Short title",
      "description": "Full description",
      "assignee": "Name or null",
      "dueDate": "YYYY-MM-DD or null",
      "confidence": 0.85
    }}
  ]
}}

Transcript:
{transcript}

JSON Response:"""

    def _extract_with_patterns(self, transcript: str) -> List[Dict[str, Any]]:
        """Fallback: Extract action items using simple pattern matching."""
        sentences = self._split_sentences(transcript)
        actions: List[Dict[str, Any]] = []

        for idx, s in enumerate(sentences):
            lowered = s.lower()
            assignee: str | None = None

            if any(cue in lowered for cue in self.OWNER_CUES):
                assignee = "speaker"
            elif any(cue in lowered for cue in self.GENERIC_CUES):
                assignee = "team"
            else:
                continue

            description = s.strip()
            title = description[:100] if len(description) > 100 else description

            actions.append({
                "id": idx,
                "title": title,
                "description": description,
                "assignee": assignee,
                "dueDate": None,
                "confidence": 0.5
            })

        return actions

    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        raw = [s.strip() for s in text.replace("?", ".").replace("!", ".").split(".")]
        return [s for s in raw if s]


