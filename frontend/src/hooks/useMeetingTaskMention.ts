import { useEffect, useState, useRef } from 'react';

export interface TaskMentionEvent {
  snippet: string;
  at: string;
}

/**
 * Subscribes to the same meeting WebSocket used for live transcript; surfaces
 * `task_mention` events when the open task's title appears in transcript text.
 */
export function useMeetingTaskMention(
  meetingId: string | null | undefined,
  taskId: string | null | undefined,
  enabled: boolean
): TaskMentionEvent | null {
  const [mention, setMention] = useState<TaskMentionEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !meetingId || !taskId) {
      setMention(null);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || (protocol === 'wss:' ? '443' : '5000');
    const wsUrl = `${protocol}//${host}:${port}/ws/transcript?meetingId=${meetingId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'task_mention' || !msg.data) return;
        if (String(msg.data.taskId) !== String(taskId)) return;
        setMention({
          snippet: typeof msg.data.snippet === 'string' ? msg.data.snippet : '',
          at: typeof msg.data.timestamp === 'string' ? msg.data.timestamp : new Date().toISOString()
        });
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [meetingId, taskId, enabled]);

  return mention;
}
