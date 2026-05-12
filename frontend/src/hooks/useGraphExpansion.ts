import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import type { GraphData, MemoryFilter, MemoryEdge, MemoryNode } from '../components/workspace/memory/types';
import { applyMemoryGraphFilters } from './useGraphData';

function mergeGraphData(base: GraphData, extra: GraphData): GraphData {
  const nodeById = new Map<string, MemoryNode>();
  for (const n of base.nodes) nodeById.set(n.id, n);
  for (const n of extra.nodes) {
    if (!nodeById.has(n.id)) nodeById.set(n.id, n);
  }
  const edgeById = new Map<string, MemoryEdge>();
  for (const e of base.edges) edgeById.set(e.id, e);
  for (const e of extra.edges) {
    if (!edgeById.has(e.id)) edgeById.set(e.id, e);
  }
  return {
    nodes: [...nodeById.values()],
    edges: [...edgeById.values()],
  };
}

const DEFAULT_DEPTH = 1;

/**
 * Accumulates neighbour subgraph fetches from GET .../graph/node/:id/neighbours,
 * merges them with the workspace graph, then applies the same filters as useGraphData.
 */
export function useGraphExpansion(
  workspaceId: string,
  filters: MemoryFilter,
  baseGraphData: GraphData
) {
  const [accumulated, setAccumulated] = useState<GraphData>({ nodes: [], edges: [] });
  const [expansionInFlightCount, setExpansionInFlightCount] = useState(0);
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expandedOkRef = useRef<Set<string>>(new Set());
  const expandingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setAccumulated({ nodes: [], edges: [] });
    expandedOkRef.current = new Set();
    expandingRef.current = new Set();
    setExpansionInFlightCount(0);
    setLoadingNodeId(null);
    setError(null);
  }, [workspaceId]);

  const mergedRaw = useMemo(
    () => mergeGraphData(baseGraphData, accumulated),
    [baseGraphData, accumulated]
  );

  const graphData = useMemo(
    () => applyMemoryGraphFilters(mergedRaw, filters),
    [mergedRaw, filters]
  );

  const expandFromNode = useCallback(
    async (nodeId: string, depth: number = DEFAULT_DEPTH) => {
      if (!workspaceId) return;
      const wid = parseInt(workspaceId, 10);
      if (Number.isNaN(wid)) return;

      if (expandedOkRef.current.has(nodeId)) return;
      if (expandingRef.current.has(nodeId)) return;

      expandingRef.current.add(nodeId);
      setExpansionInFlightCount((c) => c + 1);
      setLoadingNodeId(nodeId);
      setError(null);

      try {
        const resp = await apiService.getNodeNeighbours(wid, nodeId, depth);

        if (resp.error) {
          setError(resp.error);
          return;
        }

        const neighbours = resp.data?.neighbours;
        if (!neighbours) {
          setError('No neighbour data returned');
          return;
        }

        const delta: GraphData = {
          nodes: (neighbours.nodes ?? []) as MemoryNode[],
          edges: (neighbours.edges ?? []) as MemoryEdge[],
        };

        setAccumulated((prev) => mergeGraphData(prev, delta));
        expandedOkRef.current.add(nodeId);
      } finally {
        expandingRef.current.delete(nodeId);
        setExpansionInFlightCount((c) => {
          const next = Math.max(0, c - 1);
          if (next === 0) setLoadingNodeId(null);
          return next;
        });
      }
    },
    [workspaceId]
  );

  const clearExpansions = useCallback(() => {
    setAccumulated({ nodes: [], edges: [] });
    expandedOkRef.current = new Set();
    expandingRef.current = new Set();
    setExpansionInFlightCount(0);
    setError(null);
    setLoadingNodeId(null);
  }, []);

  return {
    graphData,
    expandFromNode,
    clearExpansions,
    expansionLoading: expansionInFlightCount > 0,
    expansionLoadingNodeId: loadingNodeId,
    expansionError: error,
  };
}
