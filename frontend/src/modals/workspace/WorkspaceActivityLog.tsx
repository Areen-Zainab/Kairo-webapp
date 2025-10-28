import { useState, useEffect, useCallback } from 'react';
import { X, Activity, User, Users, Settings, UserPlus, UserCheck, UserX, FileEdit, Loader2, Clock } from 'lucide-react';
import UserAvatar from '../../components/ui/UserAvatar';
import apiService from '../../services/api';

interface WorkspaceLog {
  id: number;
  action: string;
  title: string;
  description: string;
  metadata: any;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    profilePictureUrl?: string;
  } | null;
}

interface WorkspaceActivityLogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: number;
  workspaceName: string;
}

const WorkspaceActivityLog: React.FC<WorkspaceActivityLogProps> = ({
  isOpen,
  onClose,
  workspaceId,
  workspaceName
}) => {
  const [logs, setLogs] = useState<WorkspaceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getWorkspaceLogs(workspaceId);
      if (response.data) {
        setLogs(response.data.logs || []);
      } else {
        setError(response.error || 'Failed to load activity logs');
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'workspace_created':
        return <Settings className="w-4 h-4 text-green-500" />;
      case 'workspace_updated':
        return <FileEdit className="w-4 h-4 text-blue-500" />;
      case 'member_invited':
        return <UserPlus className="w-4 h-4 text-purple-500" />;
      case 'member_joined':
        return <Users className="w-4 h-4 text-green-500" />;
      case 'member_removed':
        return <UserX className="w-4 h-4 text-red-500" />;
      case 'invite_accepted':
        return <UserCheck className="w-4 h-4 text-green-500" />;
      case 'invite_rejected':
        return <UserX className="w-4 h-4 text-orange-500" />;
      case 'role_changed':
        return <User className="w-4 h-4 text-indigo-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[600px] bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Activity Log
                </h2>
                <p className="text-sm text-gray-600 dark:text-slate-400">{workspaceName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
              <p className="text-gray-600 dark:text-slate-400">Loading activity logs...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Activity className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={fetchLogs}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Activity className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-slate-400">No activity logs yet</p>
              <p className="text-sm text-gray-500 dark:text-slate-500 mt-2">
                Workspace activities will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800/50 hover:border-purple-300 dark:hover:border-purple-600 transition-all"
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      <div className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                        {getActionIcon(log.action)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {log.title}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                        {log.description}
                      </p>

                      {/* User Info */}
                      {log.user && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-700/50">
                          <UserAvatar
                            name={log.user.name}
                            profilePictureUrl={log.user.profilePictureUrl}
                            size="xs"
                          />
                          <span className="text-xs text-gray-600 dark:text-slate-400">
                            {log.user.name}
                          </span>
                        </div>
                      )}

                      {/* Metadata (if needed for debugging) */}
                      {/* <pre className="text-xs text-gray-500 mt-2 overflow-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre> */}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default WorkspaceActivityLog;

