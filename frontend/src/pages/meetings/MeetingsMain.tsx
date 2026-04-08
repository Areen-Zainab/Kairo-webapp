import { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Video,
  Search,
  Filter,
  ArrowUpRight,
  FileText,
  Brain,
  LayoutGrid,
  List,
  CalendarDays,
  Columns,
  Settings,
  Plus
} from 'lucide-react';
import Layout from '../../components/Layout';
import LiveMeetingBanner from '../../components/meetings/dashboard/LiveMeetingBanner';
import MeetingEndedBanner from '../../components/meetings/dashboard/MeetingEndedBanner';
import ListView from '../../components/meetings/dashboard/ListView';
import GridView from '../../components/meetings/dashboard/GridView';
import KanbanView from '../../components/meetings/dashboard/KanbanView';
import CalendarView from '../../components/meetings/dashboard/CalendarView';
import NewMeetingModal from '../../modals/NewMeetingModal';
import DeleteConfirmationModal from '../../modals/DeleteConfirmationModal';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import apiService from '../../services/api';
import { useToastContext } from '../../context/ToastContext';

type TabType = 'all' | 'upcoming' | 'live' | 'history';
type ViewType = 'list' | 'grid' | 'calendar' | 'kanban';

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  status: 'live' | 'upcoming' | 'completed';
  participants: { name: string; avatar: string }[];
  summary?: string;
  topics?: string[];
  aiInsights?: number;
  tasks?: number;
  transcriptReady?: boolean;
  memoryLinks?: number;
  meetingLink?: string;
  backendId?: number;
  startTimeIso?: string;
}

const MeetingsDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { user, workspaces } = useUser();
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const [searchParams] = useSearchParams();

  const initialTab = (searchParams.get('tab') as TabType) || 'all';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Update tab when URL param changes
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType;
    if (tabParam && ['all', 'upcoming', 'live', 'history'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  const [viewType, setViewType] = useState<ViewType>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [showTimeFilterMenu, setShowTimeFilterMenu] = useState(false);
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    meetingId: number | null;
    meetingName: string;
  }>({
    isOpen: false,
    meetingId: null,
    meetingName: ''
  });

  const [currentWorkspace, setCurrentWorkspace] = useState<any>(null);
  const [realMeetings, setRealMeetings] = useState<any[]>([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);

  const plusMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const timeFilterMenuRef = useRef<HTMLDivElement>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Track live and ended meetings
  const [endedMeetingId, setEndedMeetingId] = useState<string | null>(null);
  const [dismissLiveBanner, setDismissLiveBanner] = useState(false);
  const [dismissEndedBanner, setDismissEndedBanner] = useState(false);
  const [lastKnownLiveMeetings, setLastKnownLiveMeetings] = useState<Set<number>>(new Set());

  const { success: toastSuccess, error: toastError, info: toastInfo } = useToastContext();

  // Track meetings pending insights generation
  const [pendingInsightsMeetings, setPendingInsightsMeetings] = useState<Set<string>>(new Set());

  // Show ended banner if navigated from live page with state
  useEffect(() => {
    const incomingEndedId = location?.state?.endedMeetingId;
    if (incomingEndedId) {
      const idStr = String(incomingEndedId);
      setEndedMeetingId(idStr);
      setDismissEndedBanner(false);

      // Dedupe toast (React Strict Mode runs this effect twice before location state clears)
      const dedupeKey = `kairo:ended-insights-toast:${idStr}`;
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(dedupeKey)) {
        sessionStorage.setItem(dedupeKey, '1');
        toastInfo('Meeting ended. You will be notified when AI insights are ready.', 'Processing', 5000);
      }
      setPendingInsightsMeetings(prev => new Set(prev).add(idStr));

      // Clear state so back/forward doesn't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, toastInfo]);
  // Check if user is areeba@kairo.com to show dummy data


  // Load current workspace from URL param or localStorage
  useEffect(() => {
    if (workspaceId) {
      // Find workspace from context
      const workspace = workspaces.find((ws: any) => String(ws.id) === workspaceId);
      if (workspace) {
        setCurrentWorkspace(workspace);
        localStorage.setItem('currentWorkspace', JSON.stringify(workspace));
      }
    } else {
      // Try to get from localStorage
      const savedWorkspace = localStorage.getItem('currentWorkspace');
      if (savedWorkspace) {
        try {
          setCurrentWorkspace(JSON.parse(savedWorkspace));
        } catch (e) {
          console.error('Failed to parse saved workspace:', e);
        }
      }
    }
  }, [workspaceId, workspaces]);

  // Fetch real meetings when workspace is loaded
  useEffect(() => {
    const fetchMeetings = async () => {
      const wsId = workspaceId || currentWorkspace?.id;
      if (!wsId) return;

      setIsLoadingMeetings(true);
      try {
        const response = await apiService.getMeetingsByWorkspace(parseInt(wsId));
        if (response.data?.meetings) {
          // Sort meetings by creation date (newest first)
          const sortedMeetings = [...response.data.meetings].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.startTime);
            const dateB = new Date(b.createdAt || b.startTime);
            return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
          });
          setRealMeetings(sortedMeetings);
        }
      } catch (error) {
        console.error('Error fetching meetings:', error);
      } finally {
        setIsLoadingMeetings(false);
      }
    };

    fetchMeetings();
  }, [workspaceId, currentWorkspace]);

  const handleMeetingCreated = () => {
    // Refresh meetings after creating a new one
    const wsId = workspaceId || currentWorkspace?.id;
    if (wsId) {
      apiService.getMeetingsByWorkspace(parseInt(wsId))
        .then(response => {
          if (response.data?.meetings) {
            // Sort meetings by creation date (newest first)
            const sortedMeetings = [...response.data.meetings].sort((a, b) => {
              const dateA = new Date(a.createdAt || a.startTime);
              const dateB = new Date(b.createdAt || b.startTime);
              return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
            });
            setRealMeetings(sortedMeetings);
          }
        })
        .catch(error => console.error('Error refreshing meetings:', error));
    }
  };

  const handleJoinMeeting = (meetingLink: string) => {
    if (meetingLink) {
      window.open(meetingLink, '_blank');
    } else {
      toastError('No meeting link available', 'Cannot Join');
    }
  };

  const handleDeleteClick = (meetingId: number, meetingName: string) => {
    setDeleteModalState({
      isOpen: true,
      meetingId,
      meetingName
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalState.meetingId) return;

    try {
      const response = await apiService.deleteMeeting(deleteModalState.meetingId);
      if (response.error) {
        toastError(response.error, 'Delete Failed');
      } else {
        toastSuccess('Meeting deleted successfully', 'Meeting Deleted');
        // Refresh meetings list
        handleMeetingCreated();
      }
    } catch (error) {
      console.error('Error deleting meeting:', error);

      // Extract error message
      let errorMessage = 'Failed to delete meeting';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }

      toastError(errorMessage, 'Error');
    } finally {
      setDeleteModalState({ isOpen: false, meetingId: null, meetingName: '' });
    }
  };

  const handleCompleteMeeting = async (meetingId: number) => {
    try {
      const response = await apiService.updateMeetingStatus(meetingId, 'completed');
      if (response.error) {
        toastError(response.error, 'Update Failed');
      } else {
        toastSuccess('Meeting marked as completed', 'Meeting Completed');
        handleMeetingCreated();
      }
    } catch (error) {
      console.error('Error completing meeting:', error);

      // Extract error message
      let errorMessage = 'Failed to mark meeting as completed';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }

      toastError(errorMessage, 'Error');
    }
  };

  const handleCancelMeeting = async (meetingId: number) => {
    try {
      const response = await apiService.updateMeetingStatus(meetingId, 'cancelled');
      if (response.error) {
        toastError(response.error, 'Cancel Failed');
      } else {
        toastSuccess('Meeting cancelled', 'Meeting Cancelled');
        handleMeetingCreated();
      }
    } catch (error) {
      console.error('Error cancelling meeting:', error);

      // Extract error message
      let errorMessage = 'Failed to cancel meeting';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }

      toastError(errorMessage, 'Error');
    }
  };

  // Transform real meetings to match Meeting interface
  const transformedRealMeetings: Meeting[] = realMeetings.map(meeting => {
    const startTime = new Date(meeting.startTime);
    const endTime = new Date(meeting.endTime);
    const now = new Date();

    // Determine status
    let status: 'live' | 'upcoming' | 'completed' = 'upcoming';
    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
      status = 'completed';
    } else if (meeting.status === 'in-progress' || (startTime <= now && endTime >= now)) {
      status = 'live';
    } else if (startTime > now) {
      status = 'upcoming';
    }

    // Format date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDay = new Date(startTime);
    startDay.setHours(0, 0, 0, 0);

    let dateStr = 'Today';
    if (startDay.getTime() === tomorrow.getTime()) {
      dateStr = 'Tomorrow';
    } else if (startDay.getTime() !== today.getTime()) {
      dateStr = startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Format time
    const timeStr = `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

    const startIso =
      typeof meeting.startTime === 'string'
        ? meeting.startTime
        : new Date(meeting.startTime).toISOString();

    return {
      id: String(meeting.id),
      title: meeting.title,
      date: dateStr,
      time: timeStr,
      duration: `${meeting.duration}m`,
      status,
      participants: (meeting.participants || []).map((p: any) => ({
        name: p.user?.name || 'Unknown',
        avatar: p.user?.profilePictureUrl || '',
        profilePictureUrl: p.user?.profilePictureUrl || undefined
      })),
      summary: meeting.description || undefined,
      transcriptReady: !!meeting.transcriptUrl,
      meetingLink: meeting.meetingLink,
      backendId: meeting.id,
      startTimeIso: startIso,
    };
  });

  const stats = [
    { label: 'Total Meetings', value: String(realMeetings.length), change: '', icon: Video, color: 'from-blue-500 to-cyan-500' },
    { label: 'Upcoming', value: String(transformedRealMeetings.filter(m => m.status === 'upcoming').length), change: '', icon: Calendar, color: 'from-purple-500 to-pink-500' },
    { label: 'Completed', value: String(transformedRealMeetings.filter(m => m.status === 'completed').length), change: '', icon: FileText, color: 'from-green-500 to-emerald-500' },
    { label: 'Live Now', value: String(transformedRealMeetings.filter(m => m.status === 'live').length), change: '', icon: Brain, color: 'from-orange-500 to-red-500' },
  ];

  const meetings: Meeting[] = transformedRealMeetings;

  // Poll for insights completion
  useEffect(() => {
    if (pendingInsightsMeetings.size === 0) return;

    const pollInterval = setInterval(async () => {
      pendingInsightsMeetings.forEach(async (meetingId) => {
        try {
          const numericId = parseInt(meetingId);
          if (isNaN(numericId)) return;

          const response = await apiService.getAIInsights(numericId);

          // Check if generated or has substantial content
          if (response.data && (response.data.generated || (response.data.summary && response.data.keyDecisions.length > 0))) {
            // Find meeting title for the toast
            const meeting = meetings.find(m => m.id === meetingId);
            const title = meeting?.title || 'Meeting';

            toastSuccess(`AI Insights for "${title}" are ready!`, 'Insights Generated', 8000);

            // Remove from pending set
            setPendingInsightsMeetings(prev => {
              const next = new Set(prev);
              next.delete(meetingId);
              return next;
            });

            // Trigger meeting list refresh to show new insights count/status
            handleMeetingCreated();
          }
        } catch (error) {
          console.error(`Error polling insights for meeting ${meetingId}:`, error);
          // Optional: Remove from pending if error persists? For now, keep retrying.
        }
      });
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [pendingInsightsMeetings, meetings, toastSuccess]);

  const liveMeeting = meetings.find(m => m.status === 'live');
  const endedMeeting = meetings.find(m => m.status === 'completed' && endedMeetingId === m.id);

  // Monitor for newly ended meetings
  useEffect(() => {


    const checkForEndedMeetings = () => {
      const currentlyLiveMeetingIds = new Set<number>();

      meetings.forEach(m => {
        if (m.status === 'live' && m.backendId) {
          currentlyLiveMeetingIds.add(m.backendId);
        }
      });

      // Check which meetings just ended (were live before, but not live now)
      const newlyEnded: string[] = [];
      lastKnownLiveMeetings.forEach(meetingId => {
        if (!currentlyLiveMeetingIds.has(meetingId)) {
          // This meeting was live but is no longer live
          const meeting = meetings.find(m => m.backendId === meetingId);
          if (meeting) {
            newlyEnded.push(meeting.id);
          }
        }
      });

      // Only update if the set actually changed
      const currentIdsArray = Array.from(currentlyLiveMeetingIds).sort().join(',');
      const lastIdsArray = Array.from(lastKnownLiveMeetings).sort().join(',');

      if (currentIdsArray !== lastIdsArray) {
        setLastKnownLiveMeetings(currentlyLiveMeetingIds);
      }

      // Show banner for newly ended meetings (no toast)
      newlyEnded.forEach(meetingId => {
        const meeting = meetings.find(m => m.id === meetingId);
        if (meeting && !dismissEndedBanner) {
          setEndedMeetingId(meetingId);
        }
      });
    };

    checkForEndedMeetings();
    const intervalId = setInterval(checkForEndedMeetings, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [meetings, lastKnownLiveMeetings, dismissEndedBanner]);

  const handleMeetingClick = (meetingId: string) => {
    // Find the meeting to determine its status
    const meeting = meetings.find(m => m.id === meetingId);

    if (meeting?.status === 'live') {
      navigate(`/workspace/meetings/live/${meetingId}`);
    } else if (meeting?.status === 'upcoming') {
      navigate(`/workspace/meetings/pre/${meetingId}`);
    } else {
      // Completed or other status
      navigate(`/workspace/meetings/${meetingId}`);
    }
  };

  const withinTimeFilter = (meeting: Meeting) => {
    if (timeFilter === 'all') return true;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const addDays = (d: number) => new Date(startOfDay.getTime() + d * 86400000);

    let meetingDate: Date | null = null;
    if (meeting.startTimeIso) {
      meetingDate = new Date(meeting.startTimeIso);
    } else {
      const raw = meeting.date;
      if (raw.toLowerCase().includes('today')) meetingDate = startOfDay;
      else if (raw.toLowerCase().includes('tomorrow')) meetingDate = addDays(1);
      else {
        const parsed = new Date(raw);
        meetingDate = isNaN(parsed.getTime()) ? null : parsed;
      }
    }
    if (!meetingDate || isNaN(meetingDate.getTime())) return true;

    const dayStart = new Date(meetingDate.getFullYear(), meetingDate.getMonth(), meetingDate.getDate());

    if (timeFilter === 'today') {
      return dayStart.getTime() === startOfDay.getTime();
    }
    if (timeFilter === 'week') {
      const dayOfWeek = startOfDay.getDay();
      const weekStart = new Date(startOfDay);
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return dayStart >= weekStart && dayStart < weekEnd;
    }
    if (timeFilter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return meetingDate >= startOfMonth && meetingDate < startNextMonth;
    }
    if (timeFilter === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
      const startNextQuarter = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
      return meetingDate >= startOfQuarter && meetingDate < startNextQuarter;
    }
    return true;
  };

  const filteredMeetings = meetings.filter(meeting => {
    if (activeTab === 'all') return true;
    if (activeTab === 'live') return meeting.status === 'live';
    if (activeTab === 'upcoming') return meeting.status === 'upcoming';
    if (activeTab === 'history') return meeting.status === 'completed';
    return true;
  }).filter(meeting =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(withinTimeFilter);

  const tabs = [
    { id: 'all', label: 'All Meetings', count: meetings.length },
    { id: 'upcoming', label: 'Upcoming', count: meetings.filter(m => m.status === 'upcoming').length },
    { id: 'live', label: 'Live', count: meetings.filter(m => m.status === 'live').length },
    { id: 'history', label: 'History', count: meetings.filter(m => m.status === 'completed').length },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <LiveMeetingBanner
          liveMeeting={dismissLiveBanner ? undefined : liveMeeting}
          onJoin={() => {
            if (liveMeeting?.backendId) {
              const meetId = liveMeeting.backendId.toString();
              const navPath = workspaceId
                ? `/workspace/${workspaceId}/meetings/live/${meetId}`
                : `/workspace/meetings/live/${meetId}`;
              navigate(navPath);
            } else {
              navigate('/workspace/meetings');
            }
          }}
          onDismiss={() => setDismissLiveBanner(true)}
        />

        <MeetingEndedBanner
          endedMeeting={dismissEndedBanner ? undefined : endedMeeting}
          onView={() => {
            if (endedMeeting?.backendId) {
              const meetId = endedMeeting.backendId.toString();
              const navPath = workspaceId
                ? `/workspace/${workspaceId}/meetings/${meetId}`
                : `/workspace/meetings/${meetId}`;
              navigate(navPath);
            } else {
              navigate('/workspace/meetings');
            }
          }}
          onDismiss={() => setDismissEndedBanner(true)}
        />

        <div className="mb-6 sm:mb-8 space-y-4 relative z-20">
          {/* Title and Description - Always on top */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
              {currentWorkspace ? `${currentWorkspace.name} Meetings` : 'Meetings'}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400">
              {currentWorkspace ? `Manage meetings for ${currentWorkspace.name}` : 'Manage your meetings and AI-powered insights'}
            </p>
          </div>

          {/* Controls Row - Below on smaller screens */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* View Type Toggle */}
            <div className="flex items-center space-x-1 rounded-lg p-0.5 bg-white border border-gray-200 dark:bg-slate-800/50 dark:border-slate-700/50">
              <button
                onClick={() => setViewType('list')}
                className={`p-1.5 sm:p-2 rounded transition-all ${viewType === 'list'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50'
                  }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType('grid')}
                className={`p-1.5 sm:p-2 rounded transition-all ${viewType === 'grid'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50'
                  }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType('kanban')}
                className={`p-1.5 sm:p-2 rounded transition-all ${viewType === 'kanban'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50'
                  }`}
                title="Kanban View"
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType('calendar')}
                className={`p-1.5 sm:p-2 rounded transition-all ${viewType === 'calendar'
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/50'
                  }`}
                title="Calendar View"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 relative" ref={timeFilterMenuRef}>
              <button
                type="button"
                onClick={() => setShowTimeFilterMenu(v => !v)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-all bg-white border border-gray-300 text-gray-900 hover:bg-gray-100 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white"
                aria-haspopup="menu"
                aria-expanded={showTimeFilterMenu}
              >
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 dark:text-slate-300" />
                <span className="hidden sm:inline">
                  {timeFilter === 'all'
                    ? 'All'
                    : timeFilter === 'today'
                      ? 'Today'
                      : timeFilter === 'week'
                        ? 'This Week'
                        : timeFilter === 'month'
                          ? 'This Month'
                          : timeFilter === 'quarter'
                            ? 'This Quarter'
                            : 'All'}
                </span>
                <span className="sm:hidden">
                  {timeFilter === 'all'
                    ? 'All'
                    : timeFilter === 'today'
                      ? 'Today'
                      : timeFilter === 'week'
                        ? 'Week'
                        : timeFilter === 'month'
                          ? 'Month'
                          : timeFilter === 'quarter'
                            ? 'Qtr'
                            : 'All'}
                </span>
              </button>
              {showTimeFilterMenu && (
                <div className="absolute left-0 top-full mt-2 w-48 rounded-lg shadow-xl z-50 bg-white border border-gray-200 dark:bg-slate-900/95 dark:border-slate-700/60" role="menu">
                  <div className="p-1">
                    <button onClick={() => { setTimeFilter('all'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-200 ${timeFilter === 'all' ? 'bg-gray-100 dark:bg-white/5' : ''}`} role="menuitem">All</button>
                    <button onClick={() => { setTimeFilter('today'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-200 ${timeFilter === 'today' ? 'bg-gray-100 dark:bg-white/5' : ''}`} role="menuitem">Today</button>
                    <button onClick={() => { setTimeFilter('week'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-200 ${timeFilter === 'week' ? 'bg-gray-100 dark:bg-white/5' : ''}`} role="menuitem">This Week</button>
                    <button onClick={() => { setTimeFilter('month'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-200 ${timeFilter === 'month' ? 'bg-gray-100 dark:bg-white/5' : ''}`} role="menuitem">This Month</button>
                    <button onClick={() => { setTimeFilter('quarter'); setShowTimeFilterMenu(false); }} className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-200 ${timeFilter === 'quarter' ? 'bg-gray-100 dark:bg-white/5' : ''}`} role="menuitem">This Quarter</button>
                  </div>
                </div>
              )}
            </div>

            {/* Plus Dropdown */}
            <div className="relative overflow-visible" ref={plusMenuRef}>
              <button onClick={() => setShowPlusMenu(v => !v)} className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-md text-white text-xs sm:text-sm font-medium transition-all" aria-haspopup="menu" aria-expanded={showPlusMenu}>
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">New</span>
              </button>
              {showPlusMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-xl z-50 bg-white border border-gray-200 dark:bg-slate-900/95 dark:border-slate-700/60" role="menu">
                  <div className="p-2">
                    <button onClick={() => { setShowNewMeetingModal(true); setShowPlusMenu(false); }} className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-200" role="menuitem">Schedule new meeting</button>
                    <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-200" role="menuitem">Import from Calendar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Settings Dropdown */}
            <div className="relative overflow-visible" ref={settingsMenuRef}>
              <button onClick={() => setShowSettingsMenu(v => !v)} className="p-1.5 sm:p-2 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/50 rounded-md text-slate-200 transition-all" aria-haspopup="menu" aria-expanded={showSettingsMenu}>
                <Settings className="w-4 h-4" />
              </button>
              {showSettingsMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-xl z-50 bg-white border border-gray-200 dark:bg-slate-900/95 dark:border-slate-700/60" role="menu">
                  <div className="p-2">
                    <p className="px-2 py-1 text-xs uppercase tracking-wider text-gray-500 dark:text-slate-500">Sync Frequency</p>
                    <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-300" role="menuitem">Manual</button>
                    <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-300" role="menuitem">Every 15 minutes</button>
                    <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-300" role="menuitem">Hourly</button>
                    <div className="h-px bg-gray-200 my-2 dark:bg-slate-700/60" />
                    <p className="px-2 py-1 text-xs uppercase tracking-wider text-gray-500 dark:text-slate-500">Integrations</p>
                    <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-300" role="menuitem">Google Calendar</button>
                    <button className="w-full bg-transparent text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-700 dark:hover:bg-white/5 dark:text-slate-300" role="menuitem">Outlook</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 mb-5 sm:mb-7">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="rounded-lg p-2.5 sm:p-3.5 transition-all duration-200 group cursor-pointer bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 bg-gradient-to-br ${stat.color} rounded-lg shrink-0 group-hover:scale-105 transition-transform duration-200`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400 leading-snug">{stat.label}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight tabular-nums sm:text-[1.375rem]">{stat.value}</p>
                  </div>
                  {stat.change && (
                    <span className="text-green-600 dark:text-green-400 text-xs font-medium flex items-center gap-0.5 shrink-0">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      {stat.change}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border p-1 mb-6 bg-white border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
          <div className="flex space-x-1 relative">
            <div
              className="absolute top-1 bottom-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-md transition-all duration-300 ease-out"
              style={{
                width: `${100 / tabs.length}%`,
                left: `${(tabs.findIndex(t => t.id === activeTab) * 100) / tabs.length}%`,
              }}
            />

            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className="relative flex-1 flex items-center justify-center space-x-2 px-5 py-2.5 rounded-md transition-all duration-200 z-10"
              >
                <span className={`font-medium text-sm transition-all ${activeTab === tab.id ? 'text-white' : 'text-gray-600 dark:text-slate-400'
                  }`}>
                  {tab.label}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium transition-all ${activeTab === tab.id
                  ? 'bg-white/15 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-slate-700/30 dark:text-slate-500'
                  }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {viewType !== 'calendar' && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-lg text-sm transition-all bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-slate-800/40 dark:border-slate-700/50 dark:text-white dark:placeholder-slate-500"
              />
            </div>
          </div>
        )}

        {!isLoadingMeetings && filteredMeetings.length > 0 && viewType === 'list' && (
          <ListView
            meetings={filteredMeetings}
            onMeetingClick={handleMeetingClick}
            onJoinMeeting={handleJoinMeeting}
            onDeleteMeeting={(id) => {
              const meeting = filteredMeetings.find(m => m.backendId === id);
              if (meeting) handleDeleteClick(id, meeting.title);
            }}
            onCompleteMeeting={handleCompleteMeeting}
            onCancelMeeting={handleCancelMeeting}
            canDelete={(m) => {
              // Owner/admin or the meeting creator can delete
              const ws = currentWorkspace || JSON.parse(localStorage.getItem('currentWorkspace') || 'null');
              const role = ws?.role?.toLowerCase();
              if (role === 'owner' || role === 'admin') return true;
              const raw = realMeetings.find((rm: any) => rm.id === m.backendId);
              return raw?.createdById === user?.id;
            }}
            canCancel={(m) => {
              // Only owner/admin/meeting scheduler can cancel
              const ws = currentWorkspace || JSON.parse(localStorage.getItem('currentWorkspace') || 'null');
              const role = ws?.role?.toLowerCase();
              if (role === 'owner' || role === 'admin') return true;
              // Fallback: allow if current user is creator based on raw data
              const raw = realMeetings.find((rm: any) => rm.id === m.backendId);
              return raw?.createdById === user?.id;
            }}
            canComplete={(m) => {
              // Only owner/admin/meeting scheduler can complete
              const ws = currentWorkspace || JSON.parse(localStorage.getItem('currentWorkspace') || 'null');
              const role = ws?.role?.toLowerCase();
              if (role === 'owner' || role === 'admin') return true;
              // Fallback: allow if current user is creator based on raw data
              const raw = realMeetings.find((rm: any) => rm.id === m.backendId);
              return raw?.createdById === user?.id;
            }}
          />
        )}

        {!isLoadingMeetings && filteredMeetings.length > 0 && viewType === 'grid' && (
          <GridView meetings={filteredMeetings} />
        )}

        {!isLoadingMeetings && filteredMeetings.length > 0 && viewType === 'kanban' && (
          <KanbanView meetings={filteredMeetings} />
        )}

        {!isLoadingMeetings && viewType === 'calendar' && (
          <CalendarView
            meetings={filteredMeetings}
            onMeetingClick={handleMeetingClick}
          />
        )}

        {!workspaceId && !currentWorkspace?.id && (
          <div className="text-center py-20">
            <Video className="w-14 h-14 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-400 mb-2">No workspace selected</h3>
            <p className="text-slate-500 text-sm">Please select a workspace from the sidebar to view meetings</p>
          </div>
        )}

        {isLoadingMeetings && (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-slate-400 mb-2">Loading meetings...</h3>
          </div>
        )}

        {!isLoadingMeetings && filteredMeetings.length === 0 && viewType !== 'calendar' && (workspaceId || currentWorkspace?.id) && (
          <div className="text-center py-20">
            <Video className="w-14 h-14 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-400 mb-2">No meetings found</h3>
            <p className="text-slate-500 text-sm">
              {activeTab === 'all' ? 'Create your first meeting to get started' : 'Try adjusting your search or filters'}
            </p>
          </div>
        )}
      </div>

      {/* New Meeting Modal */}
      {(workspaceId || currentWorkspace?.id) && (
        <NewMeetingModal
          isOpen={showNewMeetingModal}
          onClose={() => setShowNewMeetingModal(false)}
          workspaceId={workspaceId ? parseInt(workspaceId) : currentWorkspace?.id || 0}
          onMeetingCreated={handleMeetingCreated}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ isOpen: false, meetingId: null, meetingName: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Meeting"
        message="Are you sure you want to delete this meeting? This action cannot be undone."
        itemName={deleteModalState.meetingName || ''}
        itemType="meeting"
      />
    </Layout>
  );
};

export default MeetingsDashboard;