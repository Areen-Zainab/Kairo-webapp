export type NodeType = 'meeting' | 'topic' | 'decision' | 'action' | 'member';
export type EdgeType = 'meeting-topic' | 'meeting-member' | 'topic-decision' | 'action-member';

export interface MemoryNode {
  id: string;
  type: NodeType;
  label: string;
  summary: string;
  data: {
    mentions: number | undefined;
    // Meeting data
    date?: string;
    duration?: string;
    participants?: string[];
    transcriptSnippet?: string;
    
    // Topic data
    keywords?: string[];
    importance?: number;
    lastDiscussed?: string;
    /** When topic comes from structured `key_topics` (name / mentions / sentiment) */
    sentiment?: string;
    
    // Decision data
    decisionStatus?: 'active' | 'superseded' | 'pending';
    impact?: 'high' | 'medium' | 'low';
    
    // Action / task (graph task nodes)
    assignee?: string;
    dueDate?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    actionStatus?: 'todo' | 'in-progress' | 'completed';
    taskId?: number;
    actionItemId?: number;
    /** Source meeting for this task (graph link) */
    meetingId?: number;
    /** Kanban column name at graph build time */
    kanbanColumnName?: string;
    /** Populated for task nodes derived from a confirmed action item */
    sourceActionItem?: {
      id: number;
      title: string;
      description?: string;
      status?: string;
    };
    
    // Member data
    role?: string;
    department?: string;
    avatar?: string;
  };
  position: {
    x: number;
    y: number;
  };
  size: number;
  color: string;
  opacity: number;
}

export interface MemoryEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  color: string;
  opacity: number;
  curved: boolean;
}

export interface GraphData {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

export interface MemoryFilter {
  search?: string;
  nodeTypes?: NodeType[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  members?: string[];
  meetingTypes?: string[];
  keywords?: string[];
}

export interface ContextPanelTab {
  id: 'summary' | 'meetings' | 'actions' | 'notes';
  label: string;
  icon: string;
}

/** One row from hybrid memory search (per meeting after dedupe, best chunk). */
export interface MemorySearchHit {
  meetingId: number;
  snippet: string;
  content?: string;
  matchedTerms?: string[];
  contentType?: string;
}

export interface AIQuery {
  query: string;
  timestamp: number;
  results: {
    nodes: string[];
    edges: string[];
    confidence: number;
  };
  /** Raw search hits so the context panel can show the retrieved chunk, not only the first transcript chunk on the graph node. */
  memorySearchHits?: MemorySearchHit[];
}

export interface MemoryExport {
  format: 'png' | 'svg' | 'json' | 'txt';
  filename: string;
  data: any;
}

export interface WorkspaceMemory {
  id: string;
  name: string;
  lastUpdate: string;
  totalNodes: number;
  totalEdges: number;
  topics: number;
  meetings: number;
  decisions: number;
  actions: number;
  members: number;
}

export interface GraphViewport {
  x: number;
  y: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface FocusMode {
  enabled: boolean;
  centerNode?: string;
  relatedNodes: string[];
  dimmedNodes: string[];
}
