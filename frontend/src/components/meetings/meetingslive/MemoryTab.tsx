import React, { useEffect, useRef, useState } from 'react';
import { Brain, Calendar, Loader2 } from 'lucide-react';
import { apiService } from '../../../services/api';

interface TranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  chunkIndex: number;
  rawTimestamp: string;
}

interface SearchResult {
  id: string;
  meetingId: number;
  meetingTitle: string;
  meetingStartTime: string;
  contentType: string;
  snippet: string;
  distance?: number;
}

interface MemoryTabProps {
  transcriptEntries?: TranscriptEntry[];
  workspaceId?: number | string | null;
}

const SEARCH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const RECENT_CHARS = 600; // how many chars of recent speech to use as query

const MemoryTab: React.FC<MemoryTabProps> = ({ transcriptEntries = [], workspaceId }) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchedAt, setLastSearchedAt] = useState<Date | null>(null);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to the latest transcript so the interval always sees fresh data
  const transcriptRef = useRef(transcriptEntries);
  useEffect(() => {
    transcriptRef.current = transcriptEntries;
  }, [transcriptEntries]);

  const runSearch = async () => {
    const entries = transcriptRef.current;
    const wsId = workspaceId ? Number(workspaceId) : null;

    if (!wsId || isNaN(wsId)) return;

    // Build query from the most recent real speech (non-empty text only)
    const speechEntries = entries.filter(e => e.text?.trim());
    if (speechEntries.length === 0) return;

    // Concatenate all speech text and take the last RECENT_CHARS characters
    const fullText = speechEntries.map(e => e.text.trim()).join(' ');
    const query = fullText.slice(-RECENT_CHARS).trim();
    if (!query) return;

    // Avoid re-searching if the text hasn't changed since last search
    if (query === lastQuery) return;

    setIsSearching(true);
    setError(null);

    try {
      const res = await apiService.searchMeetingMemory(wsId, query, 5);
      if (res.error) {
        setError(res.error);
        return;
      }

      const rawResults: any[] = res.data?.results ?? [];

      // Normalise field names (same as SmartSearchModal back-compat)
      const normalised: SearchResult[] = rawResults.map((r: any) => ({
        id: String(r.id ?? r.meetingId ?? Math.random()),
        meetingId: r.meetingId ?? r.meeting_id,
        meetingTitle: r.meetingTitle ?? r.meeting_title ?? 'Untitled meeting',
        meetingStartTime: r.meetingStartTime ?? r.start_time ?? '',
        contentType: r.contentType ?? r.content_type ?? 'summary',
        snippet: r.snippet ?? (typeof r.content === 'string' ? r.content : ''),
        distance: r.distance,
      }));

      // De-duplicate by meetingId (keep first/best match per meeting)
      const seen = new Set<number>();
      const deduped = normalised.filter(r => {
        if (seen.has(r.meetingId)) return false;
        seen.add(r.meetingId);
        return true;
      });

      setResults(deduped);
      setLastSearchedAt(new Date());
      setLastQuery(query);
    } catch (e: any) {
      console.error('[MemoryTab] Search failed:', e);
      setError('Search failed. Will retry.');
    } finally {
      setIsSearching(false);
    }
  };

  // Run immediately when we first have enough transcript (after a short delay),
  // then every 2 minutes after that.
  useEffect(() => {
    // Initial search fires after 15 s so the user sees *something* early
    const initialTimer = setTimeout(() => {
      runSearch();
    }, 15_000);

    const interval = setInterval(() => {
      runSearch();
    }, SEARCH_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]); // Re-init when workspace changes

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const minutesSince = lastSearchedAt
    ? Math.round((Date.now() - lastSearchedAt.getTime()) / 60_000)
    : null;

  // Map distance → relevance label (distance 0 = identical, closer to 0 = more relevant)
  const relevanceLabel = (distance?: number): { label: string; cls: string } => {
    if (distance == null) return { label: 'Relevant', cls: 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30' };
    if (distance < 0.3) return { label: 'High', cls: 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30' };
    if (distance < 0.5) return { label: 'Medium', cls: 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30' };
    return { label: 'Low', cls: 'bg-gray-100 text-gray-600 border border-gray-300 dark:bg-slate-700/30 dark:text-slate-400 dark:border-slate-600/30' };
  };

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-gray-500 dark:text-slate-500 flex items-center gap-1.5">
          {isSearching ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
              <span className="text-purple-500 dark:text-purple-400">Searching memory…</span>
            </>
          ) : lastSearchedAt ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Updated {minutesSince === 0 ? 'just now' : `${minutesSince} min ago`}
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
              Listening to meeting…
            </>
          )}
        </span>
        {results.length > 0 && (
          <span className="text-[11px] text-gray-400 dark:text-slate-500">{results.length} found</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!isSearching && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Brain className="w-8 h-8 text-gray-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">No memory items yet</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            {workspaceId
              ? 'Related past meetings will appear once the conversation picks up'
              : 'No workspace linked to this meeting'}
          </p>
        </div>
      )}

      {/* Results */}
      {results.map((item) => {
        const rel = relevanceLabel(item.distance);
        return (
          <div
            key={item.id}
            className="rounded-lg p-3 transition-all cursor-pointer group bg-white border border-gray-200 hover:border-purple-300 dark:bg-slate-800/40 dark:border-slate-700/50 dark:hover:border-purple-500/50"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 mb-1 leading-snug">
              {item.meetingTitle}
            </p>
            {item.snippet && (
              <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                {item.snippet}
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${rel.cls}`}>
                {rel.label}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-500">
                <Calendar className="w-3 h-3" />
                {formatDate(item.meetingStartTime)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MemoryTab;
