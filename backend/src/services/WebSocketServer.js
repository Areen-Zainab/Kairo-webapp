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

    console.log(`✅ WebSocket connected for meeting ${meetingId} (${meetingConnections.get(meetingId).size} connection(s))`);

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
 * Broadcast action items to all connected clients for a meeting
 * @param {number} meetingId - Meeting ID
 * @param {Array} actionItems - Array of action item objects
 */
function broadcastActionItems(meetingId, actionItems) {
  const connections = meetingConnections.get(meetingId);
  
  if (!connections || connections.size === 0) {
    // No connections - silent fail (normal if no one is watching)
    return;
  }

  const message = JSON.stringify({
    type: 'action_items',
    data: {
      actionItems: actionItems,
      timestamp: new Date().toISOString()
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
        console.error(`❌ Error sending action items WebSocket message to meeting ${meetingId}:`, error.message);
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
    console.log(`📤 Broadcast ${actionItems.length} action item(s) to ${sentCount} client(s) for meeting ${meetingId}`);
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
 * Broadcast whisper recap to all connected clients for a meeting
 * @param {number} meetingId - Meeting ID
 * @param {object} recapData - Recap data {text, timestamp}
 */
function broadcastWhisperRecap(meetingId, recapData) {
  const connections = meetingConnections.get(meetingId);
  
  if (!connections || connections.size === 0) {
    return;
  }

  const message = JSON.stringify({
    type: 'whisper_recap',
    data: {
      text: recapData.recapText,
      timestamp: recapData.at || new Date().toISOString()
    }
  });

  let sentCount = 0;
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
        sentCount++;
      } catch (error) {
        connections.delete(ws);
      }
    } else {
      connections.delete(ws);
    }
  });

  if (connections.size === 0) {
    meetingConnections.delete(meetingId);
  }

  if (sentCount > 0) {
    console.log(`📤 Broadcast whisper recap to ${sentCount} client(s) for meeting ${meetingId}`);
  }
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
  broadcastActionItems,
  broadcastWhisperRecap,
  getConnectionCount,
  closeMeetingConnections
};
