import { useState } from 'react';
import { Plus, Users, Calendar, BarChart3, FileText, ChevronRight, Search, Mail, Bell, Settings, LogOut, User, Clock, CheckSquare, TrendingUp, X, Home, Video, Brain, Building2, ChevronLeft, Check } from 'lucide-react';

const DashboardLayout = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('dashboard');
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  
  const user = {
    name: 'Alex Johnson',
    email: 'alex@company.com',
    avatar: 'AJ'
  };

  const sidebarWorkspaces = [
    { id: '1', name: 'Product Team Alpha', role: 'Manager', color: 'from-purple-500 to-pink-600', memberCount: 12 },
    { id: '2', name: 'Design Squad', role: 'Member', color: 'from-blue-500 to-cyan-600', memberCount: 8 },
    { id: '3', name: 'Engineering Core', role: 'Lead', color: 'from-green-500 to-emerald-600', memberCount: 15 },
  ];

  const [selectedWorkspace, setSelectedWorkspace] = useState(sidebarWorkspaces[0]);

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

  const workspaces = [
    {
      id: 1,
      name: 'Product Team Alpha',
      role: 'Manager',
      members: 12,
      meetings: 24,
      pendingTasks: 8,
      gradient: 'from-blue-500 to-cyan-500',
      lastActive: '2 hours ago',
    },
    {
      id: 2,
      name: 'Design Sprint Team',
      role: 'Developer',
      members: 6,
      meetings: 15,
      pendingTasks: 3,
      gradient: 'from-purple-500 to-pink-500',
      lastActive: '1 day ago',
    },
    {
      id: 3,
      name: 'Client Solutions',
      role: 'QA Engineer',
      members: 8,
      meetings: 31,
      pendingTasks: 12,
      gradient: 'from-green-500 to-teal-500',
      lastActive: '3 days ago',
    }
  ];

  const notifications = [
    { id: 1, text: 'New task assigned in Product Team', time: '5m ago', unread: true },
    { id: 2, text: 'Meeting starts in 30 minutes', time: '10m ago', unread: true },
    { id: 3, text: 'Sprint retrospective completed', time: '2h ago', unread: false }
  ];

  const filteredWorkspaces = workspaces.filter(ws =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleWorkspaceChange = (workspace: typeof sidebarWorkspaces[0]) => {
    setSelectedWorkspace(workspace);
    setShowWorkspaceMenu(false);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Sidebar */}
      <div 
        className={`h-screen bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300 fixed left-0 top-0 z-30 ${
          sidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Logo Section */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <button 
            onClick={() => {
              // Scroll to top of the page
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 text-left hover:bg-slate-800/50 rounded-xl p-2 -m-2 transition-all duration-200 group"
            title="Go to Top"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-purple-500/30 group-hover:scale-105 transition-all duration-200">
              <Brain className="w-6 h-6 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-white group-hover:text-purple-200 transition-colors">Kairo</h1>
                <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Meeting Intelligence</p>
              </div>
            )}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>

        {/* Workspace Selector */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className={`w-full flex items-center gap-3 px-3 py-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all duration-200 border border-slate-700 ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
            >
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
                  <button
                    onClick={() => {
                      setActiveItem('dashboard');
                      setShowWorkspaceMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 hover:bg-slate-700/50 border-b border-slate-700 mb-2"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Home className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-white">All Workspaces</p>
                      <p className="text-xs text-slate-400">View all your workspaces</p>
                    </div>
                  </button>

                  {sidebarWorkspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => handleWorkspaceChange(workspace)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                        selectedWorkspace.id === workspace.id ? 'bg-slate-700' : 'hover:bg-slate-700/50'
                      }`}
                    >
                      <div className={`w-8 h-8 bg-gradient-to-br ${workspace.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-white">{workspace.name}</p>
                        <p className="text-xs text-slate-400">{workspace.memberCount} members • {workspace.role}</p>
                      </div>
                      {selectedWorkspace.id === workspace.id && (
                        <Check className="w-4 h-4 text-green-400" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-slate-700">
                  <button 
                    onClick={() => {
                      setShowCreateModal(true);
                      setShowWorkspaceMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-purple-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Create Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              Workspace
            </p>
          )}
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <Icon className="w-5 h-5" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left font-medium">{item.label}</span>
                    {item.badge && (
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-slate-800 space-y-1">
          {!sidebarCollapsed && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              Account
            </p>
          )}
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <Icon className="w-5 h-5" />
                {!sidebarCollapsed && <span className="flex-1 text-left font-medium">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Wrapper */}
      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-72'}`}>
        {/* Top Navigation */}
        <nav className="fixed top-0 right-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50" style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}>
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="relative w-96 hidden lg:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Search workspaces, meetings, tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                <Calendar size={20} className="text-slate-400" />
              </button>
              
              <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors relative">
                <Bell size={20} className="text-slate-400" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-cyan-500 rounded-full"></span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                    {user.avatar}
                  </div>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-700">
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-sm text-slate-400">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700 rounded-lg transition-colors text-left">
                        <User size={18} className="text-slate-400" />
                        <span>Profile Settings</span>
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700 rounded-lg transition-colors text-left">
                        <Settings size={18} className="text-slate-400" />
                        <span>Preferences</span>
                      </button>
                      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors text-left">
                        <LogOut size={18} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Main Dashboard Content */}
        <div className="pt-20 pr-0 lg:pr-80">
          <div className="p-6 lg:p-8">
            {/* Hero Section */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-cyan-100 to-blue-200 bg-clip-text text-transparent">
                Welcome back, {user.name.split(' ')[0]} 👋
              </h1>
              <p className="text-slate-400 text-lg">Manage your workspaces and stay on top of your meetings</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <button
                onClick={() => setShowCreateModal(true)}
                className="group relative overflow-hidden p-6 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl hover:border-cyan-400/50 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-shadow">
                    <Plus size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-semibold mb-1">Create Workspace</h3>
                    <p className="text-slate-400 text-sm">Start a new collaborative space</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setShowJoinModal(true)}
                className="group relative overflow-hidden p-6 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 rounded-2xl hover:border-purple-400/50 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-shadow">
                    <Mail size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-semibold mb-1">Join Workspace</h3>
                    <p className="text-slate-400 text-sm">Use an invitation code</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Workspaces Section */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <span>Your Workspaces</span>
                <span className="px-3 py-1 bg-slate-800 rounded-full text-sm text-slate-400">
                  {filteredWorkspaces.length}
                </span>
              </h2>

              {filteredWorkspaces.length === 0 ? (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 text-center border border-slate-700/50">
                  <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users size={40} className="text-slate-500" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Workspaces Found</h3>
                  <p className="text-slate-400 mb-6">Create a new workspace or join an existing one</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredWorkspaces.map((workspace) => (
                    <div
                      key={workspace.id}
                      className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 bg-gradient-to-br ${workspace.gradient} rounded-xl flex items-center justify-center text-2xl font-bold shadow-lg`}>
                            {workspace.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold mb-1">{workspace.name}</h3>
                            <div className="flex items-center gap-3 text-sm text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {workspace.lastActive}
                              </span>
                              <span>•</span>
                              <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">{workspace.role}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
                            Open
                          </button>
                          <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors">
                            Manage
                          </button>
                          <button className="px-4 py-2 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 rounded-lg font-medium transition-all">
                            Leave
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Users size={16} className="text-cyan-400" />
                            <span className="text-xs text-slate-400">Members</span>
                          </div>
                          <p className="text-xl font-bold">{workspace.members}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar size={16} className="text-blue-400" />
                            <span className="text-xs text-slate-400">Meetings</span>
                          </div>
                          <p className="text-xl font-bold">{workspace.meetings}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckSquare size={16} className="text-green-400" />
                            <span className="text-xs text-slate-400">Tasks</span>
                          </div>
                          <p className="text-xl font-bold">{workspace.pendingTasks}</p>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp size={16} className="text-purple-400" />
                            <span className="text-xs text-slate-400">Analytics</span>
                          </div>
                          <p className="text-xl font-bold">→</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
      <div className="hidden lg:block fixed right-0 top-20 bottom-0 w-80 bg-slate-900/50 backdrop-blur-xl border-l border-slate-800/50 p-6 overflow-y-auto no-scrollbar">

          {/* Mini Calendar */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Calendar</h3>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">October 2025</h4>
                <div className="flex gap-1">
                  <button className="p-1 hover:bg-slate-700 rounded">
                    <ChevronLeft size={16} />
                  </button>
                  <button className="p-1 hover:bg-slate-700 rounded">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-xs text-slate-500 p-1">{day}</div>
                ))}
                {Array.from({ length: 31 }, (_, i) => (
                  <button
                    key={i}
                    className={`p-1 text-sm rounded hover:bg-slate-700 ${i === 10 ? 'bg-cyan-500 font-bold' : ''}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Notifications</h3>
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl border transition-colors ${
                    notif.unread ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  <p className="text-sm mb-1">{notif.text}</p>
                  <p className="text-xs text-slate-500">{notif.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 transition-colors text-left">
                <Calendar size={18} className="text-cyan-400" />
                <span className="text-sm">Schedule Meeting</span>
              </button>
              <button className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 transition-colors text-left">
                <CheckSquare size={18} className="text-green-400" />
                <span className="text-sm">Create Task</span>
              </button>
              <button className="w-full flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/50 transition-colors text-left">
                <BarChart3 size={18} className="text-purple-400" />
                <span className="text-sm">View Analytics</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Create Workspace</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Product Team Alpha"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Your Role
                </label>
                <select className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500">
                  <option>Manager</option>
                  <option>Developer</option>
                  <option>Designer</option>
                  <option>QA Engineer</option>
                  <option>Product Owner</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Workspace Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Join Workspace</h2>
              <button
                onClick={() => setShowJoinModal(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Invitation Code
                </label>
                <input
                  type="text"
                  placeholder="ALPHA-2025-XYZ"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <p className="text-sm text-purple-200">
                  <strong>Tip:</strong> Ask your team admin for an invitation code
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;