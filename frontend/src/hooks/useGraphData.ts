import { useState, useEffect, useMemo } from 'react';
import type { GraphData, MemoryFilter, MemoryNode, MemoryEdge } from '../components/workspace/memory/types';

// Mock data generator
const generateMockData = (): GraphData => {
  const nodes: MemoryNode[] = [
    // Meetings
    {
      id: 'meeting-1',
      type: 'meeting',
      label: 'Sprint Planning Q1',
      summary: 'Planning session for Q1 roadmap and feature priorities',
      data: {
        date: '2024-01-15',
        duration: '2h 30m',
        participants: ['Areeba Riaz', 'Fatima Khan', 'Ahmed Ali'],
        transcriptSnippet: 'We need to prioritize the authentication system for the MVP release.'
      },
      position: { x: 200, y: 150 },
      size: 20,
      color: '#3B82F6',
      opacity: 1
    },
    {
      id: 'meeting-2',
      type: 'meeting',
      label: 'API Design Review',
      summary: 'Technical review of API architecture and endpoints',
      data: {
        date: '2024-01-12',
        duration: '1h 45m',
        participants: ['Areeba Riaz', 'Zara Sheikh'],
        transcriptSnippet: 'The REST API should follow OpenAPI 3.0 standards.'
      },
      position: { x: 400, y: 200 },
      size: 18,
      color: '#3B82F6',
      opacity: 1
    },
    {
      id: 'meeting-3',
      type: 'meeting',
      label: 'User Research Insights',
      summary: 'Presentation of user research findings and recommendations',
      data: {
        date: '2024-01-10',
        duration: '1h 15m',
        participants: ['Fatima Khan', 'Ahmed Ali', 'Zara Sheikh'],
        transcriptSnippet: 'Users prefer a clean, minimal interface with quick access to key features.'
      },
      position: { x: 100, y: 300 },
      size: 16,
      color: '#3B82F6',
      opacity: 1
    },

    // Topics
    {
      id: 'topic-1',
      type: 'topic',
      label: 'Authentication System',
      summary: 'User authentication and authorization implementation',
      data: {
        keywords: ['auth', 'security', 'jwt', 'oauth'],
        importance: 0.9,
        lastDiscussed: '2024-01-15'
      },
      position: { x: 300, y: 100 },
      size: 25,
      color: '#8B5CF6',
      opacity: 1
    },
    {
      id: 'topic-2',
      type: 'topic',
      label: 'API Architecture',
      summary: 'RESTful API design and implementation patterns',
      data: {
        keywords: ['api', 'rest', 'openapi', 'endpoints'],
        importance: 0.8,
        lastDiscussed: '2024-01-12'
      },
      position: { x: 500, y: 150 },
      size: 22,
      color: '#8B5CF6',
      opacity: 1
    },
    {
      id: 'topic-3',
      type: 'topic',
      label: 'User Experience',
      summary: 'UI/UX design principles and user interface patterns',
      data: {
        keywords: ['ux', 'ui', 'design', 'usability'],
        importance: 0.7,
        lastDiscussed: '2024-01-10'
      },
      position: { x: 150, y: 400 },
      size: 20,
      color: '#8B5CF6',
      opacity: 1
    },

    // Decisions
    {
      id: 'decision-1',
      type: 'decision',
      label: 'Use JWT for Auth',
      summary: 'Decided to implement JWT-based authentication system',
      data: {
        status: 'active',
        impact: 'high'
      },
      position: { x: 250, y: 50 },
      size: 18,
      color: '#10B981',
      opacity: 1
    },
    {
      id: 'decision-2',
      type: 'decision',
      label: 'REST API Standard',
      summary: 'Adopt OpenAPI 3.0 for API documentation',
      data: {
        status: 'active',
        impact: 'medium'
      },
      position: { x: 450, y: 100 },
      size: 16,
      color: '#10B981',
      opacity: 1
    },

    // Actions
    {
      id: 'action-1',
      type: 'action',
      label: 'Implement JWT Auth',
      summary: 'Build JWT-based authentication system with refresh tokens',
      data: {
        assignee: 'Areeba Riaz',
        dueDate: '2024-02-01',
        priority: 'high',
        status: 'in-progress'
      },
      position: { x: 350, y: 250 },
      size: 15,
      color: '#F59E0B',
      opacity: 1
    },
    {
      id: 'action-2',
      type: 'action',
      label: 'API Documentation',
      summary: 'Create comprehensive API documentation using OpenAPI',
      data: {
        assignee: 'Zara Sheikh',
        dueDate: '2024-01-25',
        priority: 'medium',
        status: 'todo'
      },
      position: { x: 550, y: 300 },
      size: 14,
      color: '#F59E0B',
      opacity: 1
    },

    // Members
    {
      id: 'member-1',
      type: 'member',
      label: 'Areeba Riaz',
      summary: 'Lead Developer and Technical Architect',
      data: {
        role: 'Lead Developer',
        department: 'Engineering',
        avatar: 'AR'
      },
      position: { x: 50, y: 50 },
      size: 20,
      color: '#F97316',
      opacity: 1
    },
    {
      id: 'member-2',
      type: 'member',
      label: 'Fatima Khan',
      summary: 'Product Manager and UX Designer',
      data: {
        role: 'Product Manager',
        department: 'Product',
        avatar: 'FK'
      },
      position: { x: 50, y: 200 },
      size: 18,
      color: '#F97316',
      opacity: 1
    },
    {
      id: 'member-3',
      type: 'member',
      label: 'Ahmed Ali',
      summary: 'Frontend Developer',
      data: {
        role: 'Frontend Developer',
        department: 'Engineering',
        avatar: 'AA'
      },
      position: { x: 50, y: 350 },
      size: 16,
      color: '#F97316',
      opacity: 1
    },
    {
      id: 'member-4',
      type: 'member',
      label: 'Zara Sheikh',
      summary: 'Backend Developer and API Specialist',
      data: {
        role: 'Backend Developer',
        department: 'Engineering',
        avatar: 'ZS'
      },
      position: { x: 50, y: 500 },
      size: 17,
      color: '#F97316',
      opacity: 1
    }
  ];

  const edges: MemoryEdge[] = [
    // Meeting-Topic connections
    { id: 'e1', source: 'meeting-1', target: 'topic-1', type: 'meeting-topic', weight: 0.9, color: '#64748B', opacity: 0.6, curved: true },
    { id: 'e2', source: 'meeting-2', target: 'topic-2', type: 'meeting-topic', weight: 0.8, color: '#64748B', opacity: 0.6, curved: true },
    { id: 'e3', source: 'meeting-3', target: 'topic-3', type: 'meeting-topic', weight: 0.7, color: '#64748B', opacity: 0.6, curved: true },

    // Meeting-Member connections
    { id: 'e4', source: 'meeting-1', target: 'member-1', type: 'meeting-member', weight: 0.8, color: '#64748B', opacity: 0.5, curved: true },
    { id: 'e5', source: 'meeting-1', target: 'member-2', type: 'meeting-member', weight: 0.8, color: '#64748B', opacity: 0.5, curved: true },
    { id: 'e6', source: 'meeting-1', target: 'member-3', type: 'meeting-member', weight: 0.8, color: '#64748B', opacity: 0.5, curved: true },
    { id: 'e7', source: 'meeting-2', target: 'member-1', type: 'meeting-member', weight: 0.7, color: '#64748B', opacity: 0.5, curved: true },
    { id: 'e8', source: 'meeting-2', target: 'member-4', type: 'meeting-member', weight: 0.7, color: '#64748B', opacity: 0.5, curved: true },

    // Topic-Decision connections
    { id: 'e9', source: 'topic-1', target: 'decision-1', type: 'topic-decision', weight: 0.9, color: '#64748B', opacity: 0.7, curved: true },
    { id: 'e10', source: 'topic-2', target: 'decision-2', type: 'topic-decision', weight: 0.8, color: '#64748B', opacity: 0.7, curved: true },

    // Action-Member connections
    { id: 'e11', source: 'action-1', target: 'member-1', type: 'action-member', weight: 0.9, color: '#64748B', opacity: 0.6, curved: true },
    { id: 'e12', source: 'action-2', target: 'member-4', type: 'action-member', weight: 0.8, color: '#64748B', opacity: 0.6, curved: true },

    // Cross-topic connections
    { id: 'e13', source: 'topic-1', target: 'topic-2', type: 'meeting-topic', weight: 0.6, color: '#64748B', opacity: 0.4, curved: true },
    { id: 'e14', source: 'topic-2', target: 'topic-3', type: 'meeting-topic', weight: 0.5, color: '#64748B', opacity: 0.4, curved: true },
  ];

  return { nodes, edges };
};

export const useGraphData = (filters: MemoryFilter) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const graphData = useMemo(() => {
    setLoading(true);
    
    try {
      const mockData = generateMockData();
      
      // Apply filters
      let filteredNodes = mockData.nodes;
      let filteredEdges = mockData.edges;

      // Filter by node types
      if (filters.nodeTypes && filters.nodeTypes.length > 0) {
        filteredNodes = filteredNodes.filter(node => 
          filters.nodeTypes!.includes(node.type)
        );
        filteredEdges = filteredEdges.filter(edge => {
          const sourceNode = filteredNodes.find(n => n.id === edge.source);
          const targetNode = filteredNodes.find(n => n.id === edge.target);
          return sourceNode && targetNode;
        });
      }

      // Filter by search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredNodes = filteredNodes.filter(node =>
          node.label.toLowerCase().includes(searchLower) ||
          node.summary.toLowerCase().includes(searchLower) ||
          (node.data.keywords && node.data.keywords.some(keyword => 
            keyword.toLowerCase().includes(searchLower)
          ))
        );
      }

      // Filter by date range
      if (filters.dateRange?.start || filters.dateRange?.end) {
        filteredNodes = filteredNodes.filter(node => {
          if (!node.data.date) return true;
          const nodeDate = new Date(node.data.date);
          const startDate = filters.dateRange?.start ? new Date(filters.dateRange.start) : null;
          const endDate = filters.dateRange?.end ? new Date(filters.dateRange.end) : null;
          
          if (startDate && nodeDate < startDate) return false;
          if (endDate && nodeDate > endDate) return false;
          return true;
        });
      }

      // Filter by keywords
      if (filters.keywords && filters.keywords.length > 0) {
        filteredNodes = filteredNodes.filter(node =>
          node.data.keywords && 
          filters.keywords!.some(keyword =>
            node.data.keywords!.some(nodeKeyword =>
              nodeKeyword.toLowerCase().includes(keyword.toLowerCase())
            )
          )
        );
      }

      setLoading(false);
      return { nodes: filteredNodes, edges: filteredEdges };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
      setLoading(false);
      return { nodes: [], edges: [] };
    }
  }, [filters]);

  return { graphData, loading, error };
};
