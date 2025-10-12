import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
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

  // Automatically set view mode based on URL path
  useEffect(() => {
    if (location.pathname.startsWith('/workspace')) {
      setViewMode('workspace');
    } else {
      setViewMode('general');
    }
  }, [location.pathname]);

  const user = {
    name: 'John Doe',
    email: 'john@example.com',
    avatar: 'JD'
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleViewModeChange = (mode: 'general' | 'workspace') => {
    setViewMode(mode);
  };

  const handleWorkspaceChange = (workspace: any) => {
    setCurrentWorkspace(workspace);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 relative overflow-hidden">
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
            user={user}
          />
        </div>

        {/* Enhanced Animated Background with Mouse Tracking */}
        <div 
          className="fixed inset-0 pointer-events-none transition-all duration-300" 
          style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
        >
          {/* Mouse-following blur orbs */}
          <div 
            className="absolute w-96 h-96 bg-purple-500/15 rounded-full blur-3xl transition-all duration-300 ease-out"
            style={{
              left: `${mousePosition.x / 15}px`,
              top: `${mousePosition.y / 15}px`,
            }}
          />
          <div 
            className="absolute w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-3xl"
            style={{
              right: `${-mousePosition.x / 25}px`,
              top: `${mousePosition.y / 30 + 100}px`,
              transition: 'all 0.5s ease-out'
            }}
          />
          
          {/* Static animated orbs */}
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          
          {/* Floating particles */}
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-purple-400/50 rounded-full"
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