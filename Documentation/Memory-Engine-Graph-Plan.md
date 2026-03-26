# Memory Engine & Knowledge Graph — Implementation Plan

**Project:** Kairo  
**Created:** March 26, 2026  
**Status:** Planning — Do Not Begin Implementation Without Review

---

## Executive Summary

This document covers two related but distinct features:

1. **Memory Engine (Embedding Pipeline)** — Wiring the *already-built* embedding infrastructure into the post-meeting pipeline so that every completed meeting is automatically indexed for semantic search.
2. **Knowledge Graph** — Building the backend schema, construction service, API routes, and wiring the frontend away from mock data to a real, queryable graph of meetings, participants, topics, and decisions.

> [!IMPORTANT]
> The Memory Engine must be completed **before** the Knowledge Graph, as the graph will consume the embedding relationships that the engine produces.

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
| `useQueryMemory.ts` | ✅ Hook | Wired to mock API |
| `memoryAPI.ts` | ⚠️ Mock | All methods return hardcoded empty arrays / fake stats |

---

## Part 1: Memory Engine Completion

### Problem Statement
`EmbeddingService` and `MeetingEmbeddingService` are fully built but **no code calls them after a meeting ends**. The `PostMeetingProcessor.convertToTasks()` is a stub. Embeddings are never generated for real meetings.

### Estimated Effort: 3–5 days

---

### Step 1.1 — Wire Embeddings into Post-Meeting Pipeline

**Target File:** `backend/src/services/AIInsightsService.js`

After AI insights are successfully saved to the database (at the end of `generateInsights()`), add a non-blocking call:

```js
// at the bottom of AIInsightsService.generateInsights(), after saving insights
try {
  const MeetingEmbeddingService = require('./MeetingEmbeddingService');
  // Fire and forget — do not await; do not block the insights response
  MeetingEmbeddingService.generateMeetingEmbeddings(meetingId)
    .then(() => console.log(`[Memory] Embeddings generated for meeting ${meetingId}`))
    .catch(err => console.error(`[Memory] Embedding generation failed for meeting ${meetingId}:`, err.message));
} catch (err) {
  console.warn('[Memory] Could not load MeetingEmbeddingService:', err.message);
}
```

**Risk:** `MeetingEmbeddingService.generateMeetingEmbeddings()` needs to be verified to handle partial data gracefully (e.g., meeting with no notes, no action items).

**Checkpoint:** After wiring, trigger AI insights for a test meeting and confirm `meeting_embeddings` rows are inserted.

---

### Step 1.2 — Audit MeetingEmbeddingService

**Target File:** `backend/src/services/MeetingEmbeddingService.js`

Verify the following before calling it from production:

| Check | What to Verify |
|---|---|
| Idempotency | Does it skip re-embedding if embeddings already exist? Add a check: `if existing rows > 0 and !force, return early` |
| Error isolation | Does a failure in `embedTranscript` prevent `embedSummary` from running? Wrap each step in its own try/catch |
| Empty content | Does it crash if there's no transcript text? Add guards |
| Dimension mismatch | Schema uses 384-dim; `EmbeddingService` produces 384-dim (✅ match) |

**Add a manual regeneration endpoint:**
```
POST /api/meetings/:id/regenerate-embeddings
```
Useful for back-filling older meetings and debugging.

---

### Step 1.3 — Build MemoryContextService

**New File:** `backend/src/services/MemoryContextService.js`

This service aggregates a meeting's embedding data into a single queryable "memory context" and detects related meetings.

**Methods to implement:**

#### `buildMeetingContext(meetingId)`
- Fetches all `meeting_embeddings` rows for the meeting.
- Fetches AI insights (topics, decisions, participants).
- Constructs a condensed plaintext context string.
- Generates one summary embedding for the whole meeting.
- Upserts a `meeting_memory_contexts` row.

**Requires:** Add `meeting_memory_contexts` table to Prisma schema (see schema below).

#### `findRelatedMeetings(meetingId, options = { limit: 5, threshold: 0.75 })`
- Reads this meeting's summary embedding from `meeting_memory_contexts`.
- Runs a pgvector cosine similarity search against all other meetings in the same workspace.
- Also scores by shared topics (from `ai_insights`) and shared participants.
- Composite score = `0.5 × vectorSimilarity + 0.3 × topicOverlap + 0.2 × participantOverlap`
- Upserts results into `meeting_relationships` table.

**Requires:** Add `meeting_relationships` table (see schema below).

---

### Step 1.4 — Database Schema Additions

Add these two models to `schema.prisma`:

```prisma
model MeetingMemoryContext {
  id               String   @id @default(uuid())
  meetingId        Int      @unique @map("meeting_id")
  keyTopics        String[] @map("key_topics")
  keyDecisions     Json?    @map("key_decisions")
  participants     String[]
  meetingContext   String   @db.Text @map("meeting_context")
  embeddingCount   Int      @default(0) @map("embedding_count")
  // summary embedding stored via raw SQL (unsupported type in Prisma)
  lastProcessedAt  DateTime @updatedAt @map("last_processed_at")
  createdAt        DateTime @default(now()) @map("created_at")

  meeting          Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  @@map("meeting_memory_contexts")
}

model MeetingRelationship {
  id                 String   @id @default(uuid())
  sourceMeetingId    Int      @map("source_meeting_id")
  targetMeetingId    Int      @map("target_meeting_id")
  relationshipType   String   @map("relationship_type") // 'similar' | 'follow_up' | 'shared_participants'
  similarityScore    Float    @map("similarity_score")
  sharedTopics       String[] @map("shared_topics")
  sharedParticipants String[] @map("shared_participants")
  createdAt          DateTime @default(now()) @map("created_at")

  sourceMeeting      Meeting  @relation("SourceMeeting", fields: [sourceMeetingId], references: [id], onDelete: Cascade)
  targetMeeting      Meeting  @relation("TargetMeeting", fields: [targetMeetingId], references: [id], onDelete: Cascade)

  @@unique([sourceMeetingId, targetMeetingId])
  @@map("meeting_relationships")
}
```

Also add the summary embedding column via raw SQL migration (Prisma does not support `vector` type natively):
```sql
ALTER TABLE meeting_memory_contexts 
ADD COLUMN summary_embedding vector(384);

CREATE INDEX meeting_memory_contexts_embed_idx 
ON meeting_memory_contexts 
USING hnsw (summary_embedding vector_cosine_ops);
```

---

### Step 1.5 — Related Meetings API Routes

Add to `meetingRoutes.js` or a new `memoryRoutes.js`:

```
GET  /api/meetings/:id/related          → list related meetings (from meeting_relationships)
GET  /api/meetings/:id/context          → full memory context (MemoryContextService.getMeetingMemory)
POST /api/meetings/:id/regenerate-embeddings  → force re-embed
```

**Route-level risk:** These are read-heavy. Add a simple in-memory LRU cache (5-minute TTL) for the `/related` and `/context` responses to avoid repeated pgvector scans.

---

### Memory Engine Completion Checklist

```
[ ] Audit MeetingEmbeddingService for idempotency + error isolation
[ ] Wire MeetingEmbeddingService into AIInsightsService (fire-and-forget)
[ ] Add meeting_memory_contexts Prisma model + raw-SQL vector column
[ ] Add meeting_relationships Prisma model
[ ] Run prisma migrate dev
[ ] Build MemoryContextService (buildMeetingContext + findRelatedMeetings)
[ ] Wire MemoryContextService into post-embedding step
[ ] Add POST /api/meetings/:id/regenerate-embeddings
[ ] Add GET /api/meetings/:id/related
[ ] Add GET /api/meetings/:id/context
[ ] Manual test: complete a meeting → check meeting_embeddings, meeting_memory_contexts, meeting_relationships rows
```

---

## Part 2: Knowledge Graph

### Problem Statement
The frontend `MemoryView.tsx` (graph canvas) and its hook `useQueryMemory.ts` are fully built but connected to `memoryAPI.ts`, which returns empty arrays and hardcoded mock stats. No backend graph schema, construction logic, or routes exist.

### Estimated Effort: 1–2 weeks

---

### Step 2.1 — Graph Database Schema

**New Prisma models:**

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

| Edge Type | Source → Target | Meaning |
|---|---|---|
| `attended` | Participant → Meeting | User attended meeting |
| `discussed` | Meeting → Topic | Meeting covered this topic |
| `decided` | Meeting → Decision | Meeting produced this decision |
| `assigned` | Participant → Task | User owns this action item |
| `related_to` | Meeting → Meeting | Semantically similar meetings |

---

### Step 2.2 — GraphConstructionService

**New File:** `backend/src/services/GraphConstructionService.js`

Called once per meeting after AI insights complete (fire-and-forget, same pattern as embedding trigger).

```
GraphConstructionService.buildGraphForMeeting(meetingId)
  │
  ├── buildOrFetchMeetingNode(meeting)      → GraphNode (type: meeting)
  ├── buildParticipantNodes(participants)   → GraphNode[] (type: participant)
  ├── buildTopicNodes(topics)              → GraphNode[] (type: topic)
  ├── buildDecisionNodes(decisions)        → GraphNode[] (type: decision)
  ├── buildTaskNodes(actionItems)          → GraphNode[] (type: task)
  │
  └── createEdges()
        ├── participant → meeting  (attended)
        ├── meeting → topic        (discussed)
        ├── meeting → decision     (decided)
        ├── participant → task     (assigned)
        └── meeting → relatedMeeting (related_to, from MeetingRelationship table)
```

**Key design rules:**
- **Upsert, never insert blindly.** Topics especially will recur across meetings. Match by `(workspaceId, nodeType, label)` and upsert.
- **Edges are idempotent.** Use the `@@unique([sourceId, targetId, edgeType])` constraint.
- **Participants:** Match by participant name against workspace users. If no match, create an anonymous participant node.

---

### Step 2.3 — GraphQueryService

**New File:** `backend/src/services/GraphQueryService.js`

Reads the graph for workspace-level display and drill-down exploration.

```js
getWorkspaceGraph(workspaceId, filters)
// Returns { nodes: GraphNode[], edges: GraphEdge[] }
// filters: { nodeTypes?, startDate?, endDate?, participantIds? }

getNodeNeighbours(nodeId, depth = 1)
// Traverses up to `depth` hops and returns subgraph

searchGraph(workspaceId, query)
// Text search across node labels and data JSONB
// Combines full-text search with the embedding layer (if available)

getGraphStats(workspaceId)
// Returns { totalNodes, totalEdges, byType: { meeting, participant, topic, decision, task } }
```

**Performance note:** For large workspaces, `getWorkspaceGraph` should paginate or cap at ~200 nodes. Add a `limit` parameter and a `cursor`-based pagination option.

---

### Step 2.4 — Graph API Routes

**New File:** `backend/src/routes/graphRoutes.js`

```
GET  /api/graph/workspace/:id              → getWorkspaceGraph (with filter query params)
GET  /api/graph/node/:nodeId               → getNodeNeighbours
POST /api/graph/search                     → searchGraph({ query, workspaceId })
GET  /api/graph/workspace/:id/stats        → getGraphStats
POST /api/graph/workspace/:id/rebuild      → Re-run GraphConstructionService for all meetings (admin)
```

Register in `server.js`:
```js
app.use('/api/graph', require('./routes/graphRoutes'));
```

---

### Step 2.5 — Frontend Wiring (`memoryAPI.ts`)

Replace every mock method in `memoryAPI.ts` with real `apiService` calls:

| Mock Method | Replace With |
|---|---|
| `getGraphData(filters)` | `GET /api/graph/workspace/:id?nodeTypes=...&startDate=...` |
| `searchMemory(query)` | `POST /api/graph/search` + `POST /api/memory/search` (composite) |
| `getNodeDetails(nodeId)` | `GET /api/graph/node/:nodeId` |
| `getWorkspaceStats(workspaceId)` | `GET /api/graph/workspace/:id/stats` |
| `getRelatedNodes(nodeId, depth)` | `GET /api/graph/node/:nodeId?depth=2` |

**`useQueryMemory.ts`** — No structural changes needed; it already calls `memoryAPI.ts`. Swapping the underlying implementation is sufficient.

**`MemoryView.tsx`** — Add:
- Loading skeleton while graph data fetches.
- Empty state when `nodes.length === 0` (guide user to complete a meeting first).
- Click-to-expand node: call `getNodeNeighbours(nodeId)` and merge result into current graph state.

---

### Knowledge Graph Checklist

```
[ ] Add GraphNode and GraphEdge Prisma models
[ ] Run prisma migrate dev
[ ] Build GraphConstructionService (buildGraphForMeeting)
[ ] Wire GraphConstructionService into AIInsightsService (after embeddings, fire-and-forget)
[ ] Build GraphQueryService (getWorkspaceGraph, getNodeNeighbours, searchGraph, getGraphStats)
[ ] Create graphRoutes.js and register in server.js
[ ] Replace all mock methods in memoryAPI.ts with real API calls
[ ] Add loading/empty states in MemoryView.tsx
[ ] Add click-to-expand node behaviour in MemoryView.tsx
[ ] Manual test: end a meeting → open Memory Graph → verify nodes and edges
[ ] Stress test: workspace with 20+ meetings → verify getWorkspaceGraph performance
```

---

## Sequencing and Dependencies

```
Week 1
  ├── Audit MeetingEmbeddingService
  ├── Wire embeddings into AIInsightsService
  └── Add migration + MemoryContextService skeleton

Week 2
  ├── Complete MemoryContextService (findRelatedMeetings)
  ├── Add /related and /context routes
  └── Manual end-to-end test of Memory Engine

Week 3
  ├── Add GraphNode/GraphEdge schema + migration
  ├── Build GraphConstructionService
  └── Wire GraphConstructionService into post-meeting pipeline

Week 4
  ├── Build GraphQueryService
  ├── Build graphRoutes.js
  ├── Replace memoryAPI.ts mock data
  └── Manual end-to-end test of Knowledge Graph
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Embedding generation is slow (<30s for long meetings) | High | Medium | Already fire-and-forget; does not block API response |
| pgvector similarity scan is slow on large workspaces | Medium | Medium | HNSW index already in place on `meeting_embeddings`; add one for `meeting_memory_contexts` too |
| Participant name matching is fuzzy / unreliable | High | Low | Use exact match first; fall back to anonymous node creation; add manual link UI later |
| Graph gets too large to render | Medium | High | Cap `getWorkspaceGraph` at 200 nodes by default; add paginated expansion |
| `meeting_relationships` table grows stale | Low | Low | Re-run `findRelatedMeetings` on every embedding regeneration |
| `memoryAPI.ts` replacement breaks existing UI | Low | Medium | Swap methods one at a time; keep mock as fallback behind a `USE_MOCK_MEMORY` flag during transition |

---

## Key Files Reference

| File | Action | Notes |
|---|---|---|
| `backend/src/services/AIInsightsService.js` | **Modify** | Add embedding + graph construction triggers at end of `generateInsights()` |
| `backend/src/services/MeetingEmbeddingService.js` | **Modify** | Add idempotency check + error isolation |
| `backend/src/services/MemoryContextService.js` | **Create** | `buildMeetingContext`, `findRelatedMeetings` |
| `backend/src/services/GraphConstructionService.js` | **Create** | `buildGraphForMeeting` and all sub-builders |
| `backend/src/services/GraphQueryService.js` | **Create** | `getWorkspaceGraph`, `getNodeNeighbours`, `searchGraph`, `getGraphStats` |
| `backend/src/routes/graphRoutes.js` | **Create** | All graph API endpoints |
| `backend/prisma/schema.prisma` | **Modify** | Add `MeetingMemoryContext`, `MeetingRelationship`, `GraphNode`, `GraphEdge` |
| `frontend/src/utils/memoryAPI.ts` | **Modify** | Replace all mocks with real API calls |
| `frontend/src/pages/workspace/MemoryView.tsx` | **Modify** | Add loading states, empty state, node expansion |
