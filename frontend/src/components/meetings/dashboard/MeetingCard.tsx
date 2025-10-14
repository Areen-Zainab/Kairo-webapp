import React from 'react';
import { Calendar, Clock, FileText, Sparkles, CheckSquare, Circle, ChevronRight, Video, Play, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Meeting } from './types';

const MeetingCard: React.FC<{ meeting: Meeting }> = ({ meeting }) => {
  const navigate = useNavigate();
  return (
    <div className="group relative bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-5 hover:border-purple-500/50 transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-purple-500/5">
      <div className="absolute top-4 right-4">
        {meeting.status === 'live' && (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-md">
            <Circle className="w-1.5 h-1.5 fill-red-500 text-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-400">LIVE</span>
          </div>
        )}
        {meeting.status === 'upcoming' && (
          <div className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-md"><span className="text-xs font-medium text-blue-400">Upcoming</span></div>
        )}
        {meeting.status === 'completed' && (
          <div className="px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-md"><span className="text-xs font-medium text-green-400">Completed</span></div>
        )}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2.5 pr-20 group-hover:text-purple-300 transition-colors">{meeting.title}</h3>
      <div className="flex items-center space-x-4 mb-3 text-slate-400 text-sm">
        <div className="flex items-center space-x-1.5"><Calendar className="w-3.5 h-3.5" /><span>{meeting.date}</span></div>
        <div className="flex items-center space-x-1.5"><Clock className="w-3.5 h-3.5" /><span>{meeting.time}</span></div>
      </div>
      <div className="flex items-center space-x-2.5 mb-3">
        <div className="flex -space-x-1.5">
          {meeting.participants.slice(0, 3).map((p, idx) => (
            <div key={idx} className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-medium text-white border-2 border-slate-800">{p.avatar}</div>
          ))}
          {meeting.participants.length > 3 && (<div className="w-7 h-7 rounded-full bg-slate-700/80 flex items-center justify-center text-xs font-medium text-slate-300 border-2 border-slate-800">+{meeting.participants.length - 3}</div>)}
        </div>
        <span className="text-xs text-slate-400">{meeting.participants.length} participants</span>
      </div>
      {meeting.summary && <p className="text-sm text-slate-400 mb-3 line-clamp-2 leading-relaxed">{meeting.summary}</p>}
      <div className="flex items-center gap-3 mb-3 text-xs text-slate-400 flex-wrap">
        {meeting.tasks && <span className="flex items-center gap-1"><CheckSquare className="w-3.5 h-3.5" />{meeting.tasks} tasks</span>}
        {meeting.transcriptReady && <span className="flex items-center gap-1 text-green-400"><FileText className="w-3.5 h-3.5" />Transcript</span>}
        {meeting.aiInsights && <span className="flex items-center gap-1 text-purple-400"><Sparkles className="w-3.5 h-3.5" />{meeting.aiInsights} insights</span>}
      </div>
      <div className="flex items-center space-x-2 pt-3 border-t border-slate-700/50">
        {meeting.status === 'live' && (
          <button
            className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-md text-white text-sm font-medium transition-all"
            onClick={() => navigate('/workspace/meetings/live')}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Join Now</span>
          </button>
        )}
        {meeting.status === 'upcoming' && (<button className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-md text-white text-sm font-medium transition-all"><Video className="w-3.5 h-3.5" /><span>Join</span></button>)}
        {meeting.status === 'completed' && (<button className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 rounded-md text-slate-300 text-sm font-medium transition-all"><span>View Details</span><ChevronRight className="w-3.5 h-3.5" /></button>)}
        <button className="p-2 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 rounded-md text-slate-400 hover:text-white transition-all"><MoreVertical className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
};

export default MeetingCard;


