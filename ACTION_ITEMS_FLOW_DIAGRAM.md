# Action Items Processing Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MEETING IN PROGRESS                      │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIO RECORDER SERVICE                        │
│  • Captures audio chunks every 3 seconds                         │
│  • Transcribes via WhisperX                                      │
│  • Writes to live transcript file                                │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LIVE TRANSCRIPT FILE (TXT)                      │
│  • Updated in real-time                                          │
│  • Growing file with meeting conversation                        │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              ACTION ITEM EXTRACTION (Every 30s)                  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DECISION: Full or Incremental?                           │   │
│  │                                                           │   │
│  │  If < 2 min since last full:                             │   │
│  │    → INCREMENTAL (new content only)                      │   │
│  │    → Confidence threshold: 0.4                           │   │
│  │    → Process last 500 chars + new content                │   │
│  │                                                           │   │
│  │  If ≥ 2 min since last full:                             │   │
│  │    → FULL RE-EXTRACTION (entire transcript)              │   │
│  │    → Confidence threshold: 0.5                           │   │
│  │    → Process complete transcript                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI AGENT (GROQ/GPT)                           │
│  • Analyzes transcript text                                      │
│  • Extracts action items                                         │
│  • Returns: title, description, assignee, due date, confidence   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DEDUPLICATION & MERGING                         │
│                                                                   │
│  For each extracted action item:                                 │
│                                                                   │
│  1. Generate canonical key                                       │
│     └─ hash(normalized_title + normalized_assignee)              │
│                                                                   │
│  2. Check if exists in database                                  │
│     ├─ YES: Merge with existing                                  │
│     │   ├─ Compare title (use more detailed)                     │
│     │   ├─ Compare description (append if new info)              │
│     │   ├─ Compare assignee (update if changed)                  │
│     │   ├─ Compare due date (update if changed)                  │
│     │   ├─ Compare confidence (increase if higher)               │
│     │   └─ Track changes in history                              │
│     │                                                             │
│     └─ NO: Create new action item                                │
│         └─ Save to database with status: 'pending'               │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE UPDATE                               │
│                                                                   │
│  IF hasChanges = true:                                           │
│    ├─ Update action item in database                             │
│    ├─ Add to itemsToUpdate list                                  │
│    └─ Proceed to broadcast                                       │
│                                                                   │
│  IF hasChanges = false:                                          │
│    ├─ Only update lastSeenAt timestamp                           │
│    └─ Skip broadcast (no need to notify)                         │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  WEBSOCKET BROADCAST                             │
│                                                                   │
│  IF (added > 0 OR updated > 0):                                  │
│    ├─ Format items to DTO                                        │
│    ├─ Create WebSocket message                                   │
│    └─ Broadcast to all connected clients                         │
│                                                                   │
│  Message format:                                                 │
│  {                                                                │
│    type: 'action_items',                                         │
│    data: {                                                        │
│      actionItems: [...],                                         │
│      timestamp: '2024-...'                                       │
│    }                                                              │
│  }                                                                │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (LIVE PANEL)                         │
│  • Receives WebSocket message                                    │
│  • Updates action items list                                     │
│  • Shows new items with animation                                │
│  • Updates existing items with highlight                         │
│  • Displays within 30 seconds of mention                         │
└─────────────────────────────────────────────────────────────────┘
```

## Timeline Example

```
Time    Event                           Action
─────────────────────────────────────────────────────────────────
00:00   Meeting starts                  Recording begins
00:05   "John, prepare slides"          Captured in transcript
00:30   First extraction cycle          ✅ Action item detected
        (incremental)                   → Broadcast to frontend
                                        → Appears in live panel

00:45   "Include Q4 data"               Captured in transcript
01:00   Second extraction cycle         ✅ Update detected
        (incremental)                   → Description appended
                                        → Broadcast update
                                        → Panel shows update

02:00   Third extraction cycle          🔄 Full re-extraction
        (full re-extraction)            → Verifies all items
                                        → Catches any missed updates

02:15   "Sarah will help"               Captured in transcript
02:30   Fourth extraction cycle         ✅ Assignee change detected
        (incremental)                   → Assignee updated
                                        → History tracked
                                        → Broadcast update
```

## Processing Decision Tree

```
┌─────────────────────────────────────┐
│   30 Second Timer Triggers          │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│   Check: Time since last full?      │
└─────────────────────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
    < 2 min         ≥ 2 min
        │               │
        ▼               ▼
┌──────────────┐  ┌──────────────┐
│ INCREMENTAL  │  │     FULL     │
│              │  │              │
│ • New text   │  │ • All text   │
│ • 500 char   │  │ • Complete   │
│   overlap    │  │   transcript │
│ • Threshold  │  │ • Threshold  │
│   0.4        │  │   0.5        │
└──────────────┘  └──────────────┘
        │               │
        └───────┬───────┘
                ▼
┌─────────────────────────────────────┐
│   Extract Action Items (AI)         │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│   For each item:                    │
│   Generate canonical key            │
└─────────────────────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
    Exists          New Item
        │               │
        ▼               ▼
┌──────────────┐  ┌──────────────┐
│    MERGE     │  │    CREATE    │
│              │  │              │
│ • Compare    │  │ • Save to DB │
│ • Detect     │  │ • Set status │
│   changes    │  │   'pending'  │
│ • Update if  │  │ • Add to     │
│   different  │  │   broadcast  │
└──────────────┘  └──────────────┘
        │               │
        └───────┬───────┘
                ▼
┌─────────────────────────────────────┐
│   Broadcast via WebSocket           │
│   (only if changes detected)        │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│   Frontend Updates                  │
│   (within 30 seconds)               │
└─────────────────────────────────────┘
```

## Merge Logic Flow

```
┌─────────────────────────────────────┐
│   Existing Item Found               │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│   Initialize:                       │
│   • hasChanges = false              │
│   • updates = { lastSeenAt }        │
│   • historyEntry = { changes: {} }  │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│   Compare Title                     │
│   New longer & different?           │
└─────────────────────────────────────┘
        │
        ├─ YES → Update title
        │        hasChanges = true
        │
        └─ NO  → Keep existing
                │
                ▼
┌─────────────────────────────────────┐
│   Compare Description               │
│   New info not contained?           │
└─────────────────────────────────────┘
        │
        ├─ YES → Append with timestamp
        │        hasChanges = true
        │
        └─ NO  → Keep existing
                │
                ▼
┌─────────────────────────────────────┐
│   Compare Assignee                  │
│   Different?                        │
└─────────────────────────────────────┘
        │
        ├─ YES → Update assignee
        │        hasChanges = true
        │
        └─ NO  → Keep existing
                │
                ▼
┌─────────────────────────────────────┐
│   Compare Due Date                  │
│   Different?                        │
└─────────────────────────────────────┐
        │
        ├─ YES → Update due date
        │        hasChanges = true
        │
        └─ NO  → Keep existing
                │
                ▼
┌─────────────────────────────────────┐
│   Compare Confidence                │
│   New higher?                       │
└─────────────────────────────────────┘
        │
        ├─ YES → Update confidence
        │        hasChanges = true
        │
        └─ NO  → Keep existing
                │
                ▼
┌─────────────────────────────────────┐
│   Return Result                     │
│   { updates, hasChanges }           │
└─────────────────────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
    hasChanges      hasChanges
    = true          = false
        │               │
        ▼               ▼
┌──────────────┐  ┌──────────────┐
│   UPDATE DB  │  │  UPDATE ONLY │
│   + HISTORY  │  │  lastSeenAt  │
│   + BROADCAST│  │  (no broadcast)
└──────────────┘  └──────────────┘
```

## Key Performance Metrics

```
┌─────────────────────────────────────────────────────────┐
│                    PERFORMANCE GOALS                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Detection Latency:        < 30 seconds                 │
│  Update Detection:         > 90% accuracy               │
│  Duplicate Rate:           < 5%                         │
│  WebSocket Delivery:       > 95% success                │
│  Processing Time:          < 5 seconds per cycle        │
│  Memory Usage:             Stable over time             │
│  API Call Efficiency:      Reduced via incremental      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Configuration Summary

```
┌─────────────────────────────────────────────────────────┐
│                  TUNABLE PARAMETERS                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  EXTRACTION_INTERVAL:           30000 ms (30s)          │
│  FULL_EXTRACTION_INTERVAL:      120000 ms (2min)        │
│  OVERLAP_SIZE:                  500 characters          │
│  CONFIDENCE_THRESHOLD_INCR:     0.4                     │
│  CONFIDENCE_THRESHOLD_FULL:     0.5                     │
│  MIN_TRANSCRIPT_LENGTH:         50 characters           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```
