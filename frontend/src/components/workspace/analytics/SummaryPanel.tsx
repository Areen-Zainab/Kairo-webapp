import React from 'react';
import type { SummaryPanelProps } from './types';

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  insights,
  className = ''
}) => {
  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
    }
  };

  const getTypeIcon = (type: 'trend' | 'anomaly' | 'recommendation') => {
    switch (type) {
      case 'trend':
        return '📈';
      case 'anomaly':
        return '⚠️';
      case 'recommendation':
        return '💡';
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm">
            📊
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Analytics Insights
          </h3>
        </div>
        <div className="w-2 h-2 bg-purple-500"></div>
      </div>

      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`p-4 border-l-4 ${
              insight.type === 'trend' ? 'border-blue-500' :
              insight.type === 'anomaly' ? 'border-red-500' :
              'border-green-500'
            } bg-slate-50 dark:bg-slate-700/30`}
          >
            <div className="flex items-start gap-3">
              <div className="text-xl">
                {getTypeIcon(insight.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    {insight.title}
                  </h4>
                  <span className={`px-2 py-1 text-xs font-semibold uppercase tracking-wide ${getPriorityColor(insight.priority)}`}>
                    {insight.priority}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {insight.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {insights.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            No insights available at the moment
          </p>
        </div>
      )}
    </div>
  );
};

export default SummaryPanel;
