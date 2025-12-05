import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronUp, Play, Pause, Volume2, Maximize2, SkipForward, SkipBack, VolumeX, Volume1, Clock } from 'lucide-react';
import type { MeetingDetailsData, TranscriptEntry, Slide, MeetingNote } from './types';

interface TranscriptPanelProps {
  meeting: MeetingDetailsData;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onTimestampClick: (timestamp: number) => void;
  onTranscriptHover: (entry: TranscriptEntry) => void;
  onSlideClick: (slide: Slide) => void;
  onAddNote: (note: Omit<MeetingNote, 'id'>) => void;
  onDeleteNote: (id: string) => void;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  meeting,
  currentTime,
  onTimeUpdate,
  onTimestampClick,
  onTranscriptHover,
  onSlideClick,
  onAddNote,
  onDeleteNote
}) => {

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'slides' | 'notes'>('slides');
  const [newNote, setNewNote] = useState('');
  const [useAudio, setUseAudio] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(1); // 0 to 1
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1); // 0.5, 0.75, 1, 1.25, 1.5, 2
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [progressHoverPosition, setProgressHoverPosition] = useState<number | null>(null);
  const [mediaCurrentTime, setMediaCurrentTime] = useState(0); // Local state for current playback time
  const [isHoveringPlayer, setIsHoveringPlayer] = useState(false); // Track hover state for controls visibility
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hoveredEntryIndex, setHoveredEntryIndex] = useState<number | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<number | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Filter transcript based on search query and ensure it's sorted by start time (or timestamp for backwards compatibility)
  const filteredTranscript = meeting.transcript
    .filter(entry =>
      entry.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.speaker.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => (a.startTime ?? a.timestamp) - (b.startTime ?? b.timestamp)); // Always sort by start time

  // Find the active entry based on current time using timestamp field (start_time from JSON)
  // Uses timestamp field which is the start_time field directly from transcript_diarized.json
  const getActiveEntryIndex = () => {
    // If no transcript entries, return -1
    if (filteredTranscript.length === 0) {
      return -1;
    }

    // If currentTime is negative or 0, don't highlight anything
    // Only highlight when audio has actually started playing
    if (currentTime <= 0) {
      return -1;
    }

    // Find the entry where currentTime falls within its range
    // Iterate backwards to find the most recent matching entry
    for (let i = filteredTranscript.length - 1; i >= 0; i--) {
      const entry = filteredTranscript[i];
      const nextEntry = filteredTranscript[i + 1];
      
      // Use timestamp field (start_time from JSON) for accurate syncing
      const entryStartTime = entry.timestamp;
      // End time is either next entry's timestamp or a default duration
      const entryEndTime = nextEntry 
        ? nextEntry.timestamp 
        : entry.timestamp + 10; // Default 10s if no next entry
      
      // Only match if currentTime is within the entry's time range
      // Use strict < for end time to avoid matching multiple entries at boundaries
      if (currentTime >= entryStartTime && currentTime < entryEndTime) {
        return i;
      }
    }
    
    // If no match found, return -1 (don't highlight anything)
    return -1;
  };

  const activeEntryIndex = getActiveEntryIndex();

  // Extract unique speakers for legend
  const uniqueSpeakers = React.useMemo(() => {
    const speakers = new Map<string, { count: number; color: string }>();
    filteredTranscript.forEach(entry => {
      if (!speakers.has(entry.speaker)) {
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
        speakers.set(entry.speaker, { count: 0, color });
      }
      const speaker = speakers.get(entry.speaker)!;
      speaker.count++;
    });
    return Array.from(speakers.entries()).map(([name, data]) => ({ name, ...data }));
  }, [filteredTranscript]);

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

  const getSpeakerBorderColor = (speaker: string) => {
    if (speaker === 'UNKNOWN') {
      return 'border-slate-400';
    }
    const speakerNum = speaker.match(/\d+/)?.[0];
    const colors = [
      'border-blue-500',
      'border-purple-500',
      'border-emerald-500',
      'border-amber-500',
      'border-rose-500',
      'border-indigo-500',
    ];
    return colors[parseInt(speakerNum || '0') % colors.length] || colors[0];
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
  const handleTimeUpdate = () => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement) {
      const newTime = mediaElement.currentTime;
      setMediaCurrentTime(newTime); // Update local state for display
      onTimeUpdate(newTime); // Also update parent component
    }
  };

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
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (!mediaElement) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * mediaElement.duration;
    mediaElement.currentTime = newTime;
    setMediaCurrentTime(newTime); // Update immediately
    setProgressHoverPosition(null);
    handleTimeUpdate(); // Trigger update
  };

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
  const handleTimestampClick = (timestamp: number, entry?: TranscriptEntry) => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement) {
      // Use timestamp field (calculated from ISO timestamp) for accurate seeking
      const seekTime = entry ? entry.timestamp : timestamp;
      mediaElement.currentTime = seekTime;
      onTimestampClick(seekTime);
      // Scroll to the clicked entry immediately
      if (entry) {
        setTimeout(() => scrollToEntry(entry), 100); // Small delay to ensure DOM is updated
      }
    }
  };

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
          id: 'current-user',
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

  // Scroll to current time in transcript as audio plays (only if user isn't manually scrolling)
  useEffect(() => {
    if (transcriptRef.current && activeEntryIndex >= 0 && !isUserScrollingRef.current) {
      const activeEntry = filteredTranscript[activeEntryIndex];
      if (activeEntry) {
        scrollToEntry(activeEntry);
      }
    }
  }, [currentTime, activeEntryIndex, filteredTranscript]);

  // Handle manual scrolling - disable auto-scroll temporarily when user scrolls
  const handleTranscriptScroll = () => {
    isUserScrollingRef.current = true;
    handleScrollProgress();
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    // Re-enable auto-scroll after 3 seconds of no scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 3000);
  };

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

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
              if (audio) {
                console.error('Audio error details:', {
                  error: audio.error,
                  code: audio.error?.code,
                  message: audio.error?.message,
                  networkState: audio.networkState,
                  readyState: audio.readyState
                });
              }
            }}
            preload="metadata"
            crossOrigin="anonymous"
          >
            Your browser does not support the audio tag.
          </audio>
        )}
        
        {useAudio ? (
          // Professional Audio Player UI - More compact and refined
          <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <Volume2 className="w-12 h-12 text-white" />
              </div>
              <div>
                <p className="text-white text-lg font-medium">Audio Recording</p>
                <p className="text-slate-400 text-xs mt-1">Meeting audio playback</p>
              </div>
            </div>
          </div>
        ) : (
          // Video Player
          <video
            ref={videoRef}
            className="w-full h-80 object-cover"
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
        )}
        
        {/* Media Overlay Controls - More compact, YouTube-style */}
        {useAudio && (
          <div 
            className={`absolute inset-0 bg-black bg-opacity-10 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
              isHoveringPlayer || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <button
              onClick={handlePlayPause}
              className="bg-white bg-opacity-10 hover:bg-opacity-20 rounded-full p-4 transition-all backdrop-blur-sm pointer-events-auto"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white drop-shadow-lg" />
              ) : (
                <Play className="w-8 h-8 text-white drop-shadow-lg ml-0.5" />
              )}
            </button>
          </div>
        )}

        {/* Enhanced Media Controls Bar - YouTube-style hide/show on hover */}
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent p-4 transition-all duration-200 ${
            isHoveringPlayer || !isPlaying ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
          }`}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setIsHoveringPlayer(true);
          }}
        >
          {/* Enhanced Progress Bar */}
          <div className="mb-4 relative group">
            <div
              ref={progressBarRef}
              onClick={handleSeek}
              onMouseMove={handleProgressHover}
              onMouseLeave={() => setProgressHoverPosition(null)}
              className={`bg-white/20 rounded-full cursor-pointer transition-all relative ${
                isHoveringPlayer ? 'h-2.5' : 'h-1'
              }`}
            >
              {/* Progress */}
              <div
                className="h-full bg-blue-500 rounded-full transition-all group-hover:bg-blue-400 relative"
                style={{
                  width: `${(mediaCurrentTime / getCurrentDuration()) * 100}%`
                }}
              >
                {/* Progress indicator dot */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
              </div>
              
              {/* Hover indicator */}
              {progressHoverPosition !== null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-full pointer-events-none"
                  style={{
                    left: `${(progressHoverPosition / getCurrentDuration()) * 100}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              )}
            </div>
            
            {/* Hover time tooltip */}
            {progressHoverPosition !== null && progressBarRef.current && (
              <div
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap"
                style={{
                  left: `${(progressHoverPosition / getCurrentDuration()) * 100}%`,
                  transform: 'translate(-50%, 0)'
                }}
              >
                {formatTime(progressHoverPosition)}
              </div>
            )}
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between text-white">
            {/* Left Controls */}
            <div className="flex items-center space-x-1">
              {/* Skip Backward */}
              <button
                onClick={handleSkipBackward}
                className="hover:bg-white hover:bg-opacity-10 rounded p-1.5 transition-all"
                title="Rewind 10 seconds"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className="hover:bg-white hover:bg-opacity-10 rounded-full p-2 transition-all bg-white/5"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>
              
              {/* Skip Forward */}
              <button
                onClick={handleSkipForward}
                className="hover:bg-white hover:bg-opacity-10 rounded p-1.5 transition-all"
                title="Forward 10 seconds"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Time Display - Clean and simple */}
              <div className="ml-4 flex items-center space-x-2">
                <span className="text-sm font-mono font-medium text-white">
                  {formatTime(mediaCurrentTime)}
                </span>
                <span className="text-white/50">/</span>
                <span className="text-sm font-mono font-medium text-white/70">
                  {formatTime(getCurrentDuration())}
                </span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center space-x-2">
              {/* Playback Speed */}
              <div className="relative" ref={speedMenuRef}>
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="hover:bg-white hover:bg-opacity-10 rounded-lg px-3 py-2 transition-all text-sm font-medium"
                  title="Playback speed"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden min-w-[6rem]">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                          playbackRate === rate ? 'bg-slate-700 text-blue-400' : 'text-white'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume Control */}
              <div className="relative flex items-center" ref={volumeSliderRef}>
                <button
                  onClick={handleMuteToggle}
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  className="hover:bg-white hover:bg-opacity-10 rounded-lg p-2 transition-all"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                {(showVolumeSlider || volumeSliderRef.current?.matches(':hover')) && (
                  <div
                    className="absolute bottom-full right-0 mb-2 bg-slate-800 rounded-lg p-3 shadow-xl border border-slate-700"
                    onMouseLeave={() => setShowVolumeSlider(false)}
                  >
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-24 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(isMuted ? 0 : volume) * 100}%, #475569 ${(isMuted ? 0 : volume) * 100}%, #475569 100%)`
                      }}
                    />
                    <div className="text-xs text-white/70 text-center mt-1">
                      {Math.round((isMuted ? 0 : volume) * 100)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Fullscreen (only for video) */}
              {!useAudio && (
                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="hover:bg-white hover:bg-opacity-10 rounded-lg p-2 transition-all"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Transcript */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-800">
          {/* Transcript Header */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Transcript
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  {meeting.transcript.length} entries • {(() => {
                    // Use actual audio duration from stats if available, otherwise use meeting.duration
                    const durationSeconds = meeting.stats?.audioDurationSeconds && meeting.stats.audioDurationSeconds > 0
                      ? meeting.stats.audioDurationSeconds
                      : (meeting.duration || 0) * 60;
                    return formatDuration(durationSeconds);
                  })()}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                  className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                  title="Search transcript"
                >
                  <Search className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                <button
                  onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                  className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"
                  title="Toggle controls"
                >
                  {isControlsExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Search Bar */}
            {isSearchExpanded && (
              <div className="relative mt-6">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
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

            {/* Controls */}
            {isControlsExpanded && (
              <div className="flex items-center space-x-8 mt-6 text-sm text-slate-600 dark:text-slate-400">
                <span className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Participants: {meeting.participants.length}</span>
                </span>
                <span className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Duration: {(() => {
                    // Use actual audio duration from stats if available, otherwise use meeting.duration
                    const durationSeconds = meeting.stats?.audioDurationSeconds && meeting.stats.audioDurationSeconds > 0
                      ? meeting.stats.audioDurationSeconds
                      : (meeting.duration || 0) * 60;
                    return formatDuration(durationSeconds);
                  })()}</span>
                </span>
                <span className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Transcript: {meeting.transcript.length} entries</span>
                </span>
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

              {/* Enhanced Vertical timeline with markers and timestamps */}
              <div className="absolute left-16 top-8 bottom-8 w-1 bg-gradient-to-b from-blue-200/30 via-blue-400/50 to-blue-200/30 dark:from-blue-800/30 dark:via-blue-600/50 dark:to-blue-800/30 transition-all duration-300">
                {/* Timeline markers for speaker changes */}
                {filteredTranscript.map((entry, index) => {
                  if (index === 0 || entry.speaker !== filteredTranscript[index - 1].speaker) {
                    const totalDuration = filteredTranscript[filteredTranscript.length - 1]?.timestamp || 0;
                    const position = totalDuration > 0 ? (entry.timestamp / totalDuration) * 100 : 0;
                    return (
                      <div
                        key={`marker-${index}`}
                        className="absolute w-3 h-3 rounded-full -left-1 border-2 border-white dark:border-slate-800"
                        style={{ 
                          top: `${position}%`,
                          backgroundColor: getSpeakerBorderColor(entry.speaker).replace('border-', ''),
                        }}
                      />
                    );
                  }
                  return null;
                })}

                {/* Timeline timestamps every 5 minutes */}
                {(() => {
                  const totalDuration = filteredTranscript[filteredTranscript.length - 1]?.timestamp || 0;
                  const timestamps = [];
                  for (let i = 0; i <= totalDuration; i += 300) { // Every 5 minutes (300 seconds)
                    const position = totalDuration > 0 ? (i / totalDuration) * 100 : 0;
                    timestamps.push(
                      <div
                        key={`time-${i}`}
                        className="absolute -left-12 text-xs text-slate-400 dark:text-slate-500 font-light whitespace-nowrap"
                        style={{ top: `${position}%` }}
                      >
                        {formatTime(i)}
                      </div>
                    );
                  }
                  return timestamps;
                })()}
              </div>

              {/* Speaker Legend */}
              {uniqueSpeakers.length > 0 && (
                <div className="mb-6 pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Speakers:</span>
                    {uniqueSpeakers.map(({ name, color, count }) => (
                      <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                        <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${color}`} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {name.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">({count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {filteredTranscript.map((entry, index) => {
                  // Only highlight if activeEntryIndex is valid (>= 0) and matches this entry
                  const isActive = activeEntryIndex >= 0 && index === activeEntryIndex;
                  const isHovered = hoveredEntryIndex === index;
                  const speakerInitials = entry.speaker.replace(/[^A-Z0-9]/g, '').substring(0, 2) || entry.speaker.substring(0, 2).toUpperCase();
                  const isAlternate = index % 2 === 0;
                  
                  return (
                    <div
                      key={entry.id}
                      data-timestamp={entry.timestamp}
                      className={`relative flex items-start gap-5 group transition-all duration-300 ${
                        isActive ? 'scale-[1.005]' : ''
                      }`}
                      onClick={() => {
                        handleTimestampClick(entry.timestamp, entry);
                      }}
                      onMouseEnter={() => {
                        handleTranscriptHover(entry);
                        setHoveredEntryIndex(index);
                      }}
                      onMouseLeave={() => setHoveredEntryIndex(null)}
                    >
                      {/* Speaker-colored left border */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${getSpeakerBorderColor(entry.speaker)} opacity-30 group-hover:opacity-60 transition-opacity rounded-l-lg`} />

                      {/* Timeline dot with enhanced styling */}
                      <div className="relative flex-shrink-0 z-10 mt-1">
                        <div className={`w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                          isActive 
                            ? `bg-blue-500 border-blue-50 dark:border-blue-950 shadow-lg shadow-blue-500/40 scale-110 ring-2 ring-blue-300/50 dark:ring-blue-700/50` 
                            : `bg-white dark:bg-slate-800 ${getSpeakerBorderColor(entry.speaker)} group-hover:scale-105 group-hover:shadow-md`
                        }`}></div>
                        {/* Subtle glow for active entry */}
                        {isActive && (
                          <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-pulse blur-sm"></div>
                        )}
                      </div>

                      {/* Enhanced content card */}
                      <div className={`flex-1 min-w-0 rounded-lg transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-br from-blue-50/80 via-white to-white dark:from-blue-950/30 dark:via-slate-800/50 dark:to-slate-800/60 border border-blue-400/40 dark:border-blue-600/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-200/30 dark:ring-blue-800/30'
                          : `bg-white/70 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40 group-hover:border-slate-300/60 dark:group-hover:border-slate-600/60 group-hover:shadow-md group-hover:bg-white/90 dark:group-hover:bg-slate-800/60 ${isAlternate ? 'bg-slate-50/30 dark:bg-slate-900/20' : ''}`
                      }`}>
                        <div className="p-4">
                          {/* Header: Speaker and Timestamp */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {/* Enhanced speaker avatar */}
                              <div className={`w-10 h-10 rounded-lg ${getSpeakerColor(entry.speaker)} flex items-center justify-center text-white font-bold text-xs shadow-md ring-1 ring-white/20 dark:ring-slate-700/30 flex-shrink-0 transition-transform duration-300 ${
                                isActive ? 'scale-105 ring-2 ring-blue-200/50 dark:ring-blue-800/50' : 'group-hover:scale-105'
                              }`}>
                                {speakerInitials}
                              </div>
                              <div>
                                {/* Speaker name badge */}
                                <div className={`font-bold text-slate-900 dark:text-white text-sm tracking-tight ${
                                  isActive ? 'text-blue-700 dark:text-blue-300' : ''
                                }`}>
                                  {entry.speaker.replace(/_/g, ' ')}
                                </div>
                                {/* Confidence as progress bar */}
                                {entry.confidence < 1.0 && (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
                                        style={{ width: `${entry.confidence * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-light">
                                      {Math.round(entry.confidence * 100)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Enhanced timestamp button with jump icon on hover */}
                            <div className="flex items-center gap-2">
                              {isHovered && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTimestampClick(entry.timestamp, entry);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                  title="Jump to time"
                                >
                                  <Clock className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTimestampClick(entry.timestamp, entry);
                                }}
                                className={`flex-shrink-0 px-3 py-1.5 rounded-lg font-mono text-xs font-medium transition-all duration-300 ${
                                  isActive
                                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30 hover:bg-blue-600'
                                    : 'bg-slate-100/80 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                              >
                                {formatTime(entry.timestamp)}
                              </button>
                            </div>
                          </div>

                          {/* Enhanced transcript text with serif font */}
                          <p className={`font-serif leading-[1.75] text-sm ${
                            isActive 
                              ? 'text-blue-900 dark:text-blue-100 font-medium' 
                              : 'text-slate-700 dark:text-slate-300 font-normal'
                          } ${isActive ? 'drop-shadow-sm' : ''}`}>
                            {searchQuery ? (
                              // Highlight search keywords
                              entry.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                                part.toLowerCase() === searchQuery.toLowerCase() ? (
                                  <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/40 px-0.5 rounded">
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
        <div className="w-96 border-l border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800">
          {/* Tabs for Right Panel */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex">
              <button 
                onClick={() => setActiveRightTab('slides')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                  activeRightTab === 'slides'
                    ? 'text-slate-900 dark:text-white border-b-2 border-blue-500 bg-slate-50 dark:bg-slate-700/50'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/30'
                }`}
              >
                Slides
              </button>
              <button 
                onClick={() => setActiveRightTab('notes')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                  activeRightTab === 'notes'
                    ? 'text-slate-900 dark:text-white border-b-2 border-blue-500 bg-slate-50 dark:bg-slate-700/50'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700/30'
                }`}
              >
                Notes
              </button>
            </div>
          </div>

          {/* Content Panel */}
          <div className="flex-1 overflow-y-auto scrollbar-hide bg-white dark:bg-slate-800">
            {activeRightTab === 'slides' ? (
              <div className="p-6">
                <h4 className="font-bold text-slate-900 dark:text-white mb-6 text-lg">
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
              <div className="p-6">
                <h4 className="font-bold text-slate-900 dark:text-white mb-6 text-lg">
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
        </div>
      </div>
    </div>
  );
};

export default TranscriptPanel;