import React from 'react';
import type { MemoryNode } from './types';
import { getTopicDisplay } from './topicDisplay';

interface TopicDetailSummaryProps {
  topic: MemoryNode;
}

/**
 * Full topic detail for the context panel Summary tab (name, mentions, sentiment).
 */
const TopicDetailSummary: React.FC<TopicDetailSummaryProps> = ({ topic }) => {
  const { title, mentions, sentiment } = getTopicDisplay(topic);

  const sentimentClass =
    sentiment == null || sentiment === ''
      ? 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200'
      : /positive|good|bull/i.test(sentiment)
        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25'
        : /negative|bad|bear/i.test(sentiment)
          ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/25'
          : 'bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-200 border border-slate-200 dark:border-slate-600/40';

  return (
    <div className="rounded-xl border border-purple-200/80 bg-gradient-to-b from-purple-50/90 to-white dark:from-purple-950/30 dark:to-slate-900/40 dark:border-purple-500/25 p-4 space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
          Topic name
        </p>
        <p className="text-base font-semibold text-slate-900 dark:text-white leading-snug">{title}</p>
      </div>

      <dl className="space-y-3 border-t border-slate-200/80 dark:border-slate-600/40 pt-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Mentions
          </dt>
          <dd className="text-sm text-slate-800 dark:text-slate-200 tabular-nums">
            {mentions != null ? (
              <span className="font-medium">
                {mentions} {mentions === 1 ? 'mention' : 'mentions'}
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Not available</span>
            )}
          </dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sentiment
          </dt>
          <dd className="text-sm">
            {sentiment != null && sentiment !== '' ? (
              <span className={`inline-flex items-center rounded-lg px-3 py-1.5 font-medium ${sentimentClass}`}>
                {sentiment}
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Not available</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
};

export default TopicDetailSummary;
