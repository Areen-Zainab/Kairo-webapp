import React, { useState, useRef, useEffect } from 'react';
import type { AnalyticsChatProps } from './types';
import { ChatMessageMarkdown } from '../../common/ChatMessageMarkdown';

const AnalyticsChat: React.FC<AnalyticsChatProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{
    id: number;
    text: string;
    sender: 'user' | 'assistant';
    timestamp: Date;
  }>>([
    {
      id: 1,
      text: "Hi! I'm your analytics assistant. Ask me anything about your workspace data, meetings, or team performance!",
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestedQuestions = [
    "How many meetings were attended this week?",
    "Which team has the highest engagement?",
    "Show me task completion trends",
    "What's our average meeting duration?",
    "Which meeting type is most common?",
    "How has user activity changed over time?"
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: message.trim(),
      sender: 'user' as const,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "Based on your data, I can see some interesting patterns. Let me analyze that for you.",
        "Great question! Here's what I found in your analytics:",
        "I've processed your request. Here are the key insights:",
        "Looking at your workspace data, here's what stands out:",
        "Let me break down those metrics for you:"
      ];

      const assistantMessage = {
        id: Date.now() + 1,
        text: responses[Math.floor(Math.random() * responses.length)] + " This is a demo response. In a real implementation, this would connect to your analytics API to provide actual data insights.",
        sender: 'assistant' as const,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setMessage(question);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-20"
        onClick={onClose}
      />

      {/* Chat Panel */}
      <div className="absolute bottom-6 right-6 w-96 max-w-[90vw] h-[500px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-sm">
              📊
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Analytics Assistant
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ask about your data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  msg.sender === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                }`}
              >
                {msg.sender === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <ChatMessageMarkdown content={msg.text} className="text-slate-900 dark:text-white" />
                )}
                <p className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Try asking:</p>
            <div className="space-y-1">
              {suggestedQuestions.slice(0, 3).map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="block w-full text-left text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your analytics..."
              className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsChat;
