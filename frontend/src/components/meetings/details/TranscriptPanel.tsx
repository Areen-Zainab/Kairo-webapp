import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronUp, Play, Pause, Volume2, Maximize2, SkipForward, SkipBack, VolumeX, Volume1 } from 'lucide-react';
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
  const hideControlsTimeoutRef = useRef<number | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Filter transcript based on search query
  const filteredTranscript = meeting.transcript.filter(entry =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.speaker.toLowerCase().includes(searchQuery.toLowerCase())
  );


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

  // Handle timestamp click (works for both video and audio)
  const handleTimestampClick = (timestamp: number) => {
    const mediaElement = useAudio ? audioRef.current : videoRef.current;
    if (mediaElement) {
      mediaElement.currentTime = timestamp;
      onTimestampClick(timestamp);
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

  // Scroll to current time in transcript
  useEffect(() => {
    if (transcriptRef.current) {
      const currentEntry = document.querySelector(`[data-timestamp="${Math.floor(currentTime)}"]`);
      if (currentEntry) {
        currentEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                  {meeting.transcript.length} entries • {meeting.duration} minutes
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
                  <span>Duration: {meeting.duration} minutes</span>
                </span>
                <span className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Transcript: {meeting.transcript.length} entries</span>
                </span>
              </div>
            )}
          </div>

          {/* Transcript Content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div ref={transcriptRef} className="p-6 space-y-4">
              {filteredTranscript.map((entry) => (
                <div
                  key={entry.id}
                  data-timestamp={entry.timestamp}
                  className={`p-5 rounded-xl cursor-pointer transition-all border-l-4 shadow-sm ${
                    Math.floor(currentTime) === entry.timestamp
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-md'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border-transparent hover:shadow-md'
                  }`}
                  onClick={() => handleTimestampClick(entry.timestamp)}
                  onMouseEnter={() => handleTranscriptHover(entry)}
                >
                  <div className="flex items-start space-x-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTimestampClick(entry.timestamp);
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 font-mono hover:underline flex-shrink-0 mt-1 bg-blue-100 dark:bg-blue-900/30 px-3 py-2 rounded-lg font-medium"
                    >
                      {formatTime(entry.timestamp)}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="font-bold text-slate-900 dark:text-white text-lg">
                          {entry.speaker}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full font-medium">
                          {Math.round(entry.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-base">
                        {entry.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
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