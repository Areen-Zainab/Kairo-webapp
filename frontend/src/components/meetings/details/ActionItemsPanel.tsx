import React, { useState } from 'react';
import { CheckCircle, Clock, User, Calendar, AlertCircle, XCircle, Plus, CheckSquare } from 'lucide-react';
import type { MeetingDetailsData } from './types';
import { useActionItems, type ActionItem } from '../../../hooks/useActionItems';
import { useUser } from '../../../context/UserContext';
import { apiService } from '../../../services/api';

interface ActionItemsPanelProps {
  meeting: MeetingDetailsData;
  onAddActionItem: (actionItem: any) => void;
  onUpdateActionItem: (id: string, actionItem: any) => void;
  onDeleteActionItem: (id: string) => void;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'confirmed':
      return <CheckCircle className="w-4 h-4" />;
    case 'rejected':
      return <XCircle className="w-4 h-4" />;
    default:
      return <AlertCircle className="w-4 h-4" />;
  }
};

const ActionItemsPanel: React.FC<ActionItemsPanelProps> = ({ meeting }) => {
  const meetingIdValue = meeting.id;
  const { user } = useUser();
  const isOrchestrator = user && meeting.organizer?.id && user.id.toString() === meeting.organizer.id.toString();

  const { actionItems, loading, error, confirmActionItem, rejectActionItem, refresh } = useActionItems(
    meetingIdValue,
    12000,
    false // Disable WebSocket for details view
  );

  // Track per-item loading and toast state
  const [creatingTask, setCreatingTask] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateTask = async (item: ActionItem) => {
    setCreatingTask((prev) => ({ ...prev, [item.id]: true }));
    try {
      const response = await apiService.createTaskFromActionItem(item.id);
      if (response.data?.task) {
        showToast(`Task created: "${response.data.task.title}"`, 'success');
        refresh(); // Refresh to get updated task field on action item
      } else {
        showToast(response.error || 'Failed to create task', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create task', 'error');
    } finally {
      setCreatingTask((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const isPlaceholderActionItem = (item: ActionItem): boolean => {
    const title = (item.title || '').toLowerCase().trim();
    const description = (item.description || '').toLowerCase().trim();
    const placeholderPatterns = [
      'no action items detected',
      'no actionable items',
      'no action items found',
      'no tasks identified',
      'no follow-up items',
      'no action items were identified',
      'no specific action items',
      'no action items identified',
    ];
    return placeholderPatterns.some(
      (pattern) => title.includes(pattern) || description.includes(pattern)
    );
  };

  const validActionItems = actionItems.filter((item) => !isPlaceholderActionItem(item));
  const pending = validActionItems.filter((i) => i.status === 'pending');
  const confirmed = validActionItems.filter((i) => i.status === 'confirmed');
  const rejected = validActionItems.filter((i) => i.status === 'rejected');

  const hasNoActionItems = validActionItems.length === 0 && !loading && !error;
  const hasPlaceholderOnly = actionItems.length > 0 && validActionItems.length === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Action Items</h3>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Live items extracted from this meeting (auto-refreshing)
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="text-sm text-slate-600 dark:text-slate-300">Loading action items…</div>
      )}
      {error && <div className="text-sm text-red-500">Error: {error}</div>}

      {(hasNoActionItems || hasPlaceholderOnly) && !loading && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">
            No Action Items Detected
          </p>
          <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
            No actionable items were identified in this meeting.
          </p>
        </div>
      )}

      {validActionItems.length > 0 &&
        [
          { title: 'Pending', items: pending },
          { title: 'Confirmed', items: confirmed },
          { title: 'Rejected', items: rejected },
        ]
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.title} className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {group.title} ({group.items.length})
              </h4>
              {group.items.map((item) => {
                const disabledActions = !isOrchestrator || item.status !== 'pending';
                const hasTask = !!item.task;
                const isCreating = !!creatingTask[item.id];

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h5 className="text-base font-semibold text-slate-900 dark:text-white">{item.title}</h5>
                          <span className={`px-2 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 ${statusBadge(item.status)}`}>
                            {statusIcon(item.status)}
                            {item.status.toUpperCase()}
                          </span>
                          {/* Task indicator badge */}
                          {hasTask && (
                            <span className="px-2 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              <CheckSquare className="w-3 h-3" />
                              TASK CREATED
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{item.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
                          {item.assignee && (
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {item.assignee}
                            </span>
                          )}
                          {item.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Due {new Date(item.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          {item.confidence !== undefined && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Conf {Math.round((item.confidence || 0) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          disabled={disabledActions}
                          onClick={() => confirmActionItem(item.id)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                            disabledActions
                              ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30'
                          }`}
                        >
                          Confirm
                        </button>
                        <button
                          disabled={disabledActions}
                          onClick={() => rejectActionItem(item.id)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                            disabledActions
                              ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30'
                          }`}
                        >
                          Reject
                        </button>
                        {/* Create Task button — only for confirmed items */}
                        {item.status === 'confirmed' && (
                          <button
                            disabled={hasTask || isCreating}
                            onClick={() => handleCreateTask(item)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition flex items-center gap-1.5 ${
                              hasTask
                                ? 'border-purple-200 text-purple-400 cursor-not-allowed dark:border-purple-800 dark:text-purple-500'
                                : isCreating
                                ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isCreating ? 'Creating…' : hasTask ? 'Task Exists' : 'Create Task'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
    </div>
  );
};

export default ActionItemsPanel;
