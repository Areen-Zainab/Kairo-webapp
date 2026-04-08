import React from 'react';
import type { StatsCardProps } from './types';

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  className = ''
}) => {
  const getIconBg = () => {
    const palettes = [
      'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
      'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
      'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
      'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    ];
    const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palettes[hash % palettes.length];
  };

  const changeColor = changeType === 'positive'
    ? 'text-emerald-600 dark:text-emerald-400'
    : changeType === 'negative'
    ? 'text-red-500 dark:text-red-400'
    : 'text-slate-400 dark:text-slate-500';

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex items-center gap-3 ${className}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${getIconBg()}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-none mb-1">{title}</p>
        <p className="text-xl font-semibold text-slate-900 dark:text-white leading-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
      {change !== undefined && change !== 0 && (
        <span className={`text-xs font-medium flex-shrink-0 ${changeColor}`}>
          {changeType === 'positive' ? '+' : changeType === 'negative' ? '−' : ''}{Math.abs(change)}%
        </span>
      )}
    </div>
  );
};

export default StatsCard;
