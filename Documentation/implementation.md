# Implementation Guide: Memory Graph, Live Action Items & Speaker Identity

This document describes the **lowest-risk, most modular** way to ship the covered features without destabilizing unrelated code paths. It is aligned with the current architecture (April 2026).

**Scope:** (1) Knowledge graph click-to-expand, (2) Live action item hardening, (3) **Speaker diarization + identity resolution** (enrollment, live, post-meeting) — the last is architected as a **pluggable boundary** so transcription, AI insights, and UI can keep working even if identity matching is disabled or swapped for another vendor.

### Document map

| Section | Contents |
|---------|----------|
| [Feature 1](#feature-1-knowledge-graph-click-to-expand) | Design, **step-by-step checklist**, **risks to analyse** |
| [Feature 2](#feature-2-live-action-items-during-meeting) | Design, **step-by-step checklist**, **risks to analyse** |
| [Feature 3](#feature-3-speaker-diarization-identity-resolution--meeting-scoped-guests-guest-a) | Full pipeline, **Guest-A / Guest-B** logic, **master step-by-step**, **risk register** |

---

## Design principles (all features)

1. **Additive modules first** — Prefer new hooks / thin wrappers over edits deep inside shared services, unless a single guarded branch is clearly safer.
2. **No silent behavior change** — Default behavior when flags/state are empty must match today (graph looks the same; action-item cadence unchanged until you opt in).
3. **Single responsibility** — Graph merging lives in the memory UI layer; live extraction policy lives next to the existing bot interval (or behind one guard).
4. **Test and feature-flag** — Where behavior is user-visible or costly (LLM calls), gate with env or a constant for quick rollback.

---

## Feature 1: Knowledge graph click-to-expand

### Current behavior

- `useGraphData` loads `GET /workspaces/:id/memory/graph` with limits (`limitMeetings`, `limitNodes`, `limitActions`) and applies **filters** in-memory (`applyFilters` in `useGraphData.ts`).
- `MemoryView.tsx` passes **filtered** `graphData` to `GraphCanvas`. On node click it only opens the context panel (`handleNodeClick`).
- Backend `MemoryGraphAssemblyService.getNodeNeighbours(workspaceId, nodeId, depth)` builds the **full** workspace graph via `buildWorkspaceGraph`, then BFS-collects neighbours. Returned nodes are already layout-ready (`buildPositions` runs in the main graph build path; neighbour nodes are subsets of `allNodes` with positions).

### Why this approach is safest

- **`useGraphData` should stay unchanged** — It remains the single source of “remote base graph + filters”. Filters continue to apply to the base slice only; expanding is an **overlay** so we do not fork filter logic or double-fetch the full graph on every load.
- **Neighbour fetches are on-demand** — Only when the user clicks, and only for one node at a time (cheap, predictable).
- **Backend already returns the same node shape** as the main graph — No new API contract if the response matches what the canvas expects; at most a thin normalizer on the frontend if any field differs.

### Recommended implementation shape

#### A. New hook: `useGraphExpansion` (new file)

**Responsibility:** Hold accumulated expansion state and merge logic. **Does not** replace `useGraphData`.

State:

- `expandedNodes: MemoryNode[]` — union of all nodes fetched via neighbours (deduped by `id`).
- `expandedEdges: MemoryEdge[]` — same for edges (dedup by `id` or `source+target+type`).
- `expandedNodeIds: Set<string>` — ids already expanded (skip duplicate network calls for same id, optional).
- `expandingNodeId: string | null` — loading indicator for UX.
- `expansionError: string | null` — last error (toast).

Methods:

- `expandFromNode(nodeId: string, workspaceId: number, depth?: number)` — calls `apiService.getNodeNeighbours`, then merges.
- `clearExpansions()` — reset overlay (e.g. when `workspaceId` changes or user clicks “Reset view” if you wire it).

**Merge algorithm (`mergeGraphData(base, overlay)`):**

1. Build a `Map<string, MemoryNode>` from `base.nodes`.
2. For each node in `overlay.nodes`, `set(id, node)` (overlay wins for same id if you re-fetch; usually identical).
3. Same for edges with key `${source}|${target}|${type}` or use `edge.id` if always present.
4. Return `{ nodes: [...map.values()], edges: dedupedEdges }`.

**Display graph:**

```text
displayGraphData = mergeGraphData(filteredBaseFromUseGraphData, { nodes: expandedNodes, edges: expandedEdges })
```

Pass **`displayGraphData`** into `GraphCanvas` and into `handleFocusMode` / `handleAIQuery` logic that currently reads `graphData`. **Important:** Any code that computes focus/dim/query from “all visible nodes” must use `displayGraphData` consistently (replace references in `MemoryView` only — do not change `useQueryMemory` unless needed).

#### B. `MemoryView.tsx` edits (minimal)

1. Import and instantiate `useGraphExpansion(workspaceId)`.
2. Replace usages of `graphData` **for rendering** with `displayGraphData` (derived).
3. In `handleNodeClick`:
   - Keep existing: `setSelectedNode`, `setIsContextPanelOpen(true)`.
   - Add: `void expandFromNode(node.id, workspaceIdInt, 1)` with `expandFromNode` skipping if already in `expandedNodeIds` (optional).
4. In `handleResetGraph` (or equivalent), call `clearExpansions()` so viewport reset also clears expansion clutter (product choice — recommended).
5. When `workspaceId` changes, `clearExpansions()` in `useEffect`.

#### C. `GraphCanvas.tsx`

**No change required** if props stay `GraphData` — only the parent passes a larger merged graph.

Optional: pass `expandingNodeId` to show a subtle pulse on the clicked node (small prop addition — isolated).

#### D. Edge cases (explicit)

| Case | Handling |
|------|----------|
| Neighbour already in base graph | Merge dedupes by id — harmless. |
| Filters hide some types | Base is still filtered; overlay could show types filters would hide — **product decision**: either merge overlay **after** filter (stricter) or only add nodes that pass `applyFilters` (reuse `applyFilters` on merged result once). **Least surprise:** run `applyFilters` on **`mergeGraphData(base, overlay)`** so the filter bar still controls everything. |
| API returns 404 / unknown node | Catch in hook; toast; do not mutate graph. |
| Double-click spam | Debounce or ignore if `expandingNodeId === node.id` or id in `expandedNodeIds`. |

#### E. Files touched (summary)

| File | Change |
|------|--------|
| `frontend/src/hooks/useGraphExpansion.ts` | **New** — merge + API calls + state |
| `frontend/src/pages/workspace/MemoryView.tsx` | Wire hook; use `displayGraphData`; extend `handleNodeClick` / reset |
| `frontend/src/services/api.ts` | No change if `getNodeNeighbours` already typed |

**Do not modify** `MemoryGraphAssemblyService.js` for v1 unless you discover a shape mismatch — keeps backend blast radius zero.

### Feature 1 — Step-by-step implementation guide

1. **Scaffold** — Add `frontend/src/hooks/useGraphExpansion.ts` exporting merge helpers + state (`expandedNodes`, `expandedEdges`, `clearExpansions`, `expandFromNode`, loading/error).
2. **API** — Confirm `apiService.getNodeNeighbours(workspaceId, nodeId, depth)` response matches `GraphData` node/edge shapes; add a thin `normalizeNeighbourResponse()` only if the API wraps payloads differently than `getMemoryGraph`.
3. **MemoryView** — Derive `displayGraphData = merge(applyFilters(remote), expansionOverlay)`; replace every `graphData` reference used for **canvas / focus / AI highlight** with `displayGraphData` (grep the file).
4. **Click handler** — On node click: open context panel (existing) + call `expandFromNode(node.id, depth)`; optional skip if node id already expanded.
5. **Reset** — On workspace change or “reset view”: `clearExpansions()` + existing viewport reset.
6. **QA** — Test with limit-truncated graph: expanded neighbours appear; filters still behave per [§D edge cases](#d-edge-cases-explicit).

### Feature 1 — Risks to analyse (must not be skipped)

| ID | Risk | What to analyse / mitigate |
|----|------|----------------------------|
| R1.1 | **Filter vs expansion** | If expansion injects node types hidden by filters, users see “orphan” behaviour — decide policy (filter merged graph vs show all neighbours). |
| R1.2 | **Performance** | Large neighbour sets could slow canvas; cap `depth` at 1 for v1; consider max nodes merged per session. |
| R1.3 | **Stale expansion** | After `useGraphData` refetch, expansion overlay may reference removed nodes — clear expansion on remote refresh or version the base snapshot. |
| R1.4 | **Focus mode drift** | `handleFocusMode` / `handleAIQuery` must use the same graph the canvas uses or highlights will be wrong. |

---

## Feature 2: Live action items (during meeting)

### What already exists (important)

The codebase already implements a **periodic live pipeline**:

| Piece | Location |
|-------|----------|
| Interval (default **30s**, env `ACTION_ITEMS_INTERVAL`) | `MeetingBot.js` — `setInterval` calling `ActionItemService.extractAndUpdateActionItems` |
| Extraction + DB upsert + dedup (`canonicalKey`, merge) | `ActionItemService.extractAndUpdateActionItems` |
| WebSocket push | `WebSocketServer.broadcastActionItems` after create/update |
| Frontend consumption | `useActionItems.ts` listens for `type: 'action_items'` on the same transcript WebSocket |

So “live action items” are **not greenfield** — the work is **hardening, parity, and product-visible behavior**, not inventing a second pipeline.

### Gaps to close (typical)

1. **Privacy mode** — While privacy is on, transcript must not feed extraction (compliance). Today the bot may still read the transcript **file** on disk; confirm whether sensitive segments are omitted from file. If the file still contains full text, add an explicit guard: `if (await PrivacyModeService.isEnabled(meetingId)) return;` at the **start** of the interval callback in `MeetingBot.js` (and optionally inside `extractAndUpdateActionItems` as defense-in-depth).
2. **Visibility** — Ensure live meeting UI actually surfaces `useActionItems` (e.g. `InsightsTab` / live sidebar). If the hook is not mounted during live meetings, wire it **without** changing REST routes.
3. **Cost / noise** — Tune `EXTRACTION_INTERVAL`, `FULL_EXTRACTION_INTERVAL`, confidence thresholds in `ActionItemService`, and minimum transcript length — preferably via env vars (already partially true).
4. **Post-meeting reconciliation** — `AIInsightsService` syncs action items after the meeting. Risks: duplicate or conflicting rows. Mitigation: rely on existing `canonicalKey` + merge paths; optionally tag rows created during live (`metadata.source = 'live_interval'`) for observability only — **avoid** schema migration if not necessary (use `rawData` JSON if column exists).

### Recommended implementation shape (minimal blast radius)

#### A. `MeetingBot.js` — guarded early return only

At the top of the **interval callback** (before reading the transcript file):

- If `PrivacyModeService.isEnabled(this.meetingId)` → log at debug and `return`.

This does **not** change `TranscriptionService` or WebSocket transcript broadcasting — only the **batch extraction** path.

**Optional:** `if (process.env.LIVE_ACTION_ITEMS_ENABLED === 'false') return;` for kill switch.

#### B. `ActionItemService.extractAndUpdateActionItems` — optional second guard

Duplicate privacy check here protects against any future caller of this method during privacy (defense in depth). Single `if` at top; no refactor of extraction logic.

#### C. Frontend — mount existing hook

- `MeetingLive.tsx` already calls `useActionItems(meetingId)` (see imports ~line 35). Confirm the **tab/panel** that should show live suggestions receives `dbActionItems` / confirm-reject handlers and is visible during capture without switching away.
- If anything is missing, prefer **passing props** into the existing live insights/action UI rather than adding a second hook instance (avoid duplicate WebSocket subscriptions).
- **Do not** change WebSocket protocol — message type `action_items` is already standardized.

#### D. Post-meeting `AIInsightsService`

- **Do not** disable post-meeting sync.
- Add a short comment or log when syncing finds the same `canonicalKey` as an existing pending item (already handled by DB upsert patterns — verify in tests).

### Files touched (summary)

| File | Change |
|------|--------|
| `backend/src/services/MeetingBot.js` | Privacy (and optional env) guard in action-item interval |
| `backend/src/services/ActionItemService.js` | Optional top-of-method privacy guard |
| `frontend/.../MeetingLive.tsx` or live insights child | Ensure `useActionItems` is mounted and UI lists items |
| `.env.example` | Document `ACTION_ITEMS_INTERVAL`, `LIVE_ACTION_ITEMS_ENABLED` if added |

**Avoid** new cron jobs, new WebSocket types, or duplicate tables unless product requires offline history.

### Feature 2 — Step-by-step implementation guide

1. **Audit transcript file vs privacy** — Confirm what is written to disk during privacy mode; document whether the action-item interval must be gated even when transcript file exists.
2. **MeetingBot** — Add `PrivacyModeService.isEnabled(this.meetingId)` guard at start of action-item `setInterval` callback; optional `LIVE_ACTION_ITEMS_ENABLED` env kill switch.
3. **ActionItemService** — Optional duplicate privacy guard at top of `extractAndUpdateActionItems`.
4. **UI** — Trace `useActionItems` from `MeetingLive.tsx` into the visible tab; ensure list + confirm/reject are reachable during live capture.
5. **Env** — Document `ACTION_ITEMS_INTERVAL`, new flags in `.env.example`.
6. **Regression** — Run existing action-item tests; add one test that privacy guard skips extraction when stubbed enabled.

### Feature 2 — Risks to analyse (must not be skipped)

| ID | Risk | What to analyse / mitigate |
|----|------|----------------------------|
| R2.1 | **Privacy leakage** | Interval reads full transcript file; if privacy segments are still in file, extraction could leak sensitive content — align with product/legal. |
| R2.2 | **Duplicate vs post-meeting AI** | `canonicalKey` collision or divergent titles — verify merge behaviour in `AIInsightsService` sync. |
| R2.3 | **Cost / rate** | Shorter interval → more LLM calls; monitor Grok/Groq usage and set safe defaults. |
| R2.4 | **WS fallback** | `usePolling` path must still work when WebSocket fails — no silent data loss. |

---

## Suggested implementation order

1. **Graph expansion** — Self-contained frontend; backend unchanged; easy to QA in Memory view.
2. **Live action items hardening** — Small backend guards + UI wiring; leverages existing `MeetingBot` + `useActionItems`.
3. **Speaker identity (phased)** — See [Feature 3](#feature-3-speaker-diarization-identity-resolution--meeting-scoped-guests-guest-a): **post-meeting + enrollment + Guest-A clustering first**, then **live labeling** behind a feature flag and strict latency budgets.

---

## Verification checklist

### Graph expansion

- [ ] Click node: context panel still opens; graph gains nodes/edges not previously visible when initial graph was limit-truncated.
- [ ] Changing workspace clears expansions.
- [ ] Filters still apply to visible graph after merge strategy chosen.
- [ ] No duplicate nodes/edges after repeated clicks.
- [ ] Focus mode and AI query highlight still behave (using `displayGraphData`).

### Live action items

- [ ] With privacy **off**, items appear within expected interval when transcript is long enough.
- [ ] With privacy **on**, extraction does not run (or does not persist sensitive content — match product).
- [ ] WebSocket still delivers updates; `useActionItems` list updates without full page refresh.
- [ ] Post-meeting insights do not create obvious duplicate tasks for the same utterance (canonicalKey behavior).

### Speaker identity & Guest-A (Feature 3)

- [ ] With `SPEAKER_IDENTITY_ENABLED` off, diarization artefacts and behaviour match pre-feature baselines.
- [ ] Enrolled users resolve to **account names** above threshold; UI never shows raw `SPEAKER_00` in resolved views.
- [ ] Two unenrolled distinct voices in one meeting → **Guest-A** and **Guest-B** (not two unrelated labels per utterance).
- [ ] Same unenrolled voice, multiple diarization clusters → merge to **one** guest slot when `T_guest` satisfied.
- [ ] Manual speaker override persists and beats automatic resolution.
- [ ] Privacy mode policy: no forbidden embedding extraction (per risk R3.7).

---

## Out of scope for graph + live action items

- Persisted `graph_nodes` / `graph_edges` tables.
- New LLM provider or replacing `AgentProcessingService` wholesale.
- Changing post-meeting `AIInsightsService` prompts (unless reconciliation bugs appear in testing).

---

## Feature 3: Speaker diarization, identity resolution & meeting-scoped guests (Guest-A)

This section defines how Kairo moves from anonymous diarization labels (`SPEAKER_00`, …) to **human-readable names in the product** — including **workspace members with voice enrollment** and **guests without enrollment** — while keeping WhisperX/Pyannote, `TranscriptionService`, and `AIInsightsService` **decoupled** from embedding vendors.

### Feature 3 — Table of contents

1. [Product goals & non-goals](#product-goals--non-goals-feature-3)
2. [Current system baseline](#current-system-baseline-feature-3)
3. [Architectural boundaries & module layout](#architectural-boundaries--module-layout-feature-3)
4. [Meeting-scoped guest clustering (Guest-A / Guest-B) — required behaviour](#meeting-scoped-guest-clustering-guest-a--guest-b--required-behaviour)
5. [Voice enrollment (signup sample)](#voice-enrollment-signup-sample)
6. [Post-meeting resolution pipeline (step-by-step)](#post-meeting-resolution-pipeline-step-by-step)
7. [Live names (optional, phased)](#live-names-optional-phased)
8. [Master step-by-step implementation plan (ordered)](#master-step-by-step-implementation-plan-ordered-feature-3)
9. [Risk register (must be analysed)](#risk-register-must-be-analysed-feature-3)
10. [Privacy, security, compliance](#privacy-security-compliance-feature-3)
11. [Testing, rollout, failure modes](#testing-rollout-failure-modes-feature-3)

---

### Product goals & non-goals (Feature 3)

**Goals**

- **User-visible strings never show raw diarization IDs** (`SPEAKER_00`, …) when identity resolution has run — users see **real names** for enrolled workspace members and **Guest-A**, **Guest-B**, … for distinct voices that could not be matched to enrollment.
- **Modularity:** diarization output remains the **source of truth for timing**; identity is a **derived layer** (`displaySpeaker`, `speakerResolutionMethod`).
- **Per-meeting guest stability:** two utterances from the **same unknown person** in the **same meeting** map to the **same** guest label (see Guest-A rule below).

**Non-goals (for initial ships)**

- Perfect identification without enrollment (biometrics is probabilistic).
- Replacing Meet/Zoom participant lists as the primary identity source (those can complement but not substitute voice match without integration work).
- Storing meeting audio embeddings long-term without explicit retention policy (default: **meeting-scoped** guest metadata only as needed).

---

### Current system (baseline) (Feature 3)

| Layer | What exists today |
|-------|-------------------|
| **Streaming ASR** | `TranscriptionService` — utterances with timestamps; speaker may be unset until diarization. |
| **Post-meeting diarization** | `performDiarization` → Python with `--diarize` (WhisperX + speaker assignment); `assignSpeakersToUtterances` maps by **time overlap**; `transcript_diarized.json` uses labels like `SPEAKER_00`. |
| **User audio** | Prisma `User.audioSampleUrl` — suitable for **enrollment audio** storage; **embedding vectors are not yet modeled** (add when implementing). |

**Invariant:** Raw diarization file may remain **immutable** for audit; **resolved** names live in DB and/or `transcript_resolved.json` **derived** from raw + mapping.

---

### Architectural boundaries & module layout (Feature 3)

Nothing in `TranscriptionService` or `AIInsightsService` should embed vendor SDKs. Add a **`speakerIdentity`** package (folder) with **narrow exports**:

```text
backend/src/speakerIdentity/
  SpeakerIdentityService.js       # orchestrates resolveMeeting(); feature-flagged no-op
  EnrollmentStore.js              # userId ↔ embedding + modelVersion
  MeetingGuestClusterStore.js   # meetingId ↔ Guest-A/B centroids + display labels (DB)
  EmbeddingExtractor.js         # calls Python CLI or HTTP sidecar; one model per env
  ClusterIdentityResolver.js    # enrollment match + guest clustering (Guest-A rule)
  speakerIdentity.types.js        # JSDoc / shared constants (thresholds from env)
```

**Public contract (conceptual)**

**Input:** `meetingId`, `workspaceId`, path to **full meeting audio**, list of **diarization cluster labels** with time ranges (from existing JSON), optional `workspaceMemberIds`.

**Output (per diarization cluster):**

| Field | Meaning |
|-------|---------|
| `clusterLabel` | Original id, e.g. `SPEAKER_00` (internal) |
| `displayName` | **User-facing** string: `User.name`, or `Guest-A`, or manual override |
| `resolutionKind` | `'enrollment' \| 'meeting_guest' \| 'manual' \| 'unresolved'` |
| `userId` | Set when matched to a workspace user; `null` for guests |
| `guestSlot` | e.g. `A`, `B` when `resolutionKind === 'meeting_guest'` |
| `confidence` | 0–1 when applicable |

**Failure mode:** If anything throws, catch at `SpeakerIdentityService` boundary — **do not** break insights; emit mapping with `resolutionKind: 'unresolved'` and `displayName` fallback to a neutral label (product: `"Speaker"` or keep last known).

---

### Meeting-scoped guest clustering (Guest-A / Guest-B) — **required behaviour**

This implements your rule: **if a user has no enrollment sample and a cluster cannot be matched to any existing signature, allocate a meeting-local guest identity and reuse it for subsequent unknowns that match that voice.**

#### Definitions

- **Cluster embedding** `E_c`: vector computed from **meeting audio** for all segments attributed to diarization cluster `c` (same model as enrollment).
- **Enrollment bank:** embeddings for workspace members who completed signup voice capture.
- **Meeting guest slots:** ordered slots `Guest-A`, `Guest-B`, … each with a **centroid embedding** `G_k` (updated as more speech is attributed).

#### Algorithm (post-meeting; deterministic when cluster order is fixed)

**Step 0 — Preconditions**

- Privacy mode: if policy says **no biometric processing** for this meeting, **skip** all embedding extraction; set every cluster to `unresolved` or manual-only — **analyse risk R3.8**.

**Step 1 — Build work list**

- Let `C` = set of diarization cluster labels from `transcript_diarized.json` (e.g. `SPEAKER_00`, `SPEAKER_01`).
- For each `c ∈ C`, compute `E_c` from meeting audio (minimum duration gate: if too short, treat as low confidence — **analyse R3.3**).

**Step 2 — Enrollment assignment (known people)**

- For each `c`, compute `sim(E_c, E_u)` for every **enrolled** workspace member `u` in scope (meeting participants / workspace policy).
- Use thresholds `T_high`, `T_low` (model-specific, configured + validated in eval).
- **Greedy or Hungarian** assignment so **one user does not steal two clusters** unless product allows (default: **one-to-one** for v1).
- Matched clusters get `displayName = user.name`, `resolutionKind = 'enrollment'`, `userId` set.

**Step 3 — Guest clustering for remaining clusters**

- Let `U = { c : c not matched in Step 2 }`.
- **Sort `U` by first speech onset time** (earliest cluster first) — stabilizes Guest-A vs Guest-B ordering.
- Initialise empty list `guests = []` (each element `{ label: 'A'|'B'|..., centroid: vector, clusterIds: [] }`).
- For each `c` in sorted `U`:
  1. If `guests` is empty: create **Guest-A** with `centroid = E_c`, map `c → Guest-A`, append to `guests`.
  2. Else compute `s_k = cosineSim(E_c, G_k)` for each guest centroid `G_k`.
  3. If `max_k s_k ≥ T_guest` (guest merge threshold): assign `c` to `argmax_k`; **update** `G_k` ← **EMA** (exponential moving average) with new embedding so the guest signature improves as more audio arrives:  
     `G_k ← α * E_c + (1-α) * G_k` (tune `α`, e.g. 0.3).
  4. Else: create new **Guest-B**, **Guest-C**, … in order; set centroid `E_c`; map `c` to that label.

**Step 4 — Persist**

- Table **`meeting_guest_speakers`** (illustrative): `meetingId`, `slot` (`A`,`B`,…), `centroidEmbedding` (or blob), `modelVersion`, `createdAt`.
- Table **`meeting_speaker_mapping`**: `meetingId`, `clusterLabel`, `userId` (nullable), `guestSlot` (nullable), `displayName`, `resolutionKind`, `confidence`, `method` (`auto|manual`).

**Step 5 — Apply to utterances**

- For each utterance, copy `speaker` from diarization, add **`displaySpeaker`** from mapping — UI and exports read **`displaySpeaker`**.

#### Why this satisfies “next unknown matches Guest-A”

- The **first** unmatched cluster creates **Guest-A** and stores its **signature** (centroid).
- Any **later** cluster whose embedding is close enough to that centroid is **labelled Guest-A** — so the **same physical person** without enrollment reuses **Guest-A** across the meeting.
- A **different** unknown voice gets **Guest-B** when similarity to Guest-A falls below `T_guest`.

#### Parameters to tune (with evaluation set)

| Parameter | Role | Risk if wrong |
|-----------|------|----------------|
| `T_guest` | Merge vs split guests | R3.1, R3.2 |
| `α` (EMA) | Centroid drift vs stability | R3.4 |
| Sort order | Guest-A/B ordering | R3.5 |

---

### Voice enrollment (signup sample)

1. Browser captures **5–10 s** mono audio; consent UI.
2. `POST /api/users/me/voice-enrollment` stores blob → `audioSampleUrl` (existing field) + triggers async **embedding job**.
3. Store **embedding** + `modelVersion` (+ optional pgvector column or related table).
4. **No enrollment** → Step 2 of resolution yields no match → **Step 3 guest clustering** applies.

**Important:** You still **do not** compare voice to **text** — only embedding-to-embedding.

---

### Post-meeting resolution pipeline (step-by-step)

1. **Diarization completes** — existing `performDiarization` → `assignSpeakersToUtterances` → `saveDiarizedOutputs`.
2. **Trigger** `SpeakerIdentityService.resolveMeeting(meetingId)` **async** (do not block MeetingBot shutdown): queue or `setImmediate`.
3. **Load** full meeting audio path + diarized JSON + workspace members.
4. **Run** enrollment matching then **Guest-A** clustering (section above).
5. **Persist** mappings + optional `transcript_resolved.json` **derived** file.
6. **Notify** frontend / invalidate cache so transcript review loads resolved names.
7. **`AIInsightsService`:** pass **`speakerDisplayMap`** into agents (preferred) or build resolved transcript string — **do not** fragile-replace `SPEAKER_00` in free text without map.

---

### Live names (optional, phased)

- **Phase 1:** No live voice ID; show **participant list** from Meet/Zoom if available.
- **Phase 2:** Debounced **LiveSpeakerWorker** (separate process/thread) + WebSocket `speaker_labels_update` — **same embedding model**, **same Guest-A logic** on rolling windows — expect **higher error rate**; feature-flag off by default.
- **Never** run heavy Python in the per-chunk transcription hot path.

---

### Master step-by-step implementation plan (ordered) (Feature 3)

| Step | Action | Module / area |
|------|--------|----------------|
| **S1** | Add feature flag `SPEAKER_IDENTITY_ENABLED` (default off) | Config |
| **S2** | Prisma: `user_speaker_embedding` (or child table); `meeting_speaker_mapping`; `meeting_guest_speakers` | Schema + migration |
| **S3** | Enrollment API + async embedding job | Routes + worker |
| **S4** | Implement `EmbeddingExtractor` + golden tests on fixed audio fixtures | `speakerIdentity/` |
| **S5** | Implement `ClusterIdentityResolver`: enrollment + **Guest-A** clustering | `speakerIdentity/` |
| **S6** | Wire `SpeakerIdentityService.resolveMeeting` after diarization finalize | `MeetingBot` / transcription finalize hook |
| **S7** | Populate `displaySpeaker` in API responses for transcript read | REST |
| **S8** | Transcript UI: show `displaySpeaker`; manual override → `method: manual` | Frontend |
| **S9** | Pass `speakerDisplayMap` to AI agents | `AIInsightsService` integration |
| **S10** | (Optional) Live worker + WS | Flagged |

---

### Risk register (must be analysed) (Feature 3)

| ID | Risk | Description | What to analyse |
|----|------|-------------|-----------------|
| **R3.1** | **False merge (two people → one Guest-A)** | `T_guest` too high merges different people. | ROC-style eval on held-out meetings; adjust `T_guest`; show confidence in UI. |
| **R3.2** | **False split (one person → Guest-A + Guest-B)** | `T_guest` too low duplicates one voice. | Same; consider **session-wide** re-clustering pass after all clusters known. |
| **R3.3** | **Short segments** | Embedding unstable <1–2 s speech. | Minimum duration gate; mark `low_confidence`; allow manual merge. |
| **R3.4** | **Centroid drift (EMA)** | Guest centroid moves toward wrong speaker if noise mis-assigned. | Cap updates; decay old windows; optional single final pass using full meeting. |
| **R3.5** | **Order sensitivity** | Guest-A/B assignment order affects labels if scores near threshold. | Fixed **chronological** sort; document; optional re-label after full pass. |
| **R3.6** | **Privacy / biometrics** | Voiceprints are sensitive; meeting audio processing needs legal basis. | DPIA; consent copy; purpose limitation; **delete embeddings** on account delete. |
| **R3.7** | **Privacy mode** | Meeting audio may still exist on disk; embeddings from sensitive segments. | Define policy: skip entire meeting vs skip intervals; align with `PrivacyModeService`. |
| **R3.8** | **Security** | Enrollment endpoint abuse (large uploads, spam). | Rate limits, size caps, MIME validation, auth. |
| **R3.9** | **Model drift** | Retrain or change embedding model breaks old vectors. | Store `modelVersion`; re-enroll prompt; migration path. |
| **R3.10** | **Operational cost** | Extra GPU/CPU per meeting. | Queue depth, timeouts, fallback to unresolved. |
| **R3.11** | **Downstream AI** | Wrong names poison summaries/participants agent. | Pass structured map; log mismatches; manual override priority. |
| **R3.12** | **Regression** | Bugs in resolver break meeting finalize. | Try/catch at service boundary; insights always scheduled. |

---

### Privacy, security, compliance (Feature 3)

- **Consent** for voice enrollment and for **meeting-scoped guest embeddings** (if stored beyond display-only).
- **Retention:** define TTL for `meeting_guest_speakers` rows and raw enrollment blobs.
- **Access control:** mappings are per **meeting** + **workspace** RBAC — same as transcript.
- **Deletion:** user account deletion removes enrollment embedding + audio sample; optional cascade re-resolution of past meetings (product decision).

---

### Testing, rollout, failure modes (Feature 3)

**Testing**

| Type | Covers |
|------|--------|
| Unit | Cosine sim, EMA update, greedy assignment, guest merge/split edge cases |
| Integration | Two-speaker fixture: two enrollments → two names; no enrollments → Guest-A/B |
| Regression | Flag off → identical diarization artefacts as today |

**Rollout checklist**

- [ ] Flag off in production until eval passes acceptance thresholds  
- [ ] Internal dogfood with **manual override** enabled  
- [ ] Monitor false merge/split rates via user corrections  

**Failure modes**

| Situation | Behaviour |
|-----------|-----------|
| Extractor down | `unresolved`; raw labels hidden only if product shows neutral placeholder |
| No audio file | Skip resolution; log |
| Manual override | Overrides auto for `clusterLabel`; persisted |

---

*Document version: 1.2 — April 4, 2026*
