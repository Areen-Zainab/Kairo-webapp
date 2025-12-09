"""
Topic Segmentation Agent
-------------------------

Uses GROQ Cloud API (xAI) to identify key topics in meeting transcripts.
Falls back to simple paragraph splitting if API is unavailable.
"""

from __future__ import annotations

import os
import sys
import json
import requests
from dataclasses import dataclass, asdict
from typing import List, Dict, Any


@dataclass
class Topic:
    name: str
    mentions: int
    sentiment: str  # "Positive", "Neutral", or "Negative"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class TopicSegmentationAgent:
    """Identifies key topics in a transcript using GROQ Cloud API."""

    # GROQ API configuration
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL = "openai/gpt-oss-120b"  # Updated per Groq API
    GROQ_API_KEY_ENV = "GROQ_API_KEY"

    # Fallback cue phrases
    CUE_PHRASES = (
        "next topic",
        "moving on",
        "let's move on",
        "the next point",
        "new topic",
        "agenda item",
    )

    def __init__(self):
        self.api_key = os.getenv(self.GROQ_API_KEY_ENV)
        self.use_api = bool(self.api_key)
        self.current_key_index = 0  # For key rotation
        if not self.api_key:
            print("Error: GROQ_API_KEY not set; topic agent will use fallback mode.", file=sys.stderr)
        else:
            # Check for second API key
            api_key_2 = os.getenv("GROQ_API_KEY_2")
            if api_key_2:
                print("Info: 2 Groq API keys configured for rotation.", file=sys.stderr)

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        """Identify topics using GROQ API or fallback method."""
        if not transcript:
            return []

        # Try GROQ API first if API key is available
        if self.use_api:
            try:
                return self._identify_with_GROQ(transcript)
            except Exception as e:
                print(f"Warning: GROQ API topic identification failed: {e}. Falling back to paragraph splitting.", file=sys.stderr)
                # Fall through to fallback method

        # Fallback to simple paragraph splitting
        return self._identify_with_paragraphs(transcript)

    def _get_next_api_key(self):
        """Rotate between available Groq API keys."""
        import time
        keys = [k for k in [self.api_key, os.getenv("GROQ_API_KEY_2")] if k]
        if not keys:
            raise ValueError("No Groq API keys available")
        self.current_key_index = (self.current_key_index + 1) % len(keys)
        return keys[self.current_key_index]

    def _call_groq_api(self, payload, max_rounds=3):
        """
        Call Groq API with retry logic, key rotation, and exponential backoff.
        Similar to action_item_agent.py and summary_agent.py.
        """
        import time
        last_error = None
        
        for round_num in range(max_rounds):
            api_key = self._get_next_api_key()
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            
            try:
                response = requests.post(
                    self.GROQ_API_URL,
                    headers=headers,
                    json=payload,
                    timeout=60
                )
                
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 5))
                    # Cap wait time at 1 minute to avoid long blocking
                    wait_time = min(retry_after, 60)
                    print(f"⏳ Groq 429 (round {round_num+1}/{max_rounds}), waiting {wait_time}s (server suggested {retry_after}s, capped at 60s)...", 
                          file=sys.stderr)
                    time.sleep(wait_time)
                    continue
                    
                response.raise_for_status()
                return response.json()
                
            except requests.exceptions.Timeout as e:
                last_error = e
                wait_time = 2 ** round_num  # exponential backoff
                print(f"⏳ Timeout (round {round_num+1}/{max_rounds}), retry in {wait_time}s...", 
                      file=sys.stderr)
                time.sleep(wait_time)
                
            except requests.exceptions.RequestException as e:
                last_error = e
                print(f"❌ Groq request error (round {round_num+1}/{max_rounds}): {e}", 
                      file=sys.stderr)
                if round_num < max_rounds - 1:
                    time.sleep(2 ** round_num)
        
        raise RuntimeError(f"Groq API failed after {max_rounds} rounds: {last_error}")

    def _identify_with_GROQ(self, transcript: str) -> List[Dict[str, Any]]:
        """Identify topics using GROQ Cloud API."""
        prompt = self._build_identification_prompt(transcript)

        payload = {
            "model": self.GROQ_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert at analyzing meeting transcripts and identifying key topics. Always respond with valid JSON only, no additional text."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.4,  # Slightly higher for topic identification
            "max_tokens": 2000
        }

        # Use retry logic with key rotation
        result = self._call_groq_api(payload)

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
            topics_data = parsed.get("topics", [])
            
            # Normalize the format
            normalized = []
            for topic_item in topics_data:
                # Normalize sentiment
                sentiment = topic_item.get("sentiment", "Neutral")
                if isinstance(sentiment, str):
                    sentiment = sentiment.capitalize()
                    if sentiment not in ["Positive", "Neutral", "Negative"]:
                        sentiment = "Neutral"
                
                # Get mentions count
                mentions = topic_item.get("mentions", 0)
                try:
                    mentions = int(mentions)
                except (ValueError, TypeError):
                    mentions = 0
                
                topic = Topic(
                    name=topic_item.get("name", "") or topic_item.get("title", ""),
                    mentions=max(0, mentions),  # Ensure non-negative
                    sentiment=sentiment
                )
                normalized.append(topic.to_dict())
            
            # Sort by mentions (descending) to prioritize most discussed topics
            normalized.sort(key=lambda x: x["mentions"], reverse=True)
            
            return normalized
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse GROQ API JSON response: {e}")

    def _build_identification_prompt(self, transcript: str) -> str:
        """Build the prompt for topic identification."""
        # Truncate transcript if too long (keep last 12000 chars for context)
        max_length = 12000
        if len(transcript) > max_length:
            transcript = "..." + transcript[-max_length:]

        return f"""Analyze the following meeting transcript and identify the key topics that were actually discussed.

IMPORTANT INSTRUCTIONS:
- Read the entire transcript carefully to understand what was actually discussed
- Identify specific, meaningful topics (not generic ones like "discussion" or "meeting")
- Topics should be substantive - things that took up significant discussion time
- Be specific: "Q4 Product Launch Strategy" is better than "Product Discussion"
- Avoid topics that are just greetings, small talk, or brief mentions
- Count how many times each topic was meaningfully discussed (not just mentioned in passing)
- Assess the sentiment: was the discussion positive, neutral, or negative about this topic?

For each topic, identify:
1. **name**: A specific, descriptive topic name (2-6 words that clearly identify what was discussed)
2. **mentions**: The number of times this topic was meaningfully discussed (count substantial mentions, not passing references)
3. **sentiment**: The overall sentiment - "Positive" (favorable discussion), "Neutral" (factual/informational), or "Negative" (concerns/issues raised)

Return ONLY a JSON object with this exact structure:
{{
  "topics": [
    {{
      "name": "Specific topic name (e.g., 'Q4 Marketing Budget Allocation')",
      "mentions": 8,
      "sentiment": "Positive|Neutral|Negative"
    }}
  ]
}}

Focus on identifying 5-12 key topics that represent the main discussion points. Be specific and accurate.

Transcript:
{transcript}

JSON Response:"""

    def _identify_with_paragraphs(self, transcript: str) -> List[Dict[str, Any]]:
        """Fallback: Identify topics using simple paragraph splitting."""
        raw_blocks = transcript.split("\n\n")
        topics: List[Dict[str, Any]] = []
        
        for block in raw_blocks:
            block = block.strip()
            if not block or len(block) < 20:
                continue
            
            # Infer topic name from first sentence
            sentences = block.split(".")
            first_sentence = sentences[0].strip() if sentences else block[:100]
            
            # Take first 5-8 words as topic name
            words = first_sentence.split()
            if len(words) > 8:
                topic_name = " ".join(words[:8]) + "..."
            else:
                topic_name = first_sentence[:50]
            
            # Count approximate mentions (rough estimate based on length)
            mentions = max(1, len(block.split()) // 50)
            
            topics.append({
                "name": topic_name,
                "mentions": mentions,
                "sentiment": "Neutral"  # Default for fallback
            })
        
        # Limit to top 10 topics by mentions
        topics.sort(key=lambda x: x["mentions"], reverse=True)
        return topics[:10]
