# Kairo — Testing Documentation

This document covers the complete testing strategy for Kairo: the test framework and tooling, how to run tests, the full catalogue of existing test suites with what each test verifies, patterns and conventions used, and guidance for writing new tests.

---

## Table of Contents

1. [Testing Stack](#1-testing-stack)
2. [Running Tests](#2-running-tests)
3. [Test Suite Catalogue](#3-test-suite-catalogue)
   - [Authentication Middleware](#31-authentication-middleware)
   - [TranscriptionService](#32-transcriptionservice)
   - [AI Insights — Summarization Engine](#33-ai-insights--summarization-engine)
   - [Action Item Service](#34-action-item-service)
   - [Post-Meeting Processor](#35-post-meeting-processor)
   - [Whisper Mode — MicroSummaryService](#36-whisper-mode--microsummaryservice)
   - [Smart Search and Memory Engine](#37-smart-search-and-memory-engine)
   - [Memory Context Service](#38-memory-context-service)
   - [Task Management and Reminder Service](#39-task-management-and-reminder-service)
   - [WebSocket Server](#310-websocket-server)
   - [Notification Service](#311-notification-service)
   - [Meeting Bot Service](#312-meeting-bot-service)
   - [Upload Service](#313-upload-service)
   - [Embedding Pipeline](#314-embedding-pipeline)
   - [pgvector Setup Verification](#315-pgvector-setup-verification)
4. [Test Patterns and Conventions](#4-test-patterns-and-conventions)
5. [Coverage Areas](#5-coverage-areas)
6. [Writing New Tests](#6-writing-new-tests)
7. [Database and Infrastructure Tests](#7-database-and-infrastructure-tests)
8. [Known Limitations and Future Work](#8-known-limitations-and-future-work)

---

## 1. Testing Stack

| Tool | Version | Role |
|---|---|---|
| **Mocha** | 11.x | Test runner — discovers and executes `.test.js` files |
| **Chai** | 6.x | Assertion library — `expect`-style BDD assertions |
| **Sinon** | 21.x | Test doubles — stubs, spies, sandboxes, and clock control |
| **Proxyquire** | 2.x | Module-level dependency injection for CommonJS `require` — enables loading a service with specific dependencies replaced without modifying production code |
| **Node.js built-ins** | — | `fs` stubs via Sinon for filesystem-dependent services |

All testing dependencies are in `backend/devDependencies` and are never included in production builds.

---

## 2. Running Tests

All commands are run from the `backend/` directory.

### Run the full test suite

```bash
cd backend
npm test
```

This executes `mocha tests/**/*.test.js` — it discovers every file matching `*.test.js` recursively under `backend/tests/`.

### Run a single test file

```bash
npx mocha tests/authentication.test.js
```

### Run tests matching a pattern (grep)

```bash
npx mocha tests/**/*.test.js --grep "TranscriptionService"
```

### Run tests with verbose output

```bash
npx mocha tests/**/*.test.js --reporter spec
```

### Verify pgvector database setup (utility script — not a Mocha test)

```bash
npm run db:verify-vectors
```

This runs `tests/verify-pgvector-setup.js` directly via Node and checks that the pgvector extension is installed, vector columns exist, HNSW indexes are present, and sample cosine similarity queries return valid results.

---

## 3. Test Suite Catalogue

### 3.1 Authentication Middleware

**File:** `backend/tests/authentication.test.js`  
**Suite:** `Authentication Middleware Tests`  
**Module under test:** `backend/src/middleware/auth.js` — `authenticateToken`, `optionalAuth`  
**Dependencies stubbed:** `jsonwebtoken` (`verify`), `User` model (`findById`)

This suite tests every branch of the JWT authentication middleware in isolation. All Express `req`/`res`/`next` objects are constructed as plain stubs.

| Test | Assertion |
|---|---|
| Missing token → 401 | `res.status(401)` + `{ error: "Access token required" }` |
| Invalid token (`JsonWebTokenError`) → 401 | `res.status(401)` + `{ error: "Invalid token" }` |
| Expired token (`TokenExpiredError`) → 401 | `res.status(401)` + `{ error: "Token expired" }` |
| Valid token but user not found → 401 | `res.status(401)` + `{ error: "Invalid or inactive user" }` |
| Valid token but user `isActive: false` → 401 | Same error as above |
| Valid token + active user → calls `next()` | `nextStub.calledOnce` is true; `req.user.name` equals resolved user |
| `optionalAuth`: no token → `req.user = null`, calls `next()` | No error; `req.user` is `null` |
| `optionalAuth`: valid token → `req.user` populated, calls `next()` | `req.user.id` equals resolved user id |

**Setup/teardown:** `sinon.restore()` is called in `beforeEach` to ensure stubs from prior tests do not leak.

---

### 3.2 TranscriptionService

**File:** `backend/tests/transcriptionService.test.js`  
**Suite:** `TranscriptionService - Pure Function Tests`  
**Module under test:** `backend/src/services/TranscriptionService.js`  
**Dependencies stubbed:** `fs.existsSync`, `fs.writeFileSync`, `fs.appendFileSync`, `fs.statSync`, `fs.mkdirSync` — all return non-throwing values to allow service instantiation without a real filesystem.

These tests target **pure functions** within the service that can be exercised without spawning a Python subprocess or connecting to a database.

| Test | Assertion |
|---|---|
| `cleanTranscriptionText()` — strips WhisperX log lines | Returns only speech content; removes `INFO`, `WARNING`, timestamp-prefixed log lines |
| `formatSRTTime()` — converts decimal seconds to SRT timestamp | Correct `HH:MM:SS,mmm` format; exact hours/minutes/seconds; milliseconds within ±1 of expected (float rounding tolerance) |
| `generateSRT()` — builds valid SRT block from utterances | Sequence number `1` present; correct `00:00:00,000 --> 00:00:02,500` range; `[Speaker 1] Hello world` entry |
| `assignSpeakersToUtterances()` — maps diarized segments to utterances by time overlap | Utterance spanning `[0, 3]` assigned speaker `"A"` from segment `[0.5, 2.5]` |
| `generateStatistics()` — aggregates transcript stats | `total_utterances: 2`, `total_words: 5`, `speakers: ["A", "B"]`, `duration_seconds: 6` |

**Setup/teardown:** `sinon.restore()` in `afterEach`.

---

### 3.3 AI Insights — Summarization Engine

**File:** `backend/tests/aiInsights.test.js`  
**Suite:** `AIInsightsService (Summarization Engine) → Generating Multi-dimensional Insights`  
**Module under test:** `backend/src/services/AIInsightsService.js`  
**Dependencies stubbed:** `AIInsightsService.generateInsights`, `AIInsightsService.saveInsightsToDatabase` via Sinon method stubs

| Test | Assertion |
|---|---|
| Executive Summary generation | Returns `paragraph_summary` containing expected content |
| Memory Engine triggered after insights complete | `saveInsightsToDatabase` resolves `true` |
| Empty transcript handled gracefully | Returns `null` without throwing |
| Long transcript chunked correctly | `chunksProcessed: 5` |
| Topics extracted with confidence > 0.8 | First topic confidence exceeds threshold |
| Fallback to basic extraction on Groq rate limit | `fallback: true` |
| Malformed LLM JSON parsed safely | Returns object with `action_items` array |
| Action items mapped to transcript timestamps | Timestamp `"00:15:30"` in result |
| All active speakers identified from diarization | Array length equals expected speaker count |
| Filler words excluded from summary | Output does not contain `"Umm"` |
| Decisions categorised by impact level | `impact: "High"` present |
| Output structure matches DB schema keys | Has `summary`, `topics`, `decisions` |
| Groq API retried up to 3 times on network failure | `retries: 3`, `success: true` |
| Zero action items correctly flagged | `action_items` array is empty |
| Sentiment attached to summary metadata | `sentiment: "Positive"` |
| All metrics saved transactionally | `transactionCommitted: true` |

---

### 3.4 Action Item Service

**File:** `backend/tests/actionItems.test.js`  
**Suite:** `ActionItemService Tests`  
**Module under test:** `backend/src/services/ActionItemService.js`  
**Dependencies stubbed:** `prisma.actionItem` (injected directly onto the singleton), `AgentProcessingService.extractActionItems`

These tests exercise `ActionItemService.extractAndUpdateActionItems()` using real service code with stubbed external dependencies — Prisma calls and the AI agent are replaced with controlled stubs.

| Test | Assertion |
|---|---|
| New action item from empty state → added | `result.added: 1`, `result.updated: 0`; `prisma.actionItem.create` called once |
| Existing item with matching canonical key → updated | `result.updated: 1`, `result.added: 0`; `prisma.actionItem.update` called once |

**Key pattern:** `AgentProcessingService.extractActionItems` is stubbed to return a controlled action item payload. `_generateCanonicalKey` is stubbed to return a predictable key for the update-path test.

---

### 3.5 Post-Meeting Processor

**File:** `backend/tests/postMeetingProcessor.test.js`  
**Suite:** `PostMeetingProcessor`  
**Module under test:** `backend/src/services/PostMeetingProcessor.js`  
**Dependencies stubbed via:** `proxyquire` with `.noCallThru()` — replaces `ActionItemService`, `Meeting` model, and `meetingStats` utility at `require` time without calling through to actual modules.

| Method | Test | Assertion |
|---|---|---|
| `processPendingActionItems` | No pending items | Returns `{ pendingCount: 0, requiresConfirmation: false }` |
| `processPendingActionItems` | Items found | `pendingCount: 2`, items array matches stubbed DTOs |
| `processPendingActionItems` | Service throws | Returns `{ pendingCount: 0, requiresConfirmation: false, error: "BAD" }` |
| `updateRecordingUrl` | Null path | Returns `false` without calling `Meeting.update` |
| `updateRecordingUrl` | Valid path | `Meeting.update` called once; returns `true` |
| `updateRecordingUrl` | `Meeting.update` throws | Returns `false` |
| `updateMeetingDuration` | Null audio file | Returns `false` |
| `updateMeetingDuration` | Duration `0` returned | Returns `false` |
| `updateMeetingDuration` | Valid duration | `Meeting.update` called once; returns `true` |
| `updateMeetingDuration` | `Meeting.update` throws | Returns `false` |

**Setup/teardown:** `sinon.createSandbox()` in `beforeEach`; `sandbox.restore()` in `afterEach`.

---

### 3.6 Whisper Mode — MicroSummaryService

**File:** `backend/tests/whisperMode.test.js`  
**Suite:** `Whisper Mode (Live Micro-Recaps) → MicroSummaryService`  
**Dependencies:** All via anonymous stubs (no direct module import)

| Test | Assertion |
|---|---|
| Generates recap from 5-minute chunks | Recap text contains expected topic string |
| Broadcasts recap over WebSocket | Broadcast function returns `true` |
| Skips generation if transcript unchanged | Returns `null` (no new recap) |
| Respects `WHISPER_MODE_ENABLED` gate | Boolean flag is truthy |
| Manual `/whisper/trigger` works | `forced: true` in response |
| Detects topic shifts mid-meeting | `topicShift: true` |
| Attaches UTC timestamp to every recap | Timestamp string contains `"Z"` |
| Recap is 2–3 sentences maximum | Sentence count ≤ 3 |
| Drops duplicate recaps | `dropped: true` |
| Debounces WebSocket event flooding | Stub call count verified (documents expected production behaviour) |
| Recovers from Groq timeout | `recovered: true` |
| Formats output with bullet points | Output contains `"-"` prefix |
| Handles overlapping speech segments | `parsedSegments: 10` |
| Authenticates WebSocket connection before pushing | Auth function returns `true` |
| Cleans up recap cache on meeting end | `cleared: true` |
| Token usage stays below threshold | `tokensUsed < 500` |

---

### 3.7 Smart Search and Memory Engine

**File:** `backend/tests/smartSearch.test.js`  
**Suite:** `Meeting Memory Engine (Smart Search & Context)`

**Sub-suite: `hybridSearchWorkspaceMeetings()`**

| Test | Assertion |
|---|---|
| Combines pgvector (60%) with PostgreSQL FTS (40%) | `distance < 0.2` for top result |
| Fallback to pure vector search on FTS failure | Result array has length 1 |
| Exact keyword matches ranked higher in FTS weighting | `fts_rank > 0.9` |
| Cosine distance via `<=>` operator accurate | `distance < 0.1` |
| Workspace RBAC isolation enforced | `isolated: true` |
| Limits results to 10 by default | Result array length equals 10 |
| Stop-words stripped from query | Processed query does not include `"the"` |
| Empty query returns `400 Bad Request` | Stub rejects with error message `"400"` |
| Distance mapped to 0–100 similarity score | `similarityScore` within `[0, 100]` |
| Highlighted snippet included in payload | `snippet` is a non-empty string |
| Date range filtering applied | Result date matches filter |
| Frequent identical queries cached | `cached: true` |
| Special characters and punctuation handled | `safe: true` |
| Failures logged without data leakage | `logged: true` |
| Chunks correctly reshaped before MiniLM-L6-v2 | `reshaped: true` |

**Sub-suite: `findRelatedMeetings()`**

| Test | Assertion |
|---|---|
| Finds similar meetings via `summary_embedding` | `similarityScore: 92` |
| Returns empty array if vectors not yet generated | Empty array |

---

### 3.8 Memory Context Service

**File:** `backend/tests/memoryContext.test.js`  
**Suite:** `MemoryContextService`  
**Dependencies:** All via anonymous stubs

| Test | Assertion |
|---|---|
| Fetches meeting context including transcript snippets | `context` string includes expected excerpt |
| Verifies workspace ownership before returning context | `authorized: true` |
| Fetches related meetings from `meeting_relationships` table | `similarity: 0.95` |
| Falls back to dynamic similarity when `meeting_relationships` is empty | `dynamicFallbackUsed: true` |
| Caches context payload in memory | `cachedData: true` |
| Returns `404` error if context row missing | Throws `"Context Not Found"` |
| Combines action items and decisions in overview | Both `hasActionItems` and `hasDecisions` are true |
| Handles meetings with only summary embeddings (no transcript rows) | `partialContext: true` |
| Timestamps formatted correctly for frontend timeline | Formatted string contains `"2026"` |
| SQL injection prevented in context lookup | `sanitized: true` |
| Returns empty for user scoped to a different workspace | Empty array |
| Concurrent `getMeetingContext` calls handled without DB locking | `parallelSuccess: true` |
| Deleted meetings omitted from related results | Only `"Active Meeting"` in response |
| `limit` parameter defaults to 5 | Array length equals 5 |
| Raw Postgres JSON mapped to typed interfaces | `interfacesMapped: true` |
| Memory feature usage logged to analytics | `analyticsLogged: true` |

---

### 3.9 Task Management and Reminder Service

**File:** `backend/tests/taskManagement.test.js`  
**Suite:** `Task & Automation Center`

**Sub-suite: Kanban & Action Items**

| Test | Assertion |
|---|---|
| Natural language deadline `"next Friday"` parsed | Returned `Date` has year 2026 |
| Relative expression `"in 2 days"` parsed | ISO string includes `"2026-03-29"` |
| Standard ISO date string `"2026-04-15"` parsed | ISO string includes `"2026-04-15"` |
| Priority auto-classified from urgency keywords | `"ASAP critical"` → `"urgent"` |
| Task assigned to recognised speaker from transcript | `assigneeId: 5` |
| Priority defaults to `"medium"` with no urgency keywords | Returns `"medium"` |
| Drag-and-drop column update persists | `status: "in-progress"` |
| Non-admin cannot delete tasks assigned to others | `allowed: false` |
| Invalid/absent date format returns `null` | Returns `null` |
| Completed tasks synced back to Memory Context | Returns `true` |
| Tasks filtered accurately by assignee ID | Array length equals 2 |

**Sub-suite: Reminder Service**

| Test | Assertion |
|---|---|
| Daytime quiet hours (10:00–17:00) respected | Returns `true` (in quiet window) |
| Overnight quiet hours (22:00–07:00) enforced | Returns `true` (overnight range handled correctly) |
| Multiple reminders batched into single summary | `batched: 5` |
| Reminders marked `"sent"` to prevent duplicates | `duplicatePrevented: true` |
| Outgoing payload formatted for `NotificationService` | `title: "Task Due"` present |
| Web Push notifications triggered securely | Returns `true` |

---

### 3.10 WebSocket Server

**File:** `backend/tests/webSocketServer.test.js`  
**Suite:** WebSocket server event handling

Tests verify: connection lifecycle (join/leave room), `transcript` event broadcasting to the correct meeting room, `live_speaker_update` broadcasting with correct payload, `whisper_recap` broadcasting, `speaker_identified` propagation after post-meeting processing, and that messages are not delivered to clients in different meeting rooms.

---

### 3.11 Notification Service

**File:** `backend/tests/notificationService.test.js`  
**Suite:** `NotificationService`

Tests verify: in-app notification creation and persistence, unread count accuracy, mark-as-read and mark-all-as-read operations, notification deletion, and correct payload formatting for different notification types (`task_reminder`, `meeting_ended`, `speaker_identified`).

---

### 3.12 Meeting Bot Service

**File:** `backend/tests/meetService.test.js`  
**Suite:** Meeting Bot (Puppeteer)

Tests cover: bot session creation and state initialisation, duplicate-join protection (second `bot-join` request for the same active meeting is rejected), meeting status transition (`scheduled → in-progress → completed`) triggered by bot events, and graceful cleanup on bot disconnect or timeout.

---

### 3.13 Upload Service

**File:** `backend/tests/uploadService.test.js`  
**Suite:** `UploadService`

Tests verify: profile picture upload to Supabase storage returns a valid public URL, meeting file attachment stores metadata in the `MeetingFile` table, file size limits enforced (stubs reject oversized payloads), unsupported MIME types rejected for profile pictures, and file deletion cleans up both the storage object and the database row.

---

### 3.14 Embedding Pipeline

**File:** `backend/tests/test-embedding-pipeline.js`  
**Suite:** Embedding pipeline integration check

This is an integration-style test that can be run independently. It verifies: `EmbeddingService.generateEmbedding(text)` returns a `Float32Array` of length 384, `generateBatchEmbeddings` returns the correct number of arrays, `chunkText` produces sentence-aware chunks within the max-word limit, and that two semantically similar texts produce a higher cosine similarity score than two unrelated texts.

Run independently:

```bash
node tests/test-embedding-pipeline.js
```

---

### 3.15 pgvector Setup Verification

**File:** `backend/tests/verify-pgvector-setup.js`

A standalone Node script (not a Mocha test) that connects to the configured `DATABASE_URL` and verifies:

- The `pgvector` PostgreSQL extension is installed (`SELECT * FROM pg_extension WHERE extname = 'vector'`)
- The `meeting_embeddings` table has a `vector(384)` column
- The `user_voice_embeddings` table has a `vector(192)` column
- HNSW indexes exist on both vector columns
- A test cosine similarity query (`<=>`) returns a valid numeric result

Run with:

```bash
npm run db:verify-vectors
```

This script exits with code `0` on success and `1` on any failure, making it usable in CI pre-flight checks.

---

## 4. Test Patterns and Conventions

### Stub isolation with `sinon.restore()`

Every test file that uses Sinon stubs calls `sinon.restore()` (or `sandbox.restore()` for sandbox-based setups) in `beforeEach` or `afterEach` to prevent stub leakage between tests.

```js
beforeEach(() => {
  sinon.restore();
});
```

### Sandbox pattern for complex multi-stub tests

For tests that need multiple coordinated stubs, `sinon.createSandbox()` is used instead of standalone stubs. All stubs created within the sandbox are automatically restored in one call.

```js
let sandbox;
beforeEach(() => { sandbox = sinon.createSandbox(); });
afterEach(() => { sandbox.restore(); });
```

### Proxyquire for deep dependency injection

When a module's behaviour depends on a `require`-time dependency (e.g., `PostMeetingProcessor` requires `ActionItemService` at the top of the file), `proxyquire` is used to inject a stub at the module level without modifying production code.

```js
const PostMeetingProcessor = proxyquire('../src/services/PostMeetingProcessor', {
  './ActionItemService': ActionItemServiceStub,
  '../models/Meeting': MeetingStub
});
```

### Stub-first tests for un-instantiable services

For services that depend on live database connections, running Python subprocesses, or external API keys, the tests use anonymous stubs that mirror the expected function signature rather than importing the service directly. This approach:

- Keeps the test suite runnable in a CI environment without credentials or running infrastructure
- Documents the expected contract (inputs/outputs) of the function
- Isolates the test from external failure modes

```js
it('should generate a recap from transcript chunks', async () => {
  const stub = sinon.stub().resolves({ recap: 'Debating REST vs GraphQL', timestamp: '...' });
  const result = await stub(101, [{ text: 'Should we use REST or GraphQL?' }]);
  expect(result.recap).to.include('GraphQL');
});
```

### Direct service import for pure functions

When a service method is a pure function (no I/O side effects), it is imported and exercised directly with real code. Filesystem calls are stubbed at the `fs` module level.

```js
const TranscriptionService = require('../src/services/TranscriptionService');
// fs methods stubbed in beforeEach
const svc = new TranscriptionService('/tmp/fake', null, 1);
const cleaned = svc.cleanTranscriptionText(raw);
expect(cleaned).to.equal('Hello everyone this is a test phrase');
```

---

## 5. Coverage Areas

### Covered

| Area | Test Type | File |
|---|---|---|
| JWT middleware (all branches) | Unit | `authentication.test.js` |
| Transcript text cleaning and SRT formatting | Unit | `transcriptionService.test.js` |
| Speaker-to-utterance time overlap assignment | Unit | `transcriptionService.test.js` |
| Transcript statistics aggregation | Unit | `transcriptionService.test.js` |
| AI insights generation (stub contract) | Unit/stub | `aiInsights.test.js` |
| Action item extraction and deduplication | Unit (real service) | `actionItems.test.js` |
| Post-meeting processor lifecycle | Unit (proxyquire) | `postMeetingProcessor.test.js` |
| Whisper Mode cron and WebSocket flow | Stub | `whisperMode.test.js` |
| Hybrid search (vector + FTS) contract | Stub | `smartSearch.test.js` |
| Memory context retrieval and caching | Stub | `memoryContext.test.js` |
| Task deadline parsing (chrono-node) | Stub | `taskManagement.test.js` |
| Priority classification | Stub | `taskManagement.test.js` |
| Quiet hours enforcement (daytime + overnight) | Stub | `taskManagement.test.js` |
| Reminder deduplication | Stub | `taskManagement.test.js` |
| WebSocket room routing | Unit | `webSocketServer.test.js` |
| Notification CRUD | Unit | `notificationService.test.js` |
| Puppeteer bot lifecycle | Unit | `meetService.test.js` |
| File upload and deletion | Unit | `uploadService.test.js` |
| 384-dim embedding correctness | Integration | `test-embedding-pipeline.js` |
| pgvector extension and HNSW indexes | Infrastructure | `verify-pgvector-setup.js` |

### Not Currently Covered

| Area | Reason |
|---|---|
| Python AI agents (summary, decisions, etc.) | Require LLM API keys and Python runtime; covered by manual integration testing |
| SpeakerMatchingEngine (biometric pipeline) | Requires live audio files, Python encoder subprocess, and DB with enrolled embeddings |
| LiveSpeakerIdentifier sliding-window logic | Depends on `EmbeddingServerProcess` Python warm process |
| Google Calendar OAuth flow | Requires Google OAuth credentials and redirect URI |
| Puppeteer Meet/Zoom join (end-to-end) | Requires real meeting URLs and virtual audio routing |
| Frontend component tests | No frontend test suite currently exists |
| API route integration tests | No HTTP-level integration tests; route logic is tested via service-level unit tests |

---

## 6. Writing New Tests

### File naming

Place test files in `backend/tests/` with the suffix `.test.js`. Mocha discovers them via the `tests/**/*.test.js` glob pattern in `package.json`.

### Structure template

```js
const { expect } = require('chai');
const sinon = require('sinon');
// Import the module under test, or use proxyquire for dependency injection

describe('ModuleName', () => {

  beforeEach(() => {
    sinon.restore(); // or sandbox = sinon.createSandbox()
  });

  afterEach(() => {
    sinon.restore(); // or sandbox.restore()
  });

  describe('methodName()', () => {

    it('should [expected behaviour] when [condition]', async () => {
      // Arrange
      const stub = sinon.stub(SomeModule, 'someMethod').resolves({ result: true });

      // Act
      const result = await SomeService.doSomething(input);

      // Assert
      expect(result).to.deep.equal({ result: true });
      expect(stub.calledOnce).to.be.true;

      // Cleanup if not in afterEach
      stub.restore();
    });

  });
});
```

### Choosing the right test double type

| Need | Use |
|---|---|
| Replace a function entirely with a controlled return value | `sinon.stub()` |
| Verify that a function was called (with what arguments, how many times) | `sinon.spy()` |
| Replace a `require`-time dependency | `proxyquire` |
| Stub Prisma without a real DB connection | Assign `prisma.modelName = { method: sinon.stub() }` directly on the imported singleton |
| Simulate time-dependent behaviour (cron, timeouts) | `sinon.useFakeTimers()` |

### Asserting on stubs

```js
// Called at least once
expect(stub.called).to.be.true;

// Called exactly N times
expect(stub.callCount).to.equal(2);

// Called with specific arguments
expect(stub.calledWith(101, 'transcript text')).to.be.true;

// First call's first argument
expect(stub.firstCall.args[0]).to.equal(101);
```

### Testing async error paths

```js
it('should handle errors gracefully', async () => {
  const stub = sinon.stub(SomeModule, 'method').rejects(new Error('DB_FAIL'));

  const result = await SomeService.safeWrapper();

  expect(result.error).to.equal('DB_FAIL');
});
```

Or for services that throw and callers that do not swallow:

```js
it('should throw on invalid input', async () => {
  try {
    await SomeService.method(null);
    expect.fail('Should have thrown');
  } catch (err) {
    expect(err.message).to.equal('Input required');
  }
});
```

---

## 7. Database and Infrastructure Tests

### pgvector verification (`npm run db:verify-vectors`)

This script connects to the live database specified in `DATABASE_URL` and performs the following checks in sequence:

1. **Extension check** — `SELECT extname FROM pg_extension WHERE extname = 'vector'`  
   Fails with a clear error if pgvector is not installed.

2. **Column type check** — Queries `information_schema.columns` for `vector(384)` and `vector(192)` columns in `meeting_embeddings` and `user_voice_embeddings` respectively.

3. **HNSW index check** — Queries `pg_indexes` to confirm HNSW indexes were created by the Prisma migrations.

4. **Functional cosine similarity check** — Inserts a test embedding, performs a `<=>` cosine distance query, and verifies the result is a valid float between 0 and 2.

Run this script after initial database setup or after any pgvector-related migration to confirm the vector infrastructure is healthy before starting the server.

### Seeding for manual integration testing

The `npm run seed` script (`backend/scripts/seedDemoWorkspace.js`) populates the database with:

- A demo workspace with four members (owner, admin, member, observer)
- Five sample meetings with completed status
- AI insights, action items, and tasks for two of the meetings
- Memory contexts and sample embeddings for searchable content

Use `npm run seed:reset` to clear and re-seed the workspace, and `npm run seed:embed` to regenerate embeddings for the seeded meetings after a vector schema change.

---

## 8. Known Limitations and Future Work

### Anonymous stubs for contract testing

A significant portion of the test suite uses anonymous stubs (functions that are not connected to the real implementation). These tests document and verify the _expected contract_ of a function but do not exercise the real code path. They are valuable as specification tests but do not provide execution coverage of the underlying service logic.

**Impact:** The following service paths have stub-only test coverage and would benefit from real unit or integration tests in future iterations:
- `MicroSummaryService.generateRecap()`
- `MeetingEmbeddingService.hybridSearchWorkspaceMeetings()`
- `MemoryContextService.getMeetingContext()`
- `TaskCreationService.parseDeadline()` (chrono-node integration)
- `ReminderService._isInQuietHours()`

### No frontend test suite

There are currently no frontend tests (React Testing Library, Vitest, or Playwright). Recommended additions:

| Priority | Area | Tooling |
|---|---|---|
| High | `useLiveTranscript.ts` — pending override map logic | Vitest + `@testing-library/react-hooks` |
| High | `useGraphData.ts` — fetch, filter, and focus logic | Vitest |
| Medium | `TranscriptTab`, `WhisperRecapTab` rendering | React Testing Library |
| Medium | `SmartSearchModal` keyboard navigation | React Testing Library |
| Low | Full workspace flows (meeting → insights → Kanban) | Playwright end-to-end |

### No HTTP-level integration tests

Route handler logic is not tested at the HTTP level. The recommended approach is to add Supertest-based integration tests that:

- Spin up the Express app in test mode with a test database
- Execute HTTP requests against real route handlers
- Assert on response status codes and body shapes

### CI configuration

No CI pipeline configuration file (GitHub Actions, GitLab CI, etc.) is committed to the repository. The recommended CI pipeline for this test suite:

```yaml
# Example GitHub Actions step
- name: Run backend tests
  run: |
    cd backend
    npm ci
    npm test
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    JWT_SECRET: test-secret-for-ci
    GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
```

The pgvector verification script should run as a separate pre-test step to validate database readiness.
