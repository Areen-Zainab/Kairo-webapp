"""
Summary Agent
-------------

Uses Grok Cloud API (xAI) to generate comprehensive meeting summaries.
Falls back to simple extractive summary if API is unavailable.
"""

from __future__ import annotations

import os
import json
import requests
from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Optional


@dataclass
class SummaryResult:
    paragraph: str
    bullets: List[str]
    confidence: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SummaryAgent:
    """Produces paragraph and bullet-point summaries using Grok Cloud API."""

    # Grok API configuration
    GROK_API_URL = "https://api.x.ai/v1/chat/completions"
    GROK_MODEL = "grok-4.1-fast"  # Most cost-effective model
    GROK_API_KEY_ENV = "GROK_API_KEY"

    def __init__(self):
        self.api_key = os.getenv(self.GROK_API_KEY_ENV)
        self.use_api = bool(self.api_key)

    def run(
        self,
        transcript: str,
        *,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate paragraph and bullet-point summaries.

        All extra agent outputs are optional; when present they help
        structure the summary text.
        """
        if not transcript:
            return SummaryResult(
                paragraph="No transcript content available.",
                bullets=["The meeting transcript was empty, so no summary could be generated."],
                confidence=0.0
            ).to_dict()

        # Try Grok API first if API key is available
        if self.use_api:
            try:
                return self._generate_with_grok(transcript)
            except Exception as e:
                print(f"Warning: Grok API summary generation failed: {e}. Falling back to extractive summary.")
                # Fall through to fallback method

        # Fallback to simple extractive summary
        return self._generate_extractive(transcript, topic_segments, decisions, action_items, sentiment)

    def _generate_with_grok(self, transcript: str) -> Dict[str, Any]:
        """Generate summary using Grok Cloud API."""
        prompt = self._build_summary_prompt(transcript)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.GROK_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert at analyzing meeting transcripts and creating comprehensive summaries. Always respond with valid JSON only, no additional text."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.4,  # Slightly higher for more natural summaries
            "max_tokens": 2000
        }

        response = requests.post(
            self.GROK_API_URL,
            headers=headers,
            json=payload,
            timeout=60  # Longer timeout for summary generation
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
            
            # Extract summary data
            paragraph = parsed.get("paragraph", "")
            bullets = parsed.get("bullets", [])
            confidence = float(parsed.get("confidence", 0.85))
            
            # Ensure bullets is a list
            if not isinstance(bullets, list):
                bullets = [bullets] if bullets else []
            
            # Validate paragraph exists
            if not paragraph:
                raise ValueError("Grok API did not return a paragraph summary")
            
            return SummaryResult(
                paragraph=paragraph,
                bullets=bullets[:10] if len(bullets) > 10 else bullets,  # Limit to 10 bullets
                confidence=confidence
            ).to_dict()
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Grok API JSON response: {e}")

    def _build_summary_prompt(self, transcript: str) -> str:
        """Build the prompt for summary generation."""
        # Truncate transcript if too long (keep last 12000 chars for context)
        max_length = 12000
        if len(transcript) > max_length:
            transcript = "..." + transcript[-max_length:]

        return f"""Analyze the following meeting transcript and create a comprehensive summary.

Generate:
1. **paragraph**: A 2-3 paragraph comprehensive summary covering the main topics, decisions, and outcomes of the meeting. Make it informative and well-structured.
2. **bullets**: A list of 5-7 key bullet points highlighting the most important points, decisions, or action items from the meeting.
3. **confidence**: Your confidence in this summary (0.0 to 1.0)

Return ONLY a JSON object with this exact structure:
{{
  "paragraph": "First paragraph covering main topics... Second paragraph covering decisions and outcomes... Third paragraph if needed...",
  "bullets": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ],
  "confidence": 0.85
}}

Transcript:
{transcript}

JSON Response:"""

    def _generate_extractive(
        self,
        transcript: str,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Fallback: Generate extractive summary using simple heuristics."""
        sentences = [
            s.strip()
            for s in transcript.replace("?", ".").replace("!", ".").split(".")
            if len(s.strip().split()) > 4
        ]

        # Create paragraph summary
        paragraph_sections: List[str] = []
        paragraph_sections.append(f"This meeting covered approximately {len(sentences)} substantial discussion points.")

        if topic_segments:
            titles = [seg.get("title") for seg in topic_segments[:5] if seg.get("title")]
            if titles:
                paragraph_sections.append("Key topics included: " + "; ".join(titles) + ".")

        if decisions:
            paragraph_sections.append(f"{len(decisions)} notable decisions were recorded.")

        if action_items:
            paragraph_sections.append(f"{len(action_items)} follow-up action items were identified.")

        if sentiment:
            overall = sentiment.get("overall", "neutral")
            paragraph_sections.append(f"The overall sentiment of the discussion was {overall}.")

        # Add discussion highlights
        tail = " ".join(sentences[:5]) if sentences else transcript[:600]
        paragraph_sections.append("Discussion highlights: " + tail)

        paragraph = " ".join(paragraph_sections)

        # Create bullet points
        bullets: List[str] = []
        if topic_segments:
            for seg in topic_segments[:5]:
                title = seg.get("title")
                if title:
                    bullets.append(f"Topic: {title}")
        if decisions:
            bullets.append(f"{len(decisions)} key decisions made")
        if action_items:
            bullets.append(f"{len(action_items)} action items identified")
        if sentences:
            bullets.append(sentences[0] if len(sentences) > 0 else "")
            if len(sentences) > 1:
                bullets.append(sentences[1])

        # Ensure at least one bullet
        if not bullets:
            bullets = ["Meeting transcript analyzed"]

        return SummaryResult(
            paragraph=paragraph,
            bullets=bullets[:7],  # Limit to 7 bullets
            confidence=0.5  # Lower confidence for fallback method
        ).to_dict()


