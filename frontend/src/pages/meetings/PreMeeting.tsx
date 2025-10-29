import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiService } from '../../services/api';
import { useToastContext } from '../../context/ToastContext';
import UserAvatar from '../../components/ui/UserAvatar';
import { Clock, Calendar, Users, Video, PenTool, Save, X, MessageSquare, ChevronLeft, Plus, Send, Bold, Italic, List } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('details');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  
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

  // Notes state
  const [notes, setNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Context chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

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
          setNotes(response.data.meeting.notes || '');
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

  const handleTitleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const response = await apiService.updateMeeting(parseInt(id), {
        title: formData.title,
      });
      
      if (response.error) {
        toastError(response.error, 'Save Failed');
      } else {
        toastSuccess('Title updated successfully', 'Success');
        setIsEditingTitle(false);
        // Refresh meeting data
        const refreshResponse = await apiService.getMeetingById(parseInt(id));
        if (refreshResponse.data?.meeting) {
          setMeeting(refreshResponse.data.meeting);
        }
      }
    } catch (error) {
      console.error('Error saving title:', error);
      toastError('Failed to save title', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const response = await apiService.updateMeeting(parseInt(id), {
        notes: notes,
      });
      
      if (response.error) {
        toastError(response.error, 'Save Failed');
      } else {
        toastSuccess('Notes saved successfully', 'Success');
        setIsEditingNotes(false);
        // Refresh meeting data
        const refreshResponse = await apiService.getMeetingById(parseInt(id));
        if (refreshResponse.data?.meeting) {
          setMeeting(refreshResponse.data.meeting);
        }
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      toastError('Failed to save notes', 'Error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    const message = {
      id: Date.now(),
      content: newMessage,
      sender: user?.name || 'You',
      timestamp: new Date(),
      avatar: user?.profilePictureUrl || null,
    };
    
    setChatMessages([...chatMessages, message]);
    setNewMessage('');
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
        {/* Minimal Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
                  <ChevronLeft className="w-4 h-4" />
                  Back
            </button>
                
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="text-xl font-semibold bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={handleTitleSave}
                      disabled={isSaving}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingTitle(false);
                        setFormData({ ...formData, title: meeting.title || '' });
                      }}
                      className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <h1 
                    className="text-xl font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {meeting.title}
                  </h1>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                  {!isEditing ? (
                    <button
                      onClick={() => { if (canEdit) setIsEditing(true); else toastError('You do not have permission to edit this meeting', 'Permission Denied'); }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      disabled={!canEdit}
                    >
                      <PenTool className="w-4 h-4" />
                    Edit
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      Save
                      </button>
                      <button
                        onClick={handleCancel}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Meeting Metadata Row */}
          <div className="flex items-center gap-8 mb-8 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{meeting.duration} min</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{meeting.participants?.length || 0} participants</span>
            </div>
            <div className="ml-auto">
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                isUpcoming 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}>
                {isUpcoming ? 'Upcoming' : 'Past'}
              </span>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Tabbed Content */}
            <div className="lg:col-span-2">
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="flex space-x-8">
                  {[
                    { id: 'details', label: 'Details' },
                    { id: 'notes', label: 'Notes' },
                    { id: 'context', label: 'Context Chat' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Meeting Details</h2>
                      {!isEditing && canEdit && (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    <div className="space-y-6">
              {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                        </label>
                {isEditing ? (
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full h-24 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Add a description for this meeting..."
                  />
                ) : (
                          <p className="text-gray-600 dark:text-gray-400">
                    {meeting.description || 'No description provided'}
                  </p>
                )}
              </div>

              {/* Agenda */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Agenda
                        </label>
                {isEditing ? (
                  <textarea
                    value={formData.agenda}
                    onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                            className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="1. First agenda item&#10;2. Second agenda item&#10;3. Third agenda item"
                  />
                ) : (
                  <div className="space-y-2">
                    {meeting.agenda ? (
                      meeting.agenda.split('\n').map((item: string, index: number) => (
                        <div key={index} className="flex items-start gap-3 text-gray-600 dark:text-gray-400">
                                  <span className="text-blue-600 dark:text-blue-400 font-semibold mt-0.5">{item.match(/^\d+\./) ? '' : '•'}</span>
                          <span>{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-500 italic">No agenda set</p>
                    )}
                  </div>
                )}
              </div>

                      {/* Platform */}
                  <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Platform
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.platform}
                        onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                        placeholder="Zoom, Google Meet, Teams..."
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                          <p className="text-gray-900 dark:text-white">
                        {meeting.platform || 'Not specified'}
                      </p>
                    )}
                  </div>

                      {/* Meeting Link */}
                  <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Meeting Link
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.meetingLink}
                        onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                        placeholder="https://..."
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      meeting.meetingLink ? (
                        <a 
                          href={meeting.meetingLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 break-all"
                        >
                          {meeting.meetingLink}
                        </a>
                      ) : (
                        <p className="text-gray-500 dark:text-gray-500 italic">No link provided</p>
                      )
                    )}
                  </div>

                      {/* Location */}
                  <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Location
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Virtual or physical location"
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                          <p className="text-gray-900 dark:text-white">
                        {meeting.location || 'Not specified'}
                      </p>
                        )}
                      </div>

                      {/* AI Predicted Topics */}
                      {meeting.predictedTopics && meeting.predictedTopics.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            AI-Predicted Topics
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {meeting.predictedTopics.map((topic: string, index: number) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-md border border-gray-200 dark:border-gray-600"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes Tab */}
                {activeTab === 'notes' && (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h2>
                      {!isEditingNotes ? (
                        <button
                          onClick={() => setIsEditingNotes(true)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {notes ? 'Edit' : 'Add Note'}
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={handleNotesSave}
                            disabled={isSaving}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingNotes(false);
                              setNotes(meeting.notes || '');
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingNotes ? (
                      <div>
                        <div className="flex gap-2 mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                          <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                            <Italic className="w-4 h-4" />
                          </button>
                          <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                            <List className="w-4 h-4" />
                          </button>
                        </div>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          placeholder="Add your notes here..."
                        />
                      </div>
                    ) : (
                      <div className="min-h-[200px]">
                        {notes ? (
                          <div className="prose prose-sm max-w-none">
                            <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{notes}</p>
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <PenTool className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 mb-2">No notes yet</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500">Add notes to prepare for your meeting</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Context Chat Tab */}
                {activeTab === 'context' && (
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Context Chat</h2>
                    
                    <div className="h-96 flex flex-col">
                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                        {chatMessages.length === 0 ? (
                          <div className="text-center py-12">
                            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 dark:text-gray-400 mb-2">No messages yet</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500">Discuss meeting context with your team...</p>
                          </div>
                        ) : (
                          chatMessages.map((message) => (
                            <div key={message.id} className="flex gap-3">
                              <UserAvatar
                                profilePictureUrl={message.avatar}
                                name={message.sender}
                                size="sm"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">{message.sender}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {message.timestamp.toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{message.content}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Type your message..."
                          className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim()}
                          className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                  </div>
                </div>
                )}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Join Meeting Button */}
              {meeting.meetingLink && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <button
                    onClick={() => window.open(meeting.meetingLink, '_blank')}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Video className="w-5 h-5" />
                    Join Meeting
                  </button>
                </div>
              )}

              {/* Participants */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Participants</h3>
                  <button className="text-blue-600 hover:text-blue-700">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {meeting.participants?.map((participant: any) => (
                    <div key={participant.id} className="flex items-center gap-3">
                      <UserAvatar
                        profilePictureUrl={participant.user?.profilePictureUrl}
                        name={participant.user?.name || 'Unknown'}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
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

              {/* Meeting Source */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Meeting Source</h3>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <span className="text-lg">{getMeetingSourceIcon(meeting.meetingSource)}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {getMeetingSourceLabel(meeting.meetingSource)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Synced automatically
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PreMeeting;