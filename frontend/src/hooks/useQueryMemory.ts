import { useState } from 'react';
import { apiService } from '../services/api';
import type { AIQuery } from '../components/workspace/memory/types';

/**
 * Hook that performs a real semantic search against the workspace memory API
 * and maps each result to the graph node ID format used by the canvas
 * (e.g. "meeting:123").  Results are used by MemoryView to focus/highlight
 * matching nodes in the graph.
 */
export const useQueryMemory = (workspaceId: string) => {
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryHistory, setQueryHistory] = useState<AIQuery[]>([]);

  const queryMemory = async (query: string): Promise<AIQuery | null> => {
    setIsQuerying(true);

    try {
      const workspaceIdInt = parseInt(workspaceId, 10);
      let nodeIds: string[] = [];

      if (!Number.isNaN(workspaceIdInt) && query.trim()) {
        const response = await apiService.searchMeetingMemory(workspaceIdInt, query.trim(), 10);

        if (!response.error && response.data?.results) {
          // Map each matching meeting to its graph node ID.
          // The search endpoint dedupes by meeting and returns sorted by relevance.
          nodeIds = (response.data.results as any[])
            .filter((r) => r.meetingId != null)
            .map((r) => `meeting:${r.meetingId}`);
        }
      }

      const aiQuery: AIQuery = {
        query,
        timestamp: Date.now(),
        results: {
          nodes: nodeIds,
          edges: [],
          confidence: nodeIds.length > 0 ? 0.8 : 0.3
        }
      };

      setQueryHistory((prev) => [aiQuery, ...prev.slice(0, 9)]);
      return aiQuery;
    } catch (error) {
      console.error('Memory query failed:', error);
      return null;
    } finally {
      setIsQuerying(false);
    }
  };

  const clearHistory = () => {
    setQueryHistory([]);
  };

  return {
    queryMemory,
    isQuerying,
    queryHistory,
    clearHistory
  };
};
