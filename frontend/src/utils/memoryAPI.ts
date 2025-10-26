import type { MemoryNode, MemoryEdge, MemoryFilter, AIQuery } from '../components/workspace/memory/types';

// Mock API functions for memory operations
export const memoryAPI = {
  // Fetch graph data with filters
  async getGraphData(filters: MemoryFilter): Promise<{ nodes: MemoryNode[]; edges: MemoryEdge[] }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In a real implementation, this would make an API call
    // For now, return mock data
    return {
      nodes: [],
      edges: []
    };
  },

  // Perform semantic search
  async searchMemory(query: string): Promise<AIQuery> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real implementation, this would call the backend LLM + FAISS/pgvector
    return {
      query,
      timestamp: Date.now(),
      results: {
        nodes: [],
        edges: [],
        confidence: 0.8
      }
    };
  },

  // Get node details
  async getNodeDetails(nodeId: string): Promise<MemoryNode | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // In a real implementation, this would fetch from database
    return null;
  },

  // Update node
  async updateNode(nodeId: string, updates: Partial<MemoryNode>): Promise<MemoryNode | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // In a real implementation, this would update the database
    return null;
  },

  // Create new node
  async createNode(node: Omit<MemoryNode, 'id'>): Promise<MemoryNode | null> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // In a real implementation, this would create in database
    return null;
  },

  // Delete node
  async deleteNode(nodeId: string): Promise<boolean> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // In a real implementation, this would delete from database
    return true;
  },

  // Get related nodes
  async getRelatedNodes(nodeId: string, maxDepth: number = 2): Promise<MemoryNode[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // In a real implementation, this would traverse the graph
    return [];
  },

  // Export graph data
  async exportGraph(format: 'png' | 'svg' | 'json' | 'txt'): Promise<Blob> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real implementation, this would generate the export
    return new Blob(['Mock export data'], { type: 'text/plain' });
  },

  // Get workspace memory stats
  async getWorkspaceStats(workspaceId: string): Promise<{
    totalNodes: number;
    totalEdges: number;
    topics: number;
    meetings: number;
    decisions: number;
    actions: number;
    members: number;
    lastUpdate: string;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      totalNodes: 47,
      totalEdges: 89,
      topics: 12,
      meetings: 18,
      decisions: 8,
      actions: 15,
      members: 12,
      lastUpdate: new Date().toISOString()
    };
  },

  // Get memory insights
  async getMemoryInsights(workspaceId: string): Promise<{
    topTopics: Array<{ topic: string; mentions: number }>;
    activeMembers: Array<{ member: string; activity: number }>;
    recentDecisions: Array<{ decision: string; date: string }>;
    overdueActions: Array<{ action: string; assignee: string; dueDate: string }>;
  }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      topTopics: [
        { topic: 'Authentication System', mentions: 15 },
        { topic: 'API Architecture', mentions: 12 },
        { topic: 'User Experience', mentions: 10 },
        { topic: 'Database Design', mentions: 8 },
        { topic: 'Security', mentions: 6 }
      ],
      activeMembers: [
        { member: 'Areeba Riaz', activity: 95 },
        { member: 'Fatima Khan', activity: 87 },
        { member: 'Ahmed Ali', activity: 78 },
        { member: 'Zara Sheikh', activity: 72 }
      ],
      recentDecisions: [
        { decision: 'Use JWT for authentication', date: '2024-01-15' },
        { decision: 'Adopt OpenAPI 3.0 standard', date: '2024-01-12' },
        { decision: 'Implement microservices architecture', date: '2024-01-10' }
      ],
      overdueActions: [
        { action: 'Complete API documentation', assignee: 'Zara Sheikh', dueDate: '2024-01-20' },
        { action: 'Review security audit', assignee: 'Areeba Riaz', dueDate: '2024-01-18' }
      ]
    };
  }
};

// Real-time collaboration functions (for future implementation)
export const collaborationAPI = {
  // Subscribe to memory updates
  subscribeToUpdates(workspaceId: string, callback: (update: any) => void): () => void {
    // In a real implementation, this would use WebSocket or Server-Sent Events
    console.log('Subscribing to memory updates for workspace:', workspaceId);
    
    // Return unsubscribe function
    return () => {
      console.log('Unsubscribing from memory updates');
    };
  },

  // Broadcast node selection
  broadcastNodeSelection(nodeId: string, userId: string): void {
    // In a real implementation, this would broadcast to other users
    console.log('Broadcasting node selection:', nodeId, 'by user:', userId);
  },

  // Get active users
  async getActiveUsers(workspaceId: string): Promise<Array<{ id: string; name: string; avatar: string; lastSeen: string }>> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return [
      { id: '1', name: 'Areeba Riaz', avatar: 'AR', lastSeen: 'now' },
      { id: '2', name: 'Fatima Khan', avatar: 'FK', lastSeen: '2 min ago' },
      { id: '3', name: 'Ahmed Ali', avatar: 'AA', lastSeen: '5 min ago' }
    ];
  }
};
