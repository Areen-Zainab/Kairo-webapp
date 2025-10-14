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
    <div className="relative bg-gradient-to-r from-red-900/20 via-pink-900/20 to-red-900/20 backdrop-blur-sm border border-red-500/30 rounded-lg p-5 mb-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 to-pink-600/5 animate-pulse" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Circle className="w-2.5 h-2.5 fill-red-500 text-red-500 animate-pulse" />
            <span className="text-sm font-semibold text-red-400 uppercase tracking-wide">Live Now</span>
          </div>
          <div className="h-5 w-px bg-white/10" />
          <div>
            <h3 className="text-lg font-semibold text-white">{liveMeeting.title}</h3>
            <p className="text-sm text-slate-300 mt-0.5">{liveMeeting.time} • {liveMeeting.participants.length} participants</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={onJoin} className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-md text-white text-sm font-semibold transition-all">Join Now</button>
          <button onClick={onDismiss} className="px-4 py-2.5 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 rounded-md text-slate-300 text-sm transition-all">Dismiss</button>
        </div>
      </div>
    </div>
  );
};

export default LiveMeetingBanner;


