import React from 'react';
import type { Task, TaskStatus } from './types';
import UserAvatar from '../../ui/UserAvatar';

interface ListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  sortBy: 'dueDate' | 'createdAt' | 'priority' | 'title';
  sortDirection: 'asc' | 'desc';
}

const ListView: React.FC<ListViewProps> = ({
  tasks,
  onTaskClick,
  sortBy,
  sortDirection,
}) => {

  const getPriorityOrder = (priority: string) => {
    const order = { urgent: 4, high: 3, medium: 2, low: 1 };
    return order[priority as keyof typeof order] || 0;
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'dueDate':
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        comparison = dateA - dateB;
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'priority':
        comparison = getPriorityOrder(b.priority) - getPriorityOrder(a.priority);
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
    }
    
    return sortDirection === 'desc' ? -comparison : comparison;
  });

  const getStatusColor = (status: TaskStatus) => {
    const colors = {
      todo: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return colors[status];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'done';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Desktop Header */}
      <div className="hidden md:block px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
          <div className="col-span-4">Task</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Priority</div>
          <div className="col-span-2">Due Date</div>
          <div className="col-span-2">Assignees</div>
        </div>
      </div>

      {/* Task list */}
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-base sm:text-lg font-medium mb-2">No tasks found</p>
            <p className="text-xs sm:text-sm">Create a new task or adjust your filters</p>
          </div>
        ) : (
          sortedTasks.map((task) => (
            <div
              key={task.id}
              className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
              onClick={() => onTaskClick(task)}
            >
              {/* Mobile Card View */}
              <div className="md:hidden">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2 flex-1 pr-2">
                    {task.title}
                  </h3>
                  <span className={`
                    inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0
                    ${getStatusColor(task.status)}
                  `}>
                    {task.status.replace('-', ' ')}
                  </span>
                </div>
                {task.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ 
                      backgroundColor: `${task.project.color}20`,
                      color: task.project.color,
                      border: `1px solid ${task.project.color}40`
                    }}
                  >
                    {task.project.name}
                  </span>
                  <span className={`
                    inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
                    ${task.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      task.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    }
                  `}>
                    {task.priority}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {task.dueDate && (
                      <span className={`text-xs ${isOverdue(task) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                    {task.assignees.length > 0 && (
                      <div className="flex -space-x-1.5">
                        {task.assignees.slice(0, 3).map((assignee) => (
                          <div key={assignee.id} className="border border-white dark:border-slate-800" title={assignee.name}>
                            <UserAvatar name={assignee.name} profilePictureUrl={assignee.profilePictureUrl} size="xs" />
                          </div>
                        ))}
                        {task.assignees.length > 3 && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">
                            +{task.assignees.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Grid View */}
              <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                {/* Task info */}
                <div className="col-span-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-white text-sm mb-1 line-clamp-1">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
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
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span
                    className={`
                      inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                      ${getStatusColor(task.status)}
                    `}
                  >
                    {task.status.replace('-', ' ')}
                  </span>
                </div>

                {/* Priority */}
                <div className="col-span-2">
                  <span
                    className={`
                      inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                      ${
                        task.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        task.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }
                    `}
                  >
                    {task.priority}
                  </span>
                </div>

                {/* Due date */}
                <div className="col-span-2">
                  {task.dueDate ? (
                    <div className={`
                      text-sm
                      ${isOverdue(task) 
                        ? 'text-red-600 dark:text-red-400 font-medium' 
                        : 'text-slate-600 dark:text-slate-400'
                      }
                    `}>
                      {formatDate(task.dueDate)}
                      {isOverdue(task) && (
                        <span className="block text-xs text-red-500 dark:text-red-400">
                          Overdue
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">
                      No due date
                    </span>
                  )}
                </div>

                {/* Assignees */}
                <div className="col-span-2">
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-2">
                      {task.assignees.slice(0, 3).map((assignee) => (
                        <div
                          key={assignee.id}
                          className="border-2 border-white dark:border-slate-800"
                          title={assignee.name}
                        >
                          <UserAvatar name={assignee.name} profilePictureUrl={assignee.profilePictureUrl} size="xs" />
                        </div>
                      ))}
                    </div>
                    {task.assignees.length > 3 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                        +{task.assignees.length - 3}
                      </span>
                    )}
                    {task.assignees.length === 0 && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ListView;
