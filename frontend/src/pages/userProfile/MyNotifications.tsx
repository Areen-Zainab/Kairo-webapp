import { useState } from 'react';
import { Bell, Filter, Search, Check, X, Clock, Users, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import Layout from '../../components/Layout';

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
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Meeting Reminder',
      message: 'Sprint Planning meeting starts in 15 minutes',
      type: 'meeting',
      priority: 'high',
      workspace: 'Product Team Alpha',
      isRead: false,
      timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
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
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
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
      case 'meeting': return <Calendar size={16} className="text-blue-400" />;
      case 'task': return <CheckCircle size={16} className="text-green-400" />;
      case 'deadline': return <AlertCircle size={16} className="text-red-400" />;
      case 'system': return <Bell size={16} className="text-purple-400" />;
      case 'workspace': return <Users size={16} className="text-cyan-400" />;
      default: return <Bell size={16} className="text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
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
      // Search filter
      if (searchQuery && !notif.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !notif.message.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Workspace filter
      if (filters.workspaces.length > 0 && !filters.workspaces.includes(notif.workspace)) {
        return false;
      }
      
      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(notif.type)) {
        return false;
      }
      
      // Priority filter
      if (filters.priorities.length > 0 && !filters.priorities.includes(notif.priority)) {
        return false;
      }
      
      // Read status filter
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={24} className="text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Notifications</h1>
              <p className="text-gray-400 mt-1">
                {unreadCount} unread • {notifications.length} total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors flex items-center gap-2"
              >
                <Check size={16} />
                Mark all as read
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors flex items-center gap-2"
            >
              <Filter size={16} />
              Filters
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Workspace Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Workspace</label>
                  <div className="space-y-2">
                    {workspaces.map(workspace => (
                      <label key={workspace} className="flex items-center gap-2">
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
                          className="rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-sm text-gray-300">{workspace}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                  <div className="space-y-2">
                    {types.map(type => (
                      <label key={type} className="flex items-center gap-2">
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
                          className="rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-sm text-gray-300 capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                  <div className="space-y-2">
                    {priorities.map(priority => (
                      <label key={priority} className="flex items-center gap-2">
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
                          className="rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-sm text-gray-300 capitalize">{priority}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Read Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    value={filters.readStatus}
                    onChange={(e) => setFilters(prev => ({ ...prev, readStatus: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value="all">All</option>
                    <option value="unread">Unread only</option>
                    <option value="read">Read only</option>
                  </select>
                </div>
              </div>

              {/* Sort Options */}
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <label className="block text-sm font-medium text-gray-300 mb-2">Sort by</label>
                <div className="flex gap-4">
                  {(['newest', 'oldest', 'priority'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSortBy(option)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        sortBy === option
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white shadow-lg'
                          : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
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
            <div className="text-center py-12">
              <Bell size={48} className="mx-auto text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No notifications found</h3>
              <p className="text-gray-500">Try adjusting your filters or search query</p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-4 transition-all hover:bg-gray-800/50 ${
                  !notification.isRead ? 'border-l-4 border-l-cyan-500' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getTypeIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold ${!notification.isRead ? 'text-white' : 'text-gray-300'}`}>
                            {notification.title}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </span>
                          {notification.actionRequired && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                              Action Required
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mb-2">{notification.message}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{notification.workspace}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatTimestamp(notification.timestamp)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors"
                            title="Mark as read"
                          >
                            <Check size={16} className="text-gray-400" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete notification"
                        >
                          <X size={16} className="text-gray-400 hover:text-red-400" />
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
    </Layout>
  );
};

export default MyNotifications;
