import { useState } from 'react';
import { Video, CheckSquare, TrendingUp, Clock, Calendar, ArrowUpRight, Play, MoreVertical, MessageSquare, FileText, Brain, Network, Filter, Download } from 'lucide-react';
import Layout from '../../components/Layout';

const WorkspaceOverview = () => {
  const [timeFilter, setTimeFilter] = useState('week');

  const stats = [
    { id: 1, label: 'Total Meetings', value: '24', change: '+12%', icon: Video, color: 'from-blue-500 to-cyan-500' },
    { id: 2, label: 'Active Tasks', value: '18', change: '+8%', icon: CheckSquare, color: 'from-purple-500 to-pink-500' },
    { id: 3, label: 'Completion Rate', value: '87%', change: '+5%', icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
    { id: 4, label: 'Memory Items', value: '156', change: '+23', icon: Brain, color: 'from-orange-500 to-red-500' },
  ];

  const upcomingMeetings = [
    { id: 1, title: 'Sprint Planning', time: '2:00 PM', participants: ['AM', 'JD', 'SK', '+5'], duration: '60 min', status: 'Soon' },
    { id: 2, title: 'Client Demo', time: '4:30 PM', participants: ['AM', 'RK', 'LM'], duration: '45 min', status: 'Scheduled' },
    { id: 3, title: 'Team Standup', time: 'Tomorrow 9:00 AM', participants: ['AM', 'JD', 'SK', 'RK', '+8'], duration: '15 min', status: 'Scheduled' },
  ];

  const recentMeetings = [
    { id: 1, title: 'Product Review Q4', date: 'Oct 10, 2025', tasks: 8, transcriptReady: true, memoryLinks: 3, duration: '1h 20m' },
    { id: 2, title: 'Design Sprint Retro', date: 'Oct 9, 2025', tasks: 5, transcriptReady: true, memoryLinks: 2, duration: '45m' },
    { id: 3, title: 'API Integration Sync', date: 'Oct 8, 2025', tasks: 12, transcriptReady: true, memoryLinks: 5, duration: '1h 05m' },
  ];

  const memoryInsights = [
    { id: 1, topic: 'API v2 Migration', linkedMeetings: 5, lastDiscussed: '2 days ago' },
    { id: 2, topic: 'User Authentication Flow', linkedMeetings: 3, lastDiscussed: '1 week ago' },
    { id: 3, topic: 'Q4 Goals', linkedMeetings: 8, lastDiscussed: '3 days ago' },
  ];

  const activityFeed = [
    { id: 1, type: 'task', text: 'New task assigned from Sprint Planning', time: '5 min ago', user: 'Ali H.' },
    { id: 2, type: 'meeting', text: 'Meeting summary ready: Client Demo', time: '1 hour ago', user: 'System' },
    { id: 3, type: 'memory', text: 'Memory link created between 2 meetings', time: '2 hours ago', user: 'System' },
    { id: 4, type: 'complete', text: 'API Integration Sync completed', time: '3 hours ago', user: 'Areeba R.' },
    { id: 5, type: 'transcript', text: 'Transcript processed for Product Review', time: '4 hours ago', user: 'System' },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task': return CheckSquare;
      case 'meeting': return Video;
      case 'memory': return Brain;
      case 'transcript': return FileText;
      case 'complete': return TrendingUp;
      default: return MessageSquare;
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PT</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Product Team Alpha
                </h1>
                <p className="text-gray-600 dark:text-slate-400 text-sm">12 members • Manager</p>
              </div>
            </div>
          </div>
          
          {/* Time Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none transition-all bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
            </select>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className="rounded-lg p-5 transition-all duration-200 group cursor-pointer bg-white border border-gray-200 hover:border-gray-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 bg-gradient-to-br ${stat.color} rounded-lg group-hover:scale-105 transition-transform duration-200`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-green-600 dark:text-green-400 text-xs font-medium flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {stat.change}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{stat.value}</h3>
                <p className="text-gray-600 dark:text-slate-400 text-sm">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Upcoming Meetings */}
          <div className="lg:col-span-2 rounded-lg p-5 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                Upcoming Meetings
              </h2>
              <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium">
                View All
              </button>
            </div>
              <div className="space-y-3">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                    className="rounded-lg p-4 transition-all duration-200 group cursor-pointer bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-900/50 dark:border-slate-700/50 dark:hover:border-purple-500/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                        {meeting.title}
                      </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400 mb-3">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {meeting.time}
                        </span>
                        <span>{meeting.duration}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {meeting.participants.map((initial, idx) => (
                          <div
                            key={idx}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                              initial.startsWith('+') 
                                ? 'bg-gray-200 text-gray-600 dark:bg-slate-700/80 dark:text-slate-400' 
                                : 'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
                            }`}
                          >
                            {initial}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                        meeting.status === 'Soon' 
                          ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30' 
                          : 'bg-gray-100 text-gray-700 border border-gray-300 dark:bg-slate-700/50 dark:text-slate-300 dark:border-transparent'
                      }`}>
                        {meeting.status}
                      </span>
                      <button className="p-2 hover:bg-slate-700/50 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                        <Play className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Memory Insights */}
          <div className="rounded-lg p-5 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                Memory Insights
              </h2>
              <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium">
                View Graph
              </button>
            </div>
            <div className="space-y-2.5">
                {memoryInsights.map((insight) => (
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
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Meetings with Transcripts */}
          <div className="lg:col-span-2 rounded-lg p-5 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Recent Meetings & Transcripts
              </h2>
              <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium">
                View All
              </button>
            </div>
            <div className="space-y-2.5">
                {recentMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                    className="rounded-lg p-4 transition-all duration-200 group cursor-pointer bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-900/50 dark:border-slate-700/50 dark:hover:border-purple-500/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-400 flex-wrap">
                        <span>{meeting.date}</span>
                        <span>{meeting.duration}</span>
                        <span className="flex items-center gap-1">
                          <CheckSquare className="w-3.5 h-3.5" />
                          {meeting.tasks} tasks
                        </span>
                        {meeting.transcriptReady && (
                          <span className="flex items-center gap-1 text-green-400">
                            <FileText className="w-3.5 h-3.5" />
                            Transcript
                          </span>
                        )}
                        {meeting.memoryLinks > 0 && (
                          <span className="flex items-center gap-1 text-purple-400">
                            <Brain className="w-3.5 h-3.5" />
                            {meeting.memoryLinks} links
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3">
                      <button className="p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-slate-700/50" title="View Transcript">
                        <FileText className="w-3.5 h-3.5 text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors" />
                      </button>
                      <button className="p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-slate-700/50" title="Download">
                        <Download className="w-3.5 h-3.5 text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors" />
                      </button>
                      <button className="p-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-slate-700/50">
                        <MoreVertical className="w-3.5 h-3.5 text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-lg p-5 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                Activity Feed
              </h2>
            </div>
            <div className="space-y-3.5">
              {activityFeed.map((activity) => {
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
              })}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default WorkspaceOverview;