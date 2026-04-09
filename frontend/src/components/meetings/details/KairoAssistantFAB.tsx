import React, { useEffect, useRef, useState } from 'react';
import apiService from '../../../services/api';
import { ChatMessageMarkdown } from '../../common/ChatMessageMarkdown';

interface KairoAssistantFABProps {
  onGeneratePersonalSummary: () => void;
  workspaceId?: number;
}

const KairoAssistantFAB: React.FC<KairoAssistantFABProps> = ({ workspaceId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [queryHistory, setQueryHistory] = useState<{ message: string; timestamp: Date; sender: 'user' | 'assistant' }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const exampleQueries = [
    'What decisions were made about the product roadmap?',
    'Show me all meetings related to user feedback',
    'What action items are still pending?',
    'Find discussions about the new feature launch',
    'What topics were discussed in the last sprint planning?',
    'Who was involved in the budget planning decisions?',
    'What are the key outcomes from the client meeting?',
    'Show me all decisions made in the last month'
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isFocused && !query) {
      const interval = setInterval(() => {
        setCurrentExampleIndex((prev) => (prev + 1) % exampleQueries.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [exampleQueries.length, isFocused, query]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [queryHistory]);

  const currentExample = exampleQueries[currentExampleIndex];
  const canAsk = Boolean(workspaceId) && query.trim().length > 0 && !isQuerying;

  const handleSubmit = async (submittedQuery?: string) => {
    const q = (submittedQuery ?? query).trim();
    if (!q) return;

    if (!workspaceId) {
      setQueryHistory((prev) => [...prev, {
        message: 'I need a workspace context to answer from meeting memory. Open a workspace page and ask again. Do you want to ask anything else?',
        timestamp: new Date(),
        sender: 'assistant'
      }]);
      return;
    }

    const userMessage = { message: q, timestamp: new Date(), sender: 'user' as const };
    setQueryHistory((prev) => [...prev, userMessage]);
    setIsTyping(true);
    setIsQuerying(true);
    setQuery('');

    try {
      const historyPayload = queryHistory.slice(-8).map((m) => ({
        role: m.sender === 'user' ? 'user' as const : 'bot' as const,
        text: m.message
      }));

      const response = await apiService.askMeetingMemoryQuestion(workspaceId, {
        question: q,
        chatHistory: [...historyPayload, { role: 'user', text: q }],
        limit: 8
      });

      const answer = response.error
        ? `I ran into an issue while searching meeting memory: ${response.error}\n\nDo you want to ask anything else?`
        : (response.data?.answer || 'I could not generate an answer right now. Do you want to ask anything else?');

      setQueryHistory((prev) => [...prev, {
        message: answer,
        timestamp: new Date(),
        sender: 'assistant'
      }]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setQueryHistory((prev) => [...prev, {
        message: `I ran into an issue while searching meeting memory: ${errorMessage}\n\nDo you want to ask anything else?`,
        timestamp: new Date(),
        sender: 'assistant'
      }]);
    } finally {
      setIsTyping(false);
      setIsQuerying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canAsk) {
        void handleSubmit();
      }
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setQueryHistory([]);
  };

  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const newHeight = Math.min(inputRef.current.scrollHeight, 120);
      inputRef.current.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [query]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.addEventListener('input', adjustTextareaHeight);
      return () => textarea.removeEventListener('input', adjustTextareaHeight);
    }
  }, []);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>

        <div className="absolute bottom-16 right-0 bg-slate-900 dark:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Ask Kairo
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black bg-opacity-5 animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 top-0 h-full w-96 max-w-[90vw] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl transform transition-transform duration-300 ease-out animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex-shrink-0 p-4 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">🤖</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Kairo Assistant</h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {queryHistory.length > 0 ? `${queryHistory.length} messages` : 'Ask about your workspace'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {queryHistory.length > 0 && (
                    <button
                      onClick={clearHistory}
                      className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                      title="Clear conversation"
                    >
                      <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {queryHistory.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-medium text-slate-900 dark:text-white mb-1">Start a conversation</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Ask questions about your workspace memory, meetings, and decisions.
                  </p>
                </div>
              )}

              {queryHistory.map((messageData, index) => (
                <div
                  key={index}
                  className={`flex mb-3 animate-in duration-300 ${messageData.sender === 'user' ? 'justify-end slide-in-from-right' : 'justify-start slide-in-from-left'}`}
                >
                  {messageData.sender === 'user' ? (
                    <div className="max-w-[85%] bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap shadow-sm hover:shadow-md transition-shadow">
                      <div className="mb-1">{messageData.message}</div>
                      <div className="text-xs text-blue-100 opacity-75">
                        {messageData.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[85%] bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed break-words shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">🤖</span>
                        </div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Memory Assistant</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {messageData.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap">
                        <ChatMessageMarkdown content={messageData.message} />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start mb-3">
                  <div className="max-w-[85%] bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">🤖</span>
                      </div>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Kairo Assistant</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Analyzing your workspace memory...</span>
                    </div>
                  </div>
                </div>
              )}

              {queryHistory.length === 0 && !isTyping && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Try asking:</h4>
                  {exampleQueries.slice(0, 4).map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleClick(example)}
                      className="w-full text-left p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600/50 text-slate-700 dark:text-slate-300 text-sm rounded-xl transition-all duration-200 border border-slate-200/50 dark:border-slate-600/30 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                        <span className="leading-relaxed">{example}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="flex-shrink-0 p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmit();
                }}
                className="relative"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-white dark:bg-slate-700/50 rounded-2xl border border-slate-200/50 dark:border-slate-600/30 shadow-sm" />
                  <div className="relative flex items-end gap-3 p-3">
                    <textarea
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyPress}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder={isFocused ? 'Type your question...' : currentExample}
                      className="flex-1 bg-transparent focus:outline-none text-sm text-slate-900 placeholder-slate-500 dark:text-white dark:placeholder-slate-400 resize-none min-h-[20px] max-h-[120px] leading-relaxed"
                      disabled={isQuerying}
                      rows={1}
                    />
                    <button
                      type="submit"
                      disabled={!query.trim() || isQuerying}
                      className="flex-shrink-0 w-8 h-8 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-full transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md ring-2 ring-blue-500/20 hover:ring-blue-500/40"
                    >
                      {isQuerying ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4 fill-none stroke-currentColor strokeWidth-2 transition-transform duration-200 hover:scale-110" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KairoAssistantFAB;
