import React from 'react';
import type { Task, TaskStatus } from './types';
import { useTheme } from '../../../theme/ThemeProvider';
import UserAvatar from '../../ui/UserAvatar';

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
    
    // Create "start of today" and "due date at midnight" to compare days
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const isDone = task.status === 'done';
    
    if (diffDays < 0) return { text: 'Overdue', urgent: !isDone };
    if (diffDays === 0) return { text: 'Today', urgent: !isDone };
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
      <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2">
        <span
          className={`
            inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium
            ${priorityColors[task.priority]}
          `}
        >
          {task.priority}
        </span>
      </div>

      {/* Task content */}
      <div className="p-2.5 sm:p-3 md:p-4 pr-12 sm:pr-14 md:pr-16">
        {/* Title */}
        <h3 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm mb-1.5 sm:mb-2 line-clamp-2">
          {task.title}
        </h3>

        {/* Description snippet */}
        {task.description && (
          <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 mb-2 sm:mb-3 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-0.5 sm:gap-1 mb-2 sm:mb-3">
            {task.tags.slice(0, 3).map((tagItem: any) => {
              const tag = tagItem.tag || tagItem; // Handle both TaskTag structure and direct Tag
              return (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              );
            })}
            {task.tags.length > 3 && (
              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Assignees */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex items-center gap-1 mb-2 sm:mb-3">
            <div className="flex -space-x-2 mr-2">
              {task.assignees.map((assignee) => (
                <div key={assignee.id} className="border-2 border-white dark:border-slate-800 rounded-full overflow-hidden" title={assignee.name}>
                  <UserAvatar 
                    name={assignee.name} 
                    profilePictureUrl={assignee.profilePictureUrl} 
                    size="xs" 
                  />
                </div>
              ))}
            </div>
            {task.assignee && (
              <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 truncate max-w-[100px]">
                {task.assignee}
              </span>
            )}
          </div>
        )}

        {/* Due date */}
        {dueDateInfo && (
          <div className={`
            flex items-center gap-1 text-[10px] sm:text-xs
            ${dueDateInfo.urgent 
              ? 'text-red-600 dark:text-red-400 font-medium' 
              : 'text-slate-500 dark:text-slate-400'
            }
          `}>
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {dueDateInfo.text}
          </div>
        )}

        {/* Meeting context indicator */}
        {task.meetingContext && (
          <div className="mt-1.5 sm:mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-purple-600 dark:text-purple-400">
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Meeting context</span>
            <span className="sm:hidden">Meeting</span>
          </div>
        )}
      </div>

      {/* Hover actions - Hidden on mobile */}
      <div className="absolute inset-0 bg-slate-50/80 dark:bg-slate-700/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg hidden sm:flex items-center justify-center">
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
