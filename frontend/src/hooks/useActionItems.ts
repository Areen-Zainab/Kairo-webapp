import { useEffect, useRef, useState, useCallback } from 'react';
import { apiService } from '../services/api';

export type ActionItemStatus = 'pending' | 'confirmed' | 'rejected';

export interface ActionItem {
  id: number;
  meetingId: number;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  status: ActionItemStatus;
  confidence?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  confirmedBy?: { id: number; name: string; email: string } | null;
  rejectedBy?: { id: number; name: string; email: string } | null;
}

export const useActionItems = (meetingId: number | string | null, pollInterval = 12000, enableWebSocket = true) => {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [usePolling, setUsePolling] = useState(false); // Fallback flag
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const fetchActionItems = useCallback(async () => {
    console.log('🔍 [useActionItems] fetchActionItems called:', {
      meetingId,
      type: typeof meetingId,
      willExit: meetingId === null || meetingId === undefined
    });
    
    if (meetingId === null || meetingId === undefined) {
      console.log('🚫 [useActionItems] Exiting early - meetingId is null/undefined');
      return;
    }
    
    console.log('📡 [useActionItems] Making API call to getLiveActionItems...');
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getLiveActionItems(
        meetingId as any,
        lastUpdateRef.current || undefined
      );
      console.log('✅ [useActionItems] API response received:', response);

      if (response.data?.actionItems) {
        const data = response.data;
        setActionItems((prev) => {
          const map = new Map(prev.map((item) => [item.id, item]));
          data.actionItems.forEach((item: ActionItem) => {
            map.set(item.id, item);
          });
          return Array.from(map.values()).sort((a, b) => {
            const aTime = new Date(a.lastSeenAt || a.confirmedAt || a.rejectedAt || 0).getTime();
            const bTime = new Date(b.lastSeenAt || b.confirmedAt || b.rejectedAt || 0).getTime();
            return bTime - aTime;
          });
        });

        if (data.latestUpdate) {
          lastUpdateRef.current = data.latestUpdate;
        }
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch action items');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  // Initial fetch only
  useEffect(() => {
    fetchActionItems();
  }, [fetchActionItems]);

  // WebSocket connection for real-time action items
  useEffect(() => {
    if (!meetingId || !enableWebSocket) return;

    // Use polling fallback if WebSocket failed too many times
    if (usePolling) {
      fetchActionItems();
      intervalRef.current = setInterval(fetchActionItems, pollInterval);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }

    // Try WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || (protocol === 'wss:' ? '443' : '5000');
    const wsUrl = `${protocol}//${host}:${port}/ws/transcript?meetingId=${meetingId}`;

    console.log(`🔌 Connecting to WebSocket for action items: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ WebSocket connected for action items');
      setError(null);
      reconnectAttemptsRef.current = 0;
      // Fetch existing action items on initial connection
      fetchActionItems();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'action_items') {
          const data = message.data;

          if (data.actionItems && Array.isArray(data.actionItems)) {
            setActionItems((prev) => {
              const map = new Map(prev.map((item) => [item.id, item]));
              data.actionItems.forEach((item: ActionItem) => {
                map.set(item.id, item);
              });
              return Array.from(map.values()).sort((a, b) => {
                const aTime = new Date(a.lastSeenAt || a.confirmedAt || a.rejectedAt || 0).getTime();
                const bTime = new Date(b.lastSeenAt || b.confirmedAt || b.rejectedAt || 0).getTime();
                return bTime - aTime;
              });
            });
          }
        } else if (message.type === 'connected') {
          console.log(`✅ WebSocket connection confirmed for meeting ${message.meetingId}`);
          // Fetch existing action items on initial connection
          fetchActionItems();
        }
      } catch (parseError) {
        console.error('❌ Error parsing WebSocket message:', parseError);
      }
    };

    ws.onerror = (error) => {
      console.warn('⚠️ WebSocket error for action items:', error);
      setError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      console.log(`🔌 WebSocket closed for action items: ${event.code} ${event.reason}`);

      // Attempt to reconnect if not a normal closure
      if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`🔄 Reconnecting WebSocket for action items in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            // Trigger reconnection by re-running effect
            setUsePolling(false);
          }
        }, delay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.warn('⚠️ Max WebSocket reconnection attempts reached, falling back to polling');
        setUsePolling(true);
      }
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [meetingId, pollInterval, fetchActionItems, usePolling, enableWebSocket]);

  const confirmActionItem = async (id: number) => {
    const response = await apiService.confirmActionItem(id);
    if (response.data?.actionItem) {
      const actionItem = response.data.actionItem;
      setActionItems((prev) => prev.map((item) => (item.id === id ? actionItem : item)));
      return actionItem;
    } else if (response.error) {
      throw new Error(response.error);
    }
    return undefined;
  };

  const rejectActionItem = async (id: number) => {
    const response = await apiService.rejectActionItem(id);
    if (response.data?.actionItem) {
      const actionItem = response.data.actionItem;
      setActionItems((prev) => prev.map((item) => (item.id === id ? actionItem : item)));
      return actionItem;
    } else if (response.error) {
      throw new Error(response.error);
    }
    return undefined;
  };

  return {
    actionItems,
    loading,
    error,
    confirmActionItem,
    rejectActionItem,
    refresh: fetchActionItems
  };
};

