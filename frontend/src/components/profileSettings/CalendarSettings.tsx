/**
 * CalendarSettings.tsx
 *
 * Settings panel for managing calendar connections.
 * Handles:
 *  - Listing existing connections with status (last sync, error)
 *  - Connecting Google Calendar (OAuth redirect)
 *  - Manual "Sync Now" per connection
 *  - Disconnecting (revoke + delete)
 *  - Post-OAuth redirect detection (?calendar=connected / error / denied)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  ExternalLink,
  Clock,
  X,
} from 'lucide-react';
import apiService from '../../services/api';

interface CalendarConnection {
  id: number;
  type: string;
  label: string | null;
  isEnabled: boolean;
  providerAccountId: string | null;
  calendarId: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

const CalendarSettings: React.FC = () => {
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Post-OAuth redirect detection ─────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarStatus = params.get('calendar');

    if (calendarStatus === 'connected') {
      showToast('success', 'Google Calendar connected successfully! Syncing your events…');
      // Clean URL
      const clean = new URL(window.location.href);
      clean.searchParams.delete('calendar');
      clean.searchParams.delete('provider');
      window.history.replaceState({}, '', clean.toString());
    } else if (calendarStatus === 'denied') {
      showToast('error', 'Calendar access was denied.');
      cleanup();
    } else if (calendarStatus === 'error') {
      const msg = params.get('msg') || 'Calendar connection failed.';
      showToast('error', msg);
      cleanup();
    }

    function cleanup() {
      const clean = new URL(window.location.href);
      ['calendar', 'provider', 'msg'].forEach((p) => clean.searchParams.delete(p));
      window.history.replaceState({}, '', clean.toString());
    }
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const statusResp = await apiService.getCalendarStatus();
      const enabled = statusResp.data?.enabled ?? false;
      setFeatureEnabled(enabled);

      if (enabled) {
        const connResp = await apiService.listCalendarConnections();
        setConnections((connResp.data?.connections as CalendarConnection[]) || []);
      }
    } catch (err) {
      console.error('[CalendarSettings] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const resp = await apiService.getGoogleCalendarAuthUrl();
      if (resp.error || !resp.data?.url) {
        showToast('error', resp.error || 'Failed to start Google OAuth');
        setConnectingGoogle(false);
        return;
      }
      window.location.href = resp.data.url;
    } catch {
      showToast('error', 'Failed to connect Google Calendar.');
      setConnectingGoogle(false);
    }
  };

  const handleSync = async (connectionId: number) => {
    setSyncingId(connectionId);
    try {
      const resp = await apiService.syncCalendarConnection(connectionId);
      if (resp.error) {
        showToast('error', resp.error);
      } else {
        const r = resp.data?.result;
        showToast('success', `Sync complete: +${r?.created ?? 0} created, ~${r?.updated ?? 0} updated.`);
        await loadData();
      }
    } catch {
      showToast('error', 'Sync failed. Please try again.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (connectionId: number) => {
    if (!window.confirm('Disconnect this calendar? Your imported meetings will remain.')) return;
    setDeletingId(connectionId);
    try {
      const resp = await apiService.deleteCalendarConnection(connectionId);
      if (resp.error) {
        showToast('error', resp.error);
      } else {
        showToast('success', 'Calendar disconnected.');
        setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      }
    } catch {
      showToast('error', 'Failed to disconnect. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const providerIcon = (type: string) => {
    if (type === 'oauth_google') {
      return (
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>
      );
    }
    return (
      <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
        <Calendar className="w-5 h-5 text-white" />
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        <span className="ml-2 text-slate-400 text-sm">Loading calendar settings…</span>
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-300 text-sm">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        Calendar integration is not enabled. Set <code className="font-mono">ENABLE_CALENDAR_INTEGRATION=true</code> in your backend environment.
      </div>
    );
  }

  const hasGoogle = connections.some((c) => c.type === 'oauth_google');

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`flex items-start space-x-2 p-3 rounded-xl text-sm border ${
            toast.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)}>
            <X className="w-4 h-4 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Section header */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Calendar Connections</h3>
        <p className="text-sm text-slate-400">
          Connect your calendar so Kairo can automatically import meetings and join them on your behalf.
        </p>
      </div>

      {/* Existing connections */}
      {connections.length > 0 && (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {providerIcon(conn.type)}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {conn.label || (conn.type === 'oauth_google' ? 'Google Calendar' : conn.type)}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>Last sync: {formatDate(conn.lastSyncAt)}</span>
                  </div>
                  {conn.lastSyncError && (
                    <p className="text-xs text-red-400 mt-0.5 truncate">
                      Error: {conn.lastSyncError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Sync Now */}
                <button
                  onClick={() => handleSync(conn.id)}
                  disabled={syncingId === conn.id}
                  title="Sync now"
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all disabled:opacity-50"
                >
                  {syncingId === conn.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>

                {/* Disconnect */}
                <button
                  onClick={() => handleDisconnect(conn.id)}
                  disabled={deletingId === conn.id}
                  title="Disconnect"
                  className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all disabled:opacity-50"
                >
                  {deletingId === conn.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connect Google (show if not already connected) */}
      {!hasGoogle && (
        <button
          onClick={handleConnectGoogle}
          disabled={connectingGoogle}
          className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/40 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Connect Google Calendar</p>
              <p className="text-xs text-slate-400">One-time sign in — Kairo syncs automatically</p>
            </div>
          </div>
          {connectingGoogle ? (
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition-colors" />
          )}
        </button>
      )}

      {/* Microsoft — P1 coming soon */}
      <button
        disabled
        title="Coming soon"
        className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl opacity-40 cursor-not-allowed"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-sm">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">Microsoft Outlook / Teams</p>
            <p className="text-xs text-slate-400">Coming soon — Microsoft 365 / Entra</p>
          </div>
        </div>
      </button>
    </div>
  );
};

export default CalendarSettings;
