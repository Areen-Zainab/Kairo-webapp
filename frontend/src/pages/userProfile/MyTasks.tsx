import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, Search, CheckSquare, Clock, User, Calendar, Trash2, Check } from 'lucide-react';
import Layout from '../../components/Layout';
import { useUser } from '../../context/UserContext';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  dueDate?: Date;
  workspace: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MyTasks = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useUser();
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    setViewOpacity(0);
    const id = requestAnimationFrame(() => setViewOpacity(1));
    return () => cancelAnimationFrame(id);
  }, [viewMode]);

  // Mock data
  const tasks: Task[] = [
    {
      id: '1',
      title: 'Design new dashboard layout',
      description: 'Create a modern, responsive dashboard layout for the main application',
      status: 'in-progress',
      priority: 'high',
      assignee: 'Sana Khan',
      dueDate: new Date(2024, 9, 18),
      workspace: 'Product Team Alpha',
      tags: ['design', 'ui/ux', 'frontend'],
      createdAt: new Date(2024, 9, 12),
      updatedAt: new Date(2024, 9, 16),
    },
    {
      id: '2',
      title: 'Implement user authentication',
      description: 'Set up secure user authentication with JWT tokens',
      status: 'todo',
      priority: 'high',
      assignee: 'Muhammad Ali',
      dueDate: new Date(2024, 9, 22),
      workspace: 'Product Team Alpha',
      tags: ['backend', 'security', 'auth'],
      createdAt: new Date(2024, 9, 14),
      updatedAt: new Date(2024, 9, 14),
    },
    {
      id: '3',
      title: 'Write API documentation',
      description: 'Document all REST API endpoints with examples',
      status: 'completed',
      priority: 'medium',
      assignee: 'Fatima Sheikh',
      dueDate: new Date(2024, 9, 16),
      workspace: 'Design Sprint Team',
      tags: ['documentation', 'api'],
      createdAt: new Date(2024, 9, 10),
      updatedAt: new Date(2024, 9, 15),
    },
    {
      id: '4',
      title: 'Fix responsive layout issues',
      description: 'Resolve mobile responsiveness problems on the dashboard',
      status: 'todo',
      priority: 'medium',
      assignee: 'Daniyal Ahmed',
      dueDate: new Date(2024, 9, 20),
      workspace: 'Product Team Alpha',
      tags: ['frontend', 'responsive', 'mobile'],
      createdAt: new Date(2024, 9, 13),
      updatedAt: new Date(2024, 9, 13),
    },
    {
      id: '5',
      title: 'Conduct user testing',
      description: 'Organize and conduct user testing sessions for the new features',
      status: 'in-progress',
      priority: 'low',
      assignee: 'Javeria Butt',
      dueDate: new Date(2024, 9, 25),
      workspace: 'Client Solutions',
      tags: ['testing', 'user-research'],
      createdAt: new Date(2024, 9, 11),
      updatedAt: new Date(2024, 9, 16),
    },
  ];

  const workspaces = ['Product Team Alpha', 'Design Sprint Team', 'Client Solutions'];
  const assignees = ['Sana Khan', 'Muhammad Ali', 'Fatima Sheikh', 'Daniyal Ahmed', 'Javeria Butt'];
  const statuses = ['todo', 'in-progress', 'completed'];
  const priorities = ['low', 'medium', 'high'];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-gray-500/20 text-gray-400';
      case 'in-progress': return 'bg-blue-500/20 text-blue-400';
      case 'completed': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const updateTaskStatus = (taskId: string, newStatus: Task['status']) => {
    // In a real app, this would update the backend
    console.log(`Updating task ${taskId} to ${newStatus}`);
  };

  const deleteTask = (taskId: string) => {
    // In a real app, this would delete from the backend
    console.log(`Deleting task ${taskId}`);
  };

  const filteredTasks = tasks
    .filter(task => {
      // Search filter
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !task.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Workspace filter
      if (filters.workspaces.length > 0 && !filters.workspaces.includes(task.workspace)) {
        return false;
      }
      
      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
        return false;
      }
      
      // Priority filter
      if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
        return false;
      }
      
      // Assignee filter
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
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  const tasksByStatus = {
    todo: filteredTasks.filter(task => task.status === 'todo'),
    'in-progress': filteredTasks.filter(task => task.status === 'in-progress'),
    completed: filteredTasks.filter(task => task.status === 'completed'),
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const isOverdue = (dueDate: Date) => {
    return dueDate < new Date() && new Date().toDateString() !== dueDate.toDateString();
  };
  
  const TaskCard = ({ task }: { task: Task }) => (
    <div className="bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600/50 transition-all group shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
            {task.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            {task.description}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => updateTaskStatus(task.id, 'completed')}
            className="p-1 hover:bg-green-100 dark:hover:bg-green-500/20 rounded transition-colors"
            title="Mark as completed"
          >
            <Check size={14} className="text-green-600 dark:text-green-400" />
          </button>
          <button
            onClick={() => deleteTask(task.id)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors"
            title="Delete task"
          >
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(task.priority)}`}>
          {task.priority}
        </span>
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
          {task.status.replace('-', ' ')}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-400">
          <User size={14} />
          <span>{task.assignee}</span>
        </div>
        
        {task.dueDate && (
          <div className={`flex items-center gap-2 text-sm ${
            isOverdue(task.dueDate) ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-400'
          }`}>
            <Calendar size={14} />
            <span>{formatDate(task.dueDate)}</span>
            {isOverdue(task.dueDate) && <span className="text-xs">(Overdue)</span>}
          </div>
        )}
        
        <div className="text-sm text-gray-600 dark:text-gray-500">
          {task.workspace}
        </div>
        
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
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
            <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center gap-2 shadow-md">
              <Plus size={16} />
              Add Task
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
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
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search Bar */}
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

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-white dark:bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700/50 p-6 shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Workspace Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Workspace</label>
                  <div className="space-y-2">
                    {workspaces.map(workspace => (
                      <label key={workspace} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.workspaces.includes(workspace)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                workspaces: [...prev.workspaces, workspace]
                              }));
                            } else {
                              setFilters(prev => ({
                                ...prev,
                                workspaces: prev.workspaces.filter(w => w !== workspace)
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

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  <div className="space-y-2">
                    {statuses.map(status => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.statuses.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                statuses: [...prev.statuses, status]
                              }));
                            } else {
                              setFilters(prev => ({
                                ...prev,
                                statuses: prev.statuses.filter(s => s !== status)
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

                {/* Priority Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                  <div className="space-y-2">
                    {priorities.map(priority => (
                      <label key={priority} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.priorities.includes(priority)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                priorities: [...prev.priorities, priority]
                              }));
                            } else {
                              setFilters(prev => ({
                                ...prev,
                                priorities: prev.priorities.filter(p => p !== priority)
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

                {/* Assignee Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignee</label>
                  <div className="space-y-2">
                    {assignees.map(assignee => (
                      <label key={assignee} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.assignees.includes(assignee)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                assignees: [...prev.assignees, assignee]
                              }));
                            } else {
                              setFilters(prev => ({
                                ...prev,
                                assignees: prev.assignees.filter(a => a !== assignee)
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

              {/* Sort Options */}
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
                      {option.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tasks Display with transition */}
        <div
          className="relative"
          style={{
            opacity: viewOpacity,
            transform: `translateY(${viewOpacity === 1 ? 0 : 8}px)`,
            transition: 'opacity 200ms ease, transform 200ms ease'
          }}
        >
          {viewMode === 'kanban' ? (
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
                      statusTasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                      ))
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
                  <p className="text-gray-400 dark:text-gray-500">Try adjusting your filters or search query</p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div key={task.id} className="bg-white dark:bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700/50 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{task.title}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                            {task.status.replace('-', ' ')}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{task.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <User size={14} />
                            {task.assignee}
                          </span>
                          {task.dueDate && (
                            <span className={`flex items-center gap-1 ${
                              isOverdue(task.dueDate) ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-500'
                            }`}>
                              <Calendar size={14} />
                              {formatDate(task.dueDate)}
                              {isOverdue(task.dueDate) && <span className="text-xs">(Overdue)</span>}
                            </span>
                          )}
                          <span>{task.workspace}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateTaskStatus(task.id, 'completed')}
                          className="p-2 hover:bg-green-100 dark:hover:bg-green-500/20 rounded-lg transition-colors"
                          title="Mark as completed"
                        >
                          <Check size={16} className="text-green-600 dark:text-green-400" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors"
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