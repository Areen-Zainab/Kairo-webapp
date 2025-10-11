import React, { useState } from 'react';
import { Home, Video, Calendar, CheckSquare, BarChart3, Users, Settings, ChevronLeft, ChevronRight, Brain, FileText, Building2, Plus, Check, Search, Bell, LogOut, User, Zap, Clock, TrendingUp, ArrowUpRight, Play, MoreVertical, MessageSquare, Network, Filter, Download, ChevronDown } from 'lucide-react';

const DashboardLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('dashboard');
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [timeFilter, setTimeFilter] = useState('week');

  const userName = "Alex Morgan";
  const userEmail = "alex@company.com";

  const workspaces = [
    { id: '1', name: 'Product Team Alpha', role: 'Manager', color: 'from-purple-500 to-pink-600', memberCount: 12 },
    { id: '2', name: 'Design Squad', role: 'Member', color: 'from-blue-500 to-cyan-600', memberCount: 8 },
    { id: '3', name: 'Engineering Core', role: 'Lead', color: 'from-green-500 to-emerald-600', memberCount: 15 },
    { id: '4', name: 'Marketing Team', role: 'Member', color: 'from-orange-500 to-red-600', memberCount: 10 },
  ];

  const [selectedWorkspace, setSelectedWorkspace] = useState(workspaces[0]);

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard', badge: null },
    { id: 'meetings', icon: Video, label: 'Meetings', badge: '3' },
    { id: 'calendar', icon: Calendar, label: 'Calendar', badge: null },
    { id: 'tasks', icon: CheckSquare, label: 'Task Boards', badge: '12' },
    { id: 'memory', icon: Brain, label: 'Meeting Memory', badge: null },
    { id: 'transcripts', icon: FileText, label: 'Transcripts', badge: null },
    { id: 'analytics', icon: BarChart3, label: 'Analytics', badge: null },
  ];

  const bottomItems = [
    { id: 'team', icon: Users, label: 'Team', badge: null },
    { id: 'settings', icon: Settings, label: 'Settings', badge: null },
  ];

  const notifications = [
    { id: 1, text: "New task assigned: Update API documentation", time: "5m ago", unread: true },
    { id: 2, text: "Meeting 'Sprint Planning' starts in 30 minutes", time: "25m ago", unread: true },
    { id: 3, text: "Summary ready for 'Client Review' meeting", time: "1h ago", unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  const stats = [
    { id: 1, label: 'Total Meetings', value: '24', change: '+12%', icon: Video, color: 'from-blue-500 to-cyan-500' },
    { id: 2, label: 'Active Tasks', value: '18', change: '+8%', icon: CheckSquare, color: 'from-purple-500 to-pink-500' },
    { id: 3, label: 'Completion Rate', value: '87%', change: '+5%', icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
    { id: 4, label: 'Memory Items', value: '156', change: '+23', icon: Brain, color: 'from-orange-500 to-red-500' },
  ];

  const upcomingMeetings = [
    { id: 1, title: 'Sprint Planning', time: '2:00 PM', participants: ['AM', 'JD', 'SK', '+5'], duration: '60 min', status: 'Soon' },
    { id: 2, title: 'Client Demo', time: '4:30 PM', participants: ['AM', 'RK', 'LM'], duration: '45 min', status: 'Scheduled' },
    { id: 3, title: 'Team Standup', time: 'Tomorrow 9:00 AM', participants: ['AM', 'JD', 'SK', 'RK', '+8'], duration: '15 min', status: 'Scheduled' },
  ];

  const recentMeetings = [
    { id: 1, title: 'Product Review Q4', date: 'Oct 10, 2025', tasks: 8, transcriptReady: true, memoryLinks: 3, duration: '1h 20m' },
    { id: 2, title: 'Design Sprint Retro', date: 'Oct 9, 2025', tasks: 5, transcriptReady: true, memoryLinks: 2, duration: '45m' },
    { id: 3, title: 'API Integration Sync', date: 'Oct 8, 2025', tasks: 12, transcriptReady: true, memoryLinks: 5, duration: '1h 05m' },
  ];

  const memoryInsights = [
    { id: 1, topic: 'API v2 Migration', linkedMeetings: 5, lastDiscussed: '2 days ago' },
    { id: 2, topic: 'User Authentication Flow', linkedMeetings: 3, lastDiscussed: '1 week ago' },
    { id: 3, topic: 'Q4 Goals', linkedMeetings: 8, lastDiscussed: '3 days ago' },
  ];

  const activityFeed = [
    { id: 1, type: 'task', text: 'New task assigned from Sprint Planning', time: '5 min ago', user: 'Alex M.' },
    { id: 2, type: 'meeting', text: 'Meeting summary ready: Client Demo', time: '1 hour ago', user: 'System' },
    { id: 3, type: 'memory', text: 'Memory link created between 2 meetings', time: '2 hours ago', user: 'System' },
    { id: 4, type: 'complete', text: 'API Integration Sync completed', time: '3 hours ago', user: 'John D.' },
    { id: 5, type: 'transcript', text: 'Transcript processed for Product Review', time: '4 hours ago', user: 'System' },
  ];

  const handleWorkspaceChange = (workspace: typeof workspaces[0]) => {
    setSelectedWorkspace(workspace);
    setShowWorkspaceMenu(false);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task': return CheckSquare;
      case 'meeting': return Video;
      case 'memory': return Brain;
      case 'transcript': return FileText;
      case 'complete': return TrendingUp;
      default: return MessageSquare;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <div className={`h-screen bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
        {/* Logo */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-white">Kairo</h1>
                <p className="text-xs text-slate-400">Meeting Intelligence</p>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronLeft className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        {/* Workspace Selector */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <button onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)} className={`w-full flex items-center gap-3 px-3 py-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all duration-200 border border-slate-700 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className={`w-8 h-8 bg-gradient-to-br ${selectedWorkspace.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Building2 className="w-4 h-4 text-white" />
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white truncate">{selectedWorkspace.name}</p>
                    <p className="text-xs text-slate-400">{selectedWorkspace.role}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showWorkspaceMenu ? 'rotate-90' : ''}`} />
                </>
              )}
            </button>

            {showWorkspaceMenu && !sidebarCollapsed && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="p-2 max-h-80 overflow-y-auto">
                  {workspaces.map((workspace) => (
                    <button key={workspace.id} onClick={() => handleWorkspaceChange(workspace)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${selectedWorkspace.id === workspace.id ? 'bg-slate-700' : 'hover:bg-slate-700/50'}`}>
                      <div className={`w-8 h-8 bg-gradient-to-br ${workspace.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-white">{workspace.name}</p>
                        <p className="text-xs text-slate-400">{workspace.memberCount} members • {workspace.role}</p>
                      </div>
                      {selectedWorkspace.id === workspace.id && <Check className="w-4 h-4 text-green-400" />}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-slate-700">
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-purple-400 hover:bg-slate-700 rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Create Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Workspace</p>}
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <button key={item.id} onClick={() => setActiveItem(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`} title={sidebarCollapsed ? item.label : ''}>
                <Icon className="w-5 h-5" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left font-medium">{item.label}</span>
                    {item.badge && <span className={`px-2 py-1 text-xs font-bold rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'}`}>{item.badge}</span>}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-slate-800 space-y-1">
          {!sidebarCollapsed && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Account</p>}
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <button key={item.id} onClick={() => setActiveItem(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`} title={sidebarCollapsed ? item.label : ''}>
                <Icon className="w-5 h-5" />
                {!sidebarCollapsed && <span className="flex-1 text-left font-medium">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <nav className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Search meetings, tasks, or transcripts..." className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
            </div>
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-300">{selectedWorkspace.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-200 hover:scale-105">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Meeting</span>
            </button>

            <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors relative group">
              <Zap className="w-5 h-5 text-slate-400 group-hover:text-yellow-400 transition-colors" />
            </button>

            <div className="relative">
              <button onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }} className="p-2 hover:bg-slate-800 rounded-lg transition-colors relative">
                <Bell className="w-5 h-5 text-slate-400" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">{unreadCount}</span>}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="font-semibold text-white">Notifications</h3>
                    <p className="text-xs text-slate-400 mt-1">{unreadCount} unread</p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div key={notif.id} className={`p-4 border-b border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer ${notif.unread ? 'bg-slate-700/30' : ''}`}>
                        <p className="text-sm text-white">{notif.text}</p>
                        <p className="text-xs text-slate-400 mt-1">{notif.time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-xl transition-colors">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center font-semibold text-white text-sm">
                  {userName.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-white">{userName}</p>
                  <p className="text-xs text-slate-400">{userEmail}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {showProfile && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-700">
                    <p className="font-medium text-white">{userName}</p>
                    <p className="text-xs text-slate-400 mt-1">{userEmail}</p>
                  </div>
                  <div className="p-2">
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">
                      <User className="w-4 h-4" />
                      <span className="text-sm">Profile Settings</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-slate-700 rounded-lg transition-colors mt-1">
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 bg-gradient-to-br ${selectedWorkspace.color} rounded-xl flex items-center justify-center`}>
                  <span className="text-white font-bold text-sm">{selectedWorkspace.name.substring(0, 2)}</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">{selectedWorkspace.name}</h1>
                  <p className="text-slate-400">{selectedWorkspace.memberCount} members • {selectedWorkspace.role}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                </select>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.id} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 group cursor-pointer">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
                        <ArrowUpRight className="w-4 h-4" />
                        {stat.change}
                      </span>
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-1">{stat.value}</h3>
                    <p className="text-slate-400 text-sm">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Upcoming Meetings */}
              <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-400" />
                    Upcoming Meetings
                  </h2>
                  <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">View All</button>
                </div>
                <div className="space-y-4">
                  {upcomingMeetings.map((meeting) => (
                    <div key={meeting.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">{meeting.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{meeting.time}</span>
                            <span>{meeting.duration}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {meeting.participants.map((initial, idx) => (
                              <div key={idx} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white ${initial.startsWith('+') ? 'bg-slate-700 text-slate-400' : `bg-gradient-to-br ${selectedWorkspace.color}`}`}>{initial}</div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${meeting.status === 'Soon' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-700 text-slate-300'}`}>{meeting.status}</span>
                          <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Play className="w-4 h-4 text-slate-400" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Memory Insights */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    Memory Insights
                  </h2>
                  <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">View Graph</button>
                </div>
                <div className="space-y-3">
                  {memoryInsights.map((insight) => (
                    <div key={insight.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer">
                      <div className="flex items-start gap-3">
                        <Network className="w-5 h-5 text-purple-400 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">{insight.topic}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{insight.linkedMeetings} meetings</span>
                            <span>•</span>
                            <span>{insight.lastDiscussed}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Meetings */}
              <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" />
                    Recent Meetings & Transcripts
                  </h2>
                  <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">View All</button>
                </div>
                <div className="space-y-3">
                  {recentMeetings.map((meeting) => (
                    <div key={meeting.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">{meeting.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span>{meeting.date}</span>
                            <span>{meeting.duration}</span>
                            <span className="flex items-center gap-1"><CheckSquare className="w-4 h-4" />{meeting.tasks} tasks</span>
                            {meeting.transcriptReady && <span className="flex items-center gap-1 text-green-400"><FileText className="w-4 h-4" />Transcript</span>}
                            {meeting.memoryLinks > 0 && <span className="flex items-center gap-1 text-purple-400"><Brain className="w-4 h-4" />{meeting.memoryLinks} links</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="View Transcript"><FileText className="w-4 h-4 text-slate-400" /></button>
                          <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Download"><Download className="w-4 h-4 text-slate-400" /></button>
                          <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><MoreVertical className="w-4 h-4 text-slate-400" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Feed */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-purple-400" />
                    Activity Feed
                  </h2>
                </div>
                <div className="space-y-4">
                  {activityFeed.map((activity) => {
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${selectedWorkspace.color} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white mb-1">{activity.text}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500">{activity.time}</p>
                            <span className="text-slate-600">•</span>
                            <p className="text-xs text-slate-500">{activity.user}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;