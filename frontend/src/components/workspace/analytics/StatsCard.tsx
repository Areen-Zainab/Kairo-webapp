import React from 'react';
import type { StatsCardProps } from './types';

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  trend,
  className = ''
}) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-green-600 dark:text-green-400';
      case 'negative':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-slate-600 dark:text-slate-400';
    }
  };

  const getChangeIcon = () => {
    switch (changeType) {
      case 'positive':
        return '↗';
      case 'negative':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all duration-200 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            {title}
          </h3>
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-semibold ${getChangeColor()}`}>
            <span className="text-lg">{getChangeIcon()}</span>
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <div className="text-3xl font-bold text-slate-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      </div>

      {/* Mini trend chart */}
      {trend && trend.length > 0 && (
        <div className="h-12 flex items-end gap-0.5">
          {trend.map((point, index) => {
            const maxValue = Math.max(...trend.map(p => p.value));
            const height = (point.value / maxValue) * 100;
            return (
              <div
                key={index}
                className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-400 opacity-70 hover:opacity-100 transition-opacity"
                style={{ height: `${height}%` }}
                title={`${point.label || point.date}: ${point.value}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatsCard;
