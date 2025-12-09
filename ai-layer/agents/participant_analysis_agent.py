"""
Participant Analysis Agent
---------------------------

Uses GROQ Cloud API (xAI) to analyze participant contributions in meeting transcripts.
Analyzes speaking time, engagement, key contributions, and sentiment per participant.
Falls back to simple statistical analysis if API is unavailable.
"""

from __future__ import annotations

import os
import json
import requests
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from collections import defaultdict


@dataclass
class ParticipantAnalysis:
    name: str
    speakingTime: float  # Percentage (0-1)
    speakingTimeSeconds: float
    engagement: str  # "High", "Medium", or "Low"
    keyContributions: List[str]
    sentiment: str  # "Positive", "Neutral", or "Negative"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ParticipantAnalysisAgent:
    """Analyzes participant contributions using GROQ Cloud API."""

    # GROQ API configuration
    GROQ_API_URL = "https://api.x.ai/v1/chat/completions"
    GROQ_MODEL = "llama-3.3-70b-versatile"  # Most cost-effective model
    GROQ_API_KEY_ENV = "GROQ_API_KEY"

    def __init__(self):
        self.api_key = os.getenv(self.GROQ_API_KEY_ENV)
        self.use_api = bool(self.api_key)

    def run(self, transcript_json: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Analyze participants from speaker-diarized transcript.
        
        Args:
            transcript_json: Dictionary with 'utterances' list containing:
                - speaker: Speaker identifier
                - text: Spoken text
                - start_time: Start time in seconds
                - end_time: End time in seconds
        
        Returns:
            List of participant analysis dictionaries
        """
        if not transcript_json or not isinstance(transcript_json, dict):
            return []
        
        utterances = transcript_json.get("utterances", [])
        if not utterances:
            return []

        # Try GROQ API first if API key is available
        if self.use_api:
            try:
                return self._analyze_with_GROQ(transcript_json)
            except Exception as e:
                print(f"Warning: GROQ API participant analysis failed: {e}. Falling back to statistical analysis.")
                # Fall through to fallback method

        # Fallback to statistical analysis
        return self._analyze_with_statistics(utterances)

    def _analyze_with_GROQ(self, transcript_json: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze participants using GROQ Cloud API."""
        # Convert transcript JSON to text format for GROQ
        transcript_text = self._json_to_text(transcript_json)
        
        prompt = self._build_analysis_prompt(transcript_text, transcript_json)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.GROQ_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert at analyzing meeting transcripts and evaluating participant contributions. Always respond with valid JSON only, no additional text."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.4,  # Slightly higher for more nuanced analysis
            "max_tokens": 3000
        }

        response = requests.post(
            self.GROQ_API_URL,
            headers=headers,
            json=payload,
            timeout=90  # Longer timeout for participant analysis
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
            participants_data = parsed.get("participants", [])
            
            # Calculate actual speaking times from transcript data
            utterances = transcript_json.get("utterances", [])
            speaker_stats = self._calculate_speaking_times(utterances)
            
            # Normalize the format and merge with calculated stats
            normalized = []
            for participant_item in participants_data:
                speaker_name = participant_item.get("name", "")
                
                # Get calculated speaking time stats
                stats = speaker_stats.get(speaker_name, {})
                speaking_time_seconds = stats.get("total_seconds", 0.0)
                total_meeting_seconds = stats.get("total_meeting_seconds", 1.0)
                speaking_time_percentage = speaking_time_seconds / total_meeting_seconds if total_meeting_seconds > 0 else 0.0
                
                # Normalize engagement
                engagement = participant_item.get("engagement", "Medium")
                if isinstance(engagement, str):
                    engagement = engagement.capitalize()
                    if engagement not in ["High", "Medium", "Low"]:
                        engagement = "Medium"
                
                # Normalize sentiment
                sentiment = participant_item.get("sentiment", "Neutral")
                if isinstance(sentiment, str):
                    sentiment = sentiment.capitalize()
                    if sentiment not in ["Positive", "Neutral", "Negative"]:
                        sentiment = "Neutral"
                
                # Get key contributions
                contributions = participant_item.get("keyContributions", [])
                if not isinstance(contributions, list):
                    contributions = [contributions] if contributions else []
                
                # Limit to top 5 contributions
                contributions = contributions[:5]
                
                participant = ParticipantAnalysis(
                    name=speaker_name,
                    speakingTime=round(speaking_time_percentage, 3),
                    speakingTimeSeconds=round(speaking_time_seconds, 1),
                    engagement=engagement,
                    keyContributions=contributions,
                    sentiment=sentiment
                )
                normalized.append(participant.to_dict())
            
            # Sort by speaking time (descending)
            normalized.sort(key=lambda x: x["speakingTime"], reverse=True)
            
            return normalized
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse GROQ API JSON response: {e}")

    def _json_to_text(self, transcript_json: Dict[str, Any]) -> str:
        """Convert diarized JSON to readable text format."""
        utterances = transcript_json.get("utterances", [])
        lines = []
        
        for utterance in utterances:
            speaker = utterance.get("speaker", "UNKNOWN")
            text = utterance.get("text", "")
            start_time = utterance.get("start_time", 0.0)
            end_time = utterance.get("end_time", 0.0)
            
            time_range = f"[{start_time:.1f}s - {end_time:.1f}s]"
            lines.append(f"[{speaker}] {time_range}: {text}")
        
        return "\n".join(lines)

    def _calculate_speaking_times(self, utterances: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
        """Calculate speaking time statistics for each speaker."""
        speaker_stats = defaultdict(lambda: {"total_seconds": 0.0, "utterance_count": 0})
        total_meeting_seconds = 0.0
        
        for utterance in utterances:
            speaker = utterance.get("speaker", "UNKNOWN")
            start_time = float(utterance.get("start_time", 0.0))
            end_time = float(utterance.get("end_time", 0.0))
            
            duration = max(0.0, end_time - start_time)
            speaker_stats[speaker]["total_seconds"] += duration
            speaker_stats[speaker]["utterance_count"] += 1
            
            total_meeting_seconds = max(total_meeting_seconds, end_time)
        
        # Add total meeting seconds to each speaker's stats
        for speaker in speaker_stats:
            speaker_stats[speaker]["total_meeting_seconds"] = total_meeting_seconds
        
        return dict(speaker_stats)

    def _build_analysis_prompt(self, transcript_text: str, transcript_json: Dict[str, Any]) -> str:
        """Build the prompt for participant analysis."""
        # Truncate transcript if too long (keep last 15000 chars for context)
        max_length = 15000
        if len(transcript_text) > max_length:
            transcript_text = "..." + transcript_text[-max_length:]

        # Get unique speakers
        utterances = transcript_json.get("utterances", [])
        speakers = list(set(u.get("speaker", "UNKNOWN") for u in utterances))
        
        return f"""Analyze the following meeting transcript and evaluate each participant's contribution.

For each participant (speaker), identify:
1. **name**: The speaker identifier/name
2. **engagement**: Level of engagement - "High" (very active, asks questions, contributes ideas), "Medium" (moderate participation), or "Low" (minimal participation)
3. **keyContributions**: List of 2-5 key contributions, ideas, or points this participant made during the meeting
4. **sentiment**: The overall sentiment of this participant's contributions - "Positive", "Neutral", or "Negative"

Note: Speaking time percentages and seconds will be calculated automatically from the transcript data.

Return ONLY a JSON object with this exact structure:
{{
  "participants": [
    {{
      "name": "Speaker_0",
      "engagement": "High|Medium|Low",
      "keyContributions": [
        "Contribution 1",
        "Contribution 2"
      ],
      "sentiment": "Positive|Neutral|Negative"
    }}
  ]
}}

Focus on analyzing the quality and nature of contributions, not just quantity. Identify unique insights, decisions, or ideas each participant brought to the meeting.

Transcript:
{transcript_text}

JSON Response:"""

    def _analyze_with_statistics(self, utterances: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Fallback: Analyze participants using simple statistics."""
        # Calculate speaking times
        speaker_stats = self._calculate_speaking_times(utterances)
        
        # Group utterances by speaker
        speaker_utterances = defaultdict(list)
        for utterance in utterances:
            speaker = utterance.get("speaker", "UNKNOWN")
            speaker_utterances[speaker].append(utterance)
        
        # Analyze each speaker
        participants = []
        for speaker, stats in speaker_stats.items():
            total_seconds = stats["total_seconds"]
            total_meeting_seconds = stats["total_meeting_seconds"]
            speaking_time_percentage = total_seconds / total_meeting_seconds if total_meeting_seconds > 0 else 0.0
            
            # Determine engagement based on speaking time and utterance count
            utterance_count = stats["utterance_count"]
            avg_utterance_length = total_seconds / utterance_count if utterance_count > 0 else 0
            
            if speaking_time_percentage > 0.3 and utterance_count > 10:
                engagement = "High"
            elif speaking_time_percentage > 0.15 or utterance_count > 5:
                engagement = "Medium"
            else:
                engagement = "Low"
            
            # Extract key contributions (first few utterances)
            contributions = []
            for utterance in speaker_utterances[speaker][:5]:
                text = utterance.get("text", "").strip()
                if text and len(text) > 10:
                    contributions.append(text[:100] + ("..." if len(text) > 100 else ""))
            
            if not contributions:
                contributions = ["Participated in meeting discussion"]
            
            participants.append({
                "name": speaker,
                "speakingTime": round(speaking_time_percentage, 3),
                "speakingTimeSeconds": round(total_seconds, 1),
                "engagement": engagement,
                "keyContributions": contributions[:5],
                "sentiment": "Neutral"  # Default for fallback
            })
        
        # Sort by speaking time (descending)
        participants.sort(key=lambda x: x["speakingTime"], reverse=True)
        
        return participants
