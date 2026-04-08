import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, Search, CheckSquare, Clock, User, Calendar, Trash2, Check, Loader2 } from 'lucide-react';
import Layout from '../../components/Layout';
import { useUser, type UserProfile } from '../../context/UserContext';
import apiService from '../../services/api';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  dueDate?: Date;
  workspace: string;
  workspaceId: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

type WorkspaceBoard = {
  name: string;
  columns: Array<{ id: number; name: string }>;
};

function mapColumnToMyStatus(columnName: string): Task['status'] {
  const lower = columnName.toLowerCase();
  if (lower === 'complete' || lower === 'completed') return 'completed';
  if (lower === 'in-progress') return 'in-progress';
  if (lower === 'review') return 'in-progress';
  return 'todo';
}

function normalizePriority(p: string): Task['priority'] {
  if (p === 'low' || p === 'medium' || p === 'high' || p === 'urgent') return p;
  return 'medium';
}

function assigneeMatchesUser(assignee: string | null | undefined, user: UserProfile): boolean {
  if (!assignee?.trim()) return false;
  const norm = (s: string) => s.trim().toLowerCase();
  const a = norm(assignee);
  if (a === norm(user.email)) return true;
  if (a === norm(user.name)) return true;
  const first = user.name.split(/\s+/)[0];
  if (first && a === norm(first)) return true;
  return false;
}

function findCompletedColumnId(columns: Array<{ id: number; name: string }>): number | undefined {
  const col = columns.find((c) => {
    const n = c.name.toLowerCase();
    return n === 'complete' || n === 'completed';
  });
  return col?.id;
}

function mapToMyTask(
  backend: {
    id: number;
    title: string;
    description?: string | null;
    assignee?: string | null;
    dueDate?: string | null;
    priority: string;
    createdAt: string;
    updatedAt: string;
  },
  columnName: string,
  workspaceName: string,
  workspaceId: number
): Task {
  return {
    id: String(backend.id),
    title: backend.title,
    description: backend.description || '',
    status: mapColumnToMyStatus(columnName),
    priority: normalizePriority(backend.priority),
    assignee: backend.assignee?.trim() || 'Unassigned',
    dueDate: backend.dueDate ? new Date(backend.dueDate) : undefined,
    workspace: workspaceName,
    workspaceId,
    tags: [],
    createdAt: new Date(backend.createdAt),
    updatedAt: new Date(backend.updatedAt),
  };
}

const MyTasks = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user, workspaces } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workspaceBoards, setWorkspaceBoards] = useState<Record<number, WorkspaceBoard>>({});
  const [tasksLoading, setTasksLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    workspaces: [] as string[],
    statuses: [] as string[],
    priorities: [] as string[],
    assignees: [] as string[],
  });
  const [sortBy, setSortBy] = useState<'due-date' | 'priority' | 'created' | 'title'>('due-date');
  const [viewOpacity, setViewOpacity] = useState(1);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    setViewOpacity(0);
    const id = requestAnimationFrame(() => setViewOpacity(1));
    return () => cancelAnimationFrame(id);
  }, [viewMode]);

  const loadTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setWorkspaceBoards({});
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);
    setFetchError(null);

    try {
      const results = await Promise.all(
        workspaces.map((ws) =>
          apiService.getKanbanColumns(ws.id).then((r) => ({ ws, r }))
        )
      );

      const boards: Record<number, WorkspaceBoard> = {};
      const list: Task[] = [];
      const errors: string[] = [];

      for (const { ws, r } of results) {
        if (r.error) {
          errors.push(`${ws.name}: ${r.error}`);
          continue;
        }
        if (!r.data?.columns) continue;

        boards[ws.id] = {
          name: ws.name,
          columns: r.data.columns.map((c) => ({ id: c.id, name: c.name })),
        };

        for (const col of r.data.columns) {
          for (const t of col.tasks) {
            if (!assigneeMatchesUser(t.assignee, user)) continue;
            list.push(mapToMyTask(t, col.name, ws.name, ws.id));
          }
        }
      }

      setWorkspaceBoards(boards);
      setTasks(list);
      if (errors.length > 0) {
        setFetchError(errors.slice(0, 3).join(' · ') + (errors.length > 3 ? '…' : ''));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load tasks';
      setFetchError(message);
      setTasks([]);
      setWorkspaceBoards({});
    } finally {
      setTasksLoading(false);
    }
  }, [user, workspaces]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      void loadTasks();
    }
  }, [authLoading, isAuthenticated, user, loadTasks]);

  const workspaceNames = useMemo(() => workspaces.map((w) => w.name), [workspaces]);

  const assignees = useMemo(() => {
    const names = tasks.map((t) => t.assignee).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [tasks]);

  const statuses = ['todo', 'in-progress', 'completed'];
  const priorities = ['low', 'medium', 'high', 'urgent'];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo':
        return 'bg-gray-500/20 text-gray-400';
      case 'in-progress':
        return 'bg-blue-500/20 text-blue-400';
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    if (newStatus !== 'completed') return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const board = workspaceBoards[task.workspaceId];
    const doneColId = board ? findCompletedColumnId(board.columns) : undefined;
    if (!doneColId) {
      setActionError('No Completed column found in this task’s workspace. Rename a column to “Complete” or use the workspace task board.');
      return;
    }

    setActionError(null);
    setMutatingId(taskId);
    try {
      const res = await apiService.moveTask(parseInt(taskId, 10), doneColId);
      if (res.error) {
        setActionError(res.error);
        return;
      }
      await loadTasks();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Could not update task');
    } finally {
      setMutatingId(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;

    setActionError(null);
    setMutatingId(taskId);
    try {
      const res = await apiService.deleteTask(parseInt(taskId, 10));
      if (res.error) {
        setActionError(res.error);
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Could not delete task');
    } finally {
      setMutatingId(null);
    }
  };

  const filteredTasks = tasks
    .filter((task) => {
      if (
        searchQuery &&
        !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.description.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      if (filters.workspaces.length > 0 && !filters.workspaces.includes(task.workspace)) {
        return false;
      }

      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
        return false;
      }

      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
        return false;
      }

      if (filters.assignees.length > 0 && !filters.assignees.includes(task.assignee)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'due-date':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.getTime() - b.dueDate.getTime();
        case 'priority': {
          const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0);
        }
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  const tasksByStatus = {
    todo: filteredTasks.filter((task) => task.status === 'todo'),
    'in-progress': filteredTasks.filter((task) => task.status === 'in-progress'),
    completed: filteredTasks.filter((task) => task.status === 'completed'),
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const isOverdue = (dueDate: Date) => {
    return dueDate < new Date() && new Date().toDateString() !== dueDate.toDateString();
  };

  const handleAddTask = () => {
    const ws = workspaces[0];
    if (ws) {
      navigate(`/workspace/${ws.id}/tasks`);
    }
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const busy = mutatingId === task.id;
    return (
      <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600/50 transition-all group shadow-sm hover:shadow-md">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
              {task.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{task.description}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.status !== 'completed' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void updateTaskStatus(task.id, 'completed')}
                className="p-1 hover:bg-green-100 dark:hover:bg-green-500/20 rounded transition-colors disabled:opacity-50"
                title="Mark as completed"
              >
                {busy ? <Loader2 size={14} className="animate-spin text-green-600 dark:text-green-400" /> : <Check size={14} className="text-green-600 dark:text-green-400" />}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteTask(task.id)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
              title="Delete task"
            >
              <Trash2 size={14} className="text-red-600 dark:text-red-400" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(task.priority)}`}>{task.priority}</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>{task.status.replace('-', ' ')}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-400">
            <User size={14} />
            <span>{task.assignee}</span>
          </div>

          {task.dueDate && (
            <div
              className={`flex items-center gap-2 text-sm ${
                isOverdue(task.dueDate) ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-400'
              }`}
            >
              <Calendar size={14} />
              <span>{formatDate(task.dueDate)}</span>
              {isOverdue(task.dueDate) && <span className="text-xs">(Overdue)</span>}
            </div>
          )}

          <div className="text-sm text-gray-600 dark:text-gray-500">{task.workspace}</div>

          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.tags.map((tag, index) => (
                <span key={index} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-xs rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const showInitialSpinner = authLoading || (isAuthenticated && tasksLoading && tasks.length === 0 && !fetchError);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">My Tasks</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your tasks and track progress</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-white dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2 border border-gray-200 dark:border-transparent shadow-sm"
            >
              <Filter size={16} />
              Filters
            </button>
            <button
              type="button"
              onClick={handleAddTask}
              disabled={workspaces.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center gap-2 shadow-md disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus size={16} />
              Add Task
            </button>
          </div>
        </div>

        {actionError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{actionError}</div>
        )}
        {fetchError && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{fetchError}</div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white dark:bg-gray-900/50 backdrop-blur-sm rounded-lg p-1 flex border border-gray-200 dark:border-transparent shadow-sm">
              {(['kanban', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                    viewMode === mode
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white shadow-lg'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {mode === 'kanban' ? <CheckSquare size={16} /> : <Clock size={16} />}
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            {tasksLoading && <Loader2 size={16} className="animate-spin" />}
            <span>
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 shadow-sm"
            />
          </div>

          {showFilters && (
            <div className="bg-white dark:bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700/50 p-6 shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Workspace</label>
                  <div className="space-y-2">
                    {workspaceNames.map((workspace) => (
                      <label key={workspace} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.workspaces.includes(workspace)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters((prev) => ({
                                ...prev,
                                workspaces: [...prev.workspaces, workspace],
                              }));
                            } else {
                              setFilters((prev) => ({
                                ...prev,
                                workspaces: prev.workspaces.filter((w) => w !== workspace),
                              }));
                            }
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{workspace}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  <div className="space-y-2">
                    {statuses.map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.statuses.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters((prev) => ({
                                ...prev,
                                statuses: [...prev.statuses, status],
                              }));
                            } else {
                              setFilters((prev) => ({
                                ...prev,
                                statuses: prev.statuses.filter((s) => s !== status),
                              }));
                            }
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{status.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                  <div className="space-y-2">
                    {priorities.map((priority) => (
                      <label key={priority} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.priorities.includes(priority)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters((prev) => ({
                                ...prev,
                                priorities: [...prev.priorities, priority],
                              }));
                            } else {
                              setFilters((prev) => ({
                                ...prev,
                                priorities: prev.priorities.filter((p) => p !== priority),
                              }));
                            }
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{priority}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignee</label>
                  <div className="space-y-2">
                    {assignees.map((assignee) => (
                      <label key={assignee} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.assignees.includes(assignee)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters((prev) => ({
                                ...prev,
                                assignees: [...prev.assignees, assignee],
                              }));
                            } else {
                              setFilters((prev) => ({
                                ...prev,
                                assignees: prev.assignees.filter((a) => a !== assignee),
                              }));
                            }
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{assignee}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700/50">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sort by</label>
                <div className="flex gap-4 flex-wrap">
                  {(['due-date', 'priority', 'created', 'title'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSortBy(option)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        sortBy === option
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white shadow-lg'
                          : 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-transparent'
                      }`}
                    >
                      {option.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className="relative"
          style={{
            opacity: viewOpacity,
            transform: `translateY(${viewOpacity === 1 ? 0 : 8}px)`,
            transition: 'opacity 200ms ease, transform 200ms ease',
          }}
        >
          {showInitialSpinner ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500 dark:text-gray-400 gap-3">
              <Loader2 size={40} className="animate-spin" />
              <p>Loading your tasks…</p>
            </div>
          ) : workspaces.length === 0 && !authLoading ? (
            <div className="text-center py-12">
              <CheckSquare size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">No workspaces yet</h3>
              <p className="text-gray-400 dark:text-gray-500">Join or create a workspace to see tasks assigned to you.</p>
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
                <div key={status} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                      {status.replace('-', ' ')} ({statusTasks.length})
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {statusTasks.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                        <CheckSquare size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No tasks</p>
                      </div>
                    ) : (
                      statusTasks.map((task) => <TaskCard key={task.id} task={task} />)
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckSquare size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">No tasks found</h3>
                  <p className="text-gray-400 dark:text-gray-500">
                    {tasks.length === 0
                      ? 'No tasks are assigned to you in your workspaces yet.'
                      : 'Try adjusting your filters or search query.'}
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700/50 p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{task.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>{task.status.replace('-', ' ')}</span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{task.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <User size={14} />
                            {task.assignee}
                          </span>
                          {task.dueDate && (
                            <span
                              className={`flex items-center gap-1 ${
                                isOverdue(task.dueDate) ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-500'
                              }`}
                            >
                              <Calendar size={14} />
                              {formatDate(task.dueDate)}
                              {isOverdue(task.dueDate) && <span className="text-xs">(Overdue)</span>}
                            </span>
                          )}
                          <span>{task.workspace}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.status !== 'completed' && (
                          <button
                            type="button"
                            disabled={mutatingId === task.id}
                            onClick={() => void updateTaskStatus(task.id, 'completed')}
                            className="p-2 hover:bg-green-100 dark:hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Mark as completed"
                          >
                            {mutatingId === task.id ? (
                              <Loader2 size={16} className="animate-spin text-green-600 dark:text-green-400" />
                            ) : (
                              <Check size={16} className="text-green-600 dark:text-green-400" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={mutatingId === task.id}
                          onClick={() => void deleteTask(task.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete task"
                        >
                          <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MyTasks;
