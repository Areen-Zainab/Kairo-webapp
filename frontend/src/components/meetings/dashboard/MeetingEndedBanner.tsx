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
      className="relative rounded-lg p-5 mb-8 overflow-hidden bg-green-100 border border-green-400 dark:bg-gradient-to-r dark:from-green-950/70 dark:via-emerald-950/60 dark:to-green-950/70 dark:border-green-700/60 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="absolute inset-0 hidden dark:block bg-gradient-to-r from-green-950/40 to-emerald-950/40" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-400" />
            <span className="text-sm font-semibold text-green-800 uppercase tracking-wide dark:text-green-200">Meeting Ended</span>
          </div>
          <div className="h-5 w-px bg-green-400 dark:bg-green-600/60" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{endedMeeting.title}</h3>
            <p className="text-sm text-gray-600 mt-0.5 dark:text-gray-300">Click to view meeting summary</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="px-4 py-2.5 rounded-md text-sm transition-all bg-white/80 hover:bg-white border border-green-300 text-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-800 dark:border-green-700/50 dark:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingEndedBanner;

