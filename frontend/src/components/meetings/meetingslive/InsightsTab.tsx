import React from 'react';

interface Insight { id: string; text: string; timestamp: string; category: 'decision' | 'question' | 'important' }

interface InsightsTabProps {
  insights: Insight[];
  getCategoryColor: (category: string) => string;
  onAddInsight?: (text: string) => void;
}

const InsightsTab: React.FC<InsightsTabProps> = ({ insights, getCategoryColor, onAddInsight }) => {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Add insight..."
            className="flex-1 px-2.5 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            onKeyDown={(e) => { if (e.key === 'Enter' && onAddInsight) { onAddInsight((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
          />
          <button className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm font-medium" onClick={() => { /* noop */ }}>Add</button>
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
          Summary
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          Team is discussing Q4 planning priorities. Main focus on mobile app development and design system completion.
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-300 mb-2">Key Insights</h3>
        <div className="space-y-1.5">
          {insights.map((insight) => (
            <div key={insight.id} className={`border rounded-lg p-2.5 ${getCategoryColor(insight.category)}`}>
              <div className="flex items-start gap-1.5">
                <p className="text-xs font-medium flex-1">{insight.text}</p>
              </div>
              <p className="text-xs opacity-70 ml-4.5 mt-1">{insight.timestamp}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InsightsTab;

