import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type { Meeting } from './types';

interface MeetingEndedBannerProps {
  endedMeeting?: Meeting;
  onView: () => void;
  onDismiss: () => void;
}

const MeetingEndedBanner: React.FC<MeetingEndedBannerProps> = ({ endedMeeting, onView, onDismiss }) => {
  if (!endedMeeting) return null;

  const handleBannerClick = () => {
    // Navigate to the post-meeting page
    onView();
  };

  return (
    <div 
      onClick={handleBannerClick}
      className="relative rounded-lg p-5 mb-8 overflow-hidden bg-green-50 border border-green-200 dark:bg-gradient-to-r dark:from-green-900/20 dark:via-emerald-900/20 dark:to-green-900/20 dark:border-green-500/30 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="absolute inset-0 hidden dark:block bg-gradient-to-r from-green-600/5 to-emerald-600/5" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-green-700 uppercase tracking-wide dark:text-green-400">Meeting Ended</span>
          </div>
          <div className="h-5 w-px bg-green-200 dark:bg-white/10" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{endedMeeting.title}</h3>
            <p className="text-sm text-gray-600 mt-0.5 dark:text-slate-300">Click to view meeting summary</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="px-4 py-2.5 rounded-md text-sm transition-all bg-white/80 hover:bg-white border border-green-300 text-gray-700 dark:bg-slate-700/50 dark:hover:bg-slate-700 dark:border-green-400/50 dark:text-green-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingEndedBanner;

