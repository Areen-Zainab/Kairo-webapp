/**
 * CalendarStep.tsx
 *
 * Onboarding step for connecting a Google Calendar.
 * Replaces the mock simulation with a real OAuth redirect:
 *   1. Calls GET /api/calendar/oauth/google/start  → gets the Google consent URL
 *   2. Redirects the browser window to that URL
 *   3. Google redirects back to the backend callback (/api/calendar/oauth/google/callback)
 *   4. Backend redirects the browser to frontend /settings?calendar=connected
 *
 * During onboarding we detect the post-OAuth redirect via URL params.
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Check, AlertCircle, Loader2, ExternalLink, X } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

interface CalendarStepProps {
  data: {
    calendarConnected: boolean;
    calendarProvider: 'google' | 'microsoft' | null;
    autoJoinEnabled: boolean;
  };
  onChange: (data: any) => void;
}

const CalendarStep: React.FC<CalendarStepProps> = ({ data, onChange }) => {
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  // ── Detect post-OAuth redirect ──────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarStatus = params.get('calendar');
    const provider = params.get('provider') as 'google' | 'microsoft' | null;

    if (calendarStatus === 'connected' && provider) {
      onChange({
        calendarConnected: true,
        calendarProvider: provider,
        autoJoinEnabled: true,
      });
      // Clean up URL params
      const clean = new URL(window.location.href);
      clean.searchParams.delete('calendar');
      clean.searchParams.delete('provider');
      window.history.replaceState({}, '', clean.toString());
    } else if (calendarStatus === 'denied') {
      setConnectionError('Calendar access was denied. You can connect later in Settings.');
      const clean = new URL(window.location.href);
      clean.searchParams.delete('calendar');
      window.history.replaceState({}, '', clean.toString());
    } else if (calendarStatus === 'error') {
      const msg = params.get('msg') || 'Unknown error during calendar connection.';
      setConnectionError(msg);
      const clean = new URL(window.location.href);
      clean.searchParams.delete('calendar');
      clean.searchParams.delete('msg');
      window.history.replaceState({}, '', clean.toString());
    }
  }, []);

  // ── Start Google OAuth flow ─────────────────────────────────────────────────
  const handleGoogleConnect = async () => {
    setConnecting(true);
    setConnectionError('');

    try {
      const token = localStorage.getItem('authToken');
      const resp = await fetch(`${API_BASE_URL}/calendar/oauth/google/start`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to start Google OAuth');
      }

      const { url } = await resp.json();
      // Redirect the browser to Google's consent screen
      window.location.href = url;
    } catch (err: any) {
      setConnectionError(err.message || 'Failed to connect. Please try again.');
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    onChange({
      calendarConnected: false,
      calendarProvider: null,
      autoJoinEnabled: false,
    });
  };

  const handleSkip = () => {
    onChange({
      calendarConnected: false,
      calendarProvider: null,
      autoJoinEnabled: false,
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="text-center mb-4">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Connect Your Calendar</h2>
        <p className="text-slate-300 text-sm">
          Let Kairo automatically join your meetings
        </p>
      </div>

      {!data.calendarConnected ? (
        <>
          {/* Google OAuth Button */}
          <div className="space-y-3">
            <button
              onClick={handleGoogleConnect}
              disabled={connecting}
              className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-3">
                {/* Google logo colours */}
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white">Google Calendar</h3>
                  <p className="text-xs text-slate-400">Connect with Google Workspace or Gmail</p>
                </div>
              </div>
              {connecting ? (
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition-colors" />
              )}
            </button>

            {/* Microsoft — coming in P1 */}
            <button
              disabled
              title="Microsoft 365 integration coming soon"
              className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl opacity-40 cursor-not-allowed"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white">Microsoft Outlook</h3>
                  <p className="text-xs text-slate-400">Coming soon — Microsoft 365</p>
                </div>
              </div>
            </button>
          </div>

          {/* Error Message */}
          {connectionError && (
            <div className="flex items-start space-x-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{connectionError}</span>
              <button onClick={() => setConnectionError('')} className="ml-auto flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Benefits */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="grid grid-cols-2 gap-2">
              {[
                'Auto-join meetings',
                'Real-time transcription',
                'Action item extraction',
                'Meeting summaries',
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skip */}
          <button
            onClick={handleSkip}
            disabled={connecting}
            className="w-full px-4 py-2 border border-white/20 text-white rounded-xl font-medium hover:bg-white/5 transition-all text-sm disabled:opacity-50"
          >
            Skip for Now
          </button>
        </>
      ) : (
        <>
          {/* Connected State */}
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-green-500/50">
              <Check className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Calendar Connected!</h3>
            <p className="text-xs text-green-200 mb-3">
              {data.calendarProvider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'} is now syncing
            </p>
            <div className="flex items-center justify-center space-x-2 text-xs text-green-300">
              <Check className="w-3.5 h-3.5" />
              <span>Meetings will appear in Kairo within minutes</span>
            </div>
          </div>

          {/* Auto-Join Setting */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <label className="flex items-start space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={data.autoJoinEnabled}
                onChange={(e) => onChange({ autoJoinEnabled: e.target.checked })}
                className="w-4 h-4 mt-0.5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
              />
              <div>
                <div className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">
                  Automatically join meetings
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Kairo joins 30 seconds before your calendar meetings start
                </div>
              </div>
            </label>
          </div>

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="w-full text-center text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Disconnect calendar
          </button>
        </>
      )}
    </div>
  );
};

export default CalendarStep;