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
    { id: 1, type: 'task', text: 'New task assigned from Sprint Planning', time: '5 min ago', user: 'Alex M.' },
    { id: 2, type: 'meeting', text: 'Meeting summary ready: Client Demo', time: '1 hour ago', user: 'System' },
    { id: 3, type: 'memory', text: 'Memory link created between 2 meetings', time: '2 hours ago', user: 'System' },
    { id: 4, type: 'complete', text: 'API Integration Sync completed', time: '3 hours ago', user: 'John D.' },
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
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">PT</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                  Product Team Alpha
                </h1>
                <p className="text-slate-400">12 members • Manager</p>
              </div>
            </div>
          </div>
          
          {/* Time Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="bg-slate-800/50 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
            </select>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4" />
                    {stat.change}
                  </span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">{stat.value}</h3>
                <p className="text-slate-400 text-sm">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Upcoming Meetings */}
          <div className="lg:col-span-2 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Upcoming Meetings
              </h2>
              <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                View All
              </button>
            </div>
            <div className="space-y-4">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {meeting.time}
                        </span>
                        <span>{meeting.duration}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {meeting.participants.map((initial, idx) => (
                          <div
                            key={idx}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white ${
                              initial.startsWith('+') 
                                ? 'bg-slate-700 text-slate-400' 
                                : 'bg-gradient-to-br from-purple-500 to-pink-600'
                            }`}
                          >
                            {initial}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        meeting.status === 'Soon' 
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {meeting.status}
                      </span>
                      <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                        <Play className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Memory Insights */}
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                Memory Insights
              </h2>
              <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                View Graph
              </button>
            </div>
            <div className="space-y-3">
              {memoryInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <Network className="w-5 h-5 text-purple-400 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
                        {insight.topic}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Meetings with Transcripts */}
          <div className="lg:col-span-2 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                Recent Meetings & Transcripts
              </h2>
              <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 hover:border-purple-500/50 transition-all duration-300 group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                        <span>{meeting.date}</span>
                        <span>{meeting.duration}</span>
                        <span className="flex items-center gap-1">
                          <CheckSquare className="w-4 h-4" />
                          {meeting.tasks} tasks
                        </span>
                        {meeting.transcriptReady && (
                          <span className="flex items-center gap-1 text-green-400">
                            <FileText className="w-4 h-4" />
                            Transcript
                          </span>
                        )}
                        {meeting.memoryLinks > 0 && (
                          <span className="flex items-center gap-1 text-purple-400">
                            <Brain className="w-4 h-4" />
                            {meeting.memoryLinks} links
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="View Transcript">
                        <FileText className="w-4 h-4 text-slate-400" />
                      </button>
                      <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Download">
                        <Download className="w-4 h-4 text-slate-400" />
                      </button>
                      <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                Activity Feed
              </h2>
            </div>
            <div className="space-y-4">
              {activityFeed.map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white mb-1">{activity.text}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500">{activity.time}</p>
                        <span className="text-slate-600">•</span>
                        <p className="text-xs text-slate-500">{activity.user}</p>
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