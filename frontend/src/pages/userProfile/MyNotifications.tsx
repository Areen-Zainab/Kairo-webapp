import { useState } from 'react';
import { Bell, Filter, Search, Check, X, Clock, Users, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import Layout from '../../components/Layout';
import { useTheme } from '../../theme/ThemeProvider';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'meeting' | 'task' | 'deadline' | 'system' | 'workspace';
  priority: 'low' | 'medium' | 'high';
  workspace: string;
  isRead: boolean;
  timestamp: Date;
  actionRequired: boolean;
  relatedId?: string;
}

const MyNotifications = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Meeting Reminder',
      message: 'Sprint Planning meeting starts in 15 minutes',
      type: 'meeting',
      priority: 'high',
      workspace: 'Product Team Alpha',
      isRead: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      actionRequired: true,
      relatedId: 'meeting-123',
    },
    {
      id: '2',
      title: 'Task Completed',
      message: 'Mike Chen completed the code review task',
      type: 'task',
      priority: 'medium',
      workspace: 'Design Sprint Team',
      isRead: true,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      actionRequired: false,
      relatedId: 'task-456',
    },
    {
      id: '3',
      title: 'Deadline Approaching',
      message: 'Client presentation deadline is tomorrow',
      type: 'deadline',
      priority: 'high',
      workspace: 'Client Solutions',
      isRead: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
      actionRequired: true,
      relatedId: 'deadline-789',
    },
    {
      id: '4',
      title: 'New Team Member',
      message: 'Sarah Johnson joined the Product Team Alpha workspace',
      type: 'workspace',
      priority: 'low',
      workspace: 'Product Team Alpha',
      isRead: true,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      actionRequired: false,
    },
    {
      id: '5',
      title: 'System Update',
      message: 'Kairo has been updated with new features',
      type: 'system',
      priority: 'low',
      workspace: 'System',
      isRead: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
      actionRequired: false,
    },
  ]);

  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    workspaces: [] as string[],
    types: [] as string[],
    priorities: [] as string[],
    readStatus: 'all' as 'all' | 'read' | 'unread',
  });
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');

  const workspaces = ['Product Team Alpha', 'Design Sprint Team', 'Client Solutions', 'System'];
  const types = ['meeting', 'task', 'deadline', 'system', 'workspace'];
  const priorities = ['low', 'medium', 'high'];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting': return <Calendar size={16} className="text-blue-600" />;
      case 'task': return <CheckCircle size={16} className="text-green-600" />;
      case 'deadline': return <AlertCircle size={16} className="text-red-600" />;
      case 'system': return <Bell size={16} className="text-purple-600" />;
      case 'workspace': return <Users size={16} className="text-cyan-600" />;
      default: return <Bell size={16} className="text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    if (isDarkMode) {
      switch (priority) {
        case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
        default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      }
    } else {
      switch (priority) {
        case 'high': return 'bg-red-100 text-red-700 border-red-300';
        case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
        case 'low': return 'bg-green-100 text-green-700 border-green-300';
        default: return 'bg-gray-100 text-gray-700 border-gray-300';
      }
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const filteredNotifications = notifications
    .filter(notif => {
      if (searchQuery && !notif.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !notif.message.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (filters.workspaces.length > 0 && !filters.workspaces.includes(notif.workspace)) {
        return false;
      }
      
      if (filters.types.length > 0 && !filters.types.includes(notif.type)) {
        return false;
      }
      
      if (filters.priorities.length > 0 && !filters.priorities.includes(notif.priority)) {
        return false;
      }
      
      if (filters.readStatus === 'read' && !notif.isRead) return false;
      if (filters.readStatus === 'unread' && notif.isRead) return false;
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.timestamp.getTime() - a.timestamp.getTime();
        case 'oldest':
          return a.timestamp.getTime() - b.timestamp.getTime();
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        default:
          return 0;
      }
    });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Layout>
      <div className="min-h-screen p-1 sm:p-2 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-600/20 dark:to-indigo-600/20 border border-purple-300 dark:border-purple-500/30">
                  <Bell size={28} className="text-purple-700 dark:text-purple-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white">
                Notifications
              </h1>
                <p className="mt-1 text-sm text-black dark:text-gray-400">
                <span className="font-semibold">{unreadCount} unread</span> • {notifications.length} total
              </p>
            </div>
          </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                  className="px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 font-medium bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:border-gray-700/50"
              >
                <Check size={16} />
                <span className="hidden sm:inline">Mark all as read</span>
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 font-medium ${showFilters ? 'bg-cyan-100 text-cyan-800 border border-cyan-400 dark:bg-cyan-600/20 dark:text-cyan-400 dark:border-cyan-500/30' : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:border-gray-700/50'}`}
            >
              <Filter size={16} />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-lg transition-all bg-white border-2 border-gray-300 text-black placeholder-gray-600 shadow-sm focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 focus:shadow-lg dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-400 dark:focus:bg-gray-800/70 dark:focus:border-cyan-500/50 dark:focus:ring-2 dark:focus:ring-cyan-500/20 focus:outline-none"
            />
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="rounded-lg border p-6 shadow-xl transition-all bg-blue-50 border-blue-200 shadow-2xl dark:bg-gray-900/50 dark:backdrop-blur-sm dark:border-gray-700/50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Workspace Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-300">
                    Workspace
                  </label>
                  <div className="space-y-2.5">
                    {workspaces.map(workspace => (
                      <label key={workspace} className="flex items-center gap-2.5 cursor-pointer group">
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
                          className="rounded border-2 border-gray-300 bg-white text-cyan-700 focus:ring-cyan-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-cyan-500 dark:focus:ring-cyan-500/50"
                        />
                        <span className="text-sm transition-colors text-gray-900 group-hover:text-black dark:text-gray-300 dark:group-hover:text-white">
                          {workspace}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-300">
                    Type
                  </label>
                  <div className="space-y-2.5">
                    {types.map(type => (
                      <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={filters.types.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters(prev => ({
                                ...prev,
                                types: [...prev.types, type]
                              }));
                            } else {
                              setFilters(prev => ({
                                ...prev,
                                types: prev.types.filter(t => t !== type)
                              }));
                            }
                          }}
                          className="rounded border-2 border-gray-300 bg-white text-cyan-700 focus:ring-cyan-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-cyan-500 dark:focus:ring-cyan-500/50"
                        />
                        <span className="text-sm capitalize transition-colors text-gray-900 group-hover:text-black dark:text-gray-300 dark:group-hover:text-white">
                          {type}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-300">
                    Priority
                  </label>
                  <div className="space-y-2.5">
                    {priorities.map(priority => (
                      <label key={priority} className="flex items-center gap-2.5 cursor-pointer group">
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
                          className="rounded border-2 border-gray-300 bg-white text-cyan-700 focus:ring-cyan-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-cyan-500 dark:focus:ring-cyan-500/50"
                        />
                        <span className="text-sm capitalize transition-colors text-gray-900 group-hover:text-black dark:text-gray-300 dark:group-hover:text-white">
                          {priority}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Read Status Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    value={filters.readStatus}
                    onChange={(e) => setFilters(prev => ({ ...prev, readStatus: e.target.value as any }))}
                    className="w-full px-3 py-2.5 rounded-lg transition-all bg-white border-2 border-gray-300 text-gray-900 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 shadow-sm dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:focus:ring-2 dark:focus:ring-cyan-500/50 dark:focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread only</option>
                    <option value="read">Read only</option>
                  </select>
                </div>
              </div>

              {/* Sort Options */}
              <div className={`mt-6 pt-6 border-t ${
                isDarkMode ? 'border-gray-700/50' : 'border-gray-200'
              }`}>
                <label className={`block text-sm font-semibold mb-3 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Sort by
                </label>
                <div className="flex flex-wrap gap-3">
                  {(['newest', 'oldest', 'priority'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSortBy(option)}
                      className={`px-5 py-2.5 rounded-lg font-semibold transition-all ${
                        sortBy === option
                          ? isDarkMode
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white shadow-lg shadow-cyan-500/30'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                          : isDarkMode
                            ? 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50'
                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300'
                      }`}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16 rounded-lg bg-white border border-gray-200 shadow-sm dark:bg-gray-900/50 dark:backdrop-blur-sm dark:border-gray-700/50">
              <Bell size={56} className={`mx-auto mb-4 ${
                isDarkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-400">
                No notifications found
              </h3>
              <p className={isDarkMode ? 'text-gray-500' : 'text-gray-500'}>
                Try adjusting your filters or search query
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-lg border p-5 transition-all bg-blue-50 border-blue-200 hover:shadow-xl dark:bg-gray-800 dark:backdrop-blur-sm dark:border-gray-700 dark:hover:bg-gray-750 dark:hover:border-gray-600 ${!notification.isRead ? 'border-l-4 border-l-cyan-600 dark:border-l-cyan-500 shadow-sm dark:shadow-lg dark:shadow-cyan-500/10' : 'shadow-sm'}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1 p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700/50">
                    {getTypeIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-bold text-base text-gray-900 dark:text-gray-300">
                            {notification.title}
                          </h3>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </span>
                          {notification.actionRequired && (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isDarkMode
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                : 'bg-orange-100 text-orange-700 border border-orange-300'
                            }`}>
                              Action Required
                            </span>
                          )}
                        </div>
                        <p className="text-sm mb-3 text-gray-700 dark:text-gray-300">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium">{notification.workspace}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} />
                            {formatTimestamp(notification.timestamp)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 rounded-lg transition-all hover:bg-blue-100 text-gray-600 hover:text-cyan-700 dark:hover:bg-gray-700/50 dark:text-gray-400 dark:hover:text-cyan-400"
                            title="Mark as read"
                          >
                            <Check size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 rounded-lg transition-all hover:bg-red-100 text-gray-600 hover:text-red-600 dark:hover:bg-red-500/20 dark:text-gray-400 dark:hover:text-red-400"
                          title="Delete notification"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </Layout>
  );
};

export default MyNotifications;