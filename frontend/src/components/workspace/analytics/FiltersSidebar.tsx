import React, { useState } from 'react';
import type { FilterOptions } from './types';

interface FiltersSidebarProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  className?: string;
}

const FiltersSidebar: React.FC<FiltersSidebarProps> = ({
  filters,
  onFiltersChange,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const timeRanges = [
    { value: 'all', label: 'All Time' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last 90 Days' },
    { value: 'year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const teams = [
    'All Teams',
    'Engineering',
    'Design',
    'Marketing',
    'Sales',
    'Product',
    'Operations'
  ];

  const meetingTypes = [
    'All Types',
    'Stand-up',
    'Brainstorming',
    'Review',
    'Planning',
    'Retrospective',
    'One-on-One'
  ];

  const handleTimeRangeChange = (timeRange: FilterOptions['timeRange']) => {
    onFiltersChange({
      ...filters,
      timeRange,
      customStartDate: timeRange !== 'custom' ? undefined : filters.customStartDate,
      customEndDate: timeRange !== 'custom' ? undefined : filters.customEndDate
    });
  };

  const handleTeamChange = (team: string) => {
    onFiltersChange({
      ...filters,
      team: team === 'All Teams' ? undefined : team
    });
  };

  const handleMeetingTypeChange = (meetingType: string) => {
    onFiltersChange({
      ...filters,
      meetingType: meetingType === 'All Types' ? undefined : meetingType
    });
  };

  return (
    <div className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 ${className}`}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Filters
          </h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span>{isExpanded ? 'Hide' : 'Show'} Filters</span>
            <svg
              className={`w-4 h-4 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Time Range Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Time Range
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value as FilterOptions['timeRange'])}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {timeRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>

              {filters.timeRange === 'custom' && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={filters.customStartDate || ''}
                      onChange={(e) => onFiltersChange({
                        ...filters,
                        customStartDate: e.target.value
                      })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={filters.customEndDate || ''}
                      onChange={(e) => onFiltersChange({
                        ...filters,
                        customEndDate: e.target.value
                      })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Team Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Team
              </label>
              <select
                value={filters.team || 'All Teams'}
                onChange={(e) => handleTeamChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>

            {/* Meeting Type Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Meeting Type
              </label>
              <select
                value={filters.meetingType || 'All Types'}
                onChange={(e) => handleMeetingTypeChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {meetingTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => onFiltersChange({
                  timeRange: 'all',
                  team: undefined,
                  meetingType: undefined,
                  customStartDate: undefined,
                  customEndDate: undefined
                })}
                className="w-full px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FiltersSidebar;
