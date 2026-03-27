# Memory Engine & Knowledge Graph — Implementation Plan

**Project:** Kairo  
**Created:** March 26, 2026  
**Status:** Planning — Do Not Begin Implementation Without Review

---

## Executive Summary

This document covers two related but distinct features:

1. **Memory Engine (Embedding Pipeline)** — Confirming that the repo's existing embedding pipeline is reliably and safely triggered when meetings are completed or regenerated, and hardening it against duplicates.
2. **Knowledge Graph (Memory Graph UI)** — Exposing a workspace-scoped backend graph API that replaces the current frontend mock graph with real nodes/edges derived from existing DB tables (`meetings`, `meeting_memory_contexts`, `ai_insights`, `action_items`, etc.).

> [!IMPORTANT]
> The Memory Engine part should be hardened first because the Knowledge Graph will depend on `meeting_embeddings` / `meeting_memory_contexts` being consistent and queryable.

---

## What Already Exists (Do Not Rebuild)

### Memory Engine — Already Built
| File | Status | Notes |
|---|---|---|
| `EmbeddingService.js` | ✅ Complete | Uses `@xenova/transformers` + `all-MiniLM-L6-v2` (local, 384-dim, no API key needed) |
| `MeetingEmbeddingService.js` | ✅ Complete | `embedTranscript()`, `embedSummary()`, batch chunking, raw pgvector SQL inserts |
| `meeting_embeddings` table | ✅ Complete | pgvector column, content type, chunk index, metadata JSONB |
| `GET /api/workspaces/:id/memory/search` | ✅ Complete | Semantic search endpoint is live |

### Knowledge Graph — Already Built (Frontend Only)
| File | Status | Notes |
|---|---|---|
| `MemoryView.tsx` | ✅ UI Shell | Graph canvas with filters, query bar, FAB |
| `MemoryTab.tsx` | ✅ UI Shell | Sidebar tab in live meeting view |
| `MemoryFAB.tsx`, `MemoryFilterBar.tsx`, `MemoryQueryBar.tsx` | ✅ UI Shell | UI wired to `memoryAPI.ts` |
| `useGraphData.ts` | ⚠️ Mock | Builds a hardcoded graph client-side; does not call backend |
| `useQueryMemory.ts` | ⚠️ Mock | Simulates semantic search results; does not call backend |
| `memoryAPI.ts` | ⚠️ Mock | Most methods are stubbed / hardcoded |

---

## Part 1: Memory Engine Completion

### Problem Statement
In this repo, `AIInsightsService.generateInsights()` already runs the Memory Engine:
it embeds meeting transcripts and upserts `meeting_memory_contexts` as part of the insights pipeline.

What still needs hardening/completion for a production-safe Memory Engine:
1) transcript embedding idempotency (regeneration currently risks duplicating `meeting_embeddings` rows)
2) stronger step isolation (ensure failures in one embedding step do not block the rest of the engine)
3) missing "context/related" read APIs and any optional population of `meeting_relationships` (needed for richer graph navigation)

### Estimated Effort: 3–5 days

---

### Step 1.1 — Wire Embeddings into Post-Meeting Pipeline

**Target File:** `backend/src/services/AIInsightsService.js`

In the current repo, embedding generation is already implemented inside `AIInsightsService.generateInsights()` under the "MEETING MEMORY ENGINE" section:
- `MeetingEmbeddingService.embedTranscript(...)`
- `MeetingEmbeddingService.generateMemoryContext(...)`

**Goal (non-disruptive):**
- Confirm embedding generation stays **non-fatal** for meeting completion (embedding errors should not break the API request / status updates).
- Ensure embedding failures in one sub-step (e.g., transcript embedding) do not prevent memory-context generation.
- Ensure both "normal completion" and the `POST /api/meetings/:id/ai-insights/regenerate` flow regenerate embeddings/context in a controlled way (see Step 1.2 for idempotency).

**Risk:** If embedding errors bubble up, meeting completion/regeneration could be marked as failed.

**Checkpoint:** Run one normal meeting completion and one force-regenerate; verify:
1) `meeting_embeddings` and `meeting_memory_contexts` update
2) no unbounded duplicate growth occurs after repeated regeneration

---

### Step 1.2 — Audit MeetingEmbeddingService

**Target File:** `backend/src/services/MeetingEmbeddingService.js`

Verify the following before calling it from production:

| Check | What to Verify |
|---|---|
| Idempotency | `embedTranscript()` is insert-only today. For regeneration, prevent unbounded growth by deleting existing `meeting_embeddings` rows for the meeting (at least `content_type='transcript'`) before re-inserting, or introduce a `force`/`upsert` option. |
| Error isolation | Ensure transcript embedding failures do not prevent memory-context generation. Use separate try/catch blocks for transcript embedding vs memory-context upsert. |
| Empty content | Confirm guards handle `null/undefined/empty` transcript text safely (should return without throwing). |
| Dimension mismatch | Schema uses 384-dim; `EmbeddingService` produces 384-dim (✅ match) |

**Manual regeneration (prefer reuse existing endpoint):**
```
POST /api/meetings/:id/ai-insights/regenerate
```

This already forces re-running `AIInsightsService.generateInsights()` (including the Memory Engine). If later you need "embeddings/context only" regeneration without re-generating insights, implement it as a thin wrapper around the embedding steps with the idempotency safeguards above.

---

### Step 1.3 — Build MemoryContextService

**New File:** `backend/src/services/MemoryContextService.js`

This service provides **read/query** capabilities for the Memory Engine, so other services (notably the graph assembler) can fetch consistent "memory context" data without duplicating embedding/vector logic.

**Methods to implement:**

#### `getMeetingContext(meetingId)`
- Load the existing `meeting_memory_contexts` row (key topics, key decisions, participants, meeting_context).
- Load meeting metadata needed by the graph UI (title, start_time/end_time/duration).
- Load a short transcript snippet from `meeting_embeddings` (`content_type='transcript'`) for the "Notes & Context" panel.
- Return a normalized DTO that the graph assembly layer can use directly.

#### `findRelatedMeetings(meetingId, options = { limit: 5, threshold: 0.75 })`
- Optional enhancement: compute semantic similarity using `meeting_memory_contexts.summary_embedding`.
- If implemented, persist results to `meeting_relationships` for later neighborhood expansion.

**Requires:** No schema changes (tables already exist in `schema.prisma`); focus on query correctness + safe parsing.

---

### Step 1.4 — Database Schema Additions

No new models/migrations are required for the first iteration because `schema.prisma` already includes:
- `MeetingMemoryContext`
- `MeetingRelationship`

Action items instead:
1. Verify the DB has `meeting_memory_contexts.summary_embedding vector(384)` (Prisma treats it as an unsupported type and raw SQL writes it).
2. Verify the vector index exists (or add it with a one-time raw SQL migration if missing).
3. Ensure `MeetingEmbeddingService.generateMemoryContext()` and any future cosine similarity code use the same dimensionality (384).

---

### Step 1.5 — Related Meetings API Routes

Add these under the existing `memoryRoutes.js` router (it already uses workspace-scoped auth and matches the pattern used by `/memory/search`):

```
GET  /api/workspaces/:workspaceId/memory/meetings/:meetingId/context  -> full meeting context for node details
GET  /api/workspaces/:workspaceId/memory/meetings/:meetingId/related -> related meetings (from meeting_relationships if populated; else on-demand fallback computation)
POST /api/workspaces/:workspaceId/memory/meetings/:meetingId/embeddings/rebuild -> optional (if you later implement embeddings-only rebuild)
```

**Route-level risk:** These are read-heavy. Add a simple in-memory LRU cache (5-minute TTL) for the `/related` and `/context` responses to avoid repeated pgvector scans.

---

### Memory Engine Completion Checklist

```
[x] Audit MeetingEmbeddingService for idempotency + error isolation
[x] Verify AIInsightsService "MEETING MEMORY ENGINE" wiring covers both normal completion and `POST /api/meetings/:id/ai-insights/regenerate`
[x] Add transcript-embedding idempotency so force regeneration does not create unbounded duplicates
[x] Implement MemoryContextService read helpers: `getMeetingContext` (incl. transcript snippet)
[x] Add `memoryRoutes.js` endpoints for `/api/workspaces/:workspaceId/memory/meetings/:meetingId/context` and `/related`
[x] Related endpoint: implemented with on-demand fallback computation when `meeting_relationships` is empty
[ ] Optional: implement embeddings/context-only rebuild endpoint (otherwise rely on `ai-insights/regenerate`)
[ ] Manual test: normal completion + force regenerate -> confirm tables update safely and context endpoints return correct payloads
```

---

## Part 2: Knowledge Graph

### Problem Statement
The frontend `MemoryView.tsx` renders the Memory Graph UI, but the current graph data source is mock-driven:
- `useGraphData.ts` generates a hardcoded graph client-side
- `useQueryMemory.ts` simulates search results
- `memoryAPI.ts` remains mostly stubbed

On the backend, only the semantic search route (`GET /api/workspaces/:workspaceId/memory/search`) exists. There is no backend graph assembly/graph-data route yet.

### Estimated Effort: 1–2 weeks

---

### Step 2.1 — Graph Data Strategy (Query-time Assembly First)

> [!NOTE]
> For this repo, the first implementation should avoid a disruptive "graph persistence" Prisma migration.
> Build the workspace graph response by assembling nodes/edges at query-time from existing tables (`meetings`, `meeting_memory_contexts`, `ai_insights`, `action_items`, etc.).
>
> The following Prisma schema is an optional later optimization, not required for the initial graph UI to work.

```prisma
model GraphNode {
  id          String   @id @default(uuid())
  workspaceId Int      @map("workspace_id")
  nodeType    String   @map("node_type") // 'meeting' | 'participant' | 'topic' | 'decision' | 'task'
  label       String
  data        Json?    // Type-specific payload (meetingId, userId, decision text, etc.)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  workspace   Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  outEdges    GraphEdge[] @relation("SourceNode")
  inEdges     GraphEdge[] @relation("TargetNode")

  @@index([workspaceId])
  @@index([nodeType])
  @@map("graph_nodes")
}

model GraphEdge {
  id         String   @id @default(uuid())
  sourceId   String   @map("source_id")
  targetId   String   @map("target_id")
  edgeType   String   @map("edge_type") // 'attended' | 'discussed' | 'decided' | 'assigned' | 'related_to'
  weight     Float    @default(1.0)
  metadata   Json?
  createdAt  DateTime @default(now()) @map("created_at")

  source     GraphNode @relation("SourceNode", fields: [sourceId], references: [id], onDelete: Cascade)
  target     GraphNode @relation("TargetNode", fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([sourceId, targetId, edgeType])
  @@map("graph_edges")
}
```

**Edge type semantics:**

| Edge Type | Source -> Target | Meaning |
|---|---|---|
| `meeting-topic` | Meeting -> Topic | Meeting covered this topic |
| `meeting-member` | Meeting -> Member | Team member participated in this meeting |
| `topic-decision` | Topic -> Decision | Decision associated with a topic (best-effort) |
| `action-member` | Action -> Member | Assignee owns this action item |

---

### Step 2.2 — Memory Graph Assembly Service

**New File:** `backend/src/services/MemoryGraphAssemblyService.js`

Called on-demand by the graph routes to assemble the workspace graph response from existing tables.

```
MemoryGraphAssemblyService.getWorkspaceGraph(workspaceId, filters)
  ├── selectCandidateMeetings(workspaceId, caps)
  ├── load meeting_memory_contexts (key_topics, key_decisions, meeting_context)
  ├── load meeting_participants + workspace members
  ├── load action_items (pending/confirmed) and resolve assignees
  ├── build logical nodes:
  │     meeting:${meetingId}, topic:${workspaceId}:${topicIndex}, decision:${meetingId}:${index}, action:${actionItemId}, member:${userId}
  └── build edges compatible with `frontend/src/components/workspace/memory/types.ts`:
        ├── meeting-topic
        ├── meeting-member
        ├── topic-decision (best-effort; may be omitted if mapping is unavailable)
        └── action-member
```

**Key design rules:**
- **Capping:** cap meetings and total returned nodes/edges so `GraphCanvas` stays responsive.
- **Stable ids:** use deterministic ids so repeated calls produce consistent nodes/edges (important for filtering and focus mode).
- **Best-effort edges:** if a mapping (e.g., topic-to-decision) is not reliably derivable from stored payloads, omit it rather than guessing wrong.

---

### Step 2.3 — Memory Graph Query Helpers

**New File (optional):** `backend/src/services/MemoryGraphQueryService.js`

Provides small read-only helpers used by the graph routes (stats, optional neighborhood expansion).

```js
getWorkspaceGraph(workspaceId, filters)
// thin wrapper around MemoryGraphAssemblyService.getWorkspaceGraph()

getGraphStats(workspaceId)
// Returns { totalNodes, totalEdges, byType: { meeting, topic, decision, action, member }, lastUpdate }

// Optional (later):
getNodeNeighbours(nodeId, depth = 1)
// returns a subgraph for click-to-expand behavior
```

**Performance note:** For large workspaces, `getWorkspaceGraph` should paginate or cap at ~200 nodes. Add a `limit` parameter and a `cursor`-based pagination option.

---

### Step 2.4 — Graph API Routes (under `memoryRoutes.js`)

No disruptive graph-table schema is required for the first iteration. Add workspace-scoped graph endpoints alongside the existing semantic search route in `backend/src/routes/memoryRoutes.js`.

Endpoints:
```
GET  /api/workspaces/:workspaceId/memory/graph
  -> returns { nodes, edges } for Memory Graph (built at query-time)

GET  /api/workspaces/:workspaceId/memory/graph/stats
  -> returns the `WorkspaceMemory` shape used by MemoryView.tsx

// Optional later:
GET  /api/workspaces/:workspaceId/memory/graph/node/:nodeId/neighbours?depth=2
  -> returns a subgraph for click-to-expand
```

---

### Step 2.5 — Frontend Wiring

In the current repo, the Memory Graph UI is powered by mocks:
- `useGraphData.ts` (hardcoded graph data + client-side filters)
- `useQueryMemory.ts` (simulated semantic search)

Update wiring to replace `useGraphData.ts` data source with backend endpoints:

1. Update `useGraphData.ts` to fetch from:
   - `GET /api/workspaces/:workspaceId/memory/graph`
   - optionally apply the existing client-side filters (`nodeTypes`, keyword search, date range) to the returned logical nodes/edges.
2. Update `MemoryView.tsx` to:
   - use `workspaceId` from the URL (`/workspace/:workspaceId/memory`)
   - fetch the top-right stats from `GET /api/workspaces/:workspaceId/memory/graph/stats` (replace the current hardcoded `workspaceMemory`)
   - show loading/empty states based on the backend response (`nodes.length === 0`).

For `useQueryMemory.ts`:
 - keep mocked initially (UI can function without query-to-node focus)
 - optionally integrate later with `GET /api/workspaces/:workspaceId/memory/search` and map search hits into the graph node ids.

---

### Knowledge Graph Checklist

```
[ ] Implement query-time graph assembly (no new graph-table Prisma migration required)
[x] Implement query-time graph assembly (no new graph-table Prisma migration required)
[x] Implement `GET /api/workspaces/:workspaceId/memory/graph` and `GET /api/workspaces/:workspaceId/memory/graph/stats`
[x] Implement `MemoryGraphAssemblyService` to build nodes/edges from existing tables (`meetings`, `meeting_memory_contexts`, `action_items`)
[x] Update `frontend/src/hooks/useGraphData.ts` to fetch backend graph and apply client-side filters
[x] Update `frontend/src/pages/workspace/MemoryView.tsx` to use real `workspaceId` + backend stats and show loading/empty states
[ ] Optional: add `/memory/graph/node/:nodeId/neighbours?depth=2` for click-to-expand behavior
[ ] Manual test: complete or regenerate a meeting -> open Memory Graph -> verify nodes and `ContextPanel` details
[ ] Stress test: workspace with 20+ meetings -> verify endpoint caps and GraphCanvas remains responsive
```

---

## Sequencing and Dependencies

```
Week 1
  ├── Audit existing AIInsightsService "MEETING MEMORY ENGINE" wiring
  ├── Make transcript embeddings regeneration-safe (idempotency + error isolation)
  └── Implement MemoryContextService read helper(s) and `/memory/meetings/:meetingId/context` route(s)

Week 2
  ├── Optional: implement related-meetings computation (populate `meeting_relationships`)
  ├── Implement query-time graph endpoints: `/memory/graph` + `/memory/graph/stats`
  └── Manual end-to-end test: meeting completion -> graph endpoint returns nodes/edges

Week 3
  ├── Replace `useGraphData.ts` mock with backend fetch + frontend layout adapter
  ├── Replace `MemoryView.tsx` mock stats with backend stats + use real `workspaceId`
  └── Manual test: nodes/edges render and `ContextPanel` details match stored data

Week 4
  ├── Optional: connect query bar to backend semantic search and drive graph highlight/focus
  └── Optional: implement click-to-expand neighbours + caching/pagination hardening
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Transcript re-embedding can create duplicate `meeting_embeddings` rows | High | High | Make `embedTranscript()` regeneration-safe (delete old transcript chunks for `meeting_id` before insert, or add a force/upsert strategy) |
| Graph assembly can be slow if it loads too much data per request | Medium | High | Cap meetings/nodes returned by `/memory/graph` and add server-side limits; consider short TTL caching per workspace |
| Backend payload shape mismatch vs `MemoryNode`/`MemoryEdge` expectations | Medium | High | Keep a frontend adapter layer; validate required fields; fail gracefully with an empty graph instead of crashing |
| Decision/topic mapping may not support `topic-decision` edges reliably | Medium | Medium | Treat `topic-decision` edges as best-effort; omit missing edges rather than inventing relationships |
| Incomplete embedded data (meetings without `meeting_memory_contexts` yet) | Low | Medium | Filter graph candidates to meetings with `meeting_memory_contexts` (or handle missing context by showing only meeting/member/action nodes) |
| Missing authorization checks on workspace-scoped graph endpoints | Low | High | Ensure endpoints reuse existing `authenticateToken` + workspace member validation patterns |

---

## Key Files Reference

| File | Action | Notes |
|---|---|---|
| `backend/src/services/AIInsightsService.js` | **Modify** | Ensure Memory Engine step isolation + non-fatal embedding generation |
| `backend/src/services/MeetingEmbeddingService.js` | **Modify** | Make `embedTranscript()` regeneration-safe (avoid duplicate growth) |
| `backend/src/services/MemoryContextService.js` | **Create** | `getMeetingContext` (+ optional transcript snippet) and optional `findRelatedMeetings` |
| `backend/src/services/MemoryGraphAssemblyService.js` | **Create** | Query-time workspace graph assembly (logical nodes/edges) |
| `backend/src/services/MemoryGraphQueryService.js` | **Create (optional)** | `getGraphStats` and optional neighbor expansion helpers |
| `backend/src/routes/memoryRoutes.js` | **Modify** | Add `/memory/graph` and `/memory/graph/stats` endpoints |
| `frontend/src/hooks/useGraphData.ts` | **Modify** | Replace mock graph with backend fetch + client-side layout/styling |
| `frontend/src/pages/workspace/MemoryView.tsx` | **Modify** | Use `workspaceId` from route + show real stats/loading/empty states |
| `frontend/src/hooks/useQueryMemory.ts` | **Modify (optional)** | Optionally wire query bar to backend semantic search later |
