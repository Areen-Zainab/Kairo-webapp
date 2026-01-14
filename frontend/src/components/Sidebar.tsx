import { useState, useEffect, useRef } from 'react';
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
  Archive,
} from 'lucide-react';
import CreateWorkspaceModal from '../modals/workspace/CreateWorkspace';
import { useUser } from '../context/UserContext';
import { apiService } from '../services/api';

interface CurrentWorkspace {
  id: string;
  name: string;
  role: string;
  colorTheme?: string;
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
  currentWorkspace?: CurrentWorkspace | null;
  onWorkspaceChange: (workspace: CurrentWorkspace) => void;
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
  const { user, workspaces, pendingInvites, acceptInvite, rejectInvite, showArchivedWorkspaces, setShowArchivedWorkspaces } = useUser();
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  const [upcomingMeetingsCount, setUpcomingMeetingsCount] = useState<number>(0);

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      const saved = localStorage.getItem('theme');
      setTheme((saved as 'light' | 'dark') || 'dark');
    };

    // Check for theme changes
    const interval = setInterval(handleThemeChange, 100);
    return () => clearInterval(interval);
  }, []);

  // Close workspace menu when clicking outside
  useEffect(() => {
    if (!showWorkspaceMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setShowWorkspaceMenu(false);
      }
    };

    // Add listener on next tick to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWorkspaceMenu]);

  const isDark = theme === 'dark';
  
  // Show dummy workspaces for demo account (areeba@kairo.com)
  const shouldShowDummyData = user?.email?.toLowerCase() === 'areeba@kairo.com';

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

  // Fetch upcoming meetings count when workspace changes
  useEffect(() => {
    const fetchUpcomingMeetingsCount = async () => {
      if (!currentWorkspace || shouldShowDummyData) {
        setUpcomingMeetingsCount(shouldShowDummyData ? 3 : 0);
        return;
      }

      try {
        const response = await apiService.getUpcomingMeetings(parseInt(currentWorkspace.id));
        if (response.data?.meetings) {
          setUpcomingMeetingsCount(response.data.meetings.length);
        } else {
          setUpcomingMeetingsCount(0);
        }
      } catch (error) {
        console.error('Error fetching upcoming meetings count:', error);
        setUpcomingMeetingsCount(0);
      }
    };

    fetchUpcomingMeetingsCount();
  }, [currentWorkspace, shouldShowDummyData]);

  const colors = ['#9333ea', '#3b82f6', '#10b981', '#f97316'];
  
  const demoWorkspaces = shouldShowDummyData ? [
    { id: 1, name: 'Product Team Alpha', role: 'Manager', colorTheme: '#9333ea', memberCount: 12 },
    { id: 2, name: 'Design Squad', role: 'Member', colorTheme: '#3b82f6', memberCount: 8 },
    { id: 3, name: 'Engineering Core', role: 'Lead', colorTheme: '#10b981', memberCount: 15 },
    { id: 4, name: 'Marketing Team', role: 'Member', colorTheme: '#f97316', memberCount: 10 },
  ] : [];

  const sidebarWorkspaces = shouldShowDummyData ? demoWorkspaces : workspaces.map((ws, index) => ({
    id: ws.id.toString(),
    name: ws.name,
    role: ws.role || 'Member',
    colorTheme: ws.colorTheme || colors[index % colors.length],
    memberCount: ws.memberCount,
    isArchived: ws.isArchived,
  }));
  
  const generalMenuItems: MenuItem[] = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard', badge: null, path: '/dashboard' },
    { id: 'calendar', icon: Calendar, label: 'My Calendar', badge: null, path: '/calendar' },
    { id: 'all_tasks', icon: CheckSquare, label: 'All My Tasks', badge: '5', path: '/tasks' },
  ];

  const workspaceMenuItems: MenuItem[] = [
    { id: 'workspace-home', icon: Home, label: 'Overview', badge: null, path: '/workspace' },
    { id: 'meetings', icon: Video, label: 'Meetings', badge: upcomingMeetingsCount > 0 ? String(upcomingMeetingsCount) : null, path: '/workspace/meetings' },
    { id: 'tasks', icon: CheckSquare, label: 'Task Boards', badge: '12', path: '/workspace/tasks' },
    { id: 'memory', icon: Brain, label: 'Meeting Memory', badge: null, path: '/workspace/memory' },
    { id: 'transcripts', icon: FileText, label: 'Transcripts', badge: null, path: '/workspace/transcripts' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics', badge: null, path: '/workspace/analytics' },
  ];

  const workspaceBottomItems: MenuItem[] = [
    { id: 'team', icon: Users, label: 'Team Members', badge: null, path: '/workspace/team-members' },
    { id: 'workspace-settings', icon: Settings, label: 'Workspace Settings', badge: null, path: '/workspace/settings' },
  ];

  const generalBottomItems: MenuItem[] = [
    { id: 'settings', icon: Settings, label: 'Account Settings', badge: null, path: '/profile-settings' },
  ];

  const menuItems = viewMode === 'workspace' ? workspaceMenuItems : generalMenuItems;
  const bottomItems = viewMode === 'workspace' ? workspaceBottomItems : generalBottomItems;

  const isActiveItem = (path: string) => {
    // Handle workspace routes with dynamic ID
    if (path.startsWith('/workspace')) {
      if (!currentWorkspace) return false;
      
      const workspaceId = typeof currentWorkspace.id === 'string' ? currentWorkspace.id : String(currentWorkspace.id);
      
      // For workspace home/overview (/workspace)
      if (path === '/workspace') {
        // Only highlight if exactly on the workspace main page
        return location.pathname === `/workspace/${workspaceId}` || location.pathname === `/workspace/${workspaceId}/`;
      }
      
      // For other workspace routes, construct full path
      const fullPath = path.replace('/workspace', `/workspace/${workspaceId}`);
      return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
    }
    
    // Handle general routes
    if (path === '/dashboard') {
      return location.pathname === path || location.pathname === path + '/';
    }
    
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleWorkspaceChange = (workspace: CurrentWorkspace) => {
    setShowWorkspaceMenu(false);
    onWorkspaceChange(workspace);
    if (viewMode !== 'workspace') {
      onSetViewMode('workspace');
    }
    // Navigate to workspace with ID
    const workspaceId = typeof workspace.id === 'string' ? workspace.id : String(workspace.id);
    navigate(`/workspace/${workspaceId}`);
  };

  const handleMenuClick = (item: MenuItem) => {
    // If there's a current workspace, include it in the path
    if (currentWorkspace && item.path.startsWith('/workspace')) {
      const workspaceId = typeof currentWorkspace.id === 'string' ? currentWorkspace.id : String(currentWorkspace.id);
      const newPath = item.path.replace('/workspace', `/workspace/${workspaceId}`);
      navigate(newPath);
    } else {
      navigate(item.path);
    }
  };

  return (
    <div className="fixed left-0 top-0 h-screen flex z-40">
      <div 
        className={`h-full border-r flex flex-col transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-72'
        } ${
          isDark 
            ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-white/5'
            : 'bg-white border-gray-200 shadow-xl'
        }`}
      >
        {/* Logo Section */}
        <div className={`p-6 flex items-center justify-between border-b ${
          isDark ? 'border-white/5' : 'border-gray-200'
        }`}>
          {collapsed ? (
            <button
              onClick={onToggle}
              className={`w-full flex items-center justify-center p-2 rounded-xl transition-all duration-200 group focus:outline-none focus:ring-0 ${
                isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
              }`}
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
                className={`flex items-center gap-3 text-left p-2 -m-2 transition-all duration-200 group focus:outline-none focus:ring-0 ${
                  isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                }`}
                title="Go to Main Dashboard"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl blur opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-105 transition-all duration-200">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">Kairo</h1>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Meeting Intelligence</p>
                </div>
              </button>
              {onToggle && (
                <button
                  onClick={onToggle}
                  className={`p-2 rounded-lg transition-all duration-200 group focus:outline-none focus:ring-0 ${
                    isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className={`w-5 h-5 transition-colors ${
                    isDark ? 'group-hover:text-white' : 'group-hover:text-gray-900'
                  }`} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Workspace Selector */}
        <div className="px-4 pb-4 pt-4">
          <div className="relative" ref={workspaceMenuRef}>
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowWorkspaceMenu(!showWorkspaceMenu);
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 border group ${
                collapsed ? 'justify-center' : ''
              } ${
                isDark 
                  ? 'bg-white/5 hover:bg-white/10 border-white/10'
                  : 'bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border-gray-200 shadow-sm'
              }`}
            >
              {viewMode === 'general' ? (
                <>
                  <div className="relative">
                    <div className={`absolute inset-0 rounded-lg blur-sm opacity-50 ${
                      isDark ? 'bg-gradient-to-br from-slate-600 to-slate-700' : 'bg-gradient-to-br from-purple-400 to-blue-400'
                    }`}></div>
                    <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${
                      isDark ? 'bg-gradient-to-br from-slate-700 to-slate-800' : 'bg-gradient-to-br from-purple-500 to-blue-500 shadow-md'
                    }`}>
                      <LayoutGrid className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-white'}`} />
                    </div>
                  </div>
                  {!collapsed && (
                    <>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>General Dashboard</p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Personal view</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${
                        showWorkspaceMenu ? 'rotate-90' : ''
                      } ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
                    </>
                  )}
                </>
              ) : (currentWorkspace || viewMode === 'workspace') ? (
                <>
                      <div className="relative">
                    <div 
                      className="absolute inset-0 rounded-lg blur-sm opacity-50"
                      style={{
                        backgroundColor: currentWorkspace?.colorTheme || '#9333ea'
                      }}
                    ></div>
                    <div 
                      className="relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: currentWorkspace?.colorTheme || '#9333ea'
                      }}
                    >
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  {!collapsed && (
                    <>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {currentWorkspace?.name || 'Workspace'}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                          {currentWorkspace ? `${(currentWorkspace.role || '').slice(0,1).toUpperCase()}${(currentWorkspace.role || '').slice(1).toLowerCase()} • ${currentWorkspace.memberCount} members` : 'Loading...'}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${
                        showWorkspaceMenu ? 'rotate-90' : ''
                      } ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
                    </>
                  )}
                </>
              ) : null}
            </button>

            {showWorkspaceMenu && !collapsed && (
              <>
                {/* Menu */}
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-2xl overflow-hidden z-50 border ${
                  isDark 
                    ? 'bg-slate-800/95 backdrop-blur-xl border-white/10'
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="p-2 max-h-80 overflow-y-auto space-y-1 scrollbar-hide">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetViewMode('general');
                        setShowWorkspaceMenu(false);
                        navigate('/dashboard');
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                        viewMode === 'general' 
                          ? isDark
                            ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30'
                            : 'bg-gradient-to-r from-purple-100 to-blue-100 border border-purple-300'
                          : isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isDark ? 'bg-gradient-to-br from-slate-700 to-slate-800' : 'bg-gradient-to-br from-purple-500 to-blue-500'
                      }`}>
                        <LayoutGrid className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-white'}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>General Dashboard</p>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>Personal view</p>
                      </div>
                      {viewMode === 'general' && <Check className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />}
                    </button>
                    
                    <div className={`h-px my-2 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                    
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className={`text-xs font-semibold uppercase tracking-wider ${
                        isDark ? 'text-slate-500' : 'text-gray-500'
                      }`}>Workspaces</p>
                      {!shouldShowDummyData && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowArchivedWorkspaces(!showArchivedWorkspaces);
                          }}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                            showArchivedWorkspaces
                              ? isDark
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-purple-100 text-purple-600'
                              : isDark
                                ? 'text-slate-500 hover:text-slate-400 hover:bg-white/5'
                                : 'text-gray-500 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title={showArchivedWorkspaces ? "Hide archived" : "Show archived"}
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    
                    {sidebarWorkspaces.map((workspace) => (
                      <button
                        key={workspace.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWorkspaceChange({ 
                            ...workspace, 
                            id: String(workspace.id) // Ensure id is string for Workspace type
                          });
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                          currentWorkspace?.id === String(workspace.id) && viewMode === 'workspace'
                            ? isDark
                              ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30'
                              : 'bg-gradient-to-r from-purple-100 to-blue-100 border border-purple-300'
                            : isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'
                        }`}
                      >
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg"
                          style={{
                            backgroundColor: 'colorTheme' in workspace ? workspace.colorTheme : '#9333ea'
                          }}
                        >
                          <Building2 className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{workspace.name}</p>
                            {workspace.isArchived && (
                              <Archive className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} title="Archived" />
                            )}
                          </div>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{workspace.memberCount} members • {`${(workspace.role || '').slice(0,1).toUpperCase()}${(workspace.role || '').slice(1).toLowerCase()}`}</p>
                        </div>
                        {currentWorkspace?.id === workspace.id && viewMode === 'workspace' && (
                          <Check className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                        )}
                      </button>
                    ))}
                    
                    {/* Pending Invitations */}
                    {pendingInvites.length > 0 && (
                      <>
                        <div className={`h-px my-2 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                        <p className={`text-xs font-semibold uppercase tracking-wider px-3 py-2 ${
                          isDark ? 'text-slate-500' : 'text-gray-500'
                        }`}>Pending Invitations</p>
                        {pendingInvites.map((invite) => (
                          <div
                            key={invite.id}
                            className={`w-full flex flex-col gap-2 px-3 py-3 rounded-lg transition-all duration-200 opacity-60 ${
                              isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 bg-gradient-to-br ${colors[0]} rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg opacity-70`}>
                                <Building2 className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 text-left">
                                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {invite.workspace.name}
                                </p>
                                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                                  Invited by {invite.inviter.name} • {`${(invite.role || '').slice(0,1).toUpperCase()}${(invite.role || '').slice(1).toLowerCase()}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-11">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await acceptInvite(invite.id);
                                    setShowWorkspaceMenu(false);
                                  } catch (error) {
                                    console.error('Failed to accept invite:', error);
                                  }
                                }}
                                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                                  isDark
                                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-300'
                                }`}
                              >
                                Accept
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await rejectInvite(invite.id);
                                  } catch (error) {
                                    console.error('Failed to reject invite:', error);
                                  }
                                }}
                                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                                  isDark
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                    : 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300'
                                }`}
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  <div className={`p-2 border-t ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowWorkspaceMenu(false);
                        setShowCreateWorkspaceModal(true);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                        isDark ? 'text-purple-400 hover:bg-white/5' : 'text-purple-600 hover:bg-purple-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        isDark ? 'bg-purple-500/10 group-hover:bg-purple-500/20' : 'bg-purple-100 group-hover:bg-purple-200'
                      }`}>
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">Create Workspace</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide">
          <div className="mb-3">
            {!collapsed && (
              <p className={`text-xs font-semibold uppercase tracking-wider px-3 mb-2 ${
                isDark ? 'text-slate-500' : 'text-gray-500'
              }`}>
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
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                    : isDark
                      ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                } ${isActive && !isDark ? 'shadow-purple-500/30' : ''}`}
                title={collapsed ? item.label : ''}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl blur opacity-50"></div>
                )}
                <Icon className={`relative w-5 h-5 ${
                  isActive 
                    ? 'text-white' 
                    : isDark
                      ? 'text-slate-300 group-hover:text-white'
                      : 'text-gray-600 group-hover:text-gray-900'
                }`} />
                {!collapsed && (
                  <>
                    <span className="relative flex-1 text-left font-medium text-sm">{item.label}</span>
                    {item.badge && (
                      <span className={`relative px-2 py-0.5 text-xs font-bold rounded-full ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : isDark
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-purple-100 text-purple-700 border border-purple-300'
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
        <div className={`p-4 border-t space-y-1 ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
          {!collapsed && (
            <p className={`text-xs font-semibold uppercase tracking-wider px-3 mb-2 ${
              isDark ? 'text-slate-500' : 'text-gray-500'
            }`}>
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
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                    : isDark
                      ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                } ${isActive && !isDark ? 'shadow-purple-500/30' : ''}`}
                title={collapsed ? item.label : ''}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl blur opacity-50"></div>
                )}
                <Icon className={`relative w-5 h-5 ${
                  isActive 
                    ? 'text-white' 
                    : isDark
                      ? 'text-slate-300 group-hover:text-white'
                      : 'text-gray-600 group-hover:text-gray-900'
                }`} />
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
          background: ${isDark ? 'rgb(51 65 85)' : 'rgb(209 213 219)'};
          border-radius: 2px;
        }
        nav::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgb(71 85 105)' : 'rgb(156 163 175)'};
        }
      `}</style>
      
      {/* Create Workspace Modal */}
      {showCreateWorkspaceModal && (
        <CreateWorkspaceModal 
          isOpen={showCreateWorkspaceModal}
          onClose={() => setShowCreateWorkspaceModal(false)}
        />
      )}
    </div>
  );
};

export default Sidebar;