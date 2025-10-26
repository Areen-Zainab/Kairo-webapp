import React from 'react';
import type { TaskFilter, TaskSort, TaskPriority, TaskStatus } from './types';
import { useTheme } from '../../../theme/ThemeProvider';

interface TaskFiltersProps {
  filters: TaskFilter;
  sort: TaskSort;
  onFiltersChange: (filters: TaskFilter) => void;
  onSortChange: (sort: TaskSort) => void;
  onClearFilters: () => void;
  assignees: Array<{ id: string; name: string; avatar: string }>;
  projects: Array<{ id: string; name: string; color: string }>;
  tags: Array<{ id: string; name: string; color: string }>;
}

const TaskFilters: React.FC<TaskFiltersProps> = ({
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  onClearFilters,
  assignees,
  projects,
  tags,
}) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const priorityOptions: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  const statusOptions: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];

  const handleFilterChange = (key: keyof TaskFilter, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const handleTagToggle = (tagId: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter(id => id !== tagId)
      : [...currentTags, tagId];
    
    handleFilterChange('tags', newTags);
  };

  const hasActiveFilters = () => {
    return !!(
      filters.assignee ||
      filters.priority ||
      filters.status ||
      filters.project ||
      (filters.tags && filters.tags.length > 0) ||
      filters.search ||
      filters.dueDate
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Filters & Sorting
        </h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters() && (
            <button
              onClick={onClearFilters}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
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

      {/* Search */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Search
        </label>
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => handleFilterChange('search', e.target.value)}
          placeholder="Search tasks..."
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Assignee filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Assignee
            </label>
            <select
              value={filters.assignee || ''}
              onChange={(e) => handleFilterChange('assignee', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All assignees</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Priority
            </label>
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map((priority) => (
                <button
                  key={priority}
                  onClick={() => handleFilterChange('priority', filters.priority === priority ? undefined : priority)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium transition-colors
                    ${filters.priority === priority
                      ? priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                        priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }
                  `}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => handleFilterChange('status', filters.status === status ? undefined : status)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium transition-colors
                    ${filters.status === status
                      ? status === 'todo' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' :
                        status === 'in-progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                        status === 'review' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }
                  `}
                >
                  {status.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Project filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Project
            </label>
            <select
              value={filters.project || ''}
              onChange={(e) => handleFilterChange('project', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium transition-colors
                    ${(filters.tags || []).includes(tag.id)
                      ? 'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }
                  `}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Due date filter */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Due from
              </label>
              <input
                type="date"
                value={filters.dueDate?.start || ''}
                onChange={(e) => handleFilterChange('dueDate', {
                  ...filters.dueDate,
                  start: e.target.value || undefined,
                })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Due to
              </label>
              <input
                type="date"
                value={filters.dueDate?.end || ''}
                onChange={(e) => handleFilterChange('dueDate', {
                  ...filters.dueDate,
                  end: e.target.value || undefined,
                })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Sorting */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Sort by
              </label>
              <select
                value={sort.field}
                onChange={(e) => onSortChange({ ...sort, field: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="dueDate">Due Date</option>
                <option value="createdAt">Created Date</option>
                <option value="priority">Priority</option>
                <option value="title">Title</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Direction
              </label>
              <select
                value={sort.direction}
                onChange={(e) => onSortChange({ ...sort, direction: e.target.value as 'asc' | 'desc' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskFilters;
