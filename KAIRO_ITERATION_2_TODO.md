# Kairo Iteration #2 - Structured To-Do List

## Module A: Transcription & Diarization Completion
**Priority:** High | **Status:** Not Started | **Assignee:** TBD

### A1. Speaker Label Connection (Backend)
- [ ] Create `SpeakerMappingService.js` to map diarization speaker IDs to meeting participants
- [ ] Add participant voice profile matching (optional future enhancement)
- [ ] Update `TranscriptionService.assignSpeakersToUtterances()` to include participant names
- [ ] Modify `saveDiarizedOutputs()` to store speaker mappings in transcript JSON
- [ ] Add API endpoint to update speaker names post-meeting
- [ ] Create migration script to update existing transcripts with speaker names

**Files:**
- `backend/src/services/SpeakerMappingService.js` (new)
- `backend/src/services/TranscriptionService.js` (modify)
- `backend/src/utils/meetingFileStorage.js` (modify)
- `backend/src/routes/meetingRoutes.js` (add endpoint)

---

### A2. Speaker Label Display (Frontend)
- [ ] Update `TranscriptPanel.tsx` to display actual participant names instead of `SPEAKER_00`
- [ ] Add speaker name resolution from meeting participants
- [ ] Update `useLiveTranscript` hook to handle speaker names
- [ ] Add speaker statistics display (speaking time per participant)
- [ ] Update transcript export to include speaker names

**Files:**
- `frontend/src/components/meetings/details/TranscriptPanel.tsx` (modify)
- `frontend/src/hooks/useLiveTranscript.ts` (modify)
- `frontend/src/components/meetings/meetingslive/TranscriptTab.tsx` (modify)

---

### A3. Live Transcription Delay Handling
- [ ] Implement buffering strategy for live transcript chunks
- [ ] Add delay compensation in `useLiveTranscript` hook
- [ ] Create visual indicator for "live" vs "buffered" transcript entries
- [ ] Add configurable delay threshold in frontend
- [ ] Update backend to include chunk processing timestamps

**Files:**
- `frontend/src/hooks/useLiveTranscript.ts` (modify)
- `backend/src/utils/meetingFileStorage.js` (modify)
- `backend/src/services/AudioRecorder.js` (modify)

---

## Module B: Action Items & Summary Testing
**Priority:** Medium | **Status:** Not Started | **Assignee:** TBD

### B1. Summary Generation Testing
- [ ] Create test suite for `AIInsightsService.generateInsights()`
- [ ] Test with various transcript lengths (short, medium, long)
- [ ] Test error handling (API failures, missing transcripts)
- [ ] Validate output format and data quality
- [ ] Performance testing with large transcripts
- [ ] Integration testing with real meeting recordings

**Files:**
- `backend/tests/services/AIInsightsService.test.js` (new)
- `backend/src/services/AIInsightsService.js` (add error handling)

---

### B2. Action Items Frontend Integration
- [ ] Verify action items display on post-meeting details page
- [ ] Add action item confirmation/rejection UI
- [ ] Implement action item assignment to users
- [ ] Add action item status tracking (pending, in-progress, completed)
- [ ] Create action item export functionality
- [ ] Add action item filtering and search

**Files:**
- `frontend/src/components/meetings/details/ActionItemsPanel.tsx` (modify)
- `frontend/src/hooks/useActionItems.ts` (modify)
- `backend/src/routes/actionItemRoutes.js` (add update endpoints)

---

### B3. Action Items Backend Enhancements
- [ ] Add action item update endpoints (confirm, reject, assign)
- [ ] Implement action item deduplication improvements
- [ ] Add action item confidence scoring
- [ ] Create action item analytics endpoint

**Files:**
- `backend/src/routes/actionItemRoutes.js` (modify)
- `backend/src/services/ActionItemService.js` (modify)

---

## Module C: Meeting Memory Engine - Backend Implementation
**Priority:** High | **Status:** Not Started | **Assignee:** TBD

### C1. Embeddings Generation Service
- [ ] Create `EmbeddingService.js` to generate embeddings from text
- [ ] Integrate with OpenAI embeddings API or local model
- [ ] Create embeddings for meeting transcripts
- [ ] Create embeddings for action items
- [ ] Create embeddings for decisions
- [ ] Create embeddings for topics
- [ ] Create embeddings for participant contributions
- [ ] Batch processing for multiple meetings
- [ ] Caching strategy for embeddings

**Files:**
- `backend/src/services/EmbeddingService.js` (new)
- `backend/src/services/MemoryService.js` (new - main orchestration)

---

### C2. Vector Storage Setup
- [ ] Set up pgvector extension in PostgreSQL database
- [ ] Create migration for vector columns in `memory_nodes` table
- [ ] Add vector index for similarity search
- [ ] Create vector storage utilities
- [ ] Implement vector upsert/update operations

**Files:**
- `backend/prisma/migrations/add_vector_columns.sql` (new)
- `backend/src/utils/vectorStorage.js` (new)

**Database Changes:**
```sql
-- Add vector column to memory_nodes
ALTER TABLE memory_nodes ADD COLUMN embedding vector(1536);

-- Create index for similarity search
CREATE INDEX ON memory_nodes USING ivfflat (embedding vector_cosine_ops);
```

---

### C3. Semantic Search Implementation
- [ ] Implement vector similarity search using pgvector
- [ ] Create search endpoint with query embedding
- [ ] Add hybrid search (vector + keyword)
- [ ] Implement search result ranking
- [ ] Add search filters (date, type, workspace)

**Files:**
- `backend/src/services/MemoryService.js` (add search methods)
- `backend/src/routes/memoryRoutes.js` (new)

---

### C4. Memory Graph Construction
- [ ] Create service to build memory graph from meetings
- [ ] Extract entities (topics, decisions, actions, participants)
- [ ] Create relationships between entities
- [ ] Update graph incrementally as new meetings are processed
- [ ] Add graph visualization data endpoint

**Files:**
- `backend/src/services/MemoryGraphBuilder.js` (new)

---

### C5. Memory API Endpoints
- [ ] `GET /api/workspaces/:id/memory/graph` - Get memory graph
- [ ] `POST /api/workspaces/:id/memory/search` - Semantic search
- [ ] `GET /api/workspaces/:id/memory/nodes/:id` - Get node details
- [ ] `PUT /api/workspaces/:id/memory/nodes/:id` - Update node
- [ ] `POST /api/workspaces/:id/memory/nodes` - Create node
- [ ] `DELETE /api/workspaces/:id/memory/nodes/:id` - Delete node
- [ ] `GET /api/workspaces/:id/memory/stats` - Get statistics
- [ ] `GET /api/workspaces/:id/memory/insights` - Get insights

**Files:**
- `backend/src/routes/memoryRoutes.js` (new)

---

### C6. LLM Integration for Memory Queries
- [ ] Integrate Grok API for natural language queries
- [ ] Create query understanding service
- [ ] Implement query-to-vector conversion
- [ ] Add query result explanation using LLM

**Files:**
- `backend/src/services/MemoryQueryService.js` (new)

---

### C7. Frontend API Integration
- [ ] Replace mock `memoryAPI.ts` with real API calls
- [ ] Update all memory components to use real endpoints
- [ ] Add error handling and loading states
- [ ] Implement real-time graph updates

**Files:**
- `frontend/src/utils/memoryAPI.ts` (replace mocks with real API)
- `frontend/src/hooks/useGraphData.ts` (modify)
- `frontend/src/hooks/useQueryMemory.ts` (modify)

---

### C8. Memory Processing Pipeline
- [ ] Create job to process meetings and build memory
- [ ] Trigger memory updates after meeting completion
- [ ] Add incremental updates (don't reprocess entire history)
- [ ] Create background worker for memory processing

**Files:**
- `backend/src/jobs/memoryProcessor.js` (new)

---

## Module D: Bot Joining Polish
**Priority:** Low | **Status:** Not Started | **Assignee:** TBD

### D1. Error Handling Improvements
- [ ] Add retry logic for failed bot joins
- [ ] Improve error messages for password failures
- [ ] Add network interruption recovery
- [ ] Create fallback strategies for different meeting platforms

**Files:**
- `backend/src/services/MeetingBot.js` (modify)
- `backend/src/services/bot-join/zoomService.js` (modify)

---

### D2. Meeting Platform Detection
- [ ] Improve platform detection (Zoom, Google Meet, Teams, etc.)
- [ ] Add platform-specific join strategies
- [ ] Create platform adapter pattern

**Files:**
- `backend/src/services/bot-join/meetService.js` (modify)
- `backend/src/services/bot-join/zoomService.js` (modify)

---

### D3. Monitoring & Logging
- [ ] Add detailed logging for bot join process
- [ ] Create metrics for join success/failure rates
- [ ] Add alerting for repeated failures

**Files:**
- `backend/src/services/MeetingBot.js` (modify)

---

## Quick Reference: File Checklist

### New Files to Create
- [ ] `backend/src/services/SpeakerMappingService.js`
- [ ] `backend/src/services/EmbeddingService.js`
- [ ] `backend/src/services/MemoryService.js`
- [ ] `backend/src/services/MemoryGraphBuilder.js`
- [ ] `backend/src/services/MemoryQueryService.js`
- [ ] `backend/src/utils/vectorStorage.js`
- [ ] `backend/src/routes/memoryRoutes.js`
- [ ] `backend/src/jobs/memoryProcessor.js`
- [ ] `backend/tests/services/AIInsightsService.test.js`
- [ ] `backend/prisma/migrations/add_vector_columns.sql`

### Files to Modify
- [ ] `backend/src/services/TranscriptionService.js`
- [ ] `backend/src/utils/meetingFileStorage.js`
- [ ] `backend/src/routes/meetingRoutes.js`
- [ ] `backend/src/services/AudioRecorder.js`
- [ ] `backend/src/services/AIInsightsService.js`
- [ ] `backend/src/routes/actionItemRoutes.js`
- [ ] `backend/src/services/ActionItemService.js`
- [ ] `backend/src/services/MeetingBot.js`
- [ ] `backend/src/services/bot-join/zoomService.js`
- [ ] `frontend/src/components/meetings/details/TranscriptPanel.tsx`
- [ ] `frontend/src/hooks/useLiveTranscript.ts`
- [ ] `frontend/src/components/meetings/meetingslive/TranscriptTab.tsx`
- [ ] `frontend/src/components/meetings/details/ActionItemsPanel.tsx`
- [ ] `frontend/src/hooks/useActionItems.ts`
- [ ] `frontend/src/utils/memoryAPI.ts`
- [ ] `frontend/src/hooks/useGraphData.ts`
- [ ] `frontend/src/hooks/useQueryMemory.ts`

---

## Progress Tracking

### Module A Progress: 0/3 tasks
- [ ] A1. Speaker Label Connection (Backend)
- [ ] A2. Speaker Label Display (Frontend)
- [ ] A3. Live Transcription Delay Handling

### Module B Progress: 0/3 tasks
- [ ] B1. Summary Generation Testing
- [ ] B2. Action Items Frontend Integration
- [ ] B3. Action Items Backend Enhancements

### Module C Progress: 0/8 tasks
- [ ] C1. Embeddings Generation Service
- [ ] C2. Vector Storage Setup
- [ ] C3. Semantic Search Implementation
- [ ] C4. Memory Graph Construction
- [ ] C5. Memory API Endpoints
- [ ] C6. LLM Integration for Memory Queries
- [ ] C7. Frontend API Integration
- [ ] C8. Memory Processing Pipeline

### Module D Progress: 0/3 tasks
- [ ] D1. Error Handling Improvements
- [ ] D2. Meeting Platform Detection
- [ ] D3. Monitoring & Logging

**Overall Progress: 0/17 tasks (0%)**

---

## Notes Section

### Blockers
- None currently identified

### Dependencies
- Module B depends on Module A completion
- Module C requires database migration approval
- Module C requires API key for embeddings

### Questions/Clarifications Needed
- [ ] Which embedding model to use? (OpenAI, local, other?)
- [ ] Vector dimension size? (1536 for OpenAI, adjust for others)
- [ ] Should speaker mapping be manual or automatic?
- [ ] Action items integration verification needed

---

## Daily Standup Template

**Yesterday:**
- [Task completed]

**Today:**
- [Task working on]

**Blockers:**
- [Any blockers]

**Module Progress:**
- Module A: X%
- Module B: X%
- Module C: X%
- Module D: X%
