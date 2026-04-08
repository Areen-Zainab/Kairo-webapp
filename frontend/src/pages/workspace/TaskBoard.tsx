import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Globe, User, Columns, List as ListIcon, Calendar, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { Task, TaskView, TaskScope, TaskStatus, TaskPriority } from '../../components/workspace/taskboard/types';
import KanbanBoard from '../../components/workspace/taskboard/KanbanBoard';
import ListView from '../../components/workspace/taskboard/ListView';
import CalendarView from '../../components/workspace/taskboard/CalendarView';
import TaskFiltersComponent, { type TaskFilters as TaskFiltersType } from '../../components/workspace/taskboard/TaskFilters';
import TaskDetailModal from '../../modals/taskboard/TaskDetailModal';
import CreateTaskModal, { type TaskFormData } from '../../modals/taskboard/CreateTaskModal';
import Layout from '../../components/Layout';
import { useUser } from '../../context/UserContext';
import apiService, { type Tag } from '../../services/api';

// Helper function to map backend column names to frontend task statuses
const mapColumnToStatus = (columnName: string): TaskStatus => {
  const lowerName = columnName.toLowerCase();
  if (lowerName === 'to-do') return 'todo';
  if (lowerName === 'in-progress') return 'in-progress';
  if (lowerName === 'complete' || lowerName === 'completed') return 'done';
  if (lowerName === 'review') return 'review';
  // For custom columns, default to todo
  return 'todo';
};

// Helper to map backend task to frontend format
const mapBackendTask = (backendTask: any, columnName: string): Task => {
  // Generate initials for assignee avatar
  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const assigneeName = backendTask.assignee || 'Unassigned';
  
  // Extract tags from TaskTag structure
  const taskTags = backendTask.tags ? backendTask.tags.map((taskTag: any) => taskTag.tag || taskTag) : [];
  
  return {
    id: String(backendTask.id),
    title: backendTask.title,
    description: backendTask.description || '',
    status: mapColumnToStatus(columnName),
    priority: backendTask.priority as TaskPriority,
    assignees: backendTask.assignee ? [{
      id: String(backendTask.id),
      name: assigneeName,
      email: assigneeName,
      avatar: getInitials(assigneeName),
      role: 'member'
    }] : [],
    assignee: backendTask.assignee,
    // Only include project if task was created from a meeting action item
    ...(backendTask.actionItem?.meeting && {
      project: {
        id: String(backendTask.actionItem.meeting.id),
        name: backendTask.actionItem.meeting.title,
        color: '#3B82F6'
      }
    }),
    tags: taskTags,
    dueDate: backendTask.dueDate,
    createdAt: backendTask.createdAt,
    updatedAt: backendTask.updatedAt,
    createdBy: { id: '1', name: 'System', email: 'system', avatar: 'SY', role: 'admin' },
    meetingContext: backendTask.actionItem?.meeting ? {
      meetingId: String(backendTask.actionItem.meeting.id),
      meetingTitle: backendTask.actionItem.meeting.title,
      transcriptSnippet: backendTask.description || '',
      decisions: [],
      notes: []
    } : undefined,
    isOverdue: backendTask.dueDate ? new Date(backendTask.dueDate) < new Date() && mapColumnToStatus(columnName) !== 'done' : false
  };
};

const TaskBoard: React.FC = () => {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user, isAuthenticated, loading: userLoading, workspaces } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<Array<{ id: number; name: string; email: string; profilePictureUrl?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<TaskView>('kanban');
  const [scope, setScope] = useState<TaskScope>('global');
  const [filters, setFilters] = useState<TaskFiltersType>({
    assignee: null,
    tags: [],
    priority: null,
    dueDateRange: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  
  // Add task modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [selectedColumnForTask, setSelectedColumnForTask] = useState<{ id: number; name: string } | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Delete column confirmation
  const [columnToDelete, setColumnToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeletingColumn, setIsDeletingColumn] = useState(false);

  // Check if user is workspace owner or admin
  const workspaceRole = workspaceId 
    ? workspaces.find((ws: any) => String(ws.id) === workspaceId)?.role 
    : null;
  const canManageColumns = workspaceRole === 'owner' || workspaceRole === 'admin';

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, userLoading, navigate]);

  // Fetch tasks and columns from backend
  const fetchData = async () => {
    if (!workspaceId) {
      setError('No workspace selected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch columns, tags, and workspace members in parallel
      const [columnsResponse, tagsResponse, membersResponse] = await Promise.all([
        apiService.getKanbanColumns(parseInt(workspaceId)),
        apiService.getTags(parseInt(workspaceId)),
        apiService.searchWorkspaceMembers(parseInt(workspaceId), '')
      ]);
      
      if (columnsResponse.error) {
        setError(columnsResponse.error);
        setTasks([]);
        setColumns([]);
      } else if (columnsResponse.data?.columns) {
        // Store columns
        setColumns(columnsResponse.data.columns);
        
        // Convert backend columns/tasks to frontend format
        const allTasks: Task[] = [];
        
        columnsResponse.data.columns.forEach(column => {
          column.tasks.forEach(task => {
            allTasks.push(mapBackendTask(task, column.name));
          });
        });
        
        setTasks(allTasks);
      }

      // Store tags
      if (tagsResponse.data?.tags) {
        setTags(tagsResponse.data.tags);
      }

      // Store workspace members
      if (membersResponse.data?.allMembers) {
        setWorkspaceMembers(membersResponse.data.allMembers.map((m: any) => ({
          id: m.userId ?? m.id,
          name: m.user?.name ?? m.name ?? m.email,
          email: m.user?.email ?? m.email,
          profilePictureUrl: m.user?.profilePictureUrl ?? m.profilePictureUrl,
        })));
      }
    } catch (err: any) {
      console.error('Failed to fetch tasks:', err);
      setError(err.message || 'Failed to load tasks');
      setTasks([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId && !userLoading) {
      fetchData();
    }
  }, [workspaceId, userLoading]);

  // Handle adding new column
  const handleAddColumn = async () => {
    if (!newColumnName.trim() || !workspaceId) return;

    try {
      setIsAddingColumn(true);
      const response = await apiService.createKanbanColumn(parseInt(workspaceId), newColumnName.trim());
      
      if (response.error) {
        alert(response.error);
      } else {
        // Refresh data
        await fetchData();
        setShowAddColumnModal(false);
        setNewColumnName('');
      }
    } catch (err: any) {
      console.error('Failed to add column:', err);
      alert(err.message || 'Failed to add column');
    } finally {
      setIsAddingColumn(false);
    }
  };

  // Handle adding new task
  const handleAddTask = (columnId: number, columnName: string) => {
    setSelectedColumnForTask({ id: columnId, name: columnName });
    setShowAddTaskModal(true);
  };

  const handleCreateTask = async (taskData: TaskFormData) => {
    if (!taskData.title.trim() || !workspaceId || !selectedColumnForTask) return;

    try {
      setIsCreatingTask(true);
      const response = await apiService.createTask(parseInt(workspaceId), {
        columnId: selectedColumnForTask.id,
        title: taskData.title.trim(),
        description: taskData.description.trim() || undefined,
        assignee: taskData.assignee.trim() || undefined,
        dueDate: taskData.dueDate || undefined,
        priority: taskData.priority
      });
      
      if (response.error) {
        alert(response.error);
      } else if (response.data?.task) {
        // Assign tags to the task
        const taskId = response.data.task.id;
        if (taskData.tags.length > 0) {
          await Promise.all(
            taskData.tags.map(tag =>
              apiService.assignTagToTask(taskId, tag.id)
            )
          );
        }

        // Refresh data
        await fetchData();
        // Close modal
        setShowAddTaskModal(false);
        setSelectedColumnForTask(null);
      }
    } catch (err: any) {
      console.error('Failed to create task:', err);
      alert(err.message || 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Handle deleting column
  const handleDeleteColumn = (columnId: number, columnName: string) => {
    setColumnToDelete({ id: columnId, name: columnName });
  };

  const confirmDeleteColumn = async () => {
    if (!columnToDelete) return;

    try {
      setIsDeletingColumn(true);
      const response = await apiService.deleteKanbanColumn(columnToDelete.id, true);
      
      if (response.error) {
        alert(response.error);
      } else {
        // Refresh data
        await fetchData();
        setColumnToDelete(null);
      }
    } catch (err: any) {
      console.error('Failed to delete column:', err);
      alert(err.message || 'Failed to delete column');
    } finally {
      setIsDeletingColumn(false);
    }
  };

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Personal scope: only show tasks assigned to current user
    if (scope === 'personal') {
      const meName = user?.name?.trim().toLowerCase();
      const meEmail = user?.email?.trim().toLowerCase();

      filtered = filtered.filter(task => {
        const assigneeRaw = task.assignee?.trim();
        if (!assigneeRaw) return false;
        const assignee = assigneeRaw.toLowerCase();

        // Handle common formats: "name", "email", "Name <email>"
        const matchesName = !!meName && assignee.includes(meName);
        const matchesEmail = !!meEmail && assignee.includes(meEmail);
        return matchesName || matchesEmail;
      });
    }

    // Filter by assignee
    if (filters.assignee) {
      filtered = filtered.filter(task => task.assignee === filters.assignee);
    }

    // Filter by priority
    if (filters.priority) {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(task =>
        task.tags && task.tags.some((tag: any) => {
          const tagObj = tag.tag || tag;
          return filters.tags.includes(tagObj.id);
        })
      );
    }

    // Filter by due date range
    if (filters.dueDateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      const monthEnd = new Date(today);
      monthEnd.setDate(today.getDate() + 30);

      filtered = filtered.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);

        switch (filters.dueDateRange) {
          case 'overdue':
            return taskDate < today && task.status !== 'done';
          case 'today':
            return taskDate.toDateString() === today.toDateString();
          case 'week':
            return taskDate >= today && taskDate <= weekEnd;
          case 'month':
            return taskDate >= today && taskDate <= monthEnd;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'dueDate':
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority as keyof typeof priorityOrder] - 
                      priorityOrder[b.priority as keyof typeof priorityOrder];
          break;
      }
      
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [tasks, filters, scope, user?.name, user?.email]);

  // Update overdue status
  useEffect(() => {
    setTasks(prevTasks => 
      prevTasks.map(task => ({
        ...task,
        isOverdue: task.dueDate ? 
          new Date(task.dueDate) < new Date() && task.status !== 'done' : 
          false
      }))
    );
  }, []);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, status: newStatus, updatedAt: new Date().toISOString() }
          : task
      )
    );

    // Keep selected task in sync so the modal UI updates immediately.
    setSelectedTask(prev => (prev && prev.id === taskId)
      ? { ...prev, status: newStatus, updatedAt: new Date().toISOString() }
      : prev
    );

    // Persist to backend by moving the task to the target kanban column.
    // Backend ignores `columnId` in PATCH /tasks/:taskId (not an allowed field),
    // so we must use POST /tasks/:taskId/move with a real columnId.
    const targetColumn = columns.find(col => mapColumnToStatus(col.name) === newStatus);
    if (!targetColumn?.id) return;

    apiService
      .moveTask(parseInt(taskId), targetColumn.id)
      .catch(() => {});
  };

  const handleTaskPriorityChange = (taskId: string, newPriority: TaskPriority) => {
    // Optimistic update
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, priority: newPriority, updatedAt: new Date().toISOString() }
          : task
      )
    );
    // Persist to backend
    apiService.updateTask(parseInt(taskId), { priority: newPriority }).catch(() => {});
  };

  /** Called by TaskDetailModal after a field is saved — syncs local task state */
  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
    // Also keep selectedTask in sync so the modal reflects the change immediately
    setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, ...updates } : prev);
  };

  const handleTaskMove = (taskId: string, _fromStatus: TaskStatus, toStatus: TaskStatus) => {
    handleTaskStatusChange(taskId, toStatus);
  };

  // Get unique assignees from tasks
  const availableAssignees = useMemo(() => {
    const assignees = tasks
      .map(task => task.assignee)
      .filter((assignee): assignee is string => !!assignee);
    return Array.from(new Set(assignees));
  }, [tasks]);

  const getTaskStats = () => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(task => task.status === 'done').length;
    const inProgress = filteredTasks.filter(task => task.status === 'in-progress').length;
    const overdue = filteredTasks.filter(task => task.isOverdue).length;
    
    return { total, completed, inProgress, overdue };
  };

  const stats = getTaskStats();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          {/* Title Section */}
          <div className="flex items-center gap-3 min-w-0 mb-4">
            <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TB</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Task Board</h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400">Manage and track all your workspace tasks</p>
            </div>
          </div>

          {/* View and scope controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-6">
            {/* Scope toggle */}
            <div className="flex rounded-lg p-1 bg-white border border-gray-300 dark:bg-slate-800/50 dark:border-slate-700/50">
              <button
                onClick={() => setScope('global')}
                className={`px-2 sm:px-3 md:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/40 flex items-center gap-1.5 ${
                  scope === 'global'
                    ? 'bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Global View"
              >
                <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden md:inline">Global View</span>
              </button>
              <button
                onClick={() => setScope('personal')}
                className={`px-2 sm:px-3 md:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/40 flex items-center gap-1.5 ${
                  scope === 'personal'
                    ? 'bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Personal View"
              >
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden md:inline">Personal View</span>
              </button>
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg p-1 bg-white border border-gray-300 dark:bg-slate-800/50 dark:border-slate-700/50">
              <button
                onClick={() => setView('kanban')}
                className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/40 flex items-center gap-1.5 ${
                  view === 'kanban'
                    ? 'bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Kanban View"
              >
                <Columns className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/40 flex items-center gap-1.5 ${
                  view === 'list'
                    ? 'bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/40 flex items-center gap-1.5 ${
                  view === 'calendar'
                    ? 'bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border border-gray-300 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Calendar View"
              >
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Calendar</span>
              </button>
            </div>

            {/* Add Column + Filters (right side: Add Column immediately left of Filters) */}
            <div className="ml-auto flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {canManageColumns && view === 'kanban' && !loading && (
                <button
                  onClick={() => setShowAddColumnModal(true)}
                  className="px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/40 flex items-center gap-2 shadow-sm"
                  title="Add Column"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Column</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
              <TaskFiltersComponent
                filters={filters}
                onFiltersChange={setFilters}
                availableTags={tags}
                availableAssignees={availableAssignees}
              />
            </div>
          </div>

          {/* Stats — compact */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <div className="rounded-lg p-2 sm:p-2.5 transition-all duration-200 bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-md shrink-0">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-gray-600 dark:text-slate-400 leading-tight">Total Tasks</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight tabular-nums">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-2 sm:p-2.5 transition-all duration-200 bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-md shrink-0">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-gray-600 dark:text-slate-400 leading-tight">Completed</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight tabular-nums">{stats.completed}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-2 sm:p-2.5 transition-all duration-200 bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-md shrink-0">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-gray-600 dark:text-slate-400 leading-tight">In Progress</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight tabular-nums">{stats.inProgress}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-2 sm:p-2.5 transition-all duration-200 bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-rose-500 to-red-500 rounded-md shrink-0">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-gray-600 dark:text-slate-400 leading-tight">Overdue</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight tabular-nums">{stats.overdue}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Task Board Content */}
        <div className="mb-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                <p className="text-gray-600 dark:text-slate-400">Loading tasks...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : columns.length === 0 ? (
            <div className="bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700 rounded-lg p-12 text-center">
              <div className="text-gray-400 dark:text-slate-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No columns yet</h3>
              <p className="text-gray-600 dark:text-slate-400 mb-4">
                Setting up your task board... Please refresh if columns don't appear.
              </p>
            </div>
          ) : (
            <>
              {view === 'kanban' && (
                <KanbanBoard
                  tasks={filteredTasks}
                  columns={columns}
                  onTaskClick={handleTaskClick}
                  onTaskStatusChange={handleTaskStatusChange}
                  onTaskMove={handleTaskMove}
                  onAddTask={handleAddTask}
                  onDeleteColumn={handleDeleteColumn}
                  canManageColumns={canManageColumns}
                />
              )}
              
              {view === 'list' && (
                <>
                  {tasks.length === 0 ? (
                    <div className="bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700 rounded-lg p-12 text-center">
                      <div className="text-gray-400 dark:text-slate-500 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No tasks yet</h3>
                      <p className="text-gray-600 dark:text-slate-400 mb-4">
                        Tasks will appear here after meetings with confirmed action items are completed.
                      </p>
                    </div>
                  ) : (
                    <ListView
                      tasks={filteredTasks}
                      onTaskClick={handleTaskClick}
                      onTaskStatusChange={handleTaskStatusChange}
                      sortBy={filters.sortBy}
                      sortDirection={filters.sortOrder}
                    />
                  )}
                </>
              )}
              
              {view === 'calendar' && (
                <>
                  {tasks.length === 0 ? (
                    <div className="bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700 rounded-lg p-12 text-center">
                      <div className="text-gray-400 dark:text-slate-500 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No tasks yet</h3>
                      <p className="text-gray-600 dark:text-slate-400 mb-4">
                        Tasks will appear here after meetings with confirmed action items are completed.
                      </p>
                    </div>
                  ) : (
                    <CalendarView
                      tasks={filteredTasks}
                      onTaskClick={handleTaskClick}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Task Detail Modal */}
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleTaskStatusChange}
          onPriorityChange={handleTaskPriorityChange}
          onTaskUpdate={handleTaskUpdate}
          workspaceTags={tags.map((t: any) => ({ id: String(t.id), name: t.name, color: t.color }))}
          workspaceId={workspaceId ? parseInt(workspaceId) : undefined}
          workspaceMembers={workspaceMembers}
        />

        {/* Add Column Modal */}
        {showAddColumnModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Add New Column
              </h3>
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Column name (e.g., In Review, Blocked)"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAddingColumn) {
                    handleAddColumn();
                  }
                }}
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddColumnModal(false);
                    setNewColumnName('');
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  disabled={isAddingColumn}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddColumn}
                  disabled={!newColumnName.trim() || isAddingColumn}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAddingColumn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Column
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        <CreateTaskModal
          isOpen={showAddTaskModal && !!selectedColumnForTask}
          onClose={() => {
            setShowAddTaskModal(false);
            setSelectedColumnForTask(null);
          }}
          onSubmit={handleCreateTask}
          columnName={selectedColumnForTask?.name || ''}
          workspaceId={parseInt(workspaceId!)}
          isSubmitting={isCreatingTask}
        />

        {/* Delete Column Confirmation Modal */}
        {columnToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Delete Column?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Are you sure you want to delete the "<span className="font-semibold">{columnToDelete.name}</span>" column? 
                    Any tasks in this column will be moved to "To-Do".
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setColumnToDelete(null)}
                  className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  disabled={isDeletingColumn}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteColumn}
                  disabled={isDeletingColumn}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeletingColumn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Column
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TaskBoard;
