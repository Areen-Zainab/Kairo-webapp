import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { meetService } from '../../services/meetService';
import { useToastContext } from '../../context/ToastContext';
import {
  Mic,
  MicOff,
  VideoOff,
  MessageSquare,
  Brain,
  CheckSquare,
  StickyNote,
  Clock,
  Sparkles,
  Circle,
  ChevronDown,
  LogOut,
  Activity,
  Settings as SettingsIcon,
  EyeOff
} from 'lucide-react';

import Layout from '../../components/Layout';
import MemoryTab from '../../components/meetings/meetingslive/MemoryTab';
import LiveChat from '../../components/meetings/meetingslive/LiveChat';
import ActionItemsTab from '../../components/meetings/meetingslive/ActionItemsTab';
import NotesTab from '../../components/meetings/meetingslive/NotesTab';
import TranscriptTab from '../../components/meetings/meetingslive/TranscriptTab';
import InsightsTab from '../../components/meetings/meetingslive/InsightsTab';

type SidebarTab = 'memory' | 'chat' | 'actions' | 'notes' | 'transcript' | 'insights';

interface Participant {
  id: string;
  name: string;
  avatar: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isSpeaking: boolean;
}

interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isUser: boolean;
  isSystemMessage?: boolean;
  systemMessageType?: 'privacy-on' | 'privacy-off';
}

interface ActionItem {
  id: string;
  text: string;
  assignee: string;
  isCompleted: boolean;
}

interface Insight {
  id: string;
  text: string;
  timestamp: string;
  category: 'decision' | 'question' | 'important';
}

const LiveMeetingView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastContext();
  const [activeTab, setActiveTab] = useState<SidebarTab>('memory');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [newAction, setNewAction] = useState('');
  const [showBotControls, setShowBotControls] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(true);
  // Transcription toggle removed; replaced by Privacy Mode
  const [isVisualCaptureEnabled, setIsVisualCaptureEnabled] = useState(false);
  const [isRealtimeInsightsEnabled, setIsRealtimeInsightsEnabled] = useState(true);
  const [isConnected] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [memoryChatInput, setMemoryChatInput] = useState('');
  const [memoryChat, setMemoryChat] = useState<{id:string; role:'user'|'bot'; text:string}[]>([]);
  const [meeting, setMeeting] = useState<any>(null);
  const [isBotJoining, setIsBotJoining] = useState(false);
  const [isBotJoined, setIsBotJoined] = useState(false);
  const [isWaitingForBot, setIsWaitingForBot] = useState(true);
  
  const transcriptRef = useRef<HTMLDivElement>(null);
  const pollingActiveRef = useRef(false);

  const participants: Participant[] = [
    { id: '1', name: 'Kairo Bot', avatar: 'KB', isMuted: false, isVideoOn: false, isSpeaking: false },
    { id: '2', name: 'Sana Khan', avatar: 'SK', isMuted: false, isVideoOn: true, isSpeaking: true },
    { id: '3', name: 'Muhammad Ali', avatar: 'MA', isMuted: true, isVideoOn: true, isSpeaking: false },
    { id: '4', name: 'Fatima Sheikh', avatar: 'FS', isMuted: false, isVideoOn: false, isSpeaking: false },
  ];

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    { id: '1', speaker: 'Sana Khan', text: "Thanks everyone for joining. Let's start with the Q4 planning discussion.", timestamp: '10:02 AM', isUser: false },
    { id: '2', speaker: 'Muhammad Ali', text: "I've prepared a roadmap overview. Should we go through the key milestones first?", timestamp: '10:03 AM', isUser: false },
    { id: '3', speaker: 'You', text: "Yes, that would be great. Let's focus on the high-priority items.", timestamp: '10:03 AM', isUser: true },
    { id: '4', speaker: 'Fatima Sheikh', text: "I think we should also discuss the resource allocation for the design system project.", timestamp: '10:04 AM', isUser: false },
  ]);

  const [actionItems, setActionItems] = useState<ActionItem[]>([
    { id: '1', text: 'Review Q4 roadmap document', assignee: 'Sana Khan', isCompleted: false },
    { id: '2', text: 'Schedule design system workshop', assignee: 'Fatima Sheikh', isCompleted: false },
    { id: '3', text: 'Update project timeline', assignee: 'Muhammad Ali', isCompleted: true },
  ]);
  type ActionStatus = 'confirmed' | 'removed' | 'undecided';
  const [actionStatusById, setActionStatusById] = useState<Record<string, ActionStatus>>({
    '1': 'undecided',
    '2': 'undecided',
    '3': 'confirmed'
  });

  const [insights] = useState<Insight[]>([
    { id: '1', text: 'Team agreed to prioritize mobile app development', timestamp: '10:02 AM', category: 'decision' },
    { id: '2', text: 'Open question: Budget allocation for Q1 2025', timestamp: '10:03 AM', category: 'question' },
    { id: '3', text: 'Critical: Design system needs to be completed by Dec 15', timestamp: '10:04 AM', category: 'important' },
  ]);

  const [notes, setNotes] = useState([
    { id: '1', text: 'Focus on mobile-first approach', timestamp: '10:02 AM', author: 'Sana Khan', isPrivate: false },
    { id: '2', text: 'Need to hire 2 more engineers', timestamp: '10:03 AM', author: 'You', isPrivate: true },
  ]);
  const [newNotePrivacy, setNewNotePrivacy] = useState<'public' | 'private'>('public');

  const memoryItems = [
    { id: '1', topic: 'Q3 Planning Meeting', relevance: 'High', linkedDate: 'Sep 15, 2024' },
    { id: '2', topic: 'Design System Discussion', relevance: 'Medium', linkedDate: 'Oct 2, 2024' },
    { id: '3', topic: 'Resource Planning', relevance: 'High', linkedDate: 'Oct 8, 2024' },
  ];

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      const id = Date.now().toString();
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const type = next ? 'privacy-on' : 'privacy-off' as const;
      setTranscript(prevT => {
        const last = prevT[prevT.length - 1];
        if (last && last.isSystemMessage && last.systemMessageType === type) {
          return prevT; // prevent duplicate system line
        }
        return [
          ...prevT,
          {
            id,
            speaker: 'System',
            text: type === 'privacy-on' ? 'Privacy mode toggled on' : 'Privacy mode toggled off',
            timestamp,
            isUser: false,
            isSystemMessage: true,
            systemMessageType: type
          }
        ];
      });
      return next;
    });
    setShowBotControls(false);
  };

  // Responsiveness: auto-collapse sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      const isSmall = window.innerWidth < 768; // Tailwind md breakpoint
      if (isSmall) {
        setIsSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBotControls && !(event.target as Element).closest('.bot-controls-dropdown')) {
        setShowBotControls(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBotControls]);

  useEffect(() => {
    const interval = setInterval(() => setMeetingDuration(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ping = setInterval(() => {
      // Placeholder hook for live connection heartbeat
      // setIsConnected(prev => prev);
    }, 15000);
    return () => clearInterval(ping);
  }, []);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fetch meeting details on mount
  useEffect(() => {
    const fetchMeeting = async () => {
      if (!id) return;
      try {
        const response = await apiService.getMeetingById(parseInt(id));
        if (response.error) {
          toastError(response.error, 'Error');
          navigate('/workspace/meetings');
          return;
        }
        if (response.data?.meeting) {
          const fetchedMeeting = response.data.meeting;
          setMeeting(fetchedMeeting);
          
          // Check if bot has already joined - only consider 'in-progress' as confirmed join
          const botHasJoined = fetchedMeeting.metadata?.botJoinTriggeredAt && 
                              fetchedMeeting.status === 'in-progress';
          
          if (botHasJoined) {
            setIsBotJoined(true);
            setIsWaitingForBot(false);
          } else {
            // Keep waiting if bot hasn't joined yet
            setIsWaitingForBot(true);
          }
        }
      } catch (e: any) {
        // Only show error for critical failures, not auth errors during polling
        if (!e?.message?.includes('token') && !e?.message?.includes('Access')) {
          toastError(e?.message || 'Failed to load meeting', 'Error');
        }
      }
    };
    fetchMeeting();
  }, [id, navigate, toastError]);

  // Auto-trigger bot join on live page if not yet triggered, and poll for join status
  useEffect(() => {
    if (!meeting || isBotJoined || pollingActiveRef.current) return;
    
    pollingActiveRef.current = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const meetingId = meeting.id;
    const meetingLink = meeting.meetingLink;
    const meetingStatus = meeting.status;
    const startTime = meeting.startTime;
    const alreadyTriggeredAtStart = !!meeting.metadata?.botJoinTriggeredAt;
    
    const triggerJoinIfNeeded = async () => {
      const hasValidLink = !!meetingLink && typeof meetingLink === 'string';
      const isLive = meetingStatus === 'in-progress' || meetingStatus === 'upcoming' || new Date(startTime).getTime() <= Date.now();
      let alreadyTriggered = alreadyTriggeredAtStart;
      
      // Only stop waiting if meeting is invalid - otherwise keep waiting for bot
      if (!hasValidLink || !isLive) {
        // If no valid link or not live, we can't join, so stop waiting
        setIsWaitingForBot(false);
        return;
      }
      
      // Ensure we're waiting if meeting is live and bot hasn't joined
      setIsWaitingForBot(true);
      
      // If bot already joined (status is in-progress), stop waiting
      if (alreadyTriggered && meetingStatus === 'in-progress') {
        setIsBotJoined(true);
        setIsWaitingForBot(false);
        toastSuccess('Bot has successfully joined the meeting', 'Bot Joined');
        return;
      }
      
      // Start polling to check bot join status - this will run whether we trigger join or not
      pollInterval = setInterval(async () => {
        try {
          const response = await apiService.getMeetingById(meetingId);
          if (response.data?.meeting) {
            const updatedMeeting = response.data.meeting;
            // Update meeting state, but don't let it trigger effect re-run
            setMeeting((prev: any) => {
              // Only update if meeting ID matches
              if (prev?.id === meetingId) {
                return updatedMeeting;
              }
              return prev;
            });
            
            // Only consider 'in-progress' status as confirmed join
            const botHasJoined = updatedMeeting.metadata?.botJoinTriggeredAt && 
                                updatedMeeting.status === 'in-progress';
            
            if (botHasJoined) {
              setIsBotJoined(true);
              setIsWaitingForBot(false);
              setIsBotJoining(false);
              pollingActiveRef.current = false;
              toastSuccess('Bot has successfully joined the meeting', 'Bot Joined');
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              return;
            }
            
            // Only show error if backend explicitly set botJoinError in metadata
            if (updatedMeeting.metadata?.botJoinError) {
              setIsWaitingForBot(false);
              setIsBotJoining(false);
              pollingActiveRef.current = false;
              toastError(updatedMeeting.metadata.botJoinError || 'Bot failed to join the meeting', 'Bot Join Failed');
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              return;
            }
          }
        } catch (e: any) {
          // Suppress auth/token errors during polling - they're transient
          if (!e?.message?.includes('token') && !e?.message?.includes('Access') && !e?.message?.includes('Unauthorized')) {
            console.error('Error polling meeting status:', e);
          }
        }
      }, 2000); // Poll every 2 seconds
      
      // Trigger bot join if not already triggered
      if (!alreadyTriggered) {
        try {
          setIsBotJoining(true);
          const result = await meetService.joinMeeting(meetingId, meetingLink);
          if (!result.success) {
            // Only show error for explicit failures, not auth errors
            if (result.message && !result.message.includes('token') && !result.message.includes('Access')) {
              toastError(result.message, 'Bot Join Failed');
            }
            // Keep polling even if trigger failed - backend might still join via cron
          }
        } catch (e: any) {
          // Suppress auth/token errors - they're transient
          if (!e?.message?.includes('token') && !e?.message?.includes('Access') && !e?.message?.includes('Unauthorized')) {
            console.error('Error triggering bot join:', e);
          }
          // Keep polling even if trigger failed - backend might still join via cron
        }
      }
      
      // Stop polling after 120 seconds max (give more time for bot to join)
      timeoutId = setTimeout(() => {
        pollingActiveRef.current = false;
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        if (!isBotJoined) {
          setIsWaitingForBot(false);
          setIsBotJoining(false);
          toastError('Bot join is taking longer than expected. Please check the meeting status.', 'Warning');
        }
      }, 120000); // 2 minutes
    };
    
    triggerJoinIfNeeded();
    
    return () => {
      pollingActiveRef.current = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [meeting?.id, isBotJoined, toastSuccess, toastError]); // Only depend on meeting ID to prevent re-runs on meeting updates

  const addNote = () => {
    if (newNote.trim()) {
      setNotes([
        ...notes,
        {
        id: Date.now().toString(),
        text: newNote,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          author: 'You',
          isPrivate: newNotePrivacy === 'private'
        }
      ]);
      setNewNote('');
      setNewNotePrivacy('public');
    }
  };

  const addActionItem = () => {
    if (newAction.trim()) {
      const id = Date.now().toString();
      setActionItems([...actionItems, { id, text: newAction, assignee: 'Unassigned', isCompleted: false }]);
      setActionStatusById(prev => ({ ...prev, [id]: 'undecided' }));
      setNewAction('');
    }
  };

  // removed checkbox UI; keep for future if needed
  const setActionStatus = (id: string, status: ActionStatus) => {
    setActionStatusById(prev => ({ ...prev, [id]: status }));
  };
  const submitMemoryChat = () => {
    const text = memoryChatInput.trim();
    if (!text) return;
    const id = Date.now().toString();
    setMemoryChat(prev => [...prev, { id, role: 'user', text }]);
    setMemoryChatInput('');
    setTimeout(() => {
      setMemoryChat(prev => [...prev, { id: id + '-bot', role: 'bot', text: 'Got it. I will recall this context during the meeting.' }]);
    }, 400);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'decision': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'question': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'important': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const tabs = [
    { id: 'memory' as SidebarTab, label: 'Memory', icon: Brain, count: memoryItems.length },
    { id: 'chat' as SidebarTab, label: 'Chat', icon: MessageSquare, count: memoryChat.length },
    { id: 'actions' as SidebarTab, label: 'Actions', icon: CheckSquare, count: actionItems.filter(a => !a.isCompleted).length },
    { id: 'notes' as SidebarTab, label: 'Notes', icon: StickyNote, count: notes.length },
  ];

  const mobileTabs = [
    ...tabs,
    { id: 'transcript' as SidebarTab, label: 'Transcript', icon: MessageSquare, count: transcript.length },
    { id: 'insights' as SidebarTab, label: 'Insights', icon: Sparkles, count: insights.length },
  ];

  // Show loading screen while waiting for bot to join
  if (isWaitingForBot && !isBotJoined) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {isBotJoining ? 'Joining Meeting...' : 'Waiting for Bot to Join...'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Please wait while the bot joins the meeting.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="rounded-lg overflow-hidden h-[calc(100vh-8rem)] flex flex-col bg-white border border-gray-200 dark:bg-slate-900/50 dark:border-slate-700/50">
        
        {/* Compact Top Bar */}
        <div className="px-4 py-2.5 flex-shrink-0 bg-gray-50 border-b border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center gap-1.5 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-red-500/10 border border-red-500/30 rounded">
                <Circle className="w-1.5 h-1.5 fill-red-500 text-red-500 animate-pulse" />
                <span className="hidden sm:inline text-xs font-medium text-red-400">REC</span>
              </div>
              <h1 className="text-sm font-semibold text-black truncate max-w-[40vw] sm:max-w-none dark:text-white">Sprint Planning – Team Kairo</h1>
              <button
                type="button"
                aria-pressed={isSidebarCollapsed}
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setIsSidebarCollapsed(v => !v)}
                className="ml-1 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[11px] sm:text-xs rounded transition-colors text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 dark:text-slate-200 dark:bg-slate-700/40 dark:border-slate-600/50 dark:hover:bg-slate-700/60"
              >
                <span className="hidden sm:inline">{isSidebarCollapsed ? 'Show Tabs' : 'Hide Tabs'}</span>
                <span className="sm:hidden">Tabs</span>
              </button>
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded border ${isConnected ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/10' : 'border-yellow-300 bg-yellow-100 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10'}` }>
                <Circle className={`w-1.5 h-1.5 ${isConnected ? 'fill-green-500 text-green-500' : 'fill-yellow-500 text-yellow-500'}`} />
                <span className={`text-[11px] ${isConnected ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>{isConnected ? 'Connected · Stable' : 'Reconnecting…'}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden xs:flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-medium tabular-nums">{formatDuration(meetingDuration)}</span>
              </div>
              <div className="hidden sm:flex items-center relative">
                <div className="flex -space-x-2">
                  {participants.slice(0, 4).map(p => (
                    <div key={p.id} title={p.name} className={`w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-[10px] text-white font-semibold flex items-center justify-center ring-1 ring-slate-800 ${p.isSpeaking ? 'ring-2 ring-green-500' : ''}`}>
                      {p.avatar}
                    </div>
                  ))}
                </div>
                {participants.length > 4 && (
                  <span className="ml-2 text-xs text-slate-400">+{participants.length - 4}</span>
                )}
                <div className="relative">
                  <button onClick={() => setShowParticipants(!showParticipants)} className="ml-2 px-2 py-1 text-xs rounded transition-colors text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 dark:text-slate-200 dark:bg-slate-700/40 dark:border-slate-600/50 dark:hover:bg-slate-700/60">Participants</button>
                  {showParticipants && (
                    <div className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-2xl z-40 overflow-hidden bg-white border border-gray-200 dark:bg-slate-900/95 dark:border-slate-700/60">
                      <div className="px-3 py-2 border-b flex items-center justify-between bg-gray-50 border-gray-200 dark:border-slate-700/60 dark:bg-slate-800/50">
                        <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">Participants</span>
                        <span className="text-[11px] text-gray-500 dark:text-slate-400">{participants.length} total</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {participants.map((participant) => (
                          <div key={participant.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[10px] font-semibold text-white ${participant.isSpeaking ? 'ring-2 ring-green-500' : ''}`}>{participant.avatar}</div>
                              <div>
                                <p className="text-xs text-gray-900 dark:text-white leading-tight">{participant.name}</p>
                                <p className="text-[10px] text-gray-500 dark:text-slate-500 leading-tight">{participant.isMuted ? 'Muted' : 'Speaking'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {participant.name === 'Kairo Bot' ? (
                                <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                              ) : (
                                <>
                                  {participant.isMuted ? <MicOff className="w-3 h-3 text-red-400" /> : <Mic className="w-3 h-3 text-green-400" />}
                                  {!participant.isVideoOn && <VideoOff className="w-3 h-3 text-slate-500" />}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
            </div>
              
              {/* Bot Controls Dropdown */}
              <div className="relative bot-controls-dropdown">
                <button
                  onClick={() => setShowBotControls(!showBotControls)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100 dark:bg-purple-600/10 dark:text-white dark:border-purple-500/30 dark:hover:bg-purple-600/20"
                >
                  <Circle className={`w-2 h-2 ${isPrivacyMode ? 'fill-orange-500' : isPaused ? 'fill-yellow-500' : 'fill-green-500'}`} />
                  <span className="hidden xs:inline">Kairo Bot</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showBotControls ? 'rotate-180' : ''}`} />
                </button>
                
                {showBotControls && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-lg shadow-2xl z-50 overflow-hidden bg-white border border-gray-200 dark:bg-slate-800/95 dark:border-slate-700/50">
                    <div className="p-1">
                      <button onClick={() => { setIsRecording(!isRecording); setShowBotControls(false); }} className="w-full flex items-center justify-between px-3 py-2 text-sm rounded transition-all text-gray-700 hover:bg-gray-50 dark:text-white dark:hover:bg-slate-700/50">
                        <span className="flex items-center gap-2"><Circle className={`w-3.5 h-3.5 ${isRecording ? 'fill-red-500' : 'fill-slate-500'}`} /> Recording</span>
                        <span className={`text-xs ${isRecording ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-slate-400'}`}>{isRecording ? 'On' : 'Off'}</span>
                      </button>
                      <button onClick={togglePrivacyMode} className="w-full flex items-center justify-between px-3 py-2 text-sm rounded transition-all text-gray-700 hover:bg-gray-50 dark:text-white dark:hover:bg-slate-700/50">
                        <span className="flex items-center gap-2"><EyeOff className="w-3.5 h-3.5" /> Privacy Mode</span>
                        <span className={`text-xs ${isPrivacyMode ? 'text-orange-600 dark:text-orange-300' : 'text-gray-500 dark:text-slate-400'}`}>{isPrivacyMode ? 'On' : 'Off'}</span>
                      </button>
                      <button onClick={() => { setIsVisualCaptureEnabled(!isVisualCaptureEnabled); setShowBotControls(false); }} className="w-full flex items-center justify-between px-3 py-2 text-sm rounded transition-all text-gray-700 hover:bg-gray-50 dark:text-white dark:hover:bg-slate-700/50">
                        <span className="flex items-center gap-2"><VideoOff className={`w-3.5 h-3.5 ${isVisualCaptureEnabled ? 'rotate-180' : ''}`} /> Visual Capture</span>
                        <span className={`text-xs ${isVisualCaptureEnabled ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-slate-400'}`}>{isVisualCaptureEnabled ? 'Enabled' : 'Disabled'}</span>
                      </button>
                      <button onClick={() => { setIsRealtimeInsightsEnabled(!isRealtimeInsightsEnabled); setShowBotControls(false); }} className="w-full flex items-center justify-between px-3 py-2 text-sm rounded transition-all text-gray-700 hover:bg-gray-50 dark:text-white dark:hover:bg-slate-700/50">
                        <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Real-time Insights</span>
                        <span className={`text-xs ${isRealtimeInsightsEnabled ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-slate-400'}`}>{isRealtimeInsightsEnabled ? 'Enabled' : 'Disabled'}</span>
                      </button>
                      <button onClick={() => { /* trigger extract */ setShowBotControls(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded transition-all text-gray-700 hover:bg-gray-50 dark:text-white dark:hover:bg-slate-700/50">
                        <Activity className="w-3.5 h-3.5" /> Extract Action Items So Far
                      </button>
                      <button onClick={() => { /* open settings */ setShowBotControls(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded transition-all text-gray-700 hover:bg-gray-50 dark:text-white dark:hover:bg-slate-700/50">
                        <SettingsIcon className="w-3.5 h-3.5" /> Settings
                      </button>
                      <div className="border-t my-1 border-gray-200 dark:border-slate-700/50"></div>
                      <button onClick={() => setShowBotControls(false)} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded transition-all text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
                        <LogOut className="w-3.5 h-3.5" /> Leave Meeting
                      </button>
          </div>
            </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0 flex-col md:flex-row pb-14 md:pb-0">
        {/* Left Sidebar - Compact Tabs */}
        <div className={`hidden md:flex ${isSidebarCollapsed ? 'md:w-14' : 'md:w-72'} flex-col transition-[width] duration-300 ease-in-out bg-gray-50 border-r border-gray-200 dark:bg-slate-900/30 dark:border-slate-700/50`} aria-label="Sidebar tabs" aria-expanded={!isSidebarCollapsed}>
          <div
            className={`border-b ${
              isSidebarCollapsed ? 'flex flex-col items-center gap-2 py-2 px-1' : 'flex gap-1 p-1'
            } bg-white border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50`}
            role="tablist"
            aria-orientation={isSidebarCollapsed ? 'vertical' : 'horizontal'}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
            <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === activeTab) {
                      setIsSidebarCollapsed(prev => !prev);
                    } else {
                      setActiveTab(tab.id);
                      setIsSidebarCollapsed(false);
                    }
                  }}
                  className={`${
                    isSidebarCollapsed
                      ? 'w-full flex items-center justify-center px-2 py-2'
                      : 'flex-1 flex flex-col items-center gap-1 px-2 py-2'
                  } rounded transition-all ${
                    activeTab === tab.id
                      ? 'bg-purple-50 text-purple-700 border border-purple-300 dark:bg-purple-600/20 dark:text-white dark:border-purple-500/30'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {!isSidebarCollapsed && (
                    <>
                      <span className="text-xs font-medium">{tab.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        activeTab === tab.id ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700/50 dark:text-slate-500'
                      }`}>
                        {tab.count}
                      </span>
                    </>
                  )}
            </button>
              );
            })}
          </div>

          {!isSidebarCollapsed && (
            <div className={`flex-1 overflow-y-auto p-3`}>
            {activeTab === 'memory' && (
                <MemoryTab memoryItems={memoryItems as any} />
              )}

              {activeTab === 'chat' && (
                <LiveChat
                  messages={memoryChat}
                  input={memoryChatInput}
                  onChangeInput={setMemoryChatInput}
                  onSubmit={submitMemoryChat}
                />
            )}

            {activeTab === 'actions' && (
                <ActionItemsTab
                  actionItems={actionItems}
                  actionStatusById={actionStatusById}
                  newAction={newAction}
                  onChangeNewAction={setNewAction}
                  onAddAction={addActionItem}
                  onSetStatus={setActionStatus as any}
                />
              )}

              {activeTab === 'notes' && (
                <NotesTab
                  notes={notes as any}
                  newNote={newNote}
                  newNotePrivacy={newNotePrivacy}
                  onChangeNewNote={setNewNote}
                  onChangePrivacy={setNewNotePrivacy}
                  onAddNote={addNote}
                />
              )}
                  </div>
          )}
                </div>

        {/* Mobile Tab Content (full width, above transcript) */}
        <div className="md:hidden px-3 py-2 border-b bg-gray-50 border-gray-200 dark:border-slate-700/50 dark:bg-slate-900/30">
          {activeTab === 'memory' && (
            <MemoryTab memoryItems={memoryItems as any} />
          )}

          {activeTab === 'chat' && (
            <LiveChat
              messages={memoryChat}
              input={memoryChatInput}
              onChangeInput={setMemoryChatInput}
              onSubmit={submitMemoryChat}
            />
          )}

          {activeTab === 'actions' && (
            <ActionItemsTab
              actionItems={actionItems}
              actionStatusById={actionStatusById}
              newAction={newAction}
              onChangeNewAction={setNewAction}
              onAddAction={addActionItem}
              onSetStatus={setActionStatus as any}
            />
            )}

            {activeTab === 'notes' && (
            <NotesTab
              notes={notes as any}
              newNote={newNote}
              newNotePrivacy={newNotePrivacy}
              onChangeNewNote={setNewNote}
              onChangePrivacy={setNewNotePrivacy}
              onAddNote={addNote}
            />
          )}

          {activeTab === 'transcript' && (
            <div className="min-h-[40vh]">
              <TranscriptTab
                transcriptRef={transcriptRef as React.RefObject<HTMLDivElement>}
                transcript={transcript}
                onRefer={(text) => {
                  const quoted = text.includes('\n') ? `"""\n${text}\n"""` : `"${text}"`;
                  setMemoryChatInput(prev => prev ? `${prev}\n${quoted}` : quoted);
                }}
              />
                </div>
          )}

          {activeTab === 'insights' && (
            <div className="min-h-[40vh]">
              <div className="border-b border-slate-700/50 px-2 py-2 bg-slate-800/20 flex-shrink-0 rounded-t">
                <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  AI Insights
                </h2>
                  </div>
              <InsightsTab insights={insights} getCategoryColor={getCategoryColor} />
              </div>
            )}
        </div>

        {/* Center - Transcript (grow to available width) */}
        <div className="hidden md:block flex-1 min-w-0">
          <TranscriptTab
            transcriptRef={transcriptRef as React.RefObject<HTMLDivElement>}
            transcript={transcript}
            onRefer={(text) => {
              const quoted = text.includes('\n') ? `"""\n${text}\n"""` : `"${text}"`;
              setMemoryChatInput(prev => prev ? `${prev}\n${quoted}` : quoted);
            }}
          />
        </div>

        {/* Right Panel - AI Insights (hidden on small screens) */}
        <div className="hidden md:flex w-72 flex-col bg-gray-50 border-l border-gray-200 dark:bg-slate-900/30 dark:border-slate-700/50">
          <div className="px-4 py-2.5 flex-shrink-0 border-b bg-gray-100 border-gray-200 dark:border-slate-700/50 dark:bg-slate-800/20">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI Insights
            </h2>
          </div>
          <InsightsTab insights={insights} getCategoryColor={getCategoryColor} />
              </div>
            </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-2 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-2 py-1 shadow-lg backdrop-blur border bg-white/80 border-gray-200 dark:bg-slate-800/80 dark:border-slate-700/60" role="tablist" aria-label="Mobile navigation">
        <ul className="flex items-center gap-2">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  aria-label={tab.label}
                  aria-current={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${isActive ? 'bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-600/30 dark:text-white dark:border-purple-500/40' : 'text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white'} relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-purple-600 text-white text-[10px] leading-4 text-center border border-purple-500/60">
                      {tab.count > 99 ? '99+' : tab.count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Status Bar */}
      <div className="border-t px-3 sm:px-4 py-2 flex-shrink-0 bg-gray-50 border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
              <Circle className={`w-2 h-2 ${isPrivacyMode ? 'fill-orange-500' : isPaused ? 'fill-yellow-500' : isRecording ? 'fill-green-500' : 'fill-slate-500'}`} />
              <span className="text-xs text-gray-600 dark:text-slate-400">
                {isPrivacyMode ? 'Privacy Mode' : isPaused ? 'Paused' : isRecording ? 'Recording' : 'Stopped'}
              </span>
                    </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden xs:inline text-xs text-gray-500 dark:text-slate-500">Last updated: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

          </div>
    </Layout>
  );
};

export default LiveMeetingView;