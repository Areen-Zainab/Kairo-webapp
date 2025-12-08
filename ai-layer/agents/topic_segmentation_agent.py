"""
Topic Segmentation Agent
-------------------------

Uses Grok Cloud API (xAI) to identify key topics in meeting transcripts.
Falls back to simple paragraph splitting if API is unavailable.
"""

from __future__ import annotations

import os
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
    """Identifies key topics in a transcript using Grok Cloud API."""

    # Grok API configuration
    GROK_API_URL = "https://api.x.ai/v1/chat/completions"
    GROK_MODEL = "grok-4.1-fast"  # Most cost-effective model
    GROK_API_KEY_ENV = "GROK_API_KEY"

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
        self.api_key = os.getenv(self.GROK_API_KEY_ENV)
        self.use_api = bool(self.api_key)

    def run(self, transcript: str) -> List[Dict[str, Any]]:
        """Identify topics using Grok API or fallback method."""
        if not transcript:
            return []

        # Try Grok API first if API key is available
        if self.use_api:
            try:
                return self._identify_with_grok(transcript)
            except Exception as e:
                print(f"Warning: Grok API topic identification failed: {e}. Falling back to paragraph splitting.")
                # Fall through to fallback method

        # Fallback to simple paragraph splitting
        return self._identify_with_paragraphs(transcript)

    def _identify_with_grok(self, transcript: str) -> List[Dict[str, Any]]:
        """Identify topics using Grok Cloud API."""
        prompt = self._build_identification_prompt(transcript)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.GROK_MODEL,
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
            raise ValueError(f"Failed to parse Grok API JSON response: {e}")

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
