import React, { useState, useEffect } from 'react';
import { Clock, Bell, Plus, X } from 'lucide-react';
import apiService from '../../services/api';
import { useToast } from '../../hooks/useToast';

interface ReminderPreferences {
  enabled: boolean;
  intervals: number[];
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

const RemindersTab: React.FC = () => {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<ReminderPreferences>({
    enabled: true,
    intervals: [24, 1],
    quietHoursStart: null,
    quietHoursEnd: null,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newInterval, setNewInterval] = useState<string>('');

  useEffect(() => {
    fetchReminderPreferences();
  }, []);

  const fetchReminderPreferences = async () => {
    try {
      const response = await apiService.getReminderPreferences();
      if (response.data?.preferences) {
        setFormData(response.data.preferences);
      }
    } catch (error) {
      console.error('Failed to fetch reminder preferences:', error);
      showToast({ message: 'Failed to load reminder preferences', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    setFormData(prev => ({ ...prev, enabled: !prev.enabled }));
    setHasChanges(true);
  };

  const handleAddInterval = () => {
    const interval = parseFloat(newInterval);
    if (!isNaN(interval) && interval > 0) {
      if (!formData.intervals.includes(interval)) {
        setFormData(prev => ({
          ...prev,
          intervals: [...prev.intervals, interval].sort((a, b) => b - a),
        }));
        setNewInterval('');
        setHasChanges(true);
      } else {
        showToast({ message: 'This interval already exists', type: 'warning' });
      }
    } else {
      showToast({ message: 'Please enter a valid positive number', type: 'error' });
    }
  };

  const handleRemoveInterval = (interval: number) => {
    setFormData(prev => ({
      ...prev,
      intervals: prev.intervals.filter(i => i !== interval),
    }));
    setHasChanges(true);
  };

  const handleQuietHoursChange = (type: 'start' | 'end', value: string) => {
    const hour = value === '' ? null : parseInt(value);
    if (type === 'start') {
      setFormData(prev => ({ ...prev, quietHoursStart: hour }));
    } else {
      setFormData(prev => ({ ...prev, quietHoursEnd: hour }));
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const response = await apiService.updateReminderPreferences(formData);
      if (response.data) {
        showToast({ message: 'Reminder preferences saved successfully', type: 'success' });
        setHasChanges(false);
      } else {
        showToast({ message: response.error || 'Failed to save preferences', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to save reminder preferences:', error);
      showToast({ message: 'Failed to save preferences', type: 'error' });
    }
  };

  const handleCancel = () => {
    fetchReminderPreferences();
    setHasChanges(false);
  };

  const formatInterval = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.round(hours / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const backgroundClass = formData.enabled
    ? 'bg-purple-600 dark:bg-purple-600'
    : 'bg-slate-300 dark:bg-slate-600';
  const translateClass = formData.enabled ? 'translate-x-5' : 'translate-x-0';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Main Toggle */}
      <div className="
        flex items-center justify-between p-4 rounded-lg transition-all
        bg-white/70 border border-gray-300 hover:bg-white/90
        dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10
      ">
        <div className="flex-1 pr-4">
          <div className="flex items-center space-x-2 mb-1">
            <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-semibold text-gray-800 dark:text-slate-300">
              Task Deadline Reminders
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Get notified before your task deadlines
          </p>
        </div>

        <label
          className={`
            relative flex h-6 w-11 cursor-pointer items-center rounded-full border border-transparent 
            transition-colors duration-200 ease-in-out
            peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 
            peer-focus:ring-offset-2 peer-focus:ring-offset-gray-100
            dark:peer-focus:ring-offset-slate-900 ${backgroundClass}
          `}
        >
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={handleToggle}
            className="sr-only peer"
          />
          <span className="sr-only">Toggle task reminders</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${translateClass}`}
          />
        </label>
      </div>

      {/* Reminder Intervals */}
      {formData.enabled && (
        <>
          <div className="space-y-4 pt-4">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Reminder Intervals
              </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-slate-400">
              Choose when you want to be reminded before task deadlines (in hours)
            </p>

            {/* Current Intervals */}
            <div className="space-y-2">
              {formData.intervals.map((interval) => (
                <div
                  key={interval}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/70 border border-gray-300 dark:bg-white/5 dark:border-white/10"
                >
                  <span className="text-sm font-medium text-gray-800 dark:text-slate-300">
                    {formatInterval(interval)} before deadline
                  </span>
                  <button
                    onClick={() => handleRemoveInterval(interval)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                    title="Remove interval"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Interval */}
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0.25"
                step="0.25"
                value={newInterval}
                onChange={(e) => setNewInterval(e.target.value)}
                placeholder="Hours (e.g., 24, 1, 0.5)"
                className="flex-1 px-3 py-2 bg-white/70 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder-slate-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddInterval();
                  }
                }}
              />
              <button
                onClick={handleAddInterval}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            <div className="text-xs text-gray-500 dark:text-slate-400">
              Common intervals: 24 hours (1 day), 1 hour, 0.5 hours (30 minutes)
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-white/10">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Quiet Hours (Optional)
              </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-slate-400">
              Set hours when you don't want to receive reminders
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Start Time
                </label>
                <select
                  value={formData.quietHoursStart ?? ''}
                  onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                  className="w-full px-3 py-2 bg-white/70 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-white/5 dark:border-white/10 dark:text-white"
                >
                  <option value="">Not set</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  End Time
                </label>
                <select
                  value={formData.quietHoursEnd ?? ''}
                  onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                  className="w-full px-3 py-2 bg-white/70 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-white/5 dark:border-white/10 dark:text-white"
                >
                  <option value="">Not set</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formData.quietHoursStart !== null && formData.quietHoursEnd !== null && (
              <div className="text-xs text-gray-500 dark:text-slate-400">
                Reminders will be paused from {formData.quietHoursStart.toString().padStart(2, '0')}:00 to{' '}
                {formData.quietHoursEnd.toString().padStart(2, '0')}:00
              </div>
            )}
          </div>
        </>
      )}

      {/* Action Buttons */}
      {hasChanges && (
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-white/10">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm text-gray-700 transition-all dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:shadow-lg hover:shadow-purple-500/40 rounded-lg text-sm text-white font-medium transition-all"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default RemindersTab;

