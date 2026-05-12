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
| **Autonomous Meeting Capture** | Headless Puppeteer bot auto-joins Google Meet and Zoom; captures audio via virtual routing |
| **Real-Time Transcription** | WhisperX (faster-whisper backend, `small` model, CPU int8) streaming live over WebSocket |
| **Live Speaker Identification** | Per-chunk biometric identification using ECAPA-TDNN 192-dim voice embeddings; sliding-window majority vote; sub-second WebSocket push |
| **Post-Meeting Diarization** | Full-file WhisperX + pyannote `DiarizationPipeline`; multi-tier speaker matching engine; cascade name propagation |
| **Multi-Model AI Insights** | Six insight types (Summary, Decisions, Topics, Sentiment, Action Items, Participant Analysis) via Mistral + Groq; parallel agent execution |
| **Meeting Memory Engine** | 384-dim MiniLM-L6-v2 embeddings via `@xenova/transformers`; pgvector HNSW indexes; hybrid vector + FTS search |
| **Workspace Knowledge Graph** | Query-time graph assembly from meetings, memory contexts, and tasks; BFS neighbour expansion; React Canvas visualizer |
| **Kanban Task Board** | AI-extracted action items promoted to drag-and-drop tasks; deadline parsing via chrono-node; tag-based filtering |
| **Whisper Mode** | Periodic Groq-powered micro-recaps pushed over WebSocket during live meetings; "Catch Me Up" on demand |
| **Privacy Mode** | Per-meeting pause/resume toggle; transcription gate; AI insight filtering over privacy intervals |
| **Google Calendar Integration** | OAuth 2.0 sync; 15-minute cron; `Meeting` materialization for auto-join alignment |
| **Analytics Dashboard** | Four-tab workspace analytics (Overview, Participants, Action Items, Insights); real backend data; multiple chart types |
| **Smart Search** | Hybrid semantic + full-text search with `<mark>` snippet highlighting; keyboard navigation; debounced |
| **RBAC** | Four workspace roles (owner, admin, member, observer); middleware-enforced on all API routes |
| **Auto Reminders** | Cron-driven task deadline reminders; quiet-hours enforcement; configurable intervals; deduplication |

---

## Feature Reference

### Auto-Join and Audio Capture

Kairo deploys a Puppeteer-based headless bot that joins Google Meet and Zoom meetings automatically. The bot handles:

- Scheduled and on-demand join via `MeetingBot` and the `bot-join/` sub-services
- Virtual audio routing for clean audio capture
- Real-time audio chunking (approximately 3-second windows) written to `backend/data/meetings/` per meeting
- Meeting lifecycle management: `scheduled → in-progress → completed`
- Duplicate-join protection and session state tracking
- Graceful shutdown with child-process tracking and cron cleanup

### Real-Time Transcription

The transcription pipeline is built on WhisperX (faster-whisper backend):

- `ModelPreloader.js` loads the WhisperX model at server startup to eliminate cold-start latency on the first meeting
- `TranscriptionService.js` processes each audio chunk and broadcasts transcribed text over WebSocket in real time
- Each chunk is processed at `model_size=small`, `device=CPU`, `compute_type=int8` — no GPU requirement
- Transcripts are saved to disk in JSON, plain text, and SRT formats
- The live `TranscriptTab` renders speaker-attributed, timestamped entries as they arrive

### Speaker Diarization and Identification

Speaker processing is the most architecturally sophisticated component of Kairo, operating at three distinct stages:

**Voice Enrollment**
- Users record a 15–30 second voice sample during onboarding or from profile settings
- `VoiceEmbeddingService.py` extracts a 192-dimensional ECAPA-TDNN (SpeechBrain `spkrec-ecapa-voxceleb`) embedding
- Embeddings are stored in `user_voice_embeddings` via pgvector; a 256-dim pyannote ResNet34 fallback is trimmed to 192 for schema compatibility
- Consent is tracked per-user; auto-enrollment fires from `ProfileTab` when consent is present

**Live Per-Chunk Identification**
- `EmbeddingServerProcess.js` manages a persistent warm Python encoder process (adaptive 35s cold-start timeout, 10s subsequent; exponential-backoff restart)
- `LiveSpeakerIdentifier.js` loads all enrolled workspace user embeddings at meeting start
- For each ~3s audio chunk: embed → cosine similarity against enrolled profiles → sliding-window majority vote (`WINDOW=4`, `MIN_VOTES=2`) at `LIVE_THRESHOLD=0.55`
- Confirmed speaker identity is broadcast as `live_speaker_update` over WebSocket; `useLiveTranscript.ts` patches the displayed label in real time with a pending-override map for race-condition safety

**Post-Meeting Identification**
- Full recording is re-processed by `transcribe-whisper.py --diarize` using WhisperX + pyannote `DiarizationPipeline`, producing `transcript_diarized.json` with `SPEAKER_00`, `SPEAKER_01`, etc.
- `SpeakerMatchingEngine.js` runs a multi-tier resolution pipeline: Tier 1 (biometric cosine similarity at `0.72`), Tier 3 (historical `speaker_identity_maps` lookup), Tier 4 (manual UI assignment)
- `SpeakerIdentificationService.saveIdentityMapping` UPSERT preserves manual (Tier 4) assignments unless a higher-confidence biometric match supersedes
- **Cascade name propagation** rewrites resolved names across `action_items`, `ai_insights`, `meeting_memory_contexts`, `meeting_embeddings`, and on-disk `transcript_diarized.json` before AI insights generation
- Frontend displays Biometric (green), Manual (amber), and Historical (blue) identification badges per transcript entry
- `SpeakerAssignmentPopover` exposes manual assignment for any unresolved speaker label (`SPEAKER_XX`, `"Speaker 1"`, `"Unknown"`, etc.)

### AI Insights Engine

Six insight types are generated post-meeting via a parallel multi-model Python agent architecture orchestrated from Node.js:

| Insight Type | Model | Justification |
|---|---|---|
| Summary | Mistral `mistral-small-latest` | 32k context window; layered format output (executive summary, narrative, bullet points) in a single prompt |
| Decisions | Groq `llama-3.3-70b-versatile` | Schema-stable JSON; 128k context; fast inference via Groq |
| Topic Segmentation | Groq `llama-3.3-70b-versatile` | Deep contextual grouping across long transcripts |
| Sentiment Analysis | Groq `llama-3.3-70b-versatile` | Per-speaker sentiment with impact classification (High/Medium/Low) |
| Action Items | Groq `llama-3.1-8b-instant` | Pattern-matching task; 8B model minimizes latency and cost |
| Participant Analysis | Groq `llama-3.3-70b-versatile` | Multi-speaker diarized JSON analysis; engagement and contribution metrics |

**Execution flow:** text-based agents (Decisions, Action Items, Topics, Sentiment) run in parallel; Participant Analysis runs concurrently once diarized JSON is parsed; Summary Agent runs last with aggregated context outputs (`AGENT_CONTEXT` env) from all prior agents to ensure coherence and prevent contradiction. Total pipeline time: 30–120 seconds depending on transcript length.

**Cascading fallback tiers** ensure output under any failure: Primary LLM → Secondary/hosted LLM (HF inference, DistilBERT) → NLP heuristics (extractive tokenization, pattern matching, lexicon-based sentiment). Confidence scores are halved when falling back to signal reduced reliability in the UI.

**Privacy filtering:** utterances timestamped within active privacy intervals are removed before being sent to any LLM.

### Meeting Memory Engine

Every completed meeting is embedded into a semantic vector store:

- `EmbeddingService.js` runs `@xenova/transformers` with **all-MiniLM-L6-v2** (384-dimensional) locally — no external embedding API, no per-token billing
- Transcripts are chunked with sentence-aware splitting and stored as rows in `meeting_embeddings` (content type `transcript`)
- AI-derived summaries are embedded as type `summary`
- Notes and confirmed action items are embedded during reprocess cycles (types `note`, `action_item`)
- `MeetingEmbeddingService.generateMemoryContext()` upserts `meeting_memory_contexts` with structured JSON (topics, decisions, action-item summaries, participants, prose context) and a `vector(384)` summary embedding
- HNSW indexes on vector columns (PostgreSQL pgvector extension) enable fast approximate nearest-neighbor search at scale
- `MeetingEmbeddingService.hybridSearchWorkspaceMeetings()` merges cosine similarity and `plainto_tsquery` full-text search with a 60/40 weighted blend; falls back to pure vector search if FTS fails
- `MemoryContextService.findRelatedMeetings()` prefers explicit `meeting_relationships` rows with on-demand fallback to summary embedding similarity

### Workspace Knowledge Graph

The knowledge graph turns accumulated meeting memory into a navigable visual structure:

- `MemoryGraphAssemblyService.js` builds `nodes` and `edges` at query time from `meeting_memory_contexts`, `meetings`, `action_items`, and `meeting_embeddings`
- A 60-second in-process TTL cache ensures the `/graph` and `/graph/stats` endpoints share a single DB build per window
- `getNodeNeighbours(workspaceId, nodeId, depth)` performs BFS subgraph expansion via the `/memory/graph/node/:nodeId/neighbours` endpoint
- `useGraphData.ts` fetches the full workspace graph; `useQueryMemory.ts` maps semantic search results to real graph node IDs for node focus/dim behavior
- `GraphCanvas.tsx` renders the graph using React Canvas; `ContextPanel` surfaces per-node meeting metadata
- All graph endpoints require active workspace membership (JWT + Prisma workspace role check)

### Kanban Task Board

- Full workspace Kanban with three default columns (To-Do, In-Progress, Complete) and custom column management (owner/admin)
- Drag-and-drop across columns persists immediately to the backend
- `TaskCreationService.parseDeadline()` uses `chrono-node` to extract deadlines from natural language strings ("next Friday", "in 2 days") in AI-generated action items
- `_extractPriority()` auto-classifies task priority from action item text
- Full task CRUD: title, description, assignee, due date, tags with color coding; inline editing via `TaskDetailModal`
- Tag-based, assignee, priority, and due-date filtering
- **Task Meeting Context:** `TaskContextService.getTaskMeetingContext()` surfaces the originating meeting's summary, transcript snippet, decisions, and notes inside `TaskDetailModal` as a collapsible context section
- **Task Mention Detection:** `TaskMentionService` + `broadcastTaskMention` + `useMeetingTaskMention` detect when a linked task's title appears in the live transcript and broadcast a WebSocket notification

### Whisper Mode (Live Micro-Recaps)

- `MicroSummaryService.js` generates 2–3 sentence contextual recaps from live transcript chunks via Groq `llama-3.1-8b-instant`
- `runWhisperMode.js` cron triggers recap generation at configurable intervals (`WHISPER_MODE_ENABLED` feature flag)
- `POST /api/meetings/:id/whisper/trigger` allows a manual trigger bypassing the interval
- Recaps are broadcast over WebSocket as `whisper_recap` events
- `useWhisperRecaps.ts` manages REST initial load + WebSocket subscription
- `WhisperRecapTab.tsx` displays a chat-style timestamped recap history
- "Catch Me Up" button in the live meeting top bar requests the latest recap immediately; respects privacy mode state

### Privacy Mode

- Per-meeting toggle accessible from the Kairo Bot dropdown during a live meeting
- `PrivacyModeService.js` maintains an in-memory state cache backed by `meeting.metadata.privacyMode` in PostgreSQL; appends `{ start, end }` intervals on every toggle
- `TranscriptionService.js` checks `PrivacyModeService.isEnabled()` before processing each audio chunk; drops chunks silently when active
- `AudioRecorder.js` also gates recording on privacy state
- AI insights generation loads all privacy intervals and filters utterances before any LLM call
- Frontend shows a "Privacy Mode ON" top-bar badge, an orange status dot, and privacy system messages in `TranscriptTab`

### Smart Search

- `SmartSearchModal.tsx` provides a workspace-wide semantic search interface
- Backed by `MeetingEmbeddingService.hybridSearchWorkspaceMeetings()`: vector cosine similarity + PostgreSQL FTS merged at 60/40
- Backend extracts `matchedTerms[]` (stop-words stripped); frontend `HighlightedSnippet` component renders `<mark>` tags in result snippets
- Results are deduplicated to one best match per meeting, grouped with snippet previews
- Keyboard navigation (↑↓ Enter ESC); 500ms debounce on input

### Google Calendar Integration

- Full Google OAuth 2.0 flow: `/api/calendar/oauth/google/start` → Google consent → `/api/calendar/oauth/google/callback`
- `CalendarConnection` Prisma model stores encrypted tokens, `calendarId`, and sync timestamps
- `calendarSync.js` lists Google Calendar events and upserts eligible entries as Kairo `Meeting` rows with `meetingSource: 'google-calendar'` and dedup metadata
- A 15-minute cron (`syncCalendars.js`) keeps calendar state current
- `CalendarStep.tsx` (onboarding) and `CalendarSettings.tsx` (profile) provide connect/disconnect/sync-now UI
- Entire feature gated by `ENABLE_CALENDAR_INTEGRATION=true` environment variable

### Analytics Dashboard

- Four tabs: **Overview** (meeting frequency, duration, participation trends), **Participants** (per-user engagement metrics), **Action Items** (completion rates, assignee distribution), **Insights** (topic frequencies, sentiment trends)
- All data sourced from real backend endpoints; time-range filters; multiple chart types (bar, line, pie)
- `AnalyticsChat` component for workspace analytics Q&A

### Auto Follow-Up Reminders

- `ReminderService.js` schedules reminders at configurable intervals before task deadlines (default: 24h and 1h)
- `checkTaskReminders.js` cron runs every 15 minutes
- Deduplication via `SentReminder` table prevents repeated dispatches
- `_isInQuietHours(start, end)` correctly handles both daytime (09:00–18:00) and overnight (22:00–07:00) quiet windows
- User-configurable preferences via `GET/PUT /api/reminders/preferences`
- In-app notification delivery through `NotificationService.js`

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                               │
│  React 19 · TypeScript · Vite 7 · Tailwind CSS · React Router 7        │
│  WebSocket (ws://) for live transcript, speaker updates, recaps         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTP + WebSocket
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        BACKEND (Node.js)                                │
│  Express 4 · CommonJS · JWT Auth · node-cron                            │
│                                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────┐   │
│  │ REST Routes │  │ WebSocket    │  │ Cron Jobs                   │   │
│  │ /api/*      │  │ /ws/transcript│  │ meeting status · calendar   │   │
│  │ 12 routers  │  │              │  │ reminders · whisper mode    │   │
│  └─────────────┘  └──────────────┘  └─────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                       Services Layer                             │  │
│  │  TranscriptionService · AIInsightsService · SpeakerMatchingEngine│  │
│  │  MeetingEmbeddingService · MemoryGraphAssemblyService            │  │
│  │  MicroSummaryService · PrivacyModeService · TaskCreationService  │  │
│  │  EmbeddingService (@xenova/transformers, all-MiniLM-L6-v2)       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Python Subprocess Layer (child_process.spawn)                  │   │
│  │  ┌─────────────────┐  ┌──────────────────────────────────────┐ │   │
│  │  │ EmbeddingServer  │  │ AI Agents (ai-layer/agents/)         │ │   │
│  │  │ (--server mode)  │  │ summary · decisions · topics         │ │   │
│  │  │ ECAPA-TDNN 192d  │  │ sentiment · action-items · participants│ │   │
│  │  └─────────────────┘  └──────────────────────────────────────┘ │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │ transcribe-whisper.py (WhisperX · pyannote diarization)  │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ Prisma · pg · pgvector
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        PostgreSQL + pgvector                            │
│  HNSW indexes on vector(384) and vector(192) columns                   │
│  Hybrid FTS (plainto_tsquery) + cosine similarity search                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

- **AI as subprocess, not microservice:** Python ML processes are spawned by Node.js via `child_process.spawn`. The embedding encoder runs in persistent `--server` mode (stdin/stdout JSON protocol) to keep ECAPA-TDNN warm across all meetings, reducing per-chunk overhead to near-zero after cold start.
- **No graph persistence:** The workspace knowledge graph is assembled at query time from existing relational tables with a 60-second in-process cache. This avoids schema duplication while keeping read latency acceptable for current workspace sizes.
- **Embedding locality:** All text embeddings (384-dim MiniLM) run locally via `@xenova/transformers` — zero external API calls, zero per-token cost, deterministic behavior.
- **Feature flags:** Calendar integration (`ENABLE_CALENDAR_INTEGRATION`) and Whisper Mode (`WHISPER_MODE_ENABLED`) are independently gated; their cron jobs and route mounts are conditional.
- **Graceful shutdown:** `server.js` stops all crons, releases the transcription model, terminates tracked child processes, and disconnects Prisma on SIGTERM/SIGINT.

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

Kairo's schema is managed via Prisma with the `pgvector` preview feature. Key models:

| Model | Purpose |
|---|---|
| `User` | Account with bcrypt password, profile, biometric consent, `audioSampleUrl` |
| `UserSession` | JWT session records |
| `UserPreferences` | Per-user app preferences |
| `NotificationSettings` | Granular notification toggles |
| `ReminderPreferences` | Quiet hours, advance intervals |
| `Workspace` | Organizational unit; owned by a user |
| `WorkspaceMember` | Junction: user ↔ workspace with role (owner/admin/member/observer) |
| `WorkspaceInvite` | Pending invitations |
| `WorkspaceLog` | Audit trail for workspace events |
| `Meeting` | Core entity; status lifecycle, `metadata` JSON (privacy intervals, calendar uid), `meetingSource` |
| `MeetingParticipant` | Participants per meeting |
| `MeetingNote` | User-authored notes per meeting |
| `MeetingFile` | Uploaded attachments per meeting |
| `ActionItem` | AI-extracted action items with confidence score; FK to `Task` |
| `AiInsight` | One row per insight type per meeting; `content` as JSON; `confidence_score` |
| `UserVoiceEmbedding` | `vector(192)` ECAPA-TDNN voice fingerprint per enrolled user |
| `SpeakerIdentityMap` | Per-meeting speaker label → resolved user name mapping with tier metadata |
| `MeetingEmbedding` | `vector(384)` per text chunk; keyed by `meetingId`, `contentType`, `chunkIndex` |
| `MeetingMemoryContext` | Structured memory context per meeting; `summaryEmbedding vector(384)` |
| `MeetingRelationship` | Explicit meeting-to-meeting semantic edges (optional; fallback to similarity) |
| `KanbanColumn` | Workspace Kanban columns |
| `Task` | Kanban task; optional FK to `ActionItem`; deadline, priority, assignee, tags |
| `Tag` | Workspace-scoped color-coded tags |
| `TaskTag` | Junction: task ↔ tag |
| `SentReminder` | Deduplication log for dispatched reminders |
| `CalendarConnection` | Google Calendar OAuth token store per user |

**Vector indexes** (HNSW via pgvector migration):
- `meeting_embeddings.embedding vector(384)` — transcript and summary chunk search
- `meeting_memory_contexts.summary_embedding vector(384)` — related-meeting similarity
- `user_voice_embeddings.embedding vector(192)` — speaker identification cosine search

---

## Project Structure

```
Kairo-webapp/
│
├── frontend/                          # React 19 + TypeScript SPA (Vite 7)
│   ├── src/
│   │   ├── pages/                     # 22 route-level page components
│   │   │   ├── workspace/             # MemoryView, Analytics, TaskBoard, Settings
│   │   │   ├── meetings/              # MeetingsMain, MeetingLive, MeetingDetails, PreMeeting
│   │   │   └── user/                  # Dashboard, MyCalendar, MyTasks, Notifications
│   │   ├── components/                # ~88 components
│   │   │   ├── meetings/              # Transcript, AI insights, speaker assignment, files
│   │   │   ├── workspace/
│   │   │   │   ├── memory/            # GraphCanvas, ContextPanel, MemoryQueryBar
│   │   │   │   ├── tasks/             # KanbanBoard, TaskCard, TaskFilters
│   │   │   │   └── analytics/         # Chart components, FiltersSidebar, AnalyticsChat
│   │   │   ├── layout/                # Navbar, Sidebar, ThemeToggle
│   │   │   └── ui/                    # Toast, UserAvatar, SmartSearchModal
│   │   ├── hooks/                     # 12 custom hooks (transcription, speaker, memory, etc.)
│   │   ├── context/                   # UserContext, ToastContext
│   │   ├── services/api.ts            # Typed API client (~all endpoints)
│   │   ├── modals/                    # TaskDetailModal, workspace modals
│   │   └── theme/ThemeProvider.tsx    # Light/dark theme
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                           # Node.js + Express API
│   ├── src/
│   │   ├── server.js                  # Entry point; mounts routes, crons, WebSocket
│   │   ├── routes/                    # 12 route files (auth, workspaces, meetings, memory, etc.)
│   │   ├── controllers/               # Route handler logic
│   │   ├── services/                  # Business logic (30+ services)
│   │   │   ├── TranscriptionService.js
│   │   │   ├── AIInsightsService.js
│   │   │   ├── SpeakerMatchingEngine.js
│   │   │   ├── LiveSpeakerIdentifier.js
│   │   │   ├── EmbeddingServerProcess.js
│   │   │   ├── MeetingEmbeddingService.js
│   │   │   ├── MemoryGraphAssemblyService.js
│   │   │   ├── MicroSummaryService.js
│   │   │   ├── PrivacyModeService.js
│   │   │   ├── TaskCreationService.js
│   │   │   └── ...
│   │   ├── middleware/                # auth.js (JWT), validation.js, CORS
│   │   ├── jobs/                      # Cron job implementations
│   │   ├── models/                    # Legacy model layer (User.findById etc.)
│   │   └── lib/prisma.js              # Shared Prisma singleton
│   ├── prisma/
│   │   ├── schema.prisma              # Full schema with pgvector
│   │   └── migrations/                # Versioned migration files incl. HNSW index builds
│   ├── data/meetings/                 # Per-meeting audio chunks and transcript files
│   ├── tests/                         # Mocha/Chai test suites
│   ├── scripts/                       # DB seeding, vector maintenance, migrations
│   └── package.json
│
├── ai-layer/                          # Python ML processes
│   ├── agents/                        # Six insight agents (summary, decisions, etc.)
│   ├── utils/                         # Transcript converter utilities
│   └── whisperX/                      # WhisperX transcription scripts
│       └── transcribe-whisper.py      # ASR + diarization entry point
│
├── requirements.txt                   # Python dependencies (ML stack)
└── README.md
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
