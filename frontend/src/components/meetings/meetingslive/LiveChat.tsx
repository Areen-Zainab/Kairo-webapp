import React, { useEffect, useRef, useState } from 'react';

interface LiveChatProps {
  messages: { id: string; role: 'user' | 'bot'; text: string }[];
  input: string;
  onChangeInput: (v: string) => void;
  onSubmit: () => void;
}

const LiveChat: React.FC<LiveChatProps> = ({ messages, input, onChangeInput, onSubmit }) => {
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const handleMouseUp = () => {
      const sel = window.getSelection();
      const txt = sel ? sel.toString().trim() : '';
      if (!txt) {
        setSelectedText('');
        return;
      }
      // Ensure selection is within the transcript
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (el.contains(range.commonAncestorContainer as Node)) {
          setSelectedText(txt);
        } else {
          setSelectedText('');
        }
      }
    };
    el.addEventListener('mouseup', handleMouseUp);
    return () => el.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const referTextToChat = (text: string) => {
    const quoted = text.includes('\n') ? `"""\n${text}\n"""` : `"${text}"`;
    onChangeInput(input ? `${input}\n${quoted}` : quoted);
  };

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = 160; // px, ~10 rows depending on line-height
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  };

  useEffect(() => {
    autoGrow();
  }, [input]);

  return (
    <div className="h-full flex flex-col">
      {/* Transcript */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto px-2 sm:px-3 scrollbar-hide">
        <div className="max-w-2xl mx-auto py-3">
          {messages.length === 0 ? (
            <div className="min-h-[45vh] flex flex-col items-center justify-center">
              <div className="flex items-center gap-3 w-full text-gray-500 dark:text-slate-400">
                <span className="h-px flex-1 bg-gray-200 dark:bg-slate-700/60" />
                <span className="text-xs sm:text-sm tracking-wide">Chat with Meeting Memory</span>
                <span className="h-px flex-1 bg-gray-200 dark:bg-slate-700/60" />
              </div>
              <p className="mt-3 text-center text-xs sm:text-sm text-gray-500 dark:text-slate-500">Ask about prior meetings, decisions, or action items.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => {
                const isReferred = msg.text.startsWith('"') || msg.text.includes('"""');
                const isLarge = msg.text.length > 140;
                const grow = isReferred || isLarge;
                return (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`group relative ${grow ? 'max-w-[92%] sm:max-w-[78%] px-3 py-2' : 'max-w-[85%] sm:max-w-[70%] px-2.5 py-1.5'} text-sm leading-relaxed border ${
                      msg.role === 'user'
                        ? 'bg-purple-50 border-purple-300 text-purple-800 dark:bg-slate-800/40 dark:border-slate-700/60 dark:text-slate-100'
                        : 'bg-white border-gray-200 text-gray-800 dark:bg-slate-900/50 dark:border-slate-800/70 dark:text-slate-200'
                    } rounded-md shadow-sm whitespace-pre-wrap transition-all`}> 
                    {msg.text}
                    <button
                      type="button"
                      onClick={() => referTextToChat(msg.text)}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity absolute -top-3 ${msg.role === 'user' ? 'right-0' : 'left-0'} text-[10px] px-1.5 py-0.5 rounded border bg-white border-gray-300 text-gray-700 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-200`}
                      title="Refer in chat"
                    >
                      Refer
                    </button>
                    {msg.role === 'user' ? (
                      <>
                        <span className="pointer-events-none absolute top-2 -right-2 w-0 h-0 border-y-8 border-y-transparent border-l-8 border-l-purple-300 dark:border-l-slate-700/60"></span>
                        <span className="pointer-events-none absolute top-2 -right-[7px] w-0 h-0 border-y-[14px] border-y-transparent border-l-[14px] border-l-purple-50 dark:border-l-slate-800/40"></span>
                      </>
                    ) : (
                      <>
                        <span className="pointer-events-none absolute top-2 -left-2 w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-gray-300 dark:border-r-slate-800/70"></span>
                        <span className="pointer-events-none absolute top-2 -left-[7px] w-0 h-0 border-y-[14px] border-y-transparent border-r-[14px] border-r-white dark:border-r-slate-900/50"></span>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedText && (
          <div className="sticky bottom-3 flex justify-center">
            <button
              type="button"
              onClick={() => { referTextToChat(selectedText); setSelectedText(''); window.getSelection()?.removeAllRanges(); }}
              className="px-2.5 py-1 text-xs rounded-md bg-white border border-gray-300 text-gray-700 shadow hover:bg-gray-100 dark:bg-slate-900/80 dark:border-slate-700/60 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              Refer selection in chat
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t bg-gray-50 border-gray-200 dark:border-slate-800/70 dark:bg-transparent p-0.5 sm:p-2">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-1 sm:gap-1">
            <div className="flex-1 rounded-xl border px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-purple-500 bg-white border-gray-300 dark:bg-slate-950/60 dark:border-slate-700/60">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => onChangeInput(e.target.value)}
                onInput={autoGrow}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
                placeholder="Send a message..."
                rows={1}
                className="w-full resize-none bg-transparent text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none overflow-y-auto"
                style={{ maxHeight: 160 }}
              />
            </div>
            <button
              onClick={onSubmit}
              className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium shadow-sm border border-purple-500/30"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveChat;


