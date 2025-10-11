// Shared types for Settings

export interface UserProfile {
  name: string;
  email: string;
  profilePicture: string | null;
  audioSample: File | null;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  desktop: boolean;
  meetingReminders: boolean;
  transcriptionComplete: boolean;
  weeklyDigest: boolean;
}

export interface MeetingPreferences {
  autoJoin: boolean;
  autoRecord: boolean;
  defaultDuration: number;
  timezone: string;
}

export interface ThemeSettings {
  mode: 'light' | 'dark';
  accentColor: string;
}

export interface SecuritySettings {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  twoFactorEnabled: boolean;
}

export interface ActiveSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export type TabType = 'profile' | 'preferences' | 'theme' | 'security' | 'notifications';