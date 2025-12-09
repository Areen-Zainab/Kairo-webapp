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
import LeaveMeetingConfirmationModal from '../../modals/LeaveMeetingConfirmationModal';
import { useLiveTranscript } from '../../hooks/useLiveTranscript';
import { useLiveAIInsights } from '../../hooks/useLiveAIInsights';
import { useActionItems } from '../../hooks/useActionItems';

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

type ActionStatus = 'confirmed' | 'removed' | 'undecided';

const LiveMeetingView = () => {
  const { id, workspaceId } = useParams<{ id: string; workspaceId?: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastContext();

  const handleLeaveMeeting = () => {
    setShowBotControls(false);
    setShowLeaveModal(true);
  };

  const handleConfirmLeave = async () => {
    if (isLeavingMeeting) return; // Prevent double-clicks

    setIsLeavingMeeting(true);

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('Leave meeting operation timed out after 30 seconds');
      toastError('Operation timed out. Please try again.', 'Timeout');
      setShowLeaveModal(false);
      setIsLeavingMeeting(false);
    }, 30000); // 30 second timeout

    try {
      // Try to get meeting ID from multiple sources
      let meetId: number | null = null;

      if (meeting?.id && typeof meeting.id === 'number') {
        meetId = meeting.id;
      } else if (id) {
        meetId = parseInt(String(id));
      }

      if (!meetId || isNaN(meetId)) {
        clearTimeout(timeoutId);
        console.error('Invalid meeting ID:', { meeting, id, meetId });
        toastError('Invalid meeting id', 'Error');
        setShowLeaveModal(false);
        setIsLeavingMeeting(false);
        return;
      }

      console.log('Leaving meeting:', meetId);

      // Mark meeting as completed (this will automatically close the bot's meeting tab via backend)
      console.log('Calling updateMeetingStatus API...');
      console.log('Request details:', JSON.stringify({
        meetingId: meetId,
        endpoint: `/api/meetings/${meetId}/status`,
        method: 'PATCH',
        status: 'completed'
      }, null, 2));

      // Add a timeout promise to prevent hanging (increased to 45 seconds to allow stopMeetingSession to complete)
      const apiCallPromise = apiService.updateMeetingStatus(meetId, 'completed');
      const timeoutPromise = new Promise<{ error: string }>((resolve) =>
        setTimeout(() => {
          console.error('API call timed out after 45 seconds');
          resolve({ error: 'Request timeout: Server did not respond in time. The meeting may still be processed in the background.' });
        }, 45000)
      );

      const resp = await Promise.race([apiCallPromise, timeoutPromise]);

      clearTimeout(timeoutId); // Clear timeout on successful response

      console.log('API Response received:');
      console.log(JSON.stringify(resp, null, 2));

      // Check for error in response
      if ('error' in resp && resp.error) {
        console.error('API error:', resp.error);
        toastError(resp.error, 'Update Failed');
        setShowLeaveModal(false);
        setIsLeavingMeeting(false);
        return;
      }

      // Ensure we have a valid response with data
      if (!resp || !('data' in resp) || !resp.data) {
        console.error('Invalid API response:', resp);
        toastError('Invalid response from server', 'Error');
        setShowLeaveModal(false);
        setIsLeavingMeeting(false);
        return;
      }

      console.log('Meeting marked as completed successfully, navigating...', resp);
      toastSuccess('Meeting marked as completed', 'Meeting Completed');

      // Close modal immediately
      setShowLeaveModal(false);

      // Reset loading state before navigation (navigation will unmount component if successful)
      setIsLeavingMeeting(false);

      // Navigate to meetings page with state to show ended banner
      const endedId = String(meetId);
      const navPath = workspaceId
        ? `/workspace/${workspaceId}/meetings`
        : '/workspace/meetings';

      console.log('Navigating to:', navPath);

      // Navigate immediately - if successful, component unmounts, if it fails, user can try again
      navigate(navPath, { state: { endedMeetingId: endedId } });

    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error('Error leaving meeting:', e);
      console.error('Error details:', {
        message: e?.message,
        stack: e?.stack,
        response: e?.response,
        status: e?.status
      });
      toastError(e?.message || 'Failed to complete meeting', 'Error');
      setShowLeaveModal(false);
      setIsLeavingMeeting(false);
    }
  };
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
  const [memoryChat, setMemoryChat] = useState<{ id: string; role: 'user' | 'bot'; text: string }[]>([]);
  const [meeting, setMeeting] = useState<any>(null);
  const [isBotJoining, setIsBotJoining] = useState(false);
  const [isBotJoined, setIsBotJoined] = useState(false);
  const [isWaitingForBot, setIsWaitingForBot] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeavingMeeting, setIsLeavingMeeting] = useState(false);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const pollingActiveRef = useRef(false);
  const joinRequestInProgressRef = useRef(false); // Atomic flag to prevent duplicate join requests

  const participants: Participant[] = [
    { id: '1', name: 'Kairo Bot', avatar: 'KB', isMuted: false, isVideoOn: false, isSpeaking: false },
    { id: '2', name: 'Sana Khan', avatar: 'SK', isMuted: false, isVideoOn: true, isSpeaking: true },
    { id: '3', name: 'Muhammad Ali', avatar: 'MA', isMuted: true, isVideoOn: true, isSpeaking: false },
    { id: '4', name: 'Fatima Sheikh', avatar: 'FS', isMuted: false, isVideoOn: false, isSpeaking: false },
  ];

  // Get live transcript entries from backend
  const meetingId = meeting ? parseInt(meeting.id) : null;
  const { entries: liveTranscriptEntries, loading: transcriptLoading, isConnected: isTranscriptConnected } = useLiveTranscript(meetingId, 3000);

  // System messages from privacy mode toggle
  const [systemMessages, setSystemMessages] = useState<TranscriptEntry[]>([]);

  // Merge live transcript entries with system messages
  // Live entries are already sorted by chunkIndex from backend, so we maintain that order
  // System messages are appended and will be sorted by timestamp
  const transcript: TranscriptEntry[] = [
    ...liveTranscriptEntries.map(entry => ({
      id: entry.id,
      speaker: entry.speaker,
      text: entry.text,
      timestamp: entry.timestamp,
      isUser: false
    })),
    ...systemMessages
  ].sort((a, b) => {
    // Sort by timestamp string (already formatted as "10:02 AM")
    // This works because timestamps are in chronological order
    const aTime = a.timestamp || '';
    const bTime = b.timestamp || '';
    return aTime.localeCompare(bTime);
  });

  // Fetch live AI insights
  const { insights: aiInsights } = useLiveAIInsights(id);

  // Fetch live action items from database (extracted during meeting)
  const meetingIdNum = id ? parseInt(id, 10) : null;
  const { actionItems: dbActionItems, loading: actionItemsLoading, confirmActionItem, rejectActionItem } = useActionItems(
    Number.isNaN(meetingIdNum) ? null : meetingIdNum,
    12000, // Poll every 12 seconds
    true   // Enable WebSocket
  );

  // Map database action items to UI format
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  type ActionStatus = 'confirmed' | 'removed' | 'undecided';
  const [actionStatusById, setActionStatusById] = useState<Record<string, ActionStatus>>({});

  // Update action items when database action items change
  useEffect(() => {
    if (dbActionItems && dbActionItems.length > 0) {
      const mappedItems = dbActionItems
        .filter(item => item.status === 'pending' || item.status === 'confirmed') // Only show pending/confirmed
        .map((item) => ({
          id: String(item.id),
          text: item.title || item.description || 'Untitled Action Item',
          assignee: item.assignee || 'Unassigned',
          isCompleted: item.status === 'confirmed'
        }));
      setActionItems(mappedItems);

      // Initialize status for new items based on database status
      const newStatuses: Record<string, ActionStatus> = {};
      mappedItems.forEach(item => {
        const dbItem = dbActionItems.find(ai => String(ai.id) === item.id);
        if (dbItem) {
          // Map database status to UI status
          if (dbItem.status === 'confirmed') {
            newStatuses[item.id] = 'confirmed';
          } else if (dbItem.status === 'rejected') {
            newStatuses[item.id] = 'removed';
          } else {
            newStatuses[item.id] = 'undecided';
          }
        } else if (!(item.id in actionStatusById)) {
          newStatuses[item.id] = 'undecided';
        }
      });
      if (Object.keys(newStatuses).length > 0) {
        setActionStatusById(prev => ({ ...prev, ...newStatuses }));
      }
    } else {
      // Clear action items if none exist
      setActionItems([]);
    }
  }, [dbActionItems]);

  // Map AI insights to insights array
  const [insights, setInsights] = useState<Insight[]>([]);

  // Update insights when AI insights change
  useEffect(() => {
    if (aiInsights?.keyDecisions && aiInsights.keyDecisions.length > 0) {
      const mappedInsights = aiInsights.keyDecisions.map((decision, index) => ({
        id: String(index),
        text: decision.decision,
        timestamp: decision.timestamp || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        category: 'decision' as const
      }));
      setInsights(mappedInsights);
    }
  }, [aiInsights]);

  const [notes, setNotes] = useState<any[]>([]);
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
      setSystemMessages(prevMsgs => {
        const last = prevMsgs[prevMsgs.length - 1];
        if (last && last.isSystemMessage && last.systemMessageType === type) {
          return prevMsgs; // prevent duplicate system line
        }
        return [
          ...prevMsgs,
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

          // Load existing notes for this meeting
          try {
            apiService.getMeetingNotes(fetchedMeeting.id).then((notesResp) => {
              if (notesResp.data?.notes) {
                const mapped = notesResp.data.notes.map((n: any) => ({
                  id: String(n.id),
                  text: n.content,
                  // For live page, show human time instead of raw seconds
                  timestamp: n.type === 'timeline'
                    ? `${Math.floor(n.timestamp / 60)}:${String(n.timestamp % 60).padStart(2, '0')}`
                    : new Date(n.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  author: n.author?.name || 'Unknown',
                  isPrivate: false, // backend does not yet model privacy; treat as public
                  color: n.color,
                  type: n.type,
                  rawTimestamp: n.timestamp,
                }));
                setNotes(mapped);
              }
            });
          } catch (e) {
            console.error('Failed to load meeting notes', e);
          }

          // Check if bot has already joined - only consider 'in-progress' as confirmed join
          let botHasJoined = false;
          if (fetchedMeeting.metadata?.botStatus) {
            botHasJoined = fetchedMeeting.metadata.botStatus === 'joined';
          } else {
            botHasJoined = fetchedMeeting.metadata?.botJoinTriggeredAt &&
              fetchedMeeting.status === 'in-progress';
          }

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
    // Atomic check: if already processing or bot joined, return immediately
    if (!meeting || isBotJoined || pollingActiveRef.current || joinRequestInProgressRef.current) return;

    // Set flags atomically to prevent race conditions
    pollingActiveRef.current = true;
    joinRequestInProgressRef.current = true;

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
        joinRequestInProgressRef.current = false;
        return;
      }

      // Ensure we're waiting if meeting is live and bot hasn't joined
      setIsWaitingForBot(true);

      // If bot already joined (status is in-progress), stop waiting
      if (alreadyTriggered && meetingStatus === 'in-progress') {
        setIsBotJoined(true);
        setIsWaitingForBot(false);
        joinRequestInProgressRef.current = false;
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
            // Prioritize explicit botStatus from backend, fallback to legacy check
            let botHasJoined = false;
            if (updatedMeeting.metadata?.botStatus) {
              botHasJoined = updatedMeeting.metadata.botStatus === 'joined';
            } else {
              botHasJoined = updatedMeeting.metadata?.botJoinTriggeredAt &&
                updatedMeeting.status === 'in-progress';
            }

            if (botHasJoined) {
              setIsBotJoined(true);
              setIsWaitingForBot(false);
              setIsBotJoining(false);
              pollingActiveRef.current = false;
              joinRequestInProgressRef.current = false;
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
              joinRequestInProgressRef.current = false;
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

      // Trigger bot join if not already triggered - use atomic check
      if (!alreadyTriggered) {
        try {
          setIsBotJoining(true);
          const result = await meetService.joinMeeting(meetingId, meetingLink);
          // Clear join request flag after API call completes
          joinRequestInProgressRef.current = false;

          if (!result.success) {
            // Show auth errors clearly - user needs to know if they need to log in
            const isAuthError = result.message?.toLowerCase().includes('token') ||
              result.message?.toLowerCase().includes('access') ||
              result.message?.toLowerCase().includes('authentication') ||
              result.message?.toLowerCase().includes('log in') ||
              result.message?.toLowerCase().includes('unauthorized');

            if (isAuthError) {
              toastError(
                result.message || 'Authentication required. Please log in to join the meeting with the bot. The bot will join automatically via the scheduled job if you are logged in.',
                'Authentication Required'
              );
              // Don't keep polling if auth failed - user needs to log in
              setIsWaitingForBot(false);
              setIsBotJoining(false);
            } else if (result.message) {
              // Show other errors
              toastError(result.message, 'Bot Join Failed');
              // Keep polling for non-auth errors - backend might still join via cron
            }
          }
        } catch (e: any) {
          // Clear join request flag on error
          joinRequestInProgressRef.current = false;

          // Show auth errors clearly
          const isAuthError = e?.message?.toLowerCase().includes('token') ||
            e?.message?.toLowerCase().includes('access') ||
            e?.message?.toLowerCase().includes('unauthorized') ||
            e?.message?.toLowerCase().includes('authentication');

          if (isAuthError) {
            toastError(
              'Authentication required. Please log in to join the meeting with the bot. The bot will join automatically via the scheduled job if you are logged in.',
              'Authentication Required'
            );
            // Don't keep polling if auth failed - user needs to log in
            setIsWaitingForBot(false);
            setIsBotJoining(false);
          } else {
            console.error('Error triggering bot join:', e);
            if (e?.message) {
              toastError(e.message, 'Bot Join Error');
            }
            // Keep polling for non-auth errors - backend might still join via cron
          }
        }
      } else {
        // If already triggered, clear the flag
        joinRequestInProgressRef.current = false;
      }

      // Stop polling after 120 seconds max (give more time for bot to join)
      timeoutId = setTimeout(() => {
        pollingActiveRef.current = false;
        joinRequestInProgressRef.current = false;
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
      joinRequestInProgressRef.current = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [meeting?.id, isBotJoined]); // Removed toastSuccess/toastError from dependencies to prevent re-runs

  const addNote = async () => {
    if (!newNote.trim() || !meeting?.id) return;

    const content = newNote.trim();
    const createdAtLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Optimistic UI
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      text: content,
      timestamp: createdAtLabel,
      author: 'You',
      isPrivate: newNotePrivacy === 'private',
      color: '#3b82f6',
      type: 'manual',
      rawTimestamp: 0,
    };
    setNotes(prev => [...prev, optimistic]);
    setNewNote('');
    setNewNotePrivacy('public');

    try {
      const resp = await apiService.createMeetingNote(meeting.id, {
        content,
        type: 'manual',
        timestamp: 0,
        color: optimistic.color,
      });

      if (resp.error || !resp.data?.note) {
        // Revert optimistic note on error
        setNotes(prev => prev.filter(n => n.id !== tempId));
        toastError(resp.error || 'Failed to save note', 'Error');
        return;
      }

      const saved = resp.data.note;
      setNotes(prev =>
        prev.map(n =>
          n.id === tempId
            ? {
              id: String(saved.id),
              text: saved.content,
              timestamp: createdAtLabel,
              author: saved.author?.name || 'You',
              isPrivate: optimistic.isPrivate,
              color: saved.color,
              type: saved.type,
              rawTimestamp: saved.timestamp,
            }
            : n
        )
      );
    } catch (e: any) {
      console.error('Failed to create meeting note', e);
      setNotes(prev => prev.filter(n => n.id !== tempId));
      toastError(e?.message || 'Failed to save note', 'Error');
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

  // Update action item status and sync with backend
  const setActionStatus = async (id: string, status: ActionStatus) => {
    const actionItemId = parseInt(id, 10);
    if (isNaN(actionItemId)) {
      // Local-only action item (not from database)
      setActionStatusById(prev => ({ ...prev, [id]: status }));
      return;
    }

    try {
      // Sync with backend
      if (status === 'confirmed') {
        await confirmActionItem(actionItemId);
      } else if (status === 'removed') {
        await rejectActionItem(actionItemId);
      }
      // Update local state
      setActionStatusById(prev => ({ ...prev, [id]: status }));
    } catch (error: any) {
      console.error('Failed to update action item status:', error);
      toastError(error?.message || 'Failed to update action item', 'Error');
    }
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
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded border ${isConnected ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-500/30 dark:bg-green-500/10' : 'border-yellow-300 bg-yellow-100 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10'}`}>
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
                      <button onClick={handleLeaveMeeting} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded transition-all text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
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
              className={`border-b ${isSidebarCollapsed ? 'flex flex-col items-center gap-2 py-2 px-1' : 'flex gap-1 p-1'
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
                    className={`${isSidebarCollapsed
                      ? 'w-full flex items-center justify-center px-2 py-2'
                      : 'flex-1 flex flex-col items-center gap-1 px-2 py-2'
                      } rounded transition-all ${activeTab === tab.id
                        ? 'bg-purple-50 text-purple-700 border border-purple-300 dark:bg-purple-600/20 dark:text-white dark:border-purple-500/30'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/30'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {!isSidebarCollapsed && (
                      <>
                        <span className="text-xs font-medium">{tab.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/30 dark:text-purple-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-700/50 dark:text-slate-500'
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
                  isLoading={transcriptLoading}
                  isConnected={isTranscriptConnected}
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
                <InsightsTab
                  insights={insights}
                  getCategoryColor={getCategoryColor}
                  summary={aiInsights?.summary?.paragraph}
                />
              </div>
            )}
          </div>

          {/* Center - Transcript (grow to available width) */}
          <div className="hidden md:block flex-1 min-w-0">
            <TranscriptTab
              transcriptRef={transcriptRef as React.RefObject<HTMLDivElement>}
              transcript={transcript}
              isLoading={transcriptLoading}
              isConnected={isTranscriptConnected}
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

      {/* Leave Meeting Confirmation Modal */}
      <LeaveMeetingConfirmationModal
        isOpen={showLeaveModal}
        onClose={() => {
          if (!isLeavingMeeting) {
            setShowLeaveModal(false);
          }
        }}
        onConfirm={handleConfirmLeave}
        meetingTitle={meeting?.title}
        isLoading={isLeavingMeeting}
      />
    </Layout>
  );
};

export default LiveMeetingView;