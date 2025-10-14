import React, { useState } from 'react';
import { Bell, Mail, MessageSquare } from 'lucide-react';

interface NotificationSettings {
  email: {
    meetingReminders: boolean;
    meetingSummaries: boolean;
    actionItems: boolean;
    weeklyDigest: boolean;
  };
  push: {
    meetingStarting: boolean;
    meetingJoined: boolean;
    mentionsAndReplies: boolean;
    actionItemsDue: boolean;
  };
  inApp: {
    meetingUpdates: boolean;
    transcriptionReady: boolean;
    sharedWithYou: boolean;
  };
}

interface NotificationsTabProps {
  settings: NotificationSettings;
  onSave: (settings: NotificationSettings) => void;
}

const NotificationsTab: React.FC<NotificationsTabProps> = ({ settings, onSave }) => {
  const [formData, setFormData] = useState<NotificationSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (category: keyof NotificationSettings, field: string) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: !prev[category][field as keyof typeof prev[typeof category]],
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(formData);
    setHasChanges(false);
  };

  const handleCancel = () => {
    setFormData(settings);
    setHasChanges(false);
  };

  const NotificationToggle = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: () => void;
  }) => {
    const backgroundClass = checked
      ? 'bg-purple-600 dark:bg-purple-600'
      : 'bg-slate-300 dark:bg-slate-600';
    const translateClass = checked ? 'translate-x-5' : 'translate-x-0';

    return (
      <div className="
        flex items-center justify-between p-4 rounded-lg transition-all
        bg-white/70 border border-gray-300 hover:bg-white/90
        dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10
      ">
        <div className="flex-1 pr-4">
          <span className="text-sm font-medium text-gray-800 dark:text-slate-300">
            {label}
          </span>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {description}
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
            checked={checked}
            onChange={onChange}
            className="sr-only peer"
          />
          <span className="sr-only">Toggle {label}</span>
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${translateClass}`}
          />
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Email Notifications */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Email Notifications
          </h3>
        </div>

        <NotificationToggle
          label="Meeting reminders"
          description="Get reminded before your scheduled meetings start"
          checked={formData.email.meetingReminders}
          onChange={() => handleToggle('email', 'meetingReminders')}
        />

        <NotificationToggle
          label="Meeting summaries"
          description="Receive AI-generated summaries after meetings end"
          checked={formData.email.meetingSummaries}
          onChange={() => handleToggle('email', 'meetingSummaries')}
        />

        <NotificationToggle
          label="Action items"
          description="Get notified when you're assigned action items"
          checked={formData.email.actionItems}
          onChange={() => handleToggle('email', 'actionItems')}
        />

        <NotificationToggle
          label="Weekly digest"
          description="Summary of your week's meetings and key insights"
          checked={formData.email.weeklyDigest}
          onChange={() => handleToggle('email', 'weeklyDigest')}
        />
      </div>

      {/* Push Notifications */}
      <div className="pt-6 border-t border-gray-200 dark:border-white/10 space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Push Notifications
          </h3>
        </div>

        <NotificationToggle
          label="Meeting starting soon"
          description="Notification 5 minutes before meeting starts"
          checked={formData.push.meetingStarting}
          onChange={() => handleToggle('push', 'meetingStarting')}
        />

        <NotificationToggle
          label="Someone joined meeting"
          description="Know when participants join your meeting"
          checked={formData.push.meetingJoined}
          onChange={() => handleToggle('push', 'meetingJoined')}
        />

        <NotificationToggle
          label="Mentions and replies"
          description="When someone mentions you in comments or replies"
          checked={formData.push.mentionsAndReplies}
          onChange={() => handleToggle('push', 'mentionsAndReplies')}
        />

        <NotificationToggle
          label="Action items due"
          description="Reminders when your action items are approaching deadline"
          checked={formData.push.actionItemsDue}
          onChange={() => handleToggle('push', 'actionItemsDue')}
        />
      </div>

      {/* In-App Notifications */}
      <div className="pt-6 border-t border-gray-200 dark:border-white/10 space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            In-App Notifications
          </h3>
        </div>

        <NotificationToggle
          label="Meeting updates"
          description="Changes to meeting time, participants, or details"
          checked={formData.inApp.meetingUpdates}
          onChange={() => handleToggle('inApp', 'meetingUpdates')}
        />

        <NotificationToggle
          label="Transcription ready"
          description="When meeting transcription is complete and ready"
          checked={formData.inApp.transcriptionReady}
          onChange={() => handleToggle('inApp', 'transcriptionReady')}
        />

        <NotificationToggle
          label="Shared with you"
          description="When someone shares a meeting or recording with you"
          checked={formData.inApp.sharedWithYou}
          onChange={() => handleToggle('inApp', 'sharedWithYou')}
        />
      </div>

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

export default NotificationsTab;
