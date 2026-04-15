import React, { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import type { Tag as TagType } from '../../../services/api';

export interface TaskFilters {
  assignee: string | null;
  tags: number[];
  priority: string | null;
  dueDateRange: 'all' | 'overdue' | 'today' | 'week' | 'month';
  sortBy: 'priority' | 'dueDate' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

interface TaskFiltersProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  availableTags: TagType[];
  availableAssignees: string[];
}

const TaskFiltersComponent: React.FC<TaskFiltersProps> = ({
  filters,
  onFiltersChange,
  availableTags,
  availableAssignees,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof TaskFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      assignee: null,
      tags: [],
      priority: null,
      dueDateRange: 'all',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  const toggleTag = (tagId: number) => {
    const newTags = filters.tags.includes(tagId)
      ? filters.tags.filter(id => id !== tagId)
      : [...filters.tags, tagId];
    updateFilter('tags', newTags);
  };

  const activeFiltersCount = [
    filters.assignee,
    filters.tags.length > 0,
    filters.priority,
    filters.dueDateRange !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="relative inline-block">
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 bg-white border-gray-300 text-gray-900 hover:bg-gray-50 dark:bg-slate-800/50 dark:border-slate-700/60 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters</span>
        {activeFiltersCount > 0 && (
          <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
            {activeFiltersCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-[28rem] max-w-[calc(100vw-2rem)] rounded-lg shadow-lg border z-50 max-h-[min(70vh,720px)] overflow-y-auto bg-white border-gray-200 dark:bg-slate-900 dark:border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters & Sort</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3">
              <div className="grid grid-cols-2 gap-4">
                {/* Sort Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-700 dark:text-slate-200">Sort</h4>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter('sortBy', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500/40 focus:border-transparent text-sm bg-white border-gray-300 text-gray-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  >
                    <option value="createdAt">Created</option>
                    <option value="dueDate">Due</option>
                    <option value="priority">Priority</option>
                  </select>

                  <div className="flex gap-2">
                    <button
                      onClick={() => updateFilter('sortOrder', 'asc')}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                        filters.sortOrder === 'asc'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Asc
                    </button>
                    <button
                      onClick={() => updateFilter('sortOrder', 'desc')}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                        filters.sortOrder === 'desc'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Desc
                    </button>
                  </div>
                </div>

                {/* Due Date Filter */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-700 dark:text-slate-200">Due date</h4>
                  <select
                    value={filters.dueDateRange}
                    onChange={(e) => updateFilter('dueDateRange', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500/40 focus:border-transparent text-sm bg-white border-gray-300 text-gray-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  >
                    <option value="all">All</option>
                    <option value="overdue">Overdue</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>

                {/* Priority Filter */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-700 dark:text-slate-200">Priority</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['low', 'medium', 'high', 'urgent'].map((priority) => (
                      <button
                        key={priority}
                        onClick={() =>
                          updateFilter('priority', filters.priority === priority ? null : priority)
                        }
                        className={`px-3 py-2 text-sm rounded-lg capitalize transition-colors ${
                          filters.priority === priority
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assignee Filter */}
                {availableAssignees.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-slate-200">Assignee</h4>
                    <select
                      value={filters.assignee || ''}
                      onChange={(e) => updateFilter('assignee', e.target.value || null)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500/40 focus:border-transparent text-sm bg-white border-gray-300 text-gray-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    >
                      <option value="">All</option>
                      {availableAssignees.map((assignee) => (
                        <option key={assignee} value={assignee}>
                          {assignee}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tags Filter */}
                {availableTags.length > 0 && (
                  <div className="col-span-2 space-y-2">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-slate-200">Tags</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {availableTags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                            filters.tags.includes(tag.id)
                              ? 'bg-purple-50 border-2 border-purple-500 dark:bg-purple-500/10'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-sm text-gray-700 dark:text-slate-200 truncate">
                            {tag.name}
                          </span>
                          {filters.tags.includes(tag.id) && (
                            <span className="ml-auto text-purple-600 dark:text-purple-400">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 dark:border-slate-700 flex gap-2">
              <button
                onClick={clearFilters}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                Clear All
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TaskFiltersComponent;
