# Core Remaining Tasks — Completion Plan

**Scope:** Four backlog workstreams: speaker diarization (guest + streaming), knowledge graph neighbour merge on click, assignee fuzzy-match for tasks, and task micro-channel polish.

**Last updated:** April 24, 2026

---

## Shared engineering principles

1. **Additive changes first** — Prefer new hooks, routes, or thin wrappers over deep refactors of shared services (`TranscriptionService`, `AIInsightsService`, etc.).
2. **No silent behaviour change** — When flags or optional state are absent, runtime behaviour must match today’s production paths.
3. **Single place of responsibility** — Graph merge logic lives with memory UI state; assignee resolution with task creation; speaker guest/streaming with diarization / bot audio paths.

---

## Task 1 — Speaker diarization (remaining)

**Label:** Guest profiling + full streaming diarization  
**Effort (estimate):** 1–2 weeks (parallelisable after design lock)

### 1A. Within-meeting guest profiling (Guest A / B)

**Goal:** For speakers that stay unresolved as real workspace users, assign stable **meeting-scoped** labels (e.g. Guest A, Guest B) backed by embeddings so the UI and downstream memory stay consistent.

**Suggested phases**

| Phase | Work | Primary files / areas |
|-------|------|------------------------|
| **Design lock** | Data model for guest rows (table or JSON), consent, lifecycle vs meeting end | Prisma schema, product/legal review |
| **Backend** | Track unresolved `SPEAKER_XX` segments; create/update guest records; APIs for live + post transcript | `SpeakerMatchingEngine.js`, `SpeakerIdentificationService.js`, possible new small module |
| **Live path** | Tie updates to `LiveSpeakerIdentifier` / WebSocket where appropriate | `LiveSpeakerIdentifier.js`, `TranscriptionService.js`, `WebSocketServer` |
| **Frontend** | Transcript rows + badges aligned with biometric/manual/historical tiers | `TranscriptPanel.tsx`, `SpeakerAssignmentPopover.tsx` |
| **QA** | Multi-speaker, all-unresolved, partial enrollment, privacy on/off | Automated + manual |

**Acceptance criteria**

- Stable guest identities per meeting without merging two distinct voices incorrectly.
- Cascade, insights, and memory consumers tolerate guest rows (explicit names, filterable).

### 1B. Full streaming diarization (windowed live `SPEAKER_XX`)

**Goal:** Stable multi-speaker cluster labels on the **live** stream, distinct from per-chunk **enrolled-user** display names (`LiveSpeakerIdentifier`).

**Design — streaming diarization path (live labels)**

1. **Audio path** — Reuse the capture stream the bot writes to chunk files (and optional ring buffer). Maintain a **rolling buffer** (e.g. 15–30s or overlapping windows every *T* seconds) for a worker.

2. **Worker process** — Separate long-lived Python process (or pool) from the per-chunk Whisper line, e.g. queue-driven `StreamingDiarizationWorker` (Redis, stdin IPC, or local queue). Each job: window audio + meeting-relative time → **windowed** diarization (WhisperX segment + diarization on window, or lighter online model later). Output: `{ startSec, endSec, speakerLabel }[]` per window.

3. **Label stability (cross-window)** — Session state maps window-local cluster ids to stable **`SPEAKER_XX`** (Hungarian matching / short-embedding cosine / incremental clustering). Expect index permutation across windows; never treat raw pyannote indices as stable without reconciliation.

4. **Integration with live ASR** — **Option A:** keep chunk transcription; merge speaker by **time overlap** between chunk `[start,end]` and latest window diarization. **Option B:** single pipeline per window (higher latency). **Broadcast:** extend WebSocket `transcript` payload or add `speaker_labels_update` with `SPEAKER_XX` and optional display name when maps exist.

5. **End-of-meeting reconciliation** — Run existing full-file diarization unchanged. Policy: replace live labels in stored JSON with file result, or keep live as preview and mark final from `transcript_diarized.json`. Re-run or patch `SpeakerMatchingEngine` after final JSON.

6. **Privacy, load, ops** — Respect privacy mode (skip or blank windows). Cap CPU/GPU (throttle window rate, max concurrent meetings, per-workspace flags). HF/pyannote auth same as batch diarization.

7. **Phased delivery** — **P1:** Buffer + worker skeleton + WS best-effort field. **P2:** Stable `SPEAKER_XX` across windows + latency/mismatch metrics vs final file. **P3:** Tie live clusters to enrollment/historical display names (highest consent risk).

**Acceptance criteria**

- No registered display name without passing the same gates as today’s live enrolled path.
- Post-meeting `transcript_diarized.json` remains authoritative; live vs final policy is explicit and tested.

**Risks:** GPU/CPU, pyannote auth, privacy windows, failure fallback to today’s behaviour.

---

## Task 2 — Knowledge graph click-to-expand

**Label:** Wire `getNodeNeighbours` / `/neighbours` to node click in `MemoryView` + `GraphCanvas`  
**Effort (estimate):** ~1 day core wiring plus edge-case buffer

### Approach

1. **`useGraphExpansion` hook (new)** — State: expanded ids, accumulated nodes/edges, loading/errors. `expandFromNode(nodeId, workspaceId, depth)` calls the existing neighbours API client and merges into derived `GraphData`. `clearExpansions()` on workspace change or reset.

2. **`MemoryView.tsx`** — Pass merged graph into `GraphCanvas`; bind node click to expansion when product gesture is defined (alongside existing context panel).

3. **Contract** — Neighbour payload shapes must match `GraphCanvas` / shared `types` (same as main graph response).

4. **Filters** — Re-apply `useGraphData` filter rules on merged data.

**Acceptance criteria**

- Neighbour nodes/edges render without full reload; dedupe works; reset works; errors do not corrupt base graph.

---

## Task 3 — Fuzzy-match assignee to workspace users

**Label:** `TaskCreationService` (and related save paths)  
**Effort (estimate):** 2–3 days

### Approach

1. Normalise strings (trim, case-fold, whitespace).  
2. Load workspace members when creating tasks from action items.  
3. Exact match on name/email first; then fuzzy (e.g. Jaro–Winkler / Levenshtein) with **confidence floor**; ambiguous → keep string assignee, optional `metadata.assigneeMatchSuggestion`.  
4. Persist `userId` on task if schema allows; else metadata until migration.  
5. Tests: typos, initials, duplicate given names, non-members.

**Acceptance criteria**

- No auto-assign below threshold; notifications use resolved user when set.

---

## Task 4 — Task contextual micro-channels (polish)

**Label:** “View full meeting”, manual task–meeting linking, WebSocket hardening  
**Effort (estimate):** ~1 week

### Anchors in repo

- `TaskContextService.getTaskMeetingContext` — `GET /api/tasks/:taskId/context`  
- `TaskDetailModal.tsx` — meeting context + micro-channel counts  
- `useMeetingTaskMention.ts` — live mention WebSocket path  

### Work packages

| Package | Description |
|---------|-------------|
| **Navigation** | Deep-link from task detail to correct workspace + meeting route using context payload. |
| **Manual link** | Tasks not created from action items: API + UI to attach meeting/action-item context (`linkTaskToMeeting`-style behaviour if absent). |
| **WebSocket** | Reconnect, workspace switch, leave meeting; avoid duplicate subscriptions. |
| **Privacy** | Confirm `MeetingBot` live action-item interval respects `PrivacyModeService`; optional second guard in `ActionItemService`. |

**Acceptance criteria**

- One predictable path from task to source meeting; manual tasks gain parity within RBAC; WS behaviour matches stated product policy when leaving a meeting.

---

## Suggested sequencing

1. Task 2 (graph expand) — smallest vertical slice.  
2. Task 3 (assignee fuzzy).  
3. Task 4 (micro-channels).  
4. Task 1 (speaker) — longest, highest external dependency.

Parallel: **1B** streaming can branch from **1A** after IPC design is fixed.

---

## Backlog index (this document)

| Item | Section |
|------|---------|
| A | Task 1 |
| B | Task 2 |
| C | Task 3 |
| D | Task 4 |
