"""
Summary Agent
-------------

Uses Groq Cloud API with Llama to generate comprehensive meeting summaries.
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
    """Produces paragraph and bullet-point summaries using Groq Cloud API with Llama."""

    # Groq API configuration
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL = "llama-3.3-70b-versatile"  # Fast and capable Llama model
    GROQ_API_KEY_ENV = "GROQ-API"

    def __init__(self):
        self.api_key = os.getenv(self.GROQ_API_KEY_ENV)
        self.use_api = bool(self.api_key)

    def run(
        self,
        transcript: str,
        *,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Generate paragraph and bullet-point summaries.

        All extra agent outputs are optional; when present they help
        structure the summary text.
        
        Args:
            transcript: The meeting transcript text
            topic_segments: List of identified topics
            decisions: List of decisions made
            action_items: List of action items
            sentiment: Overall sentiment analysis
            participants: List of participant analysis (with speaker info)
        """
        if not transcript:
            return SummaryResult(
                paragraph="No transcript content available.",
                bullets=["The meeting transcript was empty, so no summary could be generated."],
                confidence=0.0
            ).to_dict()

        # Try Groq API first if API key is available
        if self.use_api:
            try:
                return self._generate_with_groq(transcript, topic_segments, decisions, action_items, sentiment, participants)
            except Exception as e:
                print(f"Warning: Groq API summary generation failed: {e}. Falling back to extractive summary.")
                # Fall through to fallback method

        # Fallback to simple extractive summary
        return self._generate_extractive(transcript, topic_segments, decisions, action_items, sentiment, participants)

    def _generate_with_groq(
        self, 
        transcript: str,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Generate summary using Groq Cloud API with Llama."""
        prompt = self._build_summary_prompt(transcript, topic_segments, decisions, action_items, sentiment, participants)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.GROQ_MODEL,
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
            "max_tokens": 3000  # Increased for more comprehensive summaries
        }

        response = requests.post(
            self.GROQ_API_URL,
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
                raise ValueError("Groq API did not return a paragraph summary")
            
            return SummaryResult(
                paragraph=paragraph,
                bullets=bullets[:10] if len(bullets) > 10 else bullets,  # Limit to 10 bullets
                confidence=confidence
            ).to_dict()
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Groq API JSON response: {e}")

    def _build_summary_prompt(
        self, 
        transcript: str,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """Build the prompt for summary generation."""
        # Truncate transcript if too long (keep last 15000 chars for context)
        max_length = 15000
        if len(transcript) > max_length:
            transcript = "..." + transcript[-max_length:]

        # Build context from other agents
        context_parts = []
        
        # Add participant/speaker context
        if participants:
            speaker_info = []
            for p in participants[:10]:  # Limit to top 10 speakers
                name = p.get("name", "Unknown")
                speaking_time = p.get("speakingTime", 0)
                engagement = p.get("engagement", "Unknown")
                contributions = p.get("keyContributions", [])
                
                speaker_details = f"{name} (Speaking time: {speaking_time}%, Engagement: {engagement})"
                if contributions:
                    # Take first 2 contributions
                    contrib_text = "; ".join(contributions[:2])
                    speaker_details += f" - Key contributions: {contrib_text}"
                speaker_info.append(speaker_details)
            
            if speaker_info:
                context_parts.append("PARTICIPANTS:\n" + "\n".join(f"- {s}" for s in speaker_info))
        
        # Add topic context with more detail
        if topic_segments:
            topic_details = []
            for t in topic_segments[:8]:  # Limit to top 8 topics
                name = t.get("name") or t.get("title", "")
                mentions = t.get("mentions", 0)
                topic_sentiment = t.get("sentiment", "")
                
                if name:
                    topic_str = f"{name}"
                    if mentions:
                        topic_str += f" (mentioned {mentions} times)"
                    if topic_sentiment:
                        topic_str += f" [sentiment: {topic_sentiment}]"
                    topic_details.append(topic_str)
            
            if topic_details:
                context_parts.append("KEY TOPICS IDENTIFIED:\n" + "\n".join(f"- {t}" for t in topic_details))
        
        # Add decision context
        if decisions:
            decision_details = []
            for d in decisions[:5]:
                decision_text = d.get("decision") or d.get("text", "")
                if decision_text:
                    decision_details.append(decision_text[:150])
            if decision_details:
                context_parts.append(f"DECISIONS MADE ({len(decisions)} total):\n" + "\n".join(f"- {d}" for d in decision_details))
        
        # Add action items context
        if action_items:
            action_details = []
            for item in action_items[:5]:
                title = item.get("title") or item.get("description", "")
                assignee = item.get("assignee", "")
                if title:
                    action_str = title[:100]
                    if assignee:
                        action_str += f" (assigned to {assignee})"
                    action_details.append(action_str)
            if action_details:
                context_parts.append(f"ACTION ITEMS IDENTIFIED ({len(action_items)} total):\n" + "\n".join(f"- {a}" for a in action_details))
        else:
            context_parts.append("IMPORTANT: No action items were found in the transcript. Make sure to explicitly state this in your summary.")
        
        # Add sentiment context with validation instructions
        if sentiment:
            overall = sentiment.get("overall", "Neutral")
            confidence = sentiment.get("confidence", 0.0)
            breakdown = sentiment.get("breakdown", {})
            
            sentiment_text = f"SENTIMENT ANALYSIS:\n- Overall: {overall} (confidence: {confidence:.2f})"
            if breakdown:
                pos = breakdown.get("positive", 0)
                neu = breakdown.get("neutral", 0)
                neg = breakdown.get("negative", 0)
                sentiment_text += f"\n- Breakdown: Positive {pos:.1%}, Neutral {neu:.1%}, Negative {neg:.1%}"
            sentiment_text += "\n- IMPORTANT: Verify this sentiment matches the actual tone of the transcript. If the sentiment seems incorrect based on the content, mention the discrepancy."
            context_parts.append(sentiment_text)
        
        context_section = "\n\n".join(context_parts) if context_parts else ""

        return f"""Analyze the following meeting transcript and create a comprehensive, accurate summary.

CRITICAL INSTRUCTIONS:
1. **Speaker Attribution**: Use the participant information to properly identify WHO said or contributed WHAT. Always attribute key points to specific speakers when possible.

2. **Topic Extraction**: Identify SPECIFIC, CONCRETE topics discussed. Avoid generic topics like "project updates" or "team discussion". Instead, identify the actual subject matter (e.g., "Database migration to PostgreSQL", "Q3 budget allocation for marketing", "Customer feedback on mobile app UI").

3. **Sentiment Validation**: Review the provided sentiment analysis. If it doesn't match the actual tone of the conversation, note this discrepancy in your summary.

4. **Accuracy**: Only include information explicitly stated in the transcript. Do not infer or assume information not present.

5. **Specificity**: Be concrete and specific. Include names, numbers, dates, and specific details when mentioned.

CONTEXT FROM OTHER ANALYSIS AGENTS:
{context_section}

Generate:
1. **paragraph**: A comprehensive 2-4 paragraph summary that:
   - Opens with the meeting's main purpose and key participants (mention names)
   - Describes SPECIFIC topics discussed with details from the transcript
   - Attributes key contributions to specific speakers (e.g., "John proposed...", "Sarah raised concerns about...")
   - Summarizes important decisions made, noting who made them if clear
   - Lists action items with assignees (if any), OR explicitly states "No action items were identified"
   - Reflects the actual sentiment/tone of the discussion (validate against provided sentiment)
   - Concludes with next steps or outcomes
   
2. **bullets**: A list of 6-10 specific bullet points that:
   - Identify CONCRETE topics discussed (not generic categories)
   - Attribute key points to specific speakers when possible
   - Include key decisions with context
   - List action items with assignees, OR state "No action items identified"
   - Reflect important outcomes
   - Each bullet should be specific and informative, not vague
   
3. **confidence**: Your confidence in this summary's accuracy (0.0 to 1.0)
   - Lower confidence if: transcript is unclear, speakers not well identified, or sentiment seems mismatched
   - Higher confidence if: clear speaker attribution, specific topics, consistent sentiment

Return ONLY a JSON object with this exact structure:
{{
  "paragraph": "Comprehensive summary with speaker names and specific details...",
  "bullets": [
    "Specific topic 1 with details (Speaker: John mentioned...)",
    "Specific topic 2 with details",
    "Decision: [specific decision] - made by [speaker if known]",
    "Action item: [description] - assigned to [name]",
    "Sentiment note: [if sentiment analysis seems inaccurate, note it here]"
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
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Fallback: Generate extractive summary using simple heuristics."""
        sentences = [
            s.strip()
            for s in transcript.replace("?", ".").replace("!", ".").split(".")
            if len(s.strip().split()) > 4
        ]

        # Create paragraph summary
        paragraph_sections: List[str] = []
        
        # Add participant info if available
        if participants:
            speaker_names = [p.get("name", "Unknown") for p in participants[:5]]
            if speaker_names:
                paragraph_sections.append(f"This meeting included {len(participants)} participants: {', '.join(speaker_names)}.")

        if topic_segments:
            titles = [seg.get("title") for seg in topic_segments[:5] if seg.get("title")]
            if titles:
                paragraph_sections.append("Key topics included: " + "; ".join(titles) + ".")

        if decisions:
            paragraph_sections.append(f"{len(decisions)} notable decisions were recorded.")

        if action_items:
            action_list = []
            for item in action_items[:5]:
                title = item.get("title") or item.get("description", "")
                assignee = item.get("assignee")
                if assignee:
                    action_list.append(f"{title[:80]} (assigned to {assignee})")
                else:
                    action_list.append(title[:80])
            if action_list:
                paragraph_sections.append(f"Action items identified: {', '.join(action_list)}.")
        else:
            paragraph_sections.append("No action items were identified in this meeting.")

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
                title = seg.get("title") or seg.get("name")
                if title:
                    bullets.append(f"Topic discussed: {title}")
        if decisions:
            for decision in decisions[:3]:
                decision_text = decision.get("decision") or decision.get("text", "")
                if decision_text:
                    bullets.append(f"Decision: {decision_text[:150]}")
        if action_items:
            for item in action_items[:5]:
                title = item.get("title") or item.get("description", "")
                assignee = item.get("assignee")
                if title:
                    if assignee:
                        bullets.append(f"Action item: {title[:100]} - assigned to {assignee}")
                    else:
                        bullets.append(f"Action item: {title[:100]}")
        else:
            bullets.append("No action items were identified in this meeting")
        
        if sentences and len(bullets) < 5:
            bullets.append(f"Key discussion: {sentences[0][:150]}" if len(sentences) > 0 else "")

        # Ensure at least one bullet
        if not bullets:
            bullets = ["Meeting transcript analyzed"]

        return SummaryResult(
            paragraph=paragraph,
            bullets=bullets[:7],  # Limit to 7 bullets
            confidence=0.5  # Lower confidence for fallback method
        ).to_dict()


