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
  const [isConnected, setIsConnected] = useState(false);
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
    // Use backend port (5000) for development, or same host/port as frontend for production
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // In development, backend is typically on port 5000, frontend on 3000/5173
    // In production, they're usually on the same host/port (via proxy)
    const isDevelopment = host === 'localhost' || host === '127.0.0.1';
    const port = isDevelopment ? '5000' : (window.location.port || (protocol === 'wss:' ? '443' : '80'));
    const wsUrl = `${protocol}//${host}:${port}/ws/transcript?meetingId=${meetingId}`;

    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ WebSocket connected for live transcript');
      setError(null);
      setIsConnected(true);
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
      setIsConnected(false);

      // Don't reconnect if it was an intentional close (code 1000)
      if (event.code === 1000) {
        return;
      }

      // Attempt reconnection if not intentional close
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000); // Exponential backoff, max 10s

        console.log(`🔄 Attempting to reconnect WebSocket (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms...`);

        reconnectTimeoutRef.current = window.setTimeout(() => {
          // Reset usePolling to trigger reconnection attempt
          // This will cause the effect to re-run and try WebSocket again
          setUsePolling(false);
        }, delay);
      } else {
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
    };
  }, [meetingId, usePolling, fetchTranscript, formatTimestamp]);

  return {
    entries,
    loading,
    error,
    refresh: fetchTranscript,
    isConnected: isConnected || usePolling
  };
};
