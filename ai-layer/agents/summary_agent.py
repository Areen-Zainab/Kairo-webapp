"""
Summary Agent
-------------

Uses Groq Cloud API with Llama to generate comprehensive meeting summaries.
Falls back to simple extractive summary if API is unavailable.
"""

from __future__ import annotations

import os
import re
import json
import requests
from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Optional
from datetime import datetime


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
    GROQ_API_KEY_ENV = "GROQ_API_KEY"  # Fixed: was "GROQ-API"
    
    # Chunking configuration for long transcripts
    CHUNK_THRESHOLD_WORDS = 2000
    CHUNK_SIZE_WORDS = 1000
    CHUNK_OVERLAP_WORDS = 200

    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.use_api = bool(self.api_key)
        
        # Debug: Print API key status
        if self.use_api:
            print(f" Groq API key found (length: {len(self.api_key)})")
        else:
            print(f" Groq API key not found. Set {"GROQ_API_KEY"} environment variable.")
            print("  Falling back to extractive summary mode.")
    
    def _preprocess_text(self, text: str) -> str:
        """Remove timestamps, speaker labels, and normalize whitespace from transcript."""
        # Remove timestamps in various formats:
        # [HH:MM:SS.mmm - HH:MM:SS.mmm]
        text = re.sub(r'\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-\s*\d{2}:\d{2}:\d{2}\.\d{3}\]', '', text)
        # 0s): or 123s): pattern (timestamp markers)
        text = re.sub(r'\d+s\):\s*', '', text)
        # Remove standalone timestamps like [00:01:23]
        text = re.sub(r'\[\d{2}:\d{2}:\d{2}\]', '', text)
        # Remove time markers like (1:23:45)
        text = re.sub(r'\(\d{1,2}:\d{2}:\d{2}\)', '', text)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    def _clean_text(self, text: str) -> str:
        """Clean any remaining timestamp artifacts from text."""
        if not text:
            return text
        
        # Remove timestamp patterns that might have slipped through
        text = re.sub(r'\d+s\):\s*', '', text)
        text = re.sub(r'\[\d{2}:\d{2}:\d{2}[.\d]*\s*-?\s*\d{0,2}:?\d{0,2}:?\d{0,2}[.\d]*\]', '', text)
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    def _chunk_text(self, text: str, max_words: int = None, overlap: int = None) -> List[str]:
        """Split text into chunks with overlap for better context preservation."""
        max_words = max_words or self.CHUNK_SIZE_WORDS
        overlap = overlap or self.CHUNK_OVERLAP_WORDS
        
        words = text.split()
        chunks = []
        
        if len(words) <= max_words:
            return [text]
        
        start = 0
        while start < len(words):
            end = start + max_words
            chunk = ' '.join(words[start:end])
            
            # Try to end at sentence boundary if not at the end
            if end < len(words) and not chunk.endswith(('.', '?', '!')):
                last_sentence_end = max(
                    chunk.rfind('.'),
                    chunk.rfind('?'),
                    chunk.rfind('!')
                )
                # Only break at sentence if it's in the last 30% of chunk
                if last_sentence_end > len(chunk) * 0.7:
                    chunk = chunk[:last_sentence_end + 1]
            
            chunks.append(chunk)
            start = end - overlap if end < len(words) else len(words)
        
        return chunks
    
    def _summarize_chunk(self, chunk: str, chunk_num: int, total_chunks: int) -> str:
        """Summarize a single chunk of text."""
        prompt = (
            f"This is chunk {chunk_num} of {total_chunks} from a meeting transcript. "
            "Summarize the key points, decisions, and action items in this section. "
            "Be SPECIFIC - include participant names, numbers, dates, and concrete details. "
            "Write in your own words - do NOT copy sentences directly from the transcript. "
            "Avoid generic statements. Focus on what was actually discussed and decided. "
            "Be concise but comprehensive.\n\n"
            f"Chunk content:\n{chunk}"
        )
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.GROQ_MODEL,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 800
        }
        
        try:
            response = requests.post(
                self.GROQ_API_URL,
                headers=headers,
                json=payload,
                timeout=45
            )
            response.raise_for_status()
            result = response.json()
            return result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        except Exception as e:
            print(f"Warning: Failed to summarize chunk {chunk_num}: {e}")
            return ""
    
    def _combine_chunk_summaries(
        self,
        chunk_summaries: List[str],
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Combine chunk summaries into final comprehensive summary."""
        combined_text = "\n\n".join([
            f"Section {i+1} Summary:\n{summary}"
            for i, summary in enumerate(chunk_summaries)
            if summary
        ])
        
        # Build context from other agents
        context_parts = []
        
        if participants:
            speaker_names = [p.get("name", "Unknown") for p in participants[:5]]
            speaker_names = [n for n in speaker_names if n != "Unknown"]
            if speaker_names:
                context_parts.append(f"Key participants: {', '.join(speaker_names)}")
        
        if topic_segments:
            topics = [t.get("name") or t.get("title", "") for t in topic_segments[:5]]
            topics = [t for t in topics if t and t != "[UNKNOWN]" and "unknown" not in t.lower()]
            if topics:
                context_parts.append(f"Main topics: {', '.join(topics)}")
        
        if decisions:
            context_parts.append(f"{len(decisions)} decisions were made")
        
        if action_items:
            context_parts.append(f"{len(action_items)} action items were identified")
        
        if sentiment:
            overall = sentiment.get("overall", "Neutral")
            context_parts.append(f"Overall sentiment: {overall}")
        
        context_section = ". ".join(context_parts) if context_parts else ""
        
        prompt = f"""Synthesize the following section summaries from a meeting transcript into a comprehensive final summary.

Context: {context_section}

Section Summaries:
{combined_text}

Create a final summary with:
1. **paragraph**: A comprehensive 3-5 paragraph summary covering ALL key points from the meeting. Write in your own words - do NOT copy sentences from the summaries. Be SPECIFIC - include participant names, concrete decisions, specific numbers/dates, and important details. Avoid vague statements.
2. **bullets**: 10-15 specific, actionable bullet points covering key topics, decisions, action items, and outcomes. Write these in your own words with concrete information.
3. **confidence**: Your confidence in this summary (0.0 to 1.0)

Return ONLY a JSON object with this structure:
{{
  "paragraph": "Comprehensive meeting summary with specific details...",
  "bullets": ["Specific point 1 with details", "Specific point 2 with details", ...],
  "confidence": 0.85
}}

JSON Response:"""
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.GROQ_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert at synthesizing meeting summaries. Always respond with valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.4,
            "max_tokens": 2000
        }
        
        response = requests.post(
            self.GROQ_API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        result = response.json()
        
        # Extract and parse content
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        content = content.strip()
        
        # Clean markdown code blocks
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # Remove any ** markdown formatting
        content = content.replace("**", "")
        
        parsed = json.loads(content)
        
        # Clean the results
        paragraph = self._clean_text(parsed.get("paragraph", ""))
        bullets = [self._clean_text(b) for b in parsed.get("bullets", [])]
        bullets = [b for b in bullets if b]  # Remove empty bullets
        
        return SummaryResult(
            paragraph=paragraph,
            bullets=bullets[:10],
            confidence=float(parsed.get("confidence", 0.8))
        ).to_dict()

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
        if not transcript or not transcript.strip():
            return SummaryResult(
                paragraph="No transcript content available.",
                bullets=["The meeting transcript was empty, so no summary could be generated."],
                confidence=0.0
            ).to_dict()

        # Debug: Log what data is available
        print("\n=== Summary Agent Input ===")
        print(f"Transcript length: {len(transcript)} characters")
        print(f"Topic segments: {len(topic_segments) if topic_segments else 0}")
        print(f"Decisions: {len(decisions) if decisions else 0}")
        print(f"Action items: {len(action_items) if action_items else 0}")
        print(f"Participants: {len(participants) if participants else 0}")
        
        # Try Groq API first if API key is available
        if self.use_api:
            try:
                print("\n[INFO] Attempting Groq API summary generation...")
                result = self._generate_with_groq(transcript, topic_segments, decisions, action_items, sentiment, participants)
                print("[OK] Groq API summary generated successfully")
                return result
            except Exception as e:
                print(f"\n[ERROR] Groq API summary generation failed: {type(e).__name__}: {str(e)}")
                print("  Falling back to extractive summary...")
                # Fall through to fallback method
        else:
            print("\n[INFO] No API key available, using extractive summary...")

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
        # Preprocess transcript to remove timestamps and normalize whitespace
        clean_transcript = self._preprocess_text(transcript)
        word_count = len(clean_transcript.split())
        
        # Use chunking for long transcripts
        if word_count > self.CHUNK_THRESHOLD_WORDS:
            print(f"Transcript has {word_count} words. Using chunking strategy...")
            chunks = self._chunk_text(clean_transcript)
            print(f"Created {len(chunks)} chunks for processing")
            
            # Summarize each chunk
            chunk_summaries = []
            for i, chunk in enumerate(chunks, 1):
                print(f"Summarizing chunk {i}/{len(chunks)}...")
                summary = self._summarize_chunk(chunk, i, len(chunks))
                if summary:
                    chunk_summaries.append(summary)
                else:
                    print(f"Warning: Chunk {i} failed to summarize")
            
            if not chunk_summaries:
                raise ValueError("All chunk summaries failed")
            
            # Combine chunk summaries into final summary
            print("Combining chunk summaries into final summary...")
            return self._combine_chunk_summaries(
                chunk_summaries,
                topic_segments,
                decisions,
                action_items,
                sentiment,
                participants
            )
        
        # For shorter transcripts, use single-pass summarization
        print(f"Transcript has {word_count} words. Using single-pass summarization...")
        prompt = self._build_summary_prompt(clean_transcript, topic_segments, decisions, action_items, sentiment, participants)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.GROQ_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert at analyzing meeting transcripts and creating comprehensive summaries. Always respond with valid JSON only, no additional text. Write summaries in your own words - never copy sentences directly from the transcript."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.4,
            "max_tokens": 3000
        }

        response = requests.post(
            self.GROQ_API_URL,
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
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # Parse JSON response
        try:
            parsed = json.loads(content)
            
            # Extract and clean summary data
            paragraph = self._clean_text(parsed.get("paragraph", ""))
            bullets = [self._clean_text(b) for b in parsed.get("bullets", [])]
            bullets = [b for b in bullets if b]  # Remove empty bullets
            confidence = float(parsed.get("confidence", 0.85))
            
            # Validate paragraph exists
            if not paragraph:
                raise ValueError("Groq API did not return a paragraph summary")
            
            # Remove any ** markdown formatting
            paragraph = paragraph.replace("**", "")
            bullets = [b.replace("**", "") for b in bullets]
            
            return SummaryResult(
                paragraph=paragraph,
                bullets=bullets[:10],
                confidence=confidence
            ).to_dict()
        except json.JSONDecodeError as e:
            print(f"API Response content: {content[:500]}...")
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
        # Truncate transcript if too long
        max_length = 15000
        if len(transcript) > max_length:
            transcript = "..." + transcript[-max_length:]

        # Build context from other agents - clean all text and filter out unknowns
        context_parts = []
        
        # Add participant/speaker context
        if participants:
            speaker_info = []
            for p in participants[:10]:
                name = self._clean_text(p.get("name", "Unknown"))
                if name == "Unknown" or not name:
                    continue
                    
                speaking_time = p.get("speakingTime", 0)
                engagement = p.get("engagement", "Unknown")
                contributions = [self._clean_text(c) for c in p.get("keyContributions", [])]
                
                speaker_details = f"{name} (Speaking time: {speaking_time}%, Engagement: {engagement})"
                if contributions:
                    contrib_text = "; ".join(contributions[:2])
                    speaker_details += f" - Key contributions: {contrib_text}"
                speaker_info.append(speaker_details)
            
            if speaker_info:
                context_parts.append("PARTICIPANTS:\n" + "\n".join(f"- {s}" for s in speaker_info))
        
        # Add topic context - FILTER OUT UNKNOWN TOPICS
        if topic_segments:
            topic_details = []
            for t in topic_segments[:8]:
                name = self._clean_text(t.get("name") or t.get("title", ""))
                
                # Skip unknown or empty topics
                if not name or name == "[UNKNOWN]" or "unknown" in name.lower():
                    continue
                    
                mentions = t.get("mentions", 0)
                topic_sentiment = t.get("sentiment", "")
                
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
                decision_text = self._clean_text(d.get("decision") or d.get("text", ""))
                if decision_text and decision_text != "[UNKNOWN]":
                    decision_details.append(decision_text[:150])
            if decision_details:
                context_parts.append(f"DECISIONS MADE ({len(decisions)} total):\n" + "\n".join(f"- {d}" for d in decision_details))
        
        # Add action items context
        if action_items:
            action_details = []
            for item in action_items[:5]:
                title = self._clean_text(item.get("title") or item.get("description", ""))
                assignee = self._clean_text(item.get("assignee", ""))
                if title:
                    action_str = title[:100]
                    if assignee and assignee != "Unknown":
                        action_str += f" (assigned to {assignee})"
                    action_details.append(action_str)
            if action_details:
                context_parts.append(f"ACTION ITEMS IDENTIFIED ({len(action_items)} total):\n" + "\n".join(f"- {a}" for a in action_details))
        
        # Add sentiment context
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
            context_parts.append(sentiment_text)
        
        context_section = "\n\n".join(context_parts) if context_parts else "No additional context available from other analysis agents."

        return f"""Analyze the following meeting transcript and create a comprehensive, accurate summary.

CRITICAL INSTRUCTIONS:
1. **Write in Your Own Words**: NEVER copy sentences directly from the transcript. Paraphrase and synthesize the information.

2. **Extract Topics from Transcript**: Read the transcript carefully and identify the ACTUAL topics discussed. Do not rely solely on the context section if topics are marked as UNKNOWN.

3. **Speaker Attribution**: Identify speakers from the transcript and attribute key points to them.

4. **Accuracy**: Only include information explicitly stated in the transcript. Do not infer or assume.

5. **Specificity**: Be concrete and specific. Include names, numbers, dates, and specific details when mentioned.

CONTEXT FROM OTHER ANALYSIS AGENTS:
{context_section}

Generate:
1. **paragraph**: A comprehensive 2-4 paragraph summary written in YOUR OWN WORDS that:
   - Opens with the meeting's main purpose and identifies key participants from the transcript
   - Describes SPECIFIC topics discussed with details from the transcript (extract these from the actual conversation)
   - Attributes key contributions to specific speakers when identifiable
   - Summarizes important decisions made
   - Lists action items with assignees (if any), OR explicitly states "No action items were identified"
   - Reflects the actual sentiment/tone
   - Concludes with next steps or outcomes
   - MUST be written as a coherent narrative, NOT copied sentences
   
2. **bullets**: A list of 6-10 specific bullet points written in YOUR OWN WORDS that:
   - Identify CONCRETE topics discussed (extract from transcript, not from context if marked UNKNOWN)
   - Attribute key points to specific speakers when possible
   - Include key decisions with context
   - List action items with assignees, OR state "No action items identified"
   - Reflect important outcomes
   - Each bullet should be specific, not vague
   - MUST be paraphrased, NOT copied from transcript
   
3. **confidence**: Your confidence in this summary's accuracy (0.0 to 1.0)

Return ONLY a JSON object with this exact structure:
{{
  "paragraph": "Comprehensive summary written in your own words with speaker names and specific details...",
  "bullets": [
    "Paraphrased point 1 with details",
    "Paraphrased point 2 with details",
    "Decision: [specific decision in your own words]",
    "Action item: [description] - assigned to [name]"
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
        """Fallback: Generate extractive summary from transcript directly."""
        print("Using extractive summary fallback...")
        
        # Clean the transcript first
        clean_transcript = self._preprocess_text(transcript)
        
        # Split into sentences more carefully
        sentences = []
        for sent in re.split(r'[.!?]+', clean_transcript):
            sent = sent.strip()
            if len(sent.split()) > 4:  # Only keep substantial sentences
                sentences.append(sent)

        # Extract topics directly from transcript using keyword analysis
        extracted_topics = self._extract_topics_from_text(clean_transcript)

        # Create paragraph summary
        paragraph_sections: List[str] = []
        
        # Add participant info if available
        if participants:
            speaker_names = [self._clean_text(p.get("name", "Unknown")) for p in participants[:5]]
            speaker_names = [n for n in speaker_names if n and n != "Unknown"]
            if speaker_names:
                paragraph_sections.append(
                    f"The meeting included {len(participants)} participants, with key contributors being {', '.join(speaker_names)}."
                )

        # Use extracted topics instead of relying on topic_segments if they're unknown
        if extracted_topics:
            if len(extracted_topics) > 1:
                paragraph_sections.append(
                    f"The discussion covered several topics including {', '.join(extracted_topics[:-1])} and {extracted_topics[-1]}."
                )
            else:
                paragraph_sections.append(f"The discussion focused on {extracted_topics[0]}.")
        elif topic_segments:
            # Only use topic_segments if they have valid data
            titles = [self._clean_text(seg.get("title") or seg.get("name", "")) for seg in topic_segments[:5]]
            titles = [t for t in titles if t and t != "[UNKNOWN]" and "unknown" not in t.lower()]
            if titles:
                if len(titles) > 1:
                    paragraph_sections.append(
                        f"The discussion covered several important topics including {', '.join(titles[:-1])} and {titles[-1]}."
                    )
                else:
                    paragraph_sections.append(f"The discussion focused on {titles[0]}.")

        # Extract key points from first few sentences
        if sentences:
            key_points = sentences[:3]
            for point in key_points:
                if len(point.split()) > 10:  # Only substantial sentences
                    # Paraphrase by extracting main subject
                    paragraph_sections.append(f"The team discussed matters related to {point.split()[:15]}")
                    break

        if decisions:
            decision_count = len(decisions)
            # Try to extract decision details
            decision_details = []
            for d in decisions[:2]:
                dec_text = self._clean_text(d.get("decision") or d.get("text", ""))
                if dec_text and dec_text != "[UNKNOWN]":
                    decision_details.append(dec_text[:80])
            
            if decision_details:
                paragraph_sections.append(
                    f"Key decisions were made regarding: {'; '.join(decision_details)}."
                )
            else:
                paragraph_sections.append(
                    f"The team reached {decision_count} important decision{'s' if decision_count > 1 else ''} during the meeting."
                )

        if action_items:
            action_count = len(action_items)
            paragraph_sections.append(
                f"A total of {action_count} action item{'s were' if action_count > 1 else ' was'} identified and assigned to team members for follow-up."
            )

        if sentiment:
            overall = sentiment.get("overall", "neutral").lower()
            paragraph_sections.append(
                f"The overall tone of the discussion was {overall}."
            )

        paragraph = " ".join(paragraph_sections) if paragraph_sections else "Meeting transcript analysis completed."

        # Create bullet points
        bullets: List[str] = []
        
        # Add extracted topics as bullets
        for topic in extracted_topics[:3]:
            bullets.append(f"Discussion topic: {topic}")
        
        if decisions:
            for decision in decisions[:3]:
                decision_text = self._clean_text(decision.get("decision") or decision.get("text", ""))
                if decision_text and decision_text != "[UNKNOWN]":
                    bullets.append(f"Key decision: {decision_text[:120]}")
        
        if action_items:
            for item in action_items[:5]:
                title = self._clean_text(item.get("title") or item.get("description", ""))
                assignee = self._clean_text(item.get("assignee", ""))
                if title:
                    if assignee and assignee != "Unknown":
                        bullets.append(f"Action: {title[:100]} (Owner: {assignee})")
                    else:
                        bullets.append(f"Action: {title[:100]}")
        
        # Add general discussion points from sentences
        if sentences and len(bullets) < 5:
            for sent in sentences[:3]:
                if len(sent.split()) > 10:
                    # Paraphrase the sentence
                    words = sent.split()[:15]
                    bullets.append(f"Team discussed: {' '.join(words)}...")
                    if len(bullets) >= 5:
                        break

        # Ensure at least one bullet
        if not bullets:
            bullets = ["Meeting transcript was analyzed but specific details were limited"]

        # Clean all bullets
        bullets = [self._clean_text(b) for b in bullets]
        bullets = [b for b in bullets if b]

        return SummaryResult(
            paragraph=paragraph,
            bullets=bullets[:7],
            confidence=0.5
        ).to_dict()
    
    def _extract_topics_from_text(self, text: str) -> List[str]:
        """Extract likely topics from transcript text using simple keyword analysis."""
        # Common meeting topic indicators
        topic_indicators = [
            r'discuss(?:ed|ing)?\s+(?:about\s+)?([a-z\s]{3,30})',
            r'talk(?:ed|ing)?\s+about\s+([a-z\s]{3,30})',
            r'regarding\s+([a-z\s]{3,30})',
            r'concerning\s+([a-z\s]{3,30})',
            r'focus(?:ed|ing)?\s+on\s+([a-z\s]{3,30})',
            r'topic(?:\s+is|\s+was)?\s+([a-z\s]{3,30})',
            r'agenda(?:\s+item)?:\s+([a-z\s]{3,30})',
        ]
        
        topics = []
        lower_text = text.lower()
        
        for pattern in topic_indicators:
            matches = re.findall(pattern, lower_text)
            for match in matches:
                topic = match.strip()
                # Clean up the topic
                topic = re.sub(r'\b(the|a|an|and|or|but|in|on|at|to|for)\b', '', topic).strip()
                topic = ' '.join(topic.split())  # normalize whitespace
                
                if len(topic) > 3 and topic not in topics:
                    topics.append(topic.title())
                    
                if len(topics) >= 5:
                    break
            
            if len(topics) >= 5:
                break
        
        return topics[:5]
    
    def write_summary_to_file(
        self,
        summary_result: Dict[str, Any],
        output_path: str,
        source_file: str = "transcript"
    ) -> None:
        """Optional utility: Write summary to a formatted text file."""
        try:
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write("MEETING SUMMARY\n")
                file.write("=" * 50 + "\n\n")
                file.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                file.write(f"Source: {source_file}\n")
                file.write(f"Model: {self.GROQ_MODEL if self.use_api else 'Extractive (Fallback)'}\n")
                file.write(f"Confidence: {summary_result.get('confidence', 0.0):.2f}\n\n")
                file.write("-" * 50 + "\n\n")
                
                # Write paragraph summary
                file.write("SUMMARY\n")
                file.write("-" * 20 + "\n")
                file.write(summary_result.get('paragraph', '') + "\n\n")
                
                # Write bullet points
                bullets = summary_result.get('bullets', [])
                if bullets:
                    file.write("KEY POINTS\n")
                    file.write("-" * 20 + "\n")
                    for i, bullet in enumerate(bullets, 1):
                        file.write(f"{i}. {bullet}\n")
                    file.write("\n")
                
            print(f"Summary written to {output_path}")
        except Exception as e:
            print(f"Failed to write summary file: {e}")