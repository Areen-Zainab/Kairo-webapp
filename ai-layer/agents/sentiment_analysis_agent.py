"""
Sentiment Analysis Agent
------------------------

Uses Grok Cloud API (xAI) to analyze sentiment in meeting transcripts.
Falls back to simple word matching if API is unavailable.
"""

from __future__ import annotations

import os
import json
import requests
from dataclasses import dataclass, asdict
from typing import Dict, Any


@dataclass
class SentimentSummary:
    overall: str  # "Positive", "Neutral", or "Negative"
    confidence: float
    breakdown: Dict[str, float]  # {"positive": 0.65, "neutral": 0.25, "negative": 0.10}

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SentimentAnalysisAgent:
    """Evaluates emotional tone using Grok Cloud API."""

    # Grok API configuration
    GROK_API_URL = "https://api.x.ai/v1/chat/completions"
    GROK_MODEL = "grok-4.1-fast"  # Most cost-effective model
    GROK_API_KEY_ENV = "GROK_API_KEY"

    # Fallback word lists
    POSITIVE_WORDS = {
        "great",
        "good",
        "awesome",
        "excited",
        "happy",
        "love",
        "excellent",
        "nice",
        "cool",
        "amazing",
    }
    NEGATIVE_WORDS = {
        "bad",
        "concern",
        "worried",
        "problem",
        "issue",
        "sad",
        "angry",
        "frustrated",
        "annoyed",
        "hate",
        "blocked",
    }

    def __init__(self):
        self.api_key = os.getenv(self.GROK_API_KEY_ENV)
        self.use_api = bool(self.api_key)

    def run(self, transcript: str) -> Dict[str, Any]:
        """Analyze sentiment using Grok API or fallback method."""
        if not transcript:
            return SentimentSummary(
                overall="Neutral",
                confidence=0.0,
                breakdown={"positive": 0.0, "neutral": 1.0, "negative": 0.0}
            ).to_dict()

        # Try Grok API first if API key is available
        if self.use_api:
            try:
                return self._analyze_with_grok(transcript)
            except Exception as e:
                print(f"Warning: Grok API sentiment analysis failed: {e}. Falling back to word matching.")
                # Fall through to fallback method

        # Fallback to simple word matching
        return self._analyze_with_words(transcript)

    def _analyze_with_grok(self, transcript: str) -> Dict[str, Any]:
        """Analyze sentiment using Grok Cloud API."""
        prompt = self._build_analysis_prompt(transcript)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.GROK_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert at analyzing sentiment in meeting transcripts. Always respond with valid JSON only, no additional text."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,  # Lower temperature for more consistent analysis
            "max_tokens": 1000
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
            
            # Extract sentiment data
            overall = parsed.get("overall", "Neutral")
            confidence = float(parsed.get("confidence", 0.8))
            breakdown = parsed.get("breakdown", {})
            
            # Normalize overall sentiment
            if isinstance(overall, str):
                overall = overall.capitalize()
                if overall not in ["Positive", "Neutral", "Negative"]:
                    overall = "Neutral"
            
            # Ensure breakdown has all three categories
            if not isinstance(breakdown, dict):
                breakdown = {}
            
            # Normalize breakdown values
            positive = float(breakdown.get("positive", 0.0))
            neutral = float(breakdown.get("neutral", 0.0))
            negative = float(breakdown.get("negative", 0.0))
            
            # Normalize to sum to 1.0
            total = positive + neutral + negative
            if total > 0:
                positive = positive / total
                neutral = neutral / total
                negative = negative / total
            else:
                # Default to neutral if all zero
                neutral = 1.0
            
            breakdown_normalized = {
                "positive": round(positive, 3),
                "neutral": round(neutral, 3),
                "negative": round(negative, 3)
            }
            
            return SentimentSummary(
                overall=overall,
                confidence=confidence,
                breakdown=breakdown_normalized
            ).to_dict()
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Grok API JSON response: {e}")

    def _build_analysis_prompt(self, transcript: str) -> str:
        """Build the prompt for sentiment analysis."""
        # Truncate transcript if too long (keep last 10000 chars for context)
        max_length = 10000
        if len(transcript) > max_length:
            transcript = "..." + transcript[-max_length:]

        return f"""Analyze the sentiment of the following meeting transcript.

Determine:
1. **overall**: The overall sentiment - "Positive", "Neutral", or "Negative"
2. **confidence**: Your confidence in this analysis (0.0 to 1.0)
3. **breakdown**: The percentage breakdown of sentiment:
   - positive: Proportion of positive sentiment (0.0 to 1.0)
   - neutral: Proportion of neutral sentiment (0.0 to 1.0)
   - negative: Proportion of negative sentiment (0.0 to 1.0)
   
   The three values should sum to approximately 1.0.

Return ONLY a JSON object with this exact structure:
{{
  "overall": "Positive|Neutral|Negative",
  "confidence": 0.87,
  "breakdown": {{
    "positive": 0.65,
    "neutral": 0.25,
    "negative": 0.10
  }}
}}

Transcript:
{transcript}

JSON Response:"""

    def _analyze_with_words(self, transcript: str) -> Dict[str, Any]:
        """Fallback: Analyze sentiment using simple word matching."""
        words = [w.strip(".,!?").lower() for w in transcript.split()]
        total = max(len(words), 1)
        pos = sum(1 for w in words if w in self.POSITIVE_WORDS)
        neg = sum(1 for w in words if w in self.NEGATIVE_WORDS)
        pos_score = pos / total
        neg_score = neg / total
        neu_score = max(0.0, 1.0 - pos_score - neg_score)

        if pos_score > neg_score * 1.5 and pos_score > 0.01:
            overall = "Positive"
        elif neg_score > pos_score * 1.5 and neg_score > 0.01:
            overall = "Negative"
        else:
            overall = "Neutral"

        breakdown = {
            "positive": round(pos_score, 3),
            "neutral": round(neu_score, 3),
            "negative": round(neg_score, 3)
        }

        return SentimentSummary(
            overall=overall,
            confidence=0.5,  # Lower confidence for fallback method
            breakdown=breakdown
        ).to_dict()


