import { useState } from 'react';
import type { AIQuery } from '../components/workspace/memory/types';

export const useQueryMemory = () => {
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryHistory, setQueryHistory] = useState<AIQuery[]>([]);

  const queryMemory = async (query: string): Promise<AIQuery | null> => {
    setIsQuerying(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock semantic search results based on query
      const mockResults = generateMockResults(query);
      
      const aiQuery: AIQuery = {
        query,
        timestamp: Date.now(),
        results: mockResults
      };
      
      setQueryHistory(prev => [aiQuery, ...prev.slice(0, 9)]); // Keep last 10 queries
      
      return aiQuery;
    } catch (error) {
      console.error('Query failed:', error);
      return null;
    } finally {
      setIsQuerying(false);
    }
  };

  const generateMockResults = (query: string) => {
    const queryLower = query.toLowerCase();
    
    // Simple keyword matching for demo purposes
    const results = {
      nodes: [] as string[],
      edges: [] as string[],
      confidence: 0.8
    };

    // Mock semantic matching based on query content
    if (queryLower.includes('auth') || queryLower.includes('authentication') || queryLower.includes('jwt')) {
      results.nodes.push('topic-1', 'decision-1', 'action-1', 'meeting-1');
      results.edges.push('e1', 'e9', 'e11', 'e4');
    }
    
    if (queryLower.includes('api') || queryLower.includes('rest') || queryLower.includes('endpoint')) {
      results.nodes.push('topic-2', 'decision-2', 'action-2', 'meeting-2');
      results.edges.push('e2', 'e10', 'e12', 'e7', 'e8');
    }
    
    if (queryLower.includes('ux') || queryLower.includes('user') || queryLower.includes('design') || queryLower.includes('interface')) {
      results.nodes.push('topic-3', 'meeting-3', 'member-2');
      results.edges.push('e3', 'e5', 'e6');
    }
    
    if (queryLower.includes('areeba') || queryLower.includes('lead') || queryLower.includes('developer')) {
      results.nodes.push('member-1', 'meeting-1', 'meeting-2', 'action-1');
      results.edges.push('e4', 'e7', 'e11');
    }
    
    if (queryLower.includes('fatima') || queryLower.includes('product') || queryLower.includes('manager')) {
      results.nodes.push('member-2', 'meeting-1', 'meeting-3', 'topic-3');
      results.edges.push('e5', 'e6');
    }
    
    if (queryLower.includes('ahmed') || queryLower.includes('frontend')) {
      results.nodes.push('member-3', 'meeting-1', 'meeting-3');
      results.edges.push('e6');
    }
    
    if (queryLower.includes('zara') || queryLower.includes('backend') || queryLower.includes('api')) {
      results.nodes.push('member-4', 'meeting-2', 'action-2', 'topic-2');
      results.edges.push('e8', 'e12', 'e2', 'e10');
    }
    
    if (queryLower.includes('decision') || queryLower.includes('decide')) {
      results.nodes.push('decision-1', 'decision-2', 'topic-1', 'topic-2');
      results.edges.push('e9', 'e10', 'e1', 'e2');
    }
    
    if (queryLower.includes('action') || queryLower.includes('task') || queryLower.includes('todo')) {
      results.nodes.push('action-1', 'action-2', 'member-1', 'member-4');
      results.edges.push('e11', 'e12');
    }
    
    if (queryLower.includes('meeting') || queryLower.includes('discuss') || queryLower.includes('session')) {
      results.nodes.push('meeting-1', 'meeting-2', 'meeting-3');
      results.edges.push('e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8');
    }

    // If no specific matches, return some general results
    if (results.nodes.length === 0) {
      results.nodes = ['topic-1', 'meeting-1', 'member-1'];
      results.edges = ['e1', 'e4'];
      results.confidence = 0.3;
    }

    return results;
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
