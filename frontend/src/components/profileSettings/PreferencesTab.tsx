import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Globe } from 'lucide-react';
// To enable real timezone data, first install the library:
// npm install @vvo/tzdb
import { timeZonesNames } from '@vvo/tzdb';

interface MeetingPreferences {
  autoJoin: boolean;
  autoRecord: boolean;
  defaultDuration: number;
  timezone: string;
}

interface PreferencesTabProps {
  preferences: MeetingPreferences;
  onSave: (preferences: MeetingPreferences) => void;
}

// A custom styled toggle switch component using a checkbox for accessibility
interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, checked, onChange, label }) => (
  <label className={`relative flex h-6 w-11 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 peer-focus:ring-offset-2 peer-focus:ring-offset-slate-900 ${checked ? 'bg-purple-600' : 'bg-slate-600'}`}>
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="sr-only peer" // Hide the default checkbox
    />
    <span className="sr-only">{label}</span>
    {/* The moving thumb of the toggle */}
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
    />
  </label>
);


const PreferencesTab: React.FC<PreferencesTabProps> = ({ preferences, onSave }) => {
  const [formData, setFormData] = useState<MeetingPreferences>(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  // Group timezones by region (e.g., America, Europe) for a better UX
  const groupedTimezones = useMemo(() => {
    return timeZonesNames.reduce((acc: Record<string, typeof timeZonesNames>, tz: typeof timeZonesNames[number]) => {
      // Use the first part of the IANA name as the group key (e.g., "America" from "America/New_York")
      const group = tz.split('/')[0];
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(tz);
      return acc;
    }, {} as Record<string, typeof timeZonesNames>);
  }, []);

  const timezoneGroups = Object.keys(groupedTimezones).sort();
  const durations = [15, 30, 45, 60, 90, 120];

  const handleChange = (field: keyof MeetingPreferences, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };
  
  const handleToggleChange = (field: 'autoJoin' | 'autoRecord', checked: boolean) => {
    setFormData(prev => ({ ...prev, [field]: checked }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(formData);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setFormData(preferences);
    setHasChanges(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Meeting Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Meeting Settings</h3>
        </div>

        {/* Auto Join */}
        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex-1 pr-4">
            <span className="text-sm font-medium text-slate-300">
              Auto-join scheduled meetings
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Automatically join meetings when they start
            </p>
          </div>
          <ToggleSwitch
            id="autoJoin"
            checked={formData.autoJoin}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleToggleChange('autoJoin', e.target.checked)}
            label="Toggle Auto-join"
          />
        </div>

        {/* Auto Record */}
        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex-1 pr-4">
            <span className="text-sm font-medium text-slate-300">
              Auto-record meetings
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Start recording automatically when meeting begins
            </p>
          </div>
          <ToggleSwitch
            id="autoRecord"
            checked={formData.autoRecord}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleToggleChange('autoRecord', e.target.checked)}
            label="Toggle Auto-record"
          />
        </div>

        {/* Default Duration */}
        <div className="space-y-2 pt-2">
          <label className="flex items-center space-x-2 text-sm font-medium text-slate-300">
            <Clock className="w-4 h-4" />
            <span>Default meeting duration</span>
          </label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {durations.map((duration) => (
              <button
                key={duration}
                type="button"
                onClick={() => handleChange('defaultDuration', duration)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.defaultDuration === duration
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                {duration}m
              </button>
            ))}
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-2 pt-2">
          <label htmlFor="timezone" className="flex items-center space-x-2 text-sm font-medium text-slate-300">
            <Globe className="w-4 h-4" />
            <span>Timezone</span>
          </label>
          <div className="relative">
             <select
               id="timezone"
               value={formData.timezone}
               onChange={(e) => handleChange('timezone', e.target.value)}
               className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer appearance-none pr-10"
             >
              <option value="" disabled className="bg-slate-900 text-slate-500">
                Select a timezone...
              </option>
              {timezoneGroups.map(group => (
                <optgroup key={group} label={group.replace(/_/g, ' ')} className="font-bold text-slate-400">
                  {groupedTimezones[group].map((tz: string) => (
                    <option key={tz} value={tz} className="bg-slate-900 font-normal text-white">
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/50">
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.97l3.71-3.74a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-slate-300 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 rounded-lg text-sm text-white font-medium transition-all"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default PreferencesTab;