import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiService } from '../../services/api';
import { useToastContext } from '../../context/ToastContext';
import UserAvatar from '../../components/ui/UserAvatar';
import { Clock, Calendar, Users, MapPin, Video, PenTool, Save, X, Globe, MessageSquare, ChevronLeft, Sparkles, FolderOpen, Building } from 'lucide-react';
import { useUser } from '../../context/UserContext';

const PreMeeting = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastContext();
  const { user, currentWorkspace } = useUser();
  
  const [meeting, setMeeting] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meetingLink: '',
    location: '',
    platform: '',
    agenda: '',
    notes: '',
  });

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!id) {
        console.error('No meeting ID provided');
        navigate('/workspace/meetings');
        return;
      }
      
      try {
        setIsLoading(true);
        const response = await apiService.getMeetingById(parseInt(id));
        
        if (response.error) {
          toastError(response.error, 'Error');
          navigate('/workspace/meetings');
          return;
        }
        
        if (response.data?.meeting) {
          setMeeting(response.data.meeting);
          setFormData({
            title: response.data.meeting.title || '',
            description: response.data.meeting.description || '',
            meetingLink: response.data.meeting.meetingLink || '',
            location: response.data.meeting.location || '',
            platform: response.data.meeting.platform || '',
            agenda: response.data.meeting.agenda || '',
            notes: response.data.meeting.notes || '',
          });
        } else {
          toastError('Meeting not found', 'Error');
          navigate('/workspace/meetings');
        }
      } catch (error) {
        console.error('Error fetching meeting:', error);
        toastError('Failed to load meeting details', 'Error');
        navigate('/workspace/meetings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeeting();
  }, [id, navigate, toastError]);

  const handleSave = async () => {
    if (!id) return;
    // Permission guard
    const role = (currentWorkspace?.role || (JSON.parse(localStorage.getItem('currentWorkspace') || 'null')?.role) || '').toLowerCase();
    const isOwnerOrAdmin = role === 'owner' || role === 'admin';
    const isCreator = meeting?.createdById === user?.id;
    const startTimeGuard = new Date(meeting?.startTime) > new Date();
    const isScheduled = meeting?.status === 'scheduled';
    const canEdit = startTimeGuard && isScheduled && (isOwnerOrAdmin || isCreator);
    if (!canEdit) {
      toastError('You do not have permission to edit this meeting', 'Permission Denied');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await apiService.updateMeeting(parseInt(id), {
        title: formData.title,
        description: formData.description,
        meetingLink: formData.meetingLink,
        location: formData.location,
        platform: formData.platform,
        agenda: formData.agenda,
        notes: formData.notes,
      });
      
      if (response.error) {
        toastError(response.error, 'Save Failed');
      } else {
        toastSuccess('Meeting updated successfully', 'Success');
        setIsEditing(false);
        // Refresh meeting data and update formData
        const refreshResponse = await apiService.getMeetingById(parseInt(id));
        if (refreshResponse.data?.meeting) {
          const updatedMeeting = refreshResponse.data.meeting;
          setMeeting(updatedMeeting);
          // Update formData with the saved values to ensure consistency
          setFormData({
            title: updatedMeeting.title || '',
            description: updatedMeeting.description || '',
            meetingLink: updatedMeeting.meetingLink || '',
            location: updatedMeeting.location || '',
            platform: updatedMeeting.platform || '',
            agenda: updatedMeeting.agenda || '',
            notes: updatedMeeting.notes || '',
          });
        }
      }
    } catch (error) {
      console.error('Error saving meeting:', error);
      toastError('Failed to save changes', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (meeting) {
      setFormData({
        title: meeting.title || '',
        description: meeting.description || '',
        meetingLink: meeting.meetingLink || '',
        location: meeting.location || '',
        platform: meeting.platform || '',
        agenda: meeting.agenda || '',
        notes: meeting.notes || '',
      });
    }
    setIsEditing(false);
  };

  const getMeetingSourceIcon = (source?: string) => {
    switch (source) {
      case 'google-calendar':
        return '🗓️';
      case 'outlook':
        return '📧';
      case 'zoom':
        return '🔷';
      case 'teams':
        return '💼';
      default:
        return '📅';
    }
  };

  const getMeetingSourceLabel = (source?: string) => {
    switch (source) {
      case 'google-calendar':
        return 'Google Calendar';
      case 'outlook':
        return 'Outlook';
      case 'zoom':
        return 'Zoom';
      case 'teams':
        return 'Microsoft Teams';
      default:
        return 'Kairo App';
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading meeting details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!meeting) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-20">
          <div className="text-center">
            <p className="text-slate-600 dark:text-slate-400">Meeting not found</p>
          </div>
        </div>
      </Layout>
    );
  }

  const startTime = new Date(meeting.startTime);
  // const endTime = new Date(meeting.endTime);
  const isUpcoming = startTime > new Date();
  const role = (currentWorkspace?.role || (JSON.parse(localStorage.getItem('currentWorkspace') || 'null')?.role) || '').toLowerCase();
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';
  const isCreator = meeting.createdById === user?.id;
  const isScheduled = meeting.status === 'scheduled';
  const canEdit = isUpcoming && isScheduled && (isOwnerOrAdmin || isCreator);
  
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Compact Header with Back Button */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors group"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to Meetings
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Section */}
          <div className="mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Gradient Header Bar */}
              <div className="h-1.5 bg-gradient-to-r from-purple-500 via-blue-500 to-indigo-500"></div>
              
              <div className="p-8">
                {/* Title and Status */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="text-3xl font-bold bg-transparent border-b-2 border-purple-500 focus:outline-none text-gray-900 dark:text-white w-full"
                      />
                    ) : (
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {meeting.title}
                      </h1>
                    )}
                    
                    {/* Workspace Context */}
                    {meeting.workspace && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                        <FolderOpen className="w-4 h-4" />
                        <span className="font-medium">{meeting.workspace.name}</span>
                        {meeting.workspace.channel && (
                          <>
                            <span className="text-gray-400 dark:text-gray-600">/</span>
                            <span>#{meeting.workspace.channel}</span>
                          </>
                        )}
                      </div>
                    )}

                  {/* Scheduler and timestamps */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {meeting.createdBy && (
                      <div className="flex items-center gap-2 md:justify-start justify-center">
                        <UserAvatar
                          profilePictureUrl={meeting.createdBy.profilePictureUrl}
                          name={meeting.createdBy.name || meeting.createdBy.email || 'User'}
                        />
                        <div className="leading-tight">
                          <p className="text-gray-700 dark:text-gray-300 font-medium">Scheduled by</p>
                          <p className="text-gray-600 dark:text-gray-400">{meeting.createdBy.email}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 justify-center">
                      <span>Scheduled on:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{new Date(meeting.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 justify-end md:justify-end">
                      <span>Last edited:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{new Date(meeting.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
                      isUpcoming 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {isUpcoming ? 'Upcoming' : 'Past'}
                    </span>
                  </div>
                </div>

                {/* Meeting Meta Info */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Date</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Time</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Participants</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {meeting.participants?.length || 0} people
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Duration</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {meeting.duration} min
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {meeting.meetingLink && !isEditing && (
                    <button
                      onClick={() => window.open(meeting.meetingLink, '_blank')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30"
                    >
                      <Video className="w-5 h-5" />
                      Join Meeting
                    </button>
                  )}
                  
                  {!isEditing ? (
                    <button
                      onClick={() => { if (canEdit) setIsEditing(true); else toastError('You do not have permission to edit this meeting', 'Permission Denied'); }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl border border-gray-300 dark:border-gray-600 transition-all"
                      disabled={!canEdit}
                    >
                      <PenTool className="w-4 h-4" />
                      Edit Details
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save Changes
                      </button>
                      <button
                        onClick={handleCancel}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl border border-gray-300 dark:border-gray-600 transition-all"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Description
                </h2>
                {isEditing ? (
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full min-h-[120px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    placeholder="Add a description for this meeting..."
                  />
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {meeting.description || 'No description provided'}
                  </p>
                )}
              </div>

              {/* Agenda */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Agenda
                  {!isEditing && <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(editable)</span>}
                </h2>
                {isEditing ? (
                  <textarea
                    value={formData.agenda}
                    onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                    className="w-full min-h-[150px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm resize-none"
                    placeholder="1. First agenda item&#10;2. Second agenda item&#10;3. Third agenda item"
                  />
                ) : (
                  <div className="space-y-2">
                    {meeting.agenda ? (
                      meeting.agenda.split('\n').map((item: string, index: number) => (
                        <div key={index} className="flex items-start gap-3 text-gray-600 dark:text-gray-400">
                          <span className="text-purple-600 dark:text-purple-400 font-semibold mt-0.5">{item.match(/^\d+\./) ? '' : '•'}</span>
                          <span>{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-500 italic">No agenda set</p>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Notes
                </h2>
                {isEditing ? (
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full min-h-[120px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    placeholder="Add any additional notes for this meeting..."
                  />
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                    {meeting.notes || 'No notes added'}
                  </p>
                )}
              </div>

              {/* AI Predicted Topics */}
              {meeting.predictedTopics && meeting.predictedTopics.length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800/30">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    AI-Predicted Topics
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-normal px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded-full">Beta</span>
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {meeting.predictedTopics.map((topic: string, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg border border-purple-200 dark:border-purple-700/50 shadow-sm"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting Details */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Meeting Details
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Platform
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.platform}
                        onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                        placeholder="Zoom, Google Meet, Teams..."
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white font-medium">
                        {meeting.platform || 'Not specified'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Meeting Link
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.meetingLink}
                        onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                        placeholder="https://..."
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      meeting.meetingLink ? (
                        <a 
                          href={meeting.meetingLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium break-all underline decoration-purple-300 dark:decoration-purple-700"
                        >
                          {meeting.meetingLink}
                        </a>
                      ) : (
                        <p className="text-gray-500 dark:text-gray-500 italic">No link provided</p>
                      )
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Location
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Virtual or physical location"
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white font-medium">
                        {meeting.location || 'Not specified'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Participants */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Participants
                </h2>
                <div className="space-y-3">
                  {meeting.participants?.map((participant: any) => (
                    <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <UserAvatar
                        profilePictureUrl={participant.user?.profilePictureUrl}
                        name={participant.user?.name || 'Unknown'}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {participant.user?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {participant.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Source Info */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Source
                </h2>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-2xl">{getMeetingSourceIcon(meeting.meetingSource)}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {getMeetingSourceLabel(meeting.meetingSource)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Synced automatically
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              {meeting.meetingLink && (
                <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl p-6 shadow-lg text-white">
                  <h3 className="text-lg font-semibold mb-2">Ready to join?</h3>
                  <p className="text-purple-100 text-sm mb-4">
                    Meeting starts {isUpcoming ? `in ${Math.ceil((startTime.getTime() - Date.now()) / 3600000)} hours` : 'has passed'}
                  </p>
                  <button
                    onClick={() => window.open(meeting.meetingLink, '_blank')}
                    className="w-full px-4 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Video className="w-5 h-5" />
                    Join Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PreMeeting;