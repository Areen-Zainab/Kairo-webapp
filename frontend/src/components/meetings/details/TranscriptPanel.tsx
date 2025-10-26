import React, { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronUp, Play, Pause, Volume2, Maximize2 } from 'lucide-react';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Filter transcript based on search query
  const filteredTranscript = meeting.transcript.filter(entry =>
    entry.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.speaker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  // Handle play/pause
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle timestamp click
  const handleTimestampClick = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
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
      {/* Top Bar - Video Player */}
      <div className="relative bg-black shadow-lg">
        <video
          ref={videoRef}
          className="w-full h-80 object-cover"
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          controls={false}
        >
          <source src={meeting.recordingUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        {/* Video Overlay Controls */}
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
          <button
            onClick={handlePlayPause}
            className="bg-white bg-opacity-10 hover:bg-opacity-20 rounded-full p-8 transition-all backdrop-blur-sm"
          >
            {isPlaying ? (
              <Pause className="w-16 h-16 text-white drop-shadow-lg" />
            ) : (
              <Play className="w-16 h-16 text-white drop-shadow-lg" />
            )}
          </button>
        </div>

        {/* Video Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-6">
              <button
                onClick={handlePlayPause}
                className="hover:bg-white hover:bg-opacity-10 rounded-lg p-3 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>
              <span className="text-lg font-mono font-medium">
                {formatTime(currentTime)} / {formatTime(meeting.duration * 60)}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button className="hover:bg-white hover:bg-opacity-10 rounded-lg p-3 transition-all">
                <Volume2 className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="hover:bg-white hover:bg-opacity-10 rounded-lg p-3 transition-all"
              >
                <Maximize2 className="w-6 h-6" />
              </button>
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
