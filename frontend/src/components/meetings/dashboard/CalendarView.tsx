import React, { useState } from 'react';
import { ChevronRight, Circle } from 'lucide-react';
import type { Meeting } from './types';

type CalendarMode = 'month' | 'year' | 'week';

const CalendarView: React.FC<{ meetings: Meeting[] }> = ({ meetings }) => {
  const daysOfWeekShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const [mode, setMode] = useState<CalendarMode>('month');
  const [viewDate, setViewDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));

  const currentMonthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const parseMeetingDate = (dateStr: string): Date | null => {
    const lower = dateStr.toLowerCase();
    if (lower.includes('today')) return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (lower.includes('tomorrow')) return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const parsed = Date.parse(dateStr);
    if (!Number.isNaN(parsed)) return new Date(parsed);
    return null;
  };

  const meetingDateKeys = new Set<string>(
    meetings.map(m => parseMeetingDate(m.date)).filter((d): d is Date => !!d).map(d => toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate())))
  );

  const getDaysInMonth = (base: Date) => {
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number|null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const days = getDaysInMonth(viewDate);

  const goPrev = () => {
    if (mode === 'month') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    if (mode === 'year') setViewDate(new Date(viewDate.getFullYear() - 1, 0, 1));
    if (mode === 'week') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() - 7));
  };

  const goNext = () => {
    if (mode === 'month') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    if (mode === 'year') setViewDate(new Date(viewDate.getFullYear() + 1, 0, 1));
    if (mode === 'week') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + 7));
  };

  const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getWeekDays = (base: Date) => {
    const start = startOfWeek(base);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button className={`px-2 py-1 rounded text-xs border ${mode==='month' ? 'bg-white/10 text-white border-white/20' : 'text-slate-300 border-slate-600/50 hover:bg-white/5'}`} onClick={() => setMode('month')}>Month</button>
          <button className={`px-2 py-1 rounded text-xs border ${mode==='year' ? 'bg-white/10 text-white border-white/20' : 'text-slate-300 border-slate-600/50 hover:bg-white/5'}`} onClick={() => setMode('year')}>Year</button>
          <button className={`px-2 py-1 rounded text-xs border ${mode==='week' ? 'bg-white/10 text-white border-white/20' : 'text-slate-300 border-slate-600/50 hover:bg-white/5'}`} onClick={() => setMode('week')}>Week</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-1.5 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/50 rounded transition-all">
            <ChevronRight className="w-4 h-4 text-white rotate-180" />
          </button>
          <h3 className="text-lg font-semibold text-white">{mode==='year' ? viewDate.getFullYear() : currentMonthLabel}</h3>
          <button onClick={goNext} className="p-1.5 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/50 rounded transition-all">
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {mode === 'month' && (
        <>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {daysOfWeekShort.map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-400 py-2">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, idx) => {
              const isToday = viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth() && day === today.getDate();
              const cellDate = day ? new Date(viewDate.getFullYear(), viewDate.getMonth(), day) : null;
              const hasMeeting = cellDate ? meetingDateKeys.has(toDateKey(cellDate)) : false;
              return (
                <div key={idx} className={`aspect-square rounded-lg p-2 text-center transition-all cursor-pointer ${day ? 'bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/50' : ''} ${isToday ? 'border-purple-500/70 bg-purple-500/5' : ''} ${hasMeeting ? 'border-blue-500/50' : ''}`}>
                  {day && (
                    <>
                      <div className={`text-sm font-medium ${isToday ? 'text-purple-400' : 'text-white'}`}>{day}</div>
                      {hasMeeting && (<div className="mt-1 flex justify-center"><div className="w-1 h-1 rounded-full bg-blue-500" /></div>)}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {mode === 'year' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 12 }, (_, m) => new Date(viewDate.getFullYear(), m, 1)).map((mDate) => (
            <div key={mDate.toISOString()} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
              <div className="text-sm font-semibold text-white mb-2">{mDate.toLocaleString('default', { month: 'long' })}</div>
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(mDate).map((d, i) => {
                  const cellDate = d ? new Date(mDate.getFullYear(), mDate.getMonth(), d) : null;
                  const isToday = cellDate ? cellDate.toDateString() === today.toDateString() : false;
                  const hasMeeting = cellDate ? meetingDateKeys.has(toDateKey(cellDate)) : false;
                  return (
                    <div key={i} className={`h-6 text-[10px] rounded flex items-center justify-center relative ${d ? 'bg-slate-800/60 border border-slate-700/50' : ''} ${isToday ? 'border-purple-500/70' : ''} ${hasMeeting ? 'border-blue-500/50' : ''}`}>
                      {d ?? ''}
                      {hasMeeting && d && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'week' && (
        <>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {daysOfWeekShort.map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-400 py-2">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {getWeekDays(viewDate).map((d, idx) => {
              const isToday = d.toDateString() === today.toDateString();
              const hasMeeting = meetingDateKeys.has(toDateKey(d));
              return (
                <div key={idx} className={`aspect-square rounded-lg p-2 text-center transition-all cursor-pointer bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/50 ${isToday ? 'border-purple-500/70 bg-purple-500/5' : ''} ${hasMeeting ? 'border-blue-500/50' : ''}`}>
                  <div className={`text-sm font-medium ${isToday ? 'text-purple-400' : 'text-white'}`}>{d.getDate()}</div>
                  {hasMeeting && (<div className="mt-1 flex justify-center"><div className="w-1 h-1 rounded-full bg-blue-500" /></div>)}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-6 pt-6 border-t border-slate-700/50">
        <h4 className="font-medium text-white text-sm mb-4">Today's Meetings</h4>
        <div className="space-y-2">
          {meetings.filter(m => m.date.includes('Today')).map(meeting => (
            <div key={meeting.id} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-purple-500/50 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-white text-sm mb-1">{meeting.title}</h5>
                  <p className="text-xs text-slate-400">{meeting.time}</p>
                </div>
                {meeting.status === 'live' && (
                  <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-md">
                    <Circle className="w-1.5 h-1.5 fill-red-500 text-red-500 animate-pulse" />
                    <span className="text-xs font-medium text-red-400">LIVE</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;


