import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from './types';
import { useTheme } from '../../../theme/ThemeProvider';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  currentDate?: Date;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  onTaskClick,
  currentDate = new Date(),
}) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState(currentDate);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getTasksForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate).toISOString().split('T')[0];
      return taskDate === dateString;
    });
  };

  const getTasksCreatedOnDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return tasks.filter(task => {
      const createdDate = new Date(task.createdAt).toISOString().split('T')[0];
      return createdDate === dateString;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== 'done';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500',
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-500';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = getDaysInMonth(selectedDate);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Calendar header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="p-6">
        {/* Day names header */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-slate-600 dark:text-slate-400 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={index} className="h-24" />;
            }

            const dueTasks = getTasksForDate(date);
            const createdTasks = getTasksCreatedOnDate(date);
            const allTasks = [...dueTasks, ...createdTasks];

            return (
              <div
                key={date.toISOString()}
                className={`
                  h-24 border border-slate-200 dark:border-slate-700 p-2 cursor-pointer
                  hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors
                  ${isToday(date) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : ''}
                `}
                onClick={() => setSelectedDate(date)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`
                      text-sm font-medium
                      ${isToday(date) 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-slate-900 dark:text-white'
                      }
                    `}
                  >
                    {date.getDate()}
                  </span>
                  {allTasks.length > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {allTasks.length}
                    </span>
                  )}
                </div>

                {/* Task indicators */}
                <div className="space-y-1">
                  {dueTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className={`
                        h-2 rounded-full cursor-pointer
                        ${getPriorityColor(task.priority)}
                        ${isOverdue(task) ? 'ring-1 ring-red-400' : ''}
                      `}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/workspace/tasks?task=${task.id}`);
                      }}
                      title={`${task.title} (Due)`}
                    />
                  ))}
                  {createdTasks.slice(0, 2).map((task) => (
                    <div
                      key={`created-${task.id}`}
                      className="h-2 rounded-full bg-slate-400 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/workspace/tasks?task=${task.id}`);
                      }}
                      title={`${task.title} (Created)`}
                    />
                  ))}
                  {allTasks.length > 4 && (
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      +{allTasks.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-slate-600 dark:text-slate-400">Urgent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-slate-600 dark:text-slate-400">High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-slate-600 dark:text-slate-400">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-600 dark:text-slate-400">Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <span className="text-slate-600 dark:text-slate-400">Created</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
