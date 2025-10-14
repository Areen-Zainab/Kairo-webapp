import React from 'react';

type MemoryItem = { id: string; topic: string; relevance: 'High'|'Medium'|'Low'; linkedDate: string };

interface MemoryTabProps {
  memoryItems: MemoryItem[];
}

const MemoryTab: React.FC<MemoryTabProps> = ({ memoryItems }) => {
  return (
    <div className="space-y-3">
      {/* LiveChat extracted; only memory items shown here */}

      {memoryItems.map((item) => (
        <div key={item.id} className="rounded-lg p-3 transition-all cursor-pointer group bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-800/40 dark:border-slate-700/50 dark:hover:border-purple-500/50">
          <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 mb-2">{item.topic}</p>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.relevance === 'High' ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30' : 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30'}`}>
              {item.relevance}
            </span>
            <span className="text-xs text-gray-600 dark:text-slate-500">{item.linkedDate}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MemoryTab;

