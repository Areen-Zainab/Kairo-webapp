import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, XCircle, Trash2, RefreshCw, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import apiService from '../../services/api';
import type { SpeakerConsentStatus } from '../../services/api';

const VoiceTab: React.FC = () => {
  const [status, setStatus] = useState<SpeakerConsentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getSpeakerConsentStatus();
      if (response.data) {
        setStatus(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch voice status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRevoke = async () => {
    if (!window.confirm('Are you sure you want to revoke your biometric consent and delete your voice profile? This will prevent Kairo from identifying you in future meetings.')) {
      return;
    }
    setIsRevoking(true);
    try {
      await apiService.revokeSpeakerConsent();
      await fetchStatus();
    } catch (err) {
      console.error('Failed to revoke consent:', err);
    } finally {
      setIsRevoking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400">Loading voice profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Voice Identification</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manage your biometric voice profile and consent</p>
            </div>
          </div>
          {status?.enrolled ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 text-xs font-bold uppercase tracking-wider">
              <CheckCircle className="w-4 h-4" /> Active
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-xs font-bold uppercase tracking-wider">
              <XCircle className="w-4 h-4" /> Not Enrolled
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Biometric Consent</label>
              <div className="flex items-center gap-2 mt-1">
                {status?.biometricConsent ? (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Granted on {new Date(status.consentGivenAt!).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Not Granted
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Voice Footprint</label>
              <div className="flex items-center gap-2 mt-1">
                {status?.enrolled ? (
                  <span className="text-sm text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4" /> Last updated {new Date(status.lastEnrollmentAt!).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">No voice metrics found</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> How it works
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              When you enroll your voice, Kairo creates a mathematical fingerprint (embedding) of your speech. This fingerprint is used to identify you in meeting transcripts. Your voice data is processed securely and is never shared outside your workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            {!status?.biometricConsent ? (
              <button 
                onClick={() => window.location.href = '/onboarding'}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                <Fingerprint className="w-4 h-4" /> Complete Onboarding
              </button>
            ) : (
              <>
                <button 
                  onClick={() => {/* TODO: Show re-enroll modal */}}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> Re-enroll Voice
                </button>
                <button 
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                >
                  {isRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Revoke Consent & Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Privacy Notice */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-100/50 dark:border-white/5">
        <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Privacy & Security
        </h4>
        <ul className="space-y-3">
          {[
            'Your voice metrics are stored as non-reversible mathematical vectors.',
            'Kairo never stores raw audio recordings of your enrollment after processing.',
            'Identification is only performed for the workspaces you have joined.',
            'You can delete your voice profile and all associated data at any time.'
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-tight">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default VoiceTab;
