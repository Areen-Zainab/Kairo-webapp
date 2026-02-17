import React, { useState } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import type { Task, TaskStatus, KanbanColumn } from './types';
import TaskCard from './TaskCard';
import { useTheme } from '../../../theme/ThemeProvider';

interface KanbanBoardProps {
  tasks: Task[];
  columns: any[]; // Backend columns
  onTaskClick: (task: Task) => void;
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskMove: (taskId: string, fromStatus: TaskStatus, toStatus: TaskStatus) => void;
  onAddTask?: (columnId: number, columnName: string) => void;
  onDeleteColumn?: (columnId: number, columnName: string) => void;
  canManageColumns?: boolean;
}

// Helper function to map column name to status
const mapColumnNameToStatus = (columnName: string): TaskStatus => {
  const lowerName = columnName.toLowerCase();
  if (lowerName === 'to-do') return 'todo';
  if (lowerName === 'in-progress') return 'in-progress';
  if (lowerName === 'complete' || lowerName === 'completed') return 'done';
  if (lowerName === 'review') return 'review';
  return 'todo'; // default
};

// Helper to get Trello-inspired column colors and styles
const getColumnStyle = (columnName: string) => {
  const lowerName = columnName.toLowerCase();
  
  if (lowerName === 'to-do') {
    return {
      headerBg: 'bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800',
      headerText: 'text-slate-700 dark:text-slate-200',
      dotColor: 'bg-slate-500',
      borderColor: 'border-slate-300 dark:border-slate-600',
      cardBg: 'bg-white dark:bg-slate-800'
    };
  }
  
  if (lowerName === 'in-progress') {
    return {
      headerBg: 'bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/30',
      headerText: 'text-blue-700 dark:text-blue-300',
      dotColor: 'bg-blue-500',
      borderColor: 'border-blue-300 dark:border-blue-600',
      cardBg: 'bg-white dark:bg-slate-800'
    };
  }
  
  if (lowerName === 'complete' || lowerName === 'completed') {
    return {
      headerBg: 'bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-800/30',
      headerText: 'text-green-700 dark:text-green-300',
      dotColor: 'bg-green-500',
      borderColor: 'border-green-300 dark:border-green-600',
      cardBg: 'bg-white dark:bg-slate-800'
    };
  }
  
  if (lowerName === 'review') {
    return {
      headerBg: 'bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-800/30',
      headerText: 'text-purple-700 dark:text-purple-300',
      dotColor: 'bg-purple-500',
      borderColor: 'border-purple-300 dark:border-purple-600',
      cardBg: 'bg-white dark:bg-slate-800'
    };
  }
  
  // Custom columns
  return {
    headerBg: 'bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-800/30',
    headerText: 'text-indigo-700 dark:text-indigo-300',
    dotColor: 'bg-indigo-500',
    borderColor: 'border-indigo-300 dark:border-indigo-600',
    cardBg: 'bg-white dark:bg-slate-800'
  };
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  columns: backendColumns,
  onTaskClick,
  onTaskStatusChange,
  onTaskMove,
  onAddTask,
  onDeleteColumn,
  canManageColumns = false,
}) => {
  const { theme } = useTheme();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);

  // Convert backend columns to frontend format and keep backend column ID
  const columns = backendColumns
    .sort((a, b) => a.position - b.position) // Sort by position
    .map(col => {
      const statusId = mapColumnNameToStatus(col.name);
      const style = getColumnStyle(col.name);
      return {
        id: statusId,
        backendId: col.id, // Store backend column ID
        title: col.name,
        tasks: tasks.filter(task => task.status === statusId),
        color: style.dotColor,
        style: style, // Add style object
        isDefault: col.isDefault // Track if column is default
      };
    });

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
        const columnStyle = (column as any).style || getColumnStyle(column.title);
        
        return (
          <div
            key={column.id}
            className={`
              flex-shrink-0 w-64 sm:w-72 md:w-80 rounded-xl shadow-sm hover:shadow-md
              ${columnStyle.cardBg} ${columnStyle.borderColor} border-2
              ${dragOverColumn === column.id ? 'ring-4 ring-blue-400/30 scale-[1.02]' : ''}
              transition-all duration-200
            `}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
            onMouseEnter={() => setHoveredColumn(column.id)}
            onMouseLeave={() => setHoveredColumn(null)}
          >
            {/* Column header - Trello style */}
            <div className={`${columnStyle.headerBg} px-4 py-3 rounded-t-xl relative`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${column.color} shadow-sm`} />
                  <h3 className={`font-bold text-sm sm:text-base ${columnStyle.headerText} truncate tracking-wide`}>
                    {column.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs sm:text-sm font-semibold ${columnStyle.headerText} bg-white/40 dark:bg-black/20 px-2 py-0.5 rounded-full`}>
                    {stats.totalTasks}
                  </span>
                  {stats.overdueTasks > 0 && (
                    <span className="text-[10px] sm:text-xs bg-red-500 text-white font-bold px-2 py-1 rounded-full shadow-sm">
                      <span className="hidden sm:inline">{stats.overdueTasks} ⚠</span>
                      <span className="sm:hidden">{stats.overdueTasks}</span>
                    </span>
                  )}
                  {/* Delete column button - only for non-default columns and admins */}
                  {canManageColumns && !(column as any).isDefault && hoveredColumn === column.id && onDeleteColumn && (
                    <button
                      onClick={() => onDeleteColumn((column as any).backendId, column.title)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors group"
                      title="Delete column"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400 group-hover:text-red-700" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Column content */}
            <div className="p-3 space-y-2.5 min-h-[300px] sm:min-h-[400px] bg-gradient-to-b from-transparent to-slate-50/50 dark:to-slate-900/20">
              {/* Add task button */}
              {onAddTask && (
                <button
                  onClick={() => onAddTask((column as any).backendId, column.title)}
                  className={`w-full p-3 rounded-lg border-2 border-dashed ${columnStyle.borderColor} 
                    hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all duration-200 
                    flex items-center justify-center gap-2 group`}
                >
                  <Plus className={`w-4 h-4 ${columnStyle.headerText} group-hover:scale-110 transition-transform`} />
                  <span className={`text-sm font-medium ${columnStyle.headerText}`}>Add task</span>
                </button>
              )}
              
              {column.tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 sm:h-32 text-slate-400 dark:text-slate-500">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-xs sm:text-sm">No tasks yet</p>
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

            {/* Drop zone indicator - Trello style */}
            {dragOverColumn === column.id && (
              <div className="mx-3 mb-3 border-3 border-dashed border-blue-500 rounded-xl h-16 flex items-center justify-center bg-blue-100/80 dark:bg-blue-900/40 animate-pulse">
                <span className="text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Drop here
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
