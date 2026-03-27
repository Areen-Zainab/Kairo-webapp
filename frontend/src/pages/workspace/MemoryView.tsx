import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import GraphCanvas from '../../components/workspace/memory/GraphCanvas';
import ContextPanel from '../../components/workspace/memory/ContextPanel';
import MemoryFilterBar from '../../components/workspace/memory/MemoryFilterBar';
import MemoryFAB from '../../components/workspace/memory/MemoryFAB';
import MemoryQueryBar from '../../components/workspace/memory/MemoryQueryBar';
import ExportDropdown from '../../components/workspace/memory/ExportDropdown';
import { useGraphData } from '../../hooks/useGraphData';
import { useQueryMemory } from '../../hooks/useQueryMemory';
import { useUser } from '../../context/UserContext';
import type { MemoryNode, MemoryFilter, GraphViewport, FocusMode, WorkspaceMemory } from '../../components/workspace/memory/types';
import apiService from '../../services/api';

const MemoryView: React.FC = () => {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { isAuthenticated, loading } = useUser();
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);
  const [filters, setFilters] = useState<MemoryFilter>({});
  const [viewport, setViewport] = useState<GraphViewport>({
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.1,
    maxZoom: 3
  });
  const [focusMode, setFocusMode] = useState<FocusMode>({
    enabled: false,
    relatedNodes: [],
    dimmedNodes: []
  });
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [isQueryPanelOpen, setIsQueryPanelOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [highlightQuery, setHighlightQuery] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [workspaceMemory, setWorkspaceMemory] = useState<WorkspaceMemory>({
    id: '',
    name: '',
    lastUpdate: '',
    totalNodes: 0,
    totalEdges: 0,
    topics: 0,
    meetings: 0,
    decisions: 0,
    actions: 0,
    members: 0
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  const { graphData, loading: graphLoading, error } = useGraphData(workspaceId || '', filters);
  const { queryMemory, isQuerying } = useQueryMemory(workspaceId || '');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!workspaceId) return;
      const wid = parseInt(workspaceId, 10);
      if (Number.isNaN(wid)) return;

      const resp = await apiService.getMemoryGraphStats(wid, {
        limitMeetings: 10,
        limitNodes: 220,
        limitActions: 30
      });

      if (cancelled) return;
      if (resp.error) return;

      const stats = resp.data?.stats;
      if (!stats) return;

      setWorkspaceMemory({
        id: stats.id,
        name: stats.name,
        lastUpdate: stats.lastUpdate,
        totalNodes: stats.totalNodes,
        totalEdges: stats.totalEdges,
        topics: stats.topics,
        meetings: stats.meetings,
        decisions: stats.decisions,
        actions: stats.actions,
        members: stats.members
      });
    };

    run().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleNodeClick = (node: MemoryNode) => {
    setSelectedNode(node);
    setIsContextPanelOpen(true);
  };

  const handleNodeHover = (_node: MemoryNode | null) => {
    // Handle hover effects
  };

  const handleFilterChange = (newFilters: MemoryFilter) => {
    setFilters(newFilters);
  };

  const handleViewportChange = (newViewport: GraphViewport) => {
    setViewport(newViewport);
  };

  const handleFocusMode = (nodeId: string) => {
    if (focusMode.enabled && focusMode.centerNode === nodeId) {
      setFocusMode({
        enabled: false,
        relatedNodes: [],
        dimmedNodes: []
      });
    } else {
      const relatedNodes = graphData.edges
        .filter((edge: any) => edge.source === nodeId || edge.target === nodeId)
        .map((edge: any) => edge.source === nodeId ? edge.target : edge.source);
      
      const dimmedNodes = graphData.nodes
        .filter((node: any) => node.id !== nodeId && !relatedNodes.includes(node.id))
        .map((node: any) => node.id);

      setFocusMode({
        enabled: true,
        centerNode: nodeId,
        relatedNodes,
        dimmedNodes
      });
    }
  };

  const handleAIQuery = async (query: string) => {
    const results = await queryMemory(query);
    if (results && results.results.nodes.length > 0) {
      const matchingIds = results.results.nodes;
      // Highlight the matching nodes and dim everything else in the graph.
      const dimmedNodes = graphData.nodes
        .filter((node) => !matchingIds.includes(node.id))
        .map((node) => node.id);

      setFocusMode({
        enabled: true,
        centerNode: matchingIds[0],
        relatedNodes: matchingIds,
        dimmedNodes
      });
    }
  };

  const handleHighlightNodes = (query: string) => {
    setHighlightQuery(query);
  };

  const handleResetGraph = () => {
    setViewport({
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: 0.1,
      maxZoom: 3
    });
    setFocusMode({
      enabled: false,
      relatedNodes: [],
      dimmedNodes: []
    });
  };

  const formatLastUpdate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading workspace memory...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Error Loading Memory</h2>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (graphLoading && graphData.nodes.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading workspace graph...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout {...(isQueryPanelOpen && { forceSidebarCollapsed: true })}>
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900">
        {/* Top Bar */}
        <div className="flex-shrink-0 backdrop-blur-sm border-b px-6 py-4 bg-white/80 border-slate-200/50 dark:bg-slate-800/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Memory Graph
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {workspaceMemory.name
                    ? `${workspaceMemory.name} • Last updated ${workspaceMemory.lastUpdate ? formatLastUpdate(workspaceMemory.lastUpdate) : '—'}`
                    : 'Loading workspace memory...'}
                </p>
              </div>
            </div>

            {/* Memory Stats - Right Side */}
            <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>{workspaceMemory.meetings} meetings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>{workspaceMemory.topics} topics</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>{workspaceMemory.decisions} decisions</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span>{workspaceMemory.actions} actions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex-shrink-0 px-6 py-3 backdrop-blur-sm border-b bg-white/60 border-slate-200/50 dark:bg-slate-800/30 dark:border-slate-700/30 relative z-10">
          <MemoryFilterBar
            filters={filters}
            onFiltersChange={handleFilterChange}
            workspaceMemory={workspaceMemory}
          />
        </div>

        {/* Main Content */}
        <div className={`flex-1 relative overflow-hidden flex items-center justify-center transition-all duration-300 ${
          isQueryPanelOpen ? 'mr-96' : ''
        }`}>
          {/* Graph Canvas */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full max-w-6xl max-h-[80vh]">
              <GraphCanvas
                ref={canvasRef}
                data={graphData}
                viewport={viewport}
                focusMode={focusMode}
                highlightQuery={highlightQuery}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                onViewportChange={handleViewportChange}
                onFocusMode={handleFocusMode}
              />
              
              {/* Zoom Controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg border border-slate-200/50 dark:border-slate-700/50 p-2">
                <button
                  onClick={() => setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.2, prev.maxZoom) }))}
                  className="w-8 h-8 flex items-center justify-center rounded bg-slate-200/50 hover:bg-slate-300/50 text-slate-700 dark:bg-slate-700/50 dark:hover:bg-slate-600/50 dark:text-slate-300 transition-colors"
                >
                  +
                </button>
                <button
                  onClick={() => setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.2, prev.minZoom) }))}
                  className="w-8 h-8 flex items-center justify-center rounded bg-slate-200/50 hover:bg-slate-300/50 text-slate-700 dark:bg-slate-700/50 dark:hover:bg-slate-600/50 dark:text-slate-300 transition-colors"
                >
                  −
                </button>
              </div>
            </div>
          </div>


          {/* Floating Action Button */}
          <MemoryFAB
            onReset={handleResetGraph}
            onExport={() => setIsExportDropdownOpen(true)}
            onFocusMode={() => setFocusMode(prev => ({ ...prev, enabled: !prev.enabled }))}
            onChatbot={() => {
              setIsQueryPanelOpen(!isQueryPanelOpen);
            }}
            focusModeEnabled={focusMode.enabled}
            isChatbotOpen={isQueryPanelOpen}
          />
        </div>

        {/* Context Panel */}
        <ContextPanel
          isOpen={isContextPanelOpen}
          onClose={() => setIsContextPanelOpen(false)}
          node={selectedNode}
          graphData={graphData}
        />

        {/* Memory Query Bar */}
        <MemoryQueryBar
          isOpen={isQueryPanelOpen}
          onClose={() => setIsQueryPanelOpen(false)}
          onQuery={handleAIQuery}
          onHighlightNodes={handleHighlightNodes}
          isQuerying={isQuerying}
        />

        {/* Export Dropdown */}
        <ExportDropdown
          isOpen={isExportDropdownOpen}
          onClose={() => setIsExportDropdownOpen(false)}
          graphData={graphData}
          canvasRef={canvasRef}
        />
      </div>
    </Layout>
  );
};

export default MemoryView;
