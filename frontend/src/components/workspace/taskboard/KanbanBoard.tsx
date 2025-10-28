import React, { useState } from 'react';
import type { Task, TaskStatus, KanbanColumn } from './types';
import TaskCard from './TaskCard';
import { useTheme } from '../../../theme/ThemeProvider';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskMove: (taskId: string, fromStatus: TaskStatus, toStatus: TaskStatus) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskClick,
  onTaskStatusChange,
  onTaskMove,
}) => {
  const { theme } = useTheme();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const columns: KanbanColumn[] = [
    {
      id: 'todo',
      title: 'To Do',
      tasks: tasks.filter(task => task.status === 'todo'),
      color: 'bg-gray-500',
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      tasks: tasks.filter(task => task.status === 'in-progress'),
      color: 'bg-blue-500',
    },
    {
      id: 'review',
      title: 'Review',
      tasks: tasks.filter(task => task.status === 'review'),
      color: 'bg-purple-500',
    },
    {
      id: 'done',
      title: 'Done',
      tasks: tasks.filter(task => task.status === 'done'),
      color: 'bg-green-500',
    },
  ];

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragOver = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    
    if (task && task.status !== columnId) {
      onTaskMove(taskId, task.status, columnId);
    }
    
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const getColumnStats = (column: KanbanColumn) => {
    const totalTasks = column.tasks.length;
    const overdueTasks = column.tasks.filter(task => {
      if (!task.dueDate) return false;
      return new Date(task.dueDate) < new Date() && task.status !== 'done';
    }).length;
    
    return { totalTasks, overdueTasks };
  };

  return (
    <div className="flex gap-3 sm:gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
      {columns.map((column) => {
        const stats = getColumnStats(column);
        
        return (
          <div
            key={column.id}
            className={`
              flex-shrink-0 w-64 sm:w-72 md:w-80 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700
              ${dragOverColumn === column.id ? 'ring-2 ring-blue-500/50' : ''}
              transition-all duration-200
            `}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column header */}
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${column.color}`} />
                  <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {column.title}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {stats.totalTasks}
                  </span>
                  {stats.overdueTasks > 0 && (
                    <span className="text-[10px] sm:text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                      <span className="hidden sm:inline">{stats.overdueTasks} overdue</span>
                      <span className="sm:hidden">{stats.overdueTasks}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Column content */}
            <div className="p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 min-h-[300px] sm:min-h-[400px]">
              {column.tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 sm:h-32 text-slate-400 dark:text-slate-500">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-xs sm:text-sm">No tasks</p>
                </div>
              ) : (
                column.tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    className="cursor-move"
                  >
                    <TaskCard
                      task={task}
                      onTaskClick={onTaskClick}
                      onStatusChange={onTaskStatusChange}
                      isDragging={draggedTask?.id === task.id}
                      isOverdue={task.isOverdue}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Drop zone indicator */}
            {dragOverColumn === column.id && (
              <div className="mx-2 sm:mx-3 md:mx-4 mb-2 sm:mb-3 md:mb-4 border-2 border-dashed border-blue-400 rounded-lg h-12 sm:h-16 flex items-center justify-center bg-blue-50/50 dark:bg-blue-900/20">
                <span className="text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-medium px-2">
                  Drop task here
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
