import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Calendar, BarChart3, CheckSquare, TrendingUp, Clock, Mail, ChevronLeft, ChevronRight, Building2, Check, X, Bell } from 'lucide-react';
import Layout from '../../components/Layout';
import CreateWorkspaceModal from '../../modals/workspace/CreateWorkspace';
import JoinWorkspaceModal from '../../modals/workspace/JoinWorkspace';
import { useUser } from '../../context/UserContext';
import { useToastContext } from '../../context/ToastContext';
import apiService from '../../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [userMeetings, setUserMeetings] = useState<any[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [workspaceMeetingCounts, setWorkspaceMeetingCounts] = useState<{[key: number]: number}>({});
  
  const { user, workspaces, pendingInvites, acceptInvite, rejectInvite, setCurrentWorkspace } = useUser();
  const { success: toastSuccess, error: toastError } = useToastContext();
  
  // Use context user or fallback
  const displayUser = user ? {
    name: user.name,
    email: user.email,
    avatar: user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'
  } : {
    name: 'Guest',
    email: 'guest@example.com',
    avatar: 'G'
  };

  // Check if user is areeba@kairo.com to show dummy data
  const shouldShowDummyData = user?.email?.toLowerCase() === 'areeba@kairo.com';

  // Fetch recent notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (shouldShowDummyData) {
        // Use dummy data for demo account
        setRecentNotifications([
          { id: 1, title: 'New task assigned', message: 'You have been assigned a new task in Product Team', createdAt: new Date(Date.now() - 5 * 60000).toISOString(), isRead: false, type: 'task' },
          { id: 2, title: 'Meeting reminder', message: 'Team meeting starts in 30 minutes', createdAt: new Date(Date.now() - 10 * 60000).toISOString(), isRead: false, type: 'meeting' },
          { id: 3, title: 'Sprint completed', message: 'Sprint retrospective has been completed', createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), isRead: true, type: 'system' },
        ]);
        setNotificationsLoading(false);
        return;
      }

      try {
        setNotificationsLoading(true);
        const response = await apiService.getNotifications();
        
        if (response.error) {
          console.error('Failed to fetch notifications:', response.error);
          setRecentNotifications([]);
        } else if (response.data) {
          // Get the most recent 3-4 notifications, sorted by date
          const sortedNotifications = response.data.notifications
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 4);
          setRecentNotifications(sortedNotifications);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        setRecentNotifications([]);
      } finally {
        setNotificationsLoading(false);
      }
    };

    fetchNotifications();
  }, [shouldShowDummyData]);

  // Fetch user meetings for calendar
  useEffect(() => {
    const fetchUserMeetings = async () => {
      if (shouldShowDummyData) {
        // Use dummy data for demo account - add meetings to current month
        const today = new Date();
        const thisMonth = today.getMonth();
        const thisYear = today.getFullYear();
        
        // Create meetings on different days of the current month
        const dummyMeetings = [
          { id: 1, startTime: new Date(thisYear, thisMonth, 5, 10).toISOString(), title: 'Team Standup', status: 'scheduled' },
          { id: 2, startTime: new Date(thisYear, thisMonth, 12, 14).toISOString(), title: 'Sprint Planning', status: 'scheduled' },
          { id: 3, startTime: new Date(thisYear, thisMonth, 18, 9).toISOString(), title: 'Client Review', status: 'scheduled' },
          { id: 4, startTime: new Date(thisYear, thisMonth, 22, 15).toISOString(), title: 'Retrospective', status: 'scheduled' },
          { id: 5, startTime: new Date(thisYear, thisMonth, 28, 11).toISOString(), title: 'Design Review', status: 'scheduled' },
        ];
        setUserMeetings(dummyMeetings);
        setMeetingsLoading(false);
        console.log('Dummy meetings set:', dummyMeetings.map(m => ({ 
          title: m.title, 
          date: new Date(m.startTime).toLocaleDateString() 
        })));
        return;
      }

      try {
        setMeetingsLoading(true);
        const response = await apiService.getMyMeetings({ upcoming: false });
        
        if (response.error) {
          console.error('Failed to fetch meetings:', response.error);
          setUserMeetings([]);
        } else if (response.data) {
          setUserMeetings(response.data.meetings || []);
        }
      } catch (error) {
        console.error('Error fetching meetings:', error);
        setUserMeetings([]);
      } finally {
        setMeetingsLoading(false);
      }
    };

    fetchUserMeetings();
  }, [shouldShowDummyData]);

  // Fetch meeting counts for each workspace
  useEffect(() => {
    const fetchWorkspaceMeetingsCounts = async () => {
      if (shouldShowDummyData) {
        // Use dummy data for demo account
        const dummyCounts: {[key: number]: number} = {
          1: 24,
          2: 15,
          3: 31,
        };
        setWorkspaceMeetingCounts(dummyCounts);
        return;
      }

      if (workspaces.length === 0) return;

      try {
        const counts: {[key: number]: number} = {};
        
        // Fetch meeting counts for each workspace
        await Promise.all(
          workspaces.map(async (ws) => {
            try {
              const response = await apiService.getMeetingsByWorkspace(ws.id);
              if (response.data?.meetings) {
                counts[ws.id] = response.data.meetings.length;
              }
            } catch (error) {
              console.error(`Failed to fetch meetings for workspace ${ws.id}:`, error);
              counts[ws.id] = 0;
            }
          })
        );
        
        setWorkspaceMeetingCounts(counts);
      } catch (error) {
        console.error('Error fetching workspace meeting counts:', error);
      }
    };

    fetchWorkspaceMeetingsCounts();
  }, [workspaces, shouldShowDummyData]);

  // Use actual user workspaces (only for real users, not demo)
  const fallbackColors = ['#9333ea', '#3b82f6', '#10b981', '#f97316'];
  
  const userWorkspaces = shouldShowDummyData ? [] : workspaces.map((ws, index) => ({
    id: ws.id,
    name: ws.name,
    role: ws.role || 'Member',
    members: ws.memberCount,
    meetings: workspaceMeetingCounts[ws.id] || 0,
    pendingTasks: 0, // TODO: Fetch actual tasks count
    colorTheme: ws.colorTheme || fallbackColors[index % fallbackColors.length],
    lastActive: new Date(ws.createdAt).toLocaleDateString(),
    isPending: false,
  }));

  // Add pending invites as workspace cards
  const pendingWorkspaces = shouldShowDummyData ? [] : pendingInvites.map(invite => ({
    id: `invite-${invite.id}`,
    inviteId: invite.id,
    name: invite.workspace.name,
    role: invite.role,
    members: 0,
    meetings: 0,
    pendingTasks: 0,
    gradient: 'from-yellow-500 to-orange-500',
    lastActive: `Invited by ${invite.inviter.name}`,
    isPending: true,
    inviter: invite.inviter,
  }));

  const dummyWorkspaces = shouldShowDummyData ? [
    {
      id: 999,
      name: 'Product Team Alpha',
      role: 'Manager',
      members: 12,
      meetings: 24,
      pendingTasks: 8,
      gradient: 'from-blue-500 to-cyan-500',
      lastActive: '2 hours ago',
    },
    {
      id: 998,
      name: 'Design Sprint Team',
      role: 'Developer',
      members: 6,
      meetings: 15,
      pendingTasks: 3,
      gradient: 'from-purple-500 to-pink-500',
      lastActive: '1 day ago',
    },
    {
      id: 997,
      name: 'Client Solutions',
      role: 'QA Engineer',
      members: 8,
      meetings: 31,
      pendingTasks: 12,
      gradient: 'from-green-500 to-teal-500',
      lastActive: '3 days ago',
    }
  ] : [];

  // Combine pending invites, user workspaces, and dummy workspaces
  const allWorkspaces = [...pendingWorkspaces, ...userWorkspaces, ...dummyWorkspaces];

  const handleAcceptInvite = async (inviteId: number) => {
    try {
      await acceptInvite(inviteId);
      toastSuccess('Workspace invitation accepted!', '✓ Invitation Accepted');
    } catch (error) {
      console.error('Failed to accept invite:', error);
      toastError('Failed to accept invitation. Please try again.', 'Accept Failed');
    }
  };

  const handleRejectInvite = async (inviteId: number) => {
    try {
      await rejectInvite(inviteId);
      toastSuccess('Workspace invitation rejected', 'Invitation Rejected');
    } catch (error) {
      console.error('Failed to reject invite:', error);
      toastError('Failed to reject invitation. Please try again.', 'Reject Failed');
    }
  };


  // Calendar helper functions
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const getMeetingShade = (_day: number, meetingsForDay: any[]) => {
    if (meetingsLoading || meetingsForDay.length === 0) return '';
    
    const hasLive = meetingsForDay.some(m => m.statusType === 'live');
    const hasUpcoming = meetingsForDay.some(m => m.statusType === 'upcoming');
    const hasCurrentToday = meetingsForDay.some(m => m.statusType === 'current');
    
    if (hasLive) {
      return 'bg-cyan-500/20 border-cyan-500/40 dark:border-cyan-500/50 text-cyan-700'; // Live meetings - brighter cyan
    } else if (hasCurrentToday) {
      return 'bg-cyan-500/15 border-cyan-500/30 dark:border-cyan-500/40 text-cyan-700'; // Today's upcoming - medium cyan
    } else if (hasUpcoming) {
      return 'bg-cyan-500/10 border-cyan-500/20 dark:text-cyan-400 text-cyan-700'; // Future meetings - lighter cyan
    } else {
      return 'bg-slate-500/10 border-slate-500/20 dark:text-slate-400 text-slate-600'; // Past meetings - gray
    }
  };

  const getMeetingsForDay = (day: number) => {
    if (meetingsLoading || userMeetings.length === 0) return [];
    
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    targetDate.setHours(0, 0, 0, 0);
    
    const matchingMeetings = userMeetings.filter(meeting => {
      if (!meeting.startTime) return false;
      
      const meetingDate = new Date(meeting.startTime);
      meetingDate.setHours(0, 0, 0, 0);
      
      return meetingDate.getTime() === targetDate.getTime();
    });

    return matchingMeetings.map(meeting => {
      const meetingDate = new Date(meeting.startTime);
      const meetingEnd = meeting.endTime ? new Date(meeting.endTime) : new Date(meetingDate.getTime() + 60 * 60 * 1000);
      const now = new Date();
      
      // Check if meeting is today
      const today = new Date();
      const isToday = (
        meetingDate.getDate() === today.getDate() &&
        meetingDate.getMonth() === today.getMonth() &&
        meetingDate.getFullYear() === today.getFullYear()
      );
      
      // Check if meeting is upcoming (future)
      const isUpcoming = meetingDate > now;
      
      // Check if meeting is live (between start and end time)
      const isLive = isToday && now >= meetingDate && now <= meetingEnd && meeting.status !== 'completed' && meeting.status !== 'cancelled';
      
      // Check if meeting is past (completed or cancelled)
      const isPast = now > meetingEnd || meeting.status === 'completed' || meeting.status === 'cancelled';
      
      return {
        ...meeting,
        statusType: isLive ? 'live' : isUpcoming ? 'upcoming' : isPast ? 'past' : 'current'
      };
    });
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  return (
    <Layout>
      {/* Main Dashboard Content */}
      <div className="pr-0 lg:pr-80">
        <div className="p-6 lg:p-8">
          {/* Hero Section */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-white">
              Welcome back, {displayUser.name.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-600 dark:text-slate-400">Manage your workspaces and stay on top of your meetings</p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {/* Create Workspace */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="group relative overflow-hidden p-4 rounded-lg transition-all duration-300
                        bg-white border border-gray-200 hover:border-cyan-400/50 shadow-sm
                        dark:bg-gradient-to-br dark:from-cyan-900 dark:via-cyan-800 dark:to-blue-900
                        dark:border-cyan-600/50 dark:hover:border-cyan-400/60 dark:shadow-[0_0_12px_-4px_rgba(34,211,238,0.3)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-500/50 transition-shadow">
                  <Plus size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold mb-0.5 text-gray-900 dark:text-white">Create Workspace</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Start a new collaborative space</p>
                </div>
              </div>
            </button>

            {/* Join Workspace */}
            <button
              onClick={() => setShowJoinModal(true)}
              className="group relative overflow-hidden p-4 rounded-lg transition-all duration-300
                        bg-white border border-gray-200 hover:border-purple-400/50 shadow-sm
                        dark:bg-gradient-to-br dark:from-purple-900 dark:via-purple-800 dark:to-pink-900
                        dark:border-purple-600/50 dark:hover:border-purple-400/60 dark:shadow-[0_0_12px_-4px_rgba(192,132,252,0.3)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-shadow">
                  <Mail size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold mb-0.5 text-gray-900 dark:text-white">Join Workspace</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">Use an invitation code</p>
                </div>
              </div>
            </button>
          </div>

          {/* Workspaces Section */}
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <span>Your Workspaces</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-sm text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                {allWorkspaces.length}
              </span>
            </h2>

            <div className="grid grid-cols-1 gap-3">
              {allWorkspaces.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No workspaces yet</p>
                  <p className="text-xs mt-1">Create or join a workspace to get started</p>
                </div>
              ) : (
                allWorkspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className={`group rounded-lg p-4 border transition-all duration-300 shadow-sm ${
                    'isPending' in workspace && workspace.isPending
                      ? 'bg-gradient-to-br from-yellow-50/50 to-orange-50/50 border-yellow-300 animate-pulse-subtle opacity-70 hover:opacity-90 dark:from-yellow-900/10 dark:to-orange-900/10 dark:border-yellow-600/50'
                      : 'bg-white border-gray-200 hover:border-gray-300 dark:bg-slate-800/50 dark:backdrop-blur-sm dark:border-slate-700/50 dark:hover:border-slate-600 cursor-pointer'
                  }`}
                  style={'isPending' in workspace && workspace.isPending ? {
                    animation: 'pulse-glow 2s ease-in-out infinite',
                  } : undefined}
                  onClick={() => {
                    if (!('isPending' in workspace && workspace.isPending)) {
                      const selected = {
                        id: String(workspace.id),
                        name: workspace.name,
                        role: workspace.role,
                        colorTheme: 'colorTheme' in workspace ? (workspace as any).colorTheme : undefined,
                        memberCount: workspace.members,
                      } as any;
                      setCurrentWorkspace(selected);
                      localStorage.setItem('currentWorkspace', JSON.stringify(selected));
                      const workspaceId = typeof workspace.id === 'string' ? workspace.id : String(workspace.id);
                      navigate(`/workspace/${workspaceId}`);
                    }
                  }}
                >
                  {'isPending' in workspace && workspace.isPending && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-full animate-bounce-subtle">
                      Pending Invitation
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold shadow-lg ${
                          'isPending' in workspace && workspace.isPending ? 'opacity-60 animate-pulse-subtle' : ''
                        }`}
                        style={{
                          backgroundColor: 'colorTheme' in workspace && typeof workspace.colorTheme === 'string' 
                            ? workspace.colorTheme 
                            : '#9333ea'
                        }}
                      >
                        {workspace.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-0.5 text-gray-900 dark:text-white flex items-center gap-2">
                          {workspace.name}
                          {'isPending' in workspace && workspace.isPending && (
                            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full border border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-600">
                              Invitation
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {workspace.lastActive}
                          </span>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-700 dark:bg-slate-700 dark:text-slate-300">{`${(workspace.role || '').slice(0,1).toUpperCase()}${(workspace.role || '').slice(1).toLowerCase()}`}</span>
                        </div>
                      </div>
                    </div>

                    {/* Removed Manage/Leave/Open buttons; card is clickable */}
                  </div>

                  {"isPending" in workspace && workspace.isPending ? (
                    // Pending invitation action buttons
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          if ("inviteId" in workspace && typeof workspace.inviteId === "number") {
                            handleAcceptInvite(workspace.inviteId);
                          }
                        }}
                        className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-all font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                      >
                        <Check size={18} className="group-hover:scale-110 transition-transform" />
                        Accept Invitation
                      </button>
                      <button
                        onClick={() => {
                          if ("inviteId" in workspace && typeof workspace.inviteId === "number") {
                            handleRejectInvite(workspace.inviteId);
                          }
                        }}
                        className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-md hover:bg-red-100 hover:text-red-700 transition-all font-medium flex items-center justify-center gap-2 group dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      >
                        <X size={18} className="group-hover:scale-110 transition-transform" />
                        Decline
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                    <div className="rounded p-2.5 border bg-gray-50 border-gray-200 dark:bg-slate-900/50 dark:border-slate-700/30">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Users size={14} className="text-cyan-400" />
                        <span className="text-xs text-gray-600 dark:text-slate-400">Members</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{workspace.members}</p>
                    </div>
                    <div className="rounded p-2.5 border bg-gray-50 border-gray-200 dark:bg-slate-900/50 dark:border-slate-700/30">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Calendar size={14} className="text-blue-400" />
                        <span className="text-xs text-gray-600 dark:text-slate-400">Meetings</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{workspace.meetings}</p>
                    </div>
                    <div className="rounded p-2.5 border bg-gray-50 border-gray-200 dark:bg-slate-900/50 dark:border-slate-700/30">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <CheckSquare size={14} className="text-green-400" />
                        <span className="text-xs text-gray-600 dark:text-slate-400">Tasks</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{workspace.pendingTasks}</p>
                    </div>
                    <div className="rounded p-2.5 border bg-gray-50 border-gray-200 dark:bg-slate-900/50 dark:border-slate-700/30">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <TrendingUp size={14} className="text-purple-400" />
                        <span className="text-xs text-gray-600 dark:text-slate-400">Analytics</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">→</p>
                    </div>
                  </div>
                )}
                </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="hidden lg:block fixed right-0 top-20 bottom-0 w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto no-scrollbar dark:bg-slate-900/50 dark:backdrop-blur-xl dark:border-slate-800/50">
        {/* Mini Calendar */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 dark:text-slate-400">Calendar</h3>
          <div className="rounded-lg p-3 border bg-white border-gray-200 dark:bg-slate-800/50 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{formatMonthYear(currentDate)}</h4>
              <div className="flex gap-1">
                <button 
                  onClick={() => navigateMonth('prev')}
                  className="p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <ChevronLeft size={14} />
                </button>
                <button 
                  onClick={() => navigateMonth('next')}
                  className="p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            {meetingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-xs text-gray-500 dark:text-slate-500 p-1">{day}</div>
                ))}
                {getDaysInMonth(currentDate).map((day, i) => {
                  if (day === null) return null;
                  const meetingsForDay = getMeetingsForDay(day);
                  const meetingCount = meetingsForDay.length;
                  
                  const shade = getMeetingShade(day, meetingsForDay);
                  const isCurrentDay = isToday(day);
                  
                  return (
                    <button
                      key={i}
                      className={`p-1 text-xs rounded transition-colors relative border ${
                        isCurrentDay
                          ? 'bg-cyan-500 text-white font-bold border-cyan-400'
                          : meetingsForDay.length > 0
                          ? shade + ' hover:scale-105'
                          : 'hover:bg-gray-100 text-gray-700 dark:hover:bg-slate-700 dark:text-slate-300 border-transparent'
                      }`}
                      disabled={false}
                      title={meetingCount > 0 ? `${meetingCount} meeting${meetingCount > 1 ? 's' : ''} on ${day}` : ''}
                    >
                      {day}
                      {meetingCount > 0 && (
                        <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                          shade.includes('bg-slate') 
                            ? 'bg-slate-500' 
                            : shade.includes('live') || shade.includes('bg-cyan-500/20')
                            ? 'bg-cyan-600' 
                            : 'bg-cyan-500'
                        }`}></div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider dark:text-slate-400">Notifications</h3>
            {recentNotifications.length > 0 && (
              <button
                onClick={() => navigate('/notifications')}
                className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                View all
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {notificationsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500"></div>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="text-center py-4">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-slate-500" />
                <p className="text-xs text-gray-500 dark:text-slate-400">No notifications yet</p>
              </div>
            ) : (
              recentNotifications.map((notif) => (
              <div
                key={notif.id}
                  className={`p-2.5 rounded-lg border transition-colors cursor-pointer hover:shadow-sm ${
                    !notif.isRead ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-gray-50 border-gray-200 dark:bg-slate-800/50 dark:border-slate-700/50'
                  }`}
                  onClick={() => navigate('/notifications')}
                >
                  <div className="flex items-start gap-2">
                    {!notif.isRead && (
                      <div className="w-2 h-2 mt-1.5 bg-cyan-500 rounded-full flex-shrink-0"></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-0.5 text-gray-900 dark:text-white line-clamp-1">{notif.title || notif.message}</p>
                      {notif.title && (
                        <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">{notif.message}</p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">{formatTimeAgo(notif.createdAt)}</p>
                    </div>
                  </div>
              </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 dark:text-slate-400">Quick Actions</h3>
          <div className="space-y-1.5">
            <button className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors text-left bg-white hover:bg-gray-50 border-gray-200 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 dark:border-slate-700/50">
              <CheckSquare size={16} className="text-green-600 dark:text-green-400" />
              <span className="text-sm text-gray-900 dark:text-white">Create Task</span>
            </button>
            <button className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors text-left bg-white hover:bg-gray-50 border-gray-200 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 dark:border-slate-700/50">
              <BarChart3 size={16} className="text-purple-600 dark:text-purple-400" />
              <span className="text-sm text-gray-900 dark:text-white">View Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onWorkspaceCreated={() => {
          console.log('Workspace created successfully!');
          // Refresh the page or update workspaces list
          window.location.reload();
        }}
      />

      {/* Join Workspace Modal */}
      <JoinWorkspaceModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} />

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Flickering animation for pending workspaces */
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.7;
            box-shadow: 0 0 0 0 rgba(234, 179, 8, 0);
          }
          50% {
            opacity: 0.9;
            box-shadow: 0 0 20px 5px rgba(234, 179, 8, 0.2);
          }
        }

        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 0.8;
          }
        }

        @keyframes bounce-subtle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }

        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </Layout>
  );
};

export default Dashboard;