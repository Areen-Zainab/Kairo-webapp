"""
Action Item Agent
-----------------

Uses Grok Cloud API (xAI) to extract action items from meeting transcripts.
Falls back to simple pattern matching if API is unavailable.
"""

from __future__ import annotations

import os
import re
import json
import requests
from typing import List, Dict, Any, Optional


class ActionItemAgent:
    """Extracts action items / follow-ups from the transcript using Grok Cloud API."""

    # Grok API configuration
    GROK_API_URL = "https://api.x.ai/v1/chat/completions"
    GROK_MODEL = "grok-4.1-fast"  # Most cost-effective model
    GROK_API_KEY_ENV = "GROK-API"

    # Fallback pattern matching cues
    OWNER_CUES = ("i will", "i'll", "i can", "i'll take", "let me")
    GENERIC_CUES = ("we need to", "let's", "todo", "action item", "follow up")

    def __init__(self):
        self.api_key = os.getenv(self.GROK_API_KEY_ENV)
        self.use_api = bool(self.api_key)

    def _preprocess_text(self, text: str) -> str:
        """Remove timestamps and normalize whitespace from transcript."""
        # Remove timestamps in various formats
        text = re.sub(r'\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-\s*\d{2}:\d{2}:\d{2}\.\d{3}\]', '', text)
        text = re.sub(r'\d+s\):\s*', '', text)
        text = re.sub(r'\[\d{2}:\d{2}:\d{2}\]', '', text)
        text = re.sub(r'\(\d{1,2}:\d{2}:\d{2}\)', '', text)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _clean_text(self, text: str) -> str:
        """Clean any remaining timestamp artifacts and normalize text."""
        if not text:
            return text
        
        # Remove timestamp patterns
        text = re.sub(r'\d+s\):\s*', '', text)
        text = re.sub(r'\[\d{2}:\d{2}:\d{2}[.\d]*\s*-?\s*\d{0,2}:?\d{0,2}:?\d{0,2}[.\d]*\]', '', text)
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _generate_meaningful_title(self, description: str) -> str:
        """Generate a concise, meaningful title from action item description."""
        # Clean the description first
        description = self._clean_text(description)
        
        # Remove common prefixes to get to the core action
        prefixes_to_remove = [
            r'^(i will|i\'ll|i can|i\'ll take|let me|i should|i need to)\s+',
            r'^(we need to|we should|we must|we have to|we\'ll|let\'s)\s+',
            r'^(someone needs to|someone should|please|can you|could you)\s+',
            r'^(action:|todo:|follow up:|next steps?:)\s*',
        ]
        
        cleaned = description.lower()
        for prefix in prefixes_to_remove:
            cleaned = re.sub(prefix, '', cleaned, flags=re.IGNORECASE)
        
        # Capitalize first letter
        if cleaned:
            cleaned = cleaned[0].upper() + cleaned[1:]
        
        # If still too long, extract key verb + object pattern
        words = cleaned.split()
        if len(words) > 8:
            # Try to identify verb and main object
            # Look for verb patterns (first 2-3 words usually contain the action)
            title_words = []
            for i, word in enumerate(words[:10]):
                title_words.append(word)
                # Stop at around 6-8 words or at natural breaks
                if i >= 5 and word.endswith((',', '.', ':', ';')):
                    break
                if len(title_words) >= 8:
                    break
            
            cleaned = ' '.join(title_words).rstrip('.,;:')
        
        # Final length check - hard cap at 80 characters for UI
        if len(cleaned) > 80:
            cleaned = cleaned[:77] + "..."
        
        return cleaned or description[:80]

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract action items from transcript using Grok API or fallback method."""
        if not transcript or len(transcript.strip()) < 50:
            return []

        # Preprocess transcript to remove timestamps
        clean_transcript = self._preprocess_text(transcript)

        # Try Grok API first if API key is available
        if self.use_api:
            try:
                result = self._extract_with_grok(clean_transcript)
                # Ensure we return a list (even if empty)
                return result if isinstance(result, list) else []
            except Exception as e:
                print(f"Warning: Grok API extraction failed: {e}. Falling back to pattern matching.")
                # Fall through to pattern matching

        # Fallback to simple pattern matching
        return self._extract_with_patterns(clean_transcript)

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
                    "content": "You are an expert at analyzing meeting transcripts and extracting actionable items. Always respond with valid JSON only, no additional text. Create concise, meaningful titles for each action item."
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
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # Parse JSON response
        try:
            parsed = json.loads(content)
            action_items = parsed.get("action_items", [])
            
            # If no action items, return empty list
            if not action_items or len(action_items) == 0:
                return []
            
            # Normalize the format to match expected structure
            normalized = []
            for idx, item in enumerate(action_items):
                # Only include items with reasonable confidence
                confidence = float(item.get("confidence", 0.8))
                if confidence < 0.3:
                    continue
                
                # Get title and description
                title = self._clean_text(item.get("title", ""))
                description = self._clean_text(item.get("description", ""))
                
                # If title is missing or is just a copy of description, generate meaningful title
                if not title or (description and title == description[:len(title)]):
                    title = self._generate_meaningful_title(description) if description else ""
                
                # If description is missing, use title
                if not description:
                    description = title
                
                # Ensure we have at least a title
                if not title:
                    continue
                
                # Ensure title is concise (max 80 chars for UI display)
                if len(title) > 80:
                    title = title[:77] + "..."
                
                assignee = self._clean_text(item.get("assignee") or item.get("assigned_to") or item.get("assignee_name") or "")
                
                normalized_item = {
                    "id": idx,
                    "title": title,
                    "description": description,
                    "assignee": assignee if assignee else None,
                    "dueDate": item.get("dueDate") or item.get("due_date") or None,
                    "confidence": confidence
                }
                normalized.append(normalized_item)
            
            return normalized
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Grok API JSON response: {e}")

    def _build_extraction_prompt(self, transcript: str) -> str:
        """Build the prompt for action item extraction."""
        # Only truncate if extremely long
        max_length = 20000
        if len(transcript) > max_length:
            transcript = "..." + transcript[-max_length:]

        return f"""Analyze the following meeting transcript and extract ALL action items, tasks, and follow-up items that were mentioned.

IMPORTANT INSTRUCTIONS FOR ACTION ITEMS:

**Title Requirements:**
- Create a CONCISE, MEANINGFUL title for each action item (max 80 characters)
- The title should be action-oriented and clearly state WHAT needs to be done
- Remove verbal filler like "I will", "We need to", "Let's", etc. from titles
- Use imperative form when possible (e.g., "Review Q3 budget proposal" not "We need to review Q3 budget proposal")
- Examples of good titles:
  * "Review Q3 budget proposal"
  * "Update database migration timeline"
  * "Schedule follow-up meeting with client"
  * "Prepare sales presentation for board"
  * "Fix authentication bug in mobile app"
- Examples of bad titles:
  * "I will review the budget" (contains "I will")
  * "We need to update the database" (contains "we need to")
  * "Let's schedule a follow-up meeting with the client next week to discuss the project timeline and deliverables" (too long)

**Extraction Guidelines:**
- Read the ENTIRE transcript carefully to identify ALL action items
- Look for explicit commitments, tasks, or follow-ups with patterns like:
  * "I will...", "I'll...", "I can...", "I'll take...", "Let me..."
  * "We need to...", "We should...", "We must...", "We have to..."
  * "Let's...", "Someone needs to...", "Someone should..."
  * "Action:", "TODO:", "Follow up:", "Next steps:"
  * "Please...", "Can you...", "Could you..."
- Extract the assignee name if explicitly mentioned (who will do it)
- Extract any deadlines or due dates mentioned
- Be thorough - capture ALL action items, even if confidence is moderate (0.3+)
- If NO action items are found, return an empty array: {{"action_items": []}}
- Do NOT make up action items - only extract what is explicitly stated

For each action item, provide:
1. **title**: A concise, action-oriented title (max 80 chars, imperative form, no verbal filler)
2. **description**: The full context and details of what needs to be done (can be longer, include original phrasing)
3. **assignee**: The person responsible (extract actual name if mentioned, otherwise null)
4. **dueDate**: Any deadline or due date mentioned (ISO format YYYY-MM-DD or null)
5. **confidence**: Your confidence in this extraction (0.0 to 1.0)

Return ONLY a JSON object with this exact structure:
{{
  "action_items": [
    {{
      "title": "Review Q3 budget proposal",
      "description": "John mentioned he will review the Q3 budget proposal and provide feedback to the team by end of week",
      "assignee": "John",
      "dueDate": "2024-03-15",
      "confidence": 0.9
    }},
    {{
      "title": "Update project timeline",
      "description": "Team needs to update the project timeline to reflect the new deadline discussed in the meeting",
      "assignee": null,
      "dueDate": null,
      "confidence": 0.8
    }}
  ]
}}

If no action items are found, return: {{"action_items": []}}

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

            # Clean the sentence
            description = self._clean_text(s.strip())
            
            # Generate meaningful title from description
            title = self._generate_meaningful_title(description)

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