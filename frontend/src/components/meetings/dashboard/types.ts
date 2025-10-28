export type TabType = 'all' | 'upcoming' | 'live' | 'history';
export type ViewType = 'list' | 'grid' | 'calendar' | 'kanban';

export interface MeetingParticipant { 
  name: string; 
  avatar: string;
  profilePictureUrl?: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  status: 'live' | 'upcoming' | 'completed';
  participants: MeetingParticipant[];
  summary?: string;
  topics?: string[];
  aiInsights?: number;
  tasks?: number;
  transcriptReady?: boolean;
  memoryLinks?: number;
  meetingLink?: string;
  backendId?: number;
}

