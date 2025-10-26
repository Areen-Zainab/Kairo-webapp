import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import {
  MeetingHeader,
  MeetingTabs,
  AddNoteFAB,
  KairoAssistantFAB,
  type MeetingDetailsData,
  type MeetingMinute,
  type MeetingNote
} from '../../components/meetings/details';

const MeetingDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const meetingId = id || '1'; // Default to '1' if no id provided
  const [meeting, setMeeting] = useState<MeetingDetailsData | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [, setHoveredMinute] = useState<MeetingMinute | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data - replace with actual API call
  useEffect(() => {
    const fetchMeetingDetails = async () => {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        setMeeting({
          id: meetingId,
          title: 'Sprint Planning — Team A',
          date: '2024-01-15',
          time: '10:00 AM',
          duration: 90,
          status: 'recorded',
          organizer: {
            id: '1',
            name: 'Areeba Riaz',
            email: 'areeba@example.com',
            avatar: 'AR'
          },
          participants: [
            {
              id: '1',
              name: 'Areeba Riaz',
              email: 'areeba@example.com',
              avatar: 'AR',
              role: 'organizer',
              joinedAt: '10:00:00'
            },
            {
              id: '2',
              name: 'Ahmed Khan',
              email: 'ahmed@example.com',
              avatar: 'AK',
              role: 'participant',
              joinedAt: '10:02:00'
            },
            {
              id: '3',
              name: 'Fatima Ali',
              email: 'fatima@example.com',
              avatar: 'FA',
              role: 'presenter',
              joinedAt: '10:01:00'
            }
          ],
          meetingType: 'sprint-planning',
          description: 'Weekly sprint planning meeting to discuss upcoming features and assign tasks.',
          recordingUrl: '/api/recordings/sprint-planning-1.mp4',
          transcript: [
            {
              id: '1',
              timestamp: 0,
              speaker: 'Areeba Riaz',
              text: 'Welcome everyone to our sprint planning meeting. Let\'s start by reviewing our previous sprint achievements.',
              confidence: 0.95,
              slideId: 'slide-1'
            },
            {
              id: '2',
              timestamp: 15,
              speaker: 'Ahmed Khan',
              text: 'Thanks Areeba. I\'d like to highlight the successful completion of the user authentication feature.',
              confidence: 0.92,
              slideId: 'slide-2'
            },
            {
              id: '3',
              timestamp: 45,
              speaker: 'Fatima Ali',
              text: 'Great work Ahmed. Now let\'s discuss the upcoming features for this sprint.',
              confidence: 0.88,
              slideId: 'slide-3'
            }
          ],
          slides: [
            {
              id: 'slide-1',
              title: 'Sprint Planning Agenda',
              content: 'Review previous sprint, discuss new features, assign tasks',
              timestamp: 0,
              duration: 15
            },
            {
              id: 'slide-2',
              title: 'Previous Sprint Achievements',
              content: 'User authentication, API integration, UI improvements',
              timestamp: 15,
              duration: 30
            },
            {
              id: 'slide-3',
              title: 'Upcoming Features',
              content: 'Dashboard redesign, notification system, mobile app',
              timestamp: 45,
              duration: 45
            }
          ],
          minutes: [
            {
              id: '1',
              title: 'Sprint Achievements Review',
              content: 'Successfully completed user authentication feature and API integration.',
              timestamp: 15,
              category: 'decision',
              participants: ['Areeba Riaz', 'Ahmed Khan'],
              priority: 'high',
              aiGenerated: true
            },
            {
              id: '2',
              title: 'New Feature Assignments',
              content: 'Dashboard redesign assigned to Fatima, notification system to Ahmed.',
              timestamp: 60,
              category: 'action-item',
              participants: ['Fatima Ali', 'Ahmed Khan'],
              priority: 'high',
              aiGenerated: true
            }
          ],
          notes: [],
          files: [
            {
              id: '1',
              name: 'Sprint Planning Slides.pdf',
              type: 'pdf',
              url: '/files/sprint-planning-slides.pdf',
              size: 2048000,
              uploadedBy: {
                id: '1',
                name: 'Areeba Riaz'
              },
              uploadedAt: '2024-01-15T10:00:00Z',
              linkedTranscriptId: '1'
            }
          ],
          aiInsights: [
            {
              id: '1',
              type: 'summary',
              content: 'Key decisions made: Dashboard redesign priority, notification system implementation, mobile app development timeline.',
              confidence: 0.89,
              linkedTranscriptId: '3',
              participants: ['Areeba Riaz', 'Fatima Ali', 'Ahmed Khan']
            }
          ],
          stats: {
            transcriptLength: 1200,
            minutesGenerated: 8,
            slidesCount: 3,
            participantsCount: 3
          }
        });
        setIsLoading(false);
      }, 1000);
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
    
    const newNote: MeetingNote = {
      ...note,
      id: Date.now().toString()
    };
    
    setMeeting({
      ...meeting,
      notes: [...meeting.notes, newNote]
    });
  };

  const handleDeleteNote = (id: string) => {
    if (!meeting) return;
    
    setMeeting({
      ...meeting,
      notes: meeting.notes.filter(n => n.id !== id)
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
