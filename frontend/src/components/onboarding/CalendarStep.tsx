import React, { useState } from 'react';
import { Calendar, Check, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface CalendarStepProps {
  data: {
    calendarConnected: boolean;
    calendarProvider: 'google' | 'microsoft' | null;
    autoJoinEnabled: boolean;
  };
  onChange: (data: any) => void;
}

const CalendarStep: React.FC<CalendarStepProps> = ({ data, onChange }) => {
  const [connectingProvider, setConnectingProvider] = useState<'google' | 'microsoft' | null>(null);
  const [connectionError, setConnectionError] = useState('');

  const handleCalendarConnect = async (provider: 'google' | 'microsoft') => {
    setConnectingProvider(provider);
    setConnectionError('');
    
    try {
      // Simulate OAuth flow
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      onChange({
        calendarConnected: true,
        calendarProvider: provider,
        autoJoinEnabled: true
      });
    } catch (error) {
      setConnectionError('Failed to connect calendar. Please try again.');
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = () => {
    onChange({
      calendarConnected: false,
      calendarProvider: null,
      autoJoinEnabled: false
    });
  };

  const handleSkip = () => {
    onChange({
      calendarConnected: false,
      calendarProvider: null,
      autoJoinEnabled: false
    });
  };

  const isConnecting = connectingProvider !== null;

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
          {/* Calendar Provider Options */}
          <div className="space-y-3">
            <button
              onClick={() => handleCalendarConnect('google')}
              disabled={isConnecting}
              className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white">Google Calendar</h3>
                  <p className="text-xs text-slate-400">Connect with Google Workspace</p>
                </div>
              </div>
              {connectingProvider === 'google' ? (
                <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition-colors" />
              )}
            </button>

            <button
              onClick={() => handleCalendarConnect('microsoft')}
              disabled={isConnecting}
              className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white">Microsoft Outlook</h3>
                  <p className="text-xs text-slate-400">Connect with Microsoft 365</p>
                </div>
              </div>
              {connectingProvider === 'microsoft' ? (
                <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition-colors" />
              )}
            </button>
          </div>

          {/* Error Message */}
          {connectionError && (
            <div className="flex items-center space-x-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{connectionError}</span>
            </div>
          )}

          {/* Benefits Section - Compact */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="grid grid-cols-2 gap-2">
              {[
                'Auto-join meetings',
                'Real-time transcription',
                'Action item extraction',
                'Meeting summaries'
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className="w-full px-4 py-2 border border-white/20 text-white rounded-xl font-medium hover:bg-white/5 transition-all text-sm"
          >
            Skip for Now
          </button>
        </>
      ) : (
        <>
          {/* Connected State - Compact */}
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-green-500/50">
              <Check className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Calendar Connected!</h3>
            <p className="text-xs text-green-200 mb-3">
              {data.calendarProvider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'} is now connected
            </p>
            <div className="flex items-center justify-center space-x-2 text-xs text-green-300">
              <Check className="w-3.5 h-3.5" />
              <span>Auto-join enabled for upcoming meetings</span>
            </div>
          </div>

          {/* Auto-Join Settings - Compact */}
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
                  Kairo joins 30 seconds before meeting starts
                </div>
              </div>
            </label>
          </div>

          {/* Disconnect Option */}
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