import { X } from 'lucide-react';

interface JoinWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinWorkspaceModal({ isOpen, onClose }: JoinWorkspaceModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Join Workspace</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors hover:bg-gray-100 text-gray-600 dark:hover:bg-slate-700 dark:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Invitation Code</label>
            <input
              type="text"
              placeholder="ALPHA-2025-XYZ"
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 text-gray-900 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            />
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded p-3 dark:bg-purple-500/10 dark:border-purple-500/30">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              <strong>Tip:</strong> Ask your team admin for an invitation code
            </p>
          </div>

          <div className="flex gap-2 pt-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded font-medium text-gray-900 border border-gray-300 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white dark:border-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 rounded font-medium text-white hover:shadow-lg hover:shadow-purple-500/30 transition-all"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


