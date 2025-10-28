import React from 'react';
import { Calendar, Circle, CheckSquare, Sparkles } from 'lucide-react';
import type { Meeting } from './types';
import UserAvatar from '../../ui/UserAvatar';

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
        <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{label}</h3>
      </div>
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-slate-700/50 dark:text-slate-400">{count}</span>
    </div>
  );

  const Card: React.FC<{ meeting: Meeting }> = ({ meeting }) => (
    <div className="rounded-lg p-3.5 transition-all cursor-pointer group bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-900/50 dark:border-slate-700/50 dark:hover:border-purple-500/50">
      <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">{meeting.title}</h4>
      <div className="flex items-center space-x-1.5 text-xs text-gray-600 dark:text-slate-400 mb-2.5">
        <Calendar className="w-3 h-3" />
        <span>{meeting.time}</span>
      </div>
      <div className="flex -space-x-1.5 mb-2.5">
        {meeting.participants.slice(0, 3).map((p, idx) => (
          <div key={idx} className="border-2 border-white dark:border-slate-900">
            <UserAvatar name={p.name} profilePictureUrl={p.profilePictureUrl} size="xs" />
          </div>
        ))}
      </div>
      {meeting.aiInsights && (
        <div className="flex items-center space-x-1 text-xs text-purple-600 dark:text-purple-400">
          <Sparkles className="w-3 h-3" />
          <span>{meeting.aiInsights} insights</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      <div className="flex-1 min-w-[300px]">
        <div className="rounded-lg p-4 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
          <Header label="Upcoming" color="blue" count={columns.upcoming.length} Icon={Calendar} />
          <div className="space-y-2.5">{columns.upcoming.map(m => <Card key={m.id} meeting={m} />)}</div>
        </div>
      </div>
      <div className="flex-1 min-w-[300px]">
        <div className="rounded-lg p-4 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
          <Header label="Live" color="red" count={columns.live.length} Icon={Circle} />
          <div className="space-y-2.5">{columns.live.map(m => <Card key={m.id} meeting={m} />)}</div>
        </div>
      </div>
      <div className="flex-1 min-w-[300px]">
        <div className="rounded-lg p-4 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
          <Header label="Completed" color="green" count={columns.completed.length} Icon={CheckSquare} />
          <div className="space-y-2.5">{columns.completed.map(m => <Card key={m.id} meeting={m} />)}</div>
        </div>
      </div>
    </div>
  );
};

export default KanbanView;


