import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import TabNavigation from '../../components/workspace/analytics/TabNavigation';
import StatsCard from '../../components/workspace/analytics/StatsCard';
import LineChart from '../../components/workspace/analytics/LineChart';
import PieChart from '../../components/workspace/analytics/PieChart';
import { useUser } from '../../context/UserContext';
import apiService from '../../services/api';
import type { FilterOptions, TimeSeriesData, ChartDataPoint } from '../../components/workspace/analytics/types';

// ─── tiny helpers ────────────────────────────────────────────────────────────

const pct = (n: number, d: number) =>
  d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%';

const healthColor = (v: number) =>
  v >= 70 ? 'text-emerald-600 dark:text-emerald-400'
  : v >= 40 ? 'text-amber-600 dark:text-amber-400'
  : 'text-red-500 dark:text-red-400';

const sentimentColor = (s: string) => {
  const l = s?.toLowerCase() ?? '';
  if (l.includes('positive')) return 'text-emerald-600 dark:text-emerald-400';
  if (l.includes('negative')) return 'text-red-500 dark:text-red-400';
  return 'text-slate-500 dark:text-slate-400';
};

const sentimentBg = (s: string) => {
  const l = s?.toLowerCase() ?? '';
  if (l.includes('positive')) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  if (l.includes('negative')) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
};

// ─── reusable sub-components ─────────────────────────────────────────────────

const HealthBar: React.FC<{ label: string; value: number; suffix?: string }> = ({ label, value, suffix = '%' }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`text-xs font-semibold ${healthColor(value)}`}>{value.toFixed(0)}{suffix}</span>
    </div>
    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
        }`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  </div>
);

/** Horizontal proportional bar — better than a chart for 3–8 categorical items */
const ProportionList: React.FC<{ items: Array<{ label: string; value: number; color?: string }> }> = ({ items }) => {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return <p className="text-sm text-slate-400 text-center py-4">No data</p>;
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const share = total > 0 ? (item.value / total) * 100 : 0;
        const color = item.color || '#8b5cf6';
        return (
          <div key={i}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{item.label}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{item.value} &nbsp;·&nbsp; {share.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${share}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Topic chip — professional, not JSON */
const TopicChip: React.FC<{ topic: { label: string; mentions: number; sentiment: string } }> = ({ topic }) => (
  <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${sentimentBg(topic.sentiment)} border-transparent`}>
    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
      topic.sentiment?.includes('positive') ? 'bg-emerald-500' :
      topic.sentiment?.includes('negative') ? 'bg-red-500' : 'bg-slate-400'
    }`} />
    <span>{topic.label}</span>
    <span className="opacity-60">·</span>
    <span className="opacity-70">{topic.mentions}×</span>
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const { isAuthenticated, loading, workspaces } = useUser();

  const currentWorkspace = workspaceId
    ? workspaces.find((ws: any) => String(ws.id) === workspaceId)
    : null;

  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<FilterOptions>({ timeRange: 'all' });
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    const fetch = async () => {
      if (!workspaceId) return;
      setIsLoading(true);
      try {
        const res = await apiService.getWorkspaceAnalytics(parseInt(workspaceId), filters.timeRange);
        if (res.data?.analytics) setAnalyticsData(res.data.analytics);
      } catch (e) {
        console.error('Failed to fetch analytics:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [workspaceId, filters.timeRange]);

  // ── derived ─────────────────────────────────────────────────────────────────

  const ad = analyticsData;

  const workspaceActivityData: TimeSeriesData[] = ad?.timeSeriesData || [];

  const completionRatePct = ad?.totalMeetings > 0 ? (ad.completedMeetings / ad.totalMeetings) * 100 : 0;
  const actionRatePct     = ad?.totalActionItems > 0 ? (ad.completedActionItems / ad.totalActionItems) * 100 : 0;
  const efficiencyPct     = ad?.averageDuration > 0 ? Math.max(0, Math.min(100, 100 - (ad.averageDuration - 30) * 1.5)) : 0;
  const aiCoveragePct     = ad?.totalMeetings > 0 ? ((ad.meetingsWithAI || 0) / ad.totalMeetings) * 100 : 0;

  const engagementDistribution: ChartDataPoint[] = ad ? [
    { label: 'Completed',         value: ad.completedMeetings || 0, color: '#10b981' },
    { label: 'Scheduled/Pending', value: (ad.totalMeetings - ad.completedMeetings) || 0, color: '#8b5cf6' },
  ] : [];

  const statsCards = useMemo(() => [
    { title: 'Members',           value: ad?.totalMembers || 0,                                       icon: '👥' },
    { title: 'Total Meetings',    value: ad?.totalMeetings || 0,                                      icon: '📅' },
    { title: 'Completed',         value: ad?.completedMeetings || 0,                                  icon: '✅' },
    { title: 'Tasks on Board',    value: ad?.taskStats?.total || 0,                                   icon: '📌' },
    { title: 'Avg Duration',      value: `${ad?.averageDuration || 0} min`,                           icon: '⏱️' },
    { title: 'Completion Rate',   value: pct(ad?.completedMeetings || 0, ad?.totalMeetings || 0),     icon: '📊' },
    { title: 'Participants',      value: ad?.totalParticipants || 0,                                  icon: '🙋' },
  ], [ad]);

  // ── loading / empty states ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
        </div>
      </Layout>
    );
  }

  // ── tab content ─────────────────────────────────────────────────────────────

  const renderTabContent = () => {
    if (!ad) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
          <span className="text-4xl">📊</span>
          <p className="text-sm">No data yet. Create some meetings to see analytics.</p>
        </div>
      );
    }

    switch (activeTab) {

      // ── OVERVIEW ────────────────────────────────────────────────────────────
      case 'overview':
        return (
          <div className="space-y-5">

            {/* Stats row — 4 per row feels natural, no need to squish 7 in one line */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {statsCards.map((card, i) => <StatsCard key={i} {...card} />)}
            </div>

            {/* Meetings over time */}
            <LineChart
              data={workspaceActivityData}
              title="Meetings Created Over Time"
              xAxisLabel="Date"
              yAxisLabel="Meetings"
              height={240}
            />

            {/* Platform distribution + Meeting status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Meetings by Platform</h3>
                <ProportionList items={ad?.meetingTypesData || []} />
              </div>

              <PieChart
                data={engagementDistribution}
                title="Meeting Status"
                height={240}
              />
            </div>

            {/* Day-of-week distribution */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Activity by Day of Week</h3>
              <ProportionList
                items={(ad?.timePatterns?.daily || []).map((d: any, i: number) => {
                  const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#6366f1'];
                  return { label: d.day.substring(0, 3), value: d.value || 0, color: colors[i % colors.length] };
                })}
              />
            </div>

            {/* Workspace health + Quick facts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Workspace Health</h3>
                <div className="space-y-4">
                  <HealthBar label="Meeting completion rate"         value={completionRatePct} />
                  <HealthBar label="Action item follow-through"      value={actionRatePct} />
                  <HealthBar label="Meeting efficiency (duration)"   value={efficiencyPct} />
                  <HealthBar label="AI insight coverage"             value={aiCoveragePct} />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">At a Glance</h3>
                <div className="space-y-3">
                  {([
                    ['Most active day',       ad?.timePatterns?.peakDay || 'N/A'],
                    ['Avg meeting duration',  `${ad?.averageDuration || 0} min`],
                    ['Tasks on board',        String(ad?.taskStats?.total || 0)],
                    ['Tasks completed',       String(ad?.taskStats?.completedTasks || 0)],
                    ['Decisions logged',      String(ad?.totalDecisions || 0)],
                    ['Topics tracked',        String(ad?.richTopics?.length || 0)],
                    ['AI-processed meetings', `${ad?.meetingsWithAI || 0} of ${ad?.totalMeetings || 0}`],
                    ['Overall tone',          ad?.sentimentData?.total > 0 ? (
                      ad.sentimentData.overall.charAt(0).toUpperCase() + ad.sentimentData.overall.slice(1)
                    ) : 'N/A'],
                  ] as [string, string][]).map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                      <span className="text-slate-500 dark:text-slate-400">{label}</span>
                      <span className={`font-medium ${label === 'Overall tone' ? sentimentColor(val) : 'text-slate-900 dark:text-white'}`}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      // ── PARTICIPANTS ─────────────────────────────────────────────────────────
      case 'participants': {
        const participants: any[] = ad?.topParticipants || [];
        const avgAttendance = participants.length > 0
          ? participants.reduce((s: number, p: any) => s + p.attendanceRate, 0) / participants.length
          : 0;

        // Build a name→task-stats lookup from backend byAssignee data
        const tasksByAssignee: Record<string, { total: number; completed: number; pending: number; overdue: number }> = {};
        (ad?.taskStats?.byAssignee || []).forEach((a: any) => {
          // match by first name or full name (case-insensitive partial match)
          const key = (a.assignee || '').toLowerCase().trim();
          if (key) tasksByAssignee[key] = a;
        });
        const getTasksFor = (name: string) => {
          const lower = (name || '').toLowerCase().trim();
          // exact match first, then partial
          return tasksByAssignee[lower]
            || Object.values(tasksByAssignee).find(a => lower.includes((a as any).assignee?.toLowerCase?.()?.trim?.()) || (a as any).assignee?.toLowerCase?.()?.trim?.()?.includes?.(lower))
            || null;
        };

        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatsCard title="Total Participants"   value={ad?.totalParticipants || 0}  icon="👥" />
              <StatsCard title="Active Contributors"  value={participants.filter(p => p.meetingsAttended > 0).length} icon="✨" />
              <StatsCard title="Avg Attendance Rate"  value={`${avgAttendance.toFixed(0)}%`} icon="📊" />
              <StatsCard
                title="High Performers"
                value={participants.filter(p => p.attendanceRate >= 80).length}
                icon="🏆"
              />
            </div>

            {/* Contributors table — attendance */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Contributors · Attendance</h3>
                <span className="text-xs text-slate-400">{participants.length} people</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/30">
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-6">#</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Person</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Invited</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Attended</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Hosted</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-48">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {participants.length > 0 ? participants.map((p: any, idx: number) => (
                      <tr key={p.userId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-5 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {p.profilePictureUrl ? (
                              <img className="h-8 w-8 rounded-full object-cover" src={p.profilePictureUrl} alt="" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {p.name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                              <p className="text-xs text-slate-400">{p.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{p.totalMeetings}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{p.meetingsAttended}</td>
                        <td className="px-5 py-3">
                          {p.hostedMeetings > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                              {p.hostedMeetings} hosted
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  p.attendanceRate >= 80 ? 'bg-emerald-500' :
                                  p.attendanceRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(p.attendanceRate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-8 text-right">
                              {p.attendanceRate.toFixed(0)}%
                            </span>
                            {p.attendanceRate >= 90 && (
                              <span title="High performer" className="text-amber-500 text-xs">★</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">
                          No participant data yet. Add participants to your meetings.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Contributors table — tasks */}
            {(ad?.taskStats?.total || 0) > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Contributors · Tasks</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Tasks assigned to each person on the Kanban board</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/30">
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Person</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Assigned</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Completed</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Pending</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Overdue</th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-36">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {participants.map((p: any) => {
                        const t = getTasksFor(p.name);
                        if (!t) return null;
                        const compRate = t.total > 0 ? (t.completed / t.total) * 100 : 0;
                        const lateRate = t.total > 0 ? (t.overdue  / t.total) * 100 : 0;
                        return (
                          <tr key={p.userId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {p.name?.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-slate-700 dark:text-slate-300 font-medium">{t.total}</td>
                            <td className="px-5 py-3 text-emerald-600 dark:text-emerald-400 font-medium">{t.completed}</td>
                            <td className="px-5 py-3 text-amber-600 dark:text-amber-400 font-medium">{t.pending}</td>
                            <td className="px-5 py-3">
                              {t.overdue > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                  {t.overdue} late {lateRate > 30 ? '⚠️' : ''}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${compRate >= 70 ? 'bg-emerald-500' : compRate >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                                    style={{ width: `${Math.min(compRate, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-8 text-right">{compRate.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      }).filter(Boolean)}
                      {/* Also show assignees not matched to known participants */}
                      {(ad?.taskStats?.byAssignee || []).filter((a: any) => {
                        const aLower = (a.assignee || '').toLowerCase().trim();
                        return !participants.some((p: any) => {
                          const pLower = (p.name || '').toLowerCase().trim();
                          return pLower === aLower || pLower.includes(aLower) || aLower.includes(pLower);
                        });
                      }).map((a: any, i: number) => {
                        const compRate = a.total > 0 ? (a.completed / a.total) * 100 : 0;
                        const lateRate = a.total > 0 ? (a.overdue  / a.total) * 100 : 0;
                        return (
                          <tr key={`ext-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {(a.assignee || '?').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white">{a.assignee}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-slate-700 dark:text-slate-300 font-medium">{a.total}</td>
                            <td className="px-5 py-3 text-emerald-600 dark:text-emerald-400 font-medium">{a.completed}</td>
                            <td className="px-5 py-3 text-amber-600 dark:text-amber-400 font-medium">{a.pending}</td>
                            <td className="px-5 py-3">
                              {a.overdue > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                                  {a.overdue} late {lateRate > 30 ? '⚠️' : ''}
                                </span>
                              ) : <span className="text-slate-400 text-xs">—</span>}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${compRate >= 70 ? 'bg-emerald-500' : compRate >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                                    style={{ width: `${Math.min(compRate, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-8 text-right">{compRate.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Participation summary */}
            {participants.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Attendance Distribution</h3>
                  <ProportionList items={[
                    { label: 'High (≥80%)',     value: participants.filter(p => p.attendanceRate >= 80).length, color: '#10b981' },
                    { label: 'Medium (50–79%)', value: participants.filter(p => p.attendanceRate >= 50 && p.attendanceRate < 80).length, color: '#f59e0b' },
                    { label: 'Low (<50%)',      value: participants.filter(p => p.attendanceRate < 50).length, color: '#ef4444' },
                  ]} />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Key Observations</h3>
                  <div className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400">
                    {participants[0] && (
                      <p><strong className="text-slate-800 dark:text-slate-200">{participants[0].name}</strong> is the most active, attending {participants[0].meetingsAttended} meeting{participants[0].meetingsAttended !== 1 ? 's' : ''}.</p>
                    )}
                    {participants.filter(p => p.hostedMeetings > 0).length > 0 && (
                      <p>{participants.filter(p => p.hostedMeetings > 0).length} participant(s) have hosted meetings.</p>
                    )}
                    <p>{participants.filter(p => p.attendanceRate >= 80).length} of {participants.length} members maintain ≥80% attendance.</p>
                    {(ad?.taskStats?.overdueTasks || 0) > 0 && (
                      <p className="text-red-600 dark:text-red-400">{ad.taskStats.overdueTasks} task(s) are overdue across the workspace.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }

      // ── OUTCOMES ─────────────────────────────────────────────────────────────
      case 'outcomes': {
        const richTopics: any[] = ad?.richTopics || [];
        const sd = ad?.sentimentData || { positive: 0, neutral: 0, negative: 0, total: 0, overall: 'neutral' };
        const hasSentiment = sd.total > 0;
        const positivePct  = hasSentiment ? (sd.positive / sd.total) * 100 : 0;
        const neutralPct   = hasSentiment ? (sd.neutral  / sd.total) * 100 : 0;
        const negativePct  = hasSentiment ? (sd.negative / sd.total) * 100 : 0;

        // Task stats
        const ts = ad?.taskStats || {};
        const taskTotal       = ts.total        || 0;
        const taskCompleted   = ts.completedTasks || 0;
        const taskPending     = ts.pendingTasks  || 0;
        const taskOverdue     = ts.overdueTasks  || 0;
        const taskFromAI      = ts.tasksFromActionItems || 0;
        const taskByColumn: { name: string; count: number }[] = ts.byColumn   || [];
        const taskByPriority: Record<string, number>          = ts.byPriority || {};
        const priorityOrder  = ['urgent', 'high', 'medium', 'low'];
        const priorityColors: Record<string, string> = {
          urgent: '#ef4444', high: '#f97316', medium: '#3b82f6', low: '#94a3b8',
        };

        // AI action item stats
        const totalAI    = ad?.totalActionItems        || 0;
        const confirmed  = ad?.confirmedActionItems    || 0;
        const rejected   = ad?.rejectedActionItems     || 0;
        const aiPending  = ad?.pendingActionItems      || 0;
        const liveAI     = ad?.liveActionItems         || 0;
        const postAI     = ad?.postMeetingActionItems  || 0;

        return (
          <div className="space-y-5">

            {/* ── Top stats: both action items AND tasks at a glance ─────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatsCard title="AI-Processed Meetings" value={ad?.meetingsWithAI || 0} icon="🤖" />
              <StatsCard title="Decisions Logged"      value={ad?.totalDecisions || 0} icon="🗳️" />
              <StatsCard title="Topics Discussed"      value={richTopics.length}       icon="🏷️" />
            </div>
            {hasSentiment ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Overall Meeting Tone</h3>
                <div className="flex items-center gap-4 mb-5">
                  <div className={`text-3xl font-bold capitalize ${sentimentColor(sd.overall)}`}>{sd.overall}</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Based on AI sentiment analysis of {sd.total} processed meeting{sd.total !== 1 ? 's' : ''}.
                  </p>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3">
                  {positivePct > 0 && <div className="bg-emerald-500 h-full rounded-l" style={{ width: `${positivePct}%` }} />}
                  {neutralPct  > 0 && <div className="bg-slate-400 h-full"             style={{ width: `${neutralPct}%`  }} />}
                  {negativePct > 0 && <div className="bg-red-500 h-full rounded-r"     style={{ width: `${negativePct}%` }} />}
                </div>
                <div className="flex gap-5 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Positive {positivePct.toFixed(0)}% ({sd.positive})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"  />Neutral  {neutralPct.toFixed(0)}%  ({sd.neutral})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"    />Negative {negativePct.toFixed(0)}% ({sd.negative})</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-5 text-center text-slate-400 text-sm">
                <span className="text-2xl block mb-1">🎙️</span>
                Sentiment analysis will appear here once meetings have been AI-processed.
              </div>
            )}

            {richTopics.length > 0 ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recurring Topics</h3>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />positive</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"  />neutral</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"    />negative</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {richTopics.map((t: any, i: number) => <TopicChip key={i} topic={t} />)}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-5 text-center text-slate-400 text-sm">
                <span className="text-2xl block mb-1">🏷️</span>
                Topics will appear here once meetings have been AI-processed.
              </div>
            )}


            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatsCard title="Action Items Identified" value={totalAI}    icon="🔍" />
              <StatsCard title="Confirmed"               value={confirmed}  icon="✅" />
              <StatsCard title="Tasks on Board"          value={taskTotal}  icon="📌" />
              <StatsCard title="Tasks Completed"         value={taskCompleted} icon="🏁"
                changeType={taskTotal > 0 && taskCompleted / taskTotal >= 0.7 ? 'positive' : 'neutral'} />
            </div>

            {/* ── Section 1: Identified Action Items ───────────────────────── */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Identified Action Items</h3>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{totalAI}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Automatically extracted by Kairo AI during and after meetings.
                {liveAI > 0 || postAI > 0 ? (
                  <span className="ml-1">
                    <strong className="text-slate-700 dark:text-slate-300">{liveAI}</strong> from live sessions ·{' '}
                    <strong className="text-slate-700 dark:text-slate-300">{postAI}</strong> from post-meeting analysis.
                  </span>
                ) : null}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Confirmed',        value: confirmed, color: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
                  { label: 'Tasks Created',    value: taskFromAI, color: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-700 dark:text-blue-400' },
                  { label: 'Pending Review',   value: aiPending,  color: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-400' },
                  { label: 'Rejected',         value: rejected,   color: 'bg-slate-100 dark:bg-slate-700',     text: 'text-slate-500 dark:text-slate-400' },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-3 ${item.color}`}>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{item.label}</p>
                    <p className={`text-2xl font-bold ${item.text}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              <ProportionList items={[
                { label: 'Confirmed',      value: confirmed,  color: '#10b981' },
                { label: 'Tasks Created',  value: taskFromAI, color: '#3b82f6' },
                { label: 'Pending Review', value: aiPending,  color: '#f59e0b' },
                { label: 'Rejected',       value: rejected,   color: '#94a3b8' },
              ]} />

              {ad?.totalMeetings > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Avg <strong className="text-slate-700 dark:text-slate-300">
                    {(totalAI / ad.totalMeetings).toFixed(1)}
                  </strong> action items identified per meeting.
                </p>
              )}
            </div>

            {/* Action items identified over time */}
            <LineChart
              data={(ad?.actionItemTrends || []).map((t: any) => ({
                date: t.date, value: t.created, label: t.label,
              }))}
              title="Action Items Identified Over Time"
              xAxisLabel="Date"
              yAxisLabel="Identified"
              height={200}
            />

            {/* ── Section 2: Tasks ──────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tasks</h3>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{taskTotal}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Kanban board tasks.{taskFromAI > 0 ? ` ${taskFromAI} were promoted from confirmed action items.` : ''}
              </p>

              {taskTotal > 0 ? (
                <>
                  {/* Status cards */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Completed', value: taskCompleted, color: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
                      { label: 'Pending',   value: taskPending,   color: 'bg-amber-50 dark:bg-amber-900/20',    text: 'text-amber-700 dark:text-amber-400' },
                      { label: 'Overdue',   value: taskOverdue,   color: taskOverdue > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-100 dark:bg-slate-700', text: taskOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400' },
                    ].map(item => (
                      <div key={item.label} className={`rounded-lg p-3 ${item.color}`}>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{item.label}</p>
                        <p className={`text-2xl font-bold ${item.text}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Completion progress */}
                  {taskTotal > 0 && (
                    <div className="mb-5">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Task completion rate</span>
                        <span className={`text-xs font-semibold ${healthColor((taskCompleted / taskTotal) * 100)}`}>
                          {((taskCompleted / taskTotal) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            taskCompleted / taskTotal >= 0.7 ? 'bg-emerald-500' :
                            taskCompleted / taskTotal >= 0.4 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(taskCompleted / taskTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* By column/status */}
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">By Column</p>
                      <ProportionList items={taskByColumn.map((c, i) => ({
                        label: c.name, value: c.count,
                        color: ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#94a3b8'][i % 5],
                      }))} />
                    </div>

                    {/* By priority */}
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">By Priority</p>
                      <div className="space-y-2.5">
                        {priorityOrder.filter(p => (taskByPriority[p] || 0) > 0).map(p => {
                          const count   = taskByPriority[p] || 0;
                          const barPct  = taskTotal > 0 ? (count / taskTotal) * 100 : 0;
                          return (
                            <div key={p} className="flex items-center gap-3">
                              <span className="text-xs capitalize text-slate-600 dark:text-slate-400 w-14 flex-shrink-0">{p}</span>
                              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${barPct}%`, backgroundColor: priorityColors[p] }} />
                              </div>
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-6 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-slate-400 text-sm">
                  <span className="text-2xl block mb-1">📌</span>
                  No tasks yet. Tasks are created from confirmed action items or added manually from the board.
                </div>
              )}
            </div>

          </div>
        );
      }

      // ── INSIGHTS ─────────────────────────────────────────────────────────────
      case 'insights': {
        const richTopics: any[] = ad?.richTopics || [];
        const sd = ad?.sentimentData || { positive: 0, neutral: 0, negative: 0, total: 0, overall: 'neutral' };

        // Task stats for insight cards
        const insightTs       = ad?.taskStats || {};
        const insightTaskTotal = insightTs.total || 0;
        const insightTaskDone  = insightTs.completedTasks || 0;
        const insightTaskOver  = insightTs.overdueTasks   || 0;
        const insightTaskPct   = insightTaskTotal > 0 ? (insightTaskDone / insightTaskTotal) * 100 : 0;

        // AI accuracy: confirmed / (confirmed + rejected), excludes pending
        const confirmed    = ad?.confirmedActionItems || 0;
        const rejected     = ad?.rejectedActionItems  || 0;
        const reviewed     = confirmed + rejected;
        const aiAccuracyPct = reviewed > 0 ? (confirmed / reviewed) * 100 : null;

        return (
          <div className="space-y-5">

            {/* Insight cards — row 1: meetings, duration, follow-through */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: '📅', label: 'Meetings',
                  border: 'border-blue-400 dark:border-blue-500',
                  bg: 'bg-blue-50 dark:bg-blue-900/10',
                  title: `${ad.completedMeetings} of ${ad.totalMeetings} completed`,
                  body: ad.totalMeetings > 0
                    ? `${((ad.completedMeetings / ad.totalMeetings) * 100).toFixed(0)}% completion. ${
                        ad.completedMeetings / ad.totalMeetings >= 0.8
                          ? 'Your team is reliable about seeing meetings through.'
                          : 'Some meetings are not completing — check for scheduling friction.'
                      }`
                    : 'No meetings recorded yet.',
                },
                {
                  icon: ad.averageDuration > 60 ? '⚠️' : '✅', label: 'Duration',
                  border: ad.averageDuration > 60 ? 'border-amber-400 dark:border-amber-500' : 'border-emerald-400 dark:border-emerald-500',
                  bg: ad.averageDuration > 60 ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-emerald-50 dark:bg-emerald-900/10',
                  title: ad.averageDuration > 60 ? 'Meetings are running long' : 'Meeting length looks good',
                  body: ad.averageDuration > 0
                    ? `Average is ${ad.averageDuration} min. ${
                        ad.averageDuration > 90 ? 'Consider splitting long sessions into focused 45-min blocks.'
                        : ad.averageDuration > 60 ? 'A tight agenda and a clear time-box will help trim this further.'
                        : 'The 15–60 min sweet spot keeps focus and energy high.'
                      }`
                    : 'No duration data yet.',
                },
                {
                  icon: actionRatePct < 50 ? '⚠️' : '✅', label: 'AI Identifications',
                  border: actionRatePct < 50 ? 'border-red-400 dark:border-red-500' : 'border-emerald-400 dark:border-emerald-500',
                  bg: actionRatePct < 50 ? 'bg-red-50 dark:bg-red-900/10' : 'bg-emerald-50 dark:bg-emerald-900/10',
                  title: `${ad.totalActionItems || 0} action items identified`,
                  body: ad.totalActionItems > 0
                    ? `${confirmed} confirmed, ${rejected} rejected out of ${reviewed} reviewed. ${
                        actionRatePct < 50
                          ? 'Review and confirm AI-identified items to move them to the task board.'
                          : 'Good confirmation rate. Keep reviewing items at the end of each meeting.'
                      }`
                    : 'Action items are generated automatically once meetings are AI-processed.',
                },
              ].map((card, i) => (
                <div key={i} className={`border-l-4 rounded-lg p-5 ${card.border} ${card.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{card.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{card.label}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">{card.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>

            {/* Insight cards — row 2: task completion + AI accuracy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Task completion insight */}
              <div className={`border-l-4 rounded-lg p-5 ${
                insightTaskTotal === 0   ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50'
                : insightTaskPct >= 70  ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
                : insightTaskPct >= 40  ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/10'
                :                         'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{insightTaskTotal === 0 ? '📌' : insightTaskPct >= 70 ? '✅' : '⚠️'}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Task Completion</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
                  {insightTaskTotal === 0
                    ? 'No tasks on the board yet'
                    : `${insightTaskDone} of ${insightTaskTotal} tasks completed (${insightTaskPct.toFixed(0)}%)`
                  }
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {insightTaskTotal === 0
                    ? 'Confirm AI-identified action items to automatically create tasks on the board.'
                    : insightTaskOver > 0
                      ? `${insightTaskOver} task${insightTaskOver > 1 ? 's are' : ' is'} overdue. Review and reassign or extend deadlines to keep momentum.`
                      : insightTaskPct >= 70
                        ? 'Strong task completion rate. Your team is following through on commitments.'
                        : 'Task completion is below target. Consider breaking large tasks into smaller steps with clear owners.'
                  }
                </p>
                {insightTaskTotal > 0 && (
                  <div className="mt-3 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${insightTaskPct >= 70 ? 'bg-emerald-500' : insightTaskPct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${insightTaskPct}%` }}
                    />
                  </div>
                )}
              </div>

              {/* AI accuracy insight */}
              <div className={`border-l-4 rounded-lg p-5 ${
                aiAccuracyPct === null  ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50'
                : aiAccuracyPct >= 75  ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
                : aiAccuracyPct >= 50  ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/10'
                :                        'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{aiAccuracyPct === null ? '🤖' : aiAccuracyPct >= 75 ? '🎯' : '🔧'}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">AI Accuracy Estimate</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
                  {aiAccuracyPct === null
                    ? 'No reviewed items yet'
                    : `~${aiAccuracyPct.toFixed(0)}% of reviewed items confirmed`
                  }
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {aiAccuracyPct === null
                    ? `Kairo has identified ${ad?.totalActionItems || 0} action item${(ad?.totalActionItems || 0) !== 1 ? 's' : ''}. Confirm or reject them to build an accuracy picture.`
                    : aiAccuracyPct >= 75
                      ? `The AI is identifying genuine action items with high precision. ${reviewed} item${reviewed !== 1 ? 's' : ''} reviewed so far — keep confirming or rejecting to refine this signal.`
                      : aiAccuracyPct >= 50
                        ? `Moderate accuracy — about half of identified items are relevant. Consider providing clearer meeting agendas to help the AI focus on actionable items.`
                        : `Low confirmation rate suggests the AI may be over-identifying items. More meeting context (agendas, summaries) can improve precision.`
                  }
                </p>
                {aiAccuracyPct !== null && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${aiAccuracyPct >= 75 ? 'bg-emerald-500' : aiAccuracyPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${aiAccuracyPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>{confirmed} confirmed</span>
                      <span>{rejected} rejected</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tone insight */}
            {sd.total > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Meeting Tone Trends</h3>
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="block text-xs text-slate-400 mb-0.5">Overall</span>
                    <span className={`text-base font-bold capitalize ${sentimentColor(sd.overall)}`}>{sd.overall}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 mb-0.5">Positive</span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{sd.positive}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 mb-0.5">Neutral</span>
                    <span className="text-base font-bold text-slate-600 dark:text-slate-300">{sd.neutral}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-400 mb-0.5">Negative</span>
                    <span className="text-base font-bold text-red-500 dark:text-red-400">{sd.negative}</span>
                  </div>
                </div>
                {sd.negative > sd.positive && (
                  <p className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded p-2">
                    More meetings are trending negative than positive. Review recurring topics for sources of friction.
                  </p>
                )}
              </div>
            )}

            {/* Health + Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Workspace Health Score</h3>
                  <span className={`text-lg font-bold ${healthColor((completionRatePct + insightTaskPct + efficiencyPct + aiCoveragePct) / 4)}`}>
                    {((completionRatePct + insightTaskPct + efficiencyPct + aiCoveragePct) / 4).toFixed(0)}<span className="text-xs font-normal text-slate-400"> / 100</span>
                  </span>
                </div>
                <div className="space-y-4">
                  <HealthBar label="Meeting completion"    value={completionRatePct} />
                  <HealthBar label="Task completion rate"  value={insightTaskPct} />
                  <HealthBar label="Meeting efficiency"    value={efficiencyPct} />
                  <HealthBar label="AI insight coverage"   value={aiCoveragePct} />
                  {aiAccuracyPct !== null && (
                    <HealthBar label="AI accuracy estimate" value={aiAccuracyPct} />
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Recommendations</h3>
                <div className="space-y-3 text-sm">
                  {ad.averageDuration > 60 && (
                    <div className="flex gap-2"><span className="text-amber-500 mt-0.5">▲</span>
                      <p className="text-slate-600 dark:text-slate-400">Average meeting is {ad.averageDuration} min. Set a hard stop at 60 min and push remaining items to async.</p>
                    </div>
                  )}
                  {insightTaskOver > 0 && (
                    <div className="flex gap-2"><span className="text-red-500 mt-0.5">▲</span>
                      <p className="text-slate-600 dark:text-slate-400">{insightTaskOver} task{insightTaskOver > 1 ? 's are' : ' is'} overdue. Reassign or update due dates to unblock your team.</p>
                    </div>
                  )}
                  {aiAccuracyPct !== null && aiAccuracyPct < 50 && (
                    <div className="flex gap-2"><span className="text-amber-500 mt-0.5">▲</span>
                      <p className="text-slate-600 dark:text-slate-400">AI confirmation rate is low ({aiAccuracyPct.toFixed(0)}%). Adding agendas and clear discussion topics before meetings will help the AI identify more relevant action items.</p>
                    </div>
                  )}
                  {completionRatePct >= 80 && (
                    <div className="flex gap-2"><span className="text-emerald-500 mt-0.5">●</span>
                      <p className="text-slate-600 dark:text-slate-400">{completionRatePct.toFixed(0)}% meeting completion — your team follows through on scheduled meetings.</p>
                    </div>
                  )}
                  {insightTaskTotal > 0 && insightTaskPct >= 70 && (
                    <div className="flex gap-2"><span className="text-emerald-500 mt-0.5">●</span>
                      <p className="text-slate-600 dark:text-slate-400">{insightTaskPct.toFixed(0)}% of tasks completed — strong execution on board items.</p>
                    </div>
                  )}
                  {(ad?.meetingsWithAI || 0) < (ad?.totalMeetings || 0) && (
                    <div className="flex gap-2"><span className="text-blue-500 mt-0.5">●</span>
                      <p className="text-slate-600 dark:text-slate-400">
                        {(ad.totalMeetings || 0) - (ad.meetingsWithAI || 0)} meeting(s) haven't been AI-processed. Enable live transcription to unlock topics, decisions, and sentiment.
                      </p>
                    </div>
                  )}
                  {richTopics.length > 0 && (
                    <div className="flex gap-2"><span className="text-purple-500 mt-0.5">●</span>
                      <p className="text-slate-600 dark:text-slate-400">
                        Top topic: <strong className="text-slate-800 dark:text-slate-200">{richTopics[0].label}</strong> ({richTopics[0].mentions} mention{richTopics[0].mentions !== 1 ? 's' : ''}, tone: {richTopics[0].sentiment}).
                        {richTopics[0].mentions >= 3 ? ' Consider creating a dedicated project for it.' : ''}
                      </p>
                    </div>
                  )}
                  {!ad.averageDuration && completionRatePct === 0 && insightTaskTotal === 0 && (
                    <p className="text-slate-400 text-center py-4">Complete some meetings to unlock recommendations.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }

      default: return null;
    }
  };

  return (
    <Layout>
      <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
        <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
                {currentWorkspace?.name || 'Workspace'} Analytics
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Meeting metrics and workspace intelligence</p>
            </div>
          </div>
        </div>
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filters={filters}
          onFiltersChange={setFilters}
        />
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-7xl mx-auto">{renderTabContent()}</div>
        </div>
      </div>
    </Layout>
  );
};

export default Analytics;
