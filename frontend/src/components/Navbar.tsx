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

  return (
    <nav className="fixed top-0 right-0 z-30 bg-slate-900/95 backdrop-blur-2xl border-b border-slate-800/40 shadow-xl" style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}>
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Search Section */}
        <div className="relative w-96 hidden lg:block">
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
        <div className="flex items-center gap-3">
          <button className="p-2 transition-all duration-300 group">
            <Calendar size={18} className="text-slate-500 group-hover:text-purple-400 transition-colors duration-300" />
          </button>
          
          <button className="p-2 transition-all duration-300 group relative">
            <Bell size={18} className="text-slate-500 group-hover:text-purple-400 transition-colors duration-300" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg"></span>
          </button>

          {/* Enhanced Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 transition-all duration-300 group"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center font-semibold text-sm text-white shadow-lg group-hover:shadow-purple-500/40 transition-all duration-300">
                {user.avatar}
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-700/60">
                  <p className="font-semibold text-white text-sm">{user.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{user.email}</p>
                </div>
                <div className="p-3 space-y-1">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/60 rounded-lg transition-all duration-300 text-left group" onClick={() => navigate('/profile-settings')}>
                    <User size={18} className="text-slate-400 group-hover:text-purple-400 transition-colors duration-300" />
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors duration-300">Profile Settings</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/60 rounded-lg transition-all duration-300 text-left group" onClick={() => navigate('/profile-settings')}>
                    <Settings size={18} className="text-slate-400 group-hover:text-purple-400 transition-colors duration-300" />
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors duration-300">Preferences</span>
                  </button>
                  <div className="h-px bg-slate-700/60 my-3"></div>
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-lg transition-all duration-300 text-left group">
                    <LogOut size={18} />
                    <span className="text-sm">Sign Out</span>
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