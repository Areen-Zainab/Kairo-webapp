import type { MemoryNode } from './types';

export interface TopicDisplay {
  title: string;
  mentions?: number;
  sentiment?: string;
}

function tryParseTopicJson(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return null;
  try {
    const v = JSON.parse(t) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function pickTitle(o: Record<string, unknown>): string | undefined {
  const keys = ['name', 'topic', 'title', 'label'] as const;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickMentions(o: Record<string, unknown>): number | undefined {
  const v = o.mentions;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function pickSentiment(o: Record<string, unknown>): string | undefined {
  const v = o.sentiment;
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

function parseRecordToDisplay(o: Record<string, unknown>): TopicDisplay | null {
  const title = pickTitle(o);
  if (!title) return null;
  return {
    title,
    mentions: pickMentions(o),
    sentiment: pickSentiment(o),
  };
}

/**
 * Normalizes topic nodes whose `label` / `summary` may be a JSON string like
 * `{"name":"…","mentions":5,"sentiment":"Neutral"}` (from `key_topics` storage).
 */
export function getTopicDisplay(topicNode: MemoryNode): TopicDisplay {
  const data = topicNode.data as {
    mentions?: number;
    sentiment?: string;
  };

  const fromApi: Pick<TopicDisplay, 'mentions' | 'sentiment'> = {
    mentions: typeof data.mentions === 'number' ? data.mentions : undefined,
    sentiment: typeof data.sentiment === 'string' ? data.sentiment : undefined,
  };

  const fromLabel = tryParseTopicJson(topicNode.label);
  const fromSummary = tryParseTopicJson(topicNode.summary);

  const parsed =
    (fromLabel && parseRecordToDisplay(fromLabel)) ||
    (fromSummary && parseRecordToDisplay(fromSummary));

  if (parsed) {
    return {
      title: parsed.title,
      mentions: fromApi.mentions ?? parsed.mentions,
      sentiment: fromApi.sentiment ?? parsed.sentiment,
    };
  }

  return {
    title: topicNode.label?.trim() || 'Topic',
    mentions: fromApi.mentions,
    sentiment: fromApi.sentiment,
  };
}

/** Use in keyword chips when `keywords[]` still contains a JSON topic string (legacy / cache). */
export function formatTopicKeywordChip(text: string): string {
  const o = tryParseTopicJson(text);
  if (!o) return text;
  const title = pickTitle(o);
  return title || text.trim();
}
