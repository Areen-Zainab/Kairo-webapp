import React, { useState, useMemo } from 'react';
import Layout from '../../components/Layout';
import TabNavigation from '../../components/workspace/analytics/TabNavigation';
import StatsCard from '../../components/workspace/analytics/StatsCard';
import LineChart from '../../components/workspace/analytics/LineChart';
import BarChart from '../../components/workspace/analytics/BarChart';
import PieChart from '../../components/workspace/analytics/PieChart';
import SummaryPanel from '../../components/workspace/analytics/SummaryPanel';
import FiltersSidebar from '../../components/workspace/analytics/FiltersSidebar';
import ChatBubble from '../../components/workspace/analytics/ChatBubble';
import AnalyticsChat from '../../components/workspace/analytics/AnalyticsChat';
import type { AnalyticsData, FilterOptions, TimeSeriesData, ChartDataPoint, AnalyticsInsight, MeetingAnalytics } from '../../components/workspace/analytics/types';

const Analytics: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    timeRange: 'month',
    team: undefined,
    meetingType: undefined
  });

  // Mock data for corporate project workspace
  const analyticsData: AnalyticsData = {
    totalUsers: 47,
    activeSessions: 23,
    completedTasks: 128,
    meetingsScheduled: 34,
    meetingsAttended: 31,
    engagementRate: 91.2
  };

  const workspaceActivityData: TimeSeriesData[] = [
    { date: '2024-01-01', value: 45, label: 'Jan 1' },
    { date: '2024-01-02', value: 52, label: 'Jan 2' },
    { date: '2024-01-03', value: 38, label: 'Jan 3' },
    { date: '2024-01-04', value: 61, label: 'Jan 4' },
    { date: '2024-01-05', value: 67, label: 'Jan 5' },
    { date: '2024-01-06', value: 43, label: 'Jan 6' },
    { date: '2024-01-07', value: 58, label: 'Jan 7' }
  ];

  const taskCompletionData: ChartDataPoint[] = [
    { label: 'Backend Development', value: 28, color: '#3b82f6' },
    { label: 'Frontend Development', value: 24, color: '#8b5cf6' },
    { label: 'UI/UX Design', value: 18, color: '#10b981' },
    { label: 'QA Testing', value: 22, color: '#f59e0b' },
    { label: 'DevOps', value: 16, color: '#ef4444' },
    { label: 'Project Management', value: 20, color: '#06b6d4' }
  ];

  const engagementDistribution: ChartDataPoint[] = [
    { label: 'Highly Engaged', value: 42, color: '#10b981' },
    { label: 'Moderately Engaged', value: 38, color: '#f59e0b' },
    { label: 'Low Engagement', value: 20, color: '#ef4444' }
  ];

  const meetingAnalytics: MeetingAnalytics = {
    meetingsPerTeam: [
      { label: 'Backend Team', value: 12, color: '#3b82f6' },
      { label: 'Frontend Team', value: 10, color: '#8b5cf6' },
      { label: 'Design Team', value: 8, color: '#10b981' },
      { label: 'QA Team', value: 6, color: '#f59e0b' },
      { label: 'DevOps Team', value: 4, color: '#ef4444' },
      { label: 'Project Management', value: 9, color: '#06b6d4' }
    ],
    attendanceTrends: [
      { date: '2024-01-01', value: 88, label: 'Jan 1' },
      { date: '2024-01-02', value: 94, label: 'Jan 2' },
      { date: '2024-01-03', value: 82, label: 'Jan 3' },
      { date: '2024-01-04', value: 91, label: 'Jan 4' },
      { date: '2024-01-05', value: 96, label: 'Jan 5' },
      { date: '2024-01-06', value: 85, label: 'Jan 6' },
      { date: '2024-01-07', value: 93, label: 'Jan 7' }
    ],
    meetingTypesDistribution: [
      { label: 'Daily Stand-ups', value: 35, color: '#3b82f6' },
      { label: 'Sprint Planning', value: 20, color: '#8b5cf6' },
      { label: 'Code Reviews', value: 18, color: '#10b981' },
      { label: 'Client Meetings', value: 15, color: '#f59e0b' },
      { label: 'Retrospectives', value: 12, color: '#ef4444' }
    ],
    averageDuration: 32,
    participationByTeam: [
      { label: 'Backend Team', value: 95, color: '#3b82f6' },
      { label: 'Frontend Team', value: 92, color: '#8b5cf6' },
      { label: 'Design Team', value: 89, color: '#10b981' },
      { label: 'QA Team', value: 87, color: '#f59e0b' },
      { label: 'DevOps Team', value: 91, color: '#ef4444' },
      { label: 'Project Management', value: 96, color: '#06b6d4' }
    ]
  };

  const insights: AnalyticsInsight[] = [
    {
      type: 'trend',
      title: 'Sprint Velocity Increased 18%',
      description: 'Project sprint velocity has improved significantly this month, with Backend and Frontend teams completing 18% more story points than previous sprint.',
      priority: 'high',
      icon: '📈'
    },
    {
      type: 'recommendation',
      title: 'Optimize Meeting Efficiency',
      description: 'Average meeting duration is 32 minutes. Consider implementing 25-minute timeboxes for daily stand-ups to improve team productivity.',
      priority: 'medium',
      icon: '💡'
    },
    {
      type: 'anomaly',
      title: 'QA Team Workload Imbalance',
      description: 'QA team shows lower task completion compared to development teams. Consider redistributing testing tasks or increasing QA team capacity.',
      priority: 'high',
      icon: '⚠️'
    }
  ];

  const statsCards = useMemo(() => [
    {
      title: 'Project Members',
      value: analyticsData.totalUsers,
      change: 8.5,
      changeType: 'positive' as const,
      icon: '👥',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Active Contributors',
      value: analyticsData.activeSessions,
      change: 12.3,
      changeType: 'positive' as const,
      icon: '🟢',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Stories Completed',
      value: analyticsData.completedTasks,
      change: 15.7,
      changeType: 'positive' as const,
      icon: '✅',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Sprint Meetings',
      value: analyticsData.meetingsScheduled,
      change: 22.1,
      changeType: 'positive' as const,
      icon: '📅',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Meeting Attendance',
      value: analyticsData.meetingsAttended,
      change: 18.9,
      changeType: 'positive' as const,
      icon: '👥',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Team Engagement',
      value: `${analyticsData.engagementRate}%`,
      change: 7.2,
      changeType: 'positive' as const,
      icon: '📊',
      trend: workspaceActivityData.slice(-7)
    }
  ], [analyticsData, workspaceActivityData]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {statsCards.map((card, index) => (
                <StatsCard key={index} {...card} />
              ))}
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LineChart
                data={workspaceActivityData}
                title="Project Activity Over Time"
                xAxisLabel="Date"
                yAxisLabel="Daily Activity"
                height={350}
              />
              <BarChart
                data={taskCompletionData}
                title="Story Points Completed by Team"
                xAxisLabel="Team"
                yAxisLabel="Story Points"
                height={350}
              />
            </div>

            {/* Engagement Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PieChart
                data={engagementDistribution}
                title="Engagement Distribution"
                height={300}
              />
              <SummaryPanel insights={insights.slice(0, 2)} />
            </div>
          </div>
        );

      case 'meetings':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <BarChart
                data={meetingAnalytics.meetingsPerTeam}
                title="Sprint Meetings by Team"
                xAxisLabel="Team"
                yAxisLabel="Meetings"
                height={300}
              />
              <LineChart
                data={meetingAnalytics.attendanceTrends}
                title="Daily Stand-up Attendance"
                xAxisLabel="Date"
                yAxisLabel="Attendance %"
                height={300}
              />
              <PieChart
                data={meetingAnalytics.meetingTypesDistribution}
                title="Meeting Types Distribution"
                height={300}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BarChart
                data={meetingAnalytics.participationByTeam}
                title="Meeting Participation by Team"
                xAxisLabel="Team"
                yAxisLabel="Participation %"
                height={350}
              />
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Meeting Statistics
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Average Duration</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{meetingAnalytics.averageDuration} min</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Total Meetings</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{analyticsData.meetingsScheduled}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Attendance Rate</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {((analyticsData.meetingsAttended / analyticsData.meetingsScheduled) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'teams':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BarChart
                data={taskCompletionData}
                title="Story Points by Development Team"
                xAxisLabel="Team"
                yAxisLabel="Story Points"
                height={350}
              />
              <BarChart
                data={meetingAnalytics.participationByTeam}
                title="Sprint Participation by Team"
                xAxisLabel="Team"
                yAxisLabel="Participation %"
                height={350}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Top Performing Team</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">Backend</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">95% sprint participation</div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Most Active Team</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">Frontend</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">28 story points completed</div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Growth Leader</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">DevOps</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">+25% velocity increase</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'performance':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LineChart
                data={workspaceActivityData}
                title="Project Velocity Trends"
                xAxisLabel="Date"
                yAxisLabel="Daily Velocity"
                height={350}
              />
              <LineChart
                data={meetingAnalytics.attendanceTrends}
                title="Sprint Meeting Attendance"
                xAxisLabel="Date"
                yAxisLabel="Attendance %"
                height={350}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <StatsCard
                title="Sprint Velocity"
                value="42"
                change={8.5}
                changeType="positive"
                icon="⚡"
              />
              <StatsCard
                title="Code Quality Score"
                value="94.2"
                change={3.1}
                changeType="positive"
                icon="🎯"
              />
              <StatsCard
                title="Bug Resolution Rate"
                value="96.8"
                change={2.4}
                changeType="positive"
                icon="⭐"
              />
            </div>
          </div>
        );

      case 'insights':
        return (
          <div className="space-y-8">
            <SummaryPanel insights={insights} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Project Recommendations</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 mt-2"></div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Implement 25-minute timeboxes for daily stand-ups to improve team efficiency
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 mt-2"></div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Backend team's sprint practices could be adopted by other development teams
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-yellow-500 mt-2"></div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Consider increasing QA team capacity or redistributing testing tasks
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Sprint Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Sprint Velocity</span>
                    <span className="text-green-600 dark:text-green-400 font-semibold">↗ +18%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Story Completion</span>
                    <span className="text-green-600 dark:text-green-400 font-semibold">↗ +15.7%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Team Engagement</span>
                    <span className="text-green-600 dark:text-green-400 font-semibold">↗ +7.2%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Project Analytics
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Sprint metrics and team performance insights
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Filters */}
        <FiltersSidebar
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-7xl mx-auto">
            {renderTabContent()}
          </div>
        </div>

        {/* Chat Bubble */}
        <ChatBubble onOpen={() => setIsChatOpen(true)} />

        {/* Analytics Chat */}
        <AnalyticsChat
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </div>
    </Layout>
  );
};

export default Analytics;
