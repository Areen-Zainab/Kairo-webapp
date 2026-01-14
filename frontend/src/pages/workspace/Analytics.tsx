import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { useUser } from '../../context/UserContext';
import apiService from '../../services/api';
import type { AnalyticsData, FilterOptions, TimeSeriesData, ChartDataPoint, AnalyticsInsight, MeetingAnalytics } from '../../components/workspace/analytics/types';

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const { isAuthenticated, loading, workspaces } = useUser();
  
  const currentWorkspace = workspaceId 
    ? workspaces.find((ws: any) => String(ws.id) === workspaceId)
    : null;
  const [activeTab, setActiveTab] = useState('overview');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    timeRange: 'all',
    team: undefined,
    meetingType: undefined
  });
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Debug: Log analytics data when it changes
  useEffect(() => {
    if (analyticsData) {
      console.log('📊 Analytics data state updated:', analyticsData);
      console.log('📈 Total Meetings:', analyticsData.totalMeetings);
      console.log('📈 Completed Meetings:', analyticsData.completedMeetings);
      console.log('📈 Total Action Items:', analyticsData.totalActionItems);
    }
  }, [analyticsData]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!workspaceId) return;
      
      setIsLoading(true);
      try {
        const response = await apiService.getWorkspaceAnalytics(
          parseInt(workspaceId),
          filters.timeRange
        );
        
        if (response.data?.analytics) {
          console.log('📊 Analytics data received:', response.data.analytics);
          setAnalyticsData(response.data.analytics);
        } else {
          console.warn('⚠️ No analytics data in response:', response);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [workspaceId, filters.timeRange]);

  // Use real data or fallback to mock data
  const data: AnalyticsData = analyticsData ? {
    totalUsers: analyticsData.totalMembers,
    activeSessions: analyticsData.totalMembers, // TODO: Track active sessions
    completedTasks: analyticsData.completedActionItems,
    meetingsScheduled: analyticsData.totalMeetings,
    meetingsAttended: analyticsData.completedMeetings,
    engagementRate: analyticsData.engagementRate
  } : {
    totalUsers: 0,
    activeSessions: 0,
    completedTasks: 0,
    meetingsScheduled: 0,
    meetingsAttended: 0,
    engagementRate: 0
  };

  const workspaceActivityData: TimeSeriesData[] = analyticsData?.timeSeriesData || [];

  const taskCompletionData: ChartDataPoint[] = analyticsData?.meetingTypesData || [
    { label: 'No data', value: 1, color: '#94a3b8' }
  ];

  const engagementDistribution: ChartDataPoint[] = analyticsData ? [
    { label: 'Completed Meetings', value: analyticsData.completedMeetings || 0, color: '#10b981' },
    { label: 'Pending/Scheduled', value: (analyticsData.totalMeetings - analyticsData.completedMeetings) || 0, color: '#8b5cf6' }
  ] : [
    { label: 'No data', value: 1, color: '#94a3b8' }
  ];

  const meetingAnalytics: MeetingAnalytics = {
    meetingsPerTeam: analyticsData?.meetingTypesData || [],
    attendanceTrends: workspaceActivityData,
    meetingTypesDistribution: analyticsData?.meetingTypesData || [],
    averageDuration: analyticsData?.averageDuration || 0,
    participationByTeam: analyticsData?.meetingTypesData || []
  };

  const insights: AnalyticsInsight[] = analyticsData ? [
    {
      type: 'trend',
      title: `${analyticsData.completedMeetings} Meetings Completed`,
      description: `Out of ${analyticsData.totalMeetings} scheduled meetings, ${analyticsData.completedMeetings} have been completed with ${analyticsData.totalActionItems} action items generated.`,
      priority: 'high',
      icon: '📊'
    },
    {
      type: 'recommendation',
      title: analyticsData.averageDuration > 60 ? 'Consider Shorter Meetings' : 'Good Meeting Duration',
      description: analyticsData.averageDuration > 60 
        ? `Average meeting duration is ${analyticsData.averageDuration} minutes. Consider implementing timeboxes to improve efficiency.`
        : `Average meeting duration of ${analyticsData.averageDuration} minutes is within optimal range for productivity.`,
      priority: 'medium',
      icon: '💡'
    },
    {
      type: analyticsData.completedActionItems < analyticsData.totalActionItems * 0.5 ? 'anomaly' : 'trend',
      title: `${analyticsData.completedActionItems}/${analyticsData.totalActionItems} Action Items Completed`,
      description: analyticsData.completedActionItems < analyticsData.totalActionItems * 0.5
        ? 'Action item completion rate is below 50%. Consider following up on pending tasks more regularly.'
        : 'Action item completion is on track. Keep up the good work with task follow-through.',
      priority: analyticsData.completedActionItems < analyticsData.totalActionItems * 0.5 ? 'high' : 'low',
      icon: analyticsData.completedActionItems < analyticsData.totalActionItems * 0.5 ? '⚠️' : '✅'
    }
  ] : [];

  const statsCards = useMemo(() => [
    {
      title: 'Workspace Members',
      value: data.totalUsers,
      change: 0,
      changeType: 'neutral' as const,
      icon: '👥',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Total Meetings',
      value: data.meetingsScheduled,
      change: 0,
      changeType: 'neutral' as const,
      icon: '📅',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Completed Meetings',
      value: data.meetingsAttended,
      change: 0,
      changeType: 'neutral' as const,
      icon: '✅',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Action Items',
      value: data.completedTasks,
      change: 0,
      changeType: 'neutral' as const,
      icon: '📋',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Avg Meeting Duration',
      value: `${analyticsData?.averageDuration || 0} min`,
      change: 0,
      changeType: 'neutral' as const,
      icon: '⏱️',
      trend: workspaceActivityData.slice(-7)
    },
    {
      title: 'Attendance Rate',
      value: `${data.engagementRate.toFixed(1)}%`,
      change: 0,
      changeType: 'neutral' as const,
      icon: '📊',
      trend: workspaceActivityData.slice(-7)
    }
  ], [data, workspaceActivityData, analyticsData]);

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statsCards.map((card, index) => (
                <StatsCard key={index} {...card} />
              ))}
              <StatsCard
                title="Transcript Coverage"
                value={`${analyticsData?.transcriptCoverage || 0}%`}
                change={0}
                changeType={analyticsData?.transcriptCoverage >= 70 ? 'positive' : 'neutral'}
                icon="📝"
              />
              <StatsCard
                title="Avg Meeting Duration"
                value={`${analyticsData?.averageDuration || 0} min`}
                change={analyticsData?.durationTrend || 0}
                changeType={analyticsData?.durationTrend > 0 ? 'negative' : analyticsData?.durationTrend < 0 ? 'positive' : 'neutral'}
                icon="⏱️"
              />
              <StatsCard
                title="Total Participants"
                value={analyticsData?.totalParticipants || 0}
                change={0}
                changeType="neutral"
                icon="👥"
              />
              <StatsCard
                title="Peak Meeting Time"
                value={analyticsData?.timePatterns?.peakHour || 'N/A'}
                change={0}
                changeType="neutral"
                icon="📅"
              />
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LineChart
                data={workspaceActivityData}
                title="Meetings Created Over Time"
                xAxisLabel="Date"
                yAxisLabel="Meetings"
                height={350}
              />
              <LineChart
                data={(() => {
                  const platformData = analyticsData?.meetingTypesData?.map((d: any) => ({
                    label: d.label,
                    value: d.value,
                    date: d.label
                  }));
                  return platformData && platformData.length > 0 ? platformData : [];
                })()}
                title="Meetings by Platform"
                xAxisLabel="Platform"
                yAxisLabel="Count"
                height={350}
              />
            </div>

            {/* Time Patterns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LineChart
                data={(() => {
                  const hourlyData = analyticsData?.timePatterns?.hourly?.filter((h: any) => h.value > 0).map((h: any) => ({
                    label: h.hour,
                    value: h.value,
                    date: h.hour
                  }));
                  return hourlyData && hourlyData.length > 0 ? hourlyData : [];
                })()}
                title="Meeting Distribution by Hour"
                xAxisLabel="Hour of Day"
                yAxisLabel="Number of Meetings"
                height={350}
              />
              <LineChart
                data={(() => {
                  const dailyData = analyticsData?.timePatterns?.daily?.map((d: any) => ({
                    label: d.day.substring(0, 3),
                    value: d.value || 0,
                    date: d.day.substring(0, 3)
                  }));
                  return dailyData && dailyData.length > 0 ? dailyData : [];
                })()}
                title="Meeting Distribution by Day of Week"
                xAxisLabel="Day"
                yAxisLabel="Number of Meetings"
                height={350}
              />
            </div>

            {/* Engagement Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PieChart
                data={engagementDistribution}
                title="Meeting Status Distribution"
                height={300}
              />
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Key Metrics</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Total Action Items</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{analyticsData?.totalActionItems || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Completed Action Items</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{analyticsData?.completedActionItems || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Meetings with Transcripts</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{analyticsData?.meetingsWithTranscripts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Most Active Day</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{analyticsData?.timePatterns?.peakDay || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'participants':
        return (
          <div className="space-y-8">
            {/* Participant Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard
                title="Total Participants"
                value={analyticsData?.totalParticipants || 0}
                change={0}
                changeType="neutral"
                icon="👥"
              />
              <StatsCard
                title="Active Contributors"
                value={analyticsData?.topParticipants?.filter((p: any) => p.meetingsAttended > 0).length || 0}
                change={0}
                changeType="neutral"
                icon="✨"
              />
              <StatsCard
                title="Avg Attendance Rate"
                value={`${analyticsData?.topParticipants?.length > 0 
                  ? (analyticsData.topParticipants.reduce((sum: number, p: any) => sum + p.attendanceRate, 0) / analyticsData.topParticipants.length).toFixed(1)
                  : 0}%`}
                change={0}
                changeType="neutral"
                icon="📊"
              />
            </div>

            {/* Top Participants Table */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Top Contributors</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Participant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Meetings Invited</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Meetings Attended</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {analyticsData?.topParticipants?.map((participant: any, index: number) => (
                      <tr key={participant.userId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {participant.profilePictureUrl ? (
                                <img className="h-10 w-10 rounded-full" src={participant.profilePictureUrl} alt="" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold">
                                  {participant.name?.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900 dark:text-white">{participant.name}</div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">{participant.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                          {participant.totalMeetings}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                          {participant.meetingsAttended}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${
                                  participant.attendanceRate >= 80 ? 'bg-green-500' :
                                  participant.attendanceRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${participant.attendanceRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-slate-900 dark:text-white">
                              {participant.attendanceRate.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                          No participant data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Engagement Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Engagement Insights</h3>
                <div className="space-y-3">
                  {analyticsData?.topParticipants && analyticsData.topParticipants.length > 0 ? (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-500 mt-2"></div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          <strong>{analyticsData.topParticipants[0]?.name}</strong> is the most active participant with {analyticsData.topParticipants[0]?.meetingsAttended} meetings attended.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-blue-500 mt-2"></div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {analyticsData.topParticipants.filter((p: any) => p.attendanceRate >= 80).length} participants have attendance rates above 80%.
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                      Not enough data yet. Create some meetings to see insights!
                    </p>
                  )}
                </div>
              </div>
              
              <BarChart
                data={(() => {
                  const participantData = analyticsData?.topParticipants?.slice(0, 5).map((p: any) => ({
                    label: p.name.split(' ')[0],
                    value: p.meetingsAttended || 0,
                    color: '#8b5cf6'
                  }));
                  return participantData && participantData.length > 0 ? participantData : [{ label: 'No data', value: 1, color: '#94a3b8' }];
                })()}
                title="Top 5 Most Active Participants"
                xAxisLabel="Participant"
                yAxisLabel="Meetings Attended"
                height={300}
              />
            </div>
          </div>
        );

      case 'action-items':
        return (
          <div className="space-y-8">
            {/* Action Items Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard
                title="Total Action Items"
                value={analyticsData?.totalActionItems || 0}
                change={0}
                changeType="neutral"
                icon="📋"
              />
              <StatsCard
                title="Completed Items"
                value={analyticsData?.completedActionItems || 0}
                change={0}
                changeType="neutral"
                icon="✅"
              />
              <StatsCard
                title="Completion Rate"
                value={`${analyticsData?.totalActionItems > 0 
                  ? ((analyticsData.completedActionItems / analyticsData.totalActionItems) * 100).toFixed(1)
                  : 0}%`}
                change={0}
                changeType={analyticsData?.totalActionItems > 0 && (analyticsData.completedActionItems / analyticsData.totalActionItems) > 0.7 ? 'positive' : 'neutral'}
                icon="📊"
              />
            </div>

            {/* Action Item Trends Over Time */}
            <div className="grid grid-cols-1 gap-6">
              <LineChart
                data={analyticsData?.actionItemTrends?.map((trend: any) => ({
                  date: trend.date,
                  value: trend.created,
                  label: trend.label
                })) || []}
                title="Action Items Created Over Time"
                xAxisLabel="Date"
                yAxisLabel="Items Created"
                height={350}
              />
            </div>

            {/* Action Items Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PieChart
                data={analyticsData ? [
                  { label: 'Completed', value: analyticsData.completedActionItems || 0, color: '#10b981' },
                  { label: 'Pending', value: (analyticsData.totalActionItems - analyticsData.completedActionItems) || 0, color: '#ef4444' }
                ] : [{ label: 'No data', value: 1, color: '#94a3b8' }]}
                title="Action Items Status"
                height={300}
              />
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Action Items Insights</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Items per Meeting</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {analyticsData?.totalMeetings > 0 
                        ? (analyticsData.totalActionItems / analyticsData.totalMeetings).toFixed(1)
                        : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Pending Items</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {analyticsData ? analyticsData.totalActionItems - analyticsData.completedActionItems : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Success Rate</span>
                    <span className={`font-semibold ${analyticsData?.totalActionItems > 0 && (analyticsData.completedActionItems / analyticsData.totalActionItems) > 0.7 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {analyticsData?.totalActionItems > 0 && (analyticsData.completedActionItems / analyticsData.totalActionItems) > 0.7 ? 'High' : analyticsData?.totalActionItems > 0 ? 'Medium' : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'insights':
        return (
          <div className="space-y-8">
            {insights.length > 0 && <SummaryPanel insights={insights} />}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Meeting Recommendations</h3>
                <div className="space-y-3">
                  {analyticsData?.averageDuration > 60 && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-yellow-500 mt-2"></div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Average meeting duration is {analyticsData.averageDuration} minutes. Consider implementing timeboxes to keep meetings focused.
                      </p>
                    </div>
                  )}
                  {analyticsData?.totalActionItems > 0 && analyticsData.completedActionItems / analyticsData.totalActionItems < 0.5 && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-red-500 mt-2"></div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Action item completion rate is below 50%. Consider setting up reminder systems for task follow-up.
                      </p>
                    </div>
                  )}
                  {analyticsData?.totalMeetings > 0 && analyticsData.completedMeetings / analyticsData.totalMeetings > 0.8 && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-green-500 mt-2"></div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Excellent meeting completion rate! {((analyticsData.completedMeetings / analyticsData.totalMeetings) * 100).toFixed(0)}% of scheduled meetings are being completed.
                      </p>
                    </div>
                  )}
                  {(!analyticsData || analyticsData.totalMeetings === 0) && (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      <p className="text-sm">Not enough data yet. Create some meetings to see insights!</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Workspace Health</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Meeting Completion</span>
                    <span className={`font-semibold ${analyticsData?.totalMeetings > 0 && analyticsData.completedMeetings / analyticsData.totalMeetings > 0.7 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {analyticsData?.totalMeetings > 0 ? `${((analyticsData.completedMeetings / analyticsData.totalMeetings) * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Task Follow-Through</span>
                    <span className={`font-semibold ${analyticsData?.totalActionItems > 0 && analyticsData.completedActionItems / analyticsData.totalActionItems > 0.7 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {analyticsData?.totalActionItems > 0 ? `${((analyticsData.completedActionItems / analyticsData.totalActionItems) * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">Avg Meeting Efficiency</span>
                    <span className={`font-semibold ${analyticsData?.averageDuration > 0 && analyticsData.averageDuration < 45 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {analyticsData?.averageDuration > 0 && analyticsData.averageDuration < 45 ? 'Optimal' : analyticsData?.averageDuration > 0 ? 'Could Improve' : 'N/A'}
                    </span>
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
                    {currentWorkspace?.name || 'Workspace'} Analytics
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Meeting metrics and workspace performance insights
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
