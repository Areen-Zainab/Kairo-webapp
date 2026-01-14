"""
Summary Agent
-------------

Uses Groq Cloud API with Llama to generate professional meeting minutes.
Falls back to structured extractive summary if API is unavailable.
"""

from __future__ import annotations

import os
import sys
import re
import json
import time
import requests
from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Optional
from datetime import datetime

# Try relative import first (for module execution), fallback to absolute (for direct execution)
try:
    from .hf_client import hf_infer
except ImportError:
    from hf_client import hf_infer


@dataclass
class SummaryResult:
    meeting_title: str
    date: str
    attendees: List[str]
    agenda: List[str]
    overview: str
    paragraph_summary: str
    key_points: List[str]
    discussion_points: List[Dict[str, str]]
    decisions: List[str]
    action_items: List[Dict[str, str]]
    next_steps: str
    confidence: float
    # Layered summaries
    executive_summary: Optional[str] = None  # 2-3 sentences for executives
    detailed_summary: Optional[str] = None   # Full narrative for participants
    bullet_summary: Optional[List[str]] = None  # Quick bullet points

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SummaryAgent:
    """Produces professional meeting minutes using Groq Cloud API with Llama."""

    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL = "llama-3.3-70b-versatile"  # Best free model for long-context summarization
    GROQ_API_KEY_ENV = "GROQ_API_KEY"
    SUMMARY_PROVIDER_ENV = "SUMMARY_PROVIDER"  # groq | hf | mistral
    # Note: Most HF Inference API models are deprecated (Mistral-7B, flan-t5, etc return 410 Gone)
    # HuggingFace has moved to paid inference endpoints. Falling back to Groq.
    HF_SUMMARY_MODEL = "HuggingFaceH4/zephyr-7b-beta"  # Trying zephyr as alternative
    HF_API_TOKEN_ENV = "MISTRAL_API_KEY"  # Environment variable for Mistral/HF token
    
    # Chunking configuration for long transcripts
    CHUNK_THRESHOLD_WORDS = 2500
    CHUNK_SIZE_WORDS = 1500
    CHUNK_OVERLAP_WORDS = 300

    def __init__(self):
        # Initialization (logging minimized)
        
        # Provider selection - DEFAULT to Hugging Face to avoid Groq rate limits
        self.provider = os.getenv(self.SUMMARY_PROVIDER_ENV, "hf").lower()

        # Support multiple API keys for rate limit distribution (Groq)
        self.api_keys = []
        key1 = os.getenv(self.GROQ_API_KEY_ENV)
        key2 = os.getenv('GROQ_API_KEY_2')
        
        if key1:
            self.api_keys.append(key1)
        if key2:
            self.api_keys.append(key2)
        
        self.current_key_index = 0
        self.use_api = len(self.api_keys) > 0
        self.use_hf = self.provider in ["hf", "mistral"]
        
        # Check for HF token if using HF
        self.hf_token = os.getenv(self.HF_API_TOKEN_ENV)
        
        if self.use_hf and not self.hf_token:
            self.use_hf = False
    
    def _get_next_api_key(self) -> str:
        """Get next API key in rotation."""
        if not self.api_keys:
            return None
        key = self.api_keys[self.current_key_index]
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        return key
    
    def _call_groq_api(self, payload: Dict[str, Any], timeout: int = 60) -> Dict[str, Any]:
        """
        Call Groq API with automatic key rotation on rate limits.
        Tries all available keys before giving up.
        """
        if not self.api_keys:
            raise ValueError("No Groq API keys configured")

        total_keys = len(self.api_keys)
        max_rounds = 2  # first pass + one retry after waiting
        wait_seconds = 3
        last_error = None

        for round_idx in range(max_rounds):
            for attempt_in_round in range(total_keys):
                api_key = self._get_next_api_key()
                try:
                    response = requests.post(
                        self.GROQ_API_URL,
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json"
                        },
                        json=payload,
                        timeout=timeout
                    )
                    response.raise_for_status()
                    return response.json()

                except requests.exceptions.Timeout as e:
                    last_error = e
                    print(f"Timeout with key {attempt_in_round + 1}/{total_keys} (round {round_idx + 1}); trying next key...", file=sys.stderr)
                    continue

                except requests.exceptions.HTTPError as e:
                    last_error = e
                    if e.response is not None and e.response.status_code == 429:
                        print(f"Rate limit (429) with key {attempt_in_round + 1}/{total_keys} (round {round_idx + 1}); trying next key...", file=sys.stderr)
                        continue
                    # Other HTTP errors: re-raise
                    raise

                except Exception as e:
                    last_error = e
                    raise

            # If we exhausted all keys in this round, optionally wait and retry
            if round_idx < max_rounds - 1:
                print(f"All keys failed in round {round_idx + 1}. Waiting {wait_seconds}s before retry...", file=sys.stderr)
                time.sleep(wait_seconds)

        # Exhausted retries
        if last_error:
            raise last_error
        raise RuntimeError("Groq API failed after retries (timeout/429).")
    
    def _preprocess_text(self, text: str) -> str:
        """Remove timestamps, speaker labels, and normalize whitespace."""
        # Remove all timestamp formats
        text = re.sub(r'\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-\s*\d{2}:\d{2}:\d{2}\.\d{3}\]', '', text)
        text = re.sub(r'\d+s\):\s*', '', text)
        text = re.sub(r'\[\d{2}:\d{2}:\d{2}\]', '', text)
        text = re.sub(r'\(\d{1,2}:\d{2}:\d{2}\)', '', text)
        
        # Remove [UNKNOWN] placeholders
        text = re.sub(r'\[UNKNOWN\]\s*\(\d+', '', text)
        text = re.sub(r'\[SPEAKER_\d+\]\s*\(\d+', '', text)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    def _extract_speakers(self, text: str) -> List[str]:
        """Extract speaker names from transcript."""
        # Look for speaker patterns: "John:", "Sarah said", etc.
        speaker_patterns = [
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:',  # "John:" or "John Smith:"
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|mentioned|stated|asked)',
        ]
        
        speakers = set()
        for pattern in speaker_patterns:
            matches = re.findall(pattern, text)
            speakers.update(matches)
        
        # Limit to 10 most mentioned speakers
        speaker_list = sorted(list(speakers))[:10]
        return speaker_list if speaker_list else ["Meeting Participants"]

    def _chunk_text(self, text: str, max_words: int = None, overlap: int = None) -> List[str]:
        """Split text into chunks with overlap."""
        max_words = max_words or self.CHUNK_SIZE_WORDS
        overlap = overlap or self.CHUNK_OVERLAP_WORDS
        
        words = text.split()
        if len(words) <= max_words:
            return [text]
        
        chunks = []
        start = 0
        while start < len(words):
            end = start + max_words
            chunk = ' '.join(words[start:end])
            
            # Try to end at sentence boundary
            if end < len(words) and not chunk.endswith(('.', '?', '!')):
                last_sentence_end = max(chunk.rfind('.'), chunk.rfind('?'), chunk.rfind('!'))
                if last_sentence_end > len(chunk) * 0.7:
                    chunk = chunk[:last_sentence_end + 1]
            
            chunks.append(chunk)
            start = end - overlap if end < len(words) else len(words)
        
        return chunks

    def run(
        self,
        transcript: str,
        *,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
        generate_layered: bool = True,  # NEW: Enable layered summaries by default
    ) -> Dict[str, Any]:
        """Generate professional meeting minutes with optional layered summaries."""
        
        if not transcript or not transcript.strip():
            return self._generate_empty_summary()
        
        # PRIMARY: Try Mistral Direct API (official SDK, best quality)
        if self.hf_token:
            try:
                result = self._generate_with_mistral_direct(transcript, topic_segments, decisions, action_items, sentiment, participants)
                return result
            except Exception as e:
                pass  # Fall back to extractive

        # FALLBACK: Extractive summary (rule-based, always works)
        result = self._generate_extractive(
            transcript, topic_segments, decisions,
            action_items, sentiment, participants
        )
        return result

    def _generate_with_mistral_direct(
        self,
        transcript: str,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Generate summary using Mistral API directly (not HuggingFace).
        Uses official mistralai SDK for better reliability.
        """
        
        try:
            from mistralai import Mistral
        except ImportError:
            print("[MISTRAL] ❌ mistralai package not installed, falling back", file=sys.stderr)
            raise ImportError("mistralai package required")
        
        clean_transcript = self._preprocess_text(transcript)
        word_count = len(clean_transcript.split())

        if word_count == 0:
            return self._generate_empty_summary()

        # Build context from other agents
        context = self._build_context(
            topic_segments, decisions, action_items,
            sentiment, participants
        )
        context_str = self._format_context(context)

        # Mistral can handle longer context (~32k tokens for mistral-small)
        # Truncate if very long
        max_chars = 20000
        if len(clean_transcript) > max_chars:
            clean_transcript = clean_transcript[:max_chars] + "..."

        # Build Mistral prompt for LAYERED SUMMARIES
        system_prompt = "You are an expert meeting summarizer. Analyze meeting transcripts and create professional, structured meeting minutes with multiple summary formats for different audiences."
        
        user_prompt = f"""Analyze this meeting transcript and create comprehensive meeting minutes with LAYERED SUMMARIES.

{context_str}

TRANSCRIPT:
{clean_transcript}

Generate meeting minutes with THREE TYPES of summaries:

1. **Executive Summary** (2-3 sentences): High-level overview for executives who need quick insights
2. **Detailed Summary** (3-5 paragraphs): Full narrative for meeting participants with context and discussion flow
3. **Bullet Summary** (8-12 bullets): Scannable key points for quick reference

Also include:
- Meeting title
- Key decisions
- Action items

Respond ONLY with valid JSON in this exact format:
{{
  "meeting_title": "Brief descriptive title",
  "executive_summary": "2-3 concise sentences for executives covering main outcomes and decisions",
  "detailed_summary": "3-5 paragraphs providing full context: what was discussed, why it matters, key themes, participant contributions, and outcomes. This should be comprehensive and narrative.",
  "bullet_summary": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5", "Key point 6", "Key point 7", "Key point 8"],
  "decisions": ["Decision 1", "Decision 2"],
  "action_items": [{{"task": "Task description", "owner": "Person name", "deadline": "Date or timeframe"}}],
  "confidence": 0.85
}}

IMPORTANT: Make the detailed_summary substantive (at least 500 characters). Include context, discussion themes, and narrative flow."""

        try:
            # Initialize Mistral client
            client = Mistral(api_key=self.hf_token)
            
            # Build messages
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # Call Mistral API
            response = client.chat.complete(
                model="mistral-small-latest",
                messages=messages,
                temperature=0.3,
                max_tokens=1500
            )
            
            # Extract generated text
            generated_text = None
            if response and response.choices:
                generated_text = response.choices[0].message.content

            if not generated_text:
                raise ValueError("No generated text from Mistral API")

            # Clean markdown if present
            content = generated_text.strip()
            
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            # Parse JSON
            parsed = json.loads(content)

            # Build result with LAYERED SUMMARIES
            # Extract layered summaries
            executive = parsed.get("executive_summary", "")
            detailed = parsed.get("detailed_summary", "")
            bullets = parsed.get("bullet_summary", [])
            
            result_obj = SummaryResult(
                meeting_title=parsed.get("meeting_title", "Meeting Summary"),
                date=datetime.now().strftime('%Y-%m-%d'),
                attendees=parsed.get("attendees", []),
                agenda=parsed.get("agenda", []),
                overview=executive or detailed[:200],  # Use executive or first 200 chars of detailed
                paragraph_summary=detailed or executive,  # Use detailed as main paragraph
                key_points=bullets if bullets else parsed.get("key_points", []),
                discussion_points=[],
                decisions=parsed.get("decisions", []),
                action_items=parsed.get("action_items", []),
                next_steps=parsed.get("next_steps", "Follow up on action items."),
                confidence=float(parsed.get("confidence", 0.85)),
                # LAYERED SUMMARIES (new format)
                executive_summary=executive,
                detailed_summary=detailed,
                bullet_summary=bullets
            )
            return result_obj.to_dict()

        except Exception as e:
            raise  # Re-raise to trigger fallback to extractive

    def _generate_with_groq(
        self, 
        transcript: str,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
        generate_layered: bool = True,
    ) -> Dict[str, Any]:
        """Generate meeting minutes using Groq API with optional layered summaries."""
        
        clean_transcript = self._preprocess_text(transcript)
        word_count = len(clean_transcript.split())
        
        # Build context from other agents
        context = self._build_context(
            topic_segments, decisions, action_items, 
            sentiment, participants
        )
        
        # Handle long transcripts with chunking
        if word_count > self.CHUNK_THRESHOLD_WORDS:
            base_result = self._generate_chunked(
                clean_transcript, context, word_count
            )
        else:
            # Single-pass generation for shorter transcripts
            base_result = self._generate_single_pass(clean_transcript, context, word_count)
        
        # Generate layered summaries if requested
        if generate_layered and self.use_api:
            try:
                print("\n[INFO] Generating layered summaries...", file=sys.stderr)
                layered = self._generate_layered_summaries(base_result, clean_transcript, context)
                base_result.update(layered)
                print("[OK] Layered summaries generated", file=sys.stderr)
            except Exception as e:
                print(f"[WARN] Layered summary generation failed: {e}. Continuing with base summary.", file=sys.stderr)
        
        return base_result

    def _build_context(
        self,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Build context dictionary from agent outputs."""
        
        context = {
            "participants": [],
            "topics": [],
            "decisions": [],
            "actions": [],
            "sentiment": "neutral"
        }
        
        # Extract participants
        if participants:
            for p in participants:
                name = p.get("name", "")
                if name and name != "Unknown":
                    context["participants"].append({
                        "name": name,
                        "speaking_time": p.get("speakingTime", 0),
                        "contributions": p.get("keyContributions", [])[:2]
                    })
        
        # Extract topics (filter unknowns)
        if topic_segments:
            for t in topic_segments:
                name = t.get("name") or t.get("title", "")
                if name and name != "[UNKNOWN]" and "unknown" not in name.lower():
                    context["topics"].append({
                        "name": name,
                        "mentions": t.get("mentions", 0)
                    })
        
        # Extract decisions
        if decisions:
            for d in decisions:
                text = d.get("decision") or d.get("text", "")
                if text and text != "[UNKNOWN]":
                    context["decisions"].append(text)
        
        # Extract action items
        if action_items:
            for item in action_items:
                title = item.get("title") or item.get("description", "")
                assignee = item.get("assignee", "")
                if title:
                    context["actions"].append({
                        "task": title,
                        "owner": assignee if assignee != "Unknown" else ""
                    })
        
        # Extract sentiment
        if sentiment:
            context["sentiment"] = sentiment.get("overall", "neutral").lower()
        
        return context

    def _generate_single_pass(
        self, 
        transcript: str, 
        context: Dict[str, Any],
        word_count: int
    ) -> Dict[str, Any]:
        """Generate minutes in a single API call."""
        
        print(f"Transcript: {word_count} words. Using single-pass generation...", file=sys.stderr)
        
        prompt = self._build_meeting_minutes_prompt(transcript, context)
        
        payload = {
            "model": self.GROQ_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": """You are an expert at creating professional meeting minutes. 
You analyze transcripts and produce well-structured, accurate minutes following corporate standards.
Always respond with valid JSON only. Never copy sentences verbatim - paraphrase professionally."""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,
            "max_tokens": 3000
        }
        
        result = self._call_groq_api(payload, timeout=60)
        return self._parse_api_response(result)

    def _generate_chunked(
        self,
        transcript: str,
        context: Dict[str, Any],
        word_count: int
    ) -> Dict[str, Any]:
        """Generate minutes for long transcripts using chunking."""
        
        print(f"Transcript: {word_count} words. Using chunked generation...", file=sys.stderr)
        
        chunks = self._chunk_text(transcript)
        print(f"Created {len(chunks)} chunks", file=sys.stderr)
        
        # Summarize each chunk
        chunk_summaries = []
        for i, chunk in enumerate(chunks, 1):
            print(f"Processing chunk {i}/{len(chunks)}...", file=sys.stderr)
            summary = self._summarize_chunk(chunk, i, len(chunks))
            if summary:
                chunk_summaries.append(summary)
        
        if not chunk_summaries:
            raise ValueError("All chunk summaries failed")
        
        # Combine chunks into final minutes
        print("Synthesizing final meeting minutes...", file=sys.stderr)
        return self._synthesize_chunks(chunk_summaries, context)

    def _summarize_chunk(self, chunk: str, num: int, total: int) -> str:
        """Summarize a single chunk."""
        
        prompt = f"""Summarize chunk {num} of {total} from a meeting transcript.

Extract:
- Key topics discussed
- Important points made
- Any decisions mentioned
- Any action items identified

Be specific with names, numbers, and details. Write in your own words.

Chunk:
{chunk}

Summary:"""
        
        payload = {
            "model": self.GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 800
        }
        
        try:
            result = self._call_groq_api(payload, timeout=45)
            return result["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"Warning: Chunk {num} failed: {e}", file=sys.stderr)
            return ""

    def _synthesize_chunks(
        self,
        summaries: List[str],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Combine chunk summaries into final minutes."""
        
        combined = "\n\n".join([
            f"Section {i+1}:\n{s}" for i, s in enumerate(summaries)
        ])
        
        context_str = self._format_context(context)
        
        prompt = f"""Synthesize these section summaries into professional meeting minutes.

{context_str}

Section Summaries:
{combined}

Create meeting minutes with this JSON structure:
{{
  "meeting_title": "Brief descriptive title",
  "date": "{datetime.now().strftime('%Y-%m-%d')}",
  "attendees": ["Name 1", "Name 2", ...],
  "agenda": ["Topic 1", "Topic 2", ...],
  "overview": "2-3 sentence meeting overview",
  "paragraph_summary": "A comprehensive 3-4 paragraph summary covering the full meeting discussion, key outcomes, and context. Write in your own words with specific details.",
  "key_points": [
    "Specific key point 1 with details",
    "Specific key point 2 with details",
    "Important takeaway 3",
    ...
  ],
  "discussion_points": [
    {{"topic": "Topic name", "summary": "What was discussed"}},
    ...
  ],
  "decisions": ["Decision 1", "Decision 2", ...],
  "action_items": [
    {{"task": "What to do", "owner": "Who", "deadline": "When (if mentioned)"}},
    ...
  ],
  "next_steps": "What happens next",
  "confidence": 0.85
}}

JSON Response:"""
        
        payload = {
            "model": self.GROQ_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You create professional meeting minutes. Respond with valid JSON only."
                },
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 2500
        }
        
        result = self._call_groq_api(payload, timeout=60)
        return self._parse_api_response(result)

    def _build_meeting_minutes_prompt(
        self, 
        transcript: str, 
        context: Dict[str, Any]
    ) -> str:
        """Build the main prompt for meeting minutes generation."""
        
        # Truncate if needed
        max_length = 18000
        if len(transcript) > max_length:
            transcript = transcript[:max_length] + "..."
        
        context_str = self._format_context(context)
        
        return f"""Analyze this meeting transcript and create professional meeting minutes.

REQUIREMENTS:
1. **Accuracy**: Only include information from the transcript
2. **Paraphrasing**: Write in your own words, never copy verbatim
3. **Specificity**: Include names, numbers, dates, and concrete details
4. **Structure**: Follow the JSON format exactly
5. **Clarity**: Be clear, concise, and professional

{context_str}

TRANSCRIPT:
{transcript}

Create meeting minutes with this EXACT JSON structure:
{{
  "meeting_title": "Brief descriptive title based on content",
  "date": "{datetime.now().strftime('%Y-%m-%d')}",
  "attendees": ["List all participants mentioned by name"],
  "agenda": ["List 3-7 main topics discussed"],
  "overview": "Write 2-4 sentences summarizing the meeting's purpose and key outcomes",
  "paragraph_summary": "Write a comprehensive 3-4 paragraph narrative summary that covers: (1) Meeting context and participants, (2) Main topics and discussions with specific details, (3) Key decisions and outcomes, (4) Action items and next steps. Write in professional prose, not bullet points. Include specific names, numbers, and details mentioned in the meeting.",
  "key_points": [
    "First critical takeaway with specific details",
    "Second important point about decisions or outcomes",
    "Third key point about action items or responsibilities",
    "Additional specific insights or agreements (6-10 total points)"
  ],
  "discussion_points": [
    {{
      "topic": "First topic name",
      "summary": "2-3 sentences on what was discussed, decided, or concluded"
    }},
    {{
      "topic": "Second topic name", 
      "summary": "Specific details of this discussion"
    }}
  ],
  "decisions": [
    "Specific decision 1 with context",
    "Specific decision 2 with context"
  ],
  "action_items": [
    {{
      "task": "Specific action to be taken",
      "owner": "Person responsible",
      "deadline": "Date/timeframe if mentioned, or 'Not specified'"
    }}
  ],
  "next_steps": "1-2 sentences on what happens after this meeting",
  "confidence": 0.85
}}

IMPORTANT:
- paragraph_summary must be 3-4 full paragraphs of connected prose
- key_points should be 6-10 specific, actionable bullet points
- If no decisions were made, use empty array: "decisions": []
- If no action items, use empty array: "action_items": []
- Include 4-8 discussion points covering all major topics
- Write professionally but naturally

JSON Response:"""

    def _format_context(self, context: Dict[str, Any]) -> str:
        """Format context dictionary into readable string."""
        
        parts = []
        
        if context["participants"]:
            names = [p["name"] for p in context["participants"][:5]]
            parts.append(f"PARTICIPANTS: {', '.join(names)}")
        
        if context["topics"]:
            topics = [t["name"] for t in context["topics"][:5]]
            parts.append(f"KEY TOPICS: {', '.join(topics)}")
        
        if context["decisions"]:
            parts.append(f"DECISIONS: {len(context['decisions'])} identified")
        
        if context["actions"]:
            parts.append(f"ACTION ITEMS: {len(context['actions'])} identified")
        
        if context["sentiment"]:
            parts.append(f"SENTIMENT: {context['sentiment']}")
        
        return "CONTEXT FROM ANALYSIS:\n" + "\n".join(parts) if parts else ""

    def _generate_layered_summaries(
        self,
        base_summary: Dict[str, Any],
        transcript: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate multiple summary layers for different audiences.
        Returns dict with executive_summary, detailed_summary, and bullet_summary.
        """
        layered = {}
        
        # Extract key information from base summary
        key_points = base_summary.get("key_points", [])
        decisions = base_summary.get("decisions", [])
        action_items = base_summary.get("action_items", [])
        overview = base_summary.get("overview", "")
        
        # 1. Executive Summary (2-3 sentences for busy executives)
        try:
            exec_prompt = f"""Create a 2-3 sentence executive summary of this meeting.

FOCUS ON:
- The ONE most important outcome or decision
- Critical next steps or blockers
- Business impact in one sentence

MEETING OVERVIEW:
{overview}

KEY DECISIONS:
{json.dumps(decisions[:3]) if decisions else 'None'}

KEY ACTION ITEMS:
{json.dumps([a.get('task', '') for a in action_items[:3]]) if action_items else 'None'}

Write ONLY 2-3 concise sentences. No bullet points. Use plain text only."""

            exec_payload = {
                "model": self.GROQ_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "You create ultra-concise executive summaries. Respond with 2-3 sentences only, no formatting."
                    },
                    {"role": "user", "content": exec_prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 200
            }
            
            exec_result = self._call_groq_api(exec_payload, timeout=30)
            executive_summary = exec_result["choices"][0]["message"]["content"].strip()
            # Clean up any markdown or formatting
            executive_summary = executive_summary.replace("**", "").replace("*", "").strip()
            layered["executive_summary"] = executive_summary
            print(f"  ✓ Executive summary: {len(executive_summary)} chars", file=sys.stderr)
            
        except Exception as e:
            print(f"  ✗ Executive summary failed: {e}", file=sys.stderr)
            # Fallback: use overview
            layered["executive_summary"] = overview[:300] + "..." if len(overview) > 300 else overview
        
        # 2. Detailed Summary (comprehensive narrative for participants)
        try:
            # Use the existing paragraph_summary as the detailed version
            detailed = base_summary.get("paragraph_summary", "")
            
            # If it's too short, enhance it
            if len(detailed) < 500:
                detail_prompt = f"""Expand this meeting summary into a comprehensive 4-5 paragraph narrative.

CURRENT SUMMARY:
{detailed}

KEY POINTS TO INCLUDE:
{json.dumps(key_points)}

DISCUSSION POINTS:
{json.dumps(base_summary.get('discussion_points', []))}

Write a detailed narrative covering:
1. Meeting context and participants
2. Each major topic with specific details
3. Decisions made and their rationale
4. Action items and ownership
5. Next steps and timeline

Use professional prose. Be specific with names, numbers, and details."""

                detail_payload = {
                    "model": self.GROQ_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You create comprehensive meeting narratives for participants. Write in clear, professional prose."
                        },
                        {"role": "user", "content": detail_prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1500
                }
                
                detail_result = self._call_groq_api(detail_payload, timeout=45)
                detailed = detail_result["choices"][0]["message"]["content"].strip()
            
            layered["detailed_summary"] = detailed
            print(f"  ✓ Detailed summary: {len(detailed)} chars", file=sys.stderr)
            
        except Exception as e:
            print(f"  ✗ Detailed summary failed: {e}", file=sys.stderr)
            # Fallback: use paragraph_summary
            layered["detailed_summary"] = base_summary.get("paragraph_summary", overview)
        
        # 3. Bullet Summary (quick scannable points)
        try:
            bullet_prompt = f"""Create 5-8 concise bullet points summarizing this meeting.

MEETING OVERVIEW:
{overview}

KEY POINTS:
{json.dumps(key_points)}

DECISIONS:
{json.dumps(decisions)}

ACTION ITEMS:
{json.dumps([a.get('task', '') for a in action_items])}

Return ONLY a JSON array of strings:
["Bullet point 1", "Bullet point 2", ...]

Each bullet should be:
- One clear sentence
- Action-oriented when possible
- Include specific names/numbers
- 10-15 words maximum"""

            bullet_payload = {
                "model": self.GROQ_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "You create concise bullet-point summaries. Respond with valid JSON array only."
                    },
                    {"role": "user", "content": bullet_prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 500
            }
            
            bullet_result = self._call_groq_api(bullet_payload, timeout=30)
            bullet_content = bullet_result["choices"][0]["message"]["content"].strip()
            
            # Clean markdown if present
            if bullet_content.startswith("```json"):
                bullet_content = bullet_content[7:]
            if bullet_content.startswith("```"):
                bullet_content = bullet_content[3:]
            if bullet_content.endswith("```"):
                bullet_content = bullet_content[:-3]
            bullet_content = bullet_content.strip()
            
            # Parse JSON
            bullet_summary = json.loads(bullet_content)
            if isinstance(bullet_summary, list):
                layered["bullet_summary"] = bullet_summary[:8]  # Cap at 8
                print(f"  ✓ Bullet summary: {len(bullet_summary)} bullets", file=sys.stderr)
            else:
                raise ValueError("Bullet summary not a list")
                
        except Exception as e:
            print(f"  ✗ Bullet summary failed: {e}", file=sys.stderr)
            # Fallback: use key_points
            layered["bullet_summary"] = key_points[:8] if key_points else [overview]
        
        return layered

    def _parse_api_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Parse and validate API response."""
        
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        
        # Clean markdown
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        # Basic sanity check before parsing
        if not content.lstrip().startswith(("{", "[")):
            raise ValueError(f"Groq response was not JSON: {content[:100]}")
        
        # Parse JSON
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}", file=sys.stderr)
            print(f"Content: {content[:500]}", file=sys.stderr)
            raise ValueError(f"Invalid JSON response: {e}")
        
        # Validate and create result
        return SummaryResult(
            meeting_title=parsed.get("meeting_title", "Meeting Summary"),
            date=parsed.get("date", datetime.now().strftime('%Y-%m-%d')),
            attendees=parsed.get("attendees", []),
            agenda=parsed.get("agenda", []),
            overview=parsed.get("overview", ""),
            paragraph_summary=parsed.get("paragraph_summary", parsed.get("overview", "")),  # CRITICAL FIX
            key_points=parsed.get("key_points", []),  # CRITICAL FIX
            discussion_points=parsed.get("discussion_points", []),
            decisions=parsed.get("decisions", []),
            action_items=parsed.get("action_items", []),
            next_steps=parsed.get("next_steps", "No next steps specified"),
            confidence=float(parsed.get("confidence", 0.8)),
            executive_summary=parsed.get("executive_summary"),
            detailed_summary=parsed.get("detailed_summary"),
            bullet_summary=parsed.get("bullet_summary")
        ).to_dict()

    def _generate_extractive(
        self,
        transcript: str,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Fallback: Generate structured minutes from transcript."""
        
        print("\n--- _generate_extractive() called ---", file=sys.stderr)
        print("[EXTRACTIVE] ⚠️ Using extractive summary fallback (simple template-based)", file=sys.stderr)
        
        clean_transcript = self._preprocess_text(transcript)
        attendees = self._extract_speakers(clean_transcript)
        
        # Extract topics
        agenda = []
        if topic_segments:
            for t in topic_segments[:7]:
                name = t.get("name") or t.get("title", "")
                if name and name != "[UNKNOWN]" and "unknown" not in name.lower():
                    agenda.append(name)
        
        if not agenda:
            agenda = ["General Discussion"]
        
        # Build discussion points
        discussion_points = []
        for topic in agenda[:5]:
            discussion_points.append({
                "topic": topic,
                "summary": f"Team discussed {topic.lower()} with various perspectives shared."
            })
        
        # Extract decisions
        decision_list = []
        if decisions:
            for d in decisions[:5]:
                text = d.get("decision") or d.get("text", "")
                if text and text != "[UNKNOWN]":
                    decision_list.append(text[:150])
        
        # Extract action items
        action_list = []
        if action_items:
            for item in action_items[:10]:
                task = item.get("title") or item.get("description", "")
                owner = item.get("assignee", "Not assigned")
                if task:
                    action_list.append({
                        "task": task[:150],
                        "owner": owner if owner != "Unknown" else "Not assigned",
                        "deadline": "Not specified"
                    })
        
        # Build overview
        overview = f"Meeting with {len(attendees)} participant(s) covering {len(agenda)} main topic(s). "
        if decision_list:
            overview += f"{len(decision_list)} decision(s) were made. "
        if action_list:
            overview += f"{len(action_list)} action item(s) were identified."
        
        # Build paragraph summary
        paragraph_summary = overview
        
        # Build key points
        key_points = []
        for topic in agenda[:3]:
            key_points.append(f"Discussed: {topic}")
        for d in decision_list[:3]:
            key_points.append(f"Decision: {d[:70]}..." if len(d) > 70 else f"Decision: {d}")
        for a in action_list[:3]:
            key_points.append(f"Action: {a['task'][:70]}..." if len(a['task']) > 70 else f"Action: {a['task']}")
        
        return SummaryResult(
            meeting_title="Meeting Summary",
            date=datetime.now().strftime('%Y-%m-%d'),
            attendees=attendees,
            agenda=agenda,
            overview=overview,
            paragraph_summary=paragraph_summary,
            key_points=key_points,
            discussion_points=discussion_points,
            decisions=decision_list,
            action_items=action_list,
            next_steps="Follow up on action items and decisions.",
            confidence=0.6,
            executive_summary=None,
            detailed_summary=None,
            bullet_summary=None
        ).to_dict()

    def _generate_empty_summary(self) -> Dict[str, Any]:
        """Generate empty summary for invalid input."""
        return SummaryResult(
            meeting_title="Empty Meeting",
            date=datetime.now().strftime('%Y-%m-%d'),
            attendees=[],
            agenda=[],
            overview="No transcript content available.",
            paragraph_summary="No transcript content available.",
            key_points=[],
            discussion_points=[],
            decisions=[],
            action_items=[],
            next_steps="N/A",
            confidence=0.0,
            executive_summary=None,
            detailed_summary=None,
            bullet_summary=None
        ).to_dict()

    def write_summary_to_file(
        self,
        summary_result: Dict[str, Any],
        output_path: str
    ) -> None:
        """Write formatted meeting minutes to file."""
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write("=" * 70 + "\n")
                f.write(f"{summary_result['meeting_title'].upper()}\n")
                f.write("=" * 70 + "\n\n")
                
                f.write(f"Date: {summary_result['date']}\n")
                f.write(f"Confidence: {summary_result['confidence']:.2f}\n\n")
                
                # Attendees
                if summary_result['attendees']:
                    f.write("ATTENDEES:\n")
                    for attendee in summary_result['attendees']:
                        f.write(f"  • {attendee}\n")
                    f.write("\n")
                
                # Agenda
                if summary_result['agenda']:
                    f.write("AGENDA:\n")
                    for i, item in enumerate(summary_result['agenda'], 1):
                        f.write(f"  {i}. {item}\n")
                    f.write("\n")
                
                # Overview
                f.write("MEETING OVERVIEW:\n")
                f.write(f"{summary_result['overview']}\n\n")
                
                # Discussion Points
                if summary_result['discussion_points']:
                    f.write("DISCUSSION:\n")
                    f.write("-" * 70 + "\n")
                    for point in summary_result['discussion_points']:
                        f.write(f"\n{point['topic']}:\n")
                        f.write(f"{point['summary']}\n")
                    f.write("\n")
                
                # Decisions
                if summary_result['decisions']:
                    f.write("DECISIONS MADE:\n")
                    f.write("-" * 70 + "\n")
                    for i, decision in enumerate(summary_result['decisions'], 1):
                        f.write(f"{i}. {decision}\n")
                    f.write("\n")
                else:
                    f.write("DECISIONS MADE: None\n\n")
                
                # Action Items
                if summary_result['action_items']:
                    f.write("ACTION ITEMS:\n")
                    f.write("-" * 70 + "\n")
                    for i, action in enumerate(summary_result['action_items'], 1):
                        f.write(f"{i}. {action['task']}\n")
                        f.write(f"   Owner: {action['owner']}\n")
                        f.write(f"   Deadline: {action['deadline']}\n\n")
                else:
                    f.write("ACTION ITEMS: None\n\n")
                
                # Next Steps
                f.write("NEXT STEPS:\n")
                f.write(f"{summary_result['next_steps']}\n\n")
                
                f.write("=" * 70 + "\n")
            
            print(f" Meeting minutes written to {output_path}", file=sys.stderr)
        except Exception as e:
            print(f" Failed to write minutes: {e}", file=sys.stderr)