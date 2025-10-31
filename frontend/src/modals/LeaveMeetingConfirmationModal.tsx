import React from 'react';
import { LogOut, X } from 'lucide-react';

interface LeaveMeetingConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  meetingTitle?: string;
  isLoading?: boolean;
}

const LeaveMeetingConfirmationModal: React.FC<LeaveMeetingConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  meetingTitle,
  isLoading = false
}) => {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
    // Don't close here - let the handler manage closing/navigation
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Leave Meeting
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-slate-300 mb-4">
            Are you sure you want to leave this meeting?
          </p>
          {meetingTitle && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                {meetingTitle}
              </p>
            </div>
          )}
          <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-slate-400">
              The bot will automatically close the meeting tab and stop recording.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Leaving...</span>
              </>
            ) : (
              'Leave Meeting'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveMeetingConfirmationModal;

