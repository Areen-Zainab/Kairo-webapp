import { useState } from 'react';
import { apiService } from '../services/api';
import type { AIQuery, MemorySearchHit } from '../components/workspace/memory/types';
import { persistWorkspaceMemorySearch } from '../utils/memorySearchSession';

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
      let memorySearchHits: MemorySearchHit[] = [];

      if (!Number.isNaN(workspaceIdInt) && query.trim()) {
        const response = await apiService.searchMeetingMemory(workspaceIdInt, query.trim(), 10);

        if (!response.error && response.data?.results) {
          const raw = response.data.results as any[];
          const withId = raw.filter((r) => (r.meetingId ?? r.meeting_id) != null);
          // Map each matching meeting to its graph node ID.
          // The search endpoint dedupes by meeting and returns sorted by relevance.
          nodeIds = withId.map((r) => `meeting:${r.meetingId ?? r.meeting_id}`);

          memorySearchHits = withId.map((r) => ({
            meetingId: Number(r.meetingId ?? r.meeting_id),
            snippet: typeof r.snippet === 'string' ? r.snippet : '',
            content: typeof r.content === 'string' ? r.content : undefined,
            matchedTerms: Array.isArray(r.matchedTerms) ? r.matchedTerms : [],
            contentType: r.contentType ?? r.content_type
          }));
        }
      }

      const aiQuery: AIQuery = {
        query,
        timestamp: Date.now(),
        results: {
          nodes: nodeIds,
          edges: [],
          confidence: nodeIds.length > 0 ? 0.8 : 0.3
        },
        memorySearchHits
      };

      if (!Number.isNaN(workspaceIdInt) && query.trim()) {
        persistWorkspaceMemorySearch(workspaceIdInt, query.trim(), memorySearchHits);
      }

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
