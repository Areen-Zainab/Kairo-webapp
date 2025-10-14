import React from 'react';
import { Calendar, Circle, CheckSquare, Sparkles } from 'lucide-react';
import type { Meeting } from './types';

interface KanbanViewProps { meetings: Meeting[] }

const KanbanView: React.FC<KanbanViewProps> = ({ meetings }) => {
  const columns = {
    upcoming: meetings.filter(m => m.status === 'upcoming'),
    live: meetings.filter(m => m.status === 'live'),
    completed: meetings.filter(m => m.status === 'completed'),
  } as const;

  const Header: React.FC<{ label: string; color: string; count: number; Icon: any }> = ({ label, color, count, Icon }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <Icon className={`w-4 h-4 text-${color}-400`} />
        <h3 className="font-semibold text-white text-sm">{label}</h3>
      </div>
      <span className="px-2 py-0.5 bg-slate-700/50 rounded text-xs text-slate-400 font-medium">{count}</span>
    </div>
  );

  const Card: React.FC<{ meeting: Meeting }> = ({ meeting }) => (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3.5 hover:border-purple-500/50 transition-all cursor-pointer group">
      <h4 className="font-medium text-white text-sm mb-2 group-hover:text-purple-300 transition-colors">{meeting.title}</h4>
      <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-2.5">
        <Calendar className="w-3 h-3" />
        <span>{meeting.time}</span>
      </div>
      <div className="flex -space-x-1.5 mb-2.5">
        {meeting.participants.slice(0, 3).map((p, idx) => (
          <div key={idx} className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-medium text-white border-2 border-slate-900">{p.avatar}</div>
        ))}
      </div>
      {meeting.aiInsights && (
        <div className="flex items-center space-x-1 text-xs text-purple-400">
          <Sparkles className="w-3 h-3" />
          <span>{meeting.aiInsights} insights</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      <div className="flex-1 min-w-[300px]">
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4">
          <Header label="Upcoming" color="blue" count={columns.upcoming.length} Icon={Calendar} />
          <div className="space-y-2.5">{columns.upcoming.map(m => <Card key={m.id} meeting={m} />)}</div>
        </div>
      </div>
      <div className="flex-1 min-w-[300px]">
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4">
          <Header label="Live" color="red" count={columns.live.length} Icon={Circle} />
          <div className="space-y-2.5">{columns.live.map(m => <Card key={m.id} meeting={m} />)}</div>
        </div>
      </div>
      <div className="flex-1 min-w-[300px]">
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4">
          <Header label="Completed" color="green" count={columns.completed.length} Icon={CheckSquare} />
          <div className="space-y-2.5">{columns.completed.map(m => <Card key={m.id} meeting={m} />)}</div>
        </div>
      </div>
    </div>
  );
};

export default KanbanView;


