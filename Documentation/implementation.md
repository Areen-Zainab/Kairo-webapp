# Implementation Guide & Status: Memory Graph, Live Action Items & Speaker Identity

This document serves as the architectural reference and current physical status of the three core Kairo features: (1) Knowledge Graph click-to-expand, (2) Live Action Items, and (3) Speaker Identity/Diarization. 

The implementation details reflect the true repository structure (e.g., identity services living natively in `backend/src/services` rather than isolated packages) bridging theoretical boundaries.

---

## Document Map

| Section | Contents | Status |
|---------|----------|--------|
| [Feature 1: Knowledge Graph Expand](#feature-1-knowledge-graph-click-to-expand) | Design, **Implementation Status**, Remaining Tasks & Impact | ❌ Not Started |
| [Feature 2: Live Action Items](#feature-2-live-action-items-during-meeting) | Design, **Implementation Status**, Remaining Tasks & Impact | 🟨 Partially Complete |
| [Feature 3: Speaker Identity & Guest Clusters](#feature-3-speaker-diarization-identity-resolution--meeting-scoped-guests) | Full pipeline, **Implementation Status**, Remaining Tasks & Impact | 🟩 Largely Complete |

---

## Design Principles

1. **Additive Modules First:** Prefer new hooks / thin wrappers over edits deep inside shared services.
2. **No Silent Behavior Change:** Default behavior when flags/state are empty must match today.
3. **Single Responsibility:** Isolate logic (e.g., Graph merging belongs in memory UI layer; Live extraction policy belongs next to the bot interval).

---

## Feature 1: Knowledge Graph Click-to-Expand

### Implementation Status
* **State:** **Unimplemented (0%)**. 
* **Current Code:** The UI fetches graph data once via `useGraphData` and statically displays it. The `useGraphExpansion.ts` hook has not been scaffolded, and `MemoryView.tsx` does not listen for expansion clicks to merge `getNodeNeighbours` payloads.

### Remaining To-Do Items & Impact

| Task | Need / Impact |
|------|---------------|
| **1. Create `useGraphExpansion.ts` Hook** | **High** - Required to manage the merging of neighbor nodes natively without mutating the original `useGraphData` context. Prevents redundant API calls by locally caching `expandedNodeIds`. |
| **2. API Contract Validation** | **Low** - Confirm the backend `getNodeNeighbours` response perfectly parallels standard `GraphData` objects so UI rendering limits aren't violated. |
| **3. Update `MemoryView.tsx` Click Handlers** | **High** - Replaces base graph variables passed into `GraphCanvas` with the overlay-merged `displayGraphData`. Binds `expandFromNode(id)`. |
| **4. Edge Case Policies (Filters / Spoilage)** | **Medium** - Filtering neighbor expansions preserves UX cohesion. If expansion injects node types deliberately hidden by global UI filters, users will experience disjointed logic. Policies must execute `applyFilters` on the merged stack. |

### Technical Design (How to Implement)

#### A. New hook: `useGraphExpansion`
It must hold accumulated expansion state and merge logic safely.
- **State Objects:** `expandedNodes`, `expandedEdges`, `expandedNodeIds` (to prevent duplicate recursive loops).
- **Methods:** `expandFromNode(nodeId, workspaceId, depth)` and `clearExpansions()`.
- **Merge logic:** Build a Map from base active nodes. Overlay fetched neighboring nodes into it (deduplicating by ID). Apply the identical process to edge nodes.
- **Yield:** `displayGraphData = mergeGraphData(filteredBaseFromUseGraphData, { nodes: expandedNodes, edges: expandedEdges })`

#### B. Component Edits (`MemoryView.tsx`)
1. Import `useGraphExpansion`.
2. Pass `displayGraphData` instead of the rigid `graphData` base to the rendering canvas and related Focus/AI modal views.
3. Hook `handleNodeClick` to dynamically trigger `expandFromNode`.
4. Tie `clearExpansions()` to workspace state changes or manual view reset arrays.

---

## Feature 2: Live Action Items (During Meeting)

### Implementation Status
* **State:** **Partially Complete (~80%)**.
* **Current Code:** The background periodic live extraction pipeline is fully built within `MeetingBot.js` (defaulting to a 30s cron). `ActionItemService.extractAndUpdateActionItems` natively handles chunk deduplication via `canonicalKey` rules and emits realtime JSON payloads to `WebSocketServer`. The frontend receives these broadcasts via the `useActionItems` hook. 
* **Missing:** The strict `PrivacyModeService` compliance block at the top of the interval array in `MeetingBot`.

### Remaining To-Do Items & Impact

| Task | Need / Impact |
|------|---------------|
| **1. Implement Privacy Mode Guard** | **Critical** - If privacy mode is enabled mid-meeting, the bot's interval loop natively reads the file regardless. This bypasses compliance intents and exposes sensitive intervals to external LLM calls. |
| **2. Validate UI Hook Mount States** | **Medium** - Ensure the live meeting sidebar dynamically mounts the `useActionItems` hook properly during capture operations. If left unmounted, background API events fire without the UI parsing the WebSocket payload. |

### Technical Design (How to Implement)

1. **`MeetingBot.js` Guard:** Formally inject `if (await PrivacyModeService.isEnabled(this.meetingId)) return;` at the very beginning of the extraction `setInterval` trigger string (around line 830).
2. **`ActionItemService.js` Guard:** Add a duplicate validation sequence inside the initial functional block as a hard defense-in-depth tactic for anomalous direct class calls.
3. **Reconciliation:** Analyze output when `AIInsightsService` performs its grand post-meeting crawl to ensure log streams visibly indicate overlap skipping rather than overwriting matching `canonicalKey` data records.

---

## Feature 3: Speaker Diarization, Identity Resolution & Meeting-Scoped Guests

### Implementation Status
* **State:** **Largely Complete (~90%)**.
* **Current Code:** The architectural biometric routing resides natively within `backend/src/services/`. `SpeakerMatchingEngine.js` operates the 4-tier resolution engine gracefully. `SpeakerIdentificationService.js` manages legal consent paths, database mapping arrays, and the highly complex `cascadeNameUpdate` protocol to synchronize the JSON outputs upon manual UI overrides.

### Remaining To-Do Items & Impact

| Task | Need / Impact |
|------|---------------|
| **1. Phase 2: Live Identification Pipelines** | **Low** - Presently, accurate biometric resolution exclusively evaluates via post-meeting analysis. Running 3-second live window arrays against LLM identification arrays (`LiveSpeakerWorker`) generates excessive CPU bottlenecking with severe failure frequencies. |
| **2. Formal Vector Cleanup (TTL Cron Jobs)** | **Medium** - Necessitates automated worker jobs prioritizing the chronological purges of orphaned `meeting_guest_speakers` vectors once accounts eclipse their legal maximum retention boundaries (GDPR/BIPA structures). |

### Technical Design (System Reality)

#### A. Architectural Layout
Identity processing is strictly detached from the core real-time transcription layer. Processes trigger entirely through native Node.js delegates managing subprocesses over Python and FFmpeg:
- `SpeakerIdentificationService.js`: Presides over consent validations, inserts `pgvector` relations recursively, and commands string manipulation to push manual overrides identically across Action Items, raw `transcript.json` arrays, Insights strings, and memory node entities.
- `SpeakerMatchingEngine.js`: Scans the comprehensive meeting audio footprint asynchronously tracking overlapping `faster-whisper` timelines with Voice Embeddings.
- `VoiceEmbeddingBridge`: Pipes logic to the raw py-script executing `SpeechBrain` outputs locally.

**Note:** The system evolved safely to centralize directly inside the `services/` directory layout. Expanding an artificial `speakerIdentity/` module is unnecessary and should be avoided.

#### B. The Guest Clustering Algorithm (Fully Implemented)
When `SpeakerMatchingEngine.js` triggers post-meeting:
1. **Enrollment Check:** Validates workspace vectors querying users who submitted voice footprints.
2. **Tier 1 Extraction:** Validates FFmpeg audio fractions against active `pgvector` arrays dynamically.
3. **Tier 3 Historical Recall:** Navigates past local meetings checking if specific users have priorly matched to raw `SPEAKER_XX` instances.
4. **Local Biometric Clusters (Guest-A/B Fallbacks):** Unmatched strings execute algorithmic vector centroids. The signature saves dynamically as internal labels (e.g. `Guest A`), applying uniform tagging to all instances hitting the cosine similarity ranges during that unique session lifecycle.

#### C. Manual Cascades (Fully Implemented)
Manually overriding an assigned `Guest-A` tag with a verified profile calls the `cascadeNameUpdate()` routine. This initiates an immediate database lock overwriting SQL entities, disk-cached JSONs, and Memory Array attributes to physically embed Truth values universally before AI Agents parse the information locally.

#### D. System Stability (Failsafes)
During biometric extraction, if the bridging python architecture aborts anomalously, `SpeakerMatchingEngine` explicitly defaults error structures to Tier 4 `unresolved` payloads. This preserves structural dependencies universally defaulting variables down to "Speaker" UI elements rather than aborting the insights process globally.
