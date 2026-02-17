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
    <div className="relative">
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters</span>
        {activeFiltersCount > 0 && (
          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
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
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[600px] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Filters & Sort</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Sort Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Sort By</h4>
                <div className="space-y-2">
                  <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter('sortBy', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="createdAt">Created Date</option>
                    <option value="dueDate">Due Date</option>
                    <option value="priority">Priority</option>
                  </select>

                  <div className="flex gap-2">
                    <button
                      onClick={() => updateFilter('sortOrder', 'asc')}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                        filters.sortOrder === 'asc'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Ascending
                    </button>
                    <button
                      onClick={() => updateFilter('sortOrder', 'desc')}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                        filters.sortOrder === 'desc'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Descending
                    </button>
                  </div>
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Priority</h4>
                <div className="grid grid-cols-2 gap-2">
                  {['low', 'medium', 'high', 'urgent'].map((priority) => (
                    <button
                      key={priority}
                      onClick={() =>
                        updateFilter('priority', filters.priority === priority ? null : priority)
                      }
                      className={`px-3 py-2 text-sm rounded-lg capitalize transition-colors ${
                        filters.priority === priority
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date Filter */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Due Date</h4>
                <select
                  value={filters.dueDateRange}
                  onChange={(e) => updateFilter('dueDateRange', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">All</option>
                  <option value="overdue">Overdue</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>

              {/* Assignee Filter */}
              {availableAssignees.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Assignee</h4>
                  <select
                    value={filters.assignee || ''}
                    onChange={(e) => updateFilter('assignee', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Tags</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
                          filters.tags.includes(tag.id)
                            ? 'bg-blue-50 border-2 border-blue-500'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm text-gray-700">{tag.name}</span>
                        {filters.tags.includes(tag.id) && (
                          <span className="ml-auto text-blue-600">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={clearFilters}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
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
export type { TaskFilters };
