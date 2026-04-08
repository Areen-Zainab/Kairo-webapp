import React, { useState } from 'react';
import { UserPlus, Check, Search, X, Loader2, User, Fingerprint, History, Info } from 'lucide-react';
import type { Participant } from './types';
import apiService from '../../../services/api';

interface SpeakerAssignmentPopoverProps {
  meetingId: number;
  speakerLabel: string;
  currentMapping?: {
    userId: number | null;
    userName: string | null;
    tierResolved: number;
    resolved: boolean;
  };
  participants: Participant[];
  onAssignmentComplete: () => void;
  onClose: () => void;
}

const SpeakerAssignmentPopover: React.FC<SpeakerAssignmentPopoverProps> = ({
  meetingId,
  speakerLabel,
  currentMapping,
  participants,
  onAssignmentComplete,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredParticipants = participants.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssign = async (userId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiService.manuallyAssignSpeaker(
        meetingId,
        speakerLabel,
        Number(userId)
      );
      onAssignmentComplete();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign speaker');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTierBadge = (tier: number) => {
    switch (tier) {
      case 1:
        return (
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
            <Fingerprint className="w-3" /> Biometric
          </div>
        );
      case 2:
      case 3:
        return (
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
            <History className="w-3" /> Historical
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
            <User className="w-3" /> Manual
          </div>
        );
    }
  };

  return (
    <div className="absolute z-[100] mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in duration-200">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Identify {speakerLabel.replace(/_/g, ' ')}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Link this voice to a participant
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-3">
        {/* Current Assignment if any */}
        {currentMapping?.resolved && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-blue-600/70 dark:text-blue-400/70 uppercase">Current Identity</span>
              {getTierBadge(currentMapping.tierResolved)}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {currentMapping.userName?.substring(0, 1) || 'U'}
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {currentMapping.userName}
              </span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search participants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            autoFocus
          />
        </div>

        {/* List */}
        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {filteredParticipants.length > 0 ? (
            filteredParticipants.map((p) => (
              <button
                key={p.id}
                onClick={() => handleAssign(p.id)}
                disabled={isSubmitting}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all ${
                  currentMapping?.userId === Number(p.id)
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 text-xs font-bold overflow-hidden">
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      p.name.substring(0, 1)
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                      {p.email}
                    </p>
                  </div>
                </div>
                {currentMapping?.userId === Number(p.id) ? (
                  <Check className="w-4 h-4 text-blue-500" />
                ) : (
                  <UserPlus className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                )}
              </button>
            ))
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No participants found</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 p-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 flex items-start gap-2">
            <Info className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-rose-600 dark:text-rose-400 leading-tight">
              {error}
            </p>
          </div>
        )}

        {isSubmitting && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeakerAssignmentPopover;
