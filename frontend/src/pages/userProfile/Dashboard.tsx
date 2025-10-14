import { useState } from 'react';
import { Plus, Users, Calendar, BarChart3, CheckSquare, TrendingUp, Clock, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import Layout from '../../components/Layout';
import CreateWorkspaceModal from '../../modals/CreateWorkspace';
import JoinWorkspaceModal from '../../modals/JoinWorkspace';

const Dashboard = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const user = {
    name: 'Areeba Riaz',
    email: 'areebariaz@company.com',
    avatar: 'AR'
  };

  const workspaces = [
    {
      id: 1,
      name: 'Product Team Alpha',
      role: 'Manager',
      members: 12,
      meetings: 24,
      pendingTasks: 8,
      gradient: 'from-blue-500 to-cyan-500',
      lastActive: '2 hours ago',
    },
    {
      id: 2,
      name: 'Design Sprint Team',
      role: 'Developer',
      members: 6,
      meetings: 15,
      pendingTasks: 3,
      gradient: 'from-purple-500 to-pink-500',
      lastActive: '1 day ago',
    },
    {
      id: 3,
      name: 'Client Solutions',
      role: 'QA Engineer',
      members: 8,
      meetings: 31,
      pendingTasks: 12,
      gradient: 'from-green-500 to-teal-500',
      lastActive: '3 days ago',
    }
  ];

  const notifications = [
    { id: 1, text: 'New task assigned in Product Team', time: '5m ago', unread: true },
    { id: 2, text: 'Meeting starts in 30 minutes', time: '10m ago', unread: true },
    { id: 3, text: 'Sprint retrospective completed', time: '2h ago', unread: false }
  ];

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

  const hasMeetings = (day: number) => {
    // Mock data - in real app, this would check actual meetings
    const meetingDays = [5, 12, 18, 25, 28];
    return meetingDays.includes(day);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <Layout>
      {/* Main Dashboard Content */}
      <div className="pr-0 lg:pr-80">
        <div className="p-6 lg:p-8">
          {/* Hero Section */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-white">
              Welcome back, {user.name.split(' ')[0]} 👋
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
                {workspaces.length}
              </span>
            </h2>

            <div className="grid grid-cols-1 gap-3">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="group rounded-lg p-4 border transition-all duration-300 bg-white border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/50 dark:backdrop-blur-sm dark:border-slate-700/50 dark:hover:border-slate-600"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 bg-gradient-to-br ${workspace.gradient} rounded-lg flex items-center justify-center text-lg font-bold shadow-lg`}>
                        {workspace.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-0.5 text-gray-900 dark:text-white">{workspace.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {workspace.lastActive}
                          </span>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-700 dark:bg-slate-700 dark:text-slate-300">{workspace.role}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all text-white">
                        Open
                      </button>
                      <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium transition-colors text-gray-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white">
                        Manage
                      </button>
                      <button className="px-3 py-1.5 bg-gray-100 hover:bg-red-100 hover:text-red-600 rounded text-sm font-medium transition-all text-gray-900 dark:bg-slate-700 dark:hover:bg-red-500/20 dark:hover:text-red-400 dark:text-white">
                        Leave
                      </button>
                    </div>
                  </div>

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
                </div>
              ))}
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
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-xs text-gray-500 dark:text-slate-500 p-1">{day}</div>
              ))}
              {getDaysInMonth(currentDate).map((day, i) => (
                <button
                  key={i}
                  className={`p-1 text-xs rounded transition-colors ${
                    day === null 
                      ? 'invisible' 
                      : isToday(day)
                      ? 'bg-cyan-500 text-white font-bold'
                      : hasMeetings(day)
                      ? 'bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-400'
                      : 'hover:bg-gray-100 text-gray-700 dark:hover:bg-slate-700 dark:text-slate-300'
                  }`}
                  disabled={day === null}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 dark:text-slate-400">Notifications</h3>
          <div className="space-y-1.5">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-2.5 rounded-lg border transition-colors ${
                  notif.unread ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-gray-50 border-gray-200 dark:bg-slate-800/50 dark:border-slate-700/50'
                }`}
              >
                <p className="text-sm mb-0.5 text-gray-900 dark:text-white">{notif.text}</p>
                <p className="text-xs text-gray-500 dark:text-slate-500">{notif.time}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 dark:text-slate-400">Quick Actions</h3>
          <div className="space-y-1.5">
            <button className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors text-left bg-white hover:bg-gray-50 border-gray-200 dark:bg-slate-800/50 dark:hover:bg-slate-700/50 dark:border-slate-700/50">
              <Calendar size={16} className="text-cyan-600 dark:text-cyan-400" />
              <span className="text-sm text-gray-900 dark:text-white">Schedule Meeting</span>
            </button>
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
      `}</style>
    </Layout>
  );
};

export default Dashboard;