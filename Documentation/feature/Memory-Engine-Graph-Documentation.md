# Memory Engine: Knowledge Graph — Technical Documentation

**What this is:** The workspace **Knowledge Graph** is a read-time visualisation of meetings and related entities (topics, decisions, action-backed tasks, members) as **nodes** and **edges**. It is assembled from existing PostgreSQL data and optional vector-backed snippets—there is **no** separate `graph_nodes` / `graph_edges` persistence layer in the current design.

**Last updated:** April 24, 2026

---

## 1. User-facing behaviour

- Users open **Memory** for a workspace and see a **force-directed style** canvas (`GraphCanvas`) fed by real backend data.
- **Filters** (meeting window, participants, types) reduce which nodes/edges the client keeps from the payload.
- **Focus mode** and **highlighting** dim or emphasise nodes (including after a **semantic query** from the memory query bar).
- **Clicking a node** opens a **context panel** with tabs (overview, meetings, tasks, context) and deeper detail—this is **inspect existing node**, not “grow the graph.”
- **Stats** above or beside the view show counts (meetings, topics, edges, etc.) from the same assembly pass as the graph where applicable.

---

## 2. Data sources (what the graph contains)

The assembler reads relational and JSON fields already stored for meetings:

| Source | Used for |
|--------|-----------|
| `meetings` | Meeting nodes, titles, times, status, linkage to workspace. |
| `meeting_memory_contexts` | Topics, decisions, action-item summaries, participant lists, narrative `meetingContext`—used to build **topic**, **decision**, and rich **meeting** summaries on nodes. |
| `action_items` / `tasks` | Action and **task** nodes where tasks are tied to confirmed action items (graph policy may hide pending-only suggestions). |
| Participant strings | **Member** nodes after normalisation. |
| `meeting_embeddings` | Optional **transcript snippet** for a meeting card: typically the earliest transcript chunk’s text, truncated for the payload. |

**Semantic search** (vector + keyword hybrid over embeddings and context) is exposed under the same workspace **memory** API family. The graph UI uses search results to **focus** graph nodes by id; search itself does not require the graph assembly service.

**`meeting_relationships`:** May be empty. Related-meeting style features can fall back to similarity computed in application code; the graph does not depend on that table being populated.

---

## 3. Backend implementation

### 3.1 `MemoryGraphAssemblyService.js`

**Role:** Single service class that builds `{ nodes, edges }` plus helpers for stats and neighbourhoods.

**Output contract** (from implementation comments; consumers rely on this shape):

- **Node:** `{ id, type, label, summary, data, position, size, color, opacity }`  
  `type` includes at least: `meeting`, `topic`, `decision`, `action`, `member`, and task-style nodes as implemented.
- **Edge:** `{ id, source, target, type, weight, color, opacity, curved }`

**Limits:** Constructor options such as `limitMeetings`, `limitNodes`, and `limitActions` cap how much of the workspace is loaded so payloads stay bounded for the browser.

**Pruning:** After limits apply, the service may drop isolated non-meeting nodes so the canvas does not show disconnected fragments.

**Layout:** `buildPositions` assigns coordinates and visual properties used directly by the canvas renderer.

### 3.2 In-process assembly reuse

The service keeps an in-memory map keyed by workspace id and limit parameters. Assembled graph data is stored for **60 seconds** (`CACHE_TTL_MS`) so repeated calls for the same workspace and limits avoid a full rebuild. `clearCache(workspaceId)` evicts entries when upstream data changes (call sites exist for meeting/memory updates).

This is **not** a user-facing “cache feature”; it is an implementation optimisation inside one Node process.

### 3.3 `getNodeNeighbours(workspaceId, nodeId, depth)`

1. Calls `buildWorkspaceGraph` (so neighbours are a subset of the **same** capped graph used for the main view—not a second unconstrained DB universe).
2. Finds the **center** node by `id`; returns `null` if missing.
3. Runs **BFS** out to `depth` hops over undirected edges (both directions).
4. Returns:

```text
{
  node: <center node>,
  depth: <number>,
  neighbours: { nodes: [...], edges: [...] }
}
```

Only nodes reachable within the built graph appear; if the main graph was truncated by limits, neighbours cannot “escape” beyond that hull.

### 3.4 HTTP layer

**Router:** `backend/src/routes/memoryRoutes.js`  
**Controller:** `backend/src/controllers/memoryController.js`

Typical patterns (prefix with `/api` and workspace auth as in your deployment):

- `GET /workspaces/:workspaceId/memory/graph` — body: `{ nodes, edges }` (or wrapped in `{ data }` per controller).
- `GET /workspaces/:workspaceId/memory/graph/stats` — counts and workspace label; may reuse cached assembly for the same window as `/graph`.
- `GET /workspaces/:workspaceId/memory/graph/node/:nodeId/neighbours?depth=N` — neighbourhood payload for expansion UX.

All endpoints must enforce **workspace membership** and parse numeric ids safely.

---

## 4. Frontend implementation

| Artifact | Responsibility |
|----------|------------------|
| `frontend/src/hooks/useGraphData.ts` | Fetches graph JSON; applies **client-side** filters; exposes loading and error state. |
| `frontend/src/hooks/useQueryMemory.ts` | Calls workspace memory **search**; maps hits to **graph node ids** for focus/dim in `MemoryView`. |
| `frontend/src/pages/workspace/MemoryView.tsx` | Layout, stats, filters, context panel, FABs, export; wires canvas, query bar, and selection state. |
| `frontend/src/components/workspace/memory/GraphCanvas.tsx` | Canvas rendering, hover, drag, zoom, focus rendering, node click callbacks. |
| `frontend/src/services/api.ts` | `getMemoryGraph`, `getMemoryGraphStats`, `getNodeNeighbours`, plus search helpers used by the query bar. |

**Types:** `frontend/src/components/workspace/memory/types.ts` defines `MemoryNode`, `GraphData`, filters, etc., shared between hooks and canvas.

---

## 5. How search and the graph interact (same product area, different code paths)

1. Hybrid **search** runs in `MeetingEmbeddingService` (vector cosine similarity plus PostgreSQL full-text), invoked from memory controller search handlers.
2. Results include **meeting ids** and optional metadata used by the UI.
3. `MemoryView` maps those ids to graph node ids (e.g. `meeting:123`) and adjusts **focus/highlight** on the already-loaded graph.

No circular dependency: search does not call the graph assembler; the graph does not call the embedding service except indirectly via Prisma reads for snippets.

---

## 6. Merging neighbour payloads (when click-to-expand is implemented)

Today the UI can open **context** for a node without changing the graph topology. When **click-to-expand** is added, the client should:

1. Call `getNodeNeighbours(workspaceId, nodeId, depth)` with the same `nodeId` string the canvas uses.
2. **Merge** `neighbours.nodes` and `neighbours.edges` into the active `GraphData`:
   - **Nodes:** keyed by `id`; skip duplicates.
   - **Edges:** union with deduplication on a stable key such as `(source, target, type)` or `edge.id` if always present.
3. Re-apply the **same filter predicates** as `useGraphData` so global filters still hide types the user asked to hide.
4. Optionally track `expandedNodeIds` to avoid re-fetching the same neighbourhood and to support “reset expansion.”

**Acceptance behaviour:** new edges appear without full page reload; repeated expansions do not duplicate ids; workspace switch clears expansion state.

---

## 7. Optional future: persisted graph tables

For very large workspaces, an optional evolution is to add **`graph_nodes`** / **`graph_edges`** tables materialised on a schedule or on write, so reads avoid rebuilding from many meetings at once. The current production path remains **query-time assembly** plus the short in-process reuse described in §3.2.

---

## 8. Limitations and caveats

- **Capped universe:** Neighbour BFS cannot return nodes that were excluded by assembly limits.
- **Stale window:** Within the 60s reuse window, new meetings may not appear until cache expiry or explicit invalidation.
- **Empty relationship table:** Does not block graph or search; related-meeting UIs use fallbacks where implemented.

---

## 9. Primary file index (repository paths only)

| Concern | Path |
|---------|------|
| Assembly + cache + BFS | `backend/src/services/MemoryGraphAssemblyService.js` |
| HTTP routes | `backend/src/routes/memoryRoutes.js` |
| HTTP controller | `backend/src/controllers/memoryController.js` |
| Graph hook | `frontend/src/hooks/useGraphData.ts` |
| Search hook | `frontend/src/hooks/useQueryMemory.ts` |
| Page | `frontend/src/pages/workspace/MemoryView.tsx` |
| Canvas | `frontend/src/components/workspace/memory/GraphCanvas.tsx` |
| API client | `frontend/src/services/api.ts` |
| Embedding row reads (snippets) | `backend/src/services/MeetingEmbeddingService.js` / Prisma `meeting_embeddings` |
| Memory context rows | Prisma `meeting_memory_contexts` |

---

## 10. Glossary

- **Query-time graph:** Built on each request (subject to reuse window), not read from a dedicated graph OLTP store.
- **Focus mode:** Visual emphasis on the canvas; does not fetch new nodes.
- **Neighbour expansion:** Optional UX that merges BFS subgraph results into the displayed graph state.
