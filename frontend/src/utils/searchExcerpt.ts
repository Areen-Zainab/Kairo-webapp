import {
  highlightTermsFromQuery,
  mergeHighlightTermArrays,
} from '../components/common/HighlightedText';

/** Strip diarization noise like [SPEAKER_00] (20.1s - 44.5s): or [UNKNOWN] (ts): */
export function stripDiarizationLabels(text: string): string {
  return text
    .replace(/\[(?:SPEAKER_\d+|UNKNOWN|[A-Z0-9_]+)\]\s*\([^)]*\):\s*/gi, '')
    .replace(/\[[^\]]+\]:\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the char-offset of the first exact (case-insensitive) occurrence of `query`
 * or any of `terms` in `lower` (lowercased version of text).
 * Longer terms are checked first so multi-word phrases beat single words.
 */
function findFirstMatchPos(lower: string, query: string, terms: string[]): number {
  const qNorm = query.trim().toLowerCase();
  if (qNorm.length >= 2) {
    const idx = lower.indexOf(qNorm);
    if (idx >= 0) return idx;
  }
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  for (const t of sorted) {
    if (!t || t.length < 2) continue;
    const idx = lower.indexOf(t.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

export interface SmartExcerpt {
  /** First ~N words. Empty when the match falls within the prefix region. */
  prefix: string;
  /** Text around the match (or the whole visible region when prefix is empty). */
  context: string;
  /** True when prefix and context are disjoint — caller should render an ellipsis separator. */
  jumped: boolean;
}

/**
 * SmartSearch excerpt format:
 *   Case A — match in prefix region  → { prefix: '', context: 'Hello. Good morning…', jumped: false }
 *   Case B — match far from start    → { prefix: 'Hello. Good morning, Cairo…', context: '…testing phase…', jumped: true }
 *
 * Both prefix and context are clean text (diarization labels stripped).
 * The caller passes BOTH through <HighlightedText> so every occurrence of the
 * search term is amber-highlighted regardless of which part it falls in.
 */
export function buildSmartExcerpt(
  fullText: string,
  query: string,
  matchedTermsFromApi: string[] | undefined,
  options: {
    prefixWords?: number;             // default 12 (~10-15 words)
    contextCharsAroundMatch?: number; // default 220
  } = {}
): SmartExcerpt {
  const { prefixWords = 12, contextCharsAroundMatch = 220 } = options;

  const raw = String(fullText || '').trim();
  const empty: SmartExcerpt = { prefix: '', context: '', jumped: false };
  if (!raw) return empty;

  // Strip diarization labels so the user sees clean prose
  const text = stripDiarizationLabels(raw);
  if (!text) return empty;

  const lower = text.toLowerCase();
  const terms = mergeHighlightTermArrays(matchedTermsFromApi, highlightTermsFromQuery(query));
  const matchPos = findFirstMatchPos(lower, query, terms);

  // Build prefix text (first N words)
  const words = text.split(/\s+/);
  const prefixText = words.slice(0, prefixWords).join(' ');
  const prefixEnd = prefixText.length;

  // ── Case A: match is within / close to the prefix → show from the beginning
  if (matchPos < 0 || matchPos <= prefixEnd + 20) {
    const limit = prefixEnd + contextCharsAroundMatch;
    if (text.length <= limit) {
      return { prefix: '', context: text, jumped: false };
    }
    const cut = text.lastIndexOf(' ', limit);
    const shown = text.slice(0, cut > 0 ? cut : limit).trim();
    return { prefix: '', context: `${shown}…`, jumped: false };
  }

  // ── Case B: match is clearly beyond the prefix
  const leadIn = 50; // chars to show before the match word
  let ctxStart = Math.max(prefixEnd + 1, matchPos - leadIn);

  // Snap ctxStart to word boundary
  const spaceAfter = text.indexOf(' ', ctxStart);
  if (spaceAfter >= 0 && spaceAfter < ctxStart + 30) ctxStart = spaceAfter + 1;

  const ctxEnd = Math.min(text.length, ctxStart + contextCharsAroundMatch);
  const suffix = ctxEnd < text.length ? '…' : '';

  return {
    prefix: prefixText,
    context: `${text.slice(ctxStart, ctxEnd).trim()}${suffix}`,
    jumped: true,
  };
}

/**
 * Longer excerpt (used inside ContextPanel) – centers a wider window on the
 * match without the prefix trick, so the panel can show more surrounding context.
 */
export function buildCenteredExcerpt(
  fullText: string,
  query: string,
  matchedTermsFromApi: string[] | undefined,
  maxLen = 600
): string {
  const raw = String(fullText || '').trim();
  if (!raw) return '';

  const text = stripDiarizationLabels(raw);
  if (!text) return '';
  if (text.length <= maxLen) return text;

  const lower = text.toLowerCase();
  const terms = mergeHighlightTermArrays(matchedTermsFromApi, highlightTermsFromQuery(query));
  const matchPos = findFirstMatchPos(lower, query, terms);

  if (matchPos < 0) {
    return `${text.slice(0, maxLen).trim()}…`;
  }

  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, matchPos - half);
  let end = Math.min(text.length, start + maxLen);
  if (end - start < maxLen) start = Math.max(0, end - maxLen);

  // Snap start to word boundary
  if (start > 0) {
    const sp = text.lastIndexOf(' ', start);
    if (sp >= 0 && sp > start - 50) start = sp + 1;
  }

  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
