import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import NewMeetingModal from '../modals/NewMeetingModal';
import { useUser } from '../context/UserContext';
import { useMeetingNotifications } from '../hooks/useMeetingNotifications';

interface LayoutProps {
  children: React.ReactNode;
  forceSidebarCollapsed?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, forceSidebarCollapsed = false }) => {
  const location = useLocation();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { user, currentWorkspace, setCurrentWorkspace } = useUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'general' | 'workspace'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  
  // Extract workspace ID from URL
  const workspaceIdFromUrl = location.pathname.match(/\/workspace\/(\d+)/)?.[1];
  
  // Enable meeting notifications for current workspace
  const activeWorkspaceId = workspaceIdFromUrl
    ? Number.isNaN(Number(workspaceIdFromUrl))
      ? undefined
      : Number(workspaceIdFromUrl)
    : typeof currentWorkspace?.id === 'number'
    ? currentWorkspace.id
    : undefined;

  useMeetingNotifications({ workspaceId: activeWorkspaceId });

  // Automatically set view mode based on URL path
  useEffect(() => {
    if (location.pathname.startsWith('/workspace')) {
      setViewMode('workspace');
    } else {
      setViewMode('general');
    }
  }, [location.pathname]);

  // Initialize sidebar state from localStorage on component mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      try {
        const parsedState = JSON.parse(savedState);
        setSidebarCollapsed(parsedState);
      } catch (error) {
        console.error('Failed to parse saved sidebar state:', error);
        // Keep default state (false = expanded)
      }
    }
  }, []); // Empty dependency array - only run on mount

  // Update sidebar state when forceSidebarCollapsed changes
  useEffect(() => {
    // Only apply forceSidebarCollapsed if it's explicitly true (not just falsy)
    if (forceSidebarCollapsed === true) {
      setSidebarCollapsed(true);
      localStorage.setItem('sidebarCollapsed', JSON.stringify(true));
    }
  }, [forceSidebarCollapsed]);

  // Get user data from context or use default guest data
  const displayUser = user ? {
    name: user.name,
    email: user.email,
    avatar: user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U',
    profilePictureUrl: user.profilePictureUrl || ''
  } : {
    name: 'Guest',
    email: 'guest@example.com',
    avatar: 'G',
    profilePictureUrl: ''
  };

  useEffect(() => {
    let rafId: number;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleSidebarToggle = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  const handleViewModeChange = (mode: 'general' | 'workspace') => {
    setViewMode(mode);
  };

  const handleWorkspaceChange = (workspace: any) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('currentWorkspace', JSON.stringify(workspace));
  };

  const handleNewMeetingClick = () => {
    setShowNewMeetingModal(true);
  };

  const handleMeetingCreated = () => {
    // Meeting created successfully, modal will close automatically
    // Could trigger a refresh here if needed
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-100 text-slate-900 dark:bg-gradient-to-br dark:from-slate-950 dark:via-purple-950 dark:to-slate-900 dark:text-white">
      {/* Fixed Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        viewMode={viewMode}
        onSetViewMode={handleViewModeChange}
        currentWorkspace={currentWorkspace}
        onWorkspaceChange={handleWorkspaceChange}
      />

      {/* Main Content Area - With left margin for sidebar */}
      <div 
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'ml-20' : 'ml-72'
        }`}
      >
        {/* Top Navigation - Fixed */}
        <div 
          className="fixed top-0 right-0 left-0 z-30 transition-all duration-300" 
          style={{ marginLeft: sidebarCollapsed ? '5rem' : '18rem' }}
        >
        <Navbar
          sidebarCollapsed={sidebarCollapsed}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          user={displayUser}
          onNewMeetingClick={handleNewMeetingClick}
        />
        </div>

        {/* Enhanced Animated Background with Mouse Tracking */}
        <div 
          className="fixed inset-0 pointer-events-none transition-all duration-300" 
          style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
        >
          {/* Mouse-following blur orbs */}
          <div 
            className="absolute w-96 h-96 rounded-full blur-3xl transition-all duration-300 ease-out bg-purple-300/35 dark:bg-purple-500/15"
            style={{
              left: `${mousePosition.x / 15}px`,
              top: `${mousePosition.y / 15}px`,
            }}
          />
          <div 
            className="absolute w-[500px] h-[500px] rounded-full blur-3xl bg-blue-300/35 dark:bg-blue-500/15"
            style={{
              right: `${-mousePosition.x / 25}px`,
              top: `${mousePosition.y / 30 + 100}px`,
              transition: 'all 0.5s ease-out'
            }}
          />
          
          {/* Static animated orbs */}
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse bg-indigo-300/30 dark:bg-blue-500/10" />
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 rounded-full blur-3xl animate-pulse bg-emerald-300/30 dark:bg-green-500/10" style={{ animationDelay: '1s' }} />
          
          {/* Floating particles */}
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-purple-400/70 dark:bg-purple-400/50"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`
              }}
            />
          ))}
        </div>

        {/* Scrollable Content Area */}
        <div className="relative px-6 sm:px-8 lg:px-12 py-8 pt-24">
          {children}
        </div>
      </div>

      {/* New Meeting Modal - Rendered at page level */}
      {(workspaceIdFromUrl || currentWorkspace?.id) && (
        <NewMeetingModal
          isOpen={showNewMeetingModal}
          onClose={() => setShowNewMeetingModal(false)}
          workspaceId={activeWorkspaceId}
          onMeetingCreated={handleMeetingCreated}
        />
      )}

      <style>{`
        @keyframes float {
          0%, 100% { 
            transform: translateY(0px); 
            opacity: 0.4; 
          }
          50% { 
            transform: translateY(-20px); 
            opacity: 0.8; 
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;