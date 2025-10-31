import React from 'react';
import { UserPlus, X, AlertCircle } from 'lucide-react';

interface InviteToWorkspaceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userEmail: string;
  userName?: string;
  workspaceName?: string;
  isLoading?: boolean;
}

export default function InviteToWorkspaceConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  userEmail,
  userName,
  workspaceName,
  isLoading = false
}: InviteToWorkspaceConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Invite to Workspace?
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-slate-700 dark:text-slate-300">
            <span className="font-semibold">{userName || userEmail}</span> is not a member of this workspace.
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Would you like to invite them to join the workspace so they can participate in this meeting?
            </p>
          </div>

          <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
            <UserPlus className="w-4 h-4" />
            <span>
              {userName || userEmail} will receive a workspace invitation. Once they accept, you can add them to this meeting by searching for their email again.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-3 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Inviting...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Invite & Add to Meeting</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

