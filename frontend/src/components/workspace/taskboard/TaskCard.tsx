import React from 'react';
import type { Task, TaskPriority, TaskStatus } from './types';
import { useTheme } from '../../../theme/ThemeProvider';

interface TaskCardProps {
  task: Task;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  isDragging?: boolean;
  isOverdue?: boolean;
}

const priorityColors = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const statusColors = {
  todo: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onTaskClick,
  onStatusChange,
  isDragging = false,
  isOverdue = false,
}) => {
  const { theme } = useTheme();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Overdue', urgent: true };
    if (diffDays === 0) return { text: 'Today', urgent: true };
    if (diffDays === 1) return { text: 'Tomorrow', urgent: false };
    if (diffDays <= 7) return { text: `${diffDays} days`, urgent: false };
    return { text: date.toLocaleDateString(), urgent: false };
  };

  const dueDateInfo = formatDate(task.dueDate);

  return (
    <div
      className={`
        group relative bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 
        shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isOverdue ? 'ring-2 ring-red-500/50' : ''}
        hover:border-slate-300 dark:hover:border-slate-600
      `}
      onClick={() => onTaskClick(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTaskClick(task);
        }
      }}
      aria-label={`Task: ${task.title}`}
    >
      {/* Priority indicator */}
      <div className="absolute top-2 right-2">
        <span
          className={`
            inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
            ${priorityColors[task.priority]}
          `}
        >
          {task.priority}
        </span>
      </div>

      {/* Task content */}
      <div className="p-4 pr-16">
        {/* Title */}
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-2 line-clamp-2">
          {task.title}
        </h3>

        {/* Description snippet */}
        {task.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Project and tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          <span
            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
            style={{ 
              backgroundColor: `${task.project.color}20`,
              color: task.project.color,
              border: `1px solid ${task.project.color}40`
            }}
          >
            {task.project.name}
          </span>
          {task.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              {tag.name}
            </span>
          ))}
          {task.tags.length > 2 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              +{task.tags.length - 2}
            </span>
          )}
        </div>

        {/* Assignees */}
        {task.assignees.length > 0 && (
          <div className="flex items-center gap-1 mb-3">
            <div className="flex -space-x-2">
              {task.assignees.slice(0, 3).map((assignee) => (
                <div
                  key={assignee.id}
                  className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-slate-800"
                  title={assignee.name}
                >
                  {assignee.avatar}
                </div>
              ))}
            </div>
            {task.assignees.length > 3 && (
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                +{task.assignees.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Due date */}
        {dueDateInfo && (
          <div className={`
            flex items-center gap-1 text-xs
            ${dueDateInfo.urgent 
              ? 'text-red-600 dark:text-red-400 font-medium' 
              : 'text-slate-500 dark:text-slate-400'
            }
          `}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {dueDateInfo.text}
          </div>
        )}

        {/* Meeting context indicator */}
        {task.meetingContext && (
          <div className="mt-2 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Meeting context
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute inset-0 bg-slate-50/80 dark:bg-slate-700/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
        <div className="flex gap-2">
          <button
            className="px-3 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-xs font-medium shadow-sm hover:shadow-md transition-shadow"
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick(task);
            }}
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
