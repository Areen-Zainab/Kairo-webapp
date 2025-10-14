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
  return (
    <div className="relative rounded-lg p-5 mb-8 overflow-hidden bg-red-50 border border-red-200 dark:bg-gradient-to-r dark:from-red-900/20 dark:via-pink-900/20 dark:to-red-900/20 dark:border-red-500/30">
      <div className="absolute inset-0 hidden dark:block bg-gradient-to-r from-red-600/5 to-pink-600/5 animate-pulse" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-red-700 uppercase tracking-wide dark:text-red-400">Live Now</span>
          </div>
          <div className="h-5 w-px bg-red-200 dark:bg-white/10" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{liveMeeting.title}</h3>
            <p className="text-sm text-gray-600 mt-0.5 dark:text-slate-300">{liveMeeting.time} • {liveMeeting.participants.length} participants</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={onJoin} className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-md text-white text-sm font-semibold transition-all">Join Now</button>
          <button onClick={onDismiss} className="px-4 py-2.5 rounded-md text-sm transition-all bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 dark:border-slate-600/50 dark:text-slate-300">Dismiss</button>
        </div>
      </div>
    </div>
  );
};

export default LiveMeetingBanner;


