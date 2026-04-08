import React, { useMemo, useRef, useState } from 'react';
import apiService from '../../../services/api';
import { ChatMessageMarkdown } from '../../common/ChatMessageMarkdown';

interface KairoAssistantFABProps {
  onGeneratePersonalSummary: () => void;
  workspaceId?: number;
}

type ChatMessage = {
  id: string;
  role: 'user' | 'bot';
  text: string;
};

const KairoAssistantFAB: React.FC<KairoAssistantFABProps> = ({ workspaceId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canAsk = useMemo(() => {
    return Boolean(workspaceId) && question.trim().length > 0 && !isAsking;
  }, [isAsking, question, workspaceId]);

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
  };

  const handleAsk = async () => {
    if (!workspaceId) {
      appendMessage({
        id: Date.now().toString() + '-bot',
        role: 'bot',
        text: 'I need a workspace context to answer from meeting memory. Open a workspace page and ask again. Do you want to ask anything else?'
      });
      return;
    }
    const q = question.trim();
    if (!q) return;

    const userId = Date.now().toString();
    appendMessage({ id: userId, role: 'user', text: q });
    setQuestion('');
    setIsAsking(true);

    try {
      const historyPayload = messages.slice(-8).map((m) => ({ role: m.role, text: m.text }));
      const res = await apiService.askMeetingMemoryQuestion(workspaceId, {
        question: q,
        chatHistory: [...historyPayload, { role: 'user', text: q }],
        limit: 8
      });

      const answer = res.error
        ? `I ran into an issue while searching meeting memory: ${res.error}\n\nDo you want to ask anything else?`
        : (res.data?.answer || 'I could not generate an answer right now. Do you want to ask anything else?');

      appendMessage({ id: userId + '-bot', role: 'bot', text: answer });
    } catch (e: any) {
      appendMessage({
        id: userId + '-bot',
        role: 'bot',
        text: `I ran into an issue while searching meeting memory: ${e?.message || 'Unknown error'}\n\nDo you want to ask anything else?`
      });
    } finally {
      setIsAsking(false);
    }
  };

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
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-xl w-full mx-4 max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700">
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
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40 p-3 text-sm text-slate-700 dark:text-slate-300">
                    Ask me anything about previous meetings or ongoing context in this workspace.
                  </div>
                )}

                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-md px-3 py-2 ${
                          msg.role === 'user'
                            ? 'whitespace-pre-wrap bg-purple-100 text-sm text-purple-900 dark:bg-purple-600/30 dark:text-purple-100'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-100'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          msg.text
                        ) : (
                          <ChatMessageMarkdown content={msg.text} />
                        )}
                      </div>
                    </div>
                  ))}

                  {isAsking && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-md px-3 py-2 text-sm bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-100">
                        Thinking...
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (canAsk) handleAsk();
                      }
                    }}
                    placeholder={workspaceId ? 'Ask across this workspace…' : 'Open a workspace page to ask…'}
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    disabled={isAsking}
                  />
                  <button
                    onClick={handleAsk}
                    disabled={!canAsk}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 disabled:hover:bg-slate-400 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    {isAsking ? 'Asking…' : 'Ask'}
                  </button>
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
