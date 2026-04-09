# Memory Engine & Knowledge Graph — Implementation Plan & Status

**Project:** Kairo  
**Last Updated:** April 9, 2026  
**Status:** Largely Implemented / Frontend Polishing Remaining

---

## Executive Summary: What Works & What Is Implemented

The vast majority of the Memory Engine and Knowledge Graph architecture has been successfully implemented and is currently live in the codebase. 

### What Works Today
1. **Memory Engine**
   - The entire `MeetingEmbeddingService` pipeline works safely and is embedded logically into `AIInsightsService`.
   - Idempotency measures exist to prevent duplicate vector growth during regeneration.
   - The memory context (summaries, transcripts) is actively saved securely into pgvector via the `memory_embeddings` logic.
   - Backend APIs such as `GET /api/workspaces/:workspaceId/memory/search` are functional and perform semantic similarity searches natively.

2. **Knowledge Graph (Backend)**
   - The backend `MemoryGraphAssemblyService.js` creates and serves real logical node assemblies dynamically from Database tables (`meeting_memory_contexts`, `action_items`, `meetings`).
   - The entire suite of REST APIs (`/graph`, `/graph/stats`, and `/graph/node/:nodeId/neighbours`) is successfully wired into `memoryRoutes.js`.
   
3. **Knowledge Graph (Frontend)**
   - The frontend `useGraphData.ts` is no longer a mock; it successfully performs live data fetching from `apiService.getMemoryGraph()`.
   - The AI Graph query bar via `useQueryMemory.ts` triggers live semantic vector searches to highlight the matching logical nodes simultaneously.

---

## Part 1: Memory Engine Completion

### Problem Statement
In this repo, `AIInsightsService.generateInsights()` already runs the Memory Engine:
it embeds meeting transcripts and upserts `meeting_memory_contexts` as part of the insights pipeline.

### Step 1.1 — Wire Embeddings into Post-Meeting Pipeline
**Target File:** `backend/src/services/AIInsightsService.js`
**Status:** ✅ Completed. The embedding processes are strictly try/catch isolated.

### Step 1.2 — Audit MeetingEmbeddingService
**Target File:** `backend/src/services/MeetingEmbeddingService.js`
**Status:** ✅ Completed. Regeneration successfully wipes/upserts the appropriate pgvector ranges for the active meeting. 

### Step 1.3 — Build MemoryContextService
**New File:** `backend/src/services/MemoryContextService.js`
**Status:** ✅ Completed. Context reads operate safely.

### Step 1.4 — Database Schema Additions
**Status:** ✅ Completed. `summary_embedding` arrays exist.

### Step 1.5 — Related Meetings API Routes
**Status:** ✅ Completed. Mounted under `/meetings/:meetingId/related` safely.

### Memory Engine Completion Checklist

```markdown
- [x] Audit MeetingEmbeddingService for idempotency + error isolation
- [x] Verify AIInsightsService wiring covers both normal completion and `POST /api/meetings/:id/ai-insights/regenerate`
- [x] Add transcript-embedding idempotency so force regeneration does not create unbounded duplicates
- [x] Implement MemoryContextService read helpers: `getMeetingContext` (incl. transcript snippet)
- [x] Add `memoryRoutes.js` endpoints for `/api/workspaces/:workspaceId/memory/meetings/:meetingId/context` and `/related`
- [x] Related endpoint: implemented with on-demand fallback computation when `meeting_relationships` is empty
- [ ] **UNIMPLEMENTED [Priority: Low]:** dedicated embeddings-only rebuild endpoint (the system currently relies safely on full `ai-insights/regenerate`)
```

---

## Part 2: Knowledge Graph

### Problem Statement
The frontend `MemoryView.tsx` previously utilized a dummy graph. It required native linkage to the Prisma schema logic natively.

### Step 2.1 — Graph Data Strategy (Query-time Assembly First)
**Status:** ✅ Completed. Dynamic Graph mapping logic builds vertices without requiring massive schema alterations. 

### Step 2.2 — Memory Graph Assembly Service
**New File:** `backend/src/services/MemoryGraphAssemblyService.js`
**Status:** ✅ Completed. 

### Step 2.3 — Memory Graph Query Helpers
**Status:** ✅ Completed.

### Step 2.4 — Graph API Routes (under `memoryRoutes.js`)
**Status:** ✅ Completed. Endpoints for `/graph/stats` and `/neighbours` exist and route to `memoryController`.

### Step 2.5 — Frontend Wiring
**Status:** 🟨 Partially Complete. `useGraphData.ts` and `useQueryMemory.ts` have been refactored to pull live backend vectors successfully. However, the click-to-expand UI wrapper has not been built yet.

### Knowledge Graph Checklist & Unimplemented Items

```markdown
- [x] Implement query-time graph assembly (no new graph-table Prisma migration required)
- [x] Implement `GET /api/workspaces/:workspaceId/memory/graph` and `GET /api/workspaces/:workspaceId/memory/graph/stats`
- [x] Implement `MemoryGraphAssemblyService` to build nodes/edges from existing tables (`meetings`, `meeting_memory_contexts`, `action_items`)
- [x] Update `frontend/src/hooks/useGraphData.ts` to fetch backend graph and apply client-side filters
- [x] Update `frontend/src/hooks/useQueryMemory.ts` to use real semantic matching highlighting.
- [x] Update `frontend/src/pages/workspace/MemoryView.tsx` to use real `workspaceId` + backend stats and show loading/empty states
- [x] Backend: Add `/memory/graph/node/:nodeId/neighbours?depth=2` route logic.
- [ ] **UNIMPLEMENTED [Priority: High]:** Frontend: create `useGraphExpansion.ts` hook. While the backend route to fetch neighbor branches exists, the frontend lacks the logic to capture a node click, fetch the neighbor arrays, and visually inject/merge them into the primary Canvas layout.
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Transcript re-embedding can create duplicate `meeting_embeddings` rows | High | High | *Resolved:* `embedTranscript()` handles upsert safety gracefully. |
| Graph assembly can be slow if it loads too much data per request | Medium | High | Node limits effectively throttle giant unreadable payloads on the client array. |
| Backend payload shape mismatch vs `MemoryNode` UI | Medium | High | The node parser strictly forces type-matches. |
| Decision/topic mapping may not support `topic-decision` edges reliably | Medium | Medium | Extracted as best-effort metrics. |

---

## Key Files Reference

| File | Action | Notes |
|---|---|---|
| `backend/src/services/AIInsightsService.js` | **Completed** | Ensures Memory Engine step isolation + non-fatal embedding generation |
| `backend/src/services/MeetingEmbeddingService.js` | **Completed** | Makes `embedTranscript()` regeneration-safe (avoids duplicate growth) |
| `backend/src/services/MemoryContextService.js` | **Completed** | `getMeetingContext` (+ optional transcript snippet) and optional `findRelatedMeetings` |
| `backend/src/services/MemoryGraphAssemblyService.js` | **Completed** | Query-time workspace graph assembly (logical nodes/edges) |
| `backend/src/routes/memoryRoutes.js` | **Completed** | Added `/memory/graph`, `/neighbours`, and `/memory/graph/stats` endpoints |
| `frontend/src/hooks/useGraphData.ts` | **Completed** | Replaces mock graph with backend fetch |
| `frontend/src/hooks/useQueryMemory.ts` | **Completed** | Semantic search memory hook functional |
| `frontend/src/hooks/useGraphExpansion.ts` | **Pending** | Required for creating the click-to-expand graph overlay effect visually. |
