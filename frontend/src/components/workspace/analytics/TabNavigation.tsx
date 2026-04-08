import React from 'react';
import type { FilterOptions } from './types';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  className?: string;
}

const TIME_RANGES: { value: FilterOptions['timeRange']; label: string }[] = [
  { value: 'week',    label: '7d' },
  { value: 'month',  label: '30d' },
  { value: 'quarter',label: '90d' },
  { value: 'year',   label: '1y' },
  { value: 'all',    label: 'All' },
];

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: '📊' },
  { id: 'participants', label: 'Participants',  icon: '👥' },
  { id: 'outcomes',     label: 'Outcomes',      icon: '🎯' },
  { id: 'insights',     label: 'Insights',      icon: '💡' },
];

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  filters,
  onFiltersChange,
  className = '',
}) => (
  <div className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 ${className}`}>
    <div className="px-6 flex items-center justify-between">

      {/* Tabs */}
      <nav className="flex space-x-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </span>
          </button>
        ))}
      </nav>

      {/* Time range — far right */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {TIME_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => onFiltersChange({ ...filters, timeRange: r.value })}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              filters.timeRange === r.value
                ? 'bg-purple-600 text-white'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

    </div>
  </div>
);

export default TabNavigation;
