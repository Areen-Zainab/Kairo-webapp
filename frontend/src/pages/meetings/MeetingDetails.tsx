import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { apiService } from '../../services/api';
import { useToastContext } from '../../context/ToastContext';
import {
  MeetingHeader,
  MeetingTabs,
  AddNoteFAB,
  KairoAssistantFAB,
  type MeetingDetailsData,
  type MeetingMinute,
  type MeetingNote,
  type MeetingFile
} from '../../components/meetings/details';

const MeetingDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const meetingId = id || '1'; // Default to '1' if no id provided
  const { success: toastSuccess, error: toastError } = useToastContext();
  const [meeting, setMeeting] = useState<MeetingDetailsData | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [, setHoveredMinute] = useState<MeetingMinute | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load files when files tab is opened
  const loadFiles = async (meetingId: number) => {
    try {
      const filesResp = await apiService.getMeetingFiles(meetingId);
      if (filesResp.data?.files) {
        const files: MeetingFile[] = filesResp.data.files.map((f: any) => ({
          id: String(f.id),
          name: f.filename,
          type: (f.fileType || 'other') as 'pdf' | 'image' | 'document' | 'presentation' | 'other',
          url: '',
          size: f.fileSize || 0,
          uploadedBy: {
            id: String(f.uploadedBy?.id ?? f.userId),
            name: f.uploadedBy?.name || 'Unknown',
          },
          uploadedAt: f.createdAt || new Date().toISOString(),
          linkedTranscriptId: undefined,
        }));
        
        setMeeting(prev => prev ? { ...prev, files } : null);
      }
    } catch (error: any) {
      console.error('Error loading files:', error);
      // Don't show error toast here, just log it
    }
  };

  // Refresh files when files tab is opened
  useEffect(() => {
    if (activeTab === 'files' && meeting) {
      const meetingNumericId = parseInt(meeting.id);
      if (!isNaN(meetingNumericId)) {
        loadFiles(meetingNumericId);
      }
    }
  }, [activeTab, meeting?.id]);

  // Load meeting details & notes from API
  useEffect(() => {
    const fetchMeetingDetails = async () => {
      setIsLoading(true);
      try {
        const numericId = parseInt(meetingId, 10);
        const resp = await apiService.getMeetingById(numericId);
        if (resp.error || !resp.data?.meeting) {
          toastError(resp.error || 'Failed to load meeting', 'Error');
          setIsLoading(false);
          return;
        }

        const m = resp.data.meeting;

        // Map backend meeting shape into MeetingDetailsData skeleton.
        const baseMeeting: MeetingDetailsData = {
          id: String(m.id),
          title: m.title,
          date: new Date(m.startTime).toISOString().slice(0, 10),
          time: new Date(m.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          duration: m.duration || 0,
          status: (m.status === 'completed' ? 'completed' : m.status === 'scheduled' ? 'scheduled' : 'recorded') as any,
          organizer: {
            id: String(m.createdBy?.id ?? m.createdById),
            name: m.createdBy?.name || m.createdBy?.email || 'Organizer',
            email: m.createdBy?.email || '',
            avatar: m.createdBy?.name
              ? m.createdBy.name.split(' ').map((p: string) => p[0]).join('').toUpperCase()
              : undefined,
          },
          participants: (m.participants || []).map((p: any) => ({
            id: String(p.user.id),
            name: p.user.name || p.user.email,
            email: p.user.email,
            avatar: p.user.name
              ? p.user.name.split(' ').map((x: string) => x[0]).join('').toUpperCase()
              : undefined,
            role: 'participant',
            joinedAt: undefined,
          })),
          meetingType: 'other',
          description: m.description,
          recordingUrl: m.recordingUrl || undefined,
          audioUrl: m.audioUrl ? (m.audioUrl.startsWith('http') ? m.audioUrl : `http://localhost:5000${m.audioUrl}`) : undefined,
          transcript: [],
          slides: [],
          minutes: [],
          notes: [],
          files: [],
          aiInsights: [],
          stats: {
            transcriptLength: m.stats?.transcriptLength || 0,
            minutesGenerated: 0,
            slidesCount: 0,
            participantsCount: (m.participants || []).length,
            audioDurationSeconds: m.stats?.audioDurationSeconds || 0,
            audioDurationMinutes: m.stats?.audioDurationMinutes || 0,
          },
        };

        // Load notes from notes endpoint
        const notesResp = await apiService.getMeetingNotes(m.id);
        let notes: MeetingNote[] = [];
        if (notesResp.data?.notes) {
          notes = notesResp.data.notes.map((n: any) => ({
            id: String(n.id),
            content: n.content,
            author: {
              id: String(n.author?.id ?? n.userId),
              name: n.author?.name || 'Unknown',
              avatar: n.author?.name
                ? n.author.name.split(' ').map((p: string) => p[0]).join('').toUpperCase()
                : 'UN',
            },
            timestamp: n.timestamp ?? 0,
            type: n.type === 'timeline' ? 'timeline' : 'manual',
            color: n.color || '#3b82f6',
            tags: [],
          }));
        }

        // Load files from files endpoint
        const filesResp = await apiService.getMeetingFiles(m.id);
        let files: MeetingFile[] = [];
        if (filesResp.data?.files) {
          files = filesResp.data.files.map((f: any) => ({
            id: String(f.id),
            name: f.filename,
            type: (f.fileType || 'other') as 'pdf' | 'image' | 'document' | 'presentation' | 'other',
            url: '', // Not used for download, we use API endpoint
            size: f.fileSize || 0,
            uploadedBy: {
              id: String(f.uploadedBy?.id ?? f.userId),
              name: f.uploadedBy?.name || 'Unknown',
            },
            uploadedAt: f.createdAt || new Date().toISOString(),
            linkedTranscriptId: undefined, // Can be added later if needed
          }));
        }

        setMeeting({
          ...baseMeeting,
          notes,
          files,
        });
      } catch (e: any) {
        console.error('Failed to load meeting details', e);
        toastError(e?.message || 'Failed to load meeting', 'Error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetingDetails();
  }, [meetingId]);

  const handleMinuteHover = (minute: MeetingMinute) => {
    setHoveredMinute(minute);
  };

  const handleMinuteClick = (minute: MeetingMinute) => {
    setCurrentTime(minute.timestamp);
  };

  const handleAddNote = (note: Omit<MeetingNote, 'id'>) => {
    if (!meeting) return;

    // Persist note to backend
    const meetingNumericId = parseInt(meeting.id, 10);
    const payload = {
      content: note.content,
      type: note.type,
      timestamp: note.timestamp,
      color: note.color || '#3b82f6',
    };

    apiService.createMeetingNote(meetingNumericId, payload).then((resp) => {
      if (resp.error || !resp.data?.note) {
        toastError(resp.error || 'Failed to save note', 'Error');
        return;
      }

      const saved = resp.data.note;
      const savedNote: MeetingNote = {
        id: String(saved.id),
        content: saved.content,
        author: {
          id: String(saved.author?.id ?? saved.userId),
          name: saved.author?.name || note.author.name,
          avatar: saved.author?.avatar || note.author.avatar,
        },
        timestamp: saved.timestamp ?? note.timestamp,
        type: saved.type === 'timeline' ? 'timeline' : 'manual',
        color: saved.color || note.color || '#3b82f6',
        tags: note.tags || [],
      };

      setMeeting((prev) =>
        prev
          ? {
              ...prev,
              notes: [...prev.notes, savedNote],
            }
          : prev
      );
    });
  };

  const handleDeleteNote = (id: string) => {
    if (!meeting) return;
    const meetingNumericId = parseInt(meeting.id, 10);
    const noteNumericId = parseInt(id, 10);

    // Optimistic removal
    setMeeting(prev =>
      prev
        ? {
            ...prev,
            notes: prev.notes.filter(n => n.id !== id),
          }
        : prev
    );

    apiService.deleteMeetingNote(meetingNumericId, noteNumericId).catch((e) => {
      console.error('Failed to delete note', e);
      // We won't re-add the note on failure, but we surface an error
      toastError('Failed to delete note', 'Error');
    });
  };

  const handleAddActionItem = (actionItem: any) => {
    console.log('Adding action item:', actionItem);
    // Implement action item addition
  };

  const handleUpdateActionItem = (id: string, actionItem: any) => {
    console.log('Updating action item:', id, actionItem);
    // Implement action item update
  };

  const handleDeleteActionItem = (id: string) => {
    console.log('Deleting action item:', id);
    // Implement action item deletion
  };

  const handleExportMinutes = (format: 'pdf' | 'markdown') => {
    console.log(`Exporting minutes as ${format}`);
    // Implement export functionality
  };

  const handleGeneratePersonalSummary = () => {
    console.log('Generating personal summary');
    // Implement Kairo assistant functionality
  };

  const handleFileClick = (file: MeetingFile) => {
    // For now, just trigger download
    handleFileDownload(file);
  };

  const handleFileDownload = async (file: MeetingFile) => {
    if (!meeting) return;
    
    const meetingNumericId = parseInt(meeting.id);
    const fileNumericId = parseInt(file.id);
    
    if (isNaN(meetingNumericId) || isNaN(fileNumericId)) {
      toastError('Invalid meeting or file ID', 'Error');
      return;
    }

    try {
      const blob = await apiService.downloadMeetingFile(meetingNumericId, fileNumericId);
      if (!blob) {
        toastError('Failed to download file', 'Error');
        return;
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toastSuccess('File downloaded successfully', 'Success');
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toastError(error?.message || 'Failed to download file', 'Error');
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!meeting) return;
    
    const meetingNumericId = parseInt(meeting.id);
    if (isNaN(meetingNumericId)) {
      toastError('Invalid meeting ID', 'Error');
      return;
    }

    try {
      const response = await apiService.uploadMeetingFile(meetingNumericId, file);
      if (response.error) {
        toastError(response.error, 'Upload Failed');
        return;
      }

      if (response.data?.file) {
        const newFile: MeetingFile = {
          id: String(response.data.file.id),
          name: response.data.file.filename,
          type: response.data.file.fileType || 'other',
          url: '',
          size: response.data.file.fileSize,
          uploadedBy: {
            id: String(response.data.file.uploadedBy.id),
            name: response.data.file.uploadedBy.name
          },
          uploadedAt: response.data.file.createdAt,
          linkedTranscriptId: undefined
        };

        setMeeting(prev => prev ? {
          ...prev,
          files: [...prev.files, newFile]
        } : null);

        toastSuccess('File uploaded successfully', 'Success');
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toastError(error?.message || 'Failed to upload file', 'Error');
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!meeting) return;
    
    const meetingNumericId = parseInt(meeting.id);
    const fileNumericId = parseInt(fileId);
    
    if (isNaN(meetingNumericId) || isNaN(fileNumericId)) {
      toastError('Invalid meeting or file ID', 'Error');
      return;
    }

    // Optimistically remove from UI
    setMeeting(prev => prev ? {
      ...prev,
      files: prev.files.filter(f => f.id !== fileId)
    } : null);

    try {
      const response = await apiService.deleteMeetingFile(meetingNumericId, fileNumericId);
      if (response.error) {
        toastError(response.error, 'Delete Failed');
        // Re-fetch files on error
        const filesResponse = await apiService.getMeetingFiles(meetingNumericId);
        if (filesResponse.data?.files) {
          const files: MeetingFile[] = filesResponse.data.files.map((f: any) => ({
            id: String(f.id),
            name: f.filename,
            type: f.fileType || 'other',
            url: '',
            size: f.fileSize,
            uploadedBy: {
              id: String(f.uploadedBy.id),
              name: f.uploadedBy.name
            },
            uploadedAt: f.createdAt,
            linkedTranscriptId: undefined
          }));
          setMeeting(prev => prev ? { ...prev, files } : null);
        }
        return;
      }

      toastSuccess('File deleted successfully', 'Success');
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toastError(error?.message || 'Failed to delete file', 'Error');
      // Re-fetch files on error
      const filesResponse = await apiService.getMeetingFiles(meetingNumericId);
      if (filesResponse.data?.files) {
        const files: MeetingFile[] = filesResponse.data.files.map((f: any) => ({
          id: String(f.id),
          name: f.filename,
          type: f.fileType || 'other',
          url: '',
          size: f.fileSize,
          uploadedBy: {
            id: String(f.uploadedBy.id),
            name: f.uploadedBy.name
          },
          uploadedAt: f.createdAt,
          linkedTranscriptId: undefined
        }));
        setMeeting(prev => prev ? { ...prev, files } : null);
      }
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (!meeting) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Meeting Not Found</h2>
            <p className="text-slate-600 dark:text-slate-400">The requested meeting could not be found.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        {/* Meeting Header */}
        <MeetingHeader
          meeting={meeting}
          onDownloadRecording={() => console.log('Download recording')}
          onShareMeeting={() => console.log('Share meeting')}
          onExportTranscript={() => console.log('Export transcript')}
          onAddNotes={() => console.log('Add notes')}
        />

          {/* Main Content */}
          <MeetingTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            meeting={meeting}
            onMinuteHover={handleMinuteHover}
            onMinuteClick={handleMinuteClick}
            onExportMinutes={handleExportMinutes}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            onAddActionItem={handleAddActionItem}
            onUpdateActionItem={handleUpdateActionItem}
            onDeleteActionItem={handleDeleteActionItem}
            onFileClick={handleFileClick}
            onFileDownload={handleFileDownload}
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
            currentTime={currentTime}
          />

        {/* Floating Action Buttons */}
        <AddNoteFAB
          onAddNote={handleAddNote}
          currentTime={currentTime}
        />
        
        <KairoAssistantFAB
          onGeneratePersonalSummary={handleGeneratePersonalSummary}
        />
      </div>
    </Layout>
  );
};

export default MeetingDetails;
