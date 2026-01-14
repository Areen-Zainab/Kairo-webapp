import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, CheckSquare, TrendingUp, Clock, Calendar, ArrowUpRight, Play, MoreVertical, MessageSquare, FileText, Brain, Network, Filter, Download, Users, User, Activity, Plus, ArrowDownRight } from 'lucide-react';
import Layout from '../../components/Layout';
import { useUser } from '../../context/UserContext';
import UserAvatar from '../../components/ui/UserAvatar';
import apiService from '../../services/api';
import WorkspaceActivityLog from '../../modals/workspace/WorkspaceActivityLog';
import NewMeetingModal from '../../modals/NewMeetingModal';
import { useToastContext } from '../../context/ToastContext';
import LiveMeetingBanner from '../../components/meetings/dashboard/LiveMeetingBanner';

const WorkspaceOverview = () => {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const navigate = useNavigate();
  const { user, workspaces, isAuthenticated, loading } = useUser();
  const [timeFilter, setTimeFilter] = useState('week');
  const [currentWorkspace, setCurrentWorkspace] = useState<any>(null);
  const [workspaceDetails, setWorkspaceDetails] = useState<any>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [upcomingMeetingsData, setUpcomingMeetingsData] = useState<any[]>([]);
  const [liveMeeting, setLiveMeeting] = useState<any>(null);
  const [dismissedLiveBanner, setDismissedLiveBanner] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [recentCompletedMeetings, setRecentCompletedMeetings] = useState<any[]>([]);
  
  const { error: toastError, success: toastSuccess } = useToastContext();
  
  // Store meetings locally
  const meetingsDataRef = useRef<any[]>([]);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);
  
  // Check if user is areeba@kairo.com to show dummy data
  const shouldShowDummyData = user?.email?.toLowerCase() === 'areeba@kairo.com';
  
  // Load current workspace from URL param or workspace list
  useEffect(() => {
    if (workspaceId) {
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

  // Fetch detailed workspace information
  useEffect(() => {
    const fetchWorkspaceDetails = async () => {
      if (!workspaceId || shouldShowDummyData) return;
      
      try {
        const response = await apiService.getWorkspaceById(parseInt(workspaceId));
        if (response.data?.workspace) {
          setWorkspaceDetails(response.data.workspace);
        }
      } catch (error) {
        console.error('Failed to fetch workspace details:', error);
      }
    };

    fetchWorkspaceDetails();
  }, [workspaceId, shouldShowDummyData]);

  // Fetch activity logs
  useEffect(() => {
    const fetchActivityLogs = async () => {
      if (!workspaceId || shouldShowDummyData) return;
      
      try {
        const response = await apiService.getWorkspaceLogs(parseInt(workspaceId), 4, 0); // Fetch top 4 logs
        if (response.data?.logs) {
          setActivityLogs(response.data.logs);
        }
      } catch (error) {
        console.error('Failed to fetch activity logs:', error);
      }
    };

    fetchActivityLogs();
  }, [workspaceId, shouldShowDummyData]);

  // Fetch dashboard stats
  useEffect(() => {
    const fetchDashboardStats = async () => {
      if (!workspaceId || shouldShowDummyData) return;
      
      try {
        const response = await apiService.getWorkspaceDashboard(parseInt(workspaceId));
        if (response.data?.stats) {
          setDashboardStats(response.data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      }
    };

    fetchDashboardStats();
  }, [workspaceId, shouldShowDummyData]);

  // Fetch meetings once on mount or workspace change
  useEffect(() => {
    const fetchMeetings = async () => {
      if (!workspaceId || shouldShowDummyData) return;
      
      try {
        const response = await apiService.getMeetingsByWorkspace(parseInt(workspaceId));
        if (response.data?.meetings) {
          meetingsDataRef.current = response.data.meetings;
          
          // Check for live meetings
          const now = new Date();
          const live = response.data.meetings.find((m: any) => {
            const start = new Date(m.startTime);
            const end = new Date(m.endTime);
            return now >= start && now <= end && m.status !== 'completed' && m.status !== 'cancelled';
          });
          
          if (live) {
            setLiveMeeting(live);
          }
          
          // Get upcoming meetings
          const upcoming = response.data.meetings
            .filter((m: any) => new Date(m.startTime) > now)
            .slice(0, 5);
          setUpcomingMeetingsData(upcoming);
          
          // Get recent past meetings (ended meetings, regardless of status)
          const pastMeetings = response.data.meetings
            .filter((m: any) => {
              const endTime = new Date(m.endTime);
              return endTime < now; // Only past meetings
            })
            .sort((a: any, b: any) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
            .slice(0, 3);
          setRecentCompletedMeetings(pastMeetings);
        }
      } catch (error) {
        console.error('Failed to fetch meetings:', error);
      }
    };

    fetchMeetings();
  }, [workspaceId, shouldShowDummyData]);

  // Check for live meetings locally (no backend calls)
  useEffect(() => {
    const checkLiveMeetings = () => {
      const now = new Date();
      const live = meetingsDataRef.current.find((m: any) => {
        const start = new Date(m.startTime);
        const end = new Date(m.endTime);
        return now >= start && now <= end && m.status !== 'completed' && m.status !== 'cancelled';
      });
      
      if (live) {
        if (!liveMeeting || liveMeeting.id !== live.id) {
          setLiveMeeting(live);
          setDismissedLiveBanner(false);
        }
      } else {
        // Check if a live meeting just ended (no toast)
        if (liveMeeting && !dismissedLiveBanner) {
          setDismissedLiveBanner(true);
        }
        if (liveMeeting) {
          setLiveMeeting(null);
        }
      }
    };

    checkLiveMeetings();
    const interval = setInterval(checkLiveMeetings, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMeeting, dismissedLiveBanner]);

  // Refresh meetings when modal closes
  const handleMeetingCreated = async () => {
    const wsId = workspaceId || currentWorkspace?.id;
    if (!wsId || shouldShowDummyData) return;
    
    try {
      const response = await apiService.getMeetingsByWorkspace(parseInt(wsId));
      if (response.data?.meetings) {
        meetingsDataRef.current = response.data.meetings;
        
        // Check for live meetings
        const now = new Date();
        
        // Update upcoming meetings
        const upcoming = response.data.meetings
          .filter((m: any) => new Date(m.startTime) > now)
          .slice(0, 5);
        setUpcomingMeetingsData(upcoming);
        
        const live = response.data.meetings.find((m: any) => {
          const start = new Date(m.startTime);
          const end = new Date(m.endTime);
          return now >= start && now <= end && m.status !== 'completed' && m.status !== 'cancelled';
        });
        
        if (live) {
          setLiveMeeting(live);
          setDismissedLiveBanner(false);
        }
        
        // Get recent past meetings (ended meetings, regardless of status)
        const pastMeetings = response.data.meetings
          .filter((m: any) => {
            const endTime = new Date(m.endTime);
            return endTime < now; // Only past meetings
          })
          .sort((a: any, b: any) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
          .slice(0, 3);
        setRecentCompletedMeetings(pastMeetings);
      }
    } catch (error) {
      console.error('Failed to refresh meetings:', error);
    }
  };

  const handleJoinMeeting = (meetingLink: string) => {
    // Do not open external meeting link. Navigation handled by click targets with IDs.
    if (!meetingLink) {
      toastError('No meeting link available', 'Cannot Join');
    }
  };

  const handleLiveBannerJoin = () => {
    if (liveMeeting?.meetingLink) {
      handleJoinMeeting(liveMeeting.meetingLink);
    } else {
      toastError('No meeting link available', 'Cannot Join');
    }
  };

  const handleDismissLiveBanner = () => {
    setDismissedLiveBanner(true);
  };

  // Stats data - show dummy for demo account, real data for others
  const stats = shouldShowDummyData ? [
    { id: 1, label: 'Total Meetings', value: '24', change: '+12%', icon: Video, color: 'from-blue-500 to-cyan-500' },
    { id: 2, label: 'Active Tasks', value: '18', change: '+8%', icon: CheckSquare, color: 'from-purple-500 to-pink-500' },
    { id: 3, label: 'Completion Rate', value: '87%', change: '+5%', icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
    { id: 4, label: 'Memory Items', value: '156', change: '+23', icon: Brain, color: 'from-orange-500 to-red-500' },
  ] : (dashboardStats ? [
    { 
      id: 1, 
      label: 'Total Meetings', 
      value: String(dashboardStats.totalMeetings), 
      change: dashboardStats.meetingsThisWeek > 0 ? `+${dashboardStats.meetingsThisWeek} this week` : '', 
      icon: Video, 
      color: 'from-blue-500 to-cyan-500' 
    },
    { 
      id: 2, 
      label: 'Action Items', 
      value: String(dashboardStats.totalActionItems), 
      change: dashboardStats.confirmedActionItems > 0 ? `${dashboardStats.confirmedActionItems} confirmed` : '', 
      icon: CheckSquare, 
      color: 'from-purple-500 to-pink-500' 
    },
    { 
      id: 3, 
      label: 'Completion Rate', 
      value: `${dashboardStats.completionRate}%`, 
      change: '', 
      icon: TrendingUp, 
      color: 'from-green-500 to-emerald-500' 
    },
    { 
      id: 4, 
      label: 'Team Members', 
      value: String(dashboardStats.totalMembers), 
      change: '', 
      icon: Users, 
      color: 'from-orange-500 to-red-500' 
    },
  ] : []);

  // Format upcoming meetings for display
  const upcomingMeetingsFormatted = shouldShowDummyData ? [
    { id: 1, title: 'Sprint Planning', time: '2:00 PM', participants: ['AM', 'JD', 'SK', '+5'], duration: '60 min', status: 'Soon', remainingCount: 0, meetingLink: '#' },
    { id: 2, title: 'Client Demo', time: '4:30 PM', participants: ['AM', 'RK', 'LM'], duration: '45 min', status: 'Scheduled', remainingCount: 0, meetingLink: '#' },
    { id: 3, title: 'Team Standup', time: 'Tomorrow 9:00 AM', participants: ['AM', 'JD', 'SK', 'RK', '+8'], duration: '15 min', status: 'Scheduled', remainingCount: 0, meetingLink: '#' },
  ] : upcomingMeetingsData.map(meeting => {
      const startTime = new Date(meeting.startTime);
      const now = new Date();
      const timeDiff = startTime.getTime() - now.getTime();
      const hoursUntil = timeDiff / (1000 * 60 * 60);
      
      // Format time display
      let timeDisplay = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const isToday = startTime.toDateString() === now.toDateString();
      const isTomorrow = startTime.toDateString() === new Date(now.getTime() + 86400000).toDateString();
      
      if (!isToday) {
        if (isTomorrow) {
          timeDisplay = 'Tomorrow ' + timeDisplay;
        } else {
          timeDisplay = startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + timeDisplay;
        }
      }
      
      // Determine status
      let status = 'Scheduled';
      if (hoursUntil < 1 && hoursUntil > 0) {
        status = 'Soon';
      }
      
      // Format participants - show up to 3 users, then "+X"
      const participantList = meeting.participants?.slice(0, 3).map((p: any) => ({
        name: p.user?.name || 'Unknown',
        profilePictureUrl: p.user?.profilePictureUrl
      })) || [];
      const remainingCount = (meeting.participants?.length || 0) - 3;
      
      return {
        id: meeting.id,
        title: meeting.title,
        time: timeDisplay,
        participants: participantList,
        remainingCount: remainingCount > 0 ? remainingCount : 0,
        duration: `${meeting.duration} min`,
        status,
        meetingLink: meeting.meetingLink
      };
    });

  const recentMeetings = shouldShowDummyData ? [
    { id: 1, title: 'Product Review Q4', date: 'Oct 10, 2025', tasks: 8, transcriptReady: true, memoryLinks: 3, duration: '1h 20m' },
    { id: 2, title: 'Design Sprint Retro', date: 'Oct 9, 2025', tasks: 5, transcriptReady: true, memoryLinks: 2, duration: '45m' },
    { id: 3, title: 'API Integration Sync', date: 'Oct 8, 2025', tasks: 12, transcriptReady: true, memoryLinks: 5, duration: '1h 05m' },
  ] : recentCompletedMeetings.map(meeting => {
      const endTime = new Date(meeting.endTime);
      const startTime = new Date(meeting.startTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMins = Math.floor(durationMs / 60000);
      const hours = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      
      let durationDisplay = '';
      if (hours > 0) {
        durationDisplay = `${hours}h ${mins}m`;
      } else {
        durationDisplay = `${mins}m`;
      }
      
      return {
        id: meeting.id,
        title: meeting.title,
        date: endTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        tasks: meeting.actionItems?.length || 0,
        transcriptReady: !!meeting.transcriptUrl,
        memoryLinks: 0, // TODO: Add memory links count when available
        duration: durationDisplay
      };
    });

  const memoryInsights = shouldShowDummyData ? [
    { id: 1, topic: 'API v2 Migration', linkedMeetings: 5, lastDiscussed: '2 days ago' },
    { id: 2, topic: 'User Authentication Flow', linkedMeetings: 3, lastDiscussed: '1 week ago' },
    { id: 3, topic: 'Q4 Goals', linkedMeetings: 8, lastDiscussed: '3 days ago' },
  ] : [];

  // Format activity logs for display
  const formatActivityTime = (createdAt: string): string => {
    const now = new Date();
    const activityTime = new Date(createdAt);
    const diffMs = now.getTime() - activityTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return activityTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const mapActionToType = (action: string): string => {
    if (action.includes('task')) return 'task';
    if (action.includes('meeting')) return 'meeting';
    if (action.includes('memory')) return 'memory';
    if (action.includes('transcript')) return 'transcript';
    if (action.includes('workspace')) return 'workspace';
    if (action.includes('member')) return 'member';
    if (action.includes('complete')) return 'complete';
    return 'message';
  };

  const activityFeed = shouldShowDummyData ? [
    { id: 1, type: 'task', text: 'New task assigned from Sprint Planning', time: '5 min ago', user: 'Ali H.' },
    { id: 2, type: 'meeting', text: 'Meeting summary ready: Client Demo', time: '1 hour ago', user: 'System' },
    { id: 3, type: 'memory', text: 'Memory link created between 2 meetings', time: '2 hours ago', user: 'System' },
    { id: 4, type: 'complete', text: 'API Integration Sync completed', time: '3 hours ago', user: 'Areeba R.' },
  ] : activityLogs.slice(0, 4).map((log) => ({
    id: log.id,
    type: mapActionToType(log.action),
    text: log.title || log.description,
    time: formatActivityTime(log.createdAt),
    user: log.user?.name || 'System'
  }));

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task': return CheckSquare;
      case 'meeting': return Video;
      case 'memory': return Brain;
      case 'transcript': return FileText;
      case 'complete': return TrendingUp;
      case 'workspace': return Network;
      case 'member': return Users;
      default: return MessageSquare;
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Live Meeting Banner */}
        {liveMeeting && !dismissedLiveBanner && (
          <LiveMeetingBanner
            liveMeeting={{
              id: liveMeeting.id.toString(),
              title: liveMeeting.title,
              date: new Date(liveMeeting.startTime).toLocaleDateString(),
              time: new Date(liveMeeting.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              duration: `${liveMeeting.duration} min`,
              status: 'live',
              participants: liveMeeting.participants?.map((p: any) => ({
                name: p.user?.name || '',
                avatar: p.user?.profilePictureUrl || '',
                profilePictureUrl: p.user?.profilePictureUrl,
              })) || [],
            }}
            onJoin={handleLiveBannerJoin}
            onDismiss={handleDismissLiveBanner}
          />
        )}
        
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {currentWorkspace?.name 
                    ? currentWorkspace.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                    : 'W'
                  }
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                  {currentWorkspace?.name || 'Workspace'}
                </h1>
                <p className="text-gray-600 dark:text-slate-400 text-sm truncate">
                  {currentWorkspace?.memberCount || 0} members • {currentWorkspace?.role ? `${currentWorkspace.role.slice(0,1).toUpperCase()}${currentWorkspace.role.slice(1).toLowerCase()}` : 'Member'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Time Filter & Activity Log */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="hidden sm:inline text-sm text-slate-600 dark:text-slate-400">Filter</span>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="rounded-lg px-2 sm:px-3 py-2 text-sm focus:outline-none transition-all bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>
            
            {/* Activity Log Button */}
            {!shouldShowDummyData && workspaceId && (
              <button
                onClick={() => setShowActivityLog(true)}
                className="px-3 md:px-4 py-2 rounded-lg bg-white border border-gray-300 hover:border-purple-400 hover:bg-purple-50 dark:bg-slate-800/50 dark:border-slate-700/50 dark:hover:border-purple-500 dark:hover:bg-purple-900/20 transition-all flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 shadow-sm hover:shadow-md"
                title="View workspace activity log"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden md:inline">Activity Log</span>
              </button>
            )}
          </div>
        </div>

        {/* Workspace Info Card */}
        {!shouldShowDummyData && workspaceDetails && (
          <div className="rounded-lg p-4 md:p-5 mb-6 bg-white border border-gray-200 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
            {/* Desktop Layout */}
            <div className="hidden lg:flex items-center justify-between gap-6">
              {/* Members Info */}
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Team</span>
                </div>
                {workspaceDetails.members && workspaceDetails.members.length > 0 ? (
                  <div className="flex -space-x-2">
                    {workspaceDetails.members.slice(0, 8).map((member: any) => (
                      <div key={member.id} className="transition-transform hover:scale-110 hover:z-10" title={member.user?.name}>
                        <UserAvatar 
                          name={member.user?.name || 'Unknown'} 
                          profilePictureUrl={member.user?.profilePictureUrl}
                          size="sm"
                        />
                      </div>
                    ))}
                    {workspaceDetails.members.length > 8 && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-slate-200 shadow-sm">
                        +{workspaceDetails.members.length - 8}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-slate-400">No members</span>
                )}
              </div>

              <div className="h-8 w-px bg-gray-200 dark:bg-slate-700"></div>

              {/* Owner Info */}
              <div className="flex items-center gap-4 flex-1 justify-center">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Owner</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <UserAvatar 
                    name={workspaceDetails.owner?.name || 'Unknown'} 
                    profilePictureUrl={workspaceDetails.owner?.profilePictureUrl}
                    size="sm"
                  />
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {workspaceDetails.owner?.email}
                  </span>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200 dark:bg-slate-700"></div>

              {/* Created Info */}
              <div className="flex items-center gap-4 flex-1 justify-end">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Created</span>
                </div>
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  {new Date(workspaceDetails.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {/* Mobile/Tablet Layout */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Members Info */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Users className="w-4 sm:w-5 h-4 sm:h-5 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                {workspaceDetails.members && workspaceDetails.members.length > 0 ? (
                  <div className="flex -space-x-2 flex-shrink-0">
                    {workspaceDetails.members.slice(0, 4).map((member: any) => (
                      <div key={member.id} className="transition-transform hover:scale-110 hover:z-10" title={member.user?.name}>
                        <UserAvatar 
                          name={member.user?.name || 'Unknown'} 
                          profilePictureUrl={member.user?.profilePictureUrl}
                          size="sm"
                        />
                      </div>
                    ))}
                    {workspaceDetails.members.length > 4 && (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-slate-200 shadow-sm">
                        +{workspaceDetails.members.length - 4}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-slate-400">No members</span>
                )}
              </div>

              {/* Owner Info */}
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 sm:w-5 h-4 sm:h-5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <UserAvatar 
                    name={workspaceDetails.owner?.name || 'Unknown'} 
                    profilePictureUrl={workspaceDetails.owner?.profilePictureUrl}
                    size="sm"
                    className="flex-shrink-0"
                  />
                  <span className="text-xs text-gray-600 dark:text-slate-400 truncate" title={workspaceDetails.owner?.email}>
                    {workspaceDetails.owner?.email}
                  </span>
                </div>
              </div>

              {/* Created Info */}
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 sm:w-5 h-4 sm:h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 dark:text-slate-400 truncate">
                  {new Date(workspaceDetails.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {stats.length === 0 ? (
            <div className="col-span-full rounded-xl p-10 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50 text-center shadow-sm">
              <p className="text-gray-500 dark:text-slate-400 text-sm">No data available yet</p>
            </div>
          ) : (
            stats.map((stat) => {
              const Icon = stat.icon;
              const isPositive = stat.change && !stat.change.includes("-");
              const changeColor = isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
              const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight;

              return (
                <div key={stat.id}
                  className="rounded-xl p-5 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex flex-col items-start gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 rounded-lg bg-gradient-to-br ${stat.color} text-white shadow-md group-hover:scale-105 transition-transform duration-200`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-none">
                        {stat.value}
                      </h3>
                    </div>

                    <p className="text-gray-600 dark:text-slate-400 text-sm">{stat.label}</p>
                  </div>

                  {stat.change && (
                    <div className="absolute top-4 right-5">
                      <span className={`${changeColor} text-xs font-medium flex items-center gap-1`}>
                        <ChangeIcon className="w-3.5 h-3.5" />
                        {stat.change}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Upcoming Meetings */}
          <div className="lg:col-span-2 rounded-lg p-4 sm:p-5 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 mb-5">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400 flex-shrink-0" />
                Upcoming Meetings
              </h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(workspaceId || currentWorkspace?.id) && !shouldShowDummyData && (
                  <button
                    onClick={() => setShowNewMeetingModal(true)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors"
                  >
                    <Plus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                    <span className="hidden sm:inline">Schedule</span>
                  </button>
                )}
                <button 
                  onClick={() => navigate(`/workspace/${workspaceId || currentWorkspace?.id}/meetings?tab=upcoming`)}
                  className="text-xs sm:text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium whitespace-nowrap"
                >
                  View All
                </button>
              </div>
            </div>
              <div className="space-y-3">
              {upcomingMeetingsFormatted.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  No upcoming meetings
                </div>
              ) : (
                upcomingMeetingsFormatted.map((meeting) => {
                  return (
                  <div
                    key={meeting.id}
                    className="rounded-lg p-3 sm:p-4 transition-all duration-200 group cursor-pointer bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-900/50 dark:border-slate-700/50 dark:hover:border-purple-500/50"
                    onClick={() => navigate(`/workspace/${workspaceId || currentWorkspace?.id}/meetings/pre/${meeting.id}`)}
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors truncate">
                        {meeting.title}
                      </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-1.5 text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-3">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{meeting.time}</span>
                        </span>
                        <span className="truncate">{meeting.duration}</span>
                      </div>
                      <div className="flex items-center -space-x-2">
                        {shouldShowDummyData ? (
                          // Show initials for dummy data
                          meeting.participants.map((initial: any, idx: number) => (
                            <div
                              key={idx}
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                                typeof initial === 'string' && initial.startsWith('+') 
                                  ? 'bg-gray-200 text-gray-600 dark:bg-slate-700/80 dark:text-slate-400' 
                                  : 'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
                              }`}
                            >
                              {initial}
                            </div>
                          ))
                        ) : (
                          // Show user avatars for real data
                          <>
                            {meeting.participants?.map((participant: any, idx: number) => (
                              <div key={idx} className="transition-transform hover:scale-110 hover:z-10" title={participant.name}>
                                <UserAvatar 
                                  name={participant.name} 
                                  profilePictureUrl={participant.profilePictureUrl}
                                  size="sm"
                                />
                              </div>
                            ))}
                            {meeting.remainingCount > 0 && (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-slate-200 shadow-sm">
                                +{meeting.remainingCount}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                        meeting.status === 'Soon' 
                          ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30' 
                          : 'bg-gray-100 text-gray-700 border border-gray-300 dark:bg-slate-700/50 dark:text-slate-300 dark:border-transparent'
                      }`}>
                        {meeting.status}
                      </span>
                      {meeting.meetingLink && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workspace/${workspaceId || currentWorkspace?.id}/meetings/pre/${meeting.id}`);
                          }}
                          className="p-1.5 sm:p-2 hover:bg-purple-500/20 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          title="Join Meeting"
                        >
                          <Play className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                );
              }))}
            </div>
          </div>

          {/* Memory Insights */}
          <div className="rounded-lg p-4 sm:p-5 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 mb-5">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400 flex-shrink-0" />
                Memory Insights
              </h2>
              <button 
                onClick={() => navigate(`/workspace/${workspaceId || currentWorkspace?.id}/memory`)}
                className="text-xs sm:text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium whitespace-nowrap"
              >
                View Graph
              </button>
            </div>
            <div className="space-y-2.5">
                {memoryInsights.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    No memory insights yet
                  </div>
                ) : (
                  memoryInsights.map((insight) => {
                    return (
                    <div
                      key={insight.id}
                      className="rounded-lg p-3.5 transition-all duration-200 group cursor-pointer bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-900/50 dark:border-slate-700/50 dark:hover:border-purple-500/50"
                    >
                  <div className="flex items-start gap-3">
                      <Network className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1.5 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors truncate">
                        {insight.topic}
                      </p>
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                        <span>{insight.linkedMeetings} meetings</span>
                        <span>•</span>
                        <span>{insight.lastDiscussed}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }))}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Meetings with Transcripts */}
          <div className="lg:col-span-2 rounded-lg p-4 sm:p-5 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span className="hidden sm:inline">Recent Meetings & Transcripts</span>
                <span className="sm:hidden">Recent</span>
              </h2>
              <button 
                onClick={() => navigate(`/workspace/${workspaceId || currentWorkspace?.id}/meetings?tab=history`)}
                className="text-xs sm:text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium whitespace-nowrap"
              >
                View All
              </button>
            </div>
            <div className="space-y-2.5">
                {recentMeetings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    No recent meetings
                  </div>
                ) : (
                  recentMeetings.map((meeting) => {
                    return (
                    <div
                      key={meeting.id}
                      onClick={() => navigate(`/workspace/${workspaceId || currentWorkspace?.id}/meetings/${meeting.id}`)}
                      className="rounded-lg p-3 sm:p-4 transition-all duration-200 group cursor-pointer bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-900/50 dark:border-slate-700/50 dark:hover:border-purple-500/50"
                    >
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors truncate">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-slate-400 flex-wrap">
                        <span className="truncate">{meeting.date}</span>
                        <span className="truncate">{meeting.duration}</span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <CheckSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {meeting.tasks} tasks
                        </span>
                        {meeting.transcriptReady && (
                          <span className="flex items-center gap-1 text-green-400 flex-shrink-0">
                            <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">Transcript</span>
                            <span className="sm:hidden">T</span>
                          </span>
                        )}
                        {meeting.memoryLinks > 0 && (
                          <span className="flex items-center gap-1 text-purple-400 flex-shrink-0">
                            <Brain className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            {meeting.memoryLinks}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {meeting.transcriptReady && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workspace/${workspaceId || currentWorkspace?.id}/meetings/${meeting.id}`);
                          }}
                          className="p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-slate-700/50" 
                          title="View Meeting Details"
                        >
                          <FileText className="w-3.5 h-3.5 text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors" />
                        </button>
                      )}
                      <button 
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-slate-700/50 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="w-3.5 h-3.5 text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-lg p-4 sm:p-5 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400 flex-shrink-0" />
                Activity Feed
              </h2>
            </div>
            <div className="space-y-3.5">
              {activityFeed.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  No recent activity
                </div>
              ) : (
                activityFeed.map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white mb-1 leading-relaxed">{activity.text}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-gray-600 dark:text-slate-500">{activity.time}</p>
                        <span className="text-gray-400 dark:text-slate-600">•</span>
                        <p className="text-xs text-gray-600 dark:text-slate-500">{activity.user}</p>
                      </div>
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Activity Log Modal */}
      {workspaceId && (
        <WorkspaceActivityLog
          isOpen={showActivityLog}
          onClose={() => setShowActivityLog(false)}
          workspaceId={parseInt(workspaceId)}
          workspaceName={currentWorkspace?.name || workspaceDetails?.name || 'Workspace'}
        />
      )}

      {/* New Meeting Modal */}
      {(workspaceId || currentWorkspace?.id) && (
        <NewMeetingModal
          isOpen={showNewMeetingModal}
          onClose={() => setShowNewMeetingModal(false)}
          workspaceId={workspaceId ? parseInt(workspaceId) : currentWorkspace.id}
          onMeetingCreated={handleMeetingCreated}
        />
      )}
    </Layout>
  );
};

export default WorkspaceOverview;