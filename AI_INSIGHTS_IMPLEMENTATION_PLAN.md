# AI Insights Implementation Plan

## Overview
This document outlines a complete approach for implementing AI-powered insights generation for the post-meeting details page. The system will use Grok Cloud API to analyze speaker-diarized transcripts and generate comprehensive insights that are stored in the database and displayed in the AI Insights Tab.

## Current State Analysis

### Frontend Requirements (AIInsightsPanel.tsx)
The AI Insights Tab displays the following sections:
1. **Meeting Summary** - Paragraph and bullet point formats
2. **Key Decisions** - Decision text, context, impact level, participants
3. **Action Items** - Item description, assignee, due date, priority
4. **Sentiment Analysis** - Overall sentiment, confidence, breakdown (positive/neutral/negative percentages)
5. **Key Topics** - Topic name, mention count, sentiment per topic
6. **Participant Analysis** - Speaking time percentage, engagement level, key contributions per participant

### Existing Agents
Located in `ai-layer/agents/`:
- ✅ `action_item_agent.py` - Already uses Grok API
- ✅ `decision_extraction_agent.py` - **UPGRADED** - Now uses Grok API
- ✅ `sentiment_analysis_agent.py` - **UPGRADED** - Now uses Grok API
- ✅ `summary_agent.py` - **UPGRADED** - Now uses Grok API
- ✅ `topic_segmentation_agent.py` - **UPGRADED** - Now uses Grok API
- ✅ `participant_analysis_agent.py` - **CREATED** - Now uses Grok API (Phase 2)

### Current Processing Flow
1. Meeting ends → `MeetingBot.stop()` is called
2. `TranscriptionService.finalize()` is called with complete audio path
3. Speaker diarization is performed
4. `transcript_diarized.json` is saved to meeting directory
5. **No AI insights generation currently happens**

### Database Schema
- `ai_insights` table exists with: `id`, `meeting_id`, `insight_type`, `content` (TEXT), `confidence_score`
- Content field can store JSON for structured data

## Implementation Progress

### ✅ Phase 1: Agent Enhancement & Creation - **COMPLETED**
- ✅ Summary Agent upgraded to Grok API
- ✅ Decision Extraction Agent upgraded to Grok API
- ✅ Sentiment Analysis Agent upgraded to Grok API
- ✅ Topic Segmentation Agent upgraded to Grok API

### ✅ Phase 2: Create Participant Analysis Agent - **COMPLETED**
- ✅ Created `participant_analysis_agent.py` with Grok API integration
- ✅ Analyzes speaking time, engagement, key contributions, and sentiment per participant
- ✅ Includes fallback statistical analysis method

### ✅ Phase 3: Transcript Format Conversion - **COMPLETED**
- ✅ Created `ai-layer/utils/transcript_converter.py`
- ✅ Functions to convert JSON to text format
- ✅ Functions to load and work with JSON format
- ✅ Speaker statistics calculation
- ✅ Transcript validation

### ✅ Phase 4: Orchestration Service - **COMPLETED**
- ✅ Created `backend/src/services/AIInsightsService.js`
- ✅ Implemented transcript loading and conversion
- ✅ Implemented parallel agent execution
- ✅ Implemented database saving with Prisma
- ✅ Implemented single execution check

### ✅ Phase 5: Integration with Meeting End Flow - **COMPLETED**
- ✅ Modified `TranscriptionService.finalize()` to trigger AI insights generation
- ✅ Integrated with existing transcription finalization flow
- ✅ Async execution to avoid blocking meeting end process
- ✅ Triggered after `saveDiarizedOutputs()` completes
- ✅ Comprehensive error handling and logging

### ✅ Phase 6: Backend API Endpoints - **COMPLETED**
- ✅ Created `GET /api/meetings/:id/ai-insights` endpoint
- ✅ Created `POST /api/meetings/:id/ai-insights/regenerate` endpoint
- ✅ Proper authentication and authorization
- ✅ Handles missing insights gracefully
- ✅ Formats response to match frontend expectations

### ✅ Phase 7: Frontend Integration - **COMPLETED**
- ✅ Added AI insights API methods to `api.ts`
- ✅ Created `useAIInsights` hook
- ✅ Updated `AIInsightsPanel` to use real API data
- ✅ Implemented loading states
- ✅ Implemented empty states (insights not generated)
- ✅ Implemented error handling
- ✅ Added regenerate functionality

### ⏳ Phase 8: Pending
- Phase 8: Testing and refinement

## Implementation Approach

### Phase 1: Agent Enhancement & Creation - ✅ **COMPLETED**

#### 1.1 Upgrade Existing Agents to Use Grok API - ✅ **DONE**

**Summary Agent** (`summary_agent.py`)
- **Current**: Simple extractive summary using first N sentences
- **Upgrade**: Use Grok API to generate:
  - Paragraph format: 2-3 paragraph comprehensive summary
  - Bullet points: 5-7 key bullet points
- **Input**: Complete speaker-diarized transcript (JSON format with speaker info)
- **Output**: 
  ```json
  {
    "paragraph": "Full paragraph summary...",
    "bullets": ["Bullet 1", "Bullet 2", ...],
    "confidence": 0.85
  }
  ```

**Decision Extraction Agent** (`decision_extraction_agent.py`)
- **Current**: Pattern matching for decision cue phrases
- **Upgrade**: Use Grok API to extract:
  - Decision statement
  - Context (when/where in meeting it was discussed)
  - Impact level (High/Medium/Low)
  - Participants involved
- **Input**: Speaker-diarized transcript
- **Output**:
  ```json
  {
    "decisions": [
      {
        "decision": "Decision text...",
        "context": "Context description...",
        "impact": "High|Medium|Low",
        "participants": ["Speaker1", "Speaker2"],
        "timestamp": 123.5,
        "confidence": 0.9
      }
    ]
  }
  ```

**Sentiment Analysis Agent** (`sentiment_analysis_agent.py`)
- **Current**: Simple word matching
- **Upgrade**: Use Grok API to analyze:
  - Overall sentiment (Positive/Neutral/Negative)
  - Confidence score
  - Breakdown percentages (positive, neutral, negative)
- **Input**: Speaker-diarized transcript
- **Output**:
  ```json
  {
    "overall": "Positive|Neutral|Negative",
    "confidence": 0.87,
    "breakdown": {
      "positive": 0.65,
      "neutral": 0.25,
      "negative": 0.10
    }
  }
  ```

**Topic Segmentation Agent** (`topic_segmentation_agent.py`)
- **Current**: Simple paragraph splitting with cue phrases
- **Upgrade**: Use Grok API to identify:
  - Topic names
  - Mention count per topic
  - Sentiment per topic
- **Input**: Speaker-diarized transcript
- **Output**:
  ```json
  {
    "topics": [
      {
        "name": "Topic name",
        "mentions": 15,
        "sentiment": "Positive|Neutral|Negative"
      }
    ]
  }
  ```

#### 1.2 Create New Participant Analysis Agent - ✅ **COMPLETED**

**Participant Analysis Agent** (`participant_analysis_agent.py`) - ✅ **CREATED**
- **Purpose**: Analyze each participant's contribution
- **Uses**: Grok API + speaker diarization data
- **Input**: Speaker-diarized transcript JSON
- **Output**:
  ```json
  {
    "participants": [
      {
        "name": "Speaker_0",
        "speakingTime": 0.45,  // Percentage (0-1)
        "speakingTimeSeconds": 540,
        "engagement": "High|Medium|Low",
        "keyContributions": [
          "Contribution 1",
          "Contribution 2"
        ],
        "sentiment": "Positive|Neutral|Negative"
      }
    ]
  }
  ```

### Phase 3: Transcript Format Conversion - ✅ **COMPLETED**

#### 3.1 Create Transcript Converter Utility - ✅ **DONE**
- **File**: `ai-layer/utils/transcript_converter.py`
- **Purpose**: Convert speaker-diarized JSON to text format for agents
- **Function**: `convert_diarized_json_to_text(diarized_json_path: str) -> str`
- **Format**: 
  ```
  [Speaker_0] (0.0s - 5.2s): Text content here...
  [Speaker_1] (5.2s - 12.5s): More text content...
  ```
- **Also**: Provide structured JSON format for agents that need speaker-level analysis

### Phase 3: Orchestration Service

#### 3.1 Create AI Insights Service
- **File**: `backend/src/services/AIInsightsService.js`
- **Purpose**: Orchestrate all agents and save results to database
- **Key Methods**:
  - `async generateInsights(meetingId)` - Main entry point
  - `async checkTranscriptAvailable(meetingId)` - Verify transcript_diarized.json exists
  - `async loadDiarizedTranscript(meetingId)` - Load and convert transcript
  - `async runAllAgents(transcriptText, transcriptJson)` - Execute all agents
  - `async saveInsightsToDatabase(meetingId, insights)` - Persist results

#### 3.2 Agent Execution Flow
```javascript
1. Load transcript_diarized.json
2. Convert to text format for text-based agents
3. Run agents in parallel where possible:
   - Summary Agent (needs full transcript)
   - Decision Agent (needs full transcript)
   - Sentiment Agent (needs full transcript)
   - Topic Agent (needs full transcript)
   - Action Item Agent (already exists, needs full transcript)
   - Participant Agent (needs JSON format with speaker data)
4. Aggregate results
5. Save to database
```

### Phase 4: Integration with Meeting End Flow

#### 4.1 Modify TranscriptionService.finalize()
- **Location**: `backend/src/services/TranscriptionService.js`
- **Change**: After `saveDiarizedOutputs()` completes successfully, trigger AI insights generation
- **Implementation**:
  ```javascript
  async finalize(completeAudioPath) {
    // ... existing diarization code ...
    
    await this.saveDiarizedOutputs();
    
    // NEW: Trigger AI insights generation
    if (this.meetingId) {
      try {
        const AIInsightsService = require('./AIInsightsService');
        // Run asynchronously - don't block transcription finalization
        AIInsightsService.generateInsights(this.meetingId)
          .then(() => console.log('✅ AI insights generation completed'))
          .catch(err => console.error('⚠️ AI insights generation failed:', err));
      } catch (error) {
        console.error('⚠️ Failed to trigger AI insights:', error);
      }
    }
    
    // ... rest of existing code ...
  }
  ```

#### 4.2 Ensure Single Execution
- **Mechanism**: Database flag or file-based lock
- **Option 1**: Add `ai_insights_generated` boolean field to meetings table
- **Option 2**: Check if insights already exist in `ai_insights` table for meeting
- **Option 3**: Create lock file `meeting_{id}_insights_processing.lock` in meeting directory
- **Recommended**: Combination of Option 1 + Option 2 for robustness

### Phase 5: Database Storage

#### 5.1 Database Schema Updates
- **Option A**: Use existing `ai_insights` table with JSON in `content` field
- **Option B**: Create separate tables for each insight type
- **Recommended**: Option A (simpler, flexible)

#### 5.2 Storage Structure
Store each insight type as separate row in `ai_insights` table:
```sql
-- Summary
INSERT INTO ai_insights (meeting_id, insight_type, content, confidence_score)
VALUES (meetingId, 'summary', JSON_OBJECT('paragraph': ..., 'bullets': [...]), 0.85);

-- Decisions (one row per decision or JSON array)
INSERT INTO ai_insights (meeting_id, insight_type, content, confidence_score)
VALUES (meetingId, 'decisions', JSON_ARRAY(...), 0.9);

-- Sentiment
INSERT INTO ai_insights (meeting_id, insight_type, content, confidence_score)
VALUES (meetingId, 'sentiment', JSON_OBJECT(...), 0.87);

-- Topics
INSERT INTO ai_insights (meeting_id, insight_type, content, confidence_score)
VALUES (meetingId, 'topics', JSON_ARRAY(...), 0.8);

-- Participants
INSERT INTO ai_insights (meeting_id, insight_type, content, confidence_score)
VALUES (meetingId, 'participants', JSON_ARRAY(...), 0.85);
```

### Phase 6: Backend API Endpoints

#### 6.1 Get AI Insights Endpoint
- **Route**: `GET /api/meetings/:id/ai-insights`
- **Location**: `backend/src/routes/meetingRoutes.js`
- **Response**:
  ```json
  {
    "summary": { "paragraph": "...", "bullets": [...] },
    "keyDecisions": [...],
    "actionItems": [...],
    "sentiment": { "overall": "...", "confidence": 0.87, "breakdown": {...} },
    "topics": [...],
    "participants": [...]
  }
  ```

#### 6.2 Regenerate Insights Endpoint (Optional)
- **Route**: `POST /api/meetings/:id/ai-insights/regenerate`
- **Purpose**: Allow manual regeneration if needed
- **Implementation**: Clear existing insights and call `AIInsightsService.generateInsights()`

### Phase 7: Frontend Integration

#### 7.1 Update AIInsightsPanel Component
- **File**: `frontend/src/components/meetings/details/AIInsightsPanel.tsx`
- **Changes**:
  - Remove mock data
  - Add API call to fetch insights
  - Handle loading states
  - Handle empty states (insights not yet generated)
  - Display actual data from API

#### 7.2 Create Hook for AI Insights
- **File**: `frontend/src/hooks/useAIInsights.ts`
- **Purpose**: Fetch and manage AI insights state
- **Implementation**:
  ```typescript
  export const useAIInsights = (meetingId: string) => {
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
      fetchInsights(meetingId);
    }, [meetingId]);
    
    return { insights, loading, error, refetch };
  };
  ```

## Execution Flow Diagram

```
Meeting Ends
    ↓
MeetingBot.stop()
    ↓
TranscriptionService.finalize()
    ↓
Speaker Diarization Complete
    ↓
transcript_diarized.json saved
    ↓
AIInsightsService.generateInsights() triggered (async)
    ↓
Check: Insights already generated? → YES → Skip
    ↓ NO
Load transcript_diarized.json
    ↓
Convert to text format
    ↓
Run All Agents (parallel where possible):
    ├─ Summary Agent (Grok API)
    ├─ Decision Agent (Grok API)
    ├─ Sentiment Agent (Grok API)
    ├─ Topic Agent (Grok API)
    ├─ Action Item Agent (Grok API) [already exists]
    └─ Participant Agent (Grok API) [new]
    ↓
Aggregate Results
    ↓
Save to ai_insights table
    ↓
Mark meeting as insights_generated = true
    ↓
Complete
```

## Error Handling & Resilience

### 1. Agent Failure Handling
- If one agent fails, continue with others
- Log failures but don't block entire process
- Store partial results if available

### 2. Retry Mechanism
- If Grok API fails, retry up to 3 times with exponential backoff
- If all retries fail, use fallback heuristic methods (for agents that have them)

### 3. Transcript Availability
- Check if `transcript_diarized.json` exists before processing
- If not available, log error and skip (don't crash)
- Allow manual regeneration later via API endpoint

### 4. Database Transaction Safety
- Use transactions when saving multiple insight rows
- Rollback on failure to maintain consistency

## Performance Considerations

### 1. Parallel Execution
- Run independent agents in parallel (Summary, Decisions, Sentiment, Topics can run simultaneously)
- Participant analysis can run in parallel with others
- Action items can run in parallel

### 2. Transcript Size Handling
- For very long transcripts (>50k words), consider chunking
- Or use Grok API's context window efficiently
- May need to summarize transcript first, then run agents on summary + key sections

### 3. Caching
- Once insights are generated, cache in memory for quick access
- Invalidate cache when meeting transcript is updated

## Testing Strategy

### 1. Unit Tests
- Test each agent individually with sample transcripts
- Test transcript converter utility
- Test database save/load functions

### 2. Integration Tests
- Test full flow: meeting end → transcript → insights generation → database save
- Test error scenarios (API failures, missing files, etc.)

### 3. Manual Testing
- Test with real meeting recordings
- Verify all insight types are generated correctly
- Verify frontend displays data correctly

## Environment Variables

Add to `.env`:
```
GROK_API_KEY=xai-...  # Already exists for action_item_agent
```

## File Structure

```
ai-layer/
├── agents/
│   ├── action_item_agent.py (✅ exists, uses Grok)
│   ├── decision_extraction_agent.py (✅ upgraded to Grok)
│   ├── sentiment_analysis_agent.py (✅ upgraded to Grok)
│   ├── summary_agent.py (✅ upgraded to Grok)
│   ├── topic_segmentation_agent.py (✅ upgraded to Grok)
│   └── participant_analysis_agent.py (✅ Phase 2 - created)
├── utils/
│   ├── __init__.py (✅ created)
│   └── transcript_converter.py (✅ Phase 3 - created)
└── run_agents.py (✅ updated to include participant agent support)

backend/
├── src/
│   ├── services/
│   │   ├── AIInsightsService.js (✅ Phase 4 - created)
│   │   └── TranscriptionService.js (✅ Phase 5 - modified finalize method)
│   └── routes/
│       └── meetingRoutes.js (✅ Phase 6 - added GET and POST endpoints)

frontend/
└── src/
    ├── components/
    │   └── meetings/
    │       └── details/
    │           └── AIInsightsPanel.tsx (✅ Phase 7 - updated to use real API)
    └── hooks/
        └── useAIInsights.ts (✅ Phase 7 - created)
```

## Implementation Order

1. ✅ **Phase 1**: Upgrade existing agents to use Grok API - **COMPLETED**
2. ✅ **Phase 2**: Create participant analysis agent - **COMPLETED**
3. ✅ **Phase 3**: Create transcript converter utility - **COMPLETED**
4. ✅ **Phase 4**: Create AIInsightsService orchestration - **COMPLETED**
5. ✅ **Phase 5**: Integrate with TranscriptionService.finalize() - **COMPLETED**
6. ✅ **Phase 6**: Create backend API endpoint - **COMPLETED**
7. ✅ **Phase 7**: Update frontend to use real API - **COMPLETED**
8. **Phase 8**: Testing and refinement

## Success Criteria

✅ All 6 insight types are generated when meeting ends
✅ Insights are saved to database correctly
✅ Frontend displays all insights properly
✅ Process runs exactly once per meeting
✅ Error handling prevents crashes
✅ Performance is acceptable (< 2 minutes for typical meeting)
✅ Insights quality is good (validated with real meetings)

## Notes

- All agents should use `grok-4.1-fast` model for cost efficiency (same as action_item_agent)
- Transcript format: Pass both text format (for most agents) and JSON format (for participant analysis)
- Database: Use JSON storage in `content` field for flexibility
- Single execution: Check database for existing insights before generating
- Async processing: Don't block meeting end flow, run insights generation asynchronously


