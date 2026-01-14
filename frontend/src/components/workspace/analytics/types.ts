export interface AnalyticsData {
  totalUsers: number;
  activeSessions: number;
  completedTasks: number;
  meetingsScheduled: number;
  meetingsAttended: number;
  engagementRate: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  label?: string;
}

export interface StatsCardProps {
  title: string;
  value: number | string;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  trend?: TimeSeriesData[];
  className?: string;
}

export interface LineChartProps {
  data: TimeSeriesData[];
  title: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: number;
  className?: string;
}

export interface BarChartProps {
  data: ChartDataPoint[];
  title: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: number;
  className?: string;
}

export interface PieChartProps {
  data: ChartDataPoint[];
  title: string;
  height?: number;
  className?: string;
}

export interface SummaryPanelProps {
  insights: AnalyticsInsight[];
  className?: string;
}

export interface AnalyticsInsight {
  type: 'trend' | 'anomaly' | 'recommendation';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
}

export interface FilterOptions {
  timeRange: 'all' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
  team?: string;
  project?: string;
  meetingType?: string;
}

export interface ChatBubbleProps {
  onOpen: () => void;
  className?: string;
}

export interface AnalyticsChatProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export interface MeetingAnalytics {
  meetingsPerTeam: ChartDataPoint[];
  attendanceTrends: TimeSeriesData[];
  meetingTypesDistribution: ChartDataPoint[];
  averageDuration: number;
  participationByTeam: ChartDataPoint[];
}
