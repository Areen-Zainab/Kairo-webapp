import React, { useState, useEffect } from 'react';
import { User, Settings, Bell, Lock, Palette } from 'lucide-react';
import type { UserProfile } from '../context/UserContext';

import ProfileTab from '../components/profileSettings/ProfileTab';
import PreferencesTab from '../components/profileSettings/PreferencesTab';
import ThemeTab from '../components/profileSettings/ThemeTab';
import SecurityTab from '../components/profileSettings/SecurityTab';
import NotificationsTab from '../components/profileSettings/NotificationTab';

type TabType = 'profile' | 'preferences' | 'theme' | 'security' | 'notifications';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const ProfileSettings = () => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const tabsRef = React.useRef<Record<TabType, HTMLButtonElement | null>>({
    profile: null,
    preferences: null,
    theme: null,
    security: null,
    notifications: null,
  });

  // Mouse tracking for floating balls
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const [profile, setProfile] = useState<UserProfile>({
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    profilePicture: null,
    audioSample: null,
  });

  const [preferences, setPreferences] = useState({
    autoJoin: true,
    autoRecord: false,
    defaultDuration: 60,
    timezone: 'America/New_York',
  });

  const [theme, setTheme] = useState({
    mode: 'dark' as 'light' | 'dark',
    accentColor: '#9333ea',
  });

  const [notifications, setNotifications] = useState({
    email: {
      meetingReminders: true,
      meetingSummaries: true,
      actionItems: true,
      weeklyDigest: false,
    },
    push: {
      meetingStarting: true,
      meetingJoined: false,
      mentionsAndReplies: true,
      actionItemsDue: true,
    },
    inApp: {
      meetingUpdates: true,
      transcriptionReady: true,
      sharedWithYou: true,
    },
  });

  const tabs: Tab[] = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'preferences', label: 'Preferences', icon: <Settings className="w-4 h-4" /> },
    { id: 'theme', label: 'Theme', icon: <Palette className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ];

  const handlePasswordChange = (currentPassword: string, newPassword: string) => {
    console.log('Password change requested', { currentPassword, newPassword });
  };

  const handleToggle2FA = (enabled: boolean) => {
    console.log('2FA toggle:', enabled);
  };

  const handleRevokeSession = (sessionId: string) => {
    console.log('Revoke session:', sessionId);
  };

  const handleProfileSave = (profile: UserProfile) => {
    console.log('Saving profile:', profile);
    setProfile(profile);
  };

  const handlePreferencesSave = (updatedPreferences: typeof preferences) => {
    console.log('Saving preferences:', updatedPreferences);
    setPreferences(updatedPreferences);
  };

  const handleThemeSave = (updatedTheme: typeof theme) => {
    console.log('Saving theme:', updatedTheme);
    setTheme(updatedTheme);
    document.documentElement.classList.toggle('dark', updatedTheme.mode === 'dark');
    document.documentElement.style.setProperty('--accent-color', updatedTheme.accentColor);
  };

  const handleNotificationsSave = (updatedNotifications: typeof notifications) => {
    console.log('Saving notifications:', updatedNotifications);
    setNotifications(updatedNotifications);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab profile={profile} onSave={handleProfileSave} />;
      case 'preferences':
        return <PreferencesTab preferences={preferences} onSave={handlePreferencesSave} />;
      case 'theme':
        return <ThemeTab theme={theme} onSave={handleThemeSave} />;
      case 'security':
        return (
          <SecurityTab
            onPasswordChange={handlePasswordChange}
            onToggle2FA={handleToggle2FA}
            onRevokeSession={handleRevokeSession}
          />
        );
      case 'notifications':
        return <NotificationsTab settings={notifications} onSave={handleNotificationsSave} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 relative overflow-hidden">
      {/* Enhanced Animated Background with Mouse Tracking */}
      <div className="fixed w-full h-full inset-0 pointer-events-none">
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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with enhanced styling */}
        <div className="mb-10">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
          <p className="text-slate-400 text-lg ml-13">Customize your workspace and preferences</p>
        </div>

        {/* Enhanced Tab Navigation */}
        <div className="mb-8">
          {/* Desktop Tabs */}
          <div className="hidden md:block relative">
            <div className="relative bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl">
              <div className="flex space-x-3 relative">
                {/* Animated background indicator */}
                <div
                  className="absolute top-1.5 bottom-1.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl transition-all duration-500 ease-out shadow-lg shadow-purple-400/50"
                  style={{
                    width: `${tabsRef.current[activeTab]?.offsetWidth || 0}px`,
                    left: `${tabsRef.current[activeTab]?.offsetLeft || 0}px`,
                  }}
                />

                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    ref={(el) => { tabsRef.current[tab.id] = el; }}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative flex-1 flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl transition-all duration-300 group z-10"
                  >
                    <div className={`transition-all duration-300 ${
                      activeTab === tab.id 
                        ? 'text-white scale-110 drop-shadow-lg' 
                        : 'text-slate-300 group-hover:text-white group-hover:scale-105'
                    }`}>
                      {tab.icon}
                    </div>
                    <span className={`font-semibold transition-all duration-300 ${
                      activeTab === tab.id 
                        ? 'text-white' 
                        : 'text-slate-300 group-hover:text-white'
                    }`}>
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Tabs - Scrollable */}
          <div className="md:hidden overflow-x-auto scrollbar-hide">
            <div className="flex space-x-2 bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 px-5 py-3 rounded-xl font-medium
                    transition-all duration-300 whitespace-nowrap
                    ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }
                  `}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content with enhanced card */}
        <div className="relative">
          <div className="relative bg-slate-900/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-purple-900/20 overflow-hidden">
            {/* Decorative corner elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-tr-full" />
            
            <div className="relative max-w-4xl mx-auto">
              {/* Tab content with slide animation */}
              <div key={activeTab} className="animate-slideIn">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center border border-purple-500/30">
                    {tabs.find(tab => tab.id === activeTab)?.icon}
                  </div>
                  <h2 className="text-3xl font-bold text-white">
                    {tabs.find(tab => tab.id === activeTab)?.label}
                  </h2>
                </div>
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.05);
          }
        }
        
        @keyframes pulse-slower {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.08);
          }
        }
        
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
        
        .animate-slideIn {
          animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 8s ease-in-out infinite;
        }
        
        .animate-pulse-slower {
          animation: pulse-slower 12s ease-in-out infinite;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default ProfileSettings;