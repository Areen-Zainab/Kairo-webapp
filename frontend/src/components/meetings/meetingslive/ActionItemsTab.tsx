import React, { useMemo, useState, useRef, useEffect } from 'react';

interface ActionItem { id: string; text: string; assignee: string; isCompleted: boolean }
type ActionStatus = 'confirmed' | 'removed' | 'undecided';

interface ActionItemsTabProps {
  actionItems: ActionItem[];
  actionStatusById: Record<string, ActionStatus>;
  newAction: string;
  onChangeNewAction: (v: string) => void;
  onAddAction: () => void;
  onSetStatus: (id: string, status: ActionStatus) => void;
}

const ActionItemsTab: React.FC<ActionItemsTabProps> = ({ actionItems, actionStatusById, newAction, onChangeNewAction, onAddAction, onSetStatus }) => {
  const [filter, setFilter] = useState<'all' | ActionStatus>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'assignee'>('newest');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (showFilterMenu && filterMenuRef.current && filterBtnRef.current &&
          !filterMenuRef.current.contains(t) && !filterBtnRef.current.contains(t)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showFilterMenu]);

  const counts = useMemo(() => {
    return actionItems.reduce(
      (acc, item) => {
        const status: ActionStatus = actionStatusById[item.id] ?? 'undecided';
        acc.all += 1;
        acc[status] += 1;
        return acc;
      },
      { all: 0, confirmed: 0, removed: 0, undecided: 0 } as Record<'all' | ActionStatus, number>
    );
  }, [actionItems, actionStatusById]);

  const filteredSorted = useMemo(() => {
    let list = actionItems.filter((item) => {
      const status: ActionStatus = actionStatusById[item.id] ?? 'undecided';
      return filter === 'all' ? true : status === filter;
    });
    if (sortBy === 'assignee') {
      list = [...list].sort((a, b) => a.assignee.localeCompare(b.assignee));
    } else {
      // ids are timestamps in this app; fallback safely
      const toNum = (id: string) => {
        const n = Number(id);
        return Number.isFinite(n) ? n : 0;
      };
      list = [...list].sort((a, b) => (sortBy === 'newest' ? toNum(b.id) - toNum(a.id) : toNum(a.id) - toNum(b.id)));
    }
    return list;
  }, [actionItems, actionStatusById, filter, sortBy]);

  return (
    <div className="space-y-3">
      {/* Sticky Filter/Search Panel */}
      <div className="sticky top-0 z-10 -mx-3 px-3 pt-2 pb-2 backdrop-blur border-b bg-white/90 border-gray-200 dark:bg-slate-900/70 dark:border-slate-700/60">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative">
            <button
              ref={filterBtnRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={showFilterMenu}
              aria-controls="action-filter-menu"
              onClick={() => setShowFilterMenu(v => !v)}
              className="px-2 py-1 rounded text-xs border bg-white border-gray-300 text-gray-700 hover:bg-gray-100 dark:bg-slate-800/40 dark:border-slate-700/60 dark:text-slate-200 dark:hover:text-white"
            >
              Filter: {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
            {showFilterMenu && (
              <div
                id="action-filter-menu"
                ref={filterMenuRef}
                role="menu"
                className="absolute mt-1 w-44 rounded-md shadow-lg p-1 bg-white border border-gray-200 dark:bg-slate-900/95 dark:border-slate-700/60"
              >
                {([
                  { key: 'all', label: 'All', count: counts.all },
                  { key: 'undecided', label: 'Undecided', count: counts.undecided },
                  { key: 'confirmed', label: 'Confirmed', count: counts.confirmed },
                  { key: 'removed', label: 'Removed', count: counts.removed },
                ] as { key: 'all' | ActionStatus; label: string; count: number }[]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    role="menuitemradio"
                    aria-checked={filter === key}
                    onClick={() => { setFilter(key); setShowFilterMenu(false); }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                      filter === key ? 'bg-purple-100 text-purple-700 dark:bg-purple-600/30 dark:text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700/60">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <label htmlFor="sort-actions" className="text-xs text-gray-600 dark:text-slate-400">Sort</label>
            <select
              id="sort-actions"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/40 bg-white border border-gray-300 text-gray-900 dark:bg-slate-800/60 dark:border-slate-700/60 dark:text-slate-200"
              aria-label="Sort action items"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="assignee">Assignee A–Z</option>
            </select>
          </div>
        </div>

        {/* Input */}
        <div className="mt-2 flex gap-1.5">
          <input
            type="text"
            value={newAction}
            onChange={(e) => onChangeNewAction(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onAddAction()}
            placeholder="Add action..."
            aria-label="Add action"
            className="flex-1 px-2.5 py-1.5 rounded text-sm placeholder-gray-400 bg-white border border-gray-300 text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500/40 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white dark:placeholder-slate-500"
          />
          <button onClick={onAddAction} className="p-1.5 bg-purple-600 hover:bg-purple-700 rounded transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* List */}
      {filteredSorted.length === 0 && (
        <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-800/40 p-4 text-center">
          <p className="text-sm text-slate-300">No action items{filter !== 'all' ? ` in ${filter}` : ''}. Add one to get started.</p>
        </div>
      )}

      {filteredSorted.map((item) => {
        const status: ActionStatus = actionStatusById[item.id] ?? 'undecided';
        const cardBase = 'relative rounded-lg p-3 transition-all';
        const cardByStatus =
          status === 'confirmed'
            ? 'bg-green-50 border border-green-300 hover:border-green-400 dark:bg-green-900/20 dark:border-green-500/50 dark:hover:border-green-400/60'
            : status === 'removed'
            ? 'bg-red-50 border border-red-300 hover:border-red-400 dark:bg-red-900/10 dark:border-red-500/50 dark:hover:border-red-400/60'
            : 'bg-yellow-50 border border-yellow-300 hover:border-yellow-400 dark:bg-slate-800/40 dark:border-yellow-500/40 dark:hover:border-yellow-400/50';
        const textByStatus =
          status === 'removed'
            ? 'line-through text-red-700 dark:text-red-300'
            : status === 'confirmed'
            ? 'text-gray-900 dark:text-white'
            : 'text-gray-900 dark:text-white';
        const indicatorByStatus =
          status === 'confirmed'
            ? 'bg-green-500'
            : status === 'removed'
            ? 'bg-red-500'
            : 'bg-yellow-500';
        const animateByStatus = status === 'undecided' ? 'animate-pulse' : '';

        return (
          <div key={item.id} className={`${cardBase} ${cardByStatus} ${animateByStatus}`} role="region" aria-label={`Action item ${status}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${indicatorByStatus} rounded-l-lg`} />
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${indicatorByStatus}/20 border border-white/10`}>
                      {status === 'confirmed' && (
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      )}
                      {status === 'removed' && (
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      )}
                      {status === 'undecided' && (
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-yellow-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 115.82 1c0 2-3 2-3 4"/><line x1="12" y1="17" x2="12" y2="17"/></svg>
                      )}
                    </span>
                    <p className={`text-sm leading-snug break-words whitespace-normal ${textByStatus}`} title={item.text}>{item.text}</p>
                  </div>
                </div>
                
                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className={`text-xs ${status === 'removed' ? 'text-red-300/80' : 'text-slate-400'}`}>{item.assignee}</p>
                  <div className="flex items-center gap-1.5">
                      <button onClick={() => onSetStatus(item.id, 'confirmed')} title="Confirm" className="p-1 rounded hover:bg-green-500/10 border border-transparent hover:border-green-500/30">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </button>
                      <button onClick={() => onSetStatus(item.id, 'removed')} title="Remove" className="p-1 rounded hover:bg-red-500/10 border border-transparent hover:border-red-500/30">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                      <button onClick={() => onSetStatus(item.id, 'undecided')} title="Undecided" className="p-1 rounded hover:bg-yellow-500/10 border border-transparent hover:border-yellow-500/30">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 115.82 1c0 2-3 2-3 4"/><line x1="12" y1="17" x2="12" y2="17"/></svg>
                      </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActionItemsTab;

