import React, { type RefObject } from 'react';

export interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isUser: boolean;
  isSystemMessage?: boolean;
  systemMessageType?: 'privacy-on' | 'privacy-off';
}

interface TranscriptTabProps {
  transcriptRef: RefObject<HTMLDivElement>;
  transcript: TranscriptEntry[];
  onRefer?: (text: string) => void;
}

const TranscriptTab: React.FC<TranscriptTabProps> = ({ transcriptRef, transcript, onRefer }) => {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-gray-50 dark:bg-slate-900/20">
      <div className="px-4 py-2.5 flex-shrink-0 border-b bg-gray-100 border-gray-200 dark:border-slate-700/50 dark:bg-slate-800/20">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Live Transcript</h2>
      </div>
      <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 min-h-0 scrollbar-hide">
        {transcript.map((entry) => (
          entry.isSystemMessage ? (
            <div key={entry.id} className="relative my-8">
              <div className="h-px bg-gray-200 dark:bg-slate-700/60" />
              <div className="absolute inset-x-0 -top-2 flex justify-center">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] border bg-white text-gray-700 border-gray-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700/60">
                  <span className={`w-1.5 h-1.5 rounded-full ${entry.systemMessageType === 'privacy-on' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                  <span>{entry.systemMessageType === 'privacy-on' ? 'Privacy mode toggled on' : 'Privacy mode toggled off'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div key={entry.id} className={`group flex gap-2 mb-3 ${entry.isUser ? 'flex-row-reverse' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                {entry.speaker.split(' ').map(n => n[0]).join('')}
              </div>
              <div className={`flex-1 min-w-0 ${entry.isUser ? 'text-right' : ''}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-gray-900 dark:text-white">{entry.speaker}</span>
                  <span className="text-xs text-gray-500 dark:text-slate-500">{entry.timestamp}</span>
                </div>
                <div className={`relative inline-block px-3 py-2 rounded-lg text-sm ${entry.isUser ? 'bg-purple-50 border border-purple-300 text-purple-800 dark:bg-purple-600/20 dark:border-purple-500/30 dark:text-white' : 'bg-white border border-gray-200 text-gray-800 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-slate-200'}`}>
                  {entry.text}
                  {!!onRefer && (
                    <button
                      type="button"
                      onClick={() => onRefer(entry.text)}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity absolute -top-3 ${entry.isUser ? 'right-0' : 'left-0'} text-[10px] px-1.5 py-0.5 rounded border bg-white border-gray-300 text-gray-700 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-200`}
                      title="Refer in chat"
                    >
                      Refer
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default TranscriptTab;

