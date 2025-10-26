import React, { useState } from 'react';

interface KairoAssistantFABProps {
  onGeneratePersonalSummary: () => void;
}

const KairoAssistantFAB: React.FC<KairoAssistantFABProps> = ({ onGeneratePersonalSummary }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePersonalSummary = async () => {
    setIsGenerating(true);
    try {
      await onGeneratePersonalSummary();
    } finally {
      setIsGenerating(false);
    }
  };

  const quickActions = [
    {
      id: 'summary',
      title: 'Generate Personal Summary',
      description: 'Get a personalized summary focused on your tasks and responsibilities',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      action: handleGeneratePersonalSummary
    },
    {
      id: 'action-items',
      title: 'My Action Items',
      description: 'View all action items assigned to you',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      action: () => console.log('View action items')
    },
    {
      id: 'decisions',
      title: 'Relevant Decisions',
      description: 'See decisions that affect your work',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      action: () => console.log('View decisions')
    },
    {
      id: 'follow-ups',
      title: 'Follow-up Items',
      description: 'Check items that need your follow-up',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      action: () => console.log('View follow-ups')
    }
  ];

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>
        
        {/* Tooltip */}
        <div className="absolute bottom-16 right-0 bg-slate-900 dark:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Ask Kairo
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 dark:border-t-slate-700"></div>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Kairo Assistant
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Your AI meeting assistant
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                {/* Quick Actions */}
                <div>
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                    Quick Actions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quickActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={action.action}
                        disabled={isGenerating && action.id === 'summary'}
                        className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 text-purple-600 dark:text-purple-400">
                            {action.icon}
                          </div>
                          <div>
                            <h5 className="font-medium text-slate-900 dark:text-white text-sm">
                              {action.title}
                            </h5>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {action.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Chat Interface */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                    Ask Kairo Anything
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                          K
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            Hi! I'm Kairo, your AI meeting assistant. I can help you:
                          </p>
                          <ul className="text-xs text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                            <li>• Generate personalized summaries</li>
                            <li>• Find specific information from the meeting</li>
                            <li>• Identify your action items and responsibilities</li>
                            <li>• Answer questions about decisions made</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ask me anything about this meeting..."
                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors">
                        Ask
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
                    Recent Activity
                  </h4>
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                      No recent activity
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KairoAssistantFAB;
