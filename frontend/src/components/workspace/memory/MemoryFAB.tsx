import React, { useState } from 'react';

interface MemoryFABProps {
  onReset: () => void;
  onExport: () => void;
  onFocusMode: () => void;
  onChatbot: () => void;
  focusModeEnabled: boolean;
  isChatbotOpen?: boolean;
}

const MemoryFAB: React.FC<MemoryFABProps> = ({
  onReset,
  onExport,
  onFocusMode,
  onChatbot,
  focusModeEnabled,
  isChatbotOpen = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const actions = [
    {
      id: 'chatbot',
      label: isChatbotOpen ? 'Close Chat' : 'Chat with Memory',
      icon: isChatbotOpen ? '❌' : '🤖',
      onClick: onChatbot,
      color: isChatbotOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
    },
    {
      id: 'focus',
      label: focusModeEnabled ? 'Exit Focus' : 'Focus Mode',
      icon: focusModeEnabled ? '🔍' : '🎯',
      onClick: onFocusMode,
      color: focusModeEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700',
    },
    {
      id: 'export',
      label: 'Export Graph',
      icon: '📤',
      onClick: onExport,
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      id: 'reset',
      label: 'Reset View',
      icon: '🔄',
      onClick: onReset,
      color: 'bg-slate-600 hover:bg-slate-700',
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Action buttons */}
      <div className={`flex flex-col gap-3 mb-4 transition-all duration-300 ${
        isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        {actions.map((action) => (
          <div key={action.id} className="relative group">
            {/* Tooltip */}
            <div className="absolute right-16 top-1/2 transform -translate-y-1/2 backdrop-blur-sm text-sm px-3 py-2 rounded-lg border shadow-lg bg-white/90 text-slate-900 border-slate-200/30 dark:bg-slate-800/90 dark:text-white dark:border-slate-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              {action.label}
            </div>
            
            {/* Action button */}
            <button
              onClick={() => {
                action.onClick();
                setIsExpanded(false);
              }}
              className={`w-12 h-12 ${action.color} text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-xl`}
            >
              {action.icon}
            </button>
          </div>
        ))}
      </div>

      {/* Main FAB */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-2xl ${
          isExpanded ? 'rotate-45' : 'rotate-0'
        }`}
      >
        {isExpanded ? '✕' : '⚡'}
      </button>
    </div>
  );
};

export default MemoryFAB;
