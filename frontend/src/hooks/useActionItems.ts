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

export const useActionItems = (meetingId: number | null, pollInterval = 12000) => {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const fetchActionItems = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getLiveActionItems(
        meetingId,
        lastUpdateRef.current || undefined
      );

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

  useEffect(() => {
    if (!meetingId) return;
    fetchActionItems();
    intervalRef.current = setInterval(fetchActionItems, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [meetingId, pollInterval, fetchActionItems]);

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

