import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Calendar, FileText, MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import {
  HighlightedText,
  highlightTermsFromQuery,
  mergeHighlightTermArrays,
} from '../common/HighlightedText';
import type { MemorySearchHit } from '../workspace/memory/types';
import { buildSmartExcerpt } from '../../utils/searchExcerpt';
import { persistWorkspaceMemorySearch } from '../../utils/memorySearchSession';

interface SearchResult {
  id: string;
  meetingId: number;
  meetingTitle: string;
  meetingStartTime: string;
  contentType: string;
  snippet: string;
  content?: string;
  distance?: number;
  matchedTerms?: string[];
}

interface SmartSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: number;
}

const SmartSearchModal: React.FC<SmartSearchModalProps> = ({ isOpen, onClose, workspaceId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const normalizedResults: SearchResult[] = useMemo(() => {
    // Back-compat: older backend response used snake_case fields.
    return (results || []).map((r: any) => ({
      id: String(r.id),
      meetingId: r.meetingId ?? r.meeting_id,
      meetingTitle: r.meetingTitle ?? r.meeting_title ?? 'Untitled meeting',
      meetingStartTime: r.meetingStartTime ?? r.start_time,
      contentType: r.contentType ?? r.content_type ?? 'summary',
      snippet: r.snippet ?? (typeof r.content === 'string' ? r.content : ''),
      content: r.content,
      distance: r.distance,
      matchedTerms: Array.isArray(r.matchedTerms) ? r.matchedTerms : []
    }));
  }, [results]);

  // Handle ESC + keyboard navigation (↑↓ + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      if (!isOpen) return;
      if (normalizedResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, normalizedResults.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        const selected = normalizedResults[activeIndex];
        if (selected?.meetingId && workspaceId) {
          e.preventDefault();
          onClose();
          navigate(`/workspace/${workspaceId}/meetings/${selected.meetingId}`);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, isOpen, navigate, normalizedResults, onClose, workspaceId]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setError(null);
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Debounced search effect
  useEffect(() => {
    if (!query.trim() || !workspaceId) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const res = await apiService.searchMeetingMemory(workspaceId, query, 10);
        if (res.error) throw new Error(res.error);
        if (res.data) {
          const rows = res.data.results || [];
          setResults(rows);
          setActiveIndex(0);
          const hits: MemorySearchHit[] = rows.map((r: any) => ({
            meetingId: Number(r.meetingId ?? r.meeting_id),
            snippet: typeof r.snippet === 'string' ? r.snippet : '',
            content: typeof r.content === 'string' ? r.content : undefined,
            matchedTerms: Array.isArray(r.matchedTerms) ? r.matchedTerms : [],
            contentType: r.contentType ?? r.content_type
          }));
          persistWorkspaceMemorySearch(workspaceId, query.trim(), hits);
        }
      } catch (err: any) {
        console.error('Search error:', err);
        setError(err.message || 'Failed to search meeting memory.');
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  if (!isOpen) return null;

  const handleResultClick = (meetingId: number) => {
    onClose();
    navigate(`/workspace/${workspaceId}/meetings/${meetingId}`);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'transcript': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'summary': return <FileText className="w-4 h-4 text-purple-500" />;
      default: return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Search Container */}
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[70vh]">
        
        {/* Input Header */}
        <div className="flex items-center px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-0 focus:ring-0 text-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none"
            placeholder={workspaceId ? "Ask anything about your past meetings..." : "Please select a workspace to search"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!workspaceId}
          />
          <button 
            onClick={onClose}
            className="p-1 px-2 text-xs font-semibold text-slate-500 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            ESC
          </button>
        </div>

        {/* Results Area */}
        <div className="overflow-y-auto flex-1 p-2 bg-white dark:bg-slate-900 min-h-[100px]">
          {!workspaceId && (
            <div className="p-8 text-center text-slate-500">
              You must be inside a workspace to use Smart Search.
            </div>
          )}
          
          {workspaceId && !query && (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              <p className="mb-2">Search with natural language:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs">"What did we decide about the new marketing budget?"</span>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs">"When did Alice mention the database migration?"</span>
              </div>
            </div>
          )}

          {isSearching && (
            <div className="p-8 flex justify-center items-center text-purple-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-4 m-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!isSearching && query && results.length === 0 && !error && (
            <div className="p-8 text-center text-slate-500">
              No results found for "{query}". Try rephrasing?
            </div>
          )}

          {!isSearching && normalizedResults.length > 0 && (
            <div className="py-2">
              <h3 className="px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Semantic Matches
              </h3>
              <ul className="space-y-1">
                {normalizedResults.map((result, idx) => (
                  <li key={result.id}>
                    <button
                      onClick={() => handleResultClick(result.meetingId)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition group flex flex-col gap-1 ${
                        idx === activeIndex
                          ? 'bg-slate-100 dark:bg-slate-800/70'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getIconForType(result.contentType)}
                          <span className="font-medium text-sm text-slate-900 dark:text-slate-200">
                            {result.meetingTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {result.meetingStartTime ? formatDate(result.meetingStartTime) : '—'}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 transition">
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-4 pl-6">
                        {(() => {
                          const { prefix, context, jumped } = buildSmartExcerpt(
                            result.content || result.snippet || '',
                            query,
                            result.matchedTerms,
                            { prefixWords: 12, contextCharsAroundMatch: 220 }
                          );
                          const terms = mergeHighlightTermArrays(
                            result.matchedTerms,
                            highlightTermsFromQuery(query)
                          );
                          return (
                            <>
                              {/* Prefix — highlighted too in case the term appears there */}
                              {prefix && <HighlightedText text={prefix} terms={terms} />}
                              {/* Ellipsis separator shown only when we jumped to a distant match */}
                              {jumped && (
                                <span className="text-slate-400 dark:text-slate-500 select-none mx-0.5">…</span>
                              )}
                              {/* Context around the match — always highlighted */}
                              <HighlightedText text={context} terms={terms} />
                            </>
                          );
                        })()}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <span className="font-semibold px-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">↑↓</span> to navigate
          </div>
          <div>Powered by Kairo Meeting Memory AI</div>
        </div>
      </div>
    </div>
  );
};

export default SmartSearchModal;
