import React, { useRef, useEffect } from 'react';
import type { WhisperRecap } from '../../../hooks/useWhisperRecaps';
import { Sparkles, Clock, AlertCircle } from 'lucide-react';

interface WhisperRecapTabProps {
  recaps: WhisperRecap[];
  loading: boolean;
  error: string | null;
  triggering: boolean;
}

const WhisperRecapTab: React.FC<WhisperRecapTabProps> = ({ recaps, loading, error, triggering }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [recaps]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-lg overflow-hidden border border-gray-100 dark:border-slate-800">
      <div className="flex-shrink-0 px-4 py-3 border-b bg-gray-50 border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Live Whisper Recaps
        </h3>
        <p className="text-[11px] text-gray-500 mt-1 dark:text-slate-400">
          Auto-generated micro-summaries of the ongoing meeting.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {loading && recaps.length === 0 ? (
          <div className="flex justify-center py-8">
             <div className="w-6 h-6 border-2 border-purple-500 rounded-full animate-spin border-t-transparent"></div>
          </div>
        ) : error && recaps.length === 0 ? (
          <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-500/10 dark:text-red-400">
             <AlertCircle className="w-4 h-4 shrink-0" />
             <p>{error}</p>
          </div>
        ) : recaps.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-slate-400">
            No recaps generated yet. They will appear here automatically or request one using the "Catch Me Up" button.
          </div>
        ) : (
          recaps.slice().reverse().map((recap, idx) => (
            <div key={recap.id || idx} className="bg-white border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] rounded-xl p-3 dark:bg-slate-800/60 dark:border-slate-700/50 transition-all">
               <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-400">
                   <Sparkles className="w-3 h-3" /> System Recap
                 </div>
                 <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                   <Clock className="w-3 h-3" /> {recap.timestamp}
                 </div>
               </div>
               <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                 {recap.text}
               </p>
            </div>
          ))
        )}
        
        {triggering && (
           <div className="flex justify-center py-3 my-2 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-800/30">
             <div className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400">
                <div className="w-3.5 h-3.5 border-2 border-purple-500 rounded-full animate-spin border-t-transparent"></div>
                Generating catch-up recap...
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default WhisperRecapTab;
