import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export interface WhisperRecap {
  id: string;
  text: string;
  timestamp: string;
}

export const useWhisperRecaps = (meetingId: number | null, wsConnected: boolean) => {
  const [recaps, setRecaps] = useState<WhisperRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [newRecapEvent, setNewRecapEvent] = useState<WhisperRecap | null>(null);

  useEffect(() => {
    if (!meetingId) {
      setLoading(false);
      return;
    }

    const fetchInitialRecaps = async () => {
      try {
        setLoading(true);
        // We get initial recaps from meeting metadata
        const response = await apiService.getMeetingById(meetingId);
        if (response.data && response.data.meeting) {
          const meetingMeta = response.data.meeting.metadata || {};
          const whisperMeta = meetingMeta.whisperMode || {};
          const initialRecaps: any[] = Array.isArray(whisperMeta.microRecaps) ? whisperMeta.microRecaps : [];
          
          setRecaps(initialRecaps.map((r, i) => ({
             id: r.at || `recap-${i}`,
             text: r.recapText,
             timestamp: new Date(r.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          })));
        }
      } catch (err: any) {
        console.error('Failed to fetch initial whisper recaps', err);
        // Non-fatal, just start empty
      } finally {
        setLoading(false);
      }
    };

    fetchInitialRecaps();
  }, [meetingId]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!meetingId || !wsConnected) return;

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connectWebSocket = () => {
      // Create new connection if we don't pass the shared one.
      // Wait, useLiveTranscript already creates a ws. We should probably listen on the same one,
      // but in this app architecture, it seems WebSocket is instantiated per hook or we just create a new one to the same path.
      // Looking at useLiveTranscript, it connects to `/ws/transcript?meetingId=...`.
      // The backend WebSocketServer receives all messages there and broadcasts to all clients.
      // Let's connect and filter for 'whisper_recap' messages.
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//localhost:5000/ws/transcript?meetingId=${meetingId}`;

      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'whisper_recap') {
            const data = message.data;
            const newRecap: WhisperRecap = {
              id: data.timestamp,
              text: data.text,
              timestamp: new Date(data.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            };
            
            setRecaps(prev => {
              // Avoid duplicates
              if (prev.some(r => r.id === newRecap.id)) return prev;
              
              // Add to beginning since UI expects newest first or chronological?
              // The backend pushes newest first (unshift). Let's put newest first.
              return [newRecap, ...prev];
            });
            
            setNewRecapEvent(newRecap);
            // reset newRecapEvent to allow triggering again for subsequent events
            setTimeout(() => setNewRecapEvent(null), 100);
          }
        } catch (err) {
          console.error('Error parsing whisper WS message:', err);
        }
      };

      ws.onclose = () => {
        // Simple reconnect logic
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        // Prevent reconnect loop on unmount
        ws.onclose = null;
        ws.close();
      }
    };
  }, [meetingId, wsConnected]);

  const triggerCatchMeUp = async (options?: { excludeTranscript?: boolean }) => {
    if (!meetingId) return;
    try {
      setTriggering(true);
      setError(null);
      const res = await apiService.triggerWhisperRecap(meetingId, options);
      if (res.error) {
         setError(res.error);
      } else if (res.data && res.data.recapText) {
         // success
      } else if (res.data && res.data.skipped) {
         setError(res.data.message || 'Recap skipped (not enough new context)');
      }
    } catch (err: any) {
      console.error('Error triggering Whisper recap:', err);
      setError(err.message || 'Failed to trigger recap');
    } finally {
      setTriggering(false);
    }
  };

  return { recaps, loading, error, triggering, triggerCatchMeUp, newRecapEvent };
};
