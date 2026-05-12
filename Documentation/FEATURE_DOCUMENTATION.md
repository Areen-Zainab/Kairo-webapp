# Kairo — Feature Documentation

Deep-dive technical reference for every Kairo feature. For a quick overview of all capabilities, see the Core Capabilities table in the root `README.md`. For endpoint signatures and request/response schemas, see `API_REFERENCE.md`.

---

## Table of Contents

1. [Auto-Join, Capture, and Transcription](#1-auto-join-capture-and-transcription)
2. [Speaker Diarization and Identification](#2-speaker-diarization-and-identification)
3. [AI Insights Engine](#3-ai-insights-engine)
4. [Meeting Memory Engine](#4-meeting-memory-engine)
5. [Workspace Knowledge Graph](#5-workspace-knowledge-graph)
6. [Kanban Task Board](#6-kanban-task-board)
7. [Whisper Mode (Live Micro-Recaps)](#7-whisper-mode-live-micro-recaps)
8. [Privacy Mode](#8-privacy-mode)
9. [Smart Search](#9-smart-search)
10. [Google Calendar Integration](#10-google-calendar-integration)
11. [Analytics Dashboard](#11-analytics-dashboard)
12. [Team and Workspace Management](#12-team-and-workspace-management)
13. [Note-Taking, File Attachments, and Transcript Review](#13-note-taking-file-attachments-and-transcript-review)
14. [Auto Follow-Up Reminders](#14-auto-follow-up-reminders)

---

## 1. Auto-Join, Capture, and Transcription

The bot manages the full meeting lifecycle (`scheduled → in-progress → completed`) with duplicate-join protection and clean process teardown. Audio is captured via virtual routing into ~3-second chunks and transcribed immediately by WhisperX (`small` model, CPU int8 — no GPU required). The model is preloaded at server startup to eliminate cold-start latency. Transcribed text is broadcast over WebSocket as it arrives and persisted in JSON, plain text, and SRT formats.

**Supported platforms:** Google Meet, Zoom.

---

## 2. Speaker Diarization and Identification

Resolution happens in three distinct stages:

### Voice Enrollment

- Users record a 15–30 second sample; SNR is validated before enrollment is accepted
- A 192-dimensional ECAPA-TDNN embedding (SpeechBrain `spkrec-ecapa-voxceleb`, VoxCeleb-trained) is stored per user
- Consent is tracked independently; a 256-dim pyannote ResNet34 fallback is available if SpeechBrain is unavailable

### Live Identification (per ~3s chunk)

- A persistent warm Python encoder process embeds each audio chunk (adaptive 35s cold-start, 10s subsequent; exponential-backoff restart on failure)
- Cosine similarity at `threshold=0.55` against all enrolled workspace members; a sliding-window majority vote (`WINDOW=4`, `MIN_VOTES=2`) prevents label flicker
- Confirmed identity is pushed to all connected clients over WebSocket in real time

### Post-Meeting Identification

- Full recording is re-diarized with WhisperX + pyannote to produce stable `SPEAKER_XX` labels
- A multi-tier matching engine resolves labels to real names:

| Tier | Method | Threshold |
|---|---|---|
| 1 | Biometric cosine similarity | 0.72 |
| 3 | Historical speaker identity maps | — |
| 4 | Manual assignment via transcript UI | — |

- Resolved names cascade-propagate across the transcript, insights, action items, and memory embeddings before AI processing begins
- Per-entry badges (Biometric, Manual, Historical) indicate how each speaker was resolved; manual assignments are preserved unless a higher-confidence biometric match supersedes them

---

## 3. AI Insights Engine

Six insight types are generated post-meeting via a parallel multi-model Python agent pipeline:

| Insight Type | Model | Notes |
|---|---|---|
| Summary | Mistral `mistral-small-latest` | 32k context; outputs executive summary, narrative, and bullet points in one call |
| Decisions | Groq `llama-3.3-70b-versatile` | Schema-stable JSON; 128k context |
| Topic Segmentation | Groq `llama-3.3-70b-versatile` | Contextual grouping across long transcripts |
| Sentiment Analysis | Groq `llama-3.3-70b-versatile` | Per-speaker; High/Medium/Low impact classification |
| Action Items | Groq `llama-3.1-8b-instant` | Lightweight extraction model; minimises pipeline latency |
| Participant Analysis | Groq `llama-3.3-70b-versatile` | Speaking time, utterance count, engagement scoring |

- Text-based agents (Decisions, Topics, Sentiment, Action Items) run in parallel; Participant Analysis runs concurrently on diarized JSON; Summary Agent runs last with aggregated context from all prior agents
- Total pipeline time: 30–120 seconds depending on transcript length
- **Fallback chain:** Primary LLM → Hosted inference (HF/DistilBERT) → NLP heuristics (extractive tokenization, pattern matching, lexicon sentiment); confidence scores are halved on fallback to flag reduced reliability
- Utterances timestamped within active privacy intervals are stripped before any LLM call

---

## 4. Meeting Memory Engine

- Transcripts are sentence-chunked and embedded as 384-dim vectors using a locally-running all-MiniLM-L6-v2 model — no external embedding API, no per-token cost
- Summaries, notes, and confirmed action items are embedded as separate content types
- A structured `meeting_memory_contexts` row is persisted per meeting: topics, decisions, action-item summaries, participant list, prose context, and a summary embedding
- HNSW indexes on vector columns support fast approximate nearest-neighbor retrieval at scale
- Related meetings are ranked by cosine similarity on summary embeddings; explicit relationship rows are preferred when available, with on-demand similarity as fallback

---

## 5. Workspace Knowledge Graph

- Graph is assembled at query time from meetings, memory contexts, action items, and tasks — no separate graph tables; a 60-second in-process TTL cache avoids redundant DB builds
- Nodes: meetings, memory contexts, tasks — Edges: semantic and causal relationships
- BFS neighbour expansion lets any node be explored to configurable depth via a dedicated API endpoint
- Semantic search results are mapped to real graph node IDs, focusing and dimming matching nodes in the visualizer

---

## 6. Kanban Task Board

- Three default columns (To-Do, In-Progress, Done); custom columns manageable by owner/admin
- AI-extracted action items are auto-promoted to tasks with:
  - Natural language deadline parsing ("next Friday", "in 2 days", ISO dates)
  - Auto-classified priority from urgency keywords in the action item text
- Full CRUD with assignee, due date, color-coded tags, and multi-axis filtering (assignee, tag, priority, due date)
- **Meeting Context panel** — each task born from an action item surfaces its originating meeting's summary, transcript snippet, and decisions inline
- **Task Mention Detection** — fires a live WebSocket notification when a linked task's title is detected in the active transcript

---

## 7. Whisper Mode (Live Micro-Recaps)

- Groq `llama-3.1-8b-instant` generates 2–3 sentence recaps from recent transcript chunks on a configurable cron schedule
- A manual "Catch Me Up" trigger bypasses the interval and returns the latest recap immediately
- Recaps are broadcast over WebSocket and displayed in a timestamped chat-style history panel
- No recap is generated over an active privacy interval

**Environment variables:** `WHISPER_MODE_ENABLED`, `WHISPER_MODE_CRON_SCHEDULE`, `WHISPER_MODE_GROQ_MODEL`, and related tuning parameters (see `.env.example`).

---

## 8. Privacy Mode

- Toggled per meeting; each toggle appends a `{ start, end }` interval to the meeting's metadata in PostgreSQL
- Audio chunk processing is gated per chunk — chunks arriving during a privacy interval are silently dropped
- All LLM insight generation loads the interval list and filters matching utterances before sending any data to an external API
- A top-bar badge and status indicator reflect the current state; system messages appear inline in the transcript

---

## 9. Smart Search

- Hybrid retrieval: vector cosine similarity + PostgreSQL `plainto_tsquery` FTS, blended 60/40
- Falls back to pure vector search if the FTS leg fails (e.g. on special-character queries)
- Matched terms are extracted server-side (stop-words stripped) and returned alongside results for `<mark>` highlighting in snippets
- Results are deduplicated to one best match per meeting; keyboard navigation (↑↓ Enter ESC) and 500ms input debounce

---

## 10. Google Calendar Integration

- Full Google OAuth 2.0 flow; tokens stored per-user in a `CalendarConnection` record
- A 15-minute cron syncs calendar events, upserting eligible entries as Kairo `Meeting` rows with deduplication by stable calendar UID
- Synced meetings participate in the same auto-join and lifecycle flows as natively created meetings
- Gated by `ENABLE_CALENDAR_INTEGRATION=true`; routes and cron job do not mount when the flag is absent

---

## 11. Analytics Dashboard

Four tabs, all sourced from live backend data:

| Tab | Content |
|---|---|
| Overview | Meeting frequency, total duration, participation trends over time |
| Participants | Per-user speaking time, engagement scores, meeting attendance |
| Action Items | Completion rates, open vs closed counts, assignee distribution |
| Insights | Topic frequency, sentiment trends, decision volume |

- Time-range filters; bar, line, and pie chart types; natural language analytics chat interface

---

## 12. Team and Workspace Management

- Multi-workspace support; users can belong to multiple workspaces with independent roles
- Invite flow via email or invite code; four roles enforced on every API route and in the UI:

| Role | Permissions |
|---|---|
| Owner | Full control; delete workspace; manage all members and roles |
| Admin | Manage members; create/delete Kanban columns; full analytics |
| Member | Create meetings, tasks, and notes; view all workspace content |
| Observer | Read-only access to meetings and insights |

- Workspace activity is logged to an audit trail accessible to admins and owners

---

## 13. Note-Taking, File Attachments, and Transcript Review

**Notes** — Per-meeting notes with full CRUD. Notes are embedded into the memory engine, making their content discoverable via hybrid search.

**File Attachments** — Files can be uploaded to any meeting and are stored via Supabase. Download and delete operations are scoped to workspace members.

**Interactive Transcript Review** — The post-meeting transcript supports click-to-seek audio playback, a visual timeline with event markers, and speaker-attributed entries with per-entry identification badges. Any unresolved speaker label exposes a manual assignment control inline.

---

## 14. Auto Follow-Up Reminders

- Default intervals: 24h and 1h before deadline; fully configurable per user
- A quiet-hours window prevents dispatches outside working hours — handles both daytime (e.g. 09:00–18:00) and overnight (e.g. 22:00–07:00) ranges correctly
- A `SentReminder` deduplication table prevents repeated notifications for the same deadline
- In-app notification delivery; email and push channels are groundwork for future expansion
