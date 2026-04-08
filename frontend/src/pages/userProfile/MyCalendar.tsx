import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Clock, Users, MapPin, Plus, Filter, X, Search, Edit, Trash, Loader2 } from 'lucide-react';
import Layout from '../../components/Layout';
import NewMeetingModal from '../../modals/NewMeetingModal';
import apiService from '../../services/api';
import { useUser, type UserProfile } from '../../context/UserContext';

/** Calendar row: meetings from the API plus your kanban tasks with a due date */
interface CalendarItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  workspace: string;
  workspaceId?: number;
  /** Set for kanban-backed items — used to open the workspace task board */
  taskId?: number;
  participants: string[];
  location?: string;
  type: 'meeting' | 'task' | 'deadline';
  status: 'upcoming' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

function mapColumnToTaskStatus(columnName: string): 'todo' | 'in-progress' | 'completed' {
  const lower = columnName.toLowerCase();
  if (lower === 'complete' || lower === 'completed') return 'completed';
  if (lower === 'in-progress') return 'in-progress';
  if (lower === 'review') return 'in-progress';
  return 'todo';
}

function normalizeTaskPriority(p: string): CalendarItem['priority'] {
  if (p === 'low' || p === 'medium' || p === 'high' || p === 'urgent') return p;
  return 'medium';
}

function assigneeMatchesUser(assignee: string | null | undefined, profile: UserProfile): boolean {
  if (!assignee?.trim()) return false;
  const norm = (s: string) => s.trim().toLowerCase();
  const a = norm(assignee);
  if (a === norm(profile.email)) return true;
  if (a === norm(profile.name)) return true;
  const first = profile.name.split(/\s+/)[0];
  if (first && a === norm(first)) return true;
  return false;
}

const MyCalendar = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user, workspaces } = useUser();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredMeeting, setHoveredMeeting] = useState<string | null>(null);
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [workspacesList, setWorkspacesList] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const loadCalendarData = useCallback(async () => {
    if (!user) {
      setCalendarItems([]);
      setWorkspacesList([]);
      setDataLoading(false);
      return;
    }

    if (workspaces.length === 0) {
      setCalendarItems([]);
      setWorkspacesList([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    const items: CalendarItem[] = [];
    const nameSet = new Set<string>();

    try {
      await Promise.all(
        workspaces.map(async (ws) => {
          try {
          const [meetingsRes, kanbanRes] = await Promise.all([
            apiService.getMeetingsByWorkspace(ws.id),
            apiService.getKanbanColumns(ws.id),
          ]);

          nameSet.add(ws.name);

          if (meetingsRes.data?.meetings) {
            for (const m of meetingsRes.data.meetings) {
              if (!m.startTime || !m.endTime) continue;
              const startTime = new Date(m.startTime);
              const endTime = new Date(m.endTime);
              if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) continue;

              const statusRaw = m.status as string | undefined;
              const calStatus: CalendarItem['status'] =
                statusRaw === 'completed'
                  ? 'completed'
                  : statusRaw === 'cancelled'
                    ? 'cancelled'
                    : 'upcoming';

              items.push({
                id: `meeting-${m.id}`,
                title: m.title || 'Untitled Meeting',
                startTime,
                endTime,
                workspace: ws.name,
                workspaceId: ws.id,
                participants: m.participants?.map((p: { user?: { name?: string }; name?: string }) => p.user?.name || p.name || 'Unknown') || [],
                location: m.location || undefined,
                type: 'meeting',
                status: calStatus,
                priority: 'medium',
              });
            }
          }

          if (!kanbanRes.error && kanbanRes.data?.columns) {
            for (const col of kanbanRes.data.columns) {
              for (const t of col.tasks) {
                if (!assigneeMatchesUser(t.assignee, user)) continue;
                if (!t.dueDate) continue;

                const rowStatus = mapColumnToTaskStatus(col.name);
                const startTime = new Date(t.dueDate);
                if (isNaN(startTime.getTime())) continue;

                const endTime = new Date(startTime.getTime());
                endTime.setHours(endTime.getHours() + 1);

                const priority = normalizeTaskPriority(t.priority);
                const calStatus: CalendarItem['status'] = rowStatus === 'completed' ? 'completed' : 'upcoming';
                const displayType: CalendarItem['type'] =
                  priority === 'urgent' && calStatus !== 'completed' ? 'deadline' : 'task';

                items.push({
                  id: `task-${t.id}`,
                  taskId: t.id,
                  workspaceId: ws.id,
                  title: t.title || 'Task',
                  startTime,
                  endTime,
                  workspace: ws.name,
                  participants: [t.assignee?.trim() || user.name],
                  type: displayType,
                  status: calStatus,
                  priority,
                });
              }
            }
          }
          } catch {
            nameSet.add(ws.name);
          }
        })
      );

      items.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      setCalendarItems(items);
      setWorkspacesList(Array.from(nameSet).sort());
    } catch {
      setCalendarItems([]);
      setWorkspacesList(Array.from(nameSet).sort());
    } finally {
      setDataLoading(false);
    }
  }, [user, workspaces]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      setCalendarItems([]);
      setDataLoading(false);
      return;
    }
    void loadCalendarData();
  }, [authLoading, isAuthenticated, user, loadCalendarData]);

  const displayEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return calendarItems;
    return calendarItems.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.workspace.toLowerCase().includes(q) ||
        m.participants.some((p) => p.toLowerCase().includes(q))
    );
  }, [calendarItems, searchQuery]);

  const workspacesForFilters = workspacesList.length > 0 ? workspacesList : workspaces.map((w) => w.name);

  // Helper functions
  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'month') {
        newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      } else if (viewMode === 'week') {
        newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      } else {
        newDate.setDate(prev.getDate() + (direction === 'next' ? 1 : -1));
      }
      return newDate;
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const getWeekDays = (date: Date) => {
    const d = new Date(date.getTime());
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    const sunday = new Date(d.getTime());

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(sunday);
      currentDay.setDate(sunday.getDate() + i);
      days.push(currentDay);
    }
    return days;
  };

  const getMeetingsForDate = (date: Date) => {
    return displayEvents
      .filter((meeting) => {
        const meetingDate = new Date(meeting.startTime);
        return (
          meetingDate.getDate() === date.getDate() &&
          meetingDate.getMonth() === date.getMonth() &&
          meetingDate.getFullYear() === date.getFullYear()
        );
      })
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-amber-500';
      case 'low':
        return 'bg-emerald-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'meeting': return <Users size={14} />;
      case 'task': return <Clock size={14} />;
      case 'deadline': return <Calendar size={14} />;
      default: return <Calendar size={14} />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40 dark:hover:bg-purple-500/30';
      case 'task': return 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40 dark:hover:bg-blue-500/30';
      case 'deadline': return 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 dark:hover:bg-rose-500/30';
      default: return 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/40 dark:hover:bg-gray-500/30';
    }
  };

  const handleEventClick = (item: CalendarItem) => {
    if (item.type === 'meeting') {
      const rawId = item.id.startsWith('meeting-') ? item.id.slice('meeting-'.length) : item.id;
      navigate(`/workspace/meetings/${rawId}`);
      return;
    }
    if ((item.type === 'task' || item.type === 'deadline') && item.workspaceId != null && item.taskId != null) {
      navigate(`/workspace/${item.workspaceId}/tasks?task=${item.taskId}`);
    }
  };

  // Render Month View
  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
        <div key={day} className="p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          <span className="hidden sm:inline">{day}</span>
          <span className="sm:hidden">{day.charAt(0)}</span>
        </div>
      ))}
      
      {getDaysInMonth(currentDate).map((day, index) => {
        if (day === null) {
          return <div key={`empty-${index}`} className="p-2 sm:p-3 min-h-[80px] sm:min-h-[120px] rounded-lg bg-gray-50 dark:bg-gray-800/20" />;
        }

        const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dayMeetings = getMeetingsForDate(dayDate);
        const todayFlag = isToday(dayDate);

        return (
          <div
            key={`${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`}
            className={`p-2 sm:p-3 min-h-[80px] sm:min-h-[120px] border rounded-lg cursor-pointer transition-all ${
              todayFlag 
                ? 'bg-gradient-to-br from-purple-100 to-indigo-100 border-purple-400 shadow-lg ring-2 ring-purple-300 dark:from-purple-600/20 dark:to-indigo-600/20 dark:border-purple-500/50 dark:ring-purple-500/20' 
                : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 dark:border-gray-700/40 dark:bg-gray-800/20 dark:hover:bg-gray-800/40'
            }`}
            onClick={() => setSelectedDate(dayDate)}
          >
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className={`text-xs sm:text-sm font-bold ${
                todayFlag ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'
              }`}>
                {day}
              </span>
              {dayMeetings.length > 0 && (
                <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full font-semibold shadow-sm dark:bg-purple-500/30 dark:text-purple-200 dark:border dark:border-purple-400/40">
                  {dayMeetings.length}
                </span>
              )}
            </div>
            
            <div className="space-y-1">
              {dayMeetings.slice(0, 3).map((meeting) => (
                <div
                  key={meeting.id}
                  className={`text-xs p-1.5 rounded border transition-all cursor-pointer ${getEventColor(meeting.type)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEventClick(meeting);
                  }}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getPriorityColor(meeting.priority)}`} />
                    <span className="font-medium truncate">{meeting.title}</span>
                  </div>
                  <div className="text-xs opacity-75 mt-0.5 hidden sm:block">
                    {meeting.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              {dayMeetings.length > 3 && (
                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium pl-1">
                  +{dayMeetings.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render Week View
  const renderWeekView = () => {
    const weekDays = getWeekDays(new Date(currentDate.getTime()));
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-col">
        <div className="grid grid-cols-8 gap-2 mb-2">
          <div className="p-2"></div>
          {weekDays.map((day, index) => {
            const todayFlag = isToday(day);
            return (
              <div
                key={index}
                className={`p-2 text-center rounded-lg border transition-all ${
                  todayFlag 
                    ? 'bg-purple-100 border-purple-400 shadow-lg dark:bg-purple-600/20 dark:border-purple-500/50'
                    : 'border-gray-200 bg-white dark:border-gray-700/40 dark:bg-gray-800/20'
                }`}
              >
                <div className={`text-xs font-semibold uppercase ${todayFlag ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-xl font-bold ${todayFlag ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-white'}`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-y-auto max-h-[600px] pr-2">
          <div className="grid grid-cols-8 gap-2">
            <div className="space-y-14">
              {hours.map((hour) => (
                <div key={hour} className="text-xs text-gray-500 text-right pr-2 -mt-2">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
              ))}
            </div>

            {weekDays.map((day, dayIndex) => (
              <div key={dayIndex} className="relative border-l border-gray-200 dark:border-gray-700/40">
                {hours.map((hour) => (
                  <div key={hour} className="h-14 border-b border-gray-100 dark:border-gray-700/20"></div>
                ))}
                
                {getMeetingsForDate(day).map((meeting) => {
                  const startHour = meeting.startTime.getHours();
                  const startMinute = meeting.startTime.getMinutes();
                  const duration = (meeting.endTime.getTime() - meeting.startTime.getTime()) / (1000 * 60);
                  const top = (startHour * 56) + (startMinute / 60 * 56);
                  const height = Math.max((duration / 60) * 56, 28);

                  return (
                    <div
                      key={meeting.id}
                      className={`absolute left-1 right-1 rounded border p-1 cursor-pointer transition-all ${getEventColor(meeting.type)}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEventClick(meeting);
                      }}
                    >
                      <div className="text-xs font-semibold truncate">{meeting.title}</div>
                      <div className="text-xs opacity-75 truncate">
                        {meeting.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render Day View
  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayMeetings = getMeetingsForDate(currentDate);

    return (
      <div className="space-y-4">
        {/* Day Header */}
        <div className="bg-gradient-to-r from-purple-100 via-indigo-100 to-pink-100 border border-purple-300 rounded-lg p-4 sm:p-6 dark:from-purple-600/20 dark:via-indigo-600/20 dark:to-pink-600/20 dark:border-purple-500/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
              </div>
              <div className="text-base sm:text-lg text-gray-700 dark:text-gray-300">
                {currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-medium px-3 py-2 bg-white/70 dark:bg-white/5 rounded-lg border border-purple-200 dark:border-purple-500/30">
              {dayMeetings.length} {dayMeetings.length === 1 ? 'event' : 'events'} scheduled
            </div>
          </div>
        </div>

        {/* Day Timeline */}
        <div className="grid grid-cols-12 gap-2 sm:gap-4">
          {/* Hour Labels */}
          <div className="col-span-2 sm:col-span-1 space-y-2 pr-2">
            {hours.map((hour) => (
              <div key={hour} className="h-14 text-xs text-gray-600 dark:text-gray-400 font-medium text-right pt-1">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
            ))}
          </div>

          {/* Events Column */}
          <div className="col-span-10 sm:col-span-11 relative border-l-2 border-gray-200 dark:border-gray-700/40">
            {/* Hour Lines */}
            <div className="relative">
              {hours.map((hour) => (
                <div key={hour} className="h-14 border-b border-gray-100 dark:border-gray-700/20"></div>
              ))}
            </div>
            
            {/* Event Blocks */}
            {dayMeetings.map((meeting) => {
              const startHour = meeting.startTime.getHours();
              const startMinute = meeting.startTime.getMinutes();
              const endHour = meeting.endTime.getHours();
              const endMinute = meeting.endTime.getMinutes();
              const top = (startHour * 56) + (startMinute / 60 * 56);
              const duration = ((endHour * 60 + endMinute) - (startHour * 60 + startMinute));
              const height = Math.max((duration / 60) * 56, 56);

              return (
                <div
                  key={meeting.id}
                  className={`absolute left-2 right-2 rounded-lg border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer ${getEventColor(meeting.type)} group`}
                  style={{ top: `${top}px`, height: `${height}px`, minHeight: '56px' }}
                  onClick={() => handleEventClick(meeting)}
                >
                  <div className="p-2 sm:p-3 h-full flex flex-col">
                    <div className="flex items-start gap-2 mb-1 sm:mb-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {getTypeIcon(meeting.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs sm:text-sm truncate flex items-center gap-2">
                          {meeting.title}
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getPriorityColor(meeting.priority)}`} />
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-90 mb-1">
                      {meeting.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {meeting.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-[10px] sm:text-xs opacity-75 truncate mb-1">
                      {meeting.workspace}
                    </div>
                    {meeting.location && (
                      <div className="text-[10px] sm:text-xs opacity-75 flex items-center gap-1 truncate">
                        <MapPin size={8} />
                        <span className="truncate">{meeting.location}</span>
                      </div>
                    )}
                    {meeting.participants && meeting.participants.length > 0 && (
                      <div className="text-[10px] sm:text-xs opacity-75 flex items-center gap-1 truncate mt-auto">
                        <Users size={8} />
                        <span className="truncate">
                          {meeting.participants.slice(0, 2).join(', ')}
                          {meeting.participants.length > 2 && ` +${meeting.participants.length - 2}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Current Time Indicator */}
            {isToday(currentDate) && (
              <div 
                className="absolute left-0 right-0 border-t-2 border-red-500 z-10 pointer-events-none"
                style={{ top: `${(new Date().getHours() * 56) + (new Date().getMinutes() / 60 * 56)}px` }}
              >
                <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-red-500 -translate-y-1/2"></div>
              </div>
            )}
          </div>
        </div>

        {/* No Events Message */}
        {dayMeetings.length === 0 && (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/20 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700/40">
            <Calendar size={56} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 text-lg font-medium mb-2">No events scheduled</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">Your day is free!</p>
            <button
              onClick={() => setShowNewMeetingModal(true)}
              className="mt-4 px-4 py-2 rounded-lg transition-all border-2 bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 dark:bg-purple-600/30 dark:text-purple-300 dark:hover:bg-purple-600/40 dark:border-purple-500/40 font-medium flex items-center justify-center gap-2"
            >
              {/* Show "+" on tablet and smaller */}
              <Plus size={16} className="block md:hidden" />
              {/* Show text on larger screens */}
              <span className="hidden md:inline">Add Event</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                My Calendar
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your meetings, tasks, and deadlines</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 font-medium border ${
                  showFilters 
                    ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-lg dark:bg-purple-600/30 dark:text-purple-300 dark:border-purple-500/50 dark:shadow-purple-500/20' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:border-gray-700/50'
                }`}
              >
                <Filter size={16} />
                <span className="hidden sm:inline">Filters</span>
              </button>
              <button onClick={() => setShowNewMeetingModal(true)}
                className="px-3 sm:px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 font-medium shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
              >
                <Plus size={20} className="block md:hidden" />
                <Plus size={20} className="hidden md:inline w-4 h-4" />
                <span className="hidden md:inline">Add Event</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, workspaces, or participants..."
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500"
            />
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-xl dark:bg-gray-800/40 dark:border-gray-700/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors dark:hover:bg-gray-700/50"
              >
                <X size={18} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Workspaces</label>
                <div className="space-y-3">
                  {workspacesForFilters.map((workspace) => (
                    <label key={workspace} className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors">
                      <input type="checkbox" className="rounded border-gray-300 text-purple-600 focus:ring-purple-500/50 dark:border-gray-600 dark:bg-gray-800/50 dark:text-purple-500" />
                      <span>{workspace}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Event Type</label>
                <div className="space-y-3">
                  {['Meeting', 'Task', 'Deadline'].map((type) => (
                    <label key={type} className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors">
                      <input type="checkbox" className="rounded border-gray-300 text-purple-600 focus:ring-purple-500/50 dark:border-gray-600 dark:bg-gray-800/50 dark:text-purple-500" />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Status</label>
                <div className="space-y-3">
                  {['Upcoming', 'Completed', 'Cancelled'].map((status) => (
                    <label key={status} className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors">
                      <input type="checkbox" className="rounded border-gray-300 text-purple-600 focus:ring-purple-500/50 dark:border-gray-600 dark:bg-gray-800/50 dark:text-purple-500" />
                      <span>{status}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Mode and Stats */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-1 flex shadow-lg dark:bg-gray-800/40 dark:border-gray-700/50">
            {(['month', 'week', 'day'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-5 py-2.5 rounded-md font-semibold transition-all text-sm ${
                  viewMode === mode
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700/50'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="flex items-center justify-between gap-3 sm:gap-6 text-xs sm:text-sm bg-white border border-gray-200 rounded-lg px-2 sm:px-4 py-2 dark:bg-gray-800/40 dark:border-gray-700/50 flex-wrap">
            {/* Meetings */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-[90px] sm:min-w-fit justify-center sm:justify-start">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-purple-500 shadow-md shadow-purple-500/50"></div>
              <span className="text-gray-600 dark:text-gray-400 hidden sm:inline">Meetings</span>
              <span className="text-gray-900 dark:text-white font-semibold">
                {displayEvents.filter((m) => m.type === 'meeting').length}
              </span>
            </div>

            {/* Tasks */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-[90px] sm:min-w-fit justify-center sm:justify-start">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500 shadow-md shadow-blue-500/50"></div>
              <span className="text-gray-600 dark:text-gray-400 hidden sm:inline">Tasks</span>
              <span className="text-gray-900 dark:text-white font-semibold">
                {displayEvents.filter((m) => m.type === 'task').length}
              </span>
            </div>

            {/* Deadlines */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-[90px] sm:min-w-fit justify-center sm:justify-start">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500 shadow-md shadow-rose-500/50"></div>
              <span className="text-gray-600 dark:text-gray-400 hidden sm:inline">Deadlines</span>
              <span className="text-gray-900 dark:text-white font-semibold">
                {displayEvents.filter((m) => m.type === 'deadline').length}
              </span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-xl dark:bg-gray-800/40 dark:border-gray-700/50 dark:backdrop-blur-sm">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {viewMode === 'day' 
                ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2.5 rounded-lg transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700/50 dark:border-gray-700/50"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2.5 rounded-lg transition-all text-sm font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600/50 dark:border-gray-700/50"
              >
                Today
              </button>
              <button
                onClick={() => navigateDate('next')}
                className="p-2.5 rounded-lg transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700/50 dark:border-gray-700/50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Calendar Views */}
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400 gap-3">
              <Loader2 size={40} className="animate-spin text-purple-500" />
              <p>Loading meetings and your tasks…</p>
            </div>
          ) : (
            <>
              {viewMode === 'month' && renderMonthView()}
              {viewMode === 'week' && renderWeekView()}
              {viewMode === 'day' && renderDayView()}
            </>
          )}
        </div>

        {/* Selected Date Details */}
        {selectedDate && viewMode !== 'day' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-xl dark:bg-gray-800/40 dark:border-gray-700/50 dark:backdrop-blur-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {formatDate(selectedDate)}
                </h3>
                <p className="text-gray-700 dark:text-gray-400">
                  {getMeetingsForDate(selectedDate).length} events scheduled
                </p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              {getMeetingsForDate(selectedDate).length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-800/30 dark:border-gray-700/30">
                  <Calendar size={56} className="mx-auto text-gray-500 dark:text-gray-600 mb-4" />
                  <p className="text-gray-700 dark:text-gray-400 text-lg">No events scheduled for this day</p>
                  <button className="mt-4 px-4 py-2 rounded-lg transition-all border-2 bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 dark:bg-purple-600/30 dark:text-purple-300 dark:hover:bg-purple-600/40 dark:border-purple-500/40 font-medium flex items-center gap-2">
                    <Plus size={16} className="sm:hidden" />
                    <span className="hidden sm:inline">Add Event</span>
                  </button>
                </div>
              ) : (
                getMeetingsForDate(selectedDate).map((meeting) => (
                  <div
                    key={meeting.id}
                    className="rounded-lg p-5 border transition-all group relative bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800/50 dark:border-gray-700/50 dark:hover:border-gray-600/50 cursor-pointer"
                    onMouseEnter={() => setHoveredMeeting(meeting.id)}
                    onMouseLeave={() => setHoveredMeeting(null)}
                    onClick={() => handleEventClick(meeting)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <div className={`p-2 rounded-lg ${getEventColor(meeting.type).split(' ')[0]}`}>
                            {getTypeIcon(meeting.type)}
                          </div>
                          <h4 className="font-bold text-lg text-gray-900 dark:text-white truncate">{meeting.title}</h4>
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-lg ${getPriorityColor(meeting.priority)}`} />
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Clock size={16} className="text-purple-600 dark:text-purple-400 flex-shrink-0" />
                            <span className="font-medium">
                              {meeting.startTime.toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                              {meeting.endTime && meeting.startTime.getTime() !== meeting.endTime.getTime() && (
                                <> - {meeting.endTime.toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}</>
                              )}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Calendar size={16} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                            <span className="truncate">{meeting.workspace}</span>
                          </div>
                          
                          {meeting.location && (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <MapPin size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                              <span className="truncate">{meeting.location}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Users size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <span className="truncate">{meeting.participants.join(', ')}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex sm:flex-col items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 border shadow-sm ${
                          meeting.status === 'upcoming' 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                            : meeting.status === 'completed'
                            ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'
                            : 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                        }`}>
                          {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                        </span>
                        
                        {hoveredMeeting === meeting.id && (
                          <div className="flex items-center gap-2">
                            <button className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all border border-gray-300 dark:bg-gray-700/50 dark:hover:bg-gray-600/50 dark:border-gray-600/50">
                              <Edit size={16} className="text-gray-700 dark:text-gray-300" />
                            </button>
                            <button className="p-2 bg-rose-100 hover:bg-rose-200 rounded-lg transition-all border border-rose-300 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 dark:border-rose-500/40">
                              <Trash size={16} className="text-rose-700 dark:text-rose-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Upcoming Events Summary */}
        <div
          className="
            rounded-lg border p-6 shadow-xl backdrop-blur-sm
            bg-gradient-to-br from-purple-600/10 via-indigo-600/10 to-pink-600/10
            dark:from-purple-600/10 dark:via-indigo-600/10 dark:to-pink-600/10
            border-purple-500/30 dark:border-purple-500/30
          "
        >
          <h3
            className="
              text-xl font-bold mb-4 flex items-center gap-2
              text-gray-900 dark:text-white
            "
          >
            <Clock
              size={24}
              className="text-purple-600 dark:text-purple-400"
            />
            Upcoming Events
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayEvents
              .filter((m) => {
                return m.status === 'upcoming' || m.startTime > new Date();
              })
              .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
              .slice(0, 6)
              .map((meeting) => (
                <div
                  key={meeting.id}
                  onClick={() => handleEventClick(meeting)}
                  className="
                    rounded-lg p-4 border transition-all cursor-pointer group
                    bg-white/70 hover:bg-white/90 border-gray-300 hover:border-purple-300
                    dark:bg-gray-800/50 dark:hover:bg-gray-700/60
                    dark:border-gray-700/50 dark:hover:border-purple-500/50
                  "
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg flex-shrink-0 ${getEventColor(
                        meeting.type
                      ).split(' ')[0]}`}
                    >
                      {getTypeIcon(meeting.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className="
                          font-semibold mb-1 truncate transition-colors
                          text-gray-900 group-hover:text-purple-700
                          dark:text-white dark:group-hover:text-purple-300
                        "
                      >
                        {meeting.title}
                      </h4>

                      <p
                        className="
                          text-xs mb-2
                          text-gray-500 dark:text-gray-400
                        "
                      >
                        {meeting.startTime.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {meeting.startTime.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${getPriorityColor(
                            meeting.priority
                          )}`}
                        />
                        <span
                          className="
                            text-xs truncate
                            text-gray-600 dark:text-gray-400
                          "
                        >
                          {meeting.workspace}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* New Meeting Modal */}
        <NewMeetingModal
          isOpen={showNewMeetingModal}
          onClose={() => setShowNewMeetingModal(false)}
        />
      </div>
    </Layout>
  );
};

export default MyCalendar;