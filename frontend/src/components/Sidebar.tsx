import { useState } from 'react';
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
  LayoutGrid // New Icon for General Dashboard
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
  const [activeItem, setActiveItem] = useState('dashboard');
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  const workspaces: Workspace[] = [
    { id: '1', name: 'Product Team Alpha', role: 'Manager', color: 'from-purple-500 to-pink-600', memberCount: 12 },
    { id: '2', name: 'Design Squad', role: 'Member', color: 'from-blue-500 to-cyan-600', memberCount: 8 },
    { id: '3', name: 'Engineering Core', role: 'Lead', color: 'from-green-500 to-emerald-600', memberCount: 15 },
    { id: '4', name: 'Marketing Team', role: 'Member', color: 'from-orange-500 to-red-600', memberCount: 10 },
  ];
  
  const generalMenuItems: MenuItem[] = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard', badge: null },
    { id: 'calendar', icon: Calendar, label: 'My Calendar', badge: null },
    { id: 'all_tasks', icon: CheckSquare, label: 'All My Tasks', badge: '5' },
  ];

  const workspaceMenuItems: MenuItem[] = [
    { id: 'dashboard', icon: Home, label: 'Workspace Dashboard', badge: null },
    { id: 'meetings', icon: Video, label: 'Meetings', badge: '3' },
    { id: 'tasks', icon: CheckSquare, label: 'Task Boards', badge: '12' },
    { id: 'memory', icon: Brain, label: 'Meeting Memory', badge: null },
    { id: 'transcripts', icon: FileText, label: 'Transcripts', badge: null },
    { id: 'analytics', icon: BarChart3, label: 'Analytics', badge: null },
  ];

  const bottomItems: MenuItem[] = [
    { id: 'team', icon: Users, label: 'Team Members', badge: null },
    { id: 'settings', icon: Settings, label: 'Settings', badge: null },
  ];

  const menuItems = viewMode === 'workspace' ? workspaceMenuItems : generalMenuItems;

  const handleWorkspaceChange = (workspace: Workspace) => {
    setShowWorkspaceMenu(false);
    onWorkspaceChange(workspace);
    if (viewMode !== 'workspace') {
      onSetViewMode('workspace');
    }
  };

  return (
    <div 
      className={`h-screen bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Logo Section */}
      <div className="p-6 flex items-center justify-between border-b border-slate-800">
        <button 
          onClick={() => onSetViewMode('general')} 
          className="flex items-center gap-3 text-left hover:bg-slate-800/50 rounded-xl p-2 -m-2 transition-all duration-200 group"
          title="Go to Main Dashboard"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 group-hover:shadow-purple-500/30 group-hover:scale-105 transition-all duration-200">
            <Brain className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold text-white group-hover:text-purple-200 transition-colors">Kairo</h1>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Meeting Intelligence</p>
            </div>
          )}
        </button>
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronLeft className="w-4 h-4 text-slate-400" />}
          </button>
        )}
      </div>

      {/* Workspace Selector */}
      {viewMode === 'workspace' && currentWorkspace && (
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className={`w-full flex items-center gap-3 px-3 py-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all duration-200 border border-slate-700 ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <div className={`w-8 h-8 bg-gradient-to-br ${currentWorkspace.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Building2 className="w-4 h-4 text-white" />
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white truncate">{currentWorkspace.name}</p>
                    <p className="text-xs text-slate-400">{currentWorkspace.role}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showWorkspaceMenu ? 'rotate-90' : ''}`} />
                </>
              )}
            </button>

            {showWorkspaceMenu && !collapsed && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 max-h-80 overflow-y-auto">
                  <button
                    onClick={() => onSetViewMode('general')}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all duration-200"
                  >
                    <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">General Dashboard</p>
                    </div>
                  </button>
                  <div className="h-px bg-slate-700 my-2"></div>
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => handleWorkspaceChange(workspace)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                        currentWorkspace.id === workspace.id ? 'bg-slate-700' : 'hover:bg-slate-700/50'
                      }`}
                    >
                      <div className={`w-8 h-8 bg-gradient-to-br ${workspace.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-white">{workspace.name}</p>
                        <p className="text-xs text-slate-400">{workspace.memberCount} members • {workspace.role}</p>
                      </div>
                      {currentWorkspace.id === workspace.id && <Check className="w-4 h-4 text-green-400" />}
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
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="mb-2">
          {!collapsed && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              {viewMode === 'workspace' ? 'Workspace' : 'Main Menu'}
            </p>
          )}
        </div>
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
              title={collapsed ? item.label : ''}
            >
              <Icon className={`w-5 h-5 ${
                isActive 
                  ? 'text-white' 
                  : 'text-slate-400 group-hover:text-white'
              }`} />
              {!collapsed && (
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

      {/* --- FIX IS HERE --- */}
      {/* Bottom Section (Account) */}
      <div className="p-4 border-t border-slate-800 space-y-1">
        {!collapsed && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Account
          </p>
        )}
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          // The 'return' statement was missing from this block
          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title={collapsed ? item.label : ''}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              {!collapsed && <span className="flex-1 text-left font-medium">{item.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;