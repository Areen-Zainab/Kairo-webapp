import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Video, 
  Calendar, 
  CheckSquare, 
  BarChart3, 
  Users, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Brain, 
  FileText, 
  Building2, 
  Plus, 
  Check,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  role: string;
  color: string;
  memberCount: number;
}

interface MenuItem {
  id: string;
  icon: any;
  label: string;
  badge: string | null;
  path: string;
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  viewMode: 'general' | 'workspace';
  onSetViewMode: (mode: 'general' | 'workspace') => void;
  currentWorkspace?: Workspace;
  onWorkspaceChange: (workspace: Workspace) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed = false, 
  onToggle,
  viewMode,
  onSetViewMode,
  currentWorkspace,
  onWorkspaceChange 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  // Auto-detect view mode based on URL path
  useEffect(() => {
    if (location.pathname.startsWith('/workspace')) {
      if (viewMode !== 'workspace') {
        onSetViewMode('workspace');
      }
    } else {
      if (viewMode !== 'general') {
        onSetViewMode('general');
      }
    }
  }, [location.pathname, viewMode, onSetViewMode]);

  const workspaces: Workspace[] = [
    { id: '1', name: 'Product Team Alpha', role: 'Manager', color: 'from-purple-500 to-blue-500', memberCount: 12 },
    { id: '2', name: 'Design Squad', role: 'Member', color: 'from-blue-500 to-cyan-500', memberCount: 8 },
    { id: '3', name: 'Engineering Core', role: 'Lead', color: 'from-green-500 to-emerald-500', memberCount: 15 },
    { id: '4', name: 'Marketing Team', role: 'Member', color: 'from-orange-500 to-pink-500', memberCount: 10 },
  ];
  
  const generalMenuItems: MenuItem[] = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard', badge: null, path: '/dashboard' },
    { id: 'calendar', icon: Calendar, label: 'My Calendar', badge: null, path: '/calendar' },
    { id: 'all_tasks', icon: CheckSquare, label: 'All My Tasks', badge: '5', path: '/tasks' },
  ];

  const workspaceMenuItems: MenuItem[] = [
    { id: 'workspace-home', icon: Home, label: 'Overview', badge: null, path: '/workspace' },
    { id: 'meetings', icon: Video, label: 'Meetings', badge: '3', path: '/workspace/meetings' },
    { id: 'tasks', icon: CheckSquare, label: 'Task Boards', badge: '12', path: '/workspace/tasks' },
    { id: 'memory', icon: Brain, label: 'Meeting Memory', badge: null, path: '/workspace/memory' },
    { id: 'transcripts', icon: FileText, label: 'Transcripts', badge: null, path: '/workspace/transcripts' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics', badge: null, path: '/workspace/analytics' },
  ];

  const workspaceBottomItems: MenuItem[] = [
    { id: 'team', icon: Users, label: 'Team Members', badge: null, path: '/workspace/team' },
    { id: 'workspace-settings', icon: Settings, label: 'Workspace Settings', badge: null, path: '/workspace/settings' },
  ];

  const generalBottomItems: MenuItem[] = [
    { id: 'settings', icon: Settings, label: 'Account Settings', badge: null, path: '/profile-settings' },
  ];

  const menuItems = viewMode === 'workspace' ? workspaceMenuItems : generalMenuItems;
  const bottomItems = viewMode === 'workspace' ? workspaceBottomItems : generalBottomItems;

  const isActiveItem = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleWorkspaceChange = (workspace: Workspace) => {
    setShowWorkspaceMenu(false);
    onWorkspaceChange(workspace);
    if (viewMode !== 'workspace') {
      onSetViewMode('workspace');
    }
    navigate('/workspace');
  };

  const handleMenuClick = (item: MenuItem) => {
    navigate(item.path);
  };

  return (
    <div className="fixed left-0 top-0 h-screen flex z-40">
      <div 
        className={`h-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-white/5 flex flex-col transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Logo Section */}
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          {collapsed ? (
            <button
              onClick={onToggle}
              className="w-full flex items-center justify-center p-2 hover:bg-white/10 rounded-xl transition-all duration-200 group"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-all duration-200">
                  <ChevronRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>
          ) : (
            <>
              <button 
                onClick={() => {
                  onSetViewMode('general');
                  navigate('/dashboard');
                }} 
                className="flex bg-transparent items-center gap-3 text-left hover:bg-white/5 rounded-xl p-2 -m-2 transition-all duration-200 group"
                title="Go to Main Dashboard"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-105 transition-all duration-200">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">Kairo</h1>
                  <p className="text-xs text-slate-500">Meeting Intelligence</p>
                </div>
              </button>
              {onToggle && (
                <button
                  onClick={onToggle}
                  className="p-2 hover:bg-white/5 rounded-lg transition-all duration-200 group"
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Workspace Selector */}
        <div className="px-4 pb-4 pt-4">
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className={`w-full flex items-center gap-3 px-3 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-200 border border-white/10 group ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              {viewMode === 'general' ? (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg blur-sm opacity-50"></div>
                    <div className="relative w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <LayoutGrid className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                  {!collapsed && (
                    <>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-white truncate">General Dashboard</p>
                        <p className="text-xs text-slate-400">Personal view</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showWorkspaceMenu ? 'rotate-90' : ''}`} />
                    </>
                  )}
                </>
              ) : currentWorkspace ? (
                <>
                  <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-br ${currentWorkspace.color} rounded-lg blur-sm opacity-50`}></div>
                    <div className={`relative w-8 h-8 bg-gradient-to-br ${currentWorkspace.color} rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  {!collapsed && (
                    <>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-white truncate">{currentWorkspace.name}</p>
                        <p className="text-xs text-slate-400">{currentWorkspace.role} • {currentWorkspace.memberCount} members</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showWorkspaceMenu ? 'rotate-90' : ''}`} />
                    </>
                  )}
                </>
              ) : null}
            </button>

            {showWorkspaceMenu && !collapsed && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="p-2 max-h-80 overflow-y-auto space-y-1">
                  <button
                    onClick={() => {
                      onSetViewMode('general');
                      setShowWorkspaceMenu(false);
                      navigate('/dashboard');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                      viewMode === 'general' 
                        ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30' 
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <LayoutGrid className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-white">General Dashboard</p>
                      <p className="text-xs text-slate-400">Personal view</p>
                    </div>
                    {viewMode === 'general' && <Check className="w-4 h-4 text-purple-400" />}
                  </button>
                  
                  <div className="h-px bg-white/10 my-2"></div>
                  
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Workspaces</p>
                  
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => handleWorkspaceChange(workspace)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                        currentWorkspace?.id === workspace.id && viewMode === 'workspace'
                          ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className={`w-8 h-8 bg-gradient-to-br ${workspace.color} rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-white truncate">{workspace.name}</p>
                        <p className="text-xs text-slate-400">{workspace.memberCount} members • {workspace.role}</p>
                      </div>
                      {currentWorkspace?.id === workspace.id && viewMode === 'workspace' && (
                        <Check className="w-4 h-4 text-purple-400" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-white/10 bg-white/5">
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-purple-400 hover:bg-white/5 rounded-lg transition-colors group">
                    <div className="w-8 h-8 bg-purple-500/10 group-hover:bg-purple-500/20 rounded-lg flex items-center justify-center transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">Create Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <div className="mb-3">
            {!collapsed && (
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                {viewMode === 'workspace' ? 'Workspace' : 'Personal'}
              </p>
            )}
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveItem(item.path);
            
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
                title={collapsed ? item.label : ''}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl blur opacity-50"></div>
                )}
                <Icon className={`relative w-5 h-5 ${
                  isActive 
                    ? 'text-white' 
                    : 'text-slate-400 group-hover:text-white'
                }`} />
                {!collapsed && (
                  <>
                    <span className="relative flex-1 text-left font-medium text-sm">{item.label}</span>
                    {item.badge && (
                      <span className={`relative px-2 py-0.5 text-xs font-bold rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
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
        <div className="p-4 border-t border-white/5 space-y-1">
          {!collapsed && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              {viewMode === 'workspace' ? 'Workspace' : 'Account'}
            </p>
          )}
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveItem(item.path);
            
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
                title={collapsed ? item.label : ''}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl blur opacity-50"></div>
                )}
                <Icon className={`relative w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                {!collapsed && <span className="relative flex-1 text-left font-medium text-sm">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        nav::-webkit-scrollbar {
          width: 4px;
        }
        nav::-webkit-scrollbar-track {
          background: transparent;
        }
        nav::-webkit-scrollbar-thumb {
          background: rgb(51 65 85);
          border-radius: 2px;
        }
        nav::-webkit-scrollbar-thumb:hover {
          background: rgb(71 85 105);
        }
      `}</style>
    </div>
  );
};

export default Sidebar;