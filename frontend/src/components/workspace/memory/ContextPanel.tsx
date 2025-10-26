import React, { useState } from 'react';
import type { MemoryNode, GraphData, ContextPanelTab } from './types';

interface ContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  node: MemoryNode | null;
  graphData: GraphData;
}

const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onClose,
  node,
  graphData,
}) => {
  const [activeTab, setActiveTab] = useState<ContextPanelTab['id']>('summary');

  const tabs: ContextPanelTab[] = [
    { id: 'summary', label: 'Summary', icon: '📋' },
    { id: 'meetings', label: 'Meetings', icon: '📅' },
    { id: 'actions', label: 'Actions', icon: '✅' },
    { id: 'notes', label: 'Notes', icon: '📝' },
  ];

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
      action: 'Action Item',
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

  const getLinkedMeetings = () => {
    if (!node) return [];
    
    if (node.type === 'meeting') {
      return [node];
    }
    
    const relatedNodes = getRelatedNodes();
    return relatedNodes.filter(n => n.type === 'meeting');
  };

  const getActionItems = () => {
    if (!node) return [];
    
    if (node.type === 'action') {
      return [node];
    }
    
    const relatedNodes = getRelatedNodes();
    return relatedNodes.filter(n => n.type === 'action');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!isOpen || !node) return null;

  const relatedNodes = getRelatedNodes();
  const linkedMeetings = getLinkedMeetings();
  const actionItems = getActionItems();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-96 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-l border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
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
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{node.label}</h2>
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
            {tabs.map((tab) => (
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
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Summary</h3>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{node.summary}</p>
              </div>

              {node.data.keywords && node.data.keywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {node.data.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-md text-xs"
                      >
                        {keyword}
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

              <div>
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Related Items</h4>
                <p className="text-slate-700 dark:text-slate-300">{relatedNodes.length} connected items</p>
              </div>
            </div>
          )}

          {activeTab === 'meetings' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Linked Meetings</h3>
              {linkedMeetings.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No meetings linked to this item</p>
              ) : (
                linkedMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-4 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg border border-slate-200/50 dark:border-slate-600/30 hover:border-slate-300/50 dark:hover:border-slate-500/50 transition-colors"
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

          {activeTab === 'actions' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Action Items</h3>
              {actionItems.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-8">No action items linked to this item</p>
              ) : (
                actionItems.map((action) => (
                  <div
                    key={action.id}
                    className="p-4 bg-slate-100/50 dark:bg-slate-700/30 rounded-lg border border-slate-200/50 dark:border-slate-600/30 hover:border-slate-300/50 dark:hover:border-slate-500/50 transition-colors"
                  >
                    <h4 className="font-medium text-slate-900 dark:text-white mb-2">{action.label}</h4>
                    <p className="text-slate-700 dark:text-slate-300 text-sm mb-2">{action.summary}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      {action.data.assignee && (
                        <span>Assigned to: {action.data.assignee}</span>
                      )}
                      {action.data.dueDate && (
                        <span>Due: {formatDate(action.data.dueDate)}</span>
                      )}
                      {action.data.priority && (
                        <span className={`px-2 py-1 rounded ${
                          action.data.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                          action.data.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          action.data.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {action.data.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Notes & Context</h3>
              <div className="space-y-3">
                {node.data.transcriptSnippet && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Transcript Snippet</h4>
                    <p className="text-slate-700 dark:text-slate-300 text-sm italic bg-slate-100/50 dark:bg-slate-700/30 p-3 rounded-lg">
                      "{node.data.transcriptSnippet}"
                    </p>
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Additional Context</h4>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    This {getNodeTypeLabel(node.type).toLowerCase()} is connected to {relatedNodes.length} other items in your workspace memory.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContextPanel;
