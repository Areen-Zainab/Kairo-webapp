import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import apiService from '../services/api';

export interface NotificationSettings {
  emailMeetingReminders?: boolean;
  emailMeetingSummaries?: boolean;
  emailActionItems?: boolean;
  emailWeeklyDigest?: boolean;
  pushMeetingStarting?: boolean;
  pushMeetingJoined?: boolean;
  pushMentionsAndReplies?: boolean;
  pushActionItemsDue?: boolean;
  inAppMeetingUpdates?: boolean;
  inAppTranscriptionReady?: boolean;
  inAppSharedWithYou?: boolean;
}

export interface UserPreferences {
  autoJoin?: boolean;
  autoRecord?: boolean;
  defaultDuration?: number;
  timezone?: string;
  themeMode?: string;
  accentColor?: string;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  profilePictureUrl?: string;
  audioSampleUrl?: string;
  timezone: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLogin?: string;
  preferences?: UserPreferences;
  notificationSettings?: NotificationSettings;
}

export interface Workspace {
  id: number;
  name: string;
  description?: string;
  code: string;
  colorTheme?: string;
  role?: string;
  ownerId: number;
  memberCount: number;
  createdAt: string;
  joinedAt?: string;
}

export interface WorkspaceInvite {
  id: number;
  workspaceId: number;
  invitedEmail: string;
  invitedUserId: number;
  invitedBy: number;
  role: string;
  status: string;
  sentAt: string;
  workspace: {
    id: number;
    name: string;
    description?: string;
    colorTheme?: string;
  };
  inviter: {
    id: number;
    name: string;
    email: string;
  };
}

interface CurrentWorkspace {
  id: string;
  name: string;
  role: string;
  color: string;
  memberCount: number;
}

interface UserContextType {
  user: UserProfile | null;
  workspaces: Workspace[];
  pendingInvites: WorkspaceInvite[];
  currentWorkspace: CurrentWorkspace | null;
  loading: boolean;
  isAuthenticated: boolean;
  setCurrentWorkspace: (workspace: CurrentWorkspace | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (preferences: any) => Promise<void>;
  updateNotificationSettings: (settings: any) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshInvites: () => Promise<void>;
  acceptInvite: (inviteId: number) => Promise<void>;
  rejectInvite: (inviteId: number) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<CurrentWorkspace | null>(null);
  const [loading, setLoading] = useState(true);

  // Load current workspace from localStorage on mount
  useEffect(() => {
    const savedWorkspace = localStorage.getItem('currentWorkspace');
    if (savedWorkspace) {
      try {
        const parsed = JSON.parse(savedWorkspace);
        setCurrentWorkspace(parsed);
      } catch (error) {
        console.error('Failed to parse saved workspace:', error);
      }
    }
  }, []);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Load workspaces and invites when user is authenticated
  useEffect(() => {
    if (user) {
      loadWorkspaces();
      loadPendingInvites();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setLoading(false);
        return;
      }

      // Check if this is a demo account
      const demoUser = localStorage.getItem('demoUser');
      
      if (demoUser && token.startsWith('demo_token_')) {
        try {
          const user = JSON.parse(demoUser);
          setUser(user);
          setLoading(false);
          return;
        } catch (e) {
          console.error('Failed to parse demo user:', e);
        }
      }

      // Regular user authentication
      const response = await apiService.getCurrentUser();
      if (response.data?.user) {
        setUser(response.data.user);
      } else if (response.error) {
        // Only clear token if it's an actual auth error (expired/invalid token)
        // Don't clear on network errors or other issues
        const isAuthError = response.error.toLowerCase().includes('token expired') ||
                           response.error.toLowerCase().includes('invalid token') ||
                           response.error.toLowerCase().includes('authentication required');
        
        if (isAuthError) {
          console.warn('[UserContext] Auth check failed with auth error, clearing token:', response.error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('demoUser');
        } else {
          console.warn('[UserContext] Auth check failed but not an auth error, keeping token:', response.error);
        }
      }
    } catch (error: any) {
      // Only clear token on actual auth errors, not network errors
      const errorMessage = error?.message || error?.error || String(error);
      const isAuthError = errorMessage.toLowerCase().includes('token expired') ||
                         errorMessage.toLowerCase().includes('invalid token') ||
                         errorMessage.toLowerCase().includes('401') ||
                         errorMessage.toLowerCase().includes('unauthorized');
      
      if (isAuthError) {
        console.error('[UserContext] Auth check failed with auth error, clearing token:', errorMessage);
        localStorage.removeItem('authToken');
        localStorage.removeItem('demoUser');
      } else {
        console.error('[UserContext] Auth check failed but not an auth error, keeping token:', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const response = await apiService.updateProfile(updates);
      if (response.data?.user) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  };

  const updatePreferences = async (preferences: any) => {
    try {
      const response = await apiService.updatePreferences(preferences);
      // Update user state with the response if provided
      if (response.data?.user) {
        setUser(response.data.user);
      } else {
        await refreshUser();
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  };

  const updateNotificationSettings = async (settings: any) => {
    try {
      const response = await apiService.updateNotificationSettings(settings);
      // Update user state with the response if provided
      if (response.data?.user) {
        setUser(response.data.user);
      } else {
        await refreshUser();
      }
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await apiService.getCurrentUser();
      if (response.data?.user) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const refreshWorkspaces = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await apiService.getUserWorkspaces();
      if (response.data?.workspaces) {
        setWorkspaces(response.data.workspaces);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const loadWorkspaces = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    // Check if this is a demo account
    const demoUser = localStorage.getItem('demoUser');
    if (demoUser && token.startsWith('demo_token_')) {
      // Don't load workspaces for demo account - dummy data is handled in Dashboard
      setWorkspaces([]);
      return;
    }

    try {
      const response = await apiService.getUserWorkspaces();
      if (response.data?.workspaces) {
        setWorkspaces(response.data.workspaces);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const loadPendingInvites = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    // Check if this is a demo account
    const demoUser = localStorage.getItem('demoUser');
    if (demoUser && token.startsWith('demo_token_')) {
      setPendingInvites([]);
      return;
    }

    try {
      const response = await apiService.getPendingInvites();
      if (response.data?.invites) {
        setPendingInvites(response.data.invites);
      } else {
        setPendingInvites([]);
      }
    } catch (error) {
      console.error('Failed to load pending invites:', error);
    }
  };

  const refreshInvites = async () => {
    await loadPendingInvites();
  };

  const acceptInvite = async (inviteId: number) => {
    try {
      await apiService.acceptWorkspaceInvitation(inviteId);
      // Refresh both workspaces and invites
      await Promise.all([loadWorkspaces(), loadPendingInvites()]);
    } catch (error) {
      console.error('Failed to accept invite:', error);
      throw error;
    }
  };

  const rejectInvite = async (inviteId: number) => {
    try {
      await apiService.rejectWorkspaceInvitation(inviteId);
      // Refresh invites
      await loadPendingInvites();
    } catch (error) {
      console.error('Failed to reject invite:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Only call backend logout if not a demo account
      const token = localStorage.getItem('authToken');
      if (token && !token.startsWith('demo_token_')) {
        await apiService.logout(); // Call backend logout API
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with local logout even if API call fails
    } finally {
      setUser(null); // Clear user context
      setWorkspaces([]); // Clear workspaces
      setCurrentWorkspace(null); // Clear current workspace
      localStorage.removeItem('authToken'); // Ensure token is removed
      localStorage.removeItem('demoUser'); // Remove demo user data
      localStorage.removeItem('currentWorkspace'); // Remove saved workspace
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      workspaces,
      pendingInvites,
      currentWorkspace,
      setCurrentWorkspace,
      loading, 
      isAuthenticated: !!user,
      updateProfile, 
      updatePreferences,
      updateNotificationSettings,
      refreshUser,
      refreshWorkspaces,
      refreshInvites,
      acceptInvite,
      rejectInvite,
      logout
    }}>
      {children}
    </UserContext.Provider>
  );
};

// Custom hook to use the context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};