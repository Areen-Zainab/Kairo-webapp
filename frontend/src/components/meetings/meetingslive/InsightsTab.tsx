import React from 'react';

interface Insight { id: string; text: string; timestamp: string; category: 'decision' | 'question' | 'important' }

interface InsightsTabProps {
  insights: Insight[];
  getCategoryColor: (category: string) => string;
  onAddInsight?: (text: string) => void;
}

const InsightsTab: React.FC<InsightsTabProps> = ({ insights, getCategoryColor, onAddInsight }) => {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
      <div className="rounded-lg p-3 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Add insight..."
            className="flex-1 px-2.5 py-1.5 rounded text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500/40 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white dark:placeholder-slate-500"
            onKeyDown={(e) => { if (e.key === 'Enter' && onAddInsight) { onAddInsight((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
          />
          <button className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm font-medium" onClick={() => { /* noop */ }}>Add</button>
        </div>
      </div>

      <div className="rounded-lg p-3 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
          Summary
        </h3>
        <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
          Team is discussing Q4 planning priorities. Main focus on mobile app development and design system completion.
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Key Insights</h3>
        <div className="space-y-1.5">
          {insights.map((insight) => (
            <div key={insight.id} className={`border rounded-lg p-2.5 ${getCategoryColor(insight.category)}`}>
              <div className="flex items-start gap-1.5">
                <p className="text-xs font-medium flex-1 text-gray-800 dark:text-inherit">{insight.text}</p>
              </div>
              <p className="text-xs opacity-70 ml-4.5 mt-1 text-gray-500 dark:text-inherit">{insight.timestamp}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InsightsTab;

