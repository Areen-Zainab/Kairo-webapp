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
        <div key={item.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 hover:border-purple-500/50 transition-all cursor-pointer group">
          <p className="text-sm font-medium text-white group-hover:text-purple-300 mb-2">{item.topic}</p>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.relevance === 'High' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'}`}>
              {item.relevance}
            </span>
            <span className="text-xs text-slate-500">{item.linkedDate}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MemoryTab;

