import React from 'react';
import { Video } from 'lucide-react';
import ExportDropdown from './ExportDropdown';
import type { MeetingDetailsData } from './types';

interface MeetingHeaderProps {
  meeting: MeetingDetailsData;
  onDownloadRecording: () => void;
  onShareMeeting: () => void;
  onExportTranscript: () => void;
  onAddNotes: () => void;
}

const MeetingHeader: React.FC<MeetingHeaderProps> = ({
  meeting,
  onDownloadRecording,
  onShareMeeting,
  onExportTranscript,
  onAddNotes
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'recorded':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPlatformInfo = (platform?: string) => {
    if (!platform) return null;
    
    const platformMap: Record<string, { name: string; color: string; icon?: string }> = {
      'google-meet': { 
        name: 'Google Meet', 
        color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
      },
      'zoom': { 
        name: 'Zoom', 
        color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
      },
      'teams': { 
        name: 'Microsoft Teams', 
        color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
      },
      'other': { 
        name: 'Other Platform', 
        color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
      },
    };
    
    return platformMap[platform.toLowerCase()] || { 
      name: platform, 
      color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
    };
  };

  // Format duration for display (exact time, not rounded)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) {
      return `${secs} second${secs !== 1 ? 's' : ''}`;
    } else if (secs === 0) {
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
      return `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
    }
  };

  // Get actual audio duration in seconds, fallback to scheduled duration
  const getActualDurationSeconds = () => {
    if (meeting.stats?.audioDurationSeconds && meeting.stats.audioDurationSeconds > 0) {
      return meeting.stats.audioDurationSeconds;
    }
    // Fallback to scheduled duration (convert minutes to seconds)
    return (meeting.duration || 0) * 60;
  };

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left Section - Meeting Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {meeting.title}
              </h1>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(meeting.status)}`}>
                {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{meeting.date} at {meeting.time}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatDuration(getActualDurationSeconds())}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{meeting.stats.participantsCount} participants</span>
              </div>
              
              {meeting.platform && getPlatformInfo(meeting.platform) && (
                <div className="flex items-center gap-1">
                  <Video className="w-4 h-4" />
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getPlatformInfo(meeting.platform)!.color}`}>
                    {getPlatformInfo(meeting.platform)!.name}
                  </span>
                </div>
              )}
            </div>
            
            {meeting.description && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {meeting.description}
              </p>
            )}
          </div>

          {/* Right Section - Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <ExportDropdown
              meeting={meeting}
              onExportTranscript={onExportTranscript}
              onDownloadRecording={onDownloadRecording}
              onShareMeeting={onShareMeeting}
            />
            
            <button
              onClick={onAddNotes}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Add Notes
            </button>
          </div>
        </div>

        {/* Meeting Stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">Transcript Length</div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {meeting.stats.transcriptLength} words
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">Minutes Generated</div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {meeting.stats.minutesGenerated}
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">Slides</div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {meeting.stats.slidesCount}
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">Participants</div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {meeting.stats.participantsCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingHeader;
