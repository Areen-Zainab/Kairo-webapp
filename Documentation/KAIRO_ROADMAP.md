# KAIRO PROJECT ROADMAP - Implementation Status & To-Do List

**Project:** Kairo - Context-Aware Meeting Intelligence Platform

---

## TABLE OF CONTENTS
1. [Executive Summary](#executive-summary)
2. [Implementation Status Overview](#implementation-status-overview)
3. [Core Features Breakdown](#core-features-breakdown)
4. [Master To-Do List](#master-to-do-list)

---

## EXECUTIVE SUMMARY

### Overall Progress: ~97% Complete

> **Last Updated:** May 10, 2026 

**Corrected Since Earlier Audits (previously mis-reported as incomplete):**
- ✅ **Quiet hours enforcement** — `ReminderService._isInQuietHours()` IS implemented and IS called on line 69 of `checkAndSendReminders()`. Handles overnight ranges (e.g. 22:00–07:00 UTC).
- ✅ **Hybrid search (pgvector + FTS)** — `MeetingEmbeddingService.hybridSearchWorkspaceMeetings()` IS implemented (lines 219–304) using `plainto_tsquery('english', ...)` + cosine similarity, merged with 60/40 weighting. `memoryController.semanticSearch` calls it.
- ✅ **Result highlighting in SmartSearchModal** — `HighlightedSnippet` component renders `<mark>` tags using `matchedTerms[]` passed from backend.
- ✅ **Privacy Mode (full stack)** — Backend: `PrivacyModeService.js`, `PATCH /api/meetings/:id/privacy-mode`, transcription gate, AI insights filter. **Frontend:** `MeetingLive.tsx` — Kairo Bot dropdown toggle (`togglePrivacyMode` → `apiService.updateMeetingPrivacyMode`), optimistic UI, top-bar “Privacy Mode ON” badge, status indicator; `TranscriptTab.tsx` shows privacy state and system messages.
- ✅ **Calendar Integration (in-scope)** — **Google Calendar** path shipped: OAuth, periodic sync, `Meeting` upserts for auto-join alignment (`ENABLE_CALENDAR_INTEGRATION`; see §15).

**Remaining Gaps (verified, non-optional product work):**
- 🔄 **Speaker diarization** —within-meeting **guest profiling** for unresolved speakers (Guest A/B + meeting-scoped embeddings) and **full streaming diarization** (windowed stable `SPEAKER_XX` on the live stream).
- ❌ **Task Contextual Micro-Channels** — 70% implemented.

**Optional / stretch (tracked separately — not required for core product completeness):**
- Third-party integrations (e.g. Jira, Slack) — UI mockups only.

---

## IMPLEMENTATION STATUS OVERVIEW

### ✅ COMPLETED FEATURES (18/21 core)

1. **Team and Workspace Management** — 100% Complete
2. **Auto-Join & Capture** — 100% Complete (Google Meet/Zoom)
3. **Real-Time Transcription (WhisperX)** — ~100% Complete (live + post speaker ID mapping)
4. **Summarization Engine** — 100% Complete
5. **Action Item Detection** — ~95% Complete (periodic live extraction + post-meeting pipeline + Kanban task creation; remaining: assignee fuzzy-match to workspace members)
6. **Role-Based Access Control (RBAC)** — 100% Complete
7. **Note-Taking** — 100% Complete
8. **Interactive Transcript Review & Timeline** — 100% Complete
9. **Analytics Dashboard** — 100% Complete
10. **Kanban Board Integration** — 100% Complete
11. **Meeting Memory Engine (Embedding Pipeline)** — 100% Complete *(embeddings auto-triggered post-insights, transcript + summary embedded, memory context generated)*
12. **Auto Follow-Up Reminders** — 100% Complete *(quiet hours enforcement confirmed)*
13. **Task Extraction and Deadline Parsing** — 100% Complete *(chrono-node integrated; ISO dates + natural language like "next Friday", "in 2 days")*
14. **Whisper Mode (Micro-Recap During Meeting)** — 100% Complete *(MicroSummaryService + cron + manual trigger + WebSocket + useWhisperRecaps + WhisperRecapTab + "Catch Me Up" button)*
15. **Smart Search & Query** — 100% Complete *(hybrid pgvector+FTS, result highlighting)*
16. **Privacy Mode (pause/resume transcription)** — 100% Complete
17. **Related Meetings + Memory Context** — 100% Complete *(MemoryContextService + findRelatedMeetings)*
18. **Calendar Integration (Google Calendar)** — 100% Complete *(OAuth, scheduled sync, `Meeting` materialization; feature-flag `ENABLE_CALENDAR_INTEGRATION`; see §15)*

### 🔄 PARTIALLY IMPLEMENTED (3/21 core)

19. **Speaker Diarization** — ~85% Complete *(**Remaining:** within-meeting **guest profiling** (unresolved speakers → Guest A/B + embeddings; see `speaker-diarization.md` Layer 8) and **full streaming diarization** (windowed live multi-speaker `SPEAKER_XX`) — see subsection **Speaker Diarization — remaining scope** in Core Features.)*
20. **Meeting Memory Graph (Knowledge Graph)** — 80% Complete *(auth guards, neighbour expansion API, real query-bar integration, in-process graph assembly reuse; optional persistent storage + click-to-expand UI pending)*
21. **Task Contextual Micro-Channels** — 70% Complete

### Stretch / beyond core 21 (not counted above)

- **Multimodal Meeting Capture** — 20% Complete (audio/video only)
- **Third-Party Tool Integrations** — 0% Complete (UI mockups exist)

---

## CORE FEATURES BREAKDOWN

---

## 🔹 CORE MEETING INTELLIGENCE

### 1. Auto-Join & Capture
**Status:** ✅ 100% COMPLETE
**Technologies:** Puppeteer, WhisperX, Node.js, WebSockets, PostgreSQL

#### ✅ What's Working:
- Bot joins Google Meet and Zoom automatically
- Audio capture via virtual audio routing
- Audio chunks saved and transcribed in real-time
- Meeting status tracking (scheduled → in-progress → completed)
- Bot session management and duplicate-join protection

---

### 2. Real-Time Transcription (WhisperX-based)
**Status:** ✅ 100% COMPLETE
**Technologies:** WhisperX, Pyannote (via WhisperX diarization path), Python, WebSocket, Node.js, pgvector, SpeechBrain ECAPA-TDNN

#### ✅ What's Working:
- WhisperX model preloaded at server startup (`ModelPreloader.js`)
- Audio chunks transcribed in real-time (`TranscriptionService.js`); WebSocket broadcasts live text to clients
- **Live speaker identification per chunk**: `LiveSpeakerIdentifier` + `EmbeddingServerProcess` (persistent warm Python encoder); each ~3s chunk is embedded, compared to enrolled workspace users via cosine similarity (threshold 0.55), majority-voted over a 4-chunk window, and broadcast as a `live_speaker_update` WebSocket event; `useLiveTranscript.ts` patches the displayed speaker label in real-time
- **Post-meeting** speaker diarization on the **complete recording**: Python `transcribe-whisper.py … --diarize` (WhisperX + `DiarizationPipeline` + `assign_word_speakers`) → **`transcript_diarized.json` / `.txt` / `.srt`** with labels like **`SPEAKER_00`**
- **Post-meeting speaker identification (names):** `SpeakerMatchingEngine` (Tier 1 voice fingerprint threshold 0.72, Tier 3 historical maps, Tier 4 manual) + `speaker_identity_maps`; runs **synchronously before AI insights** so insights use real names
- **Cascade name propagation**: resolved names overwrite `action_items`, `ai_insights`, `meeting_memory_contexts`, `meeting_embeddings`, `transcript_diarized.json`
- **Manual assignment UI**: `TranscriptPanel` + `SpeakerAssignmentPopover` + `/api/speakers/*`; IDENTIFY button shows for any unresolved speaker regardless of label format
- **Identification badges**: Biometric (green), Manual (amber), Historical (blue) visible per transcript entry
- **Manual assignment preservation**: UPSERT logic preserves tier-4 (manual) assignments unless a stronger biometric match replaces them
- Voice enrollment: `VoiceEmbeddingService.py` → `VoiceEmbeddingBridge.enrollUserVoice`; **192-dimensional** ECAPA-TDNN embeddings; auto-enrolled from ProfileTab and Onboarding when consent is present
- Transcripts saved in JSON and text formats
- **Privacy gate**: `TranscriptionService.js` checks `PrivacyModeService.isEnabled()` per chunk; drops chunk silently if privacy mode active


#### 🔄 Optional Enhancements:
- [ ] multilingual ASR
- [ ] captions synced to video tiles

---

### 2b. Speaker Diarization
**Status:** 🔄 ~85% COMPLETE — post-meeting and live enrolled-user flows are shipped; items below are the open scope.

#### ⚠️ What's Missing
- [ ] **Full streaming diarization** — windowed live multi-speaker clustering (stable `SPEAKER_XX` on the stream). Distinct from **per-chunk live display names** for enrolled users (`LiveSpeakerIdentifier`).
- [ ] **Within-meeting guest profiling** — label unresolved speakers as "Guest A", "Guest B" with their own embeddings (see `speaker-diarization.md` Layer 8).

#### 📋 Streaming diarization service path (live labels — design only)

1. **Audio path**  
   - Reuse the same captured stream the bot already writes to chunk files / optional ring buffer.  
   - Maintain a **rolling buffer** (e.g. last 15–30s, or overlapping windows every *T* seconds) in memory or on disk for a dedicated worker.

2. **Worker process**  
   - **Separate long-lived Python process** (or pool) from the per-chunk Whisper line: e.g. `StreamingDiarizationWorker` subscribed to a queue (Redis, stdin line protocol, or local IPC).  
   - Each job: window WAV/PCM + **meeting-relative time base** → run a **windowed** diarization pass (WhisperX segment + diarization on the window, or a lighter online diarization model if adopted later).  
   - Output: list of `{ startSec, endSec, speakerLabel }` for that window only.

3. **Label stability (cross-window)**  
   - **Session state** in Node or worker: map each window’s cluster id to a stable **`SPEAKER_XX`** (Hungarian matching / cosine similarity on short per-window embeddings, or incremental clustering).  
   - Expect **label permutation** across windows; do not treat raw pyannote indices as stable without reconciliation.

4. **Integration with live ASR**  
   - **Option A (lower coupling):** keep current chunk transcription; merge speaker by **time overlap** between chunk `[start,end]` and latest window diarization (same idea as `assignSpeakersToUtterances`).  
   - **Option B:** single pipeline that emits both text + speaker for a window (heavier latency).  
   - **Broadcast:** extend WebSocket `transcript` payload (or add `speaker_labels_update`) with resolved `SPEAKER_XX` + optional **display name** once `speaker_identity_maps` exists.

5. **End-of-meeting reconciliation**  
   - Run existing **full-file** `performDiarization` unchanged.  
   - Define policy: **replace** live labels in stored JSON with full-file result; or keep live as preview and mark final from `transcript_diarized.json`.  
   - Re-run or patch **`SpeakerMatchingEngine`** after final JSON is written.

6. **Privacy, load, and ops**  
   - Respect **privacy mode**: skip or blank diarization windows when enabled.  
   - Cap CPU/GPU: throttle window frequency, max concurrent meetings, feature flag per workspace.  
   - Document **HF / pyannote auth** same as batch diarization.

7. **Phased delivery**  
   - **P1:** Buffer + worker skeleton + WS field for “best-effort” speaker on live chunks.  
   - **P2:** Stable `SPEAKER_XX` mapping across windows + metrics (latency, mismatch vs final).  
   - **P3:** Tie-in to enrollment / historical ID for **live** display names (higher risk; strict consent).

---

### 3. Summarization Engine
**Status:** ✅ 100% COMPLETE
**Technologies:** Grok Cloud API (xAI), Node.js

#### ✅ What's Working:
- 6 AI insight types: Summary, Decisions, Sentiment, Topics, Action Items, Participants
- All generated asynchronously post-meeting via `AIInsightsService.js`
- Stored in DB and displayed in organized UI panels
- Confidence scores per insight type
- Privacy-aware: utterances timestamped inside privacy intervals are filtered before being sent to AI

---

### 4. Whisper Mode (Micro-Recap During Meeting)
**Status:** ✅ 100% COMPLETE *(March 26, 2026)*
**Technologies:** Groq API (llama-3.1-8b-instant), WebSocket, React, Node.js

#### ✅ What's Working:
- `MicroSummaryService.js` — Generates 2–3 sentence recaps via Groq from live transcript chunks
- `runWhisperMode.js` — Cron job, gated by `WHISPER_MODE_ENABLED`
- `POST /api/meetings/:id/whisper/trigger` — Manual trigger bypasses interval
- `WebSocketServer.broadcastWhisperRecap()` — Real-time push via `whisper_recap` WS event
- `useWhisperRecaps.ts` — React hook (REST initial load + WebSocket subscription)
- `WhisperRecapTab.tsx` — Chat-like sidebar UI with timestamped recaps
- "Catch Me Up" button in live meeting Top Bar

#### 🔄 Optional Enhancements:
- [ ] Include decisions/action items in recap text

---

## 🔹 KNOWLEDGE & MEMORY

### 5. Meeting Memory Engine
**Status:** 🔄 100% COMPLETE  
**Priority:** High  
**Technologies:** PostgreSQL (pgvector), Sentence Transformers (Xenova/all-MiniLM-L6-v2), Node.js

#### ✅ What's Working (verified in code):
- `EmbeddingService.js` — Fully implemented using `@xenova/transformers` with all-MiniLM-L6-v2 (384-dim local model)
  - `generateEmbedding(text)` — single text embedding
  - `generateBatchEmbeddings(texts[])` — batch embedding with proper reshaping
- `MeetingEmbeddingService.js` — Fully implemented:
  - `chunkText(text, maxWords)` — sentence-aware chunking
  - `embedTranscript(meetingId, transcriptText)` — chunks + stores to `meeting_embeddings` via raw pgvector SQL
  - `embedSummary(meetingId, summaryText)` — stores summary embedding
  - `generateMemoryContext(meetingId, ...)` — creates/updates `meeting_memory_contexts` with upsert
  - `searchWorkspaceMeetings(workspaceId, queryText, limit)` — cosine similarity search using `<=>` operator
  - `hybridSearchWorkspaceMeetings(workspaceId, queryText, limit)` — pgvector + `plainto_tsquery` FTS, 60/40 weighted merge *(code-verified, lines 219–304)*
  - `findRelatedMeetings(meetingId, workspaceId, limit)` — cosine similarity on `meeting_memory_contexts.summary_embedding`
- `AIInsightsService.js` — Memory Engine work is best-effort and step-isolated (embedding failures do not block memory-context creation)
- `MeetingEmbeddingService.js` — Regeneration safety: transcript/summary embedding inserts are deterministic by deleting prior rows for the meeting/content type before insert
- `MemoryContextService.js` — Implemented:
  - `getMeetingContext(meetingId)` (loads `meeting_memory_contexts` + a short transcript snippet from `meeting_embeddings`)
  - `getRelatedMeetings(meetingId, limit)` (prefers `meeting_relationships`, with on-demand fallback similarity when relationships are empty)
- `memoryRoutes.js` — Routes exist:
  - `GET /api/workspaces/:workspaceId/memory/search`
  - `GET /api/workspaces/:workspaceId/memory/meetings/:meetingId/context`
  - `GET /api/workspaces/:workspaceId/memory/meetings/:meetingId/related`
- Database tables: `meeting_embeddings`, `meeting_memory_contexts`, `meeting_relationships` (in Prisma schema)
- pgvector extension installed and HNSW indexes created

#### ⚠️ What's Missing:
- **Note + confirmed action-item vectors:** `embedMeetingNotes` / `embedConfirmedActionItems` exist and run inside `regenerateMeetingEmbeddings` (e.g. full **reprocess** in `MeetingReprocessService`). The primary `generateInsights` path currently embeds **transcript** and builds **memory context** but does not automatically call the notes/action-item embedding step on every first-time completion — product polish is to hook that into the normal pipeline (or on note save), not to add an end-user “Regenerate” control.
- `meeting_relationships` table is not populated as a persistent step; `/related` works via on-demand fallback similarity

#### 📋 Remaining To-Do:

**MEDIUM PRIORITY: (Optional)**
- [ ] Invoke note + confirmed action-item embedding as part of the default post-meeting flow (or on relevant saves), so hybrid search is complete without relying on a reprocess cycle

---

### 6. Meeting Memory Graph (Knowledge Graph)
**Status:** 🔄 80% COMPLETE *(auth guards, neighbour expansion API, real query-bar integration, short-lived in-process graph assembly reuse; optional persistent storage + click-to-expand UI pending)*
**Priority:** High
**Technologies:** PostgreSQL (adjacency lists), React Canvas

#### ✅ What's Working (code-verified):
- Backend query-time graph assembly service `MemoryGraphAssemblyService.js`:
  - Builds `nodes`/`edges` from `meeting_memory_contexts`, `meetings`, `action_items`, participants
  - 60-second TTL in-memory cache — `/graph` and `/graph/stats` share one DB build per window
  - `getNodeNeighbours(workspaceId, nodeId, depth)` method for BFS subgraph expansion
- Backend graph endpoints (all require active workspace membership):
  - `GET /api/workspaces/:workspaceId/memory/graph`
  - `GET /api/workspaces/:workspaceId/memory/graph/stats`
  - `GET /api/workspaces/:workspaceId/memory/graph/node/:nodeId/neighbours?depth=N`
- Frontend wiring uses real backend data:
  - `useGraphData.ts` fetches `/memory/graph`; `MemoryView.tsx` fetches `/memory/graph/stats`
  - `useQueryMemory.ts` calls `/memory/search`, maps results to real graph node IDs (`meeting:N`)
  - `MemoryView.handleAIQuery` uses returned node IDs to focus/dim matching nodes in the graph
  - `MemoryQueryBar.tsx` no longer returns hardcoded fake names and numbers
- `api.ts` exposes `getNodeNeighbours(workspaceId, nodeId, depth)` for future click-to-expand UI

#### ⚠️ What's Missing:
- No persisted graph storage (`graph_nodes`/`graph_edges` tables) — graph is always regenerated (with 60s cache)
- Frontend click-to-expand using `/neighbours` endpoint is not yet wired to any UI interaction
- `meeting_relationships` table is not yet populated (on-demand vector fallback in `MemoryContextService` compensates)

#### 📋 To Do:
**PHASE 3: UI Expansion (Pending)** — wire `/neighbours` to node click-to-expand in `GraphCanvas`
**PHASE 4: Persistence (Optional)** — add `graph_nodes`/`graph_edges` tables for faster reads on large workspaces

---

## 🔹 ACTIONABILITY & TASK CONTEXT

### 7. Action Item Detection
**Status:** ✅ 95% COMPLETE
**Technologies:** Grok API, Node.js

#### ✅ What's Working:
- Action items extracted post-meeting via `ActionItemService.js`
- Stored with structure, confidence scores, canonical keys
- Confirmation/rejection workflow in UI
- **Auto task creation from confirmed action items** (in `AIInsightsService.saveInsightsToDatabase()`)
- DB link between `action_items` and `tasks` tables
- "Create Task" button in ActionItemsPanel with `TASK CREATED` badge
- **Deadline parsing** — `chrono-node` in `TaskCreationService.parseDeadline()` + wired into `AIInsightsService`
- **Priority auto-classification** — `_extractPriority()` in `TaskCreationService`

#### ⚠️ What's Missing:
- Assignee names not matched to workspace users

#### 📋 To-Do:
- [ ] Fuzzy-match assignee name to workspace users

---

### 8. Kanban Board Integration
**Status:** ✅ 100% COMPLETE
**Technologies:** React, dnd-kit, PostgreSQL, Prisma

#### ✅ What's Working:
- Full Kanban board with drag-and-drop persisting to backend
- 3 default columns: To-Do, In-Progress, Complete
- Custom column management (owner/admin only)
- Full task CRUD (`taskRoutes.js`)
- Tags with color coding, filtering by assignee/tags/priority/due date
- TaskDetailModal with inline editing (title, description, assignee, due date)
- Auto task creation from confirmed action items

---

### 9. Auto Follow-Up Reminders
**Status:** ✅ 100% COMPLETE *(quiet hours confirmed code-verified — `_isInQuietHours()` called at line 69)*
**Technologies:** Node.js cron, NotificationService, PostgreSQL

#### ✅ What's Working:
- `ReminderService.js` — full deadline scheduling, deduplication via `SentReminder` table
- Default intervals: 24h and 1h before deadline
- `checkTaskReminders.js` cron runs every 15 minutes
- `GET/PUT /api/reminders/preferences`, `GET /api/reminders/upcoming`
- `RemindersTab.tsx` — full preferences UI in profile settings
- `NotificationService.js` — in-app notification delivery
- **Quiet hours enforcement** ✅ — `_isInQuietHours(start, end)` correctly handles normal (09:00–18:00) and overnight (22:00–07:00) ranges; skips dispatching if current UTC hour is within window

#### 📋 Optional (Low Priority):
- [ ] Email reminder channel (when `NotificationSettings.emailActionItems` is enabled)
- [ ] Browser push notifications (Web Push API / Firebase)

---

### 10. Task Contextual Micro-Channels
**Status:** 🟡 ~70% COMPLETE *(April 2026 — code-verified)*
**Priority:** Medium
**Technologies:** PostgreSQL, Prisma, React, WebSocket *(WS only for optional live-mention channel)*

#### ✅ What's Working (code-verified):

**Data model (PHASE 1 — partial)**
- No dedicated `TaskContext` table yet. Meeting linkage is **`Task.actionItemId` → `ActionItem` → `meetingId`**; enriched context is assembled from **`MeetingMemoryContext`**, **`MeetingEmbedding`** (per–content-type counts / “micro-channels”), **`MeetingNote`**, and **`MemoryContextService`**.

**Backend (PHASE 2 — partial)**
- `TaskContextService.js` — `getTaskMeetingContext(taskId, userId)`; route **`GET /api/tasks/:taskId/context`** (workspace access enforced).

**Frontend (PHASE 3 — partial)**
- `TaskDetailModal`: collapsible **Meeting Context** section (summary excerpt, transcript snippet, decisions, notes, memory-channel badges); `apiService.getTaskMeetingContext`; types on `Task.meetingContext`.
- **Gap:** “View full meeting” control is not wired to navigation; UI is a collapsible block rather than a separate modal tab strip (acceptable unless product insists on tabs).

#### 📋 To-Do (remaining core work):
- **PHASE 1 (finish):** Optional dedicated **`TaskContext`** (or equivalent) if you need persisted per-task anchors (e.g. pinned excerpt + explicit timestamps), beyond derived meeting memory.
- **PHASE 2 (finish):** `linkTaskToMeeting()` (and optional unlink) so **manually created** tasks can attach meeting / action-item context, not only tasks born from action items.
- **PHASE 3 (finish):** Wire **View full meeting** to the meeting details route; align naming with docs (`getTaskContext` alias vs `getTaskMeetingContext`).

#### 📋 Optional (Low Priority):
- **PHASE 4:** Real-time WebSocket **task_mention** when linked task titles appear in live transcript — **already implemented** (`TaskMentionService` + `broadcastTaskMention` + `useMeetingTaskMention` in `TaskDetailModal`). Treat as **optional polish / ops** (throttling, env `TASK_MENTION_WS_THROTTLE_MS`, WS URL/port in dev/prod).

---

## 🔹 PRIVACY & COMPLIANCE

### 11. Privacy Mode (Pause/Resume Transcription)
**Status:** ✅ 100% COMPLETE
**Priority:** Medium
**Technologies:** Node.js, PostgreSQL (metadata JSON), Puppeteer, React

#### ✅ What's Working (code-verified):

**Backend**
- `PrivacyModeService.js` — full state machine:
  - `getState(meetingId)` — loads privacy state from `meeting.metadata.privacyMode`, caches in memory
  - `setState(meetingId, enabled)` — toggles state, appends interval `{ start, end }` to DB, clears cache
  - `isEnabled(meetingId)` — quick boolean check used by hot paths
- `PATCH /api/meetings/:id/privacy-mode` route in `meetingRoutes.js`
- `TranscriptionService.js` — checks `PrivacyModeService.isEnabled()` before processing each audio chunk; drops chunk silently when privacy is on
- `AIInsightsService.js` — loads privacy intervals, filters utterances timestamped within privacy windows before generating AI insights (`_isInPrivacyInterval()` method)
- `AudioRecorder.js` — also checks `PrivacyModeService.isEnabled()` during recording

**Frontend**
- `apiService.updateMeetingPrivacyMode()` — `PATCH` with optimistic error handling
- `MeetingLive.tsx` — `togglePrivacyMode`, initial state from `meeting.metadata.privacyMode`, Kairo Bot dropdown entry (EyeOff + On/Off), top-bar “Privacy Mode ON” badge when active, status dot (orange when privacy on), “Catch Me Up” respects `isPrivacyMode`
- `TranscriptTab.tsx` — privacy banner when active; system lines for privacy on/off events

#### 📋 Optional (compliance / enterprise — not core FYP)


- [ ] "Confidential" meeting flag + meeting-level access restrictions
- [ ] Data retention policies, audit logging, GDPR export

---

### 12. Role-Based Access Control (RBAC)
**Status:** ✅ 100% COMPLETE

- Roles: owner, admin, member, observer
- Role-based API middleware across all endpoints
- Frontend conditional rendering per role

---

## 🔹 SEARCH & RETRIEVAL

### 13. Smart Search & Query
**Status:** ✅ 100% COMPLETE *(code-verified March 27, 2026)*
**Technologies:** pgvector, Transformers.js, PostgreSQL FTS, Node.js

#### ✅ What's Working (code-verified):
- `SmartSearchModal.tsx` calls `apiService.searchMeetingMemory()` → real `GET /api/workspaces/:id/memory/search`
- **Hybrid search** ✅ — `MeetingEmbeddingService.hybridSearchWorkspaceMeetings()` (lines 219–304):
  - Runs vector cosine similarity and `plainto_tsquery` FTS in parallel
  - Merges results with 60% semantic + 40% FTS weighting
  - Falls back to pure vector search if FTS fails
- **Result highlighting** ✅ — `HighlightedSnippet` component in `SmartSearchModal.tsx` (lines 53–70):
  - Backend passes `matchedTerms[]` extracted from query (stop-words stripped)
  - Frontend renders `<mark>` tags around matching terms in snippet
- Keyboard navigation (↑↓, Enter, ESC), debounced 500ms
- Results deduplicated — one best match per meeting
- Results grouped by meeting with snippet preview

---

## 🔹 MULTIMODAL INTELLIGENCE

### 14. Multimodal Meeting Capture
**Status:** 🔄 20% COMPLETE
**Technologies:** HTML5 Canvas, Tesseract.js (OCR)

#### ✅ What's Working:
- Audio/video recording during meetings

#### 📋 To-Do:
- [ ] "Capture Moment" button in live meeting UI
- [ ] `MeetingCaptures` table
- [ ] OCR for slide text extraction

---

## 🔹 INTEGRATIONS & ECOSYSTEM

### 15. Calendar Integrations
**Status:** ✅ **Complete** — Google Calendar OAuth, sync, and `Meeting` upserts (production path behind `ENABLE_CALENDAR_INTEGRATION`).
**Scope:** **In-scope core feature** — connects the user’s Google Calendar so meetings appear in Kairo and participate in the same auto-join / `Meeting` lifecycle as native meetings.

#### ✅ What's Working (code-verified, May 2026):

**Backend**
- Feature flag: routes mount when `ENABLE_CALENDAR_INTEGRATION=true` (`server.js` → `/api/calendar/*`).
- **`CalendarConnection`** model (`schema.prisma`) — OAuth tokens, `calendarId`, sync timestamps/errors.
- **`calendarRoutes.js`** — `GET /api/calendar/status`, `GET /api/calendar/oauth/google/start`, `GET /api/calendar/oauth/google/callback`, `GET /api/calendar/connections`, `POST /api/calendar/connections/:id/sync`, `DELETE /api/calendar/connections/:id`.
- **`calendarSync.js`** — Lists Google Calendar events via API; upserts eligible events as Kairo **`Meeting`** rows with `meetingSource: 'google-calendar'` and stable dedup in `metadata.calendar` (uid).
- **Scheduled sync** — `cron.js` runs calendar sync every **15 minutes** when the flag is enabled; job logic in `jobs/syncCalendars.js`.

**Frontend**
- **`CalendarStep.tsx`** (onboarding) — Real OAuth: calls `/calendar/oauth/google/start`, redirects to Google consent; handles `?calendar=connected|denied|error` after callback.
- **`CalendarSettings.tsx`** (profile) — Lists connections, sync now, disconnect.

### 16. Third-Party Tool Integrations
**Status:** ❌ 0% COMPLETE (UI mockups exist)
**Priority:** Low (optional for FYP)

---

## 🔹 ADDITIONAL FEATURES

### 17. Interactive Transcript Review & Timeline
**Status:** ✅ 100% COMPLETE
- Click-to-play from transcript, keyboard shortcuts, playback speed, visual timeline with event markers

### 18. Note-Taking
**Status:** ✅ 100% COMPLETE

### 19. Analytics Dashboard
**Status:** ✅ 100% COMPLETE
- All 4 tabs (Overview, Participants, Action Items, Insights) wired to real backend data
- Time range filters, multiple chart types

### 20. Team and Workspace Management
**Status:** ✅ 100% COMPLETE

---

## MASTER TO-DO LIST

### HIGH PRIORITY (Do Now)

| # | Task | Effort | Status |
|---|---|---|---|
| 1 | **Speaker diarization — remaining** — (A) **Guest profiling:** unresolved `SPEAKER_XX` → Guest A/B + meeting-scoped embeddings + UI (`speaker-diarization.md` Layer 8). (B) **Full streaming diarization:** windowed live `SPEAKER_XX` (design §2b). | 1–2 weeks | TODO |
| 2 | **Knowledge Graph click-to-expand** — wire `getNodeNeighbours` / `/neighbours` to node-click in `MemoryView` + `GraphCanvas` (merge neighbour nodes into graph state) | ~1 day | TODO |

### MEDIUM PRIORITY

| # | Task | Effort |
|---|---|---|
| 3 | Fuzzy-match assignee name to workspace users in `TaskCreationService` | 2-3 days |
| 4 | Task Contextual Micro-Channels — finish polish: “View full meeting” navigation, manual task–meeting linking, any remaining WebSocket coverage (`TaskContextService`, `TaskDetailModal`, `useMeetingTaskMention`) | ~1 week |

### 📊 LOW PRIORITY / POST-FYP

- Third-party integrations (Jira, Slack, Trello)
- Multimodal capture (slide screenshots + OCR)
- Multilingual transcription
- Migrate to Faster-Whisper
- Email/push reminders
- Privacy Mode Phase 2 (confidential meeting flag)
- Privacy Mode Phase 3 (data retention, audit logs, GDPR)

---

## CONCLUSION

Kairo is **~97% complete** on core scope (code-verified, May 10, 2026). The core product is essentially feature-complete. **Calendar integration** is **in-scope** and delivered for **Google Calendar** (OAuth, periodic sync, meetings materialized for existing auto-join flows) when `ENABLE_CALENDAR_INTEGRATION=true`. Speaker diarization has advanced significantly: post-meeting biometric identification, cascade name propagation, manual assignment UI with identification badges, and **live per-chunk speaker identification** during meetings are all fully implemented.

**Non-optional remaining work (matches Master To-Do above):**

1. **Speaker diarization — remaining** — **Guest profiling** for unresolved speakers (Guest A/B + embeddings; `speaker-diarization.md` Layer 8) and **full streaming diarization** (§2b); aligns with Master To-Do #1
2. **Knowledge Graph click-to-expand** — wire the existing `/neighbours` API to a node click in `MemoryView` / `GraphCanvas`
3. **Task Contextual Micro-Channels** — finish "View full meeting" navigation, manual task–meeting linking, and any remaining WebSocket coverage


**Note:** Microsoft Teams support is NOT in scope. Focus is Google Meet and Zoom.

---

*Last Updated: May 10, 2026*
*Maintained by: Kairo Team*
