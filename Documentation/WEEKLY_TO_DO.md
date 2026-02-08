# KAIRO - 5 Week Sprint Plan

## Team Structure
- **Developer 1, 2, 3**: Cross-functional student developers
- All developers will work across frontend, backend, and ML/NLP tasks
- Tasks assigned based on current workload and learning opportunities

---

## Week 1: Foundation & Task System

### Developer 1
- [ ] Create/verify Task, Projects, TaskTags tables in Prisma schema
- [ ] Build Task API routes (CRUD, status updates, assignment)
- [ ] Build TaskService with CRUD operations
- [ ] Add "Create Task" button to ActionItemsPanel (React)
- [ ] Build task creation modal/form (React)

### Developer 2
- [ ] Implement TaskCreationService.createTaskFromActionItem()
- [ ] Connect KanbanBoard component to real Task API
- [ ] Build task detail modal with inline editing (React)
- [ ] Add Privacy Mode toggle in bot (pause/resume transcription)
- [ ] Create privacy mode intervals tracking in database

### Developer 3
- [ ] Install and configure dateparser library
- [ ] Build parseDeadline(text, meetingDate) helper function
- [ ] Implement priority classification (keyword-based)
- [ ] Add Privacy Mode button in live meeting UI (React)
- [ ] Add privacy mode status indicator (React)

**Deliverable**: Working task creation from action items, functional Kanban board, basic privacy controls

---

## Week 2: Meeting Memory Engine - Infrastructure & Search Foundation

### Developer 1
- [ ] Install pgvector extension in PostgreSQL
- [ ] Run Prisma migration for MeetingEmbedding tables
- [ ] Create HNSW indexes on embedding columns
- [ ] Build EmbeddingRepository (store, batch, query methods)
- [ ] Add PostgreSQL full-text search indexes for meetings/transcripts

### Developer 2
- [ ] Build EmbeddingService.generateEmbedding() using OpenAI API
- [ ] Implement batch embedding generation
- [ ] Add text chunking for long content (maxTokens)
- [ ] Build caching layer for embeddings
- [ ] Create Search API routes (keyword search endpoints)

### Developer 3
- [ ] Build Project API (CRUD operations)
- [ ] Build Tag API (create, assign, remove)
- [ ] Add project selector in task creation UI (React)
- [ ] Add tag selector with autocomplete (React)
- [ ] Implement filtering by project/tags in Kanban (React)

**Deliverable**: pgvector ready, embedding generation pipeline, basic keyword search, complete task management

---

## Week 3: Vector Search, Semantic Search & Micro Recaps

### Developer 1
- [ ] Build VectorSearchService.findSimilarContent()
- [ ] Implement findSimilarMeetings() with cosine similarity
- [ ] Build MeetingSearchService.semanticSearch()
- [ ] Implement hybrid search (semantic + keyword combined)
- [ ] Optimize vector queries with proper indexing

### Developer 2
- [ ] Build MicroSummaryService.generateMicroRecap()
- [ ] Implement scheduled task (every 5-10 min) per active meeting
- [ ] Add LLM integration for recap generation (Grok API)
- [ ] Implement WebSocket broadcasting for recaps
- [ ] Store micro-summaries in database

### Developer 3
- [ ] Create Memory API routes (search, related meetings)
- [ ] Build floating panel for micro-recap display (React)
- [ ] Add "Catch Me Up" button in live meeting UI (React)
- [ ] Create recap history timeline UI (React)
- [ ] Add interval configuration controls (React)
- [ ] Build smart search UI with filters (React)

**Deliverable**: Semantic search working, hybrid search, micro-recaps during meetings, search UI

---

## Week 4: Memory Graph & Advanced Search Features

### Developer 1
- [ ] Create graph_nodes and graph_edges tables
- [ ] Build GraphConstructionService
- [ ] Implement buildMeetingNode(), buildParticipantNodes()
- [ ] Implement buildTopicNodes() from AI insights
- [ ] Build relationship detection logic
- [ ] Create Graph API routes (workspace graph, node details)

### Developer 2
- [ ] Build MemoryContextService.buildMeetingContext()
- [ ] Implement findRelatedMeetings() with scoring
- [ ] Build contextual retrieval methods
- [ ] Generate embeddings for all meeting components
- [ ] Link topics to decisions/tasks in graph
- [ ] Implement speaker-based search ("Show me what John said about X")

### Developer 3
- [ ] Enhance MemoryView.tsx with real graph data (React)
- [ ] Implement force-directed graph layout (vis-network/D3.js)
- [ ] Add interactive node exploration (click to expand)
- [ ] Build filtering UI (node type, time, participants)
- [ ] Add node search functionality (React)
- [ ] Build search result grouping and ranking UI (React)

**Deliverable**: Knowledge graph visualization, meeting context engine, speaker-based search

---

## Week 5: Integration, Polish & Speaker ID

### Developer 1
- [ ] Extend RBAC for meeting-level controls
- [ ] Implement "confidential" meeting flags
- [ ] Add granular permissions system
- [ ] Build audit logging for privacy actions
- [ ] Implement data retention policies
- [ ] Create compliance export endpoints

### Developer 2
- [ ] Build voice profile database schema
- [ ] Implement voice sample upload during onboarding (React + API)
- [ ] Train speaker recognition model per workspace
- [ ] Match diarized speakers to user identities
- [ ] Update transcripts with actual names
- [ ] Add manual speaker assignment in review UI (React)

### Developer 3
- [ ] Build Meeting Context tab in task detail (React)
- [ ] Display transcript excerpts in task context (React)
- [ ] Add "Link to meeting" functionality
- [ ] Link graph nodes to meeting pages (React)
- [ ] Show related meetings in sidebars (React)
- [ ] Build advanced search query builder UI (React)
- [ ] Add search analytics and result ranking improvements

**Deliverable**: Full access control, task context linking, speaker identification, complete search system

---

## Critical Dependencies

```
Week 1 → Week 2: Task system before projects/tags
Week 2 → Week 3: Embeddings infrastructure before vector search
Week 3 → Week 4: Vector search before graph relationships
Week 4 → Week 5: Graph complete before UI integration
```

## Success Metrics

- **Week 1**: Tasks created from action items, privacy toggle works
- **Week 2**: Embeddings generated, basic search works
- **Week 3**: Semantic search returns relevant meetings, micro-recaps live
- **Week 4**: Knowledge graph displays relationships, speaker search works
- **Week 5**: Speaker names in transcripts, all features integrated

---

## Recommended Work Schedule

### For Each Developer (Per Week):
- **25-30 hours** coding time
- **5-7 tasks** per week average
- **2-3 days** per major feature
- **Buffer time** for bugs and testing

### Collaboration Points:
- **Pair programming** for complex features (embeddings, graph)
- **Code reviews** before merging to main branch

---

## Post-Sprint Features (Not in 5 weeks)

The following will remain for future development:
- Calendar Integration (Google/Outlook)
- Third-party integrations (Jira, Slack, Trello)
- Multimodal capture (slide screenshots + OCR)
- Auto follow-up reminders
- Transcription latency optimization
- Multilingual support
- Advanced analytics enhancements