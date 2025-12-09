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

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SummaryAgent:
    """Produces professional meeting minutes using Groq Cloud API with Llama."""

    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    GROQ_MODEL = "openai/gpt-oss-120b"  # Updated per Groq API
    GROQ_API_KEY_ENV = "GROQ_API_KEY"
    SUMMARY_PROVIDER_ENV = "SUMMARY_PROVIDER"  # groq | hf
    HF_SUMMARY_MODEL = "philschmid/bart-large-cnn-samsum"
    
    # Chunking configuration for long transcripts
    CHUNK_THRESHOLD_WORDS = 2500
    CHUNK_SIZE_WORDS = 1500
    CHUNK_OVERLAP_WORDS = 300

    def __init__(self):
        # Provider selection
        self.provider = os.getenv(self.SUMMARY_PROVIDER_ENV, "groq").lower()

        # Support multiple API keys for rate limit distribution
        self.api_keys = []
        key1 = os.getenv(self.GROQ_API_KEY_ENV)
        key2 = os.getenv('GROQ_API_KEY_2')
        
        if key1:
            self.api_keys.append(key1)
        if key2:
            self.api_keys.append(key2)
        
        self.current_key_index = 0
        self.use_api = len(self.api_keys) > 0
        self.use_hf = self.provider == "hf"
        
        if not self.use_api and self.provider == "groq":
            print("Error: No GROQ_API_KEY found; summary agent will use fallback mode.", file=sys.stderr)
        elif len(self.api_keys) > 1:
            print(f"Info: {len(self.api_keys)} Groq API keys configured for rotation.", file=sys.stderr)
    
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
    ) -> Dict[str, Any]:
        """Generate professional meeting minutes."""
        
        if not transcript or not transcript.strip():
            return self._generate_empty_summary()

        print("\n=== Summary Agent Input ===", file=sys.stderr)
        print(f"Transcript length: {len(transcript)} characters", file=sys.stderr)
        print(f"Topic segments: {len(topic_segments) if topic_segments else 0}", file=sys.stderr)
        print(f"Decisions: {len(decisions) if decisions else 0}", file=sys.stderr)
        print(f"Action items: {len(action_items) if action_items else 0}", file=sys.stderr)
        print(f"Participants: {len(participants) if participants else 0}", file=sys.stderr)
        
        # Try HF first if selected
        if self.use_hf:
            try:
                print("\n[INFO] Attempting HF summary generation...", file=sys.stderr)
                result = self._generate_with_hf(transcript, topic_segments, decisions, action_items, sentiment, participants)
                print("[OK] HF summary generated successfully", file=sys.stderr)
                return result
            except Exception as e:
                print(f"\n[ERROR] HF summary generation failed: {type(e).__name__}: {str(e)}", file=sys.stderr)
                # Continue to Groq or extractive fallback

        if self.use_api and self.provider != "hf":
            try:
                print("\n[INFO] Attempting Groq API summary generation...", file=sys.stderr)
                result = self._generate_with_groq(transcript, topic_segments, decisions, action_items, sentiment, participants)
                print("[OK] Groq API summary generated successfully", file=sys.stderr)
                return result
            except Exception as e:
                print(f"\n[ERROR] Groq API summary generation failed: {type(e).__name__}: {str(e)}", file=sys.stderr)
                print("  Falling back to extractive summary...", file=sys.stderr)
        elif not self.use_api and not self.use_hf:
            print("\n-> No API key available, using extractive summary...", file=sys.stderr)

        return self._generate_extractive(
            transcript, topic_segments, decisions,
            action_items, sentiment, participants
        )

    def _generate_with_hf(
        self,
        transcript: str,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Generate summary using Hugging Face hosted model.
        Strategy: chunk if long, summarize each chunk to bullets, then combine.
        """
        clean_transcript = self._preprocess_text(transcript)
        word_count = len(clean_transcript.split())

        if word_count == 0:
            return self._generate_empty_summary()

        # Chunk for long transcripts (smaller for HF limits)
        if word_count > self.CHUNK_THRESHOLD_WORDS:
            chunks = self._chunk_text(clean_transcript, max_words=800, overlap=80)
        else:
            chunks = [clean_transcript]

        all_bullets: List[str] = []

        for chunk in chunks:
            prompt = (
                "Summarize the meeting dialogue below into 3-6 concise bullet points.\n"
                'Return JSON ONLY in this exact format: {"bullets": ["...","..."]}\n\n'
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

            result = hf_infer(self.HF_SUMMARY_MODEL, payload, timeout=60, retries=2, backoff_seconds=3)

            generated_text = None
            if isinstance(result, list) and result and isinstance(result[0], dict):
                generated_text = result[0].get("generated_text") or result[0].get("summary_text")
            elif isinstance(result, dict):
                generated_text = result.get("generated_text") or result.get("summary_text")

            if not generated_text:
                continue

            parsed_ok = False
            try:
                parsed = json.loads(generated_text)
                bullets = parsed.get("bullets", [])
                if isinstance(bullets, list):
                    for b in bullets:
                        if isinstance(b, str) and b.strip():
                            all_bullets.append(b.strip())
                    parsed_ok = True
            except Exception:
                parsed_ok = False

            if not parsed_ok:
                for line in generated_text.splitlines():
                    line = line.strip(" -*•\t")
                    if line:
                        all_bullets.append(line)

        # Deduplicate and limit bullets
        dedup_bullets = []
        seen = set()
        for b in all_bullets:
            if b not in seen:
                dedup_bullets.append(b)
                seen.add(b)
        if not dedup_bullets:
            dedup_bullets = ["Summary unavailable."]
        dedup_bullets = dedup_bullets[:12]

        paragraph_summary = " ".join(dedup_bullets[:6])

        return SummaryResult(
            meeting_title="Meeting Summary",
            date=datetime.now().strftime('%Y-%m-%d'),
            attendees=[],
            agenda=[],
            overview=paragraph_summary,
            paragraph_summary=paragraph_summary,
            key_points=dedup_bullets,
            discussion_points=[],
            decisions=[],
            action_items=[],
            next_steps="",
            confidence=0.6
        ).to_dict()

    def _generate_with_groq(
        self, 
        transcript: str,
        topic_segments: Optional[List[Dict[str, Any]]] = None,
        decisions: Optional[List[Dict[str, Any]]] = None,
        action_items: Optional[List[Dict[str, Any]]] = None,
        sentiment: Optional[Dict[str, Any]] = None,
        participants: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Generate meeting minutes using Groq API."""
        
        clean_transcript = self._preprocess_text(transcript)
        word_count = len(clean_transcript.split())
        
        # Build context from other agents
        context = self._build_context(
            topic_segments, decisions, action_items, 
            sentiment, participants
        )
        
        # Handle long transcripts with chunking
        if word_count > self.CHUNK_THRESHOLD_WORDS:
            return self._generate_chunked(
                clean_transcript, context, word_count
            )
        
        # Single-pass generation for shorter transcripts
        return self._generate_single_pass(clean_transcript, context, word_count)

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
            confidence=float(parsed.get("confidence", 0.8))
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
        
        print("Using extractive summary fallback...", file=sys.stderr)
        
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
            confidence=0.6
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
            confidence=0.0
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