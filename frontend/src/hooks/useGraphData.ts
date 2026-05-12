import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { GraphData, MemoryFilter } from '../components/workspace/memory/types';

/** Applies MemoryFilter rules — reused when merging expanded neighbour subgraphs. */
export const applyMemoryGraphFilters = (
  graphData: GraphData,
  filters: MemoryFilter
): GraphData => {
  let filteredNodes = graphData.nodes;
  let filteredEdges = graphData.edges;

  if (filters.nodeTypes && filters.nodeTypes.length > 0) {
    filteredNodes = filteredNodes.filter((node) => filters.nodeTypes!.includes(node.type));
    filteredEdges = filteredEdges.filter((edge) => {
      const sourceNode = filteredNodes.find((n) => n.id === edge.source);
      const targetNode = filteredNodes.find((n) => n.id === edge.target);
      return sourceNode && targetNode;
    });
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredNodes = filteredNodes.filter(
      (node) =>
        node.label.toLowerCase().includes(searchLower) ||
        (node.summary ?? '').toLowerCase().includes(searchLower) ||
        (node.data.keywords &&
          node.data.keywords.some((keyword) => keyword.toLowerCase().includes(searchLower)))
    );
    filteredEdges = filteredEdges.filter((edge) => {
      const sourceNode = filteredNodes.find((n) => n.id === edge.source);
      const targetNode = filteredNodes.find((n) => n.id === edge.target);
      return sourceNode && targetNode;
    });
  }

  if (filters.dateRange?.start || filters.dateRange?.end) {
    filteredNodes = filteredNodes.filter((node) => {
      if (!node.data.date) return true;
      const nodeDate = new Date(node.data.date);
      const startDate = filters.dateRange?.start ? new Date(filters.dateRange.start) : null;
      const endDate = filters.dateRange?.end ? new Date(filters.dateRange.end) : null;

      if (startDate && nodeDate < startDate) return false;
      if (endDate && nodeDate > endDate) return false;
      return true;
    });
    filteredEdges = filteredEdges.filter((edge) => {
      const sourceNode = filteredNodes.find((n) => n.id === edge.source);
      const targetNode = filteredNodes.find((n) => n.id === edge.target);
      return sourceNode && targetNode;
    });
  }

  if (filters.keywords && filters.keywords.length > 0) {
    filteredNodes = filteredNodes.filter(
      (node) =>
        node.data.keywords &&
        filters.keywords!.some((keyword) =>
          node.data.keywords!.some((nodeKeyword) => nodeKeyword.toLowerCase().includes(keyword.toLowerCase()))
        )
    );
    filteredEdges = filteredEdges.filter((edge) => {
      const sourceNode = filteredNodes.find((n) => n.id === edge.source);
      const targetNode = filteredNodes.find((n) => n.id === edge.target);
      return sourceNode && targetNode;
    });
  }

  return { nodes: filteredNodes, edges: filteredEdges };
};

export const useGraphData = (workspaceId: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteGraphData, setRemoteGraphData] = useState<GraphData>({ nodes: [], edges: [] });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!workspaceId) return;
      setLoading(true);
      setError(null);

      const workspaceIdInt = parseInt(workspaceId, 10);
      if (Number.isNaN(workspaceIdInt)) {
        setError('Invalid workspaceId');
        setLoading(false);
        return;
      }

      const response = await apiService.getMemoryGraph(workspaceIdInt, {
        limitMeetings: 10,
        limitNodes: 220,
        limitActions: 30
      });

      if (!cancelled) {
        if (response.error) {
          setError(response.error);
          setRemoteGraphData({ nodes: [], edges: [] });
        } else {
          setRemoteGraphData(response.data?.graphData || { nodes: [], edges: [] });
        }
        setLoading(false);
      }
    };

    run().catch((err) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return { rawGraphData: remoteGraphData, loading, error };
};
