# Kairo — Context-Aware Meeting Intelligence Platform

Kairo is a full-stack, AI-powered meeting intelligence platform that autonomously joins, captures, transcribes, and analyzes video meetings. It transforms raw audio into structured, searchable, and actionable knowledge — persisted across a team workspace as an evolving semantic memory. Every meeting produces real-name speaker-attributed transcripts, multi-dimensional AI insights, Kanban-linked action items, and vector-indexed memory contexts that power a workspace-wide knowledge graph and hybrid semantic search.

---

## Table of Contents

- [Core Capabilities](#core-capabilities)
- [Feature Reference](#feature-reference)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Setup and Installation](#setup-and-installation)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Real-Time Infrastructure](#real-time-infrastructure)
- [AI Pipeline](#ai-pipeline)
- [Security and Access Control](#security-and-access-control)
- [Testing](#testing)

---

## Core Capabilities

Most meeting tools stop at transcription. Kairo's defining capability is what happens after — and during — every meeting.

**Persistent Memory.** Every session is automatically converted into a structured semantic memory. Transcripts and AI-derived summaries are embedded as 384-dimensional vectors (locally via MiniLM-L6-v2) and indexed in PostgreSQL with pgvector HNSW indexes. A structured memory context — decisions, action items, topics, participants — is persisted per meeting and remains continuously queryable through hybrid vector + full-text search across the entire workspace history.

**Knowledge Graph Visualization.** Accumulated memory is assembled at query time into an interactive workspace knowledge graph, mapping relationships between meetings, memory contexts, and tasks. Nodes can be explored, queried semantically, and expanded via BFS neighbour traversal — giving teams a living map of everything their workspace knows.

**Live Meeting Intelligence.** The memory pipeline is active during meetings, not just after. Whisper Mode delivers real-time Groq-powered micro-recaps over WebSocket. Live speaker identification patches transcript entries in real time as audio is processed. Action items extracted from the live transcript are promoted directly into the Kanban board — no manual handoff required.

| Capability | Details |
|---|---|
| **Autonomous Meeting Capture** | Headless Puppeteer bot auto-joins Google Meet and Zoom; virtual audio routing; no GPU required |
| **Real-Time Transcription** | WhisperX (faster-whisper, `small`, CPU int8) streamed live over WebSocket; SRT, JSON, and plain text output |
| **Live Speaker Identification** | Per-chunk ECAPA-TDNN biometric identification; sliding-window majority vote; real-time WebSocket label push |
| **Post-Meeting Diarization** | WhisperX + pyannote full-file diarization; multi-tier speaker matching; cascade name propagation across all derived data |
| **Multi-Model AI Insights** | Six insight types (Summary, Decisions, Topics, Sentiment, Action Items, Participant Analysis) via Mistral + Groq; parallel agents; three-tier fallback |
| **Meeting Memory Engine** | Local 384-dim MiniLM-L6-v2 embeddings; pgvector HNSW indexes; hybrid 60/40 vector + FTS search; per-meeting memory context |
| **Workspace Knowledge Graph** | Query-time graph assembly from meetings, contexts, and tasks; BFS neighbour expansion; React Canvas visualizer |
| **Kanban Task Board** | Drag-and-drop board; AI action items auto-promoted to tasks; natural language deadline parsing; meeting context panel per task |
| **Whisper Mode** | Groq-powered live micro-recaps on a configurable schedule; manual "Catch Me Up" trigger; WebSocket push |
| **Privacy Mode** | Per-meeting pause/resume; transcription gate per audio chunk; LLM insight filtering over privacy intervals |
| **Smart Search** | Workspace-wide hybrid semantic + full-text search; matched-term highlighting; keyboard navigation |
| **Google Calendar Integration** | OAuth 2.0 sync; 15-minute cron; calendar events materialized as Kairo meetings for auto-join |
| **Analytics Dashboard** | Four-tab workspace analytics (Overview, Participants, Action Items, Insights); time-range filters; multiple chart types |
| **Team and Workspace Management** | Multi-workspace support; invite flow; four-role RBAC (owner, admin, member, observer); activity audit log |
| **Note-Taking** | Per-meeting user notes with full CRUD; notes embedded into memory for hybrid search |
| **Meeting File Attachments** | File upload and download per meeting; stored via Supabase storage |
| **Interactive Transcript Review** | Click-to-seek playback; visual timeline with event markers; speaker-attributed entries; identification badges |
| **Auto Follow-Up Reminders** | Cron-driven deadline reminders; configurable advance intervals; quiet-hours enforcement; deduplication |

---

## Feature Reference

### Auto-Join, Capture, and Transcription

The bot manages the full meeting lifecycle (`scheduled → in-progress → completed`) with duplicate-join protection and clean process teardown. Audio is captured via virtual routing into ~3-second chunks and transcribed immediately by WhisperX (`small` model, CPU int8 — no GPU required). The model is preloaded at server startup to eliminate cold-start latency. Transcribed text is broadcast over WebSocket as it arrives and persisted in JSON, plain text, and SRT formats.

### Speaker Diarization and Identification

Resolution happens in three distinct stages:

**Voice Enrollment**
- Users record a 15–30 second sample; SNR is validated before enrollment is accepted
- A 192-dimensional ECAPA-TDNN embedding (SpeechBrain `spkrec-ecapa-voxceleb`, VoxCeleb-trained) is stored per user
- Consent is tracked independently; a 256-dim pyannote ResNet34 fallback is available if SpeechBrain is unavailable

**Live Identification (per ~3s chunk)**
- A persistent warm Python encoder process embeds each audio chunk (adaptive 35s cold-start, 10s subsequent; exponential-backoff restart on failure)
- Cosine similarity at `threshold=0.55` against all enrolled workspace members; a sliding-window majority vote (`WINDOW=4`, `MIN_VOTES=2`) prevents label flicker
- Confirmed identity is pushed to all connected clients over WebSocket in real time

**Post-Meeting Identification**
- Full recording is re-diarized with WhisperX + pyannote to produce stable `SPEAKER_XX` labels
- A multi-tier matching engine resolves labels to real names:

| Tier | Method | Threshold |
|---|---|---|
| 1 | Biometric cosine similarity | 0.65 |
| 3 | Historical speaker identity maps | — |
| 4 | Manual assignment via transcript UI | — |

- Resolved names cascade-propagate across the transcript, insights, action items, and memory embeddings before AI processing begins
- Per-entry badges (Biometric, Manual, Historical) indicate how each speaker was resolved; manual assignments are preserved unless a higher-confidence biometric match supersedes them

### AI Insights Engine

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

### Meeting Memory Engine

- Transcripts are sentence-chunked and embedded as 384-dim vectors using a locally-running all-MiniLM-L6-v2 model — no external embedding API, no per-token cost
- Summaries, notes, and confirmed action items are embedded as separate content types
- A structured `meeting_memory_contexts` row is persisted per meeting: topics, decisions, action-item summaries, participant list, prose context, and a summary embedding
- HNSW indexes on vector columns support fast approximate nearest-neighbor retrieval at scale
- Related meetings are ranked by cosine similarity on summary embeddings; explicit relationship rows are preferred when available, with on-demand similarity as fallback

### Workspace Knowledge Graph

- Graph is assembled at query time from meetings, memory contexts, action items, and tasks — no separate graph tables; a 60-second in-process TTL cache avoids redundant DB builds
- Nodes: meetings, memory contexts, tasks — Edges: semantic and causal relationships
- BFS neighbour expansion lets any node be explored to configurable depth via a dedicated API endpoint
- Semantic search results are mapped to real graph node IDs, focusing and dimming matching nodes in the visualizer

### Kanban Task Board

- Three default columns (To-Do, In-Progress, Done); custom columns manageable by owner/admin
- AI-extracted action items are auto-promoted to tasks with:
  - Natural language deadline parsing ("next Friday", "in 2 days", ISO dates)
  - Auto-classified priority from urgency keywords in the action item text
- Full CRUD with assignee, due date, color-coded tags, and multi-axis filtering (assignee, tag, priority, due date)
- **Meeting Context panel** — each task born from an action item surfaces its originating meeting's summary, transcript snippet, and decisions inline
- **Task Mention Detection** — fires a live WebSocket notification when a linked task's title is detected in the active transcript

### Whisper Mode (Live Micro-Recaps)

- Groq `llama-3.1-8b-instant` generates 2–3 sentence recaps from recent transcript chunks on a configurable cron schedule
- A manual "Catch Me Up" trigger bypasses the interval and returns the latest recap immediately
- Recaps are broadcast over WebSocket and displayed in a timestamped chat-style history panel
- No recap is generated over an active privacy interval

### Privacy Mode

- Toggled per meeting; each toggle appends a `{ start, end }` interval to the meeting's metadata in PostgreSQL
- Audio chunk processing is gated per chunk — chunks arriving during a privacy interval are silently dropped
- All LLM insight generation loads the interval list and filters matching utterances before sending any data to an external API
- A top-bar badge and status indicator reflect the current state; system messages appear inline in the transcript

### Smart Search

- Hybrid retrieval: vector cosine similarity + PostgreSQL `plainto_tsquery` FTS, blended 60/40
- Falls back to pure vector search if the FTS leg fails (e.g. on special-character queries)
- Matched terms are extracted server-side (stop-words stripped) and returned alongside results for `<mark>` highlighting in snippets
- Results are deduplicated to one best match per meeting; keyboard navigation (↑↓ Enter ESC) and 500ms input debounce

### Google Calendar Integration

- Full Google OAuth 2.0 flow; tokens stored per-user in a `CalendarConnection` record
- A 15-minute cron syncs calendar events, upserting eligible entries as Kairo `Meeting` rows with deduplication by stable calendar UID
- Synced meetings participate in the same auto-join and lifecycle flows as natively created meetings
- Gated by `ENABLE_CALENDAR_INTEGRATION=true`; routes and cron job do not mount when the flag is absent

### Analytics Dashboard

Four tabs, all sourced from live backend data:

| Tab | Content |
|---|---|
| Overview | Meeting frequency, total duration, participation trends over time |
| Participants | Per-user speaking time, engagement scores, meeting attendance |
| Action Items | Completion rates, open vs closed counts, assignee distribution |
| Insights | Topic frequency, sentiment trends, decision volume |

- Time-range filters; bar, line, and pie chart types; natural language analytics chat interface

### Team and Workspace Management

- Multi-workspace support; users can belong to multiple workspaces with independent roles
- Invite flow via email or invite code; four roles enforced on every API route and in the UI:

| Role | Permissions |
|---|---|
| Owner | Full control; delete workspace; manage all members and roles |
| Admin | Manage members; create/delete Kanban columns; full analytics |
| Member | Create meetings, tasks, and notes; view all workspace content |
| Observer | Read-only access to meetings and insights |

- Workspace activity is logged to an audit trail accessible to admins and owners

### Note-Taking, File Attachments, and Transcript Review

**Notes** — Per-meeting notes with full CRUD. Notes are embedded into the memory engine, making their content discoverable via hybrid search.

**File Attachments** — Files can be uploaded to any meeting and are stored via Supabase. Download and delete operations are scoped to workspace members.

**Interactive Transcript Review** — The post-meeting transcript supports click-to-seek audio playback, a visual timeline with event markers, and speaker-attributed entries with per-entry identification badges. Any unresolved speaker label exposes a manual assignment control inline.

### Auto Follow-Up Reminders

- Default intervals: 24h and 1h before deadline; fully configurable per user
- A quiet-hours window prevents dispatches outside working hours — handles both daytime (e.g. 09:00–18:00) and overnight (e.g. 22:00–07:00) ranges correctly
- A `SentReminder` deduplication table prevents repeated notifications for the same deadline
- In-app notification delivery; email and push channels are groundwork for future expansion

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                               │
│  React 19 · TypeScript · Vite 7 · Tailwind CSS · React Router 7         │
│  WebSocket (ws://) for live transcript, speaker updates, recaps         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTP + WebSocket
┌──────────────────────────────▼─────────────────────────────────────────┐
│                        BACKEND (Node.js)                               │
│                                                                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────┐    │
│  │ REST Routes │  │ WebSocket    │  │ Cron Jobs                   │    │
│  │ /api/*      │  │/ws/transcript│  │ meeting status · calendar   │    │
│  │ 12 routers  │  │              │  │ reminders · whisper mode    │    │ 
│  └─────────────┘  └──────────────┘  └─────────────────────────────┘    │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                       Services Layer                             │  │
│  │  TranscriptionService · AIInsightsService · SpeakerMatchingEngine│  │
│  │  MeetingEmbeddingService · MemoryGraphAssemblyService            │  │
│  │  MicroSummaryService · PrivacyModeService · TaskCreationService  │  │
│  │  EmbeddingService (@xenova/transformers, all-MiniLM-L6-v2)       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Python Subprocess Layer (child_process.spawn)                  │   │
│  │  ┌─────────────────┐  ┌──────────────────────────────────────┐  │   │
│  │  │ EmbeddingServer │  │ AI Agents (ai-layer/agents/)         │  │   │
│  │  │ (--server mode) │  │ summary · decisions · topics         │  │   │
│  │  │ ECAPA-TDNN 192d │  │sentiment · action-items · participants  │   │
│  │  └─────────────────┘  └──────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │ transcribe-whisper.py (WhisperX · pyannote diarization)  │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ Prisma · pg · pgvector
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        PostgreSQL + pgvector                            │
│  HNSW indexes on vector(384) and vector(192) columns                    │
│  Hybrid FTS (plainto_tsquery) + cosine similarity search                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.x | Static typing |
| Vite | 7 | Build tool and dev server |
| React Router DOM | 7 | Client-side routing |
| Tailwind CSS | 3 | Utility-first styling |
| PostCSS + Autoprefixer | — | CSS processing |
| lucide-react | — | Icon library |
| react-markdown | — | Markdown rendering in AI insights |
| `@vvo/tzdb` | — | Timezone database |
| ESLint 9 + TypeScript ESLint | — | Linting |

### Backend

| Technology | Version | Role |
|---|---|---|
| Node.js | 18+ | Runtime |
| Express | 4 | HTTP framework |
| Prisma | 6 | ORM and schema management |
| PostgreSQL | 14+ | Primary database |
| pgvector | — | Vector similarity extension |
| `pg` | — | Raw SQL pool for legacy paths |
| `ws` | — | WebSocket server |
| jsonwebtoken | — | JWT authentication |
| bcrypt | — | Password hashing |
| node-cron | — | Scheduled jobs |
| multer | — | File upload handling |
| `@xenova/transformers` | — | Local MiniLM-L6-v2 inference (384-dim) |
| `@ffmpeg-installer/ffmpeg` | — | Audio processing |
| `@ffprobe-installer/ffprobe` | — | Audio inspection |
| puppeteer-extra + stealth | — | Headless meeting bot |
| chrono-node | — | Natural language deadline parsing |
| googleapis | — | Google Calendar OAuth and API |
| `@supabase/supabase-js` | — | Supabase storage client |
| uuid | — | ID generation |
| dotenv | — | Environment variable loading |

### AI / Python Layer

| Technology | Role |
|---|---|
| faster-whisper / WhisperX | Real-time and post-meeting ASR (`small` model, CPU int8) |
| pyannote.audio | Post-meeting speaker diarization pipeline |
| SpeechBrain ECAPA-TDNN (`spkrec-ecapa-voxceleb`) | 192-dim voice embeddings for speaker identification |
| ctranslate2 | CTranslate2 inference engine (faster-whisper backend) |
| onnxruntime | ONNX model inference |
| torchaudio | Audio tensor processing |
| huggingface-hub | Model download and caching |
| Mistral AI SDK | `mistral-small-latest` for meeting summarization |
| Groq API | `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` for insights and recaps |

### External Services

| Service | Purpose |
|---|---|
| Mistral AI | Primary LLM for meeting summarization |
| Groq | Fast inference for decisions, topics, sentiment, action items, participant analysis, Whisper Mode recaps |
| Google OAuth 2.0 | Calendar integration authentication |
| Supabase | Hosted PostgreSQL (with pgvector) and storage |

### Infrastructure

| Component | Technology |
|---|---|
| Database | PostgreSQL 14+ with `pgvector` extension and HNSW indexes |
| ORM / migrations | Prisma 6 with versioned migration files |
| Vector search | pgvector cosine similarity (`<=>`) + HNSW indexes on `vector(384)` and `vector(192)` |
| Full-text search | PostgreSQL `plainto_tsquery('english', ...)` |
| Meeting file storage | Local filesystem under `backend/data/meetings/` (Docker volume in production) |
| WebSocket | `ws` library; single `/ws/transcript` endpoint; per-meeting room broadcasts |

---

## Database Schema

Kairo's schema is managed via Prisma 6 with the `pgvector` extension. Models are grouped across five domains:

- **Users and workspaces** — `User`, `UserSession`, `UserPreferences`, `NotificationSettings`, `ReminderPreferences`, `Workspace`, `WorkspaceMember`, `WorkspaceInvite`, `WorkspaceLog`
- **Meetings** — `Meeting` (status lifecycle, privacy intervals, calendar source in `metadata` JSON), `MeetingParticipant`, `MeetingNote`, `MeetingFile`
- **AI outputs** — `ActionItem` (FK to `Task`), `AiInsight` (one row per insight type, JSON content, confidence score)
- **Speaker identity** — `UserVoiceEmbedding` (`vector(192)`, ECAPA-TDNN), `SpeakerIdentityMap` (label → resolved name with tier metadata)
- **Memory and graph** — `MeetingEmbedding` (`vector(384)`, chunked by content type), `MeetingMemoryContext` (structured context + `summaryEmbedding vector(384)`), `MeetingRelationship`
- **Tasks** — `KanbanColumn`, `Task` (optional FK to `ActionItem`), `Tag`, `TaskTag`, `SentReminder`, `CalendarConnection`

HNSW indexes are applied to all three vector columns (`meeting_embeddings.embedding`, `meeting_memory_contexts.summary_embedding`, `user_voice_embeddings.embedding`) via versioned Prisma migrations.

---

## Project Structure

```
Kairo-webapp/
│
├── frontend/                   # React 19 + TypeScript SPA (Vite 7)
│   └── src/
│       ├── pages/              # 22 route-level page components (workspace, meetings, user)
│       ├── components/         # ~88 components (transcript, graph, kanban, analytics, layout)
│       ├── hooks/              # 12 custom hooks (transcription, speaker ID, memory, etc.)
│       ├── services/api.ts     # Typed API client covering all endpoints
│       └── context/            # UserContext, ToastContext, ThemeProvider
│
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── server.js           # Entry point — routes, crons, WebSocket
│   │   ├── routes/             # 12 route files
│   │   ├── services/           # 30+ services (transcription, AI insights, embeddings, graph, tasks, etc.)
│   │   ├── middleware/         # JWT auth, validation, CORS
│   │   └── jobs/               # Cron job implementations
│   ├── prisma/                 # Schema (pgvector) + versioned migrations
│   ├── data/meetings/          # Per-meeting audio chunks and transcript files
│   ├── tests/                  # Mocha/Chai test suites (15 files)
│   └── scripts/                # DB seeding and vector maintenance
│
├── ai-layer/                   # Python ML processes
│   ├── agents/                 # Six insight agents (summary, decisions, topics, etc.)
│   └── whisperX/               # WhisperX ASR + diarization scripts
│
├── requirements.txt            # Python dependencies (ML stack)
└── .env.example                # Annotated environment variable template
```

---

## Setup and Installation

### Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher
- **Python** 3.9–3.11 (for the AI layer)
- **PostgreSQL** 14+ with the `pgvector` extension installed
- **ffmpeg** (system-level, for audio processing; `@ffmpeg-installer/ffmpeg` provides a fallback)

Verify installations:

```bash
node -v
python --version
psql --version
```

### 1. Clone the Repository

```bash
git clone https://github.com/Areen-Zainab/Kairo-webapp
cd Kairo-webapp
```

### 2. Install Python Dependencies

From the repository root:

```bash
pip install -r requirements.txt
```

This installs faster-whisper, WhisperX dependencies, pyannote.audio, SpeechBrain, ctranslate2, onnxruntime, torchaudio, and supporting libraries.

### 3. Configure Environment Variables

Copy the backend example file and populate all required values:

```bash
cp backend/env.example .env
```

Edit `.env` at the repository root (the backend loads it from `../../.env` relative to `backend/src/`). Refer to the [Environment Variables](#environment-variables) section for all required keys.

### 4. Set Up the Database

Ensure your PostgreSQL instance has the `pgvector` extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Run Prisma migrations to create all tables and HNSW vector indexes:

```bash
cd backend
npx prisma migrate deploy
```

Optionally seed initial data:

```bash
npm run seed
```

### 5. Install Backend Dependencies

```bash
cd backend
npm install
```

### 6. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 7. Start the Backend

```bash
cd backend
npm run dev
```

The server starts on port `5000` by default. On startup:
- WhisperX model is preloaded (`ModelPreloader.js`)
- WebSocket server is initialized on `/ws/transcript`
- Cron jobs are registered (meeting status, reminders, calendar sync if enabled, Whisper Mode if enabled)

### 8. Start the Frontend

```bash
cd frontend
npm run dev
```

The development server starts on [http://localhost:5173](http://localhost:5173).

### Production Build

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`. Serve statically or deploy to a CDN/edge host. The backend can be deployed independently to any Node.js host that supports persistent processes (required for the embedded Python encoder and Puppeteer bot).

**Critical production requirement:** The WebSocket endpoint (`/ws/transcript`) must be proxied to the same backend host as the REST API. Ensure your reverse proxy or load balancer forwards WebSocket upgrade headers correctly.

---

## Environment Variables

Copy `.env.example` from the repository root to `.env` and fill in all values. The backend loads `.env` from the repository root; the frontend reads `VITE_`-prefixed variables from `frontend/.env`.

```bash
cp .env.example .env
```

The `.env.example` file is fully annotated and covers all required and optional variables, organized into the following groups:

- **Server** — `PORT`, `FRONTEND_URL`
- **Database** — `DATABASE_URL` (PostgreSQL + pgvector)
- **Authentication** — `JWT_SECRET`
- **AI / LLM** — `GROQ_API_KEY`, `GROQ_API_KEY_2`, `MISTRAL_API_KEY`, `HF_TOKEN`
- **Supabase** — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Google Calendar** — `ENABLE_CALENDAR_INTEGRATION`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **Whisper Mode** — `WHISPER_MODE_ENABLED` and all Groq generation tuning parameters
- **Speaker Identification** — `LIVE_SPEAKER_ID_ENABLED`
- **Task Mentions** — `TASK_MENTION_WS_THROTTLE_MS`
- **File Storage** — `MEETINGS_DATA_DIR`
- **Frontend** — `VITE_API_URL` (in `frontend/.env`)

---

## API Reference

The complete REST and WebSocket API reference — including all endpoint signatures, request/response schemas, authentication requirements, error codes, and WebSocket event payloads — is documented in `Documentation/API_REFERENCE.md`.

The API covers 12 REST route groups (authentication, workspaces, meetings, transcripts, AI insights, action items, tasks/Kanban, memory/knowledge graph, speakers/voice enrollment, notifications, reminders, calendar integration) and a single WebSocket endpoint at `/ws/transcript` serving six real-time event types.

---

## Real-Time Infrastructure

Kairo uses a single WebSocket connection per client, established at `/ws/transcript`. The server routes messages to per-meeting rooms. Event types:

| Event | Direction | Description |
|---|---|---|
| `transcript` | Server → Client | Live transcript chunk (text, speaker, timestamp) |
| `live_speaker_update` | Server → Client | Speaker label patch for a chunk index |
| `speaker_identified` | Server → Client | Post-meeting speaker identification complete |
| `whisper_recap` | Server → Client | Whisper Mode micro-recap text |
| `task_mention` | Server → Client | Task title detected in live transcript |
| `meeting_status` | Server → Client | Meeting lifecycle state change |

The `useLiveTranscript.ts` hook maintains a **pending override map** to handle the race condition where a `live_speaker_update` event arrives before the corresponding `transcript` chunk — the override is stored and applied when the chunk arrives.

---

## AI Pipeline

### Post-Meeting Processing Sequence

```
1. Meeting ends → TranscriptionService.finalize()
2. transcribe-whisper.py --diarize → transcript_diarized.json (SPEAKER_00, ...)
3. SpeakerMatchingEngine.runForMeeting()
   ├── Tier 1: biometric cosine similarity (threshold 0.72)
   ├── Tier 3: historical speaker_identity_maps
   └── cascadeNameUpdate() → rewrites transcript + downstream tables
4. AIInsightsService.generateInsights()
   ├── Parallel: Decisions, Topics, Sentiment, Action Items agents
   ├── Concurrent: Participant Analysis agent
   └── Final: Summary Agent (with aggregated agent context)
5. ActionItemService → auto-creates Tasks (with chrono-node deadline parsing)
6. MeetingEmbeddingService.embedTranscript() → meeting_embeddings (384-dim chunks)
7. MeetingEmbeddingService.generateMemoryContext() → meeting_memory_contexts
```

### Live Meeting Data Flow

```
Audio capture (3s chunks)
    ↓
TranscriptionService → WhisperX (Python subprocess) → transcript text
    ↓                       ↓
WebSocket broadcast    setImmediate → LiveSpeakerIdentifier.identifyChunk()
(transcript event)          ↓
                    EmbeddingServerProcess (warm Python encoder)
                    192-dim ECAPA-TDNN embedding
                          ↓
                    cosine similarity vs enrolled users
                    sliding window majority vote (WINDOW=4)
                          ↓
                    WebSocket broadcast (live_speaker_update)
                          ↓
                    useLiveTranscript.ts patches speaker label
```

---

## Security and Access Control

### Authentication

- All API routes (except `/api/auth/signup`, `/api/auth/login`) require a valid JWT Bearer token
- `authenticateToken` middleware in `backend/src/middleware/auth.js` verifies the token against `JWT_SECRET` and loads the user via the model layer
- Sessions are tracked in `UserSession`; logout invalidates the record

### Role-Based Access Control

Workspace operations enforce a four-tier role hierarchy:

| Role | Permissions |
|---|---|
| **owner** | Full control; delete workspace; manage all members and roles |
| **admin** | Manage members; create/delete Kanban columns; access analytics |
| **member** | Join meetings; create tasks; view all workspace content |
| **observer** | Read-only access to meetings and insights |

Role checks are enforced in middleware on all workspace-scoped routes and in frontend conditional rendering.

### Data Privacy

- Privacy Mode drops audio chunks at the transcription layer and filters utterances at the AI insights layer — privacy-window content is never sent to any LLM
- Biometric voice embeddings are stored only with explicit user consent (`consent_given_at` field); `DELETE /api/speakers/consent` allows withdrawal
- Speaker identity mappings are scoped to the workspace; cross-workspace data access is prevented by workspace membership checks on all memory and graph endpoints
- Diarized JSON payloads are access-controlled to prevent path traversal

---

## Testing

Backend tests use **Mocha** (runner), **Chai** (assertions), **Sinon** (stubs/spies/sandboxes), and **Proxyquire** (module-level dependency injection).

```bash
cd backend
npm test
```

There are 15 test files covering: JWT authentication middleware, `TranscriptionService` pure functions (text cleaning, SRT formatting, speaker assignment, statistics), `AIInsightsService`, `ActionItemService` (extraction and deduplication with real service code + stubbed Prisma), `PostMeetingProcessor` (via Proxyquire), Whisper Mode / `MicroSummaryService`, hybrid smart search and memory context, task deadline parsing and reminder quiet-hours enforcement, WebSocket room routing, notification service CRUD, meeting bot lifecycle, upload service, the 384-dim embedding pipeline, and a pgvector infrastructure verification script.

```bash
# Verify pgvector extension and HNSW indexes against the live database
npm run db:verify-vectors

# Seed the database with demo workspace, meetings, insights, and embeddings
npm run seed
```

Full test strategy, suite catalogue (with per-test assertion descriptions), patterns and conventions, coverage analysis, and guidance for writing new tests are documented in `Documentation/TESTING.md`.

---

## Common Commands

### Backend

| Command | Description |
|---|---|
| `npm run dev` | Start backend with nodemon (auto-restart on changes) |
| `npm test` | Run Mocha test suite |
| `npm run seed` | Seed the database with sample data |
| `npx prisma migrate dev` | Create and apply a new migration |
| `npx prisma migrate deploy` | Apply pending migrations (production) |
| `npx prisma studio` | Open Prisma visual database browser |

### Frontend

| Command | Description |
|---|---|
| `npm run dev` | Start Vite development server (port 5173) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

---

## License

Kairo is currently under active development. Licensing terms will be defined prior to public release.

---

*Kairo — built to make every meeting count. A product of the Kairo Team with love <3*
