import React, { useState, useRef, useEffect } from 'react';
import { apiService } from '../../../services/api';
import { ChatMessageMarkdown } from '../../common/ChatMessageMarkdown';

interface MemoryQueryBarProps {
  workspaceId?: string;
  isOpen: boolean;
  onClose: () => void;
  onQuery: (query: string) => void;
  onHighlightNodes: (query: string) => void;
  isQuerying: boolean;
}

const MemoryQueryBar: React.FC<MemoryQueryBarProps> = ({
  workspaceId,
  isOpen,
  onClose,
  onQuery,
  onHighlightNodes,
  isQuerying,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [queryHistory, setQueryHistory] = useState<{message: string, timestamp: Date, sender: 'user' | 'assistant'}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const exampleQueries = [
    "What decisions were made about the product roadmap?",
    "Show me all meetings related to user feedback",
    "What action items are still pending?",
    "Find discussions about the new feature launch",
    "What topics were discussed in the last sprint planning?",
    "Who was involved in the budget planning decisions?",
    "What are the key outcomes from the client meeting?",
    "Show me all decisions made in the last month"
  ];

  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);

  const getLocalFallbackReply = (query: string): string => {
    return `I could not fetch a full memory answer for "${query}" right now. Please try again in a moment. Do you want to ask anything else?`;
  };

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
  }, [isFocused, query, exampleQueries.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [queryHistory]);

  const currentExample = exampleQueries[currentExampleIndex];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const trimmedQuery = query.trim();
      const userMessage = {message: trimmedQuery, timestamp: new Date(), sender: 'user' as const};
      setQueryHistory(prev => [...prev, userMessage]);
      setIsTyping(true);
      onQuery(trimmedQuery);
      setQuery('');

      try {
        const wid = Number(workspaceId);
        if (!workspaceId || Number.isNaN(wid)) {
          throw new Error('Open memory from a valid workspace to ask questions.');
        }

        const historyPayload = queryHistory.slice(-8).map((m) => ({
          role: m.sender === 'user' ? 'user' as const : 'bot' as const,
          text: m.message
        }));

        const response = await apiService.askMeetingMemoryQuestion(wid, {
          question: trimmedQuery,
          chatHistory: [...historyPayload, { role: 'user', text: trimmedQuery }],
          limit: 8
        });

        const answer = response.error
          ? `I ran into an issue while searching meeting memory: ${response.error}\n\nDo you want to ask anything else?`
          : (response.data?.answer || getLocalFallbackReply(trimmedQuery));

        const assistantReply = {
          message: answer,
          timestamp: new Date(),
          sender: 'assistant' as const
        };
        setQueryHistory(prev => [...prev, assistantReply]);
      } catch (err: any) {
        const assistantReply = {
          message: err?.message || getLocalFallbackReply(trimmedQuery),
          timestamp: new Date(),
          sender: 'assistant' as const
        };
        setQueryHistory(prev => [...prev, assistantReply]);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const clearHistory = () => {
    setQueryHistory([]);
  };

  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const newHeight = Math.min(inputRef.current.scrollHeight, 120);
      inputRef.current.style.height = newHeight + 'px';
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

  // Live graph highlight while typing — do not call with an empty string (submit clears the input and would wipe the last search highlight).
  useEffect(() => {
    if (!onHighlightNodes) return;
    const timeoutId = setTimeout(() => {
      const q = query.trim();
      if (q.length > 0) onHighlightNodes(q);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, onHighlightNodes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-5 animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-96 max-w-[90vw] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl transform transition-transform duration-300 ease-out animate-in slide-in-from-right duration-300 flex flex-col">
        {/* Header */}
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
                onClick={onClose}
                className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {/* Welcome Message */}
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

          {/* Message History */}
          {queryHistory.map((messageData, index) => (
            <div key={index} className={`flex mb-3 animate-in duration-300 ${
              messageData.sender === 'user' ? 'justify-end slide-in-from-right' : 'justify-start slide-in-from-left'
            }`}>
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
                    {messageData.sender === 'assistant'
                      ? <ChatMessageMarkdown content={messageData.message} />
                      : <p>{messageData.message}</p>
                    }
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
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
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">Analyzing your workspace memory...</span>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions */}
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
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="leading-relaxed">{example}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Query Input */}
        <div className="flex-shrink-0 p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative">
              {/* Background */}
              <div className="absolute inset-0 bg-white dark:bg-slate-700/50 rounded-2xl border border-slate-200/50 dark:border-slate-600/30 shadow-sm"></div>
              
              {/* Input container */}
              <div className="relative flex items-end gap-3 p-3">
                {/* Textarea */}
                <textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={isFocused ? "Type your question..." : currentExample}
                  className="flex-1 bg-transparent focus:outline-none text-sm text-slate-900 placeholder-slate-500 dark:text-white dark:placeholder-slate-400 resize-none min-h-[20px] max-h-[120px] leading-relaxed"
                  disabled={isQuerying}
                  rows={1}
                />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!query.trim() || isQuerying}
                  className="flex-shrink-0 w-8 h-8 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-full transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md ring-2 ring-blue-500/20 hover:ring-blue-500/40"
                >
                  {isQuerying ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
  );
};

export default MemoryQueryBar;
