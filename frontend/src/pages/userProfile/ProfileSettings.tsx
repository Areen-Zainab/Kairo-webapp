import React, { useState } from 'react';
import { User, Settings, Bell, Lock, Palette } from 'lucide-react';
import type { UserProfile } from '../../context/UserContext';
import Layout from '../../components/Layout';

import ProfileTab from '../../components/profileSettings/ProfileTab';
import PreferencesTab from '../../components/profileSettings/PreferencesTab';
import ThemeTab from '../../components/profileSettings/ThemeTab';
import SecurityTab from '../../components/profileSettings/SecurityTab';
import NotificationsTab from '../../components/profileSettings/NotificationTab';

type TabType = 'profile' | 'preferences' | 'theme' | 'security' | 'notifications';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const ProfileSettings = () => {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  
  const tabsRef = React.useRef<Record<TabType, HTMLButtonElement | null>>({
    profile: null,
    preferences: null,
    theme: null,
    security: null,
    notifications: null,
  });

  const [profile, setProfile] = useState<UserProfile>({
    id: 'user-1',
    name: 'Areeba Riaz',
    email: 'areeba@example.com',
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
    <Layout>
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Settings
            </h1>
            <p className="text-gray-600 dark:text-slate-400 text-base mt-1">Customize your workspace and preferences</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        {/* Desktop Tabs */}
        <div className="hidden md:block relative">
          <div className="relative rounded-2xl p-2 shadow-2xl bg-white border border-gray-200 dark:bg-slate-800/70 dark:border-slate-600/30 backdrop-blur-xl">
            <div className="flex space-x-2 relative">
              {/* Animated background indicator */}
              <div
                className="absolute top-1.5 bottom-1.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl transition-all duration-500 ease-out shadow-lg shadow-purple-400/50"
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
                  className="relative flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-300 group z-10"
                >
                  <div className={`transition-all duration-300 ${
                    activeTab === tab.id 
                      ? 'text-gray-900 dark:text-white scale-110 drop-shadow-lg' 
                      : 'text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white group-hover:scale-105'
                  }`}>
                    {tab.icon}
                  </div>
                  <span className={`font-semibold transition-all duration-300 ${
                    activeTab === tab.id 
                      ? 'text-gray-900 dark:text-white' 
                      : 'text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white'
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
          <div className="flex space-x-2 rounded-2xl p-1.5 min-w-max bg-white border border-gray-200 dark:bg-slate-900/50 dark:border-white/10 backdrop-blur-xl">
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
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5'
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

      {/* Main Content Card */}
      <div className="relative">
        <div className="relative rounded-2xl p-8 shadow-2xl overflow-hidden bg-white border border-gray-200 dark:bg-slate-900/80 dark:border-slate-600/30 backdrop-blur-2xl shadow-purple-900/10">
          {/* Decorative corner elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-tr-full" />
          
          <div className="relative w-full max-w-none">
            {/* Tab content with slide animation */}
            <div key={activeTab} className="animate-slideIn">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center border border-purple-300 dark:border-purple-500/30">
                  {tabs.find(tab => tab.id === activeTab)?.icon}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tabs.find(tab => tab.id === activeTab)?.label}
                </h2>
              </div>
              {renderTabContent()}
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
        
        .animate-slideIn {
          animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </Layout>
  );
};

export default ProfileSettings;