import React, { useMemo, useState } from 'react';
import { ChevronRight, Circle } from 'lucide-react';
import UserAvatar from '../../ui/UserAvatar';
import type { Meeting } from './types';

type CalendarMode = 'month' | 'year' | 'week';

const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Local calendar date for a meeting (start of that day) */
const getMeetingDay = (m: Meeting, today: Date): Date | null => {
  if (m.startTimeIso) {
    const d = new Date(m.startTimeIso);
    if (!Number.isNaN(d.getTime())) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }
  const raw = m.date.toLowerCase();
  if (raw.includes('today')) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }
  if (raw.includes('tomorrow')) {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return t;
  }
  const parsed = Date.parse(m.date);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
};

const CalendarView: React.FC<{
  meetings: Meeting[];
  onMeetingClick?: (id: string) => void;
}> = ({ meetings, onMeetingClick }) => {
  const todayRef = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<CalendarMode>('month');
  const [viewDate, setViewDate] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const setCalendarMode = (next: CalendarMode) => {
    setMode(next);
    if (next === 'week') {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      setViewDate(d);
    }
  };

  const meetingsByDayKey = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const day = getMeetingDay(m, todayRef);
      if (!day) continue;
      const key = toDateKey(day);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const ta = a.startTimeIso ? new Date(a.startTimeIso).getTime() : 0;
        const tb = b.startTimeIso ? new Date(b.startTimeIso).getTime() : 0;
        return ta - tb;
      });
    }
    return map;
  }, [meetings, todayRef]);

  const currentMonthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const getDaysInMonth = (base: Date) => {
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const days = getDaysInMonth(viewDate);

  const goPrev = () => {
    if (mode === 'month') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    if (mode === 'year') setViewDate(new Date(viewDate.getFullYear() - 1, 0, 1));
    if (mode === 'week') {
      const d = new Date(viewDate);
      d.setDate(d.getDate() - 7);
      setViewDate(d);
    }
  };

  const goNext = () => {
    if (mode === 'month') setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    if (mode === 'year') setViewDate(new Date(viewDate.getFullYear() + 1, 0, 1));
    if (mode === 'week') {
      const d = new Date(viewDate);
      d.setDate(d.getDate() + 7);
      setViewDate(d);
    }
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

  const weekDays = mode === 'week' ? getWeekDays(viewDate) : [];

  const weekRangeLabel =
    mode === 'week' && weekDays.length === 7
      ? `${weekDays[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : currentMonthLabel;

  const handleOpenMeeting = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onMeetingClick?.(id);
  };

  const todaysMeetings = useMemo(() => {
    const n = new Date();
    const key = toDateKey(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
    return (meetingsByDayKey.get(key) || []).slice();
  }, [meetingsByDayKey]);

  const daysOfWeekShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="rounded-lg p-6 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className={`px-2 py-1 rounded text-xs border ${
              mode === 'month'
                ? 'bg-purple-100 text-purple-700 border-purple-300'
                : 'text-gray-700 border-gray-300 hover:bg-gray-100 dark:text-slate-300 dark:border-slate-600/50 dark:hover:bg-white/5'
            }`}
            onClick={() => setCalendarMode('month')}
          >
            Month
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded text-xs border ${
              mode === 'year'
                ? 'bg-purple-100 text-purple-700 border-purple-300'
                : 'text-gray-700 border-gray-300 hover:bg-gray-100 dark:text-slate-300 dark:border-slate-600/50 dark:hover:bg-white/5'
            }`}
            onClick={() => setCalendarMode('year')}
          >
            Year
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded text-xs border ${
              mode === 'week'
                ? 'bg-purple-100 text-purple-700 border-purple-300'
                : 'text-gray-700 border-gray-300 hover:bg-gray-100 dark:text-slate-300 dark:border-slate-600/50 dark:hover:bg-white/5'
            }`}
            onClick={() => setCalendarMode('week')}
          >
            Week
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="p-1.5 rounded transition-all bg-gray-100 hover:bg-gray-200 border border-gray-300 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 dark:border-slate-600/50"
            aria-label="Previous"
          >
            <ChevronRight className="w-4 h-4 text-gray-700 dark:text-white rotate-180" />
          </button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white min-w-[10rem] text-center">
            {mode === 'year' ? viewDate.getFullYear() : weekRangeLabel}
          </h3>
          <button
            type="button"
            onClick={goNext}
            className="p-1.5 rounded transition-all bg-gray-100 hover:bg-gray-200 border border-gray-300 dark:bg-slate-700/40 dark:hover:bg-slate-700/60 dark:border-slate-600/50"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4 text-gray-700 dark:text-white" />
          </button>
        </div>
      </div>

      {mode === 'month' && (
        <>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {daysOfWeekShort.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-600 dark:text-slate-400 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, idx) => {
              const now = new Date();
              const isToday =
                viewDate.getFullYear() === now.getFullYear() &&
                viewDate.getMonth() === now.getMonth() &&
                day === now.getDate();
              const cellDate = day ? new Date(viewDate.getFullYear(), viewDate.getMonth(), day) : null;
              const key = cellDate ? toDateKey(cellDate) : '';
              const dayMeetings = cellDate ? meetingsByDayKey.get(key) || [] : [];
              return (
                <div
                  key={idx}
                  className={`min-h-[5.5rem] rounded-lg p-1.5 text-left transition-all ${
                    day
                      ? 'bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-900/50 dark:border-slate-700/50 dark:hover:border-purple-500/50'
                      : ''
                  } ${isToday ? 'ring-1 ring-purple-400 dark:ring-purple-500/70 bg-purple-50/50 dark:bg-purple-500/5' : ''}`}
                >
                  {day && (
                    <>
                      <div
                        className={`text-xs font-semibold mb-1 ${isToday ? 'text-purple-700 dark:text-purple-400' : 'text-gray-800 dark:text-white'}`}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayMeetings.slice(0, 3).map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={e => handleOpenMeeting(e, m.id)}
                            className="w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/25 truncate"
                            title={m.title}
                          >
                            {m.time.split(' - ')[0]} {m.title}
                          </button>
                        ))}
                        {dayMeetings.length > 3 && (
                          <p className="text-[10px] text-gray-500 dark:text-slate-500 pl-1">+{dayMeetings.length - 3} more</p>
                        )}
                      </div>
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
          {Array.from({ length: 12 }, (_, m) => new Date(viewDate.getFullYear(), m, 1)).map(mDate => {
            const miniDays = getDaysInMonth(mDate);
            return (
              <div key={mDate.toISOString()} className="rounded-lg p-3 bg-white border border-gray-200 dark:bg-slate-900/50 dark:border-slate-700/50">
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {mDate.toLocaleString('default', { month: 'long' })}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {miniDays.map((d, i) => {
                    const cellDate = d ? new Date(mDate.getFullYear(), mDate.getMonth(), d) : null;
                    const key = cellDate ? toDateKey(cellDate) : '';
                    const hasMeeting = cellDate ? (meetingsByDayKey.get(key)?.length ?? 0) > 0 : false;
                    const isTodayMini = cellDate ? cellDate.toDateString() === new Date().toDateString() : false;
                    return (
                      <div
                        key={i}
                        className={`h-6 text-[10px] rounded flex items-center justify-center relative ${
                          d ? 'bg-white border border-gray-200 dark:bg-slate-800/60 dark:border-slate-700/50' : ''
                        } ${isTodayMini ? 'ring-1 ring-purple-400 dark:ring-purple-500/70' : ''}`}
                      >
                        {d ?? ''}
                        {hasMeeting && d && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'week' && (
        <>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {daysOfWeekShort.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-600 dark:text-slate-400 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {getWeekDays(viewDate).map((d, idx) => {
              const isToday = d.toDateString() === new Date().toDateString();
              const key = toDateKey(d);
              const dayMeetings = meetingsByDayKey.get(key) || [];
              return (
                <div
                  key={idx}
                  className={`min-h-[8rem] rounded-lg p-2 border transition-all ${
                    isToday
                      ? 'border-purple-400 bg-purple-50/50 dark:border-purple-500/70 dark:bg-purple-500/5'
                      : 'border-gray-200 bg-white dark:border-slate-700/50 dark:bg-slate-900/50'
                  }`}
                >
                  <div
                    className={`text-sm font-semibold mb-2 ${isToday ? 'text-purple-700 dark:text-purple-400' : 'text-gray-800 dark:text-white'}`}
                  >
                    {d.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayMeetings.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={e => handleOpenMeeting(e, m.id)}
                        className="w-full text-left text-[11px] px-1.5 py-1 rounded bg-blue-50 text-blue-900 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/25 line-clamp-2"
                      >
                        <span className="font-medium">{m.time.split(' - ')[0]}</span> · {m.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700/50">
        <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-4">Today&apos;s meetings</h4>
        <div className="space-y-2">
          {todaysMeetings.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">No meetings scheduled for today.</p>
          ) : (
            todaysMeetings.map(meeting => (
              <div
                key={meeting.id}
                role="button"
                tabIndex={0}
                onClick={() => onMeetingClick?.(meeting.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onMeetingClick?.(meeting.id);
                  }
                }}
                className="rounded-lg p-4 transition-all cursor-pointer bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-900/50 dark:border-slate-700/50 dark:hover:border-purple-500/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h5 className="font-medium text-gray-900 dark:text-white text-sm mb-1 truncate">{meeting.title}</h5>
                    <p className="text-xs text-gray-600 dark:text-slate-400">{meeting.time}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex -space-x-1.5">
                      {meeting.participants.map((p, pidx) => (
                        <div key={pidx} className="border-2 border-white dark:border-slate-800 rounded-full">
                          <UserAvatar name={p.name} profilePictureUrl={(p as any).profilePictureUrl} size="xs" />
                        </div>
                      ))}
                    </div>
                    {meeting.status === 'live' && (
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 border border-red-300 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30">
                        <Circle className="w-1.5 h-1.5 fill-red-500 text-red-500 animate-pulse" />
                        <span className="text-xs font-medium">LIVE</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
