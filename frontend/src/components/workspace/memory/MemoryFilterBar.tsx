import React, { useState, useRef, useEffect } from 'react';
import type { MemoryFilter, WorkspaceMemory, NodeType } from './types';

interface MemoryFilterBarProps {
  filters: MemoryFilter;
  onFiltersChange: (filters: MemoryFilter) => void;
  workspaceMemory: WorkspaceMemory;
}

const MemoryFilterBar: React.FC<MemoryFilterBarProps> = ({
  filters,
  onFiltersChange,
  workspaceMemory,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const nodeTypes: { type: NodeType; label: string; color: string; count: number }[] = [
    { type: 'meeting', label: 'Meetings', color: 'bg-blue-500', count: workspaceMemory.meetings },
    { type: 'topic', label: 'Topics', color: 'bg-purple-500', count: workspaceMemory.topics },
    { type: 'decision', label: 'Decisions', color: 'bg-green-500', count: workspaceMemory.decisions },
    { type: 'action', label: 'Actions', color: 'bg-yellow-500', count: workspaceMemory.actions },
    { type: 'member', label: 'Members', color: 'bg-orange-500', count: workspaceMemory.members },
  ];

  const handleSearchChange = (search: string) => {
    onFiltersChange({
      ...filters,
      search: search || undefined,
    });
  };

  const handleNodeTypeToggle = (nodeType: NodeType) => {
    const currentTypes = filters.nodeTypes || [];
    const newTypes = currentTypes.includes(nodeType)
      ? currentTypes.filter(type => type !== nodeType)
      : [...currentTypes, nodeType];
    
    onFiltersChange({
      ...filters,
      nodeTypes: newTypes.length > 0 ? newTypes : undefined,
    });
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value || undefined,
      },
    });
  };

  const handleKeywordAdd = (keyword: string) => {
    if (!keyword.trim()) return;
    
    const currentKeywords = filters.keywords || [];
    if (!currentKeywords.includes(keyword)) {
      onFiltersChange({
        ...filters,
        keywords: [...currentKeywords, keyword],
      });
    }
  };

  const handleKeywordRemove = (keyword: string) => {
    const currentKeywords = filters.keywords || [];
    onFiltersChange({
      ...filters,
      keywords: currentKeywords.filter(k => k !== keyword),
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = () => {
    return !!(
      filters.search ||
      (filters.nodeTypes && filters.nodeTypes.length > 0) ||
      filters.dateRange?.start ||
      filters.dateRange?.end ||
      (filters.keywords && filters.keywords.length > 0)
    );
  };

  return (
    <div className="w-full relative" ref={dropdownRef}>
      {/* Main Search Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search memory graph..."
            className="w-full pl-10 pr-4 py-2 bg-slate-200/50 border border-slate-300/50 rounded-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 dark:bg-slate-700/50 dark:border-slate-600/50 dark:text-white dark:placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters() && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          )}
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-2 bg-slate-200/50 hover:bg-slate-300/50 text-slate-700 hover:text-slate-900 dark:bg-slate-700/50 dark:hover:bg-slate-600/50 dark:text-slate-300 dark:hover:text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
            </svg>
            Filters
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-lg shadow-xl z-20 space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
          {/* Node Type Filters */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Node Types</h3>
            <div className="flex flex-wrap gap-2">
              {nodeTypes.map(({ type, label, color, count }) => (
                <button
                  key={type}
                  onClick={() => handleNodeTypeToggle(type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.nodeTypes?.includes(type)
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-200/50 text-slate-700 hover:bg-slate-300/50 hover:text-slate-900 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-600/50 dark:hover:text-white'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  {label}
                  <span className="text-xs opacity-75">({count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">From Date</label>
              <input
                type="date"
                value={filters.dateRange?.start || ''}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
                className="w-full px-3 py-2 bg-slate-200/50 border border-slate-300/50 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 dark:bg-slate-700/50 dark:border-slate-600/50 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">To Date</label>
              <input
                type="date"
                value={filters.dateRange?.end || ''}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
                className="w-full px-3 py-2 bg-slate-200/50 border border-slate-300/50 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 dark:bg-slate-700/50 dark:border-slate-600/50 dark:text-white"
              />
            </div>
          </div>

          {/* Keywords Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Keywords</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add keyword..."
                  className="flex-1 px-3 py-2 bg-slate-200/50 border border-slate-300/50 rounded-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 dark:bg-slate-700/50 dark:border-slate-600/50 dark:text-white dark:placeholder-slate-400"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleKeywordAdd(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    handleKeywordAdd(input.value);
                    input.value = '';
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
              
              {filters.keywords && filters.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filters.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-300/50 text-slate-700 rounded-md text-sm dark:bg-slate-600/50 dark:text-slate-300"
                    >
                      {keyword}
                      <button
                        onClick={() => handleKeywordRemove(keyword)}
                        className="hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryFilterBar;
