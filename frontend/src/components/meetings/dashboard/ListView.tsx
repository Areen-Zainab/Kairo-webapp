import React from 'react';
import { Calendar, Clock, CheckSquare, FileText, Brain, Sparkles, Video, Play, ChevronRight, Circle, Download, MoreVertical } from 'lucide-react';
import type { Meeting } from './types';

interface ListViewProps {
  meetings: Meeting[];
}

const ListView: React.FC<ListViewProps> = ({ meetings }) => {
  return (
    <div className="space-y-3">
      {meetings.map((meeting) => (
        <div key={meeting.id} className="rounded-lg p-5 transition-all duration-200 group cursor-pointer bg-white border border-gray-200 hover:border-purple-300 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50 dark:hover:border-purple-500/50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2.5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">{meeting.title}</h3>
                {meeting.status === 'live' && (
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30">
                    <Circle className="w-1.5 h-1.5 fill-red-500 text-red-500 animate-pulse" />
                    <span className="text-xs font-medium">LIVE</span>
                  </div>
                )}
                {meeting.status === 'upcoming' && (
                  <div className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30">
                    <span className="text-xs font-medium">Upcoming</span>
                  </div>
                )}
                {meeting.status === 'completed' && (
                  <div className="px-2.5 py-1 rounded-md bg-green-100 text-green-700 border border-green-300 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30">
                    <span className="text-xs font-medium">Completed</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-5 mb-3 text-sm text-gray-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{meeting.date}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{meeting.time}</span>
                <span>{meeting.duration}</span>
              </div>
              {meeting.summary && <p className="text-sm text-gray-600 dark:text-slate-400 mb-3 leading-relaxed">{meeting.summary}</p>}
              <div className="flex items-center gap-5 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    {meeting.participants.slice(0, 3).map((p, idx) => (
                      <div key={idx} className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-xs font-medium text-white border-2 border-white dark:border-slate-800">{p.avatar}</div>
                    ))}
                    {meeting.participants.length > 3 && <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium border-2 border-white dark:bg-slate-700/80 dark:text-slate-300 dark:border-slate-800">+{meeting.participants.length - 3}</div>}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-slate-400">{meeting.participants.length} participants</span>
                </div>
                {meeting.tasks && <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-slate-400"><CheckSquare className="w-3.5 h-3.5" />{meeting.tasks} tasks</span>}
                {meeting.transcriptReady && <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400"><FileText className="w-3.5 h-3.5" />Transcript</span>}
                {meeting.memoryLinks && <span className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400"><Brain className="w-3.5 h-3.5" />{meeting.memoryLinks} links</span>}
                {meeting.aiInsights && <span className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400"><Sparkles className="w-3.5 h-3.5" />{meeting.aiInsights} insights</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              {meeting.status === 'live' && (
                <button className="flex items-center justify-center space-x-1.5 px-5 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 rounded-md text-white text-sm font-medium transition-all"><Play className="w-3.5 h-3.5" /><span>Join Now</span></button>
              )}
              {meeting.status === 'upcoming' && (
                <button className="flex items-center justify-center space-x-1.5 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-md text-white text-sm font-medium transition-all"><Video className="w-3.5 h-3.5" /><span>Join</span></button>
              )}
              {meeting.status === 'completed' && (
                <>
                  <button className="p-2.5 rounded-md transition-all bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 dark:border-slate-600/50 dark:text-slate-300" title="Download"><Download className="w-3.5 h-3.5" /></button>
                  <button className="flex items-center space-x-1.5 px-5 py-2.5 rounded-md text-sm font-medium transition-all bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 dark:border-slate-600/50 dark:text-slate-300"><span>View Details</span><ChevronRight className="w-3.5 h-3.5" /></button>
                </>
              )}
              <button className="p-2.5 rounded-md transition-all bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600 hover:text-gray-900 dark:bg-slate-700/30 dark:hover:bg-slate-700/50 dark:border-slate-600/50 dark:text-slate-400 dark:hover:text-white"><MoreVertical className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ListView;


