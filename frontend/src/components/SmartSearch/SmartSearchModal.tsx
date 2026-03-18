import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, FileText, MessageSquare, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';

interface SearchResult {
  id: string;
  meeting_id: number;
  content_type: string;
  content: string;
  distance: number;
  meeting_title: string;
  start_time: string;
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
  
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Handle Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // You ideally trigger open from the parent, but since we handle 
          // Cmd+K globally, we dispatch a custom event or let the parent do it.
          // In this implementation, the parent will listen for the standard event or we do it here if we expose an open method.
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setError(null);
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
          setResults(res.data.results || []);
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

          {!isSearching && results.length > 0 && (
            <div className="py-2">
              <h3 className="px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Semantic Matches
              </h3>
              <ul className="space-y-1">
                {results.map((result) => (
                  <li key={result.id}>
                    <button
                      onClick={() => handleResultClick(result.meeting_id)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition group flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getIconForType(result.content_type)}
                          <span className="font-medium text-sm text-slate-900 dark:text-slate-200">
                            {result.meeting_title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(result.start_time)}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 transition">
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 pl-6">
                        ...{result.content}...
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
