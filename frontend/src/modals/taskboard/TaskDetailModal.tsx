import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Calendar, Clock, AlertCircle, ChevronRight, ChevronDown,
  CheckSquare, Square, Pencil, Check, RotateCcw, Plus, XCircle, Video, VideoOff, Trash2
} from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, TaskTag } from '../../components/workspace/taskboard/types';
import UserAvatar from '../../components/ui/UserAvatar';
import apiService from '../../services/api';
import { useMeetingTaskMention } from '../../hooks/useMeetingTaskMention';

export interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onPriorityChange: (taskId: string, newPriority: TaskPriority) => void;
  onDeleteTask?: (taskId: string) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  workspaceTags?: TaskTag[];
  workspaceId?: number;
  workspaceMembers?: Array<{ id: number; name: string; email: string; profilePictureUrl?: string }>;
}

const statusConfig: Record<TaskStatus, { label: string; color: string; bg: string; border: string }> = {
  'todo':        { label: 'To Do',       color: 'text-slate-600 dark:text-slate-300',     bg: 'bg-slate-100 dark:bg-slate-700',        border: 'border-slate-200 dark:border-slate-600' },
  'in-progress': { label: 'In Progress', color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/30',         border: 'border-blue-200 dark:border-blue-800' },
  'review':      { label: 'Review',      color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-50 dark:bg-violet-900/30',     border: 'border-violet-200 dark:border-violet-800' },
  'done':        { label: 'Complete',    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30',   border: 'border-emerald-200 dark:border-emerald-800' },
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
  onDeleteTask,
  onTaskUpdate,
  workspaceTags = [],
  workspaceMembers = [],
}) => {
  // ── Inline edit state ──────────────────────────────────────────────────────
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editingField, setEditingField] = useState<'title' | 'description' | 'dueDate' | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // ── Tag management state ───────────────────────────────────────────────────
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagLoading, setTagLoading] = useState<number | null>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  // ── Assignee picker state ──────────────────────────────────────────────────
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [savingAssignee, setSavingAssignee] = useState(false);
  const assigneePickerRef = useRef<HTMLDivElement>(null);

  // ── Meeting context collapsible ────────────────────────────────────────────
  const [meetingContextOpen, setMeetingContextOpen] = useState(false);
  const [enrichedMeetingContext, setEnrichedMeetingContext] = useState<Task['meetingContext'] | null>(null);
  const [microChannels, setMicroChannels] = useState<Array<{ contentType: string; count: number }>>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const liveMention = useMeetingTaskMention(
    task?.meetingContext?.meetingId,
    task?.id,
    isOpen && !!task?.meetingContext?.meetingId
  );

  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setEditDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    }
    setEditingField(null);
    setFieldError(null);
    setTagPickerOpen(false);
    setTagSearch('');
    setAssigneePickerOpen(false);
    setAssigneeSearch('');
    setMeetingContextOpen(false);
    setEnrichedMeetingContext(null);
    setMicroChannels([]);
    setContextError(null);
  }, [task?.id, isOpen]);

  useEffect(() => {
    if (!isOpen || !task?.id || !task.meetingContext?.meetingId) {
      setEnrichedMeetingContext(null);
      setMicroChannels([]);
      return;
    }
    let cancelled = false;
    setContextLoading(true);
    setContextError(null);
    apiService.getTaskMeetingContext(parseInt(task.id, 10)).then((res) => {
      if (cancelled) return;
      if (res.error) {
        setContextError(res.error);
        return;
      }
      const payload = res.data as {
        meetingContext?: Task['meetingContext'];
        microChannels?: Array<{ contentType: string; count: number }>;
      } | undefined;
      if (payload?.meetingContext) {
        setEnrichedMeetingContext(payload.meetingContext);
      }
      if (payload?.microChannels) {
        setMicroChannels(payload.microChannels);
      }
    }).finally(() => {
      if (!cancelled) setContextLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, task?.id, task?.meetingContext?.meetingId]);

  useEffect(() => {
    if (editingField === 'title') titleInputRef.current?.focus();
    if (editingField === 'description') descriptionRef.current?.focus();
  }, [editingField]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setTagPickerOpen(false);
        setTagSearch('');
      }
    };
    if (tagPickerOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tagPickerOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (assigneePickerRef.current && !assigneePickerRef.current.contains(e.target as Node)) {
        setAssigneePickerOpen(false);
        setAssigneeSearch('');
      }
    };
    if (assigneePickerOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assigneePickerOpen]);

  // ── Field save ─────────────────────────────────────────────────────────────
  const saveField = useCallback(async (
    field: 'title' | 'description' | 'dueDate',
    value: string
  ) => {
    if (!task) return;
    const trimmed = value.trim();
    const original =
      field === 'title' ? task.title :
      field === 'description' ? (task.description || '') :
      (task.dueDate ? task.dueDate.split('T')[0] : '');

    if (trimmed === original) { setEditingField(null); return; }
    if (field === 'title' && !trimmed) { setFieldError('Title cannot be empty'); return; }

    setSavingField(field);
    setFieldError(null);

    const optimisticUpdates: Partial<Task> = {
      [field]: field === 'dueDate'
        ? (trimmed ? `${trimmed}T00:00:00.000Z` : null)
        : trimmed || undefined,
      updatedAt: new Date().toISOString(),
    };
    onTaskUpdate?.(task.id, optimisticUpdates);

    try {
      const payload: Record<string, string | null | undefined> = {};
      if (field === 'title') payload.title = trimmed;
      if (field === 'description') payload.description = trimmed || undefined;
      if (field === 'dueDate') payload.dueDate = trimmed || undefined;

      const response = await apiService.updateTask(parseInt(task.id), payload as any);
      if (response.error) {
        onTaskUpdate?.(task.id, { [field]: original || undefined });
        setFieldError(response.error);
      } else {
        setEditingField(null);
      }
    } catch (err: any) {
      onTaskUpdate?.(task.id, { [field]: original || undefined });
      setFieldError(err.message || 'Failed to save');
    } finally {
      setSavingField(null);
    }
  }, [task, onTaskUpdate]);

  const cancelEdit = useCallback(() => {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    setEditingField(null);
    setFieldError(null);
  }, [task]);

  const handleKeyDown = useCallback((
    e: React.KeyboardEvent,
    field: 'title' | 'description' | 'dueDate',
    value: string
  ) => {
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    if (e.key === 'Enter' && (field !== 'description' || e.ctrlKey)) {
      e.preventDefault();
      saveField(field, value);
    }
  }, [cancelEdit, saveField]);

  // ── Tag toggle ─────────────────────────────────────────────────────────────
  const currentTagIds = new Set((task?.tags ?? []).map((t: any) => {
    const tag = t.tag || t;
    return Number(tag.id);
  }));

  const handleTagToggle = async (wsTag: TaskTag) => {
    if (!task) return;
    const tagId = Number(wsTag.id);
    setTagLoading(tagId);

    const hasTag = currentTagIds.has(tagId);
    try {
      if (hasTag) {
        await apiService.removeTagFromTask(parseInt(task.id), tagId);
        onTaskUpdate?.(task.id, {
          tags: task.tags.filter((t: any) => Number((t.tag || t).id) !== tagId),
        });
      } else {
        await apiService.assignTagToTask(parseInt(task.id), tagId);
        onTaskUpdate?.(task.id, {
          tags: [...task.tags, wsTag],
        });
      }
    } catch {
      // silently ignore
    } finally {
      setTagLoading(null);
    }
  };

  // ── Assignee select ────────────────────────────────────────────────────────
  const selectMember = async (member: { id: number; name: string; email: string; profilePictureUrl?: string } | null) => {
    if (!task) return;
    const newName = member?.name ?? '';
    const original = task.assignee || '';
    if (newName === original) { setAssigneePickerOpen(false); return; }

    setSavingAssignee(true);
    // Optimistic update
    onTaskUpdate?.(task.id, {
      assignee: newName || undefined,
      assignees: member ? [{
        id: String(member.id),
        name: member.name,
        email: member.email,
        avatar: member.name.slice(0, 2).toUpperCase(),
        profilePictureUrl: member.profilePictureUrl,
        role: 'member',
      }] : [],
      updatedAt: new Date().toISOString(),
    });
    setAssigneePickerOpen(false);
    setAssigneeSearch('');

    try {
      const response = await apiService.updateTask(parseInt(task.id), { assignee: newName || undefined } as any);
      if (response.error) {
        // Revert
        onTaskUpdate?.(task.id, { assignee: original || undefined });
      }
    } catch {
      onTaskUpdate?.(task.id, { assignee: original || undefined });
    } finally {
      setSavingAssignee(false);
    }
  };

  if (!isOpen || !task) return null;

  const formatDateShort = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
  const completedSubtasks = task.subtasks?.filter((s) => s.status === 'done').length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;
  const subtaskProgress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  const sc = statusConfig[task.status];
  const pc = priorityConfig[task.priority];

  const filteredWsTags = workspaceTags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  const filteredMembers = workspaceMembers.filter((m) =>
    m.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
    m.email.toLowerCase().includes(assigneeSearch.toLowerCase())
  );

  const displayMeetingContext = enrichedMeetingContext ?? task.meetingContext;

  // ── Sub-components ─────────────────────────────────────────────────────────

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-[0.1em] mb-2">
      {children}
    </p>
  );

  const SaveCancelButtons = ({
    field, value,
  }: { field: 'title' | 'description' | 'dueDate'; value: string }) => (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={() => saveField(field, value)}
        disabled={!!savingField}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-all shadow-sm"
      >
        <Check className="w-3 h-3" />
        {savingField === field ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={cancelEdit}
        disabled={!!savingField}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-all"
      >
        <RotateCcw className="w-3 h-3" />
        Cancel
      </button>
      {fieldError && editingField === field && (
        <span className="text-xs text-rose-500">{fieldError}</span>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal shell */}
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col ring-1 ring-black/10 dark:ring-white/5">

        {/* Accent bar */}
        <div className="h-px w-full bg-gradient-to-r from-purple-500 via-violet-400 to-indigo-500 flex-shrink-0" />

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-slate-800">
          {/* Breadcrumb */}
          {task.project && (
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: task.project.color }}
              />
              <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                {task.project.name}
              </span>
            </div>
          )}

          <div className="flex items-start gap-4">
            {/* Title + badges */}
            <div className="flex-1 min-w-0">
              {editingField === 'title' ? (
                <div>
                  <input
                    ref={titleInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'title', editTitle)}
                    className="w-full text-xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-purple-500 focus:outline-none pb-1 leading-tight"
                    maxLength={200}
                  />
                  <SaveCancelButtons field="title" value={editTitle} />
                </div>
              ) : (
                <h2
                  className="group text-xl font-bold text-gray-900 dark:text-white leading-tight cursor-pointer hover:text-purple-700 dark:hover:text-purple-300 transition-colors flex items-start gap-2 mb-3"
                  onClick={() => setEditingField('title')}
                  title="Click to edit title"
                >
                  <span className="flex-1">{task.title}</span>
                  <Pencil className="w-4 h-4 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1.5 flex-shrink-0" />
                </h2>
              )}

              {/* Status + Priority + Overdue badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${sc.bg} ${sc.color} ${sc.border}`}>
                  {sc.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${pc.bg} ${pc.color} ${pc.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pc.dot}`} />
                  {pc.label}
                </span>
                {isOverdue && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                    <AlertCircle className="w-3 h-3" />
                    Overdue
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 -mt-1">
              {onDeleteTask && (
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this task?')) {
                      onDeleteTask(task.id);
                    }
                  }}
                  className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                  title="Delete task"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Left: main content ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-w-0">

            {/* Description */}
            <section>
              <SectionLabel>Description</SectionLabel>
              {editingField === 'description' ? (
                <div>
                  <textarea
                    ref={descriptionRef}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'description', editDescription)}
                    rows={6}
                    placeholder="Add a description…"
                    className="w-full text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all leading-relaxed"
                  />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5 mb-1">Ctrl+Enter to save · Esc to cancel</p>
                  <SaveCancelButtons field="description" value={editDescription} />
                </div>
              ) : (
                <div
                  className="group cursor-pointer rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all px-4 py-3 -mx-4 -my-3 relative"
                  onClick={() => setEditingField('description')}
                  title="Click to edit description"
                >
                  {task.description ? (
                    <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {task.description}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-slate-500 italic">
                      No description — click to add one.
                    </p>
                  )}
                  <Pencil className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3" />
                </div>
              )}
            </section>

            {/* Subtasks */}
            {task.subtasks && task.subtasks.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel>Subtasks</SectionLabel>
                  <span className="text-xs font-bold text-gray-400 dark:text-slate-500 -mt-3">
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 w-full bg-gray-100 dark:bg-slate-800 rounded-full mb-2.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all duration-700"
                    style={{ width: `${subtaskProgress}%` }}
                  />
                </div>

                <div className="space-y-0.5">
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
                          : <Square className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-purple-400 flex-shrink-0 transition-colors" />
                        }
                        <span className={`text-sm leading-snug transition-colors ${done ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200'}`}>
                          {subtask.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Meeting Context ── */}
            <section>
              <button
                onClick={() => setMeetingContextOpen((o) => !o)}
                className="w-full flex items-center justify-between group py-1"
              >
                <div className="flex items-center gap-2.5">
                  {displayMeetingContext
                    ? <Video className="w-4 h-4 text-violet-500" />
                    : <VideoOff className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                  }
                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-[0.1em]">
                    Meeting Context
                  </span>
                  {displayMeetingContext && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                      Linked
                    </span>
                  )}
                  {contextLoading && (
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">Loading…</span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 dark:text-slate-500 transition-transform duration-200 ${meetingContextOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {meetingContextOpen && (
                <div className="mt-4">
                  {liveMention && (
                    <div className="mb-3 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 text-sm text-amber-900 dark:text-amber-100">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">Live mention</p>
                      <p className="leading-snug">This task was just referenced in the live transcript.</p>
                      {liveMention.snippet ? (
                        <p className="mt-2 text-xs opacity-90 italic border-l-2 border-amber-400 pl-2">"{liveMention.snippet}"</p>
                      ) : null}
                    </div>
                  )}
                  {contextError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mb-2">{contextError}</p>
                  )}
                  {displayMeetingContext ? (
                    <div className="rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/60 dark:bg-violet-900/10 overflow-hidden">
                      {/* Meeting header */}
                      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-violet-200/60 dark:border-violet-800/40">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center flex-shrink-0">
                          <Video className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <span className="text-sm font-bold text-violet-900 dark:text-violet-200">
                          {displayMeetingContext.meetingTitle}
                        </span>
                      </div>
                      {microChannels.length > 0 && (
                        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-violet-200/40 dark:border-violet-800/30 bg-violet-100/30 dark:bg-violet-950/20">
                          <span className="text-[10px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-wider mr-1">Memory channels</span>
                          {microChannels.map((ch) => (
                            <span
                              key={ch.contentType}
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-slate-800/80 text-violet-700 dark:text-violet-300"
                            >
                              {ch.contentType.replace(/_/g, ' ')} · {ch.count}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Meeting body */}
                      <div className="px-4 py-3 space-y-3.5">
                        {displayMeetingContext.summaryExcerpt && (
                          <div>
                            <p className="text-[10px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-widest mb-2">Summary</p>
                            <p className="text-sm text-violet-800 dark:text-violet-300 leading-relaxed">
                              {displayMeetingContext.summaryExcerpt}
                            </p>
                          </div>
                        )}
                        {displayMeetingContext.transcriptSnippet && (
                          <div>
                            <p className="text-[10px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-widest mb-2">Transcript</p>
                            <p className="text-sm text-violet-800 dark:text-violet-300 italic leading-relaxed border-l-2 border-violet-300 dark:border-violet-600 pl-4">
                              "{displayMeetingContext.transcriptSnippet}"
                            </p>
                          </div>
                        )}
                        {Array.isArray(displayMeetingContext.decisions) && displayMeetingContext.decisions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-widest mb-2">Decisions</p>
                            <ul className="space-y-2">
                              {displayMeetingContext.decisions.map((d, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-violet-800 dark:text-violet-300">
                                  <span className="mt-2 w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {Array.isArray(displayMeetingContext.notes) && displayMeetingContext.notes.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-widest mb-2">Notes</p>
                            <ul className="space-y-2">
                              {displayMeetingContext.notes.map((n, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-violet-800 dark:text-violet-300">
                                  <span className="mt-2 w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
                                  {n}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button type="button" className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                          View full meeting <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40">
                      <VideoOff className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        No meeting context — this task was created manually.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ── Divider ── */}
          <div className="w-px bg-gray-100 dark:bg-slate-800 flex-shrink-0" />

          {/* ── Right: sidebar ── */}
          <div className="w-64 flex-shrink-0 overflow-y-auto bg-gray-50/40 dark:bg-slate-900/40 px-5 py-5 space-y-5">

            {/* Status + Priority in a 2-col grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <SectionLabel>Status</SectionLabel>
                <select
                  value={task.status}
                  onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 text-xs font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white transition-all cursor-pointer"
                >
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Complete</option>
                </select>
              </div>
              <div>
                <SectionLabel>Priority</SectionLabel>
                <select
                  value={task.priority}
                  onChange={(e) => onPriorityChange(task.id, e.target.value as TaskPriority)}
                  className="w-full px-3 py-2 text-xs font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white transition-all cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-100 dark:bg-slate-800" />

            {/* Assignee */}
            <section>
              <SectionLabel>Assignee</SectionLabel>
              <div className="relative" ref={assigneePickerRef}>
                {/* Current assignee display — click to open picker */}
                <button
                  onClick={() => { setAssigneePickerOpen((o) => !o); setAssigneeSearch(''); }}
                  disabled={savingAssignee}
                  className="w-full flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-left disabled:opacity-50"
                  title="Click to change assignee"
                >
                  {task.assignees.length > 0 ? (
                    <>
                      <UserAvatar
                        name={task.assignees[0].name}
                        profilePictureUrl={task.assignees[0].profilePictureUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-800 dark:text-slate-200 truncate leading-none mb-0.5">
                          {task.assignees[0].name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                          {task.assignees[0].email || task.assignees[0].role}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                        <Plus className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 italic">
                        {savingAssignee ? 'Saving…' : 'Unassigned — click to assign'}
                      </p>
                    </>
                  )}
                  <Pencil className="w-3 h-3 text-gray-300 dark:text-slate-600 flex-shrink-0 ml-auto" />
                </button>

                {/* Member picker dropdown */}
                {assigneePickerOpen && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                    <div className="p-2 border-b border-gray-100 dark:border-slate-700">
                      <input
                        autoFocus
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        placeholder="Search members…"
                        className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                      {/* Unassign option */}
                      {task.assignees.length > 0 && (
                        <button
                          onClick={() => selectMember(null)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                            <XCircle className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-slate-400 italic">Remove assignee</span>
                        </button>
                      )}
                      {filteredMembers.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500">No members found</p>
                      ) : (
                        filteredMembers.map((member) => {
                          const isSelected = task.assignee === member.name;
                          return (
                            <button
                              key={member.id}
                              onClick={() => selectMember(member)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors"
                            >
                              <UserAvatar
                                name={member.name}
                                profilePictureUrl={member.profilePictureUrl}
                                size="xs"
                              />
                              <div className="min-w-0 flex-1 text-left">
                                <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate leading-none mb-0.5">
                                  {member.name}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{member.email}</p>
                              </div>
                              {isSelected && <Check className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Divider */}
            <div className="h-px bg-gray-100 dark:bg-slate-800" />

            {/* Dates */}
            <section>
              <SectionLabel>Dates</SectionLabel>
              <div className="space-y-1.5">
                {/* Due date */}
                <div>
                  {editingField === 'dueDate' ? (
                    <div>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'dueDate', editDueDate)}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white"
                      />
                      <SaveCancelButtons field="dueDate" value={editDueDate} />
                    </div>
                  ) : (
                    <div
                      className="group flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                      onClick={() => setEditingField('dueDate')}
                      title="Click to edit due date"
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-gray-100 dark:bg-slate-800'}`}>
                        <Calendar className={`w-3 h-3 ${isOverdue ? 'text-rose-500' : 'text-gray-400 dark:text-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide leading-none mb-0.5">Due</p>
                        {task.dueDate ? (
                          <p className={`text-xs font-bold ${isOverdue ? 'text-rose-500' : 'text-gray-800 dark:text-slate-200'}`}>
                            {formatDateShort(task.dueDate)}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-slate-500 italic">Not set</p>
                        )}
                      </div>
                      <Pencil className="w-3 h-3 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2.5 p-1.5 -mx-1.5">
                  <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide leading-none mb-0.5">Created</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-200">{formatDateShort(task.createdAt)}</p>
                  </div>
                </div>

                {/* Updated */}
                <div className="flex items-center gap-2.5 p-1.5 -mx-1.5">
                  <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide leading-none mb-0.5">Updated</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-slate-200">{formatDateShort(task.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Time tracking */}
            {(task.estimatedHours || task.actualHours) && (
              <>
                <div className="h-px bg-gray-100 dark:bg-slate-800" />
                <section>
                  <SectionLabel>Time Tracking</SectionLabel>
                  <div className="space-y-2.5">
                    {task.estimatedHours && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 dark:text-slate-500">Estimated</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-slate-200">{task.estimatedHours}h</span>
                      </div>
                    )}
                    {task.actualHours && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 dark:text-slate-500">Actual</span>
                        <span className={`text-xs font-bold ${task.estimatedHours && task.actualHours > task.estimatedHours ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {task.actualHours}h
                        </span>
                      </div>
                    )}
                    {task.estimatedHours && task.actualHours && (
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${task.actualHours > task.estimatedHours ? 'bg-rose-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min((task.actualHours / task.estimatedHours) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* Divider */}
            <div className="h-px bg-gray-100 dark:bg-slate-800" />

            {/* Tags */}
            <section>
              <SectionLabel>Tags</SectionLabel>

              {/* Current tags */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {task.tags.length > 0 ? (
                  task.tags.map((tagItem: any) => {
                    const tag = tagItem.tag || tagItem;
                    return (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                        style={{ backgroundColor: tag.color || '#6366f1' }}
                      >
                        {tag.name}
                        <button
                          onClick={() => handleTagToggle({ id: String(tag.id), name: tag.name, color: tag.color })}
                          disabled={tagLoading === Number(tag.id)}
                          className="rounded-full hover:bg-black/20 p-0.5 transition-colors disabled:opacity-50"
                          title={`Remove tag "${tag.name}"`}
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-400 dark:text-slate-500 italic">No tags assigned.</p>
                )}
              </div>

              {/* Tag picker */}
              <div className="relative" ref={tagPickerRef}>
                <button
                  onClick={() => setTagPickerOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-purple-400 hover:text-purple-600 dark:hover:border-purple-500 dark:hover:text-purple-400 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  Add tag
                </button>

                {tagPickerOpen && (
                  <div className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                    <div className="p-2.5 border-b border-gray-100 dark:border-slate-700">
                      <input
                        autoFocus
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search tags…"
                        className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto py-1">
                      {filteredWsTags.length === 0 ? (
                        <p className="px-3 py-2.5 text-xs text-gray-400 dark:text-slate-500">No tags found</p>
                      ) : (
                        filteredWsTags.map((wsTag) => {
                          const assigned = currentTagIds.has(Number(wsTag.id));
                          const loading = tagLoading === Number(wsTag.id);
                          return (
                            <button
                              key={wsTag.id}
                              onClick={() => handleTagToggle(wsTag)}
                              disabled={loading}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: wsTag.color || '#6366f1' }}
                              />
                              <span className="text-xs text-gray-800 dark:text-slate-200 flex-1 text-left font-medium">{wsTag.name}</span>
                              {assigned && <Check className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;