import React from 'react';
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
  const timeRanges = [
    { value: 'all', label: 'All Time' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last 90 Days' },
    { value: 'year', label: 'Last Year' },
  ];

  const handleTimeRangeChange = (timeRange: FilterOptions['timeRange']) => {
    onFiltersChange({ ...filters, timeRange });
  };

  return (
    <div className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 ${className}`}>
      <div className="px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Time Range:</span>
          <div className="flex gap-2 flex-wrap">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => handleTimeRangeChange(range.value as FilterOptions['timeRange'])}
                className={`px-3 py-1 text-sm transition-colors ${
                  filters.timeRange === range.value
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiltersSidebar;
