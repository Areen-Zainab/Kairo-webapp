import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, Bell, User, Settings, LogOut } from 'lucide-react';

interface User {
  name: string;
  email: string;
  avatar: string;
}

interface NavbarProps {
  sidebarCollapsed: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  user: User;
}

const Navbar: React.FC<NavbarProps> = ({ 
  sidebarCollapsed, 
  searchQuery, 
  onSearchChange, 
  user 
}) => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const avatarSrc = user.avatar && user.avatar.trim() !== ''
    ? user.avatar
    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || 'Areeba')}`;

  const handleLogout = () => {
    // Add logout logic here, e.g., clearing tokens and redirecting
    // For now, just navigate to login page
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 right-0 z-30 bg-slate-900/95 backdrop-blur-2xl border-b border-slate-800/40 shadow-xl" style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}>
      <div className="px-3 py-2 md:px-6 md:py-4 flex items-center justify-between">
        {/* Search Section */}
        <div className="relative hidden lg:block w-72 xl:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search workspaces, meetings, tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-transparent border border-slate-700/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500/60 text-sm placeholder-slate-500 transition-all duration-300"
          />
        </div>

        {/* Action Buttons */}
        <div className="ml-auto bg-transparent flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => navigate('/calendar')}
            className="p-1.5 bg-transparent md:p-2 transition-all duration-300 hover:bg-slate-800/50 rounded-lg"
            title="My Calendar"
          >
            <Calendar className="w-4 h-4 md:w-[18px] md:h-[18px] text-slate-400 hover:text-white transition-colors duration-300" />
          </button>
          
          <button 
            onClick={() => navigate('/notifications')}
            className="p-1.5 bg-transparent md:p-2 transition-all duration-300 relative hover:bg-slate-800/50 rounded-lg"
            title="Notifications"
          >
            <Bell className="w-4 h-4 bg-transparent  md:w-[18px] md:h-[18px] text-slate-400 hover:text-white transition-colors duration-300" />
            <span className="absolute top-0.5 right-0.5 md:top-1 md:right-1 w-1.5 h-1.5 md:w-2 md:h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg"></span>
          </button>

          {/* Enhanced Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex bg-transparent items-center gap-2 p-1 transition-all duration-300 group"
            >
              <img src={avatarSrc} alt={user.name} className="w-7 h-7 md:w-8 md:h-8 rounded-full ring-1 ring-slate-700/60" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 md:w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-700/60 flex items-center gap-3">
                  <img src={avatarSrc} alt={user.name} className="w-8 h-8 md:w-9 md:h-9 rounded-full ring-1 ring-slate-700/60" />
                  <div>
                    <p className="font-semibold text-white text-sm">{user.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                  </div>
                </div>
                <div className="p-2">
                  <button className="w-full bg-transparent flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-left hover:bg-white/5 focus:bg-white/10" onClick={() => navigate('/profile-settings')}>
                    <User className="w-4 h-4 md:w-[18px] md:h-[18px] text-slate-300" />
                    <span className="text-sm text-slate-200">Profile Settings</span>
                  </button>
                  <button className="w-full bg-transparent flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-left hover:bg-white/5 focus:bg-white/10" onClick={() => navigate('/profile-settings')}>
                    <Settings className="w-4 h-4 md:w-[18px] md:h-[18px] text-slate-300" />
                    <span className="text-sm text-slate-200">Preferences</span>
                  </button>
                  <div className="h-px bg-slate-700/60 my-3"></div>
                  <button onClick={handleLogout} className="w-full bg-red-900/30 flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-left hover:bg-red-800/30">
                    <LogOut className="w-4 h-4 md:w-[18px] md:h-[18px] text-red-300" />
                    <span className="text-sm text-red-200">Sign Out</span>
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