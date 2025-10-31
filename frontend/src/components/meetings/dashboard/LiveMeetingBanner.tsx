import React from 'react';
import { Circle } from 'lucide-react';
import type { Meeting } from './types';

interface LiveMeetingBannerProps {
  liveMeeting?: Meeting;
  onJoin: () => void;
  onDismiss: () => void;
}

const LiveMeetingBanner: React.FC<LiveMeetingBannerProps> = ({ liveMeeting, onJoin, onDismiss }) => {
  if (!liveMeeting) return null;

  const handleJoinNow = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click
    if (liveMeeting.meetingLink) {
      // Open the meeting link in the same tab/window
      window.location.href = liveMeeting.meetingLink;
    } else {
      // If no meeting link, navigate to the live meeting page
      onJoin();
    }
  };

  const handleBannerClick = () => {
    // Navigate to the live meeting page
    onJoin();
  };

  return (
    <div 
      onClick={handleBannerClick}
      className="relative rounded-lg p-5 mb-8 overflow-hidden bg-red-100 border border-red-400 dark:bg-gradient-to-r dark:from-red-950/70 dark:via-red-950/60 dark:to-red-950/70 dark:border-red-700/60 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="absolute inset-0 hidden dark:block bg-gradient-to-r from-red-950/40 to-pink-950/40" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Circle className="w-2.5 h-2.5 fill-red-700 text-red-700 animate-pulse dark:fill-red-400 dark:text-red-400" />
            <span className="text-sm font-semibold text-red-800 uppercase tracking-wide dark:text-red-200">Live Now</span>
          </div>
          <div className="h-5 w-px bg-red-400 dark:bg-red-600/60" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{liveMeeting.title}</h3>
            <p className="text-sm text-gray-600 mt-0.5 dark:text-gray-300">{liveMeeting.time} • {liveMeeting.participants.length} participants</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleJoinNow} 
            className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 dark:from-red-500 dark:to-pink-500 dark:hover:from-red-400 dark:hover:to-pink-400 rounded-md text-white text-sm font-semibold transition-all shadow-md dark:shadow-red-900/30"
          >
            Join Now
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering the parent click
              onDismiss();
            }} 
            className="px-4 py-2.5 rounded-md text-sm transition-all bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveMeetingBanner;


