import React from 'react';
import { X, Calendar, Clock, Tag, AlertCircle, ChevronRight, CheckSquare, Square } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority } from '../../components/workspace/taskboard/types';
import UserAvatar from '../../components/ui/UserAvatar';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onPriorityChange: (taskId: string, newPriority: TaskPriority) => void;
}

const statusConfig: Record<TaskStatus, { label: string; color: string; bg: string; border: string }> = {
  'todo':        { label: 'To Do',       color: 'text-slate-600 dark:text-slate-300',     bg: 'bg-slate-100 dark:bg-slate-700',        border: 'border-slate-200 dark:border-slate-600' },
  'in-progress': { label: 'In Progress', color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/30',         border: 'border-blue-200 dark:border-blue-800' },
  'review':      { label: 'Review',      color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-50 dark:bg-violet-900/30',     border: 'border-violet-200 dark:border-violet-800' },
  'done':        { label: 'Done',        color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30',   border: 'border-emerald-200 dark:border-emerald-800' },
};

const priorityConfig: Record<TaskPriority, { label: string; color: string; bg: string; border: string; dot: string }> = {
  low:    { label: 'Low',    color: 'text-sky-600 dark:text-sky-400',       bg: 'bg-sky-50 dark:bg-sky-900/30',      border: 'border-sky-200 dark:border-sky-800',     dot: 'bg-sky-400' },
  medium: { label: 'Medium', color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/30',  border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-400' },
  high:   { label: 'High',   color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30',border: 'border-orange-200 dark:border-orange-800',dot: 'bg-orange-400' },
  urgent: { label: 'Urgent', color: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-50 dark:bg-rose-900/30',    border: 'border-rose-200 dark:border-rose-800',   dot: 'bg-rose-500' },
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onStatusChange,
  onPriorityChange,
}) => {
  if (!isOpen || !task) return null;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
  const completedSubtasks = task.subtasks?.filter((s) => s.status === 'done').length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;
  const subtaskProgress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  const sc = statusConfig[task.status];
  const pc = priorityConfig[task.priority];

  const selectBase =
    'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white transition-colors cursor-pointer';

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
      {children}
    </p>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Top accent bar */}
        <div className="h-0.5 w-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-6 pb-5 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-6">
            {/* Project breadcrumb - only show if task came from a meeting */}
            {task.project && (
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.project.color }} />
                <span className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  {task.project.name}
                </span>
              </div>
            )}

            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug mb-3">
              {task.title}
            </h2>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${sc.bg} ${sc.color} ${sc.border}`}>
                {sc.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${pc.bg} ${pc.color} ${pc.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pc.dot}`} />
                {pc.label}
              </span>
              {isOverdue && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                  <AlertCircle className="w-3 h-3" />
                  Overdue
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left — main content */}
          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">

            {/* Description */}
            <section>
              <SectionLabel>Description</SectionLabel>
              {task.description ? (
                <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-slate-500 italic">No description provided.</p>
              )}
            </section>

            {/* Meeting Context */}
            {task.meetingContext && (
              <section>
                <SectionLabel>Meeting Context</SectionLabel>
                <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/10 overflow-hidden">
                  {/* Meeting header */}
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-violet-100/70 dark:bg-violet-900/30 border-b border-violet-200 dark:border-violet-800">
                    <div className="w-7 h-7 rounded-lg bg-violet-200 dark:bg-violet-800 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-violet-900 dark:text-violet-200">
                      {task.meetingContext.meetingTitle}
                    </span>
                  </div>

                  <div className="px-4 py-4 space-y-4">
                    {task.meetingContext.transcriptSnippet && (
                      <div>
                        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1.5">Transcript</p>
                        <p className="text-sm text-violet-800 dark:text-violet-300 italic leading-relaxed border-l-2 border-violet-300 dark:border-violet-600 pl-3">
                          "{task.meetingContext.transcriptSnippet}"
                        </p>
                      </div>
                    )}

                    {(Array.isArray(task.meetingContext.decisions) && task.meetingContext.decisions.length > 0) && (
                      <div>
                        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1.5">Decisions</p>
                        <ul className="space-y-1.5">
                          {task.meetingContext.decisions.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-violet-800 dark:text-violet-300">
                              <span className="mt-2 w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(Array.isArray(task.meetingContext.notes) && task.meetingContext.notes.length > 0) && (
                      <div>
                        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-1.5">Notes</p>
                        <ul className="space-y-1.5">
                          {task.meetingContext.notes.map((n, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-violet-800 dark:text-violet-300">
                              <span className="mt-2 w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
                              {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                      View full meeting details <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Subtasks */}
            {task.subtasks && task.subtasks.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <SectionLabel>Subtasks</SectionLabel>
                  <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 -mt-2.5">
                    {completedSubtasks} / {totalSubtasks} done
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 w-full bg-gray-100 dark:bg-slate-700 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${subtaskProgress}%` }}
                  />
                </div>

                <div className="space-y-1">
                  {task.subtasks.map((subtask) => {
                    const done = subtask.status === 'done';
                    return (
                      <button
                        key={subtask.id}
                        onClick={() => onStatusChange(subtask.id, done ? 'todo' : 'done')}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors text-left group"
                      >
                        {done
                          ? <CheckSquare className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          : <Square className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-gray-400 dark:group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                        }
                        <span className={`text-sm leading-snug ${done ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200'}`}>
                          {subtask.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Divider */}
          <div className="w-px bg-gray-100 dark:bg-slate-800 flex-shrink-0" />

          {/* Right — sidebar */}
          <div className="w-64 flex-shrink-0 overflow-y-auto px-5 py-6 space-y-6 bg-gray-50/60 dark:bg-slate-900/60">

            {/* Status */}
            <section>
              <SectionLabel>Status</SectionLabel>
              <select
                value={task.status}
                onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
                className={selectBase}
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </section>

            {/* Priority */}
            <section>
              <SectionLabel>Priority</SectionLabel>
              <select
                value={task.priority}
                onChange={(e) => onPriorityChange(task.id, e.target.value as TaskPriority)}
                className={selectBase}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </section>

            {/* Dates */}
            <section>
              <SectionLabel>Dates</SectionLabel>
              <div className="space-y-3">
                {task.dueDate && (
                  <div className="flex items-start gap-2.5">
                    <Calendar className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isOverdue ? 'text-rose-500' : 'text-gray-400 dark:text-slate-500'}`} />
                    <div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 leading-none mb-0.5">Due</p>
                      <p className={`text-xs font-semibold ${isOverdue ? 'text-rose-500' : 'text-gray-800 dark:text-slate-200'}`}>
                        {formatDate(task.dueDate)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <Clock className="w-3.5 h-3.5 mt-0.5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-none mb-0.5">Created</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{formatDate(task.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-3.5 h-3.5 mt-0.5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-none mb-0.5">Updated</p>
                    <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">{formatDate(task.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Time tracking */}
            {(task.estimatedHours || task.actualHours) && (
              <section>
                <SectionLabel>Time</SectionLabel>
                <div className="space-y-2">
                  {task.estimatedHours && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-slate-500">Estimated</span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-slate-200">{task.estimatedHours}h</span>
                    </div>
                  )}
                  {task.actualHours && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-slate-500">Actual</span>
                      <span className={`text-xs font-semibold ${task.estimatedHours && task.actualHours > task.estimatedHours ? 'text-rose-500' : 'text-gray-800 dark:text-slate-200'}`}>
                        {task.actualHours}h
                      </span>
                    </div>
                  )}
                  {task.estimatedHours && task.actualHours && (
                    <div className="h-1 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${task.actualHours > task.estimatedHours ? 'bg-rose-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min((task.actualHours / task.estimatedHours) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Assignees */}
            <section>
              <SectionLabel>Assignees</SectionLabel>
              <div className="space-y-3">
                {task.assignees.map((assignee) => (
                  <div key={assignee.id} className="flex items-center gap-2.5">
                    <UserAvatar name={assignee.name} profilePictureUrl={assignee.profilePictureUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate leading-none mb-0.5">
                        {assignee.name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{assignee.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Tags */}
            {task.tags.length > 0 && (
              <section>
                <SectionLabel>Tags</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                    >
                      <Tag className="w-2.5 h-2.5 text-gray-400" />
                      {tag.name}
                    </span>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;