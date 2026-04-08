import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiService from '../../../services/api';
import {
  HighlightedText,
  highlightTermsFromQuery,
  mergeHighlightTermArrays,
} from '../../common/HighlightedText';
import { buildCenteredExcerpt, stripDiarizationLabels } from '../../../utils/searchExcerpt';
import type { MemoryNode, GraphData, ContextPanelTab, MemorySearchHit } from './types';
import TopicDetailSummary from './TopicDetailSummary';
import { formatTopicKeywordChip, getTopicDisplay } from './topicDisplay';

const TRANSCRIPT_PREVIEW_LEN = 650;

function mergeHighlightTerms(
  hit: MemorySearchHit | undefined,
  memorySearchQuery: string,
  graphHighlightQuery: string
): string[] {
  const combined = [memorySearchQuery, graphHighlightQuery].filter(Boolean).join(' ');
  return mergeHighlightTermArrays(hit?.matchedTerms?.filter(Boolean), highlightTermsFromQuery(combined));
}

function transcriptPreviewAroundQuery(
  fullText: string,
  memorySearchQuery: string,
  graphHighlightQuery: string,
  hit: MemorySearchHit | undefined,
  maxLen: number
): string {
  const q = [memorySearchQuery, graphHighlightQuery].filter(Boolean).join(' ').trim();
  // Strip diarization labels so the panel shows clean text
  const cleaned = stripDiarizationLabels(fullText);
  return buildCenteredExcerpt(cleaned, q, hit?.matchedTerms, maxLen);
}

interface ContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  node: MemoryNode | null;
  graphData: GraphData;
  /** Latest hybrid search hits from Memory Query — used to show the retrieved chunk instead of the graph’s first transcript chunk. */
  semanticSearchHits?: MemorySearchHit[];
  memorySearchQuery?: string;
  /** Debounced query while typing in the assistant (optional extra terms for highlights). */
  graphHighlightQuery?: string;
}

const CONTEXT_TABS: ContextPanelTab[] = [
  { id: 'summary', label: 'Overview', icon: '📋' },
  { id: 'meetings', label: 'Meetings', icon: '📅' },
  { id: 'actions', label: 'Tasks', icon: '✅ ' },
  { id: 'notes', label: 'Context', icon: '📝' },
];

const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onClose,
  node,
  graphData,
  semanticSearchHits = [],
  memorySearchQuery = '',
  graphHighlightQuery = '',
}) => {
  const [activeTab, setActiveTab] = useState<ContextPanelTab['id']>('summary');
  const [meetingTasksPanel, setMeetingTasksPanel] = useState<{
    tasks: Array<{
      id: number;
      title: string;
      description: string | null;
      assignee: string | null;
      dueDate: string | null;
      priority: string;
      columnName: string | null;
      updatedAt: string;
    }>;
    pendingActionItems: Array<{
      id: number;
      title: string;
      description: string | null;
      assignee: string | null;
      dueDate: string | null;
      lastSeenAt: string | null;
    }>;
  } | null>(null);
  const [meetingPanelLoading, setMeetingPanelLoading] = useState(false);
  const [meetingPanelError, setMeetingPanelError] = useState<string | null>(null);
  const [memberInsights, setMemberInsights] = useState<{
    resolved: boolean;
    label: string;
    user: { id: number; name: string; email: string } | null;
    meetings: Array<{
      id: number;
      title: string;
      startTime: string;
      endTime: string | null;
      status: string;
      duration: number;
    }>;
    tasks: Array<{
      id: number;
      title: string;
      description: string | null;
      assignee: string | null;
      dueDate: string | null;
      priority: string;
      columnName: string | null;
      updatedAt: string;
      meetingId: number | null;
      meetingTitle: string | null;
    }>;
    stats: {
      meetingsAttended: number;
      tasksAssigned: number;
      tasksCompleted: number;
      latestMeeting: { id: number; title: string; startTime: string } | null;
      latestCompletedTask: { id: number; title: string; updatedAt: string } | null;
    };
  } | null>(null);
  const [memberInsightsLoading, setMemberInsightsLoading] = useState(false);
  const [memberInsightsError, setMemberInsightsError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId?: string }>();

  const getNodeTypeColor = (type: string) => {
    const colors = {
      meeting: 'bg-blue-500',
      topic: 'bg-purple-500',
      decision: 'bg-green-500',
      action: 'bg-yellow-500',
      member: 'bg-orange-500',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500';
  };

  const getNodeTypeLabel = (type: string) => {
    const labels = {
      meeting: 'Meeting',
      topic: 'Topic',
      decision: 'Decision',
      action: 'Task',
      member: 'Team Member',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getRelatedNodes = () => {
    if (!node) return [];
    
    const relatedEdges = graphData.edges.filter(
      edge => edge.source === node.id || edge.target === node.id
    );
    
    const relatedNodeIds = relatedEdges.map(edge => 
      edge.source === node.id ? edge.target : edge.source
    );
    
    return graphData.nodes.filter(n => relatedNodeIds.includes(n.id));
  };

  const parseMeetingIdFromNodeId = (nodeId: string): string | null => {
    // Expected shapes:
    // - "meeting:123"
    // - "123" (fallback)
    const parts = String(nodeId).split(':');
    if (parts.length === 2 && parts[0] === 'meeting' && parts[1]) return parts[1];
    if (/^\d+$/.test(String(nodeId))) return String(nodeId);
    return null;
  };

  const navigateToMeetingDetails = (meetingNode: MemoryNode) => {
    const meetingId = parseMeetingIdFromNodeId(meetingNode.id);
    if (!meetingId) return;
    const path = workspaceId
      ? `/workspace/${workspaceId}/meetings/${meetingId}`
      : `/workspace/meetings/${meetingId}`;
    navigate(path);
  };

  const navigateToMeetingId = (meetingId: number) => {
    const path = workspaceId
      ? `/workspace/${workspaceId}/meetings/${meetingId}`
      : `/workspace/meetings/${meetingId}`;
    navigate(path);
  };

  const getTopicsForMeeting = (meetingNode: MemoryNode): MemoryNode[] => {
    // Topics are represented as nodes with type "topic" connected to the meeting node.
    const relatedEdges = graphData.edges.filter(
      (edge) => edge.source === meetingNode.id || edge.target === meetingNode.id
    );
    const relatedNodeIds = relatedEdges.map((edge) =>
      edge.source === meetingNode.id ? edge.target : edge.source
    );
    return graphData.nodes.filter((n) => relatedNodeIds.includes(n.id) && n.type === 'topic');
  };

  const getLinkedMeetings = () => {
    if (!node) return [];
    
    if (node.type === 'meeting') {
      return [node];
    }
    
    const relatedNodes = getRelatedNodes();
    return relatedNodes.filter(n => n.type === 'meeting');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const formatActionItemStatus = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'confirmed') return 'Confirmed';
    if (s === 'pending') return 'Pending';
    if (s === 'rejected') return 'Rejected';
    return status;
  };

  const formatWorkflowStatus = (status: string | undefined) => {
    if (!status) return '—';
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In progress';
      case 'todo':
        return 'To do';
      default:
        return status;
    }
  };

  const showTasksTab = node?.type === 'meeting' || node?.type === 'member';

  const visibleTabs = useMemo(() => {
    if (!showTasksTab) {
      return CONTEXT_TABS.filter((t) => t.id !== 'actions');
    }
    return CONTEXT_TABS;
  }, [showTasksTab]);

  // Must run unconditionally — never after an early return (Rules of Hooks).
  const topicsForSelectedMeeting = useMemo(() => {
    if (!node || node.type !== 'meeting') return [];
    return getTopicsForMeeting(node);
  }, [node?.id, node?.type, graphData]);

  const searchHitForSelectedMeeting = useMemo(() => {
    if (!node) return undefined;
    const midStr = parseMeetingIdFromNodeId(node.id);
    if (!midStr) return undefined;
    const mid = parseInt(midStr, 10);
    if (Number.isNaN(mid)) return undefined;
    return semanticSearchHits.find((h) => Number(h.meetingId) === mid);
  }, [node?.id, semanticSearchHits]);

  const getSearchHitForMeetingNode = (meetingNode: MemoryNode): MemorySearchHit | undefined => {
    const midStr = parseMeetingIdFromNodeId(meetingNode.id);
    if (!midStr) return undefined;
    const mid = parseInt(midStr, 10);
    if (Number.isNaN(mid)) return undefined;
    return semanticSearchHits.find((h) => Number(h.meetingId) === mid);
  };

  const prevPanelOpen = useRef(false);
  useEffect(() => {
    const justOpened = isOpen && !prevPanelOpen.current;
    prevPanelOpen.current = isOpen;
    if (justOpened && node?.type === 'meeting' && searchHitForSelectedMeeting) {
      setActiveTab('notes');
    }
  }, [isOpen, node?.type, searchHitForSelectedMeeting, node?.id]);

  useEffect(() => {
    if (!showTasksTab && activeTab === 'actions') {
      setActiveTab('summary');
    }
  }, [showTasksTab, activeTab]);

  useEffect(() => {
    if (!isOpen || !node) {
      setMeetingTasksPanel(null);
      setMeetingPanelError(null);
      setMeetingPanelLoading(false);
      setMemberInsights(null);
      setMemberInsightsError(null);
      setMemberInsightsLoading(false);
      return;
    }

    const ws = workspaceId ? parseInt(workspaceId, 10) : NaN;
    if (Number.isNaN(ws)) {
      setMeetingTasksPanel(null);
      setMemberInsights(null);
      return;
    }

    let cancelled = false;

    if (node.type === 'meeting') {
      const midStr = parseMeetingIdFromNodeId(node.id);
      const mid = midStr ? parseInt(midStr, 10) : NaN;
      if (Number.isNaN(mid)) {
        setMeetingTasksPanel(null);
        setMeetingPanelError(null);
        setMeetingPanelLoading(false);
        return;
      }
      setMeetingPanelLoading(true);
      setMeetingPanelError(null);
      void apiService.getMeetingTasksPanel(ws, mid).then((res: Awaited<ReturnType<typeof apiService.getMeetingTasksPanel>>) => {
        if (cancelled) return;
        setMeetingPanelLoading(false);
        if (res.error) {
          setMeetingPanelError(res.error);
          setMeetingTasksPanel(null);
          return;
        }
        const d = res.data;
        if (d && 'tasks' in d && 'pendingActionItems' in d) {
          setMeetingTasksPanel({
            tasks: d.tasks,
            pendingActionItems: d.pendingActionItems
          });
        } else {
          setMeetingTasksPanel(null);
        }
      });
      setMemberInsights(null);
      setMemberInsightsError(null);
      return () => {
        cancelled = true;
      };
    }

    if (node.type === 'member') {
      setMemberInsightsLoading(true);
      setMemberInsightsError(null);
      void apiService.getMemberMemoryInsights(ws, node.label).then((res: Awaited<ReturnType<typeof apiService.getMemberMemoryInsights>>) => {
        if (cancelled) return;
        setMemberInsightsLoading(false);
        if (res.error) {
          setMemberInsightsError(res.error);
          setMemberInsights(null);
          return;
        }
        const d = res.data;
        if (d && d.success && d.stats) {
          setMemberInsights({
            resolved: d.resolved,
            label: d.label,
            user: d.user,
            meetings: d.meetings,
            tasks: d.tasks,
            stats: d.stats
          });
        } else {
          setMemberInsights(null);
        }
      });
      setMeetingTasksPanel(null);
      setMeetingPanelError(null);
      return () => {
        cancelled = true;
      };
    }

    setMeetingTasksPanel(null);
    setMeetingPanelError(null);
    setMemberInsights(null);
    setMemberInsightsError(null);
    return () => {
      cancelled = true;
    };
  }, [isOpen, node?.id, node?.type, node?.label, workspaceId]);

  if (!isOpen || !node) return null;

  const relatedNodes = getRelatedNodes();
  const linkedMeetings = getLinkedMeetings();
  const panelTitle = node.type === 'topic' ? getTopicDisplay(node).title : node.label;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-96 flex flex-col bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-l border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getNodeTypeColor(node.type)}`}>
                <span className="text-white text-lg">
                  {node.type === 'meeting' ? '📅' :
                   node.type === 'topic' ? '💡' :
                   node.type === 'decision' ? '✅' :
                   node.type === 'action' ? '📋' : '👤'}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{panelTitle}</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">{getNodeTypeLabel(node.type)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-hide">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Summary</h3>
                {node.type === 'topic' ? (
                  <TopicDetailSummary topic={node} />
                ) : node.type === 'action' ? (
                  <div className="space-y-4">
                    <dl className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 dark:border-slate-600/40 bg-white/60 dark:bg-slate-900/40 p-4 text-sm shadow-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400 shrink-0">Due date</dt>
                        <dd className="text-right text-slate-900 dark:text-white">
                          {node.data.dueDate ? formatDate(node.data.dueDate) : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 items-center">
                        <dt className="text-slate-500 dark:text-slate-400 shrink-0">Priority</dt>
                        <dd>
                          {node.data.priority ? (
                            <span
                              className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                                node.data.priority === 'urgent'
                                  ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                                  : node.data.priority === 'high'
                                    ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300'
                                    : node.data.priority === 'medium'
                                      ? 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-200'
                                      : 'bg-green-500/20 text-green-800 dark:text-green-200'
                              }`}
                            >
                              {node.data.priority}
                            </span>
                          ) : (
                            <span className="text-slate-900 dark:text-white">—</span>
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500 dark:text-slate-400 shrink-0">Workflow</dt>
                        <dd className="text-right text-slate-900 dark:text-white">
                          {formatWorkflowStatus(node.data.actionStatus)}
                        </dd>
                      </div>
                      {node.data.meetingId != null && (
                        <div className="flex justify-between gap-4 items-start pt-1 border-t border-slate-200/60 dark:border-slate-600/40">
                          <dt className="text-slate-500 dark:text-slate-400 shrink-0 pt-0.5">Source meeting</dt>
                          <dd className="text-right">
                            <button
                              type="button"
                              onClick={() => navigateToMeetingId(node.data.meetingId!)}
                              className="text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
                            >
                              Open meeting #{node.data.meetingId}
                            </button>
                          </dd>
                        </div>
                      )}
                    </dl>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                        Description
                      </h4>
                      {node.summary ? (
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {node.summary}
                        </p>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 text-sm italic">No description</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/40 bg-slate-50/90 dark:bg-slate-800/60 p-4 shadow-sm">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                        Assignee
                      </h4>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-lg ring-1 ring-orange-500/25"
                          aria-hidden
                        >
                          👤
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {node.data.assignee?.trim() ? node.data.assignee : 'Unassigned'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {node.data.assignee?.trim() ? 'Responsible for this task' : 'No owner on this task yet'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {node.data.sourceActionItem && (
                      <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/40 bg-slate-50/90 dark:bg-slate-800/60 p-4 shadow-sm">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                          Derived from action item
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                          #{node.data.sourceActionItem.id}
                          {node.data.sourceActionItem.status && (
                            <span className="ml-2 inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                              {formatActionItemStatus(node.data.sourceActionItem.status)}
                            </span>
                          )}
                        </p>
                        <p className="font-medium text-slate-900 dark:text-white leading-snug">
                          {node.data.sourceActionItem.title}
                        </p>
                        {node.data.sourceActionItem.description && (
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {node.data.sourceActionItem.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : node.type === 'member' ? (
                  <div className="space-y-4">
                    {memberInsightsLoading && (
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Loading profile…</p>
                    )}
                    {memberInsightsError && (
                      <p className="text-red-600 dark:text-red-400 text-sm">{memberInsightsError}</p>
                    )}
                    {!memberInsightsLoading && memberInsights && (
                      <>
                        <p className="text-slate-700 dark:text-slate-300 font-medium">{memberInsights.label}</p>
                        {memberInsights.resolved && memberInsights.user ? (
                          <p className="text-sm text-slate-600 dark:text-slate-400 break-all">
                            <span className="text-slate-500 dark:text-slate-500">Email </span>
                            {memberInsights.user.email}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            No workspace member account matched this name. Task list uses assignee text that contains
                            this label.
                          </p>
                        )}
                        <dl className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/80 dark:border-slate-600/40 bg-white/60 dark:bg-slate-900/40 p-4 text-sm shadow-sm">
                          <div className="flex justify-between gap-4">
                            <dt className="text-slate-500 dark:text-slate-400">Meetings attended</dt>
                            <dd className="font-medium text-slate-900 dark:text-white">
                              {memberInsights.stats.meetingsAttended}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-slate-500 dark:text-slate-400">Tasks assigned</dt>
                            <dd className="font-medium text-slate-900 dark:text-white">
                              {memberInsights.stats.tasksAssigned}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-slate-500 dark:text-slate-400">Tasks completed</dt>
                            <dd className="font-medium text-slate-900 dark:text-white">
                              {memberInsights.stats.tasksCompleted}
                            </dd>
                          </div>
                        </dl>
                        {memberInsights.stats.latestMeeting && (
                          <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/40 bg-slate-50/90 dark:bg-slate-800/60 p-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                              Latest meeting attended
                            </h4>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {memberInsights.stats.latestMeeting.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {formatDateTime(memberInsights.stats.latestMeeting.startTime)}
                            </p>
                            <button
                              type="button"
                              onClick={() => navigateToMeetingId(memberInsights.stats.latestMeeting!.id)}
                              className="mt-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
                            >
                              Open meeting
                            </button>
                          </div>
                        )}
                        {memberInsights.stats.latestCompletedTask && (
                          <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/40 bg-slate-50/90 dark:bg-slate-800/60 p-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                              Latest completed task
                            </h4>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {memberInsights.stats.latestCompletedTask.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Updated {formatDateTime(memberInsights.stats.latestCompletedTask.updatedAt)}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{node.summary}</p>
                    {node.type === 'meeting' && searchHitForSelectedMeeting ? (
                      (() => {
                        const hit = searchHitForSelectedMeeting;
                        const raw = (hit.content || hit.snippet || '').trim();
                        if (!raw) return null;
                        const display = transcriptPreviewAroundQuery(
                          raw,
                          memorySearchQuery,
                          graphHighlightQuery,
                          hit,
                          TRANSCRIPT_PREVIEW_LEN
                        );
                        // Only highlight with the search terms that actually matched this excerpt.
                        const terms = mergeHighlightTerms(hit, memorySearchQuery, graphHighlightQuery);
                        return (
                          <div className="mt-4 rounded-xl border border-amber-200/80 dark:border-amber-500/35 bg-amber-50/70 dark:bg-amber-950/25 p-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200 mb-2">
                              Matches your memory search
                            </h4>
                            <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                              <span className="italic text-slate-600 dark:text-slate-400">&ldquo;</span>
                              <HighlightedText text={display} terms={terms} className="italic" />
                              <span className="italic text-slate-600 dark:text-slate-400">&rdquo;</span>
                            </p>
                          </div>
                        );
                      })()
                    ) : null}
                  </>
                )}
              </div>

              {node.type === 'meeting' && topicsForSelectedMeeting.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Topics discussed
                  </h4>
                  <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
                    {topicsForSelectedMeeting.map((t) => (
                      <li key={t.id}>
                        <span className="inline-block px-2.5 py-1 rounded-md text-sm font-medium text-purple-900 dark:text-purple-100 bg-purple-100/90 dark:bg-purple-500/20 border border-purple-200/80 dark:border-purple-500/30">
                          {getTopicDisplay(t).title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {node.data.keywords && node.data.keywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {node.data.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-md text-xs"
                      >
                        {formatTopicKeywordChip(keyword)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {node.data.date && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Date</h4>
                  <p className="text-slate-700 dark:text-slate-300">{formatDate(node.data.date)}</p>
                </div>
              )}

              {node.data.participants && node.data.participants.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Participants</h4>
                  <div className="flex flex-wrap gap-2">
                    {node.data.participants.map((participant, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-md text-xs"
                      >
                        {participant}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {node.type !== 'action' && node.type !== 'member' && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Related Items</h4>
                  <p className="text-slate-700 dark:text-slate-300">{relatedNodes.length} connected items</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'meetings' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                {node.type === 'member' ? 'Meetings attended' : 'Linked Meetings'}
              </h3>
              {node.type === 'member' ? (
                <>
                  {memberInsightsLoading && (
                    <p className="text-slate-500 dark:text-slate-400 text-center py-8 text-sm">Loading meetings…</p>
                  )}
                  {memberInsightsError && (
                    <p className="text-red-600 dark:text-red-400 text-center py-8 text-sm">{memberInsightsError}</p>
                  )}
                  {!memberInsightsLoading &&
                    !memberInsightsError &&
                    memberInsights &&
                    (memberInsights.meetings.length === 0 ? (
                      <p className="text-slate-500 dark:text-slate-400 text-center py-8 text-sm">
                        No meetings found for this person in this workspace.
                      </p>
                    ) : (
                      memberInsights.meetings.map((m) => (
                        <div
                          key={m.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigateToMeetingId(m.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') navigateToMeetingId(m.id);
                          }}
                          className="p-4 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg border border-slate-200/50 dark:border-slate-600/30 hover:border-slate-300/50 dark:hover:border-slate-500/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        >
                          <h4 className="font-medium text-slate-900 dark:text-white mb-2">{m.title}</h4>
                          <p className="text-slate-500 dark:text-slate-400 text-xs">
                            {formatDateTime(m.startTime)}
                          </p>
                          {m.duration != null && (
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                              Duration: {m.duration}m · {m.status}
                            </p>
                          )}
                        </div>
                      ))
                    ))}
                </>
              ) : linkedMeetings.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No meetings linked to this item</p>
              ) : (
                linkedMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateToMeetingDetails(meeting)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') navigateToMeetingDetails(meeting);
                    }}
                    className="p-4 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg border border-slate-200/50 dark:border-slate-600/30 hover:border-slate-300/50 dark:hover:border-slate-500/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <h4 className="font-medium text-slate-900 dark:text-white mb-2">{meeting.label}</h4>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mb-2">{meeting.summary}</p>

                    {meeting.data.date && (
                      <p className="text-slate-500 dark:text-slate-400 text-xs">{formatDate(meeting.data.date)}</p>
                    )}
                    {meeting.data.duration && (
                      <p className="text-slate-500 dark:text-slate-400 text-xs">Duration: {meeting.data.duration}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'actions' && node.type === 'meeting' && (
            <div className="h-full flex flex-col min-h-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex-shrink-0">Tasks</h3>
              {meetingPanelLoading && (
                <p className="text-slate-500 dark:text-slate-400 text-sm">Loading tasks…</p>
              )}
              {meetingPanelError && (
                <p className="text-red-600 dark:text-red-400 text-sm">{meetingPanelError}</p>
              )}
              {!meetingPanelLoading && !meetingPanelError && meetingTasksPanel && (
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-6 scrollbar-hide">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                      Confirmed tasks
                    </h4>
                    {meetingTasksPanel.tasks.length === 0 ? (
                      <p className="text-slate-500 dark:text-slate-400 text-sm">No tasks from this meeting yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {meetingTasksPanel.tasks.map((t) => (
                          <div
                            key={t.id}
                            className="p-4 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg border border-slate-200/50 dark:border-slate-600/30"
                          >
                            <h5 className="font-medium text-slate-900 dark:text-white mb-1">{t.title}</h5>
                            {t.description && (
                              <p className="text-slate-700 dark:text-slate-300 text-sm mb-2 line-clamp-4">
                                {t.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              {t.assignee && <span>Assigned: {t.assignee}</span>}
                              {t.dueDate && <span>Due: {formatDate(t.dueDate)}</span>}
                              {t.columnName && <span>Column: {t.columnName}</span>}
                              {t.priority && (
                                <span
                                  className={`px-2 py-0.5 rounded ${
                                    t.priority === 'urgent'
                                      ? 'bg-red-500/20 text-red-400'
                                      : t.priority === 'high'
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : t.priority === 'medium'
                                          ? 'bg-yellow-500/20 text-yellow-400'
                                          : 'bg-green-500/20 text-green-400'
                                  }`}
                                >
                                  {t.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-600/40">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Pending action items
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Suggested in this meeting — not yet confirmed as tasks.
                    </p>
                    {meetingTasksPanel.pendingActionItems.length === 0 ? (
                      <p className="text-slate-500 dark:text-slate-400 text-sm">None pending.</p>
                    ) : (
                      <div className="space-y-3">
                        {meetingTasksPanel.pendingActionItems.map((a) => (
                          <div
                            key={a.id}
                            className="p-4 bg-amber-500/5 dark:bg-amber-500/10 rounded-lg border border-amber-200/40 dark:border-amber-500/20"
                          >
                            <h5 className="font-medium text-slate-900 dark:text-white mb-1">{a.title}</h5>
                            {a.description && (
                              <p className="text-slate-700 dark:text-slate-300 text-sm mb-2 line-clamp-4">
                                {a.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                              {a.assignee && <span>Assignee: {a.assignee}</span>}
                              {a.dueDate && <span>Due: {formatDate(a.dueDate)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'actions' && node.type === 'member' && (
            <div className="h-full flex flex-col min-h-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex-shrink-0">Tasks</h3>
              {memberInsightsLoading && (
                <p className="text-slate-500 dark:text-slate-400 text-sm">Loading tasks…</p>
              )}
              {memberInsightsError && (
                <p className="text-red-600 dark:text-red-400 text-sm">{memberInsightsError}</p>
              )}
              {!memberInsightsLoading && !memberInsightsError && memberInsights && (
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 scrollbar-hide">
                  {memberInsights.tasks.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">
                      No assigned tasks found for this person.
                    </p>
                  ) : (
                    memberInsights.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-4 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg border border-slate-200/50 dark:border-slate-600/30"
                      >
                        <h5 className="font-medium text-slate-900 dark:text-white mb-1">{t.title}</h5>
                        {t.meetingTitle && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">From: {t.meetingTitle}</p>
                        )}
                        {t.description && (
                          <p className="text-slate-700 dark:text-slate-300 text-sm mb-2 line-clamp-3">
                            {t.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {t.dueDate && <span>Due: {formatDate(t.dueDate)}</span>}
                          {t.columnName && <span>{t.columnName}</span>}
                          {t.priority && (
                            <span
                              className={`px-2 py-0.5 rounded ${
                                t.priority === 'urgent'
                                  ? 'bg-red-500/20 text-red-400'
                                  : t.priority === 'high'
                                    ? 'bg-orange-500/20 text-orange-400'
                                    : t.priority === 'medium'
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : 'bg-green-500/20 text-green-400'
                              }`}
                            >
                              {t.priority}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Context</h3>
              {node.type === 'action' ? (
                <div className="space-y-4">
                  {linkedMeetings.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-center py-8 text-sm">
                      No meeting is linked to this task in the graph.
                    </p>
                  ) : (
                    linkedMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="rounded-xl border border-slate-200/80 dark:border-slate-600/40 bg-slate-50/90 dark:bg-slate-800/60 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white leading-snug">
                            {meeting.label}
                          </h4>
                          <button
                            type="button"
                            onClick={() => navigateToMeetingDetails(meeting)}
                            className="shrink-0 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            Open
                          </button>
                        </div>
                        {meeting.summary ? (
                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            {meeting.summary}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          {meeting.data.date && <span>{formatDate(meeting.data.date)}</span>}
                          {meeting.data.duration && (
                            <span>Duration: {meeting.data.duration}</span>
                          )}
                        </div>
                        {meeting.data.participants && meeting.data.participants.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                              Participants
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {meeting.data.participants.map((p, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-md text-xs"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(() => {
                          const hit = getSearchHitForMeetingNode(meeting);
                          const fallback = meeting.data.transcriptSnippet;
                          const raw = hit
                            ? (hit.content || hit.snippet || '').trim()
                            : (fallback || '').trim();
                          if (!raw) return null;
                          const display = transcriptPreviewAroundQuery(
                            raw,
                            memorySearchQuery,
                            graphHighlightQuery,
                            hit,
                            TRANSCRIPT_PREVIEW_LEN
                          );
                          // Only highlight when this specific meeting had a confirmed search hit.
                          // Without a hit, the snippet is default context — not a search result — so no highlighting.
                          const terms = hit ? mergeHighlightTerms(hit, memorySearchQuery, graphHighlightQuery) : [];
                          return (
                            <div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                                {hit ? 'Transcript excerpt (matches your search)' : 'Transcript snippet'}
                              </p>
                              <p className="text-slate-700 dark:text-slate-300 text-sm italic bg-white/60 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200/50 dark:border-slate-600/30">
                                &ldquo;
                                <HighlightedText text={display} terms={terms} className="italic" />
                                &rdquo;
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const hit = searchHitForSelectedMeeting;
                    const fallback = node.data.transcriptSnippet;
                    const raw = hit
                      ? (hit.content || hit.snippet || '').trim()
                      : (fallback || '').trim();
                    if (!raw) return null;
                    const display = transcriptPreviewAroundQuery(
                      raw,
                      memorySearchQuery,
                      graphHighlightQuery,
                      hit,
                      TRANSCRIPT_PREVIEW_LEN
                    );
                    // Only highlight when there is a confirmed search hit for this node.
                    const terms = hit ? mergeHighlightTerms(hit, memorySearchQuery, graphHighlightQuery) : [];
                    return (
                      <div>
                        <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                          {hit ? 'Transcript excerpt (matches your search)' : 'Transcript Snippet'}
                        </h4>
                        <p className="text-slate-700 dark:text-slate-300 text-sm italic bg-slate-100/50 dark:bg-slate-700/30 p-3 rounded-lg">
                          &ldquo;
                          <HighlightedText text={display} terms={terms} className="italic" />
                          &rdquo;
                        </p>
                      </div>
                    );
                  })()}

                  <div>
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Additional Context</h4>
                    <p className="text-slate-700 dark:text-slate-300 text-sm">
                      This {getNodeTypeLabel(node.type).toLowerCase()} is connected to {relatedNodes.length}{' '}
                      other items in your workspace memory.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContextPanel;
