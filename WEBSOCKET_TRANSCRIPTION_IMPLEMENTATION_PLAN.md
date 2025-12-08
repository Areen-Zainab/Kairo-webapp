# WebSocket Live Transcription Implementation Plan

## Overview

Replace the current 3-second polling mechanism with WebSocket-based real-time push delivery for live transcription chunks. This will reduce latency from ~1.5-3 seconds to ~15-60ms.

**Current State:** Frontend polls `/api/meetings/:id/transcript/live` every 3 seconds  
**Target State:** Backend pushes transcript chunks immediately via WebSocket when transcription completes

---

## Benefits

- **Latency Reduction:** 1.5-3 seconds → 15-60ms (99% improvement)
- **Lower Server Load:** Eliminates constant polling requests
- **Better UX:** Real-time transcript updates
- **Scalability:** More efficient for many concurrent users
- **Reduced Network Traffic:** Only send data when available

---

## Architecture Changes

### Current Flow
```
[Transcription Complete] → [Save to File] → [Frontend Polls Every 3s] → [Read File] → [Display]
```

### New Flow
```
[Transcription Complete] → [Save to File] → [Broadcast via WebSocket] → [Frontend Receives] → [Display]
```

---

## Implementation Steps

### Phase 1: Backend WebSocket Infrastructure

#### Step 1.1: Install WebSocket Library
**File:** `backend/package.json`

**Action:**
```bash
npm install ws
npm install --save-dev @types/ws  # If using TypeScript
```

**Verification:**
- Check `package.json` includes `ws` dependency
- Version: `ws@^8.x.x` (latest stable)

---

#### Step 1.2: Create WebSocket Server Module
**New File:** `backend/src/services/WebSocketServer.js`

**Purpose:** Centralized WebSocket server management

**Implementation:**
```javascript
const WebSocket = require('ws');
const url = require('url');

// Map: meetingId -> Set<WebSocket connections>
const meetingConnections = new Map();

// WebSocket server instance (will be initialized in server.js)
let wss = null;

/**
 * Initialize WebSocket server
 * @param {Server} httpServer - HTTP server instance
 */
function initializeWebSocketServer(httpServer) {
  wss = new WebSocket.Server({ noServer: true });

  // Handle HTTP upgrade to WebSocket
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    
    if (pathname === '/ws/transcript') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle new WebSocket connections
  wss.on('connection', (ws, request) => {
    const queryParams = url.parse(request.url, true).query;
    const meetingId = parseInt(queryParams.meetingId);

    if (!meetingId || isNaN(meetingId)) {
      console.warn('⚠️  WebSocket connection rejected: invalid meetingId');
      ws.close(1008, 'Invalid meeting ID');
      return;
    }

    // Add connection to meeting's connection set
    if (!meetingConnections.has(meetingId)) {
      meetingConnections.set(meetingId, new Set());
    }
    meetingConnections.get(meetingId).add(ws);

    console.log(`✅ WebSocket connected for meeting ${meetingId} (${meetingConnections.get(meetingId).size} connections)`);

    // Handle connection close
    ws.on('close', () => {
      const connections = meetingConnections.get(meetingId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          meetingConnections.delete(meetingId);
        }
        console.log(`🔌 WebSocket disconnected for meeting ${meetingId} (${meetingConnections.get(meetingId)?.size || 0} remaining)`);
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for meeting ${meetingId}:`, error.message);
    });

    // Send welcome message (optional)
    ws.send(JSON.stringify({
      type: 'connected',
      meetingId: meetingId,
      timestamp: new Date().toISOString()
    }));
  });

  console.log('✅ WebSocket server initialized');
}

/**
 * Broadcast transcript chunk to all connected clients for a meeting
 * @param {number} meetingId - Meeting ID
 * @param {object} transcriptData - Transcript data {chunkIndex, text, timestamp, speaker}
 */
function broadcastTranscript(meetingId, transcriptData) {
  const connections = meetingConnections.get(meetingId);
  
  if (!connections || connections.size === 0) {
    // No connections - silent fail (normal if no one is watching)
    return;
  }

  const message = JSON.stringify({
    type: 'transcript',
    data: {
      chunkIndex: transcriptData.chunkIndex,
      text: transcriptData.text,
      timestamp: transcriptData.timestamp,
      speaker: transcriptData.speaker || 'Speaker 1',
      rawTimestamp: transcriptData.timestamp
    }
  });

  let sentCount = 0;
  let failedCount = 0;

  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
        sentCount++;
      } catch (error) {
        console.error(`❌ Error sending WebSocket message to meeting ${meetingId}:`, error.message);
        failedCount++;
        // Remove failed connection
        connections.delete(ws);
      }
    } else {
      // Remove closed connections
      connections.delete(ws);
      failedCount++;
    }
  });

  // Clean up empty connection sets
  if (connections.size === 0) {
    meetingConnections.delete(meetingId);
  }

  if (sentCount > 0) {
    console.log(`📤 Broadcast transcript chunk ${transcriptData.chunkIndex} to ${sentCount} client(s) for meeting ${meetingId}`);
  }
}

/**
 * Get number of active connections for a meeting
 * @param {number} meetingId - Meeting ID
 * @returns {number} Number of active connections
 */
function getConnectionCount(meetingId) {
  return meetingConnections.get(meetingId)?.size || 0;
}

/**
 * Close all connections for a meeting
 * @param {number} meetingId - Meeting ID
 */
function closeMeetingConnections(meetingId) {
  const connections = meetingConnections.get(meetingId);
  if (connections) {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Meeting ended');
      }
    });
    meetingConnections.delete(meetingId);
    console.log(`🔌 Closed all WebSocket connections for meeting ${meetingId}`);
  }
}

module.exports = {
  initializeWebSocketServer,
  broadcastTranscript,
  getConnectionCount,
  closeMeetingConnections
};
```

**Testing:**
- Verify WebSocket server initializes without errors
- Test connection with `wscat` or browser console
- Verify connection tracking works

---

#### Step 1.3: Integrate WebSocket Server into Express Server
**File:** `backend/src/server.js`

**Changes:**
```javascript
// Add at top with other requires
const { initializeWebSocketServer } = require('./services/WebSocketServer');

// Modify server.listen() section:
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`🚀  Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  
  // Initialize WebSocket server
  initializeWebSocketServer(server);
  
  // Initialize cron jobs after server starts
  initializeCronJobs();
  
  // ... rest of existing code
});
```

**Testing:**
- Verify server starts without errors
- Check WebSocket server initialization log
- Test WebSocket endpoint is accessible

---

### Phase 2: Integrate Broadcasting into Transcription Service

#### Step 2.1: Add Broadcast Call to TranscriptionService
**File:** `backend/src/services/TranscriptionService.js`

**Location:** After successful transcription (around line 174)

**Changes:**
```javascript
// Add require at top of file
const { broadcastTranscript } = require('./WebSocketServer');

// Modify the transcribe() method result handling (after line 174):
// Log transcription result
console.log(`✅ Chunk ${chunkNum} transcription done`);

// Broadcast to WebSocket clients (non-blocking)
if (this.meetingId) {
  try {
    const meetingIdNum = typeof this.meetingId === 'string' 
      ? parseInt(this.meetingId, 10) 
      : this.meetingId;
    
    if (!isNaN(meetingIdNum)) {
      broadcastTranscript(meetingIdNum, {
        chunkIndex: chunkNum,
        text: cleanedText.trim(),
        timestamp: timestamp,
        speaker: 'Speaker 1' // Will be updated after diarization
      });
    }
  } catch (broadcastError) {
    // Don't fail transcription if broadcast fails
    console.warn(`⚠️  Failed to broadcast transcript chunk ${chunkNum}:`, broadcastError.message);
  }
}

return {
  success: true,
  text: cleanedText.trim(),
  chunk: chunkNum,
  timestamp: timestamp,
  chunkFile: chunkTranscriptPath
};
```

**Testing:**
- Verify broadcast is called after transcription
- Check WebSocket messages are sent
- Verify no errors if WebSocket server not initialized

---

### Phase 3: Frontend WebSocket Integration

#### Step 3.1: Update useLiveTranscript Hook
**File:** `frontend/src/hooks/useLiveTranscript.ts`

**Changes:**
```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { apiService } from '../services/api';

export interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  chunkIndex: number;
  rawTimestamp: string;
}

export const useLiveTranscript = (meetingId: number | null, pollInterval = 3000) => {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePolling, setUsePolling] = useState(false); // Fallback flag
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const lastTimestampRef = useRef<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Format timestamp for display
  const formatTimestamp = useCallback((timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  // Polling fallback function
  const fetchTranscript = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getLiveTranscript(
        meetingId,
        lastTimestampRef.current || undefined
      );

      if (response.data?.entries) {
        const data = response.data;
        
        setEntries((prev) => {
          const map = new Map(prev.map((entry) => [entry.id, entry]));
          
          data.entries.forEach((entry: TranscriptEntry) => {
            map.set(entry.id, entry);
          });
          
          return Array.from(map.values()).sort((a, b) => a.chunkIndex - b.chunkIndex);
        });

        if (data.latestTimestamp) {
          lastTimestampRef.current = data.latestTimestamp;
        }
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transcript');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  // WebSocket connection logic
  useEffect(() => {
    if (!meetingId) return;

    // Use polling fallback if WebSocket failed too many times
    if (usePolling) {
      // Initial fetch
      fetchTranscript();
      
      // Set up polling interval
      intervalRef.current = window.setInterval(fetchTranscript, pollInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }

    // Try WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || (protocol === 'wss:' ? '443' : '5000');
    const wsUrl = `${protocol}//${host}:${port}/ws/transcript?meetingId=${meetingId}`;

    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ WebSocket connected for live transcript');
      setError(null);
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on success
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'transcript') {
          const data = message.data;
          
          setEntries((prev) => {
            const map = new Map(prev.map((entry) => [entry.id, entry]));
            
            map.set(`chunk_${data.chunkIndex}`, {
              id: `chunk_${data.chunkIndex}`,
              chunkIndex: data.chunkIndex,
              text: data.text,
              timestamp: formatTimestamp(data.timestamp),
              rawTimestamp: data.timestamp,
              speaker: data.speaker || 'Speaker 1'
            });
            
            return Array.from(map.values()).sort((a, b) => a.chunkIndex - b.chunkIndex);
          });

          // Update last timestamp
          lastTimestampRef.current = data.timestamp;
        } else if (message.type === 'connected') {
          console.log(`✅ WebSocket connection confirmed for meeting ${message.meetingId}`);
          
          // Fetch existing transcripts on initial connection
          fetchTranscript();
        }
      } catch (parseError) {
        console.error('❌ Error parsing WebSocket message:', parseError);
      }
    };

    ws.onerror = (error) => {
      console.warn('⚠️ WebSocket error:', error);
      setError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      console.log(`🔌 WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
      
      // Attempt reconnection if not intentional close
      if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000); // Exponential backoff, max 10s
        
        console.log(`🔄 Attempting to reconnect WebSocket (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms...`);
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          // Trigger reconnection by re-running effect
          // This will happen automatically when dependencies change
        }, delay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.warn('⚠️ Max WebSocket reconnect attempts reached, falling back to polling');
        setUsePolling(true);
      }
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [meetingId, usePolling, fetchTranscript, formatTimestamp, pollInterval]);

  return {
    entries,
    loading,
    error,
    refresh: fetchTranscript,
    connectionType: usePolling ? 'polling' : 'websocket'
  };
};
```

**Testing:**
- Verify WebSocket connects on component mount
- Test receiving transcript messages
- Test reconnection logic
- Test fallback to polling

---

#### Step 3.2: Update Components Using useLiveTranscript (Optional)
**Files:** `frontend/src/pages/meetings/MeetingLive.tsx`, `frontend/src/components/meetings/meetingslive/TranscriptTab.tsx`

**Changes:**
- No changes required - hook interface remains the same
- Optionally display connection type (WebSocket vs polling) for debugging

**Optional Enhancement:**
```typescript
const { entries, connectionType } = useLiveTranscript(meetingId, 3000);

// Display connection status (optional)
{connectionType === 'polling' && (
  <div className="text-xs text-yellow-600">
    ⚠️ Using polling fallback
  </div>
)}
```

---

### Phase 4: Authentication & Security

#### Step 4.1: Add Authentication to WebSocket Connections
**File:** `backend/src/services/WebSocketServer.js`

**Changes:**
```javascript
// Add require at top
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Modify connection handler:
wss.on('connection', async (ws, request) => {
  const queryParams = url.parse(request.url, true).query;
  const meetingId = parseInt(queryParams.meetingId);
  const token = queryParams.token || request.headers.authorization?.replace('Bearer ', '');

  if (!meetingId || isNaN(meetingId)) {
    ws.close(1008, 'Invalid meeting ID');
    return;
  }

  // Validate token and meeting access
  try {
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Check if user has access to meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: userId }
            }
          }
        }
      }
    });

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const hasAccess = meeting.workspace.members.length > 0;
    if (!hasAccess) {
      throw new Error('Access denied');
    }

    // Authentication successful - proceed with connection
    // ... rest of connection logic
  } catch (authError) {
    console.warn(`⚠️  WebSocket authentication failed for meeting ${meetingId}:`, authError.message);
    ws.close(1008, 'Authentication failed');
    return;
  }
});
```

**Frontend Changes:**
**File:** `frontend/src/hooks/useLiveTranscript.ts`

**Changes:**
```typescript
// Get auth token
const token = localStorage.getItem('token') || sessionStorage.getItem('token');

const wsUrl = `${protocol}//${host}:${port}/ws/transcript?meetingId=${meetingId}&token=${token}`;
```

**Testing:**
- Verify unauthorized connections are rejected
- Test with valid/invalid tokens
- Verify meeting access is checked

---

### Phase 5: Cleanup & Optimization

#### Step 5.1: Close Connections on Meeting End
**File:** `backend/src/services/MeetingBot.js`

**Changes:**
```javascript
// Add require at top
const { closeMeetingConnections } = require('./WebSocketServer');

// In stop() method, after cleanup:
// Close WebSocket connections for this meeting
if (this.meetingId) {
  try {
    closeMeetingConnections(parseInt(this.meetingId));
  } catch (error) {
    console.warn(`⚠️  Error closing WebSocket connections:`, error.message);
  }
}
```

---

#### Step 5.2: Add Connection Monitoring (Optional)
**File:** `backend/src/services/WebSocketServer.js`

**Add:**
```javascript
/**
 * Get statistics about WebSocket connections
 * @returns {object} Connection statistics
 */
function getConnectionStats() {
  let totalConnections = 0;
  const meetingStats = {};
  
  meetingConnections.forEach((connections, meetingId) => {
    const count = connections.size;
    totalConnections += count;
    meetingStats[meetingId] = count;
  });
  
  return {
    totalConnections,
    activeMeetings: meetingConnections.size,
    meetings: meetingStats
  };
}

module.exports = {
  // ... existing exports
  getConnectionStats
};
```

---

## Testing Plan

### Unit Tests

1. **WebSocket Server**
   - Test connection handling
   - Test broadcast function
   - Test connection cleanup
   - Test authentication

2. **TranscriptionService Integration**
   - Test broadcast is called after transcription
   - Test error handling if WebSocket fails
   - Test with no connections (should not error)

3. **Frontend Hook**
   - Test WebSocket connection
   - Test message handling
   - Test reconnection logic
   - Test polling fallback

### Integration Tests

1. **End-to-End Flow**
   - Start meeting
   - Connect WebSocket
   - Transcribe chunk
   - Verify frontend receives message
   - Verify display updates

2. **Error Scenarios**
   - WebSocket server down → fallback to polling
   - Network interruption → reconnection
   - Invalid token → connection rejected
   - Meeting ends → connections closed

### Performance Tests

1. **Latency Measurement**
   - Measure time from transcription complete to frontend display
   - Compare WebSocket vs polling
   - Target: <100ms end-to-end

2. **Load Testing**
   - Multiple concurrent connections
   - Multiple meetings
   - High transcription rate

---

## Rollout Strategy

### Phase 1: Development & Testing
- Implement all changes in development
- Test thoroughly
- Fix any issues

### Phase 2: Staged Rollout
- Deploy to staging environment
- Test with real meetings
- Monitor for issues

### Phase 3: Gradual Production Rollout
- Deploy backend changes (WebSocket server)
- Keep polling as fallback
- Deploy frontend changes
- Monitor connection success rate
- Gradually reduce polling interval if needed

### Phase 4: Full Migration
- Once stable, remove polling fallback (optional)
- Monitor performance
- Document changes

---

## Rollback Plan

If issues arise:

1. **Backend:** WebSocket server failures don't break existing functionality (polling still works)
2. **Frontend:** Fallback to polling is automatic
3. **Quick Fix:** Set `usePolling` default to `true` in hook

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Connection Metrics**
   - Active WebSocket connections
   - Connection success rate
   - Reconnection attempts
   - Fallback to polling rate

2. **Latency Metrics**
   - Time from transcription to broadcast
   - Time from broadcast to frontend display
   - End-to-end latency

3. **Error Metrics**
   - WebSocket connection errors
   - Broadcast failures
   - Message parsing errors

### Logging

- Log all WebSocket connections/disconnections
- Log broadcast attempts (success/failure)
- Log fallback to polling events
- Log authentication failures

---

## Future Enhancements

1. **Server-Sent Events (SSE) Alternative**
   - Simpler than WebSocket
   - One-way communication (sufficient for transcripts)
   - Easier to implement authentication

2. **Message Batching**
   - Batch multiple chunks if transcription is fast
   - Reduce WebSocket message overhead

3. **Compression**
   - Compress WebSocket messages for large transcripts
   - Reduce bandwidth usage

4. **Presence Awareness**
   - Notify when users join/leave transcript view
   - Useful for collaboration features

---

## Dependencies

### Backend
- `ws` package (WebSocket library)
- Existing authentication system
- Existing database access

### Frontend
- No new dependencies (WebSocket is native browser API)
- Existing React hooks pattern

---

## Estimated Timeline

- **Phase 1 (Backend):** 2-3 hours
- **Phase 2 (Integration):** 1-2 hours
- **Phase 3 (Frontend):** 2-3 hours
- **Phase 4 (Auth):** 1-2 hours
- **Phase 5 (Cleanup):** 1 hour
- **Testing:** 2-3 hours
- **Total:** ~10-15 hours

---

## Success Criteria

✅ WebSocket connections establish successfully  
✅ Transcripts are delivered in <100ms  
✅ Fallback to polling works automatically  
✅ No increase in error rate  
✅ Server load decreases (fewer polling requests)  
✅ User experience improves (real-time feel)

---

## Notes

- Keep polling as fallback for reliability
- WebSocket is more efficient but adds complexity
- Monitor connection health in production
- Consider rate limiting for WebSocket connections
- Document WebSocket endpoint for future integrations
