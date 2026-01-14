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
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'negative':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/20';
    }
  };

  const getChangeIcon = () => {
    switch (changeType) {
      case 'positive':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'negative':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        );
    }
  };

  // Icon gradient colors based on title (for variety)
  const getIconGradient = () => {
    const gradients = [
      'from-purple-500 to-pink-500',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-emerald-500',
      'from-orange-500 to-red-500',
      'from-indigo-500 to-purple-500',
      'from-teal-500 to-green-500',
      'from-rose-500 to-pink-500',
      'from-amber-500 to-orange-500',
    ];
    const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return gradients[hash % gradients.length];
  };

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-gradient-to-br ${getIconGradient()} rounded-xl flex items-center justify-center text-white text-xl shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
              {icon}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {title}
              </h3>
            </div>
          </div>
          {change !== undefined && change !== 0 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${getChangeColor()}`}>
              {getChangeIcon()}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
        
        {/* Value */}
        <div className="mb-4">
          <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
        </div>

        {/* Mini trend chart */}
        {trend && trend.length > 0 && (
          <div className="h-16 flex items-end gap-1 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            {trend.map((point, index) => {
              const maxValue = Math.max(...trend.map(p => p.value), 1);
              const height = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
              const isLast = index === trend.length - 1;
              
              return (
                <div
                  key={index}
                  className="flex-1 relative group/bar"
                  title={`${point.label || point.date}: ${point.value}`}
                >
                  <div
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isLast
                        ? `bg-gradient-to-t ${getIconGradient()} shadow-lg`
                        : 'bg-gradient-to-t from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-500 group-hover/bar:from-slate-300 group-hover/bar:to-slate-400'
                    }`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
