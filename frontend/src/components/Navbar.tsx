import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, Bell, User, Settings, LogOut, Sun, Moon, Plus } from 'lucide-react';
import { useUser } from '../context/UserContext';

interface User {
  name: string;
  email: string;
  avatar: string;
  profilePictureUrl: string;
}

interface NavbarProps {
  sidebarCollapsed: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  user: User;
  onNewMeetingClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  sidebarCollapsed, 
  searchQuery, 
  onSearchChange, 
  user,
  onNewMeetingClick
}) => {
  const navigate = useNavigate();
  const { logout: logoutUser, user: contextUser } = useUser();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  // Use context user if available, otherwise use passed user prop
  const actualUser = contextUser ? {
    name: contextUser.name,
    email: contextUser.email,
    profilePictureUrl: contextUser.profilePictureUrl,
    avatar: contextUser.name ? contextUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'
  } : user;

  // Use profile picture URL from Supabase if available, otherwise use initials
  const avatarSrc = actualUser.profilePictureUrl 
    ? actualUser.profilePictureUrl
    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(actualUser.name || 'User')}`;

  const handleLogout = async () => {
    await logoutUser(); // Clear user context and call backend logout
    navigate('/login'); // Navigate to login page
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle clicks outside profile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const isDark = theme === 'dark';

  return (
    <nav 
      className={`fixed top-0 right-0 z-30 border-b shadow-lg transition-all duration-300 ${
        isDark 
          ? 'bg-slate-900/95 backdrop-blur-2xl border-slate-800/40' 
          : 'bg-white/95 backdrop-blur-2xl border-gray-200 shadow-gray-200/50'
      }`} 
      style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
    >
      <div className="px-3 py-2 md:px-6 md:py-4 flex items-center justify-between">
        {/* Search Section */}
        <div className="relative hidden lg:block w-72 xl:w-96">
          <Search 
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
              isDark ? 'text-slate-500' : 'text-gray-400'
            }`} 
            size={18} 
          />
          <input
            type="text"
            placeholder="Search workspaces, meetings, tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none text-sm transition-all duration-300 ${
              isDark
                ? 'bg-transparent border border-slate-700/40 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500/60'
                : 'bg-gray-50 border-2 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 focus:bg-white'
            }`}
          />
        </div>

        {/* Action Buttons */}
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 md:p-2 rounded-lg transition-all duration-300 ${
              isDark
                ? 'hover:bg-slate-800/50 text-slate-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Moon className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            ) : (
              <Sun className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            )}
          </button>

          {/* New Meeting Button - Only show in workspace mode */}
          {location.pathname.startsWith('/workspace') && (
            <button
              onClick={onNewMeetingClick}
              className={`p-1.5 md:p-2 rounded-lg transition-all duration-300 ${
                isDark
                  ? 'hover:bg-slate-800/50 text-slate-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
              title="New Meeting"
            >
              <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </button>
          )}

          <button 
            onClick={() => navigate('/calendar')}
            className={`p-1.5 md:p-2 rounded-lg transition-all duration-300 ${
              isDark
                ? 'hover:bg-slate-800/50 text-slate-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
            title="My Calendar"
          >
            <Calendar className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </button>
          
          <button 
            onClick={() => navigate('/notifications')}
            className={`p-1.5 md:p-2 relative rounded-lg transition-all duration-300 ${
              isDark
                ? 'hover:bg-slate-800/50 text-slate-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
            title="Notifications"
          >
            <Bell className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            <span className="absolute top-0.5 right-0.5 md:top-1 md:right-1 w-1.5 h-1.5 md:w-2 md:h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg"></span>
          </button>

          {/* Enhanced Profile Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 transition-all duration-300 group"
            >
              <img 
                src={avatarSrc} 
                alt={actualUser.name} 
                className={`w-7 h-7 md:w-8 md:h-8 rounded-full ring-2 transition-all duration-300 object-cover ${
                  isDark
                    ? 'ring-slate-700/60 group-hover:ring-slate-600'
                    : 'ring-gray-200 group-hover:ring-gray-300'
                }`}
              />
            </button>

            {showProfileMenu && (
                <div className={`absolute right-0 mt-2 w-64 md:w-72 rounded-xl shadow-2xl overflow-hidden z-50 border transition-all duration-300 ${
                  isDark
                    ? 'bg-slate-900/95 backdrop-blur-xl border-slate-700/60'
                    : 'bg-white border-gray-200 shadow-xl'
                }`}>
                  {/* Profile Header */}
                  <div className={`p-4 flex items-center gap-3 border-b ${
                    isDark ? 'border-slate-700/60' : 'border-gray-200'
                  }`}>
                    <img 
                      src={avatarSrc} 
                      alt={actualUser.name} 
                      className={`w-8 h-8 md:w-9 md:h-9 rounded-full ring-2 object-cover ${
                        isDark ? 'ring-slate-700/60' : 'ring-gray-200'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {actualUser.name}
                      </p>
                      <p className={`text-xs mt-0.5 truncate ${
                        isDark ? 'text-slate-400' : 'text-gray-500'
                      }`}>
                        {actualUser.email}
                      </p>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    <button 
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                        isDark
                          ? 'hover:bg-white/5 focus:bg-white/10 text-slate-200'
                          : 'hover:bg-gray-100 focus:bg-gray-100 text-gray-700'
                      }`}
                      onClick={() => {
                        navigate('/profile-settings');
                        setShowProfileMenu(false);
                      }}
                    >
                      <User className={`w-4 h-4 md:w-[18px] md:h-[18px] ${
                        isDark ? 'text-slate-300' : 'text-gray-600'
                      }`} />
                      <span className="text-sm font-medium">Profile Settings</span>
                    </button>

                    <button 
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                        isDark
                          ? 'hover:bg-white/5 focus:bg-white/10 text-slate-200'
                          : 'hover:bg-gray-100 focus:bg-gray-100 text-gray-700'
                      }`}
                      onClick={() => {
                        navigate('/profile-settings');
                        setShowProfileMenu(false);
                      }}
                    >
                      <Settings className={`w-4 h-4 md:w-[18px] md:h-[18px] ${
                        isDark ? 'text-slate-300' : 'text-gray-600'
                      }`} />
                      <span className="text-sm font-medium">Preferences</span>
                    </button>

                    {/* Theme Toggle in Menu */}
                    <button 
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                        isDark
                          ? 'hover:bg-white/5 focus:bg-white/10 text-slate-200'
                          : 'hover:bg-gray-100 focus:bg-gray-100 text-gray-700'
                      }`}
                      onClick={() => {
                        toggleTheme();
                      }}
                    >
                      {isDark ? (
                        <>
                          <Sun className="w-4 h-4 md:w-[18px] md:h-[18px] text-slate-300" />
                          <span className="text-sm font-medium">Light Mode</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 md:w-[18px] md:h-[18px] text-gray-600" />
                          <span className="text-sm font-medium">Dark Mode</span>
                        </>
                      )}
                    </button>

                    <div className={`h-px my-2 ${
                      isDark ? 'bg-slate-700/60' : 'bg-gray-200'
                    }`}></div>

                    <button 
                      onClick={() => {
                        handleLogout();
                        setShowProfileMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                        isDark
                          ? 'bg-red-900/30 hover:bg-red-800/40 text-red-200'
                          : 'bg-red-50 hover:bg-red-100 text-red-700'
                      }`}
                    >
                      <LogOut className={`w-4 h-4 md:w-[18px] md:h-[18px] ${
                        isDark ? 'text-red-300' : 'text-red-600'
                      }`} />
                      <span className="text-sm font-semibold">Sign Out</span>
                    </button>
                  </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;