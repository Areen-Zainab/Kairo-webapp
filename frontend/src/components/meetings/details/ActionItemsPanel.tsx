import React from 'react';
import { CheckCircle, Clock, User, Calendar, AlertCircle, XCircle } from 'lucide-react';
import type { MeetingDetailsData } from './types';
import { useActionItems } from '../../../hooks/useActionItems';
import { useUser } from '../../../context/UserContext';

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
  const meetingIdValue = meeting.id; // accept string or number as-is
  const { user } = useUser();
  const isOrchestrator = user && meeting.organizer?.id && user.id.toString() === meeting.organizer.id.toString();

  const { actionItems, loading, error, confirmActionItem, rejectActionItem, refresh } = useActionItems(
    meetingIdValue,
    12000,
    false // Disable WebSocket for details view
  );

  const pending = actionItems.filter((i) => i.status === 'pending');
  const confirmed = actionItems.filter((i) => i.status === 'confirmed');
  const rejected = actionItems.filter((i) => i.status === 'rejected');

  return (
    <div className="p-6 space-y-6">
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

      {[{ title: 'Pending', items: pending }, { title: 'Confirmed', items: confirmed }, { title: 'Rejected', items: rejected }]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.title} className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {group.title} ({group.items.length})
            </h4>
            {group.items.map((item) => {
              const disabledActions = !isOrchestrator || item.status !== 'pending';
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
                    <div className="flex items-center gap-2">
                      <button
                        disabled={disabledActions}
                        onClick={() => confirmActionItem(item.id)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition ${disabledActions
                            ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/30'
                          }`}
                      >
                        Confirm
                      </button>
                      <button
                        disabled={disabledActions}
                        onClick={() => rejectActionItem(item.id)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition ${disabledActions
                            ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30'
                          }`}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {actionItems.length === 0 && !loading && (
        <div className="text-center py-10 text-slate-500 dark:text-slate-400">
          <div className="w-14 h-14 mx-auto mb-3 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <p className="font-medium">No action items yet</p>
          <p className="text-xs mt-1">Items will appear here as they are extracted</p>
        </div>
      )}
    </div>
  );
};

export default ActionItemsPanel;
