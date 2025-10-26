import React from 'react';
import type { MeetingDetailsData } from './types';

interface OverviewPanelProps {
  meeting: MeetingDetailsData;
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({ meeting }) => {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getMeetingTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'sprint-planning': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'standup': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'retrospective': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'review': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'brainstorming': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      'client-meeting': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'other': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };
    return colors[type] || colors.other;
  };

  const getMeetingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'sprint-planning': 'Sprint Planning',
      'standup': 'Daily Standup',
      'retrospective': 'Retrospective',
      'review': 'Code Review',
      'brainstorming': 'Brainstorming',
      'client-meeting': 'Client Meeting',
      'other': 'Other'
    };
    return labels[type] || 'Other';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Meeting Type & Status */}
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${getMeetingTypeColor(meeting.meetingType)}`}>
          {getMeetingTypeLabel(meeting.meetingType)}
        </span>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
          meeting.status === 'recorded' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : meeting.status === 'completed'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
        }`}>
          {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
        </span>
      </div>

      {/* Key Information */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Organizer</h4>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
              {meeting.organizer.avatar || meeting.organizer.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {meeting.organizer.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {meeting.organizer.email}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Duration</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatDuration(meeting.duration)}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Date & Time</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {meeting.date} at {meeting.time}
          </p>
        </div>
      </div>

      {/* Participants */}
      <div>
        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
          Participants ({meeting.participants.length})
        </h4>
        <div className="space-y-2">
          {meeting.participants.map((participant) => (
            <div key={participant.id} className="flex items-center gap-3">
              <div className="w-6 h-6 bg-slate-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                {participant.avatar || participant.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {participant.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {participant.role.charAt(0).toUpperCase() + participant.role.slice(1)}
                </p>
              </div>
              {participant.joinedAt && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {participant.joinedAt}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">Transcript</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {meeting.stats.transcriptLength} words
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">Minutes</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {meeting.stats.minutesGenerated}
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">Slides</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {meeting.stats.slidesCount}
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">Files</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {meeting.files.length}
          </div>
        </div>
      </div>

      {/* Description */}
      {meeting.description && (
        <div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Description</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {meeting.description}
          </p>
        </div>
      )}

      {/* Important Points */}
      {meeting.aiInsights.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">Key Insights</h4>
          <div className="space-y-2">
            {meeting.aiInsights.slice(0, 3).map((insight) => (
              <div key={insight.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {insight.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewPanel;
