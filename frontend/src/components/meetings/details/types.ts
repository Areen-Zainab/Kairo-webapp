export interface MeetingDetailsData {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number; // in minutes
  status: 'recorded' | 'completed' | 'scheduled';
  platform?: 'zoom' | 'google-meet' | 'teams' | 'other' | string;
  organizer: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  participants: Participant[];
  meetingType: 'sprint-planning' | 'standup' | 'retrospective' | 'review' | 'brainstorming' | 'client-meeting' | 'other';
  description?: string;
  recordingUrl?: string;
  audioUrl?: string;
  transcript: TranscriptEntry[];
  slides: Slide[];
  minutes: MeetingMinute[];
  notes: MeetingNote[];
  files: MeetingFile[];
  aiInsights: AIInsight[];
  stats: {
    transcriptLength: number;
    minutesGenerated: number;
    slidesCount: number;
    participantsCount: number;
    audioDurationSeconds?: number;
    audioDurationMinutes?: number;
  };
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  /** Initials fallback (e.g. "JD"). Use profilePictureUrl for a real photo. */
  avatar?: string;
  /** Full URL to the user's profile picture, if available. */
  profilePictureUrl?: string | null;
  role: 'organizer' | 'participant' | 'presenter';
  joinedAt?: string;
  leftAt?: string;
}

export interface TranscriptEntry {
  id: string;
  timestamp: number; // in seconds (start time, for backwards compatibility)
  startTime?: number; // in seconds (precise start time)
  endTime?: number; // in seconds (precise end time)
  speaker: string;
  text: string;
  confidence: number;
  slideId?: string;
  imageId?: string;
  chunk?: number;
  chunkIndex?: number; // used by live speaker identification to patch speaker label
  audioFile?: string;
  rawTimestamp?: string; // ISO timestamp string
}

export interface Slide {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  timestamp: number; // when it was shown
  duration: number; // how long it was shown
}

export interface MeetingMinute {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  category: 'action-item' | 'decision' | 'discussion' | 'follow-up';
  participants: string[];
  priority: 'high' | 'medium' | 'low';
  aiGenerated: boolean;
}

export interface MeetingNote {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: number;
  type: 'timeline' | 'manual';
  color: string;
  tags: string[];
  linkedTranscriptId?: string;
}

export interface MeetingFile {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'document' | 'presentation' | 'other';
  url: string;
  size: number;
  uploadedBy: {
    id: string;
    name: string;
  };
  uploadedAt: string;
  linkedTranscriptId?: string;
}

export interface AIInsight {
  id: string;
  type: 'summary' | 'action-item' | 'decision' | 'follow-up' | 'question';
  content: string;
  confidence: number;
  linkedTranscriptId?: string;
  linkedMinuteId?: string;
  participants: string[];
}

export interface TabContent {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType<any>;
}

export interface VideoPlayerProps {
  recordingUrl?: string;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  isPlaying: boolean;
}

export interface TranscriptTimelineProps {
  transcript: TranscriptEntry[];
  currentTime: number;
  onTimestampClick: (timestamp: number) => void;
  onTranscriptHover: (entry: TranscriptEntry) => void;
}

export interface MultiModalPanelProps {
  slides: Slide[];
  currentTime: number;
  onSlideClick: (slide: Slide) => void;
  hoveredTranscript?: TranscriptEntry;
}

export interface MeetingMinutesProps {
  minutes: MeetingMinute[];
  meeting?: MeetingDetailsData; // Optional: for generating minutes from insights
  insights?: any; // Optional: AI insights data for generation
  onMinuteHover: (minute: MeetingMinute) => void;
  onMinuteClick: (minute: MeetingMinute) => void;
  onExport: (format: 'pdf' | 'markdown') => void;
}

export interface NotesPanelProps {
  notes: MeetingNote[];
  onAddNote: (note: Omit<MeetingNote, 'id'>) => void;
  onUpdateNote: (id: string, note: Partial<MeetingNote>) => void;
  onDeleteNote: (id: string) => void;
  currentTime: number;
}

export interface MentionsPanelProps {
  mentions: AIInsight[];
  currentUser: {
    id: string;
    name: string;
  };
  onGeneratePersonalSummary: () => void;
}

export interface FilesPanelProps {
  files: MeetingFile[];
  onFileClick: (file: MeetingFile) => void;
  onFileDownload: (file: MeetingFile) => void;
  onFileUpload?: (file: File) => void;
  onFileDelete?: (fileId: string) => void;
  currentTime: number;
}
