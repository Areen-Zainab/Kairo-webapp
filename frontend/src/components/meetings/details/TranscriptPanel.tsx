import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, ChevronLeft, ChevronRight, Play, Pause, Volume2, Maximize2, SkipForward, SkipBack, VolumeX, Volume1, Captions, Filter, Users, ArrowDownToLine, StickyNote, UserPlus, Fingerprint, History, UserCheck } from 'lucide-react';
import type { MeetingDetailsData, TranscriptEntry, Slide, MeetingNote } from './types';
import apiService from '../../../services/api';
import SpeakerAssignmentPopover from './SpeakerAssignmentPopover';


interface SpeakerMapping {
  speakerLabel: string;
  userId: number | null;
  userName: string | null;
  profilePictureUrl?: string | null;
  confidenceScore: number;
  tierResolved: number;
  resolved: boolean;
}


interface TranscriptPanelProps {
  meeting: MeetingDetailsData;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onTimestampClick: (timestamp: number) => void;
  onTranscriptHover: (entry: TranscriptEntry) => void;
  onSlideClick: (slide: Slide) => void;
  onAddNote: (note: Omit<MeetingNote, 'id'>) => void;
  onDeleteNote: (id: string) => void;
  actionItems?: any[];
  aiInsights?: any;
  /** Increment this value to force a re-fetch of speaker mappings (e.g. after reprocess). */
  mappingsRefreshTick?: number;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  meeting,
  currentTime,
  onTimeUpdate,
  onTimestampClick,
  onTranscriptHover,
  onSlideClick,
  onAddNote,
  onDeleteNote,
  actionItems = [],
  aiInsights,
  mappingsRefreshTick = 0,
}) => {

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useAudio, setUseAudio] = useState(false);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(1); // 0 to 1
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1); // 0.5, 0.75, 1, 1.25, 1.5, 2
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [mediaCurrentTime, setMediaCurrentTime] = useState(0); // Local state for current playback time
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [progressHoverPosition, setProgressHoverPosition] = useState<number | null>(null);
  const [isHoveringPlayer, setIsHoveringPlayer] = useState(false); // Track hover state for controls visibility
  const [scrollProgress, setScrollProgress] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showCaptions, setShowCaptions] = useState(true); // Caption overlay toggle
  const [isSeeking, setIsSeeking] = useState(false); // Track if user is seeking
  const [speakerMappings, setSpeakerMappings] = useState<Record<string, SpeakerMapping>>({});
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  /** chunkIndex → identified speaker name; used to patch live transcript speaker labels */
  const [liveSpeakerOverrides, setLiveSpeakerOverrides] = useState<Record<number, string>>({});
  const [activePopover, setActivePopover] = useState<string | null>(null); // speakerLabel
  const [activeRightTab, setActiveRightTab] = useState<'slides' | 'notes'>('slides');
  const [newNote, setNewNote] = useState('');
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(true); // Collapsed by default


  
  // NEW: Filtering states
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'action-items' | 'decisions' | 'questions'>('all');
  
  // Auto-scroll control
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<number | null>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedTimeRef = useRef<number>(0); // Track last synced time for better accuracy

  // Helper function to check if transcript entry contains action item or decision
  const getEntryContentType = (entry: TranscriptEntry): 'action-item' | 'decision' | 'question' | 'normal' => {
    const text = entry.text.toLowerCase();
    
    // Check for action items
    if (text.includes('need to') || text.includes('should') || text.includes('will') || 
        text.includes('action item') || text.includes('todo') || text.includes('task')) {
      return 'action-item';
    }
    
    // Check for decisions
    if (text.includes('decided') || text.includes('agree') || text.includes('decision') || 
        text.includes('let\'s go with') || text.includes('we\'ll') || text.includes('approved')) {
      return 'decision';
    }
    
    // Check for questions
    if (text.includes('?') || text.match(/\b(what|why|how|when|where|who|can|could|should|would)\b/)) {
      return 'question';
    }
    
    return 'normal';
  };

  // Helper function to find notes that match a transcript entry timestamp
  const getNotesForEntry = (entry: TranscriptEntry): MeetingNote[] => {
    if (!meeting.notes || meeting.notes.length === 0) return [];
    
    // Find notes within +/- 2 seconds of this entry's timestamp
    const tolerance = 2; // seconds
    const entryTime = entry.startTime !== undefined ? entry.startTime : entry.timestamp;
    
    return meeting.notes.filter(note => {
      const timeDiff = Math.abs(note.timestamp - entryTime);
      return timeDiff <= tolerance;
    });
  };

  // Filter transcript based on search query, speaker, and content type
  const filteredTranscript = meeting.transcript
    .filter(entry => {
      // Search filter
      const matchesSearch = 
      entry.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.speaker.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      
      // Speaker filter
      const matchesSpeaker = selectedSpeakers.length === 0 || selectedSpeakers.includes(entry.speaker);
      
      if (!matchesSpeaker) return false;
      
      // Content type filter
      if (contentTypeFilter !== 'all') {
        const entryType = getEntryContentType(entry);
        // Map filter values (plural) to entry types (singular)
        const filterMap: Record<string, string> = {
          'action-items': 'action-item',
          'decisions': 'decision',
          'questions': 'question'
        };
        return entryType === (filterMap[contentTypeFilter] || contentTypeFilter);
      }
      
      return true;
    })
    .sort((a, b) => (a.startTime ?? a.timestamp) - (b.startTime ?? b.timestamp)); // Always sort by start time

  // Find the active entry based on current time using timestamp field
  // Timestamps are now normalized to start from 0 to match audio/video playback
  // Improved with better time synchronization and tolerance
  // CRITICAL: Uses mediaCurrentTime (local state) for instant sync with audio element
  const getActiveEntryIndex = useCallback(() => {
    // If no transcript entries, return -1
    if (filteredTranscript.length === 0) {
      return -1;
    }

    // Use mediaCurrentTime (actual audio position) instead of currentTime prop for instant sync
    const timeToCheck = mediaCurrentTime;
    
    // If time is negative, don't highlight anything
    // Allow 0 to match first entry if it starts at 0
    if (timeToCheck < 0) {
      return -1;
    }

    // Use a small tolerance for better synchronization (0.2 seconds)
    const tolerance = 0.2;

    // Find the entry where timeToCheck falls within its range
    // Iterate backwards to find the most recent matching entry
    for (let i = filteredTranscript.length - 1; i >= 0; i--) {
      const entry = filteredTranscript[i];
      const nextEntry = filteredTranscript[i + 1];
      
      // Use timestamp field (normalized to start from 0) for accurate syncing with audio
      // Prefer startTime if available (more precise), otherwise use timestamp
      const entryStartTime = entry.startTime !== undefined ? entry.startTime : entry.timestamp;
      
      // End time: prefer endTime, then next entry's start, then estimate
      const entryEndTime = entry.endTime !== undefined 
        ? entry.endTime 
        : (nextEntry 
          ? (nextEntry.startTime !== undefined ? nextEntry.startTime : nextEntry.timestamp)
          : entryStartTime + (entry.text.length / 10)); // Estimate based on text length if no endTime
      
      // Match if timeToCheck is within the entry's time range (with tolerance)
      // Use >= for start (inclusive) and < for end (exclusive) to avoid double-matching
      if (timeToCheck >= (entryStartTime - tolerance) && timeToCheck < (entryEndTime + tolerance)) {
        return i;
      }
    }
    
    // If no match found, return -1 (don't highlight anything)
    return -1;
  }, [filteredTranscript, mediaCurrentTime]);

  const activeEntryIndex = getActiveEntryIndex();
  
  // Get current active transcript entry for captions
  const activeEntry = activeEntryIndex >= 0 ? filteredTranscript[activeEntryIndex] : null;

  // Extract unique speakers for legend
  const uniqueSpeakers = React.useMemo(() => {
    const speakers = new Map<string, { count: number; color: string; mapping?: SpeakerMapping }>();
    filteredTranscript.forEach(entry => {
      if (!speakers.has(entry.speaker)) {
        const mapping = speakerMappings[entry.speaker];
        const speakerNum = entry.speaker.match(/\d+/)?.[0];
        const colors = [
          'from-blue-500 via-blue-600 to-blue-700',
          'from-purple-500 via-purple-600 to-purple-700',
          'from-emerald-500 via-emerald-600 to-emerald-700',
          'from-amber-500 via-amber-600 to-amber-700',
          'from-rose-500 via-rose-600 to-rose-700',
          'from-indigo-500 via-indigo-600 to-indigo-700',
        ];
        const color = entry.speaker === 'UNKNOWN' 
          ? 'from-slate-400 to-slate-500'
          : colors[parseInt(speakerNum || '0') % colors.length] || colors[0];
        
        speakers.set(entry.speaker, { count: 0, color, mapping });
      }
      const speakerData = speakers.get(entry.speaker)!;
      speakerData.count++;
    });
    return Array.from(speakers.entries()).map(([label, data]) => ({ label, ...data }));
  }, [filteredTranscript, speakerMappings]);


  // Get speaker color function
  const getSpeakerColor = (speaker: string) => {
    if (speaker === 'UNKNOWN') {
      return 'bg-gradient-to-br from-slate-400 to-slate-500';
    }
    const speakerNum = speaker.match(/\d+/)?.[0];
    const colors = [
      'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700',
      'bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700',
      'bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700',
      'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700',
      'bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700',
      'bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700',
    ];
    return colors[parseInt(speakerNum || '0') % colors.length] || colors[0];
  };

  /**
   * Renders a speaker avatar: real profile photo if resolved + photo available,
   * otherwise falls back to the gradient+initials tile.
   */
  const renderSpeakerAvatar = (
    speaker: string,
    mapping: SpeakerMapping | undefined,
    initials: string,
    extraCls = ''
  ) => {
    const pfp = mapping?.resolved ? mapping.profilePictureUrl : null;
    const base = `flex-shrink-0 w-10 h-10 rounded-lg shadow-sm transition-transform ${extraCls}`;
    if (pfp) {
      return (
        <div className={`${base} overflow-hidden ring-2 ring-white/30 dark:ring-slate-700`}>
          <img src={pfp} alt={mapping?.userName || speaker} className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div className={`${base} ${getSpeakerColor(speaker)} flex items-center justify-center text-white font-bold text-sm`}>
        {mapping?.resolved && mapping.userName
          ? mapping.userName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
          : initials}
      </div>
    );
  };

  // Calculate scroll progress
  const handleScrollProgress = () => {
    if (transcriptScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = transcriptScrollRef.current;
      const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
      setScrollProgress(isNaN(progress) ? 0 : progress);
    }
  };

  // Always prefer audio for playback when audioUrl is available (complete recording from meeting folder)
  // Use audioUrl if available, otherwise fallback to recordingUrl
  useEffect(() => {
    // If audioUrl is explicitly provided (complete recording from meeting folder), always use audio
    if (meeting.audioUrl) {
      setUseAudio(true);
      return;
    }

    // If no audioUrl, check recordingUrl
    if (!meeting.recordingUrl) {
      setUseAudio(true); // Default to audio if no recording URL
      return;
    }

    // Check file extension for quick detection
    const url = meeting.recordingUrl.toLowerCase();
    const isAudioExtension = url.includes('.mp3') || url.includes('.wav') || url.includes('.m4a') || url.includes('.ogg');
    const isVideoExtension = url.includes('.mp4') || url.includes('.mov') || url.includes('.avi');
    const isWebM = url.includes('.webm'); // Can be both audio and video

    // If it's clearly an audio extension, use audio
    if (isAudioExtension) {
      setUseAudio(true);
      return;
    }

    // For video extensions, try video but fallback to audio if video fails
    // For webm or ambiguous cases, default to audio (since user wants audio always playable)
    if (isVideoExtension && !isWebM) {
      // Try video first, but error handler will switch to audio if it fails
      setUseAudio(false);
    } else {
      // Default to audio for webm/ambiguous/unknown cases
      setUseAudio(true);
    }
  }, [meeting.recordingUrl, meeting.audioUrl]);

  // Fetch Speaker Mappings
  const fetchSpeakerMappings = useCallback(async () => {
    if (!meeting.id) return;
    setIsLoadingMappings(true);
    try {
      const response = await apiService.getMeetingSpeakerMappings(Number(meeting.id));
      if (response?.data?.mappings) {
        const mappings: Record<string, SpeakerMapping> = {};
        response.data.mappings.forEach((m: any) => {
          const entry: SpeakerMapping = {
            speakerLabel:     m.speakerLabel,
            userId:           m.userId ?? null,
            userName:         m.userName ?? null,
            profilePictureUrl: m.profilePictureUrl ?? null,
            confidenceScore:  m.confidenceScore ?? 0,
            tierResolved:     m.tierResolved ?? 4,
            resolved:         m.isResolved ?? (m.userId !== null),
          };
          // Index by original label (e.g. "SPEAKER_00")
          mappings[m.speakerLabel] = entry;
          // Also index by resolved name so entries whose speaker field
          // was cascade-updated to the real name (e.g. "Hafsa Imtiaz")
          // still get the correct mapping and badge.
          if (entry.resolved && entry.userName) {
            mappings[entry.userName] = entry;
          }
        });
        setSpeakerMappings(mappings);
      }
    } catch (err) {
      console.error('Failed to fetch speaker mappings:', err);
    } finally {
      setIsLoadingMappings(false);
    }
  }, [meeting.id]);

  useEffect(() => {
    fetchSpeakerMappings();
  }, [fetchSpeakerMappings]);

  // Re-fetch when parent signals a reprocess completed.
  useEffect(() => {
    if (mappingsRefreshTick > 0) fetchSpeakerMappings();
  }, [mappingsRefreshTick, fetchSpeakerMappings]);

  // Listen for live speaker_identified WS events so the transcript updates
  // immediately when post-meeting identification finishes (e.g. during reprocess).
  useEffect(() => {
    if (!meeting.id) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const ws = new WebSocket(
      `ws://localhost:5000/ws/transcript?meetingId=${meeting.id}&token=${token}`
    );

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Post-meeting speaker identification result (after reprocess)
        if (msg.type === 'speaker_identified' && Array.isArray(msg.data?.mappings)) {
          setSpeakerMappings(prev => {
            const updated = { ...prev };
            (msg.data.mappings as Array<{
              speakerLabel: string;
              userId: number | null;
              userName: string | null;
              profilePictureUrl?: string | null;
              confidenceScore: number;
              tierResolved: number;
            }>).forEach(m => {
              const entry: SpeakerMapping = {
                speakerLabel:      m.speakerLabel,
                userId:            m.userId,
                userName:          m.userName,
                profilePictureUrl: m.profilePictureUrl ?? null,
                confidenceScore:   m.confidenceScore,
                tierResolved:      m.tierResolved,
                resolved:          m.userId !== null,
              };
              updated[m.speakerLabel] = entry;
              if (entry.resolved && entry.userName) {
                updated[entry.userName] = entry;
              }
            });
            return updated;
          });
        }

        // Live per-chunk speaker identification result (during active meeting)
        if (msg.type === 'live_speaker_update' && msg.data?.speaker && msg.data?.chunkIndex != null) {
          const { chunkIndex, speaker, userId } = msg.data as {
            chunkIndex: number;
            speaker: string;
            userId: number | null;
          };
          // Store a chunkIndex → speaker name override; the render loop uses this
          setLiveSpeakerOverrides(prev => ({ ...prev, [chunkIndex]: speaker }));
          // Store a live biometric mapping so identification badge renders for this name
          if (userId != null) {
            setSpeakerMappings(prev => ({
              ...prev,
              [speaker]: {
                speakerLabel:      speaker,
                userId,
                userName:          speaker,
                profilePictureUrl: null,
                confidenceScore:   msg.data.confidence ?? 0,
                tierResolved:      1,
                resolved:          true,
              },
            }));
          }
        }
      } catch (_) {}
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [meeting.id]);


  // Fetch audio as blob and create object URL when audioUrl changes (for authenticated requests)
  useEffect(() => {
    const audioSource = meeting.audioUrl || meeting.recordingUrl;
    
    // Cleanup previous object URL if it exists
    if (audioObjectUrlRef.current && audioObjectUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }

    if (!audioSource) {
      setAudioObjectUrl(null);
      return;
    }

    // If it's a local audioUrl (needs authentication), fetch as blob
    if (meeting.audioUrl && meeting.audioUrl.startsWith('http')) {
      const fetchAudio = async () => {
        try {
          const token = localStorage.getItem('authToken');
          if (!token) {
            setAudioObjectUrl(null);
            return;
          }
          
          const response = await fetch(audioSource, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch audio: ${response.status} - ${errorText}`);
          }

          const blob = await response.blob();
          
          if (blob.size === 0) {
            setAudioObjectUrl(null);
            return;
          }
          
          const objectUrl = URL.createObjectURL(blob);
          audioObjectUrlRef.current = objectUrl;
          setAudioObjectUrl(objectUrl);
        } catch (error) {
          console.error('Error fetching audio:', error);
          setAudioObjectUrl(null);
        }
      };

      fetchAudio();
    } else {
      // For recordingUrl or non-authenticated URLs, use directly
      audioObjectUrlRef.current = audioSource;
      setAudioObjectUrl(audioSource);
    }

    // Cleanup function to revoke object URL when component unmounts or URL changes
    return () => {
      if (audioObjectUrlRef.current && audioObjectUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
    };
  }, [meeting.recordingUrl, meeting.audioUrl]);

  // Update audio element properties when they change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioObjectUrl) return;

    // Update volume, muted, and playback rate
    audio.volume = volume;
    audio.muted = isMuted;
    audio.playbackRate = playbackRate;
  }, [audioObjectUrl, volume, isMuted, playbackRate]); // Update when settings change

  // Update video volume and playback rate when they change
  useEffect(() => {
    if (!useAudio && videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
      videoRef.current.playbackRate = playbackRate;
    }
  }, [volume, isMuted, playbackRate, useAudio]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumeSliderRef.current && !volumeSliderRef.current.contains(event.target as Node)) {
        setShowVolumeSlider(false);
      }
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setShowSpeedMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle media time updates (works for both video and audio)
  // Improved with better synchronization and seeking detection
  const handleTimeUpdate = useCallback(() => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement && !isSeeking) {
      const newTime = mediaElement.currentTime;
      
      // Only update if time has changed significantly (avoid micro-updates)
      if (Math.abs(newTime - lastSyncedTimeRef.current) > 0.1) {
        setMediaCurrentTime(newTime); // Update local state for display
        onTimeUpdate(newTime); // Also update parent component
        lastSyncedTimeRef.current = newTime;
      }
    }
  }, [useAudio, isSeeking, onTimeUpdate]);

  // Handle play/pause (works for both video and audio)
  const handlePlayPause = async () => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement) {
      if (isPlaying) {
        mediaElement.pause();
      } else {
        try {
          await mediaElement.play();
        } catch (error) {
          console.error('Error playing media:', error);
        }
      }
    }
  };

  // Handle skip forward (10 seconds)
  const handleSkipForward = () => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement) {
      mediaElement.currentTime = Math.min(mediaElement.currentTime + 10, mediaElement.duration);
      setMediaCurrentTime(mediaElement.currentTime); // Update immediately
      handleTimeUpdate(); // Trigger update
    }
  };

  // Handle skip backward (10 seconds)
  const handleSkipBackward = () => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement) {
      mediaElement.currentTime = Math.max(mediaElement.currentTime - 10, 0);
      setMediaCurrentTime(mediaElement.currentTime); // Update immediately
      handleTimeUpdate(); // Trigger update
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      audioRef.current.muted = newVolume === 0;
    }
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.muted = newMuted;
    }
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
  };

  // Handle playback rate change
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  // Handle seek (progress bar click)
  // Improved with visual feedback and smooth seeking
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (!mediaElement || !mediaElement.duration) return;

    setIsSeeking(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * mediaElement.duration;
    
    // Update immediately for responsive UI
    mediaElement.currentTime = newTime;
    setMediaCurrentTime(newTime);
    lastSyncedTimeRef.current = newTime;
    setProgressHoverPosition(null);
    
    // Clear any existing timeout
    if (seekTimeoutRef.current) {
      clearTimeout(seekTimeoutRef.current);
    }
    
    // Mark seeking as complete after a short delay
    seekTimeoutRef.current = setTimeout(() => {
      setIsSeeking(false);
      onTimeUpdate(newTime);
    }, 100);
  }, [useAudio, onTimeUpdate]);

  // Handle progress bar hover
  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (!mediaElement) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    setProgressHoverPosition(percentage * mediaElement.duration);
  };

  // Get current duration for display
  const getCurrentDuration = () => {
    // Always prefer audioDuration if available
    if (audioDuration !== null && audioDuration > 0) {
      return audioDuration;
    }
    
    // Try to get from media element
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement && mediaElement.duration && isFinite(mediaElement.duration) && mediaElement.duration > 0) {
      // Update audioDuration if we get a valid duration from the element
      if (useAudio && audioDuration !== mediaElement.duration) {
        setAudioDuration(mediaElement.duration);
      }
      return mediaElement.duration;
    }
    
    // Fallback to meeting duration (in minutes, convert to seconds)
    return meeting.duration * 60;
  };

  // Scroll to active entry (when audio plays or entry is clicked)
  const scrollToEntry = (entry: TranscriptEntry) => {
    if (!entry || isUserScrollingRef.current) return;
    // Use timestamp field (start_time from JSON) for accurate syncing
    const entryTime = entry.timestamp;
    const currentEntry = document.querySelector(`[data-timestamp="${entryTime}"]`);
    if (currentEntry && transcriptRef.current) {
      // Check if entry is already in viewport to avoid unnecessary scrolling
      const container = transcriptRef.current.parentElement;
      if (container) {
        const entryRect = currentEntry.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Check if entry is at least partially visible in the center area
        const entryCenter = entryRect.top + entryRect.height / 2;
        const containerCenter = containerRect.top + containerRect.height / 2;
        const distanceFromCenter = Math.abs(entryCenter - containerCenter);
        const threshold = containerRect.height * 0.3; // 30% of container height
        
        // Only scroll if entry is not near the center
        if (distanceFromCenter > threshold) {
          currentEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        currentEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Handle timestamp click (works for both video and audio)
  // Improved with smooth seeking and visual feedback
  const handleTimestampClick = useCallback((timestamp: number, entry?: TranscriptEntry) => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement) {
      setIsSeeking(true);
      // Use timestamp field (calculated from ISO timestamp) for accurate seeking
      const seekTime = entry ? entry.timestamp : timestamp;
      mediaElement.currentTime = seekTime;
      setMediaCurrentTime(seekTime);
      lastSyncedTimeRef.current = seekTime;
      onTimestampClick(seekTime);
      
      // Clear any existing timeout
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
      
      // Mark seeking as complete
      seekTimeoutRef.current = setTimeout(() => {
        setIsSeeking(false);
      }, 100);
      
      // Scroll to the clicked entry immediately
      if (entry) {
        setTimeout(() => scrollToEntry(entry), 150); // Small delay to ensure DOM is updated
      }
    }
  }, [useAudio, onTimestampClick]);

  // Handle transcript hover
  const handleTranscriptHover = (entry: TranscriptEntry) => {
    onTranscriptHover(entry);
  };

  // Handle slide click
  const handleSlideClick = (slide: Slide) => {
    onSlideClick(slide);
  };

  // Handle adding a new note
  const handleAddNote = () => {
    if (newNote.trim()) {
      onAddNote({
        content: newNote.trim(),
        timestamp: currentTime,
        type: 'manual',
        color: 'blue',
        tags: [],
        author: {
          id: 'current-user', // Should come from context
          name: 'Current User',
          avatar: 'CU'
        }
      });
      setNewNote('');
    }
  };

  // Handle note key press
  const handleNoteKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  // Sync external currentTime updates with media element (only when not playing to avoid conflicts)
  useEffect(() => {
    if (isPlaying) return; // Don't sync while playing to avoid conflicts
    
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement && Math.abs(mediaElement.currentTime - currentTime) > 0.5) {
      // Only update if difference is significant to avoid feedback loops
      mediaElement.currentTime = currentTime;
      setMediaCurrentTime(currentTime); // Also update local state
    }
  }, [currentTime, useAudio, isPlaying]);

  // Initialize mediaCurrentTime from currentTime prop when component mounts
  useEffect(() => {
    setMediaCurrentTime(currentTime);
  }, []);

  // Auto-hide controls when playing and not hovering (YouTube-style)
  useEffect(() => {
    if (isPlaying && !isHoveringPlayer) {
      // Clear any existing timeout
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      // Set new timeout to hide controls after 3 seconds
      hideControlsTimeoutRef.current = setTimeout(() => {
        // Controls will hide based on isHoveringPlayer state
      }, 3000);
    } else {
      // Clear timeout when paused or hovering
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
        hideControlsTimeoutRef.current = null;
      }
    }

    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [isPlaying, isHoveringPlayer]);

  // Scroll to current time in transcript as audio plays (only if auto-scroll is enabled and user isn't manually scrolling)
  // Uses mediaCurrentTime indirectly through activeEntryIndex for accurate sync
  useEffect(() => {
    if (transcriptRef.current && activeEntryIndex >= 0 && !isUserScrollingRef.current && autoScrollEnabled) {
      const activeEntry = filteredTranscript[activeEntryIndex];
      if (activeEntry) {
        scrollToEntry(activeEntry);
      }
    }
  }, [activeEntryIndex, filteredTranscript, autoScrollEnabled]);

  // Handle manual scrolling - disable auto-scroll when user scrolls
  const handleTranscriptScroll = () => {
    isUserScrollingRef.current = true;
    setAutoScrollEnabled(false); // Disable auto-scroll when user manually scrolls
    handleScrollProgress();
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    // Re-enable auto-scroll after 5 seconds of no scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 5000);
  };

  // Re-enable auto-scroll manually
  const enableAutoScroll = () => {
    setAutoScrollEnabled(true);
    isUserScrollingRef.current = false;
    // Immediately scroll to active entry
    if (transcriptRef.current && activeEntryIndex >= 0) {
      const activeEntry = filteredTranscript[activeEntryIndex];
      if (activeEntry) {
        scrollToEntry(activeEntry);
      }
    }
  };

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts for playback control
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const mediaElement = useAudio ? audioRef.current : videoRef.current;
      if (!mediaElement) return;

      switch (e.key) {
        case ' ': // Spacebar - Play/Pause
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft': // Left arrow - Rewind 10 seconds
          e.preventDefault();
          handleSkipBackward();
          break;
        case 'ArrowRight': // Right arrow - Forward 10 seconds
          e.preventDefault();
          handleSkipForward();
          break;
        case 'ArrowUp': // Up arrow - Increase volume
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown': // Down arrow - Decrease volume
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'm': // M key - Mute/Unmute
        case 'M':
          e.preventDefault();
          handleMuteToggle();
          break;
        case 'f': // F key - Fullscreen (video only)
        case 'F':
          if (!useAudio) {
            e.preventDefault();
            setIsFullscreen(!isFullscreen);
          }
          break;
        case 'c': // C key - Toggle captions
        case 'C':
          e.preventDefault();
          setShowCaptions(!showCaptions);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [useAudio, isPlaying, volume, isFullscreen, showCaptions]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration for display (exact time, not rounded)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) {
      return `${secs} second${secs !== 1 ? 's' : ''}`;
    } else if (secs === 0) {
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
      return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-900">
      {/* Top Bar - Media Player (Video or Audio) */}
      <div 
        className={`relative ${useAudio ? 'bg-slate-800' : 'bg-black'} shadow-lg`}
        onMouseEnter={() => {
          setIsHoveringPlayer(true);
          // Clear hide timeout when hovering
          if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
            hideControlsTimeoutRef.current = null;
          }
        }}
        onMouseLeave={() => {
          setIsHoveringPlayer(false);
          // Start hide timeout when leaving (only if playing)
          if (isPlaying) {
            hideControlsTimeoutRef.current = setTimeout(() => {
              // State will be managed by the effect
            }, 3000);
          }
        }}
      >
        {/* Always render audio element to get duration and enable playback */}
        {(meeting.audioUrl || meeting.recordingUrl) && audioObjectUrl && (
          <audio
            ref={audioRef}
            src={audioObjectUrl}
            className="hidden" // Always hidden, UI is shown separately
            onTimeUpdate={useAudio ? handleTimeUpdate : undefined}
            onPlay={useAudio ? () => {
              setIsPlaying(true);
              handleTimeUpdate(); // Update time immediately on play
            } : undefined}
            onPause={useAudio ? () => {
              setIsPlaying(false);
              handleTimeUpdate(); // Update time on pause
            } : undefined}
            onSeeked={useAudio ? handleTimeUpdate : undefined}
            onLoadedMetadata={() => {
              const audio = audioRef.current;
              if (audio && audio.duration && isFinite(audio.duration) && audio.duration > 0) {
                setAudioDuration(audio.duration);
              }
            }}
            onCanPlay={() => {
              const audio = audioRef.current;
              if (audio && audio.duration && isFinite(audio.duration) && audio.duration > 0) {
                if (!audioDuration || Math.abs(audioDuration - audio.duration) > 1) {
                  setAudioDuration(audio.duration);
                }
              }
            }}
            onLoadedData={() => {
              const audio = audioRef.current;
              if (audio && audio.duration && isFinite(audio.duration) && audio.duration > 0 && !audioDuration) {
                setAudioDuration(audio.duration);
              }
            }}
            onError={(e) => {
              console.error('Audio playback error:', meeting.audioUrl || meeting.recordingUrl, e);
              const audio = audioRef.current;
              if (audio && audio.error) {
                console.error('Audio error details:', {
                  error: audio.error,
                  code: audio.error?.code,
                  message: audio.error?.message,
                  networkState: audio.networkState,
                  readyState: audio.readyState
                });
                
                // Set user-friendly error message
                if (audio.error.code === 4) {
                  setAudioError('Audio file is corrupted or not supported. Please contact support.');
                } else if (audio.error.code === 3) {
                  setAudioError('Audio file format is not supported by your browser.');
                } else if (audio.error.code === 2) {
                  setAudioError('Network error while loading audio. Please check your connection.');
                } else {
                  setAudioError('Unable to load audio file. It may be corrupted or unavailable.');
                }
              }
            }}
            onLoadStart={() => {
              // Clear error when starting to load
              setAudioError(null);
            }}
            preload="metadata"
            crossOrigin="anonymous"
          >
            Your browser does not support the audio tag.
          </audio>
        )}
        
        {/* Audio Error Banner */}
        {audioError && (
          <div className="w-full bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 p-4">
            <div className="flex items-center gap-3 max-w-6xl mx-auto">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Audio Playback Error
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  {audioError}
                </p>
              </div>
              <button
                onClick={() => setAudioError(null)}
                className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        
        {useAudio ? (
          // Clean, Modern Audio Player
          <div className="w-full bg-slate-900 py-3">
            <div className="max-w-4xl mx-auto px-6">
              {/* Audio Icon and Title */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                  <Volume2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Meeting Audio</h3>
                  <p className="text-slate-400 text-xs">High-quality recording</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Video Player with Caption Overlay
          <div className="relative w-full h-80 bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.volume = volume;
                  videoRef.current.muted = isMuted;
                  videoRef.current.playbackRate = playbackRate;
                }
              }}
              onSeeked={() => {
                setIsSeeking(false);
                handleTimeUpdate();
              }}
              onError={() => {
                // If video fails to load, switch to audio
                setUseAudio(true);
              }}
              controls={false}
            >
              <source src={meeting.recordingUrl || meeting.audioUrl} type="video/mp4" />
              <source src={meeting.recordingUrl || meeting.audioUrl} type="video/webm" />
              Your browser does not support the video tag.
            </video>
            
            {/* Caption Overlay - YouTube-style */}
            {showCaptions && activeEntry && (
              <div className="absolute bottom-20 left-0 right-0 px-4 pointer-events-none z-10">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-black/75 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-full ${getSpeakerColor(activeEntry.speaker)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {activeEntry.speaker.replace(/[^A-Z0-9]/g, '').substring(0, 2) || activeEntry.speaker.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-white/90 font-semibold text-sm">
                        {activeEntry.speaker.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-white text-lg font-medium leading-relaxed">
                      {activeEntry.text}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Video Play/Pause Overlay Button */}
            <div 
              className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
                isHoveringPlayer || !isPlaying ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <button
                onClick={handlePlayPause}
                className="bg-black/50 hover:bg-black/70 rounded-full p-6 transition-all backdrop-blur-sm pointer-events-auto shadow-2xl"
              >
                {isPlaying ? (
                  <Pause className="w-12 h-12 text-white drop-shadow-lg" />
                ) : (
                  <Play className="w-12 h-12 text-white drop-shadow-lg ml-1" />
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Integrated Media Controls - Clean, modern design */}
        <div className={`${useAudio ? 'bg-slate-900' : 'absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10'}`}>
          <div className={useAudio ? 'max-w-4xl mx-auto px-6 pb-3' : 'w-full'}>
            {/* Progress Bar Section */}
            <div className={useAudio ? 'mb-2' : 'px-4 pt-3 pb-2'}>
              <div className="relative">
                {/* Time labels above progress bar (for audio only) */}
        {useAudio && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono font-semibold text-white">
                      {formatTime(mediaCurrentTime)}
                    </span>
                    <span className="text-sm font-mono text-slate-400">
                      {formatTime(getCurrentDuration())}
                    </span>
          </div>
        )}

                {/* Progress bar */}
            <div
              ref={progressBarRef}
              onClick={handleSeek}
              onMouseMove={handleProgressHover}
              onMouseLeave={() => setProgressHoverPosition(null)}
                  className="group cursor-pointer relative"
            >
                  <div className={`bg-slate-700 rounded-full overflow-hidden relative ${useAudio ? 'h-2 hover:h-2.5' : 'h-1.5 hover:h-2'} transition-all`}>
              <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 relative transition-all"
                style={{
                  width: `${(mediaCurrentTime / getCurrentDuration()) * 100}%`
                }}
              >
                      <div className={`absolute right-0 top-1/2 -translate-y-1/2 ${useAudio ? 'w-4 h-4' : 'w-3 h-3'} bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>
            </div>
            
                  {/* Hover tooltip */}
            {progressHoverPosition !== null && progressBarRef.current && (
              <div
                      className="absolute -top-10 bg-slate-800 text-white text-sm font-semibold px-3 py-1.5 rounded-lg pointer-events-none shadow-xl border border-slate-700 z-50"
                style={{
                  left: `${(progressHoverPosition / getCurrentDuration()) * 100}%`,
                  transform: 'translate(-50%, 0)'
                }}
              >
                  {formatTime(progressHoverPosition)}
                </div>
                  )}
                      </div>
              </div>
          </div>

          {/* Controls Row */}
            <div className="flex items-center justify-between px-4 py-2">
              {/* Left: Playback Controls */}
              <div className="flex items-center gap-2">
              {/* Skip Backward */}
              <button
                onClick={handleSkipBackward}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-all active:scale-95"
                  title="Rewind 10s (←)"
              >
                  <SkipBack className="w-5 h-5 text-white" />
              </button>
              
                {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                  className="w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-xl transition-all active:scale-95 shadow-lg"
                  title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </button>
              
              {/* Skip Forward */}
              <button
                onClick={handleSkipForward}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-all active:scale-95"
                  title="Forward 10s (→)"
              >
                  <SkipForward className="w-5 h-5 text-white" />
              </button>

                {/* Time Display (only for video) */}
                {!useAudio && (
                  <div className="ml-2 flex items-center gap-1.5 text-white">
                    <span className="text-sm font-mono font-semibold">
                  {formatTime(mediaCurrentTime)}
                </span>
                    <span className="text-white/40">/</span>
                    <span className="text-sm font-mono text-white/60">
                  {formatTime(getCurrentDuration())}
                </span>
                  </div>
                )}
            </div>

              {/* Right: Settings & Controls */}
              <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <div className="relative" ref={speedMenuRef}>
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="h-8 px-3 hover:bg-white/10 rounded-lg transition-all text-sm font-semibold text-white min-w-[3rem] active:scale-95"
                  title="Playback speed"
                >
                    {playbackRate}×
                </button>
                {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden min-w-[5rem] py-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                          className={`w-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                            playbackRate === rate 
                              ? 'bg-blue-500 text-white' 
                              : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                          {rate}×
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume Control */}
                <div className="relative" ref={volumeSliderRef}>
                <button
                  onClick={handleMuteToggle}
                  onMouseEnter={() => setShowVolumeSlider(true)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-all active:scale-95"
                    title={isMuted ? "Unmute (M)" : "Mute (M)"}
                >
                  {isMuted || volume === 0 ? (
                      <VolumeX className="w-5 h-5 text-white" />
                  ) : volume < 0.5 ? (
                      <Volume1 className="w-5 h-5 text-white" />
                  ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>
                  {showVolumeSlider && (
                  <div
                      className="absolute bottom-full right-0 mb-2 bg-slate-800 rounded-xl p-4 shadow-2xl border border-slate-700"
                    onMouseLeave={() => setShowVolumeSlider(false)}
                  >
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="w-28 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                      <div className="text-xs font-semibold text-white text-center mt-2">
                      {Math.round((isMuted ? 0 : volume) * 100)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Captions Toggle (only for video) */}
              {!useAudio && (
                <button
                  onClick={() => setShowCaptions(!showCaptions)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95 ${
                      showCaptions ? 'bg-white/20 text-blue-400' : 'hover:bg-white/10 text-white'
                  }`}
                  title={`${showCaptions ? 'Hide' : 'Show'} captions (C)`}
                >
                    <Captions className="w-5 h-5" />
                </button>
              )}

              {/* Fullscreen (only for video) */}
              {!useAudio && (
                <button 
                  onClick={() => {
                    const video = videoRef.current;
                    if (!video) return;
                    
                    if (!isFullscreen) {
                      if (video.requestFullscreen) {
                        video.requestFullscreen();
                      } else if ((video as any).webkitRequestFullscreen) {
                        (video as any).webkitRequestFullscreen();
                      } else if ((video as any).mozRequestFullScreen) {
                        (video as any).mozRequestFullScreen();
                      }
                    } else {
                      if (document.exitFullscreen) {
                        document.exitFullscreen();
                      } else if ((document as any).webkitExitFullscreen) {
                        (document as any).webkitExitFullscreen();
                      } else if ((document as any).mozCancelFullScreen) {
                        (document as any).mozCancelFullScreen();
                      }
                    }
                    setIsFullscreen(!isFullscreen);
                  }}
                    className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-all active:scale-95"
                  title="Fullscreen (F)"
                >
                    <Maximize2 className="w-5 h-5 text-white" />
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Transcript */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-800">
          {/* Transcript Header */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              {/* Left: Title + subtitle */}
              <div className="flex-shrink-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Transcript
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {meeting.transcript.length} entries • {(() => {
                    const durationSeconds = meeting.stats?.audioDurationSeconds && meeting.stats.audioDurationSeconds > 0
                      ? meeting.stats.audioDurationSeconds
                      : (meeting.duration || 0) * 60;
                    return formatDuration(durationSeconds);
                  })()}
                </p>
              </div>

              {/* Right: Filters + action buttons in one row */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Content Type dropdown */}
                <div className="flex items-center gap-1">
                  <Filter className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <select
                    value={contentTypeFilter}
                    onChange={(e) => setContentTypeFilter(e.target.value as typeof contentTypeFilter)}
                    className="text-xs py-1 pl-1.5 pr-5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer appearance-none"
                  >
                    <option value="all">All types</option>
                    <option value="action-items">Action Items</option>
                    <option value="decisions">Decisions</option>
                    <option value="questions">Questions</option>
                  </select>
                </div>

                {/* Speaker dropdown */}
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <select
                    value={selectedSpeakers.length === 1 ? selectedSpeakers[0] : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedSpeakers(val ? [val] : []);
                    }}
                    className="text-xs py-1 pl-1.5 pr-5 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer appearance-none"
                  >
                    <option value="">All speakers</option>
                    {uniqueSpeakers.map(({ label, mapping }) => {
                      const name = mapping?.resolved ? mapping.userName! : label.replace(/_/g, ' ');
                      return <option key={label} value={label}>{name}</option>;
                    })}
                  </select>
                </div>

                {/* Active filter count + clear */}
                {(selectedSpeakers.length > 0 || contentTypeFilter !== 'all') && (
                  <>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {filteredTranscript.length}/{meeting.transcript.length}
                    </span>
                    <button
                      onClick={() => { setSelectedSpeakers([]); setContentTypeFilter('all'); }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Clear
                    </button>
                  </>
                )}

                {/* Divider */}
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600" />

                {/* Auto-scroll Toggle */}
                {!autoScrollEnabled && (
                  <button
                    onClick={enableAutoScroll}
                    className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-all text-xs font-medium border border-blue-200 dark:border-blue-800"
                    title="Enable auto-scroll to follow playback"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>Auto-scroll Off</span>
                  </button>
                )}

                {/* Search */}
                <button
                  onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-all"
                  title="Search transcript"
                >
                  <Search className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Participants: {meeting.participants.length}
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Duration: {(() => {
                  const durationSeconds = meeting.stats?.audioDurationSeconds && meeting.stats.audioDurationSeconds > 0
                    ? meeting.stats.audioDurationSeconds
                    : (meeting.duration || 0) * 60;
                  return formatDuration(durationSeconds);
                })()}
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                Transcript: {meeting.transcript.length} entries
              </span>
            </div>

            {/* Search Bar */}
            {isSearchExpanded && (
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Transcript Content */}
          <div 
            ref={transcriptScrollRef}
            className="flex-1 overflow-y-auto scrollbar-hide relative"
            onScroll={handleTranscriptScroll}
          >
            {/* Scroll progress indicator */}
            <div className="sticky top-0 z-50 h-1 bg-slate-200/50 dark:bg-slate-700/50">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-150"
                style={{ width: `${scrollProgress}%` }}
              />
            </div>

            {/* Gradient fade at top */}
            <div className="sticky top-0 z-40 h-8 bg-gradient-to-b from-white dark:from-slate-800 to-transparent pointer-events-none" />

            <div ref={transcriptRef} className="relative px-8 py-10">
              {/* Subtle background pattern - lighter */}
              <div className="absolute inset-0 opacity-[0.008] dark:opacity-[0.015] pointer-events-none" 
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 20px)`,
                }}
              />

              {/* Minimal timeline indicator */}
              <div className="absolute left-6 top-8 bottom-8 w-px bg-slate-200 dark:bg-slate-700">
                {/* Active position indicator */}
                {activeEntryIndex >= 0 && filteredTranscript[activeEntryIndex] && (
                  (() => {
                    const totalDuration = filteredTranscript[filteredTranscript.length - 1]?.timestamp || 0;
                    const currentEntry = filteredTranscript[activeEntryIndex];
                    const position = totalDuration > 0 ? (currentEntry.timestamp / totalDuration) * 100 : 0;
                    return (
                      <div
                        className="absolute w-2 h-2 rounded-full bg-blue-500 -left-[3px] shadow-lg shadow-blue-500/50 ring-2 ring-blue-200 dark:ring-blue-900"
                        style={{ top: `${position}%` }}
                      />
                    );
                  })()
                )}
              </div>

              {/* Speaker legend */}
              {uniqueSpeakers.length > 0 && (
                <div className="mb-8 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Speakers:</span>
                  {uniqueSpeakers.map(({ label, mapping, color, count }) => {
                    const resolvedName = mapping?.resolved ? mapping.userName : label.replace(/_/g, ' ');
                    const pfp = mapping?.resolved ? mapping.profilePictureUrl : null;
                    return (
                      <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {pfp ? (
                          <img src={pfp} alt={resolvedName || label} className="w-4 h-4 rounded-full object-cover ring-1 ring-white/50 dark:ring-slate-600" />
                        ) : (
                          <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${color}`} />
                        )}
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {resolvedName}
                        </span>
                        {mapping?.resolved && (() => {
                          const tier = mapping.tierResolved;
                          if (tier === 1) return <span title="Biometric"><Fingerprint className="w-3 h-3 text-emerald-500" /></span>;
                          if (tier === 4) return <span title="Manual"><UserCheck className="w-3 h-3 text-amber-500" /></span>;
                          return <span title="Historical"><History className="w-3 h-3 text-blue-500" /></span>;
                        })()}
                        <span className="text-xs text-slate-400 dark:text-slate-500">·{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}


              <div className="space-y-4">
                {filteredTranscript.map((entry, index) => {
                  // CRITICAL: Only highlight the CURRENT entry that's playing
                  const isActive = activeEntryIndex >= 0 && index === activeEntryIndex;
                  // Apply live speaker override if this chunk was identified in real-time
                  const entryChunkKey = entry.chunkIndex ?? entry.chunk;
                  const liveSpeaker = entryChunkKey != null ? liveSpeakerOverrides[entryChunkKey] : undefined;
                  const effectiveSpeaker = liveSpeaker ?? entry.speaker;
                  const speakerInitials = effectiveSpeaker.replace(/[^A-Z0-9]/g, '').substring(0, 2) || effectiveSpeaker.substring(0, 2).toUpperCase();
                  
                  // Get content type for subtle badges only
                  const contentType = getEntryContentType(entry);
                  const contentTypeConfig = {
                    'action-item': {
                      badge: '📋',
                      color: 'text-yellow-600 dark:text-yellow-400',
                      label: 'Action'
                    },
                    'decision': {
                      badge: '✓',
                      color: 'text-green-600 dark:text-green-400',
                      label: 'Decision'
                    },
                    'question': {
                      badge: '?',
                      color: 'text-purple-600 dark:text-purple-400',
                      label: 'Question'
                    },
                    'normal': null
                  };
                  const badge = contentTypeConfig[contentType];
                  
                  // Get notes for this entry
                  const entryNotes = getNotesForEntry(entry);
                  
                  return (
                    <div
                      key={entry.id}
                      data-timestamp={entry.timestamp}
                      className={`group cursor-pointer transition-all duration-200 ${
                        isActive ? '' : 'opacity-60 hover:opacity-100'
                      }`}
                      onClick={() => handleTimestampClick(entry.timestamp, entry)}
                      onMouseEnter={() => handleTranscriptHover(entry)}
                      onMouseLeave={() => {}}
                    >
                      <div className={`flex items-start gap-4 p-4 rounded-xl transition-all duration-200 ${
                          isActive 
                          ? 'bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/40 dark:to-slate-800/60 shadow-lg border-2 border-blue-400 dark:border-blue-600'
                          : 'bg-white/50 dark:bg-slate-800/30 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/50'
                      }`}>
                        {/* Speaker Avatar */}
                        {renderSpeakerAvatar(
                          effectiveSpeaker,
                          speakerMappings[effectiveSpeaker] ?? speakerMappings[entry.speaker],
                          speakerInitials,
                          isActive ? 'scale-110 ring-2 ring-blue-400/50' : 'group-hover:scale-105'
                        )}
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Header: Speaker name, badge, timestamp */}
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <div className="relative">
                                <h4 
                                  className={`font-semibold text-sm truncate flex items-center gap-2 ${
                                    isActive 
                                      ? 'text-blue-700 dark:text-blue-300' 
                                      : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {(speakerMappings[effectiveSpeaker] ?? speakerMappings[entry.speaker])?.resolved 
                                    ? (speakerMappings[effectiveSpeaker] ?? speakerMappings[entry.speaker]).userName 
                                    : effectiveSpeaker.replace(/_/g, ' ')}
                                  
                                  {/* Identity Badge — how this speaker was resolved */}
                                  {(speakerMappings[effectiveSpeaker] ?? speakerMappings[entry.speaker])?.resolved && (() => {
                                    const tier = (speakerMappings[effectiveSpeaker] ?? speakerMappings[entry.speaker]).tierResolved;
                                    if (tier === 1) return (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-[9px] font-bold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
                                        <Fingerprint className="w-3 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-emerald-600 dark:text-emerald-400">Biometric</span>
                                      </div>
                                    );
                                    if (tier === 4) return (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-[9px] font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-800">
                                        <UserCheck className="w-3 text-amber-600 dark:text-amber-400" />
                                        <span className="text-amber-600 dark:text-amber-400">Manual</span>
                                      </div>
                                    );
                                    return (
                                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-[9px] font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-800">
                                        <History className="w-3 text-blue-600 dark:text-blue-400" />
                                        <span className="text-blue-600 dark:text-blue-400">Historical</span>
                                      </div>
                                    );
                                  })()}

                                  {/* Identify Button — any unresolved speaker label */}
                                  {!(speakerMappings[effectiveSpeaker] ?? speakerMappings[entry.speaker])?.resolved && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActivePopover(effectiveSpeaker);
                                      }}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all ml-1 border border-blue-100 dark:border-blue-900/30"
                                    >
                                      <UserPlus className="w-3 h-3" />
                                      IDENTIFY
                                    </button>
                                  )}
                                </h4>
                              </div>
                              {badge && (
                                <span className={`text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 ${badge.color} font-medium flex-shrink-0`}>
                                  {badge.badge} {badge.label}
                                </span>
                              )}

                              {/* Note tags */}
                              {entryNotes.map((note) => (
                                <div
                                  key={note.id}
                                  className="group/note relative flex-shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span 
                                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 font-medium cursor-help"
                                    style={{ backgroundColor: `${note.color}15`, borderColor: `${note.color}40` }}
                                  >
                                    <StickyNote className="w-3 h-3" />
                                    Note
                                    </span>
                                  {/* Hover tooltip */}
                                  <div className="absolute left-0 top-full mt-2 z-50 opacity-0 invisible group-hover/note:opacity-100 group-hover/note:visible transition-all duration-200 pointer-events-none">
                                    <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-lg shadow-2xl border border-slate-700 p-3 min-w-[200px] max-w-[300px]">
                                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                                          <span className="text-white text-xs font-bold">{note.author.avatar}</span>
                                  </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-white">{note.author.name}</p>
                                          <p className="text-xs text-slate-400">
                                            {formatTime(note.timestamp)}
                                          </p>
                              </div>
                                      </div>
                                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                                        {note.content}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Timestamp */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTimestampClick(entry.timestamp, entry);
                                  }}
                              className={`flex-shrink-0 px-2.5 py-1 rounded-md font-mono text-xs font-semibold transition-colors ${
                                  isActive
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                              >
                                {formatTime(entry.timestamp)}
                              </button>
                          </div>

                          {/* Transcript text - Clean and readable */}
                          <p className={`text-sm leading-relaxed ${
                            isActive 
                              ? 'text-slate-900 dark:text-white font-medium' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {searchQuery ? (
                              entry.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                                part.toLowerCase() === searchQuery.toLowerCase() ? (
                                  <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/40 px-1 rounded">
                                    {part}
                                  </mark>
                                ) : (
                                  part
                                )
                              )
                            ) : (
                              entry.text
                            )}
                          </p>

                          {/* Confidence indicator - subtle */}
                          {entry.confidence < 0.9 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 max-w-[120px] h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-amber-400 dark:bg-amber-500 transition-all"
                                  style={{ width: `${entry.confidence * 100}%` }}
                                />
                        </div>
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {Math.round(entry.confidence * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Gradient fade at bottom */}
              <div className="sticky bottom-0 z-40 h-8 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Right Panel - Slides, Media, and Notes */}
        <div className={`${isRightPanelCollapsed ? 'w-12' : 'w-80'} border-l border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-900 transition-all duration-300 overflow-hidden`}>
          {/* Collapse/Expand Button */}
          <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-2">
            <button
              onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
              className="w-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center group"
              title={isRightPanelCollapsed ? 'Open sidebar' : 'Close sidebar'}
            >
              {isRightPanelCollapsed ? (
                <ChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
              ) : (
                <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
              )}
            </button>
          </div>

          {!isRightPanelCollapsed && (
            <>
              {/* Tabs for Right Panel - Compact Design */}
              <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 pt-3">
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                  <button 
                    onClick={() => setActiveRightTab('slides')}
                    className={`flex-1 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                      activeRightTab === 'slides'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Slides
                  </button>
                  <button 
                    onClick={() => setActiveRightTab('notes')}
                    className={`flex-1 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                      activeRightTab === 'notes'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Notes
                  </button>
                </div>
              </div>

              {/* Content Panel */}
              <div className="flex-1 overflow-y-auto scrollbar-hide bg-white dark:bg-slate-800">
            {activeRightTab === 'slides' ? (
              <div className="p-4 overflow-y-auto">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">
                  Slides & Media
                </h4>
                <div className="space-y-4">
                  {meeting.slides && meeting.slides.length > 0 ? (
                    meeting.slides.map((slide) => (
                      <div
                        key={slide.id}
                        className={`p-5 rounded-xl cursor-pointer transition-all border shadow-sm ${
                          Math.floor(currentTime) >= slide.timestamp && 
                          Math.floor(currentTime) < slide.timestamp + slide.duration
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-md'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-slate-200 dark:border-slate-700 hover:shadow-md'
                        }`}
                        onClick={() => handleSlideClick(slide)}
                      >
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-3 font-medium">
                          {formatTime(slide.timestamp)} - {formatTime(slide.timestamp + slide.duration)}
                        </div>
                        <h5 className="font-bold text-slate-900 dark:text-white mb-3 text-base">
                          {slide.title}
                        </h5>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          {slide.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="font-medium">No slides available</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 overflow-y-auto">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">
                  Meeting Notes
                </h4>
                
                {/* Add Note Form */}
                <div className="mb-8">
                  <div className="flex space-x-3">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyPress={handleNoteKeyPress}
                      placeholder="Add a note at current time..."
                      className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm"
                      rows={3}
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    Current time: {formatTime(currentTime)}
                  </p>
                </div>

                {/* Notes List */}
                <div className="space-y-4">
                  {meeting.notes && meeting.notes.length > 0 ? (
                    meeting.notes.map((note) => (
                      <div key={note.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {note.author.name}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                            {formatTime(note.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                          {note.content}
                        </p>
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => handleTimestampClick(note.timestamp)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            Jump to time
                          </button>
                          <button
                            onClick={() => onDeleteNote(note.id)}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <p className="font-medium">No notes yet</p>
                      <p className="text-sm mt-1">Add your first note above</p>
                    </div>
                  )}
                </div>
              </div>
            )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Page-level Speaker Identification Modal */}
      {activePopover && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setActivePopover(null)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <SpeakerAssignmentPopover
              meetingId={Number(meeting.id)}
              speakerLabel={activePopover}
              currentMapping={speakerMappings[activePopover]}
              participants={meeting.participants}
              onAssignmentComplete={() => fetchSpeakerMappings()}
              onClose={() => setActivePopover(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptPanel;