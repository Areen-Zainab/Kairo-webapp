import React from 'react';

const MARK_CLASS =
  'bg-amber-200 dark:bg-amber-400/35 text-amber-950 dark:text-amber-50 rounded px-0.5 font-semibold not-italic ring-1 ring-amber-500/40 dark:ring-amber-300/30';

/**
 * Wraps occurrences of any term in `text` with <mark>. Terms are matched case-insensitively.
 * Avoids RegExp#test global lastIndex bugs by classifying parts without reusing a global /g regex in a loop.
 */
export const HighlightedText: React.FC<{
  text: string;
  terms: string[];
  className?: string;
}> = ({ text, terms, className }) => {
  const cleaned = terms
    .map((t) => String(t || '').trim())
    .filter((t) => t.length > 0);

  if (!text || cleaned.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Longer tokens first so e.g. "user interface" wins over "user" in alternation.
  const sorted = [...cleaned].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const isHit = sorted.some((t) => part.toLowerCase() === t.toLowerCase());
        return isHit ? (
          <mark key={i} className={MARK_CLASS}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
};

/** Dedupe case-insensitively (first casing wins). */
export function mergeHighlightTermArrays(...lists: (string[] | undefined)[]): string[] {
  const map = new Map<string, string>();
  for (const list of lists) {
    for (const t of list || []) {
      const s = String(t || '').trim();
      if (!s) continue;
      const k = s.toLowerCase();
      if (!map.has(k)) map.set(k, s);
    }
  }
  return Array.from(map.values());
}

/** Terms useful for highlighting user queries (includes 2+ char tokens; sync loosely with backend stop-word list). */
export function highlightTermsFromQuery(query: string): string[] {
  const STOP = new Set([
    'the',
    'and',
    'for',
    'are',
    'but',
    'not',
    'you',
    'all',
    'can',
    'our',
    'out',
    'was',
    'how',
    'what',
    'when',
    'where',
    'which',
    'from',
    'that',
    'this',
    'with',
    'have',
    'has',
    'did',
    'does',
    'your',
    'they',
    'them',
    'their',
    'into',
    'about',
  ]);
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ''))
    .filter((w) => w.length >= 2 && !STOP.has(w));
}
