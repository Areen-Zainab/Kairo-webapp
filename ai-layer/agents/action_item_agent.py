"""
Action Item Agent
-----------------

Uses Groq Cloud API (Llama 3.2 3B) to extract action items from meeting transcripts.
Falls back to simple pattern matching if API is unavailable.
"""

from __future__ import annotations

import os
import sys
import re
import json
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime
from hf_client import hf_infer


class ActionItemAgent:
    """Extracts action items / follow-ups from the transcript using Groq Cloud API."""

    # Groq API configuration (FREE)
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL = "openai/gpt-oss-120b"  # Updated per Groq curl example
    # Alternative: "llama-3.1-8b-instant" for slightly better accuracy
    GROQ_API_KEY_ENV = "GROQ_API_KEY"
    ACTION_ITEMS_PROVIDER_ENV = "ACTION_ITEMS_PROVIDER"  # groq | hf
    HF_ACTION_MODEL = "google/flan-t5-large"

    # Fallback pattern matching cues
    OWNER_CUES = ("i will", "i'll", "i can", "i'll take", "let me")
    GENERIC_CUES = ("we need to", "let's", "todo", "action item", "follow up")
    
    # Title generation constants
    MAX_TITLE_LENGTH = 80
    PREFIXES_TO_REMOVE = [
        r'^(i will|i\'ll|i can|i\'ll take|let me|i should|i need to)\s+',
        r'^(we need to|we should|we must|we have to|we\'ll|let\'s)\s+',
        r'^(someone needs to|someone should|please|can you|could you)\s+',
        r'^(action:|todo:|follow up:|next steps?:)\s*',
    ]

    def __init__(self):
        self.provider = os.getenv(self.ACTION_ITEMS_PROVIDER_ENV, "groq").lower()
        self.api_key = os.getenv(self.GROQ_API_KEY_ENV)
        self.use_api = bool(self.api_key)
        self.use_hf = self.provider == "hf"
        if not self.api_key and self.provider == "groq":
            print("Error: GROQ_API_KEY not set; action item agent will skip Groq extraction.", file=sys.stderr)

    def _clean_text(self, text: str) -> str:
        """
        Clean text by removing timestamps and normalizing whitespace.
        Unified method - replaces both _preprocess_text and old _clean_text.
        """
        if not text:
            return ""
        
        # Remove various timestamp formats
        patterns = [
            r'\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-\s*\d{2}:\d{2}:\d{2}\.\d{3}\]',
            r'\[\d{2}:\d{2}:\d{2}[.\d]*\s*-?\s*\d{0,2}:?\d{0,2}:?\d{0,2}[.\d]*\]',
            r'\d+s\):\s*',
            r'\(\d{1,2}:\d{2}:\d{2}\)',
        ]
        for pattern in patterns:
            text = re.sub(pattern, '', text)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _truncate_title(self, title: str) -> str:
        """Ensure title doesn't exceed maximum length."""
        if len(title) > self.MAX_TITLE_LENGTH:
            return title[:self.MAX_TITLE_LENGTH - 3] + "..."
        return title

    def _extract_assignee(self, item: Dict[str, Any]) -> Optional[str]:
        """Extract assignee from various possible field names."""
        assignee = (
            item.get("assignee") or 
            item.get("assigned_to") or 
            item.get("assignee_name") or 
            ""
        )
        cleaned = self._clean_text(assignee)
        return cleaned if cleaned else None

    def _validate_date(self, date_str: Optional[str]) -> Optional[str]:
        """Validate and normalize date string to ISO format."""
        if not date_str:
            return None
        
        try:
            # Try parsing common formats
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%m/%d/%Y', '%d/%m/%Y']:
                try:
                    dt = datetime.strptime(str(date_str), fmt)
                    return dt.strftime('%Y-%m-%d')
                except ValueError:
                    continue
            # If no format matches, return None
            return None
        except:
            return None

    def _generate_meaningful_title(self, description: str) -> str:
        """Generate a concise, meaningful title from action item description."""
        # Clean the description first
        description = self._clean_text(description)
        if not description:
            return ""
        
        # Remove common prefixes to get to the core action
        cleaned = description.lower()
        for prefix in self.PREFIXES_TO_REMOVE:
            cleaned = re.sub(prefix, '', cleaned, flags=re.IGNORECASE)
        
        # Capitalize first letter
        if cleaned:
            cleaned = cleaned[0].upper() + cleaned[1:]
        
        # If still too long, extract key verb + object pattern
        words = cleaned.split()
        if len(words) > 8:
            # Keep first 6-8 words or stop at punctuation
            title_words = []
            for i, word in enumerate(words[:10]):
                title_words.append(word)
                if i >= 5 and word.endswith((',', '.', ':', ';')):
                    break
                if len(title_words) >= 8:
                    break
            
            cleaned = ' '.join(title_words).rstrip('.,;:')
        
        # Truncate to max length
        return self._truncate_title(cleaned or description)

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract action items from transcript using Groq API or fallback method."""
        if not transcript or len(transcript.strip()) < 50:
            return []

        # Clean transcript
        clean_transcript = self._clean_text(transcript)

        # Priority: HF -> Groq -> extractive
        try:
            result = self._extract_with_hf(clean_transcript)
            if result:
                return result
        except Exception as e:
            print(f"Warning: HF action item extraction failed: {e}. Trying Groq...", file=sys.stderr)

        if self.use_api:
            try:
                result = self._extract_with_groq(clean_transcript)
                return result if isinstance(result, list) else []
            except Exception as e:
                print(f"Warning: Groq API extraction failed: {e}. Falling back to pattern matching.", file=sys.stderr)

        # Fallback to simple pattern matching
        return self._extract_with_patterns(clean_transcript)

    def _extract_with_hf(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract action items using Hugging Face hosted model."""
        # Chunk transcript to avoid length limits
        words = transcript.split()
        max_words = 800
        overlap = 80
        chunks = []
        start = 0
        while start < len(words):
            end = min(len(words), start + max_words)
            chunk = " ".join(words[start:end])
            chunks.append(chunk)
            start = end - overlap if end < len(words) else len(words)

        action_items: List[Dict[str, Any]] = []

        for chunk in chunks:
            prompt = (
                "Extract action items from the meeting dialogue below.\n"
                "Return JSON ONLY in this exact format:\n"
                '{"action_items":[{"title":"","description":"","assignee":null,"dueDate":null,"confidence":0.7}]}\n\n'
                f"Dialogue:\n{chunk}\n\nJSON:"
            )

            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 256,
                    "temperature": 0.3,
                    "return_full_text": False,
                }
            }

            result = hf_infer(self.HF_ACTION_MODEL, payload, timeout=60, retries=2, backoff_seconds=3)

            generated_text = None
            if isinstance(result, list) and result and isinstance(result[0], dict):
                generated_text = result[0].get("generated_text")
            elif isinstance(result, dict):
                generated_text = result.get("generated_text")

            if not generated_text:
                continue

            parsed_items = []
            try:
                parsed = json.loads(generated_text)
                parsed_items = parsed.get("action_items", [])
            except Exception:
                # Try to recover by stripping code fences or lines
                cleaned = generated_text.strip("` \n")
                try:
                    parsed = json.loads(cleaned)
                    parsed_items = parsed.get("action_items", [])
                except Exception:
                    continue

            if not isinstance(parsed_items, list):
                continue

            for idx, item in enumerate(parsed_items):
                normalized = self._normalize_action_item(item, idx)
                if normalized:
                    action_items.append(normalized)

        # Deduplicate by title/description
        dedup = []
        seen = set()
        for item in action_items:
            key = (item["title"], item.get("description", ""))
            if key not in seen:
                seen.add(key)
                dedup.append(item)

        return dedup

    def _extract_with_groq(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract action items using Groq Cloud API (Llama 3.2 3B)."""
        prompt = self._build_extraction_prompt(transcript)

        payload = {
            "model": self.GROQ_MODEL,
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
            "temperature": 0.2,  # Lower for more consistent, faster extraction
            "max_tokens": 1500  # Reduced from 2000 for faster response
        }

        response = requests.post(
            self.GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        response.raise_for_status()
        result = response.json()

        # Extract and clean content
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        content = self._strip_markdown(content)

        # Basic sanity check before parsing
        cleaned = content.lstrip()
        if not cleaned.startswith(("{", "[")):
            raise ValueError(f"Groq response was not JSON: {content[:100]}")
        
        # Parse and normalize
        try:
            parsed = json.loads(content)
            action_items = parsed.get("action_items", [])
            
            if not action_items:
                return []
            
            # Normalize format
            normalized = []
            for idx, item in enumerate(action_items):
                normalized_item = self._normalize_action_item(item, idx)
                if normalized_item:
                    normalized.append(normalized_item)
            
            return normalized
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Groq API JSON response: {e}")

    def _strip_markdown(self, content: str) -> str:
        """Remove markdown code blocks from content."""
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        return content.strip()

    def _normalize_action_item(self, item: Dict[str, Any], idx: int) -> Optional[Dict[str, Any]]:
        """
        Normalize a single action item to standard format.
        Returns None if item should be filtered out.
        """
        # Get confidence (don't filter here - let service layer handle it)
        confidence = float(item.get("confidence", 0.8))
        
        # Get and clean title/description
        title = self._clean_text(item.get("title", ""))
        description = self._clean_text(item.get("description", ""))
        
        # Generate title if missing or redundant
        if not title or (description and title == description[:len(title)]):
            title = self._generate_meaningful_title(description) if description else ""
        
        # Use title as description if description is missing
        if not description:
            description = title
        
        # Skip if no title
        if not title:
            return None
        
        # Truncate title
        title = self._truncate_title(title)
        
        # Extract assignee
        assignee = self._extract_assignee(item)
        
        # Validate and normalize date
        due_date = self._validate_date(
            item.get("dueDate") or item.get("due_date")
        )
        
        return {
            "id": idx,
            "title": title,
            "description": description,
            "assignee": assignee,
            "dueDate": due_date,
            "confidence": confidence
        }

    def _build_extraction_prompt(self, transcript: str) -> str:
        """Build the prompt for action item extraction."""
        # Truncate if extremely long
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

**Extraction Guidelines:**
- Read the ENTIRE transcript carefully to identify ALL action items
- Look for explicit commitments, tasks, or follow-ups with patterns like:
  * "I will...", "I'll...", "I can...", "I'll take...", "Let me..."
  * "We need to...", "We should...", "We must...", "We have to..."
  * "Let's...", "Someone needs to...", "Someone should..."
  * "Action:", "TODO:", "Follow up:", "Next steps:"
  * "Please...", "Can you...", "Could you..."
- Extract the assignee name if explicitly mentioned (who will do it)
- Extract any deadlines or due dates mentioned (use YYYY-MM-DD format)
- Be thorough - capture ALL action items, even if confidence is moderate (0.3+)
- If NO action items are found, return an empty array: {{"action_items": []}}
- Do NOT make up action items - only extract what is explicitly stated

For each action item, provide:
1. **title**: A concise, action-oriented title (max 80 chars, imperative form, no verbal filler)
2. **description**: The full context and details of what needs to be done
3. **assignee**: The person responsible (extract actual name if mentioned, otherwise null)
4. **dueDate**: Any deadline or due date mentioned (YYYY-MM-DD format or null)
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
            
            # Determine assignee
            if any(cue in lowered for cue in self.OWNER_CUES):
                assignee = "speaker"
            elif any(cue in lowered for cue in self.GENERIC_CUES):
                assignee = "team"
            else:
                continue

            # Clean and generate title
            description = self._clean_text(s.strip())
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