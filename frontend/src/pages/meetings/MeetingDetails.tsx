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
  type MeetingFile,
  type TranscriptEntry
} from '../../components/meetings/details';

const MeetingDetails: React.FC = () => {
  const { id, workspaceId } = useParams<{ id: string; workspaceId?: string }>();
  const meetingId = id || '1'; // Default to '1' if no id provided
  const workspaceIdNum = workspaceId ? parseInt(workspaceId, 10) : undefined;
  const { success: toastSuccess, error: toastError } = useToastContext();
  const [meeting, setMeeting] = useState<MeetingDetailsData | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [, setHoveredMinute] = useState<MeetingMinute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [aiInsights, setAIInsights] = useState<any>(null);

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
        // Use actual audio duration from stats if available (convert seconds to minutes for display)
        // Otherwise use scheduled duration
        const actualDurationSeconds = m.stats?.audioDurationSeconds && m.stats.audioDurationSeconds > 0
          ? m.stats.audioDurationSeconds
          : (m.duration || 0) * 60; // Convert scheduled duration (minutes) to seconds
        
        // Store duration in seconds for exact precision, but convert to minutes for the duration field
        // The duration field is used for display, so we'll calculate exact minutes+seconds when displaying
        const actualDurationMinutes = Math.floor(actualDurationSeconds / 60) + (actualDurationSeconds % 60) / 60;
        
        const baseMeeting: MeetingDetailsData = {
          id: String(m.id),
          title: m.title,
          date: new Date(m.startTime).toISOString().slice(0, 10),
          time: new Date(m.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          duration: actualDurationMinutes, // This will be used for display, but we'll format it exactly
          status: (m.status === 'completed' ? 'completed' : m.status === 'scheduled' ? 'scheduled' : 'recorded') as any,
          platform: m.platform,
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

        // Load transcript from transcript endpoint
        let transcript: TranscriptEntry[] = [];
        if (m.status === 'completed' || m.status === 'in-progress') {
          try {
            const transcriptResp = await apiService.getTranscript(m.id);
            if (transcriptResp.data?.transcript) {
              transcript = transcriptResp.data.transcript
                .map((entry: any) => ({
                  id: entry.id || `entry_${entry.timestamp}`,
                  // Use normalized timestamp (starts from 0) for audio sync
                  // Prefer startTime if available (more precise), otherwise use timestamp
                  timestamp: entry.startTime !== undefined ? entry.startTime : (entry.timestamp || 0),
                  startTime: entry.startTime !== undefined ? entry.startTime : (entry.timestamp || 0),
                  endTime: entry.endTime,
                  speaker: entry.speaker || 'Unknown',
                  text: entry.text || '',
                  confidence: entry.confidence || 1.0,
                  chunk: entry.chunk,
                  audioFile: entry.audioFile,
                  rawTimestamp: entry.rawTimestamp,
                  originalStartTime: entry.originalStartTime, // Keep for reference
                  timeOffset: entry.timeOffset, // Keep for debugging
                }))
                .sort((a, b) => (a.startTime ?? a.timestamp) - (b.startTime ?? b.timestamp)); // Ensure sorted by start time
            }
          } catch (error: any) {
            console.error('Error loading transcript:', error);
            // Don't show error toast, just log it - transcript might not be available yet
          }
        }

        setMeeting({
          ...baseMeeting,
          notes,
          files,
          transcript,
        });

        // Fetch action items
        try {
          const actionItemsResp = await apiService.getActionItems(numericId);
          if (actionItemsResp.data?.actionItems) {
            setActionItems(actionItemsResp.data.actionItems);
          }
        } catch (error: any) {
          console.error('Error loading action items:', error);
          // Don't show error toast, just log it
        }

        // Fetch AI insights for decisions and key moments
        try {
          const insightsResp = await apiService.getAIInsights(numericId);
          if (insightsResp.data) {
            setAIInsights(insightsResp.data);
          }
        } catch (error: any) {
          console.error('Error loading AI insights:', error);
          // Don't show error toast, just log it
        }
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

  const handleUpdateNote = (id: string, note: Partial<MeetingNote>) => {
    if (!meeting) return;
    const meetingNumericId = parseInt(meeting.id, 10);
    const noteNumericId = parseInt(id, 10);

    // Store original note for potential revert
    const originalNote = meeting.notes.find(n => n.id === id);
    if (!originalNote) return;

    // Optimistic update
    setMeeting(prev =>
      prev
        ? {
            ...prev,
            notes: prev.notes.map(n =>
              n.id === id ? { ...n, ...note } : n
            ),
          }
        : prev
    );

    const payload: any = {};
    if (note.content !== undefined) payload.content = note.content;
    if (note.color !== undefined) payload.color = note.color;
    if (note.timestamp !== undefined) payload.timestamp = note.timestamp;
    if (note.type !== undefined) payload.type = note.type;

    apiService.updateMeetingNote(meetingNumericId, noteNumericId, payload).catch((e) => {
      console.error('Failed to update note', e);
      toastError('Failed to update note', 'Error');
      // Revert optimistic update on failure
      setMeeting(prev =>
        prev
          ? {
              ...prev,
              notes: prev.notes.map(n =>
                n.id === id ? originalNote : n
              ),
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
    if (!meeting) return;

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    let content = '';
    const fileName = `meeting_minutes_${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

    if (format === 'markdown') {
      content = `# Meeting Minutes - ${meeting.title}\n\n`;
      content += `**Date:** ${meeting.date} at ${meeting.time}\n`;
      content += `**Duration:** ${meeting.duration} minutes\n`;
      content += `**Participants:** ${meeting.participants.map(p => p.name).join(', ')}\n\n`;
      content += `---\n\n`;

      if (meeting.minutes.length === 0) {
        content += `*No meeting minutes available.*\n`;
      } else {
        meeting.minutes.forEach((minute, index) => {
          content += `## ${index + 1}. ${minute.title}\n\n`;
          content += `**Time:** ${formatTime(minute.timestamp)}\n`;
          content += `**Category:** ${minute.category}\n`;
          content += `**Priority:** ${minute.priority}\n`;
          if (minute.participants && minute.participants.length > 0) {
            content += `**Participants:** ${minute.participants.join(', ')}\n`;
          }
          content += `\n${minute.content}\n\n`;
          content += `---\n\n`;
        });
      }
    } else {
      // PDF format (actually text format that can be printed to PDF)
      content = `MEETING MINUTES\n`;
      content += `${'='.repeat(50)}\n\n`;
      content += `Title: ${meeting.title}\n`;
      content += `Date: ${meeting.date} at ${meeting.time}\n`;
      content += `Duration: ${meeting.duration} minutes\n`;
      content += `Participants: ${meeting.participants.map(p => p.name).join(', ')}\n\n`;
      content += `${'-'.repeat(50)}\n\n`;

      if (meeting.minutes.length === 0) {
        content += `No meeting minutes available.\n`;
      } else {
        meeting.minutes.forEach((minute, index) => {
          content += `${index + 1}. ${minute.title}\n`;
          content += `   Time: ${formatTime(minute.timestamp)}\n`;
          content += `   Category: ${minute.category}\n`;
          content += `   Priority: ${minute.priority}\n`;
          if (minute.participants && minute.participants.length > 0) {
            content += `   Participants: ${minute.participants.join(', ')}\n`;
          }
          content += `\n   ${minute.content.replace(/\n/g, '\n   ')}\n\n`;
          content += `${'-'.repeat(50)}\n\n`;
        });
      }
    }

    const blob = new Blob([content], {
      type: format === 'markdown' ? 'text/markdown' : 'text/plain'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.${format === 'markdown' ? 'md' : 'txt'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toastSuccess(`Meeting minutes exported as ${format === 'markdown' ? 'Markdown' : 'Text'}`, 'Export Successful');
  };

  const handleExportTranscript = () => {
    if (!meeting || !meeting.transcript || meeting.transcript.length === 0) {
      toastError('No transcript available to export', 'Export Failed');
      return;
    }

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    let content = '';
    const fileName = `transcript_${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

    // Export as formatted text
    content = `TRANSCRIPT\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `Meeting: ${meeting.title}\n`;
    content += `Date: ${meeting.date} at ${meeting.time}\n`;
    content += `Duration: ${meeting.duration} minutes\n`;
    content += `Participants: ${meeting.participants.map(p => p.name).join(', ')}\n\n`;
    content += `${'-'.repeat(50)}\n\n`;

    meeting.transcript.forEach((entry) => {
      const timestamp = formatTime(entry.timestamp || entry.startTime || 0);
      content += `[${timestamp}] ${entry.speaker}: ${entry.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toastSuccess('Transcript exported successfully', 'Export Successful');
  };

  const handleDownloadRecording = () => {
    if (!meeting) return;

    if (!meeting.audioUrl && !meeting.recordingUrl) {
      toastError('No recording available to download', 'Download Failed');
      return;
    }

    const url = meeting.audioUrl || meeting.recordingUrl;
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `recording_${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toastSuccess('Recording download started', 'Download Started');
  };

  const handleShareMeeting = () => {
    if (!meeting) return;

    const meetingUrl = window.location.href;
    
    if (navigator.share) {
      navigator.share({
        title: meeting.title,
        text: `Check out this meeting: ${meeting.title}`,
        url: meetingUrl,
      }).catch((error) => {
        console.error('Error sharing:', error);
        // Fallback to clipboard
        navigator.clipboard.writeText(meetingUrl);
        toastSuccess('Meeting link copied to clipboard', 'Link Copied');
      });
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(meetingUrl);
      toastSuccess('Meeting link copied to clipboard', 'Link Copied');
    }
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
          onDownloadRecording={handleDownloadRecording}
          onShareMeeting={handleShareMeeting}
          onExportTranscript={handleExportTranscript}
          onAddNotes={() => setActiveTab('notes')}
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
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            onAddActionItem={handleAddActionItem}
            onUpdateActionItem={handleUpdateActionItem}
            onDeleteActionItem={handleDeleteActionItem}
            onFileClick={handleFileClick}
            onFileDownload={handleFileDownload}
            onFileUpload={handleFileUpload}
            onFileDelete={handleFileDelete}
            currentTime={currentTime}
            actionItems={actionItems}
            aiInsights={aiInsights}
          />

        {/* Floating Action Buttons */}
        <AddNoteFAB
          onAddNote={handleAddNote}
          currentTime={currentTime}
        />
        
        <KairoAssistantFAB
          onGeneratePersonalSummary={handleGeneratePersonalSummary}
          workspaceId={workspaceIdNum}
        />
      </div>
    </Layout>
  );
};

export default MeetingDetails;
