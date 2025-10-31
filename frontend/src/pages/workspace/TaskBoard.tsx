import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, User, Columns, List as ListIcon, Calendar } from 'lucide-react';
import type { Task, TaskView, TaskScope, TaskFilter, TaskSort, TaskStatus, TaskPriority } from '../../components/workspace/taskboard/types';
import KanbanBoard from '../../components/workspace/taskboard/KanbanBoard';
import ListView from '../../components/workspace/taskboard/ListView';
import CalendarView from '../../components/workspace/taskboard/CalendarView';
import TaskFilters from '../../components/workspace/taskboard/TaskFilters';
import TaskDetailModal from '../../modals/taskboard/TaskDetailModal';
import Layout from '../../components/Layout';
import { useUser } from '../../context/UserContext';

// Mock data - in a real app, this would come from an API
const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Implement user authentication system',
    description: 'Create a comprehensive authentication system with JWT tokens, password hashing, and role-based access control.',
    status: 'in-progress',
    priority: 'high',
    assignees: [
      { id: '1', name: 'Areeba Riaz', email: 'areeba@example.com', avatar: 'AR', role: 'admin' },
      { id: '2', name: 'Fatima Khan', email: 'fatima@example.com', avatar: 'FK', role: 'member' }
    ],
    project: { id: '1', name: 'Core Platform', color: '#3B82F6' },
    tags: [
      { id: '1', name: 'backend', color: '#10B981' },
      { id: '2', name: 'security', color: '#F59E0B' }
    ],
    dueDate: '2024-10-18',
    createdAt: '2024-10-10T00:00:00Z',
    updatedAt: '2024-10-15T00:00:00Z',
    createdBy: { id: '1', name: 'Areeba Riaz', email: 'areeba@example.com', avatar: 'AR', role: 'admin' },
    meetingContext: {
      meetingId: 'meeting-1',
      meetingTitle: 'Sprint Planning - Week 1',
      transcriptSnippet: 'We need to prioritize the authentication system for the MVP release.',
      decisions: ['Use JWT for token management', 'Implement bcrypt for password hashing'],
      notes: ['Consider OAuth integration later', 'Add rate limiting for login attempts']
    },
    estimatedHours: 40,
    actualHours: 25,
    isOverdue: false
  },
  {
    id: '2',
    title: 'Design mobile responsive layout',
    description: 'Create responsive design for mobile devices with proper touch interactions and optimized performance.',
    status: 'todo',
    priority: 'medium',
    assignees: [
      { id: '3', name: 'Ahmed Ali', email: 'ahmed@example.com', avatar: 'AA', role: 'member' }
    ],
    project: { id: '2', name: 'UI/UX', color: '#8B5CF6' },
    tags: [
      { id: '3', name: 'frontend', color: '#06B6D4' },
      { id: '4', name: 'mobile', color: '#F97316' }
    ],
    dueDate: '2024-10-22',
    createdAt: '2024-10-12T00:00:00Z',
    updatedAt: '2024-10-12T00:00:00Z',
    createdBy: { id: '2', name: 'Fatima Khan', email: 'fatima@example.com', avatar: 'FK', role: 'member' },
    estimatedHours: 24,
    isOverdue: false
  },
  {
    id: '3',
    title: 'Fix critical security vulnerability',
    description: 'Address SQL injection vulnerability in user input validation.',
    status: 'todo',
    priority: 'urgent',
    assignees: [
      { id: '1', name: 'Areeba Riaz', email: 'areeba@example.com', avatar: 'AR', role: 'admin' }
    ],
    project: { id: '1', name: 'Core Platform', color: '#3B82F6' },
    tags: [
      { id: '2', name: 'security', color: '#F59E0B' },
      { id: '5', name: 'bugfix', color: '#EF4444' }
    ],
    dueDate: '2024-10-16',
    createdAt: '2024-10-14T00:00:00Z',
    updatedAt: '2024-10-14T00:00:00Z',
    createdBy: { id: '1', name: 'Areeba Riaz', email: 'areeba@example.com', avatar: 'AR', role: 'admin' },
    estimatedHours: 8,
    actualHours: 6,
    isOverdue: true
  },
  {
    id: '4',
    title: 'Write API documentation',
    description: 'Create comprehensive API documentation with examples and integration guides.',
    status: 'review',
    priority: 'low',
    assignees: [
      { id: '4', name: 'Zara Sheikh', email: 'zara@example.com', avatar: 'ZS', role: 'member' }
    ],
    project: { id: '3', name: 'Documentation', color: '#10B981' },
    tags: [
      { id: '6', name: 'documentation', color: '#6366F1' }
    ],
    dueDate: '2024-10-25',
    createdAt: '2024-10-13T00:00:00Z',
    updatedAt: '2024-10-16T00:00:00Z',
    createdBy: { id: '4', name: 'Zara Sheikh', email: 'zara@example.com', avatar: 'ZS', role: 'member' },
    estimatedHours: 16,
    actualHours: 18,
    isOverdue: false
  },
  {
    id: '5',
    title: 'Setup CI/CD pipeline',
    description: 'Configure automated testing and deployment pipeline for the project.',
    status: 'done',
    priority: 'medium',
    assignees: [
      { id: '1', name: 'Areeba Riaz', email: 'areeba@example.com', avatar: 'AR', role: 'admin' },
      { id: '2', name: 'Fatima Khan', email: 'fatima@example.com', avatar: 'FK', role: 'member' }
    ],
    project: { id: '1', name: 'Core Platform', color: '#3B82F6' },
    tags: [
      { id: '7', name: 'devops', color: '#84CC16' },
      { id: '8', name: 'automation', color: '#F59E0B' }
    ],
    dueDate: '2024-10-15',
    createdAt: '2024-10-08T00:00:00Z',
    updatedAt: '2024-10-15T00:00:00Z',
    createdBy: { id: '1', name: 'Areeba Riaz', email: 'areeba@example.com', avatar: 'AR', role: 'admin' },
    estimatedHours: 20,
    actualHours: 22,
    isOverdue: false
  }
];

const mockAssignees = [
  { id: '1', name: 'Areeba Riaz', avatar: 'AR' },
  { id: '2', name: 'Fatima Khan', avatar: 'FK' },
  { id: '3', name: 'Ahmed Ali', avatar: 'AA' },
  { id: '4', name: 'Zara Sheikh', avatar: 'ZS' }
];

const mockProjects = [
  { id: '1', name: 'Core Platform', color: '#3B82F6' },
  { id: '2', name: 'UI/UX', color: '#8B5CF6' },
  { id: '3', name: 'Documentation', color: '#10B981' }
];

const mockTags = [
  { id: '1', name: 'backend', color: '#10B981' },
  { id: '2', name: 'security', color: '#F59E0B' },
  { id: '3', name: 'frontend', color: '#06B6D4' },
  { id: '4', name: 'mobile', color: '#F97316' },
  { id: '5', name: 'bugfix', color: '#EF4444' },
  { id: '6', name: 'documentation', color: '#6366F1' },
  { id: '7', name: 'devops', color: '#84CC16' },
  { id: '8', name: 'automation', color: '#F59E0B' }
];

const TaskBoard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useUser();
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [view, setView] = useState<TaskView>('kanban');
  const [scope, setScope] = useState<TaskScope>('global');
  const [filters, setFilters] = useState<TaskFilter>({});
  const [sort, setSort] = useState<TaskSort>({ field: 'dueDate', direction: 'asc' });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply scope filter
    if (scope === 'personal') {
      // In a real app, this would filter by current user
      filtered = filtered.filter(task => 
        task.assignees.some(assignee => assignee.id === '1') // Mock current user ID
      );
    }

    // Apply other filters
    if (filters.assignee) {
      filtered = filtered.filter(task =>
        task.assignees.some(assignee => assignee.id === filters.assignee)
      );
    }

    if (filters.priority) {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }

    if (filters.status) {
      filtered = filtered.filter(task => task.status === filters.status);
    }

    if (filters.project) {
      filtered = filtered.filter(task => task.project.id === filters.project);
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(task =>
        task.tags.some(tag => filters.tags!.includes(tag.id))
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.assignees.some(assignee => 
          assignee.name.toLowerCase().includes(searchLower)
        )
      );
    }

    if (filters.dueDate) {
      filtered = filtered.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        const startDate = filters.dueDate?.start ? new Date(filters.dueDate.start) : null;
        const endDate = filters.dueDate?.end ? new Date(filters.dueDate.end) : null;
        
        if (startDate && taskDate < startDate) return false;
        if (endDate && taskDate > endDate) return false;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
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
          comparison = priorityOrder[b.priority as keyof typeof priorityOrder] - 
                      priorityOrder[a.priority as keyof typeof priorityOrder];
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      
      return sort.direction === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [tasks, scope, filters, sort]);

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
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, status: newStatus, updatedAt: new Date().toISOString() }
          : task
      )
    );
  };

  const handleTaskPriorityChange = (taskId: string, newPriority: TaskPriority) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? { ...task, priority: newPriority, updatedAt: new Date().toISOString() }
          : task
      )
    );
  };

  const handleTaskMove = (taskId: string, _fromStatus: TaskStatus, toStatus: TaskStatus) => {
    handleTaskStatusChange(taskId, toStatus);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

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
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="rounded-lg p-3 sm:p-4 md:p-5 transition-all duration-200 bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
              <div className="flex items-center">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400">Total Tasks</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 sm:p-4 md:p-5 transition-all duration-200 bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
              <div className="flex items-center">
                <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400">Completed</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 sm:p-4 md:p-5 transition-all duration-200 bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
              <div className="flex items-center">
                <div className="p-2 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400">In Progress</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.inProgress}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg p-3 sm:p-4 md:p-5 transition-all duration-200 bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
              <div className="flex items-center">
                <div className="p-2 bg-gradient-to-br from-rose-500 to-red-500 rounded-lg">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3 sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400">Overdue</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.overdue}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <TaskFilters
          filters={filters}
          sort={sort}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onClearFilters={handleClearFilters}
          assignees={mockAssignees}
          projects={mockProjects}
          tags={mockTags}
        />

        {/* Task Board Content */}
        <div className="mb-8">
          {view === 'kanban' && (
            <KanbanBoard
              tasks={filteredTasks}
              onTaskClick={handleTaskClick}
              onTaskStatusChange={handleTaskStatusChange}
              onTaskMove={handleTaskMove}
            />
          )}
          
          {view === 'list' && (
            <ListView
              tasks={filteredTasks}
              onTaskClick={handleTaskClick}
              onTaskStatusChange={handleTaskStatusChange}
              sortBy={sort.field}
              sortDirection={sort.direction}
            />
          )}
          
          {view === 'calendar' && (
            <CalendarView
              tasks={filteredTasks}
              onTaskClick={handleTaskClick}
            />
          )}
        </div>

        {/* Task Detail Modal */}
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleTaskStatusChange}
          onPriorityChange={handleTaskPriorityChange}
        />
      </div>
    </Layout>
  );
};

export default TaskBoard;
