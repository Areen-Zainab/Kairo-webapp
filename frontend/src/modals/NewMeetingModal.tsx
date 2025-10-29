import React, { useState } from 'react';
import { Video, X, Zap, CalendarDays, UserPlus, Link, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import apiService from '../services/api';
import { useToastContext } from '../context/ToastContext';

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: number;
  onMeetingCreated?: () => void;
}

interface MeetingData {
  title: string;
  description: string;
  meetingLink: string;
  platform: 'zoom' | 'google-meet' | 'teams' | 'other';
  duration: number;
  participants: string[];
  meetingType: 'instant' | 'scheduled';
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledHour?: number;
  scheduledMinute?: number;
  scheduledPeriod?: 'AM' | 'PM';
}

const NewMeetingModal: React.FC<NewMeetingModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  onMeetingCreated
}) => {
  const navigate = useNavigate();
  const { workspaceId: urlWorkspaceId } = useParams();
  const { success: toastSuccess, error: toastError } = useToastContext();
  
  const [meetingType, setMeetingType] = useState<'instant' | 'scheduled'>('instant');
  const [formData, setFormData] = useState<MeetingData>({
    title: '',
    description: '',
    meetingLink: '',
    platform: 'zoom',
    duration: 60,
    participants: [],
    meetingType: 'instant',
    scheduledHour: new Date().getHours() % 12 || 12,
    scheduledMinute: Math.ceil(new Date().getMinutes() / 15) * 15,
    scheduledPeriod: new Date().getHours() >= 12 ? 'PM' : 'AM'
  });
  const [newParticipant, setNewParticipant] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [participantUserIds, setParticipantUserIds] = useState<number[]>([]);

  const handleInputChange = (field: keyof MeetingData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Sync meeting type when it changes
  const handleMeetingTypeChange = (type: 'instant' | 'scheduled') => {
    setMeetingType(type);
    setFormData(prev => ({
      ...prev,
      meetingType: type
    }));
  };

  const handleAddParticipant = async () => {
    const email = newParticipant.trim();
    
    if (!email) {
      return;
    }

    if (formData.participants.includes(email)) {
      toastError('Participant already added', 'Error');
      return;
    }

    const wsId = workspaceId || (urlWorkspaceId ? parseInt(urlWorkspaceId) : undefined);
    if (!wsId) {
      toastError('No workspace selected', 'Error');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toastError('Please enter a valid email address', 'Invalid Email');
      return;
    }

    try {
      // Lookup user by email
      const response = await apiService.searchWorkspaceMembers(wsId, email);
      
      if (response.error) {
        toastError(response.error, 'Error');
        return;
      }

      if (response.data?.members && response.data.members.length > 0) {
        const member = response.data.members[0];
        setFormData(prev => ({
          ...prev,
          participants: [...prev.participants, email]
        }));
        setParticipantUserIds(prev => [...prev, member.id]);
        toastSuccess(`Added ${member.name || member.email}`, 'Participant Added');
      } else {
        toastError(`User with email "${email}" not found in this workspace`, 'User Not Found');
      }
    } catch (error) {
      console.error('Error looking up participant:', error);
      toastError('Failed to find user. Make sure they are a member of this workspace.', 'Error');
    }
    
    setNewParticipant('');
  };

  const handleRemoveParticipant = (_participant: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter((_p, i) => i !== index)
    }));
    setParticipantUserIds(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // Validate form
      if (!formData.title || !formData.meetingLink) {
        toastError('Please fill in all required fields', 'Validation Error');
        setIsSubmitting(false);
        return;
      }

      if (meetingType === 'scheduled' && (!formData.scheduledDate || formData.scheduledHour === undefined || formData.scheduledMinute === undefined)) {
        toastError('Please select a date and time for the meeting', 'Validation Error');
        setIsSubmitting(false);
        return;
      }

      // Get the actual workspace ID
      const wsId = workspaceId || (urlWorkspaceId ? parseInt(urlWorkspaceId) : undefined);
      if (!wsId) {
        toastError('No workspace selected', 'Error');
        setIsSubmitting(false);
        return;
      }

      // Calculate start and end times
      const now = new Date();
      let startTime: Date;
      let endTime: Date;

      if (meetingType === 'instant') {
        // For instant meetings, start now and end based on duration
        startTime = now;
        endTime = new Date(now.getTime() + formData.duration * 60 * 1000);
      } else {
        // For scheduled meetings, parse date and time
        const dateStr = formData.scheduledDate;
        const hour = formData.scheduledHour || 12;
        const minute = formData.scheduledMinute || 0;
        const period = formData.scheduledPeriod || 'AM';
        
        if (!dateStr) {
          toastError('Please select a date and time', 'Validation Error');
          setIsSubmitting(false);
          return;
        }
        
        // Convert 12-hour to 24-hour format
        let hours24 = hour;
        if (period === 'PM' && hour !== 12) {
          hours24 = hour + 12;
        } else if (period === 'AM' && hour === 12) {
          hours24 = 0;
        }
        
        startTime = new Date(`${dateStr}T${hours24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
        endTime = new Date(startTime.getTime() + formData.duration * 60 * 1000);

        // Validate that scheduled time is in the future
        if (startTime <= now) {
          toastError('Please select a future date and time', 'Validation Error');
          setIsSubmitting(false);
          return;
        }
      }

      // Prepare meeting data
      const meetingData = {
        workspaceId: wsId,
        title: formData.title,
        description: formData.description || '',
        meetingLink: formData.meetingLink,
        platform: formData.platform,
        duration: formData.duration,
        meetingType: meetingType,
        status: meetingType === 'instant' ? 'in-progress' : 'scheduled',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        participantIds: participantUserIds, // Send actual participant IDs
      };

      // Create meeting
      const response = await apiService.createMeeting(meetingData);

      if (response.error) {
        toastError(response.error, 'Failed to Create Meeting');
        setIsSubmitting(false);
        return;
      }

      const createdMeeting = response.data?.meeting;
      if (!createdMeeting) {
        toastError('Meeting created but no data returned', 'Error');
        setIsSubmitting(false);
        return;
      }

      toastSuccess('Meeting created successfully!', 'Meeting Created');

      // Handle instant meeting flow
      if (meetingType === 'instant') {
        // Do not open external meeting link; navigate to in-app live view only
        const meetingId = createdMeeting.id;
        const navigatePath = urlWorkspaceId 
          ? `/workspace/${urlWorkspaceId}/meetings/live/${meetingId}`
          : `/workspace/meetings/live/${meetingId}`;
        navigate(navigatePath);
      }

      // Refresh meetings list
      if (onMeetingCreated) {
        onMeetingCreated();
      }

      handleClose();
    } catch (error) {
      console.error('Error creating meeting:', error);
      
      // Extract error message from various error types
      let errorMessage = 'Failed to create meeting';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toastError(errorMessage, 'Error');
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    const now = new Date();
    setFormData({
      title: '',
      description: '',
      meetingLink: '',
      platform: 'zoom',
      duration: 60,
      participants: [],
      meetingType: 'instant',
      scheduledHour: now.getHours() % 12 || 12,
      scheduledMinute: Math.ceil(now.getMinutes() / 15) * 15,
      scheduledPeriod: now.getHours() >= 12 ? 'PM' : 'AM'
    });
    setNewParticipant('');
    setMeetingType('instant');
    setParticipantUserIds([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
        {/* Fixed Header */}
        <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Join External Meeting
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Add Kairo to your Zoom, Google Meet, or Teams meeting
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Meeting Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Meeting Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleMeetingTypeChange('instant')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  meetingType === 'instant'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    meetingType === 'instant'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className={`font-semibold ${
                      meetingType === 'instant'
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-slate-900 dark:text-white'
                    }`}>
                      Join Now
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Join meeting immediately
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleMeetingTypeChange('scheduled')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  meetingType === 'scheduled'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    meetingType === 'scheduled'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}>
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className={`font-semibold ${
                      meetingType === 'scheduled'
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-slate-900 dark:text-white'
                    }`}>
                      Schedule Meeting
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Plan for later
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Meeting Details Form */}
          <div className="space-y-4">
            {/* Meeting Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Meeting Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter meeting title..."
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Meeting Platform */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Meeting Platform *
              </label>
              <select
                value={formData.platform}
                onChange={(e) => handleInputChange('platform', e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="zoom">Zoom</option>
                <option value="google-meet">Google Meet</option>
                <option value="teams">Microsoft Teams</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Meeting Link */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Meeting Link *
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={formData.meetingLink}
                  onChange={(e) => handleInputChange('meetingLink', e.target.value)}
                  placeholder="https://zoom.us/j/123456789 or https://meet.google.com/abc-defg-hij"
                  className="w-full px-4 py-3 pl-12 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Paste the meeting invitation link or join URL
              </p>
            </div>

            {/* Meeting Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of the meeting..."
                rows={3}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Duration (minutes)
              </label>
              <select
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
              </select>
            </div>

            {/* Scheduled Date & Time (only for scheduled meetings) */}
            {meetingType === 'scheduled' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.scheduledDate || ''}
                    onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Time *
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Hour 1–12 */}
                    <select
                      value={formData.scheduledHour ?? 12}
                      onChange={(e) => handleInputChange('scheduledHour', parseInt(e.target.value))}
                      className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>

                    <span className="text-slate-600 dark:text-slate-400 font-semibold">:</span>

                    {/* Minute 0–59 (no step limits) */}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={59}
                      value={formData.scheduledMinute ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(59, Number(e.target.value || 0)));
                        handleInputChange('scheduledMinute', v);
                      }}
                      className="w-20 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />

                    {/* AM/PM */}
                    <select
                      value={formData.scheduledPeriod ?? 'AM'}
                      onChange={(e) => handleInputChange('scheduledPeriod', e.target.value as 'AM'|'PM')}
                      className="px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Participants */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Participants
              </label>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="email"
                    value={newParticipant}
                    onChange={(e) => setNewParticipant(e.target.value)}
                    placeholder="Enter email address..."
                    className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                  />
                  <button
                    onClick={handleAddParticipant}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
                
                {formData.participants.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.participants.map((participant, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm"
                      >
                        <span>{participant}</span>
                        <button
                          onClick={() => handleRemoveParticipant(participant, index)}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Video className="w-3 h-3 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  How it works
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Kairo will join your external meeting as a participant to record, transcribe, and provide AI insights. 
                  Make sure to grant necessary permissions when prompted.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 px-6 py-4 rounded-b-2xl">
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={handleClose}
              className="px-6 py-3 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.title || !formData.meetingLink || (meetingType === 'scheduled' && (!formData.scheduledDate || formData.scheduledHour === undefined))}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : meetingType === 'instant' ? (
                <>
                  <ExternalLink className="w-4 h-4" />
                  <span>Join Meeting</span>
                </>
              ) : (
                <>
                  <CalendarDays className="w-4 h-4" />
                  <span>Schedule Meeting</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewMeetingModal;