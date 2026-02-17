import React from 'react';
import { X, AlignLeft, User, Calendar } from 'lucide-react';
import TagSelector from '../../components/workspace/taskboard/TagSelector';
import type { Tag } from '../../services/api';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: TaskFormData) => Promise<void>;
  columnName: string;
  workspaceId: number;
  isSubmitting: boolean;
}

export interface TaskFormData {
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: Tag[];
}

const priorityConfig = {
  low:    { label: 'Low',    color: 'text-sky-500',    bg: 'bg-sky-50 dark:bg-sky-950/40',     border: 'border-sky-200 dark:border-sky-800' },
  medium: { label: 'Medium', color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' },
  high:   { label: 'High',   color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800' },
  urgent: { label: 'Urgent', color: 'text-rose-500',   bg: 'bg-rose-50 dark:bg-rose-950/40',   border: 'border-rose-200 dark:border-rose-800' },
};

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  columnName,
  workspaceId,
  isSubmitting,
}) => {
  const [formData, setFormData] = React.useState<TaskFormData>({
    title: '',
    description: '',
    assignee: '',
    dueDate: '',
    priority: 'medium',
    tags: [],
  });

  React.useEffect(() => {
    if (!isOpen) {
      setFormData({
        title: '',
        description: '',
        assignee: '',
        dueDate: '',
        priority: 'medium',
        tags: [],
      });
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;
    await onSubmit(formData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  const inputBase =
    'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 transition-colors';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Coloured top bar */}
        <div className="h-1 w-full bg-gradient-to-r from-purple-500 to-violet-600" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
              New Task
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              Adding to <span className="font-medium text-purple-500">{columnName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — two columns */}
        <div className="flex divide-x divide-gray-100 dark:divide-slate-800">

          {/* Left column: core fields */}
          <div className="flex-1 px-5 py-5 space-y-4">

            {/* Title */}
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Task title *"
              className={`${inputBase} text-base font-medium py-2.5`}
              autoFocus
              disabled={isSubmitting}
            />

            {/* Description */}
            <div className="relative">
              <AlignLeft className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add a description…"
                rows={4}
                className={`${inputBase} pl-9 resize-none`}
                disabled={isSubmitting}
              />
            </div>

            {/* Assignee + Due Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={formData.assignee}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  placeholder="Assignee"
                  className={`${inputBase} pl-9`}
                  disabled={isSubmitting}
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className={`${inputBase} pl-9`}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                Priority
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((p) => {
                  const cfg = priorityConfig[p];
                  const isSelected = formData.priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setFormData({ ...formData, priority: p })}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm`
                          : 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column: tags */}
          <div className="w-80 px-5 py-5 flex flex-col">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Tags
            </label>
            <div className="flex-1">
              <TagSelector
                workspaceId={workspaceId}
                selectedTags={formData.tags}
                onTagsChange={(tags) => setFormData({ ...formData, tags })}
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/80">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.title.trim() || isSubmitting}
            className="px-5 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating…
              </>
            ) : (
              'Create Task'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskModal;