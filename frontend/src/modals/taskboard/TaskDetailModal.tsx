import React from 'react';
import type { Task, TaskStatus, TaskPriority } from '../../components/workspace/taskboard/types';
import UserAvatar from '../../components/ui/UserAvatar';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onPriorityChange: (taskId: string, newPriority: TaskPriority) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onStatusChange,
  onPriorityChange,
}) => {

  if (!isOpen || !task) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPriorityColor = (priority: TaskPriority) => {
    const colors = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[priority];
  };

  const getStatusColor = (status: TaskStatus) => {
    const colors = {
      todo: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      done: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return colors[status];
  };

  const isOverdue = () => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'done';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {task.title}
              </h2>
              <div className="flex items-center gap-4">
                <span
                  className={`
                    inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                    ${getStatusColor(task.status)}
                  `}
                >
                  {task.status.replace('-', ' ')}
                </span>
                <span
                  className={`
                    inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                    ${getPriorityColor(task.priority)}
                  `}
                >
                  {task.priority}
                </span>
                {isOverdue() && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Overdue
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Description */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                    Description
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                    {task.description || 'No description provided.'}
                  </p>
                </div>

                {/* Meeting Context */}
                {task.meetingContext && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                      Meeting Context
                    </h3>
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium text-purple-900 dark:text-purple-200">
                          {task.meetingContext.meetingTitle}
                        </span>
                      </div>
                      
                      {task.meetingContext.transcriptSnippet && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">
                            Transcript Snippet
                          </h4>
                          <p className="text-sm text-purple-700 dark:text-purple-400 italic">
                            "{task.meetingContext.transcriptSnippet}"
                          </p>
                        </div>
                      )}

                      {task.meetingContext.decisions && task.meetingContext.decisions.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">
                            Decisions
                          </h4>
                          <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                            {task.meetingContext.decisions.map((decision, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-purple-500 dark:text-purple-400">•</span>
                                {decision}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {task.meetingContext.notes && task.meetingContext.notes.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">
                            Notes
                          </h4>
                          <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                            {task.meetingContext.notes.map((note, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-purple-500 dark:text-purple-400">•</span>
                                {note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button className="mt-3 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">
                        View full meeting details →
                      </button>
                    </div>
                  </div>
                )}

                {/* Subtasks */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                      Subtasks ({task.subtasks.length})
                    </h3>
                    <div className="space-y-2">
                      {task.subtasks.map((subtask) => (
                        <div
                          key={subtask.id}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={subtask.status === 'done'}
                            onChange={() => onStatusChange(subtask.id, subtask.status === 'done' ? 'todo' : 'done')}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <span className={`text-sm ${subtask.status === 'done' ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                            {subtask.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <select
                      value={task.status}
                      onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                    <select
                      value={task.priority}
                      onChange={(e) => onPriorityChange(task.id, e.target.value as TaskPriority)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Task Details */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                    Details
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Project
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: task.project.color }}
                        />
                        <span className="text-sm text-slate-900 dark:text-white">
                          {task.project.name}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Due Date
                      </label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Created
                      </label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {formatDate(task.createdAt)}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Last Updated
                      </label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {formatDate(task.updatedAt)}
                      </p>
                    </div>

                    {task.estimatedHours && (
                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Estimated Hours
                        </label>
                        <p className="text-sm text-slate-900 dark:text-white mt-1">
                          {task.estimatedHours}h
                        </p>
                      </div>
                    )}

                    {task.actualHours && (
                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Actual Hours
                        </label>
                        <p className="text-sm text-slate-900 dark:text-white mt-1">
                          {task.actualHours}h
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignees */}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                    Assignees ({task.assignees.length})
                  </h3>
                  <div className="space-y-2">
                    {task.assignees.map((assignee) => (
                      <div key={assignee.id} className="flex items-center gap-3">
                        <UserAvatar name={assignee.name} profilePictureUrl={assignee.profilePictureUrl} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {assignee.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {assignee.role}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                {task.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {task.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
