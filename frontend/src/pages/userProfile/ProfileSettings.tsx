import React, { useState, useEffect } from 'react';
import { User, Settings, Bell, Lock } from 'lucide-react';
import type { UserProfile } from '../../context/UserContext';
import Layout from '../../components/Layout';
import { useUser } from '../../context/UserContext';
import apiService from '../../services/api';

import ProfileTab from '../../components/profileSettings/ProfileTab';
import PreferencesTab from '../../components/profileSettings/PreferencesTab';
import SecurityTab from '../../components/profileSettings/SecurityTab';
import NotificationsTab from '../../components/profileSettings/NotificationTab';

type TabType = 'profile' | 'preferences' | 'security' | 'notifications';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const ProfileSettings = () => {
  const { user, updateProfile, updatePreferences, updateNotificationSettings } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  const tabsRef = React.useRef<Record<TabType, HTMLButtonElement | null>>({
    profile: null,
    preferences: null,
    security: null,
    notifications: null,
  });

  // Initialize preferences from user data
  const getInitialPreferences = () => {
    if (user?.preferences) {
      return {
        autoJoin: user.preferences.autoJoin ?? true,
        autoRecord: user.preferences.autoRecord ?? false,
        defaultDuration: user.preferences.defaultDuration ?? 60,
        timezone: user.preferences.timezone || user?.timezone || 'UTC',
      };
    }
    return {
      autoJoin: true,
      autoRecord: false,
      defaultDuration: 60,
      timezone: user?.timezone || 'UTC',
    };
  };

  const [preferences, setPreferences] = useState(getInitialPreferences());

  // Initialize notifications from user data or defaults
  const getInitialNotifications = () => {
    if (user?.notificationSettings) {
      return {
        email: {
          meetingReminders: user.notificationSettings.emailMeetingReminders ?? true,
          meetingSummaries: user.notificationSettings.emailMeetingSummaries ?? true,
          actionItems: user.notificationSettings.emailActionItems ?? true,
          weeklyDigest: user.notificationSettings.emailWeeklyDigest ?? false,
        },
        push: {
          meetingStarting: user.notificationSettings.pushMeetingStarting ?? true,
          meetingJoined: user.notificationSettings.pushMeetingJoined ?? false,
          mentionsAndReplies: user.notificationSettings.pushMentionsAndReplies ?? true,
          actionItemsDue: user.notificationSettings.pushActionItemsDue ?? true,
        },
        inApp: {
          meetingUpdates: user.notificationSettings.inAppMeetingUpdates ?? true,
          transcriptionReady: user.notificationSettings.inAppTranscriptionReady ?? true,
          sharedWithYou: user.notificationSettings.inAppSharedWithYou ?? true,
        },
      };
    }
    return {
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
    };
  };

  const [notifications, setNotifications] = useState(getInitialNotifications());
  
  // Update preferences and notifications when user data changes
  useEffect(() => {
    if (user?.preferences) {
      setPreferences({
        autoJoin: user.preferences.autoJoin ?? true,
        autoRecord: user.preferences.autoRecord ?? false,
        defaultDuration: user.preferences.defaultDuration ?? 60,
        timezone: user.preferences.timezone || user?.timezone || 'UTC',
      });
    }
    if (user?.notificationSettings) {
      setNotifications({
        email: {
          meetingReminders: user.notificationSettings.emailMeetingReminders ?? true,
          meetingSummaries: user.notificationSettings.emailMeetingSummaries ?? true,
          actionItems: user.notificationSettings.emailActionItems ?? true,
          weeklyDigest: user.notificationSettings.emailWeeklyDigest ?? false,
        },
        push: {
          meetingStarting: user.notificationSettings.pushMeetingStarting ?? true,
          meetingJoined: user.notificationSettings.pushMeetingJoined ?? false,
          mentionsAndReplies: user.notificationSettings.pushMentionsAndReplies ?? true,
          actionItemsDue: user.notificationSettings.pushActionItemsDue ?? true,
        },
        inApp: {
          meetingUpdates: user.notificationSettings.inAppMeetingUpdates ?? true,
          transcriptionReady: user.notificationSettings.inAppTranscriptionReady ?? true,
          sharedWithYou: user.notificationSettings.inAppSharedWithYou ?? true,
        },
      });
    }
  }, [user]);

  const tabs: Tab[] = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'preferences', label: 'Preferences', icon: <Settings className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ];

  const handlePasswordChange = async (currentPassword: string, newPassword: string) => {
    try {
      await apiService.changePassword(currentPassword, newPassword);
      setSuccessMessage('Password updated successfully');
    } catch (error: any) {
      console.error('Failed to update password:', error);
      setSuccessMessage(error?.response?.data?.error || 'Failed to update password');
    }
  };

  const handleToggle2FA = async (enabled: boolean) => {
    try {
      // TODO: Implement 2FA toggle API
      console.log('2FA toggle:', enabled);
      setSuccessMessage(`2FA ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Failed to toggle 2FA:', error);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    console.log('Revoke session:', sessionId);
    setSuccessMessage('Session revoked successfully');
  };

  const handleProfileSave = async (profileUpdates: Partial<UserProfile>) => {
    try {
      await updateProfile(profileUpdates);
      setSuccessMessage('Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      setSuccessMessage('Failed to update profile');
    }
  };

  const handlePreferencesSave = async (updatedPreferences: typeof preferences) => {
    try {
      await updatePreferences(updatedPreferences);
      setPreferences(updatedPreferences);
      setSuccessMessage('Preferences updated successfully');
    } catch (error) {
      console.error('Failed to update preferences:', error);
      setSuccessMessage('Failed to update preferences');
    }
  };


  const handleNotificationsSave = async (updatedNotifications: typeof notifications) => {
    try {
      // Map frontend notification structure to backend format
      const settings = {
        emailMeetingReminders: updatedNotifications.email.meetingReminders,
        emailMeetingSummaries: updatedNotifications.email.meetingSummaries,
        emailActionItems: updatedNotifications.email.actionItems,
        emailWeeklyDigest: updatedNotifications.email.weeklyDigest,
        pushMeetingStarting: updatedNotifications.push.meetingStarting,
        pushMeetingJoined: updatedNotifications.push.meetingJoined,
        pushMentionsAndReplies: updatedNotifications.push.mentionsAndReplies,
        pushActionItemsDue: updatedNotifications.push.actionItemsDue,
        inAppMeetingUpdates: updatedNotifications.inApp.meetingUpdates,
        inAppTranscriptionReady: updatedNotifications.inApp.transcriptionReady,
        inAppSharedWithYou: updatedNotifications.inApp.sharedWithYou,
      };
      
      await updateNotificationSettings(settings);
      setNotifications(updatedNotifications);
      setSuccessMessage('Notification settings updated successfully');
    } catch (error) {
      console.error('Failed to update notifications:', error);
      setSuccessMessage('Failed to update notification settings');
    }
  };

  const renderTabContent = () => {
    if (!user) {
      return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Loading...</div>;
    }
    
    switch (activeTab) {
      case 'profile':
        return <ProfileTab profile={user} onSave={handleProfileSave} />;
      case 'preferences':
        return <PreferencesTab preferences={preferences} onSave={handlePreferencesSave} />;
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
            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-600 dark:text-green-400 text-sm">
                {successMessage}
              </div>
            )}
            
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