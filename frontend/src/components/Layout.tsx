import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import NewMeetingModal from '../modals/NewMeetingModal';

interface LayoutProps {
  children: React.ReactNode;
  forceSidebarCollapsed?: boolean;
}

interface MeetingData {
  title: string;
  description: string;
  meetingLink: string;
  platform: 'zoom' | 'google-meet' | 'teams' | 'other';
  duration: number;
  participants: string[];
  meetingType: 'instant' | 'scheduled';
  scheduledDate?: string;
  scheduledTime?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, forceSidebarCollapsed = false }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Initialize sidebar state - will be updated from localStorage in useEffect
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'general' | 'workspace'>('general');

    // Initialize workspace from localStorage or default
  const getInitialWorkspace = () => {
    const savedWorkspace = localStorage.getItem('currentWorkspace');
    if (savedWorkspace) {
      try {
        return JSON.parse(savedWorkspace);
      } catch (e) {
        console.error('Failed to parse saved workspace:', e);
      }
    }
    return {
      id: '1',
      name: 'Product Team Alpha',
      role: 'Manager',
      color: 'from-purple-500 to-blue-500',
      memberCount: 12,
    };
  };

  const [currentWorkspace, setCurrentWorkspace] = useState(getInitialWorkspace());
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);

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

  // Default user data for guest mode
  const displayUser = {
    name: 'Guest',
    email: 'guest@example.com',
    avatar: 'G'
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
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
  };

  const handleNewMeetingClick = () => {
    setShowNewMeetingModal(true);
  };

  const handleJoinInstantly = (meetingData: MeetingData) => {
    console.log('Joining external meeting:', meetingData);
    // TODO: Implement external meeting join logic
    // This could open the meeting link and add Kairo as a participant
    // or trigger a bot to join the meeting automatically
  };

  const handleScheduleMeeting = (meetingData: MeetingData) => {
    console.log('Scheduling external meeting join:', meetingData);
    // TODO: Implement scheduled meeting join logic
    // This could create a calendar event with the meeting link
    // and schedule Kairo to join at the specified time
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
      <NewMeetingModal
        isOpen={showNewMeetingModal}
        onClose={() => setShowNewMeetingModal(false)}
        onJoinInstantly={handleJoinInstantly}
        onScheduleMeeting={handleScheduleMeeting}
      />

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