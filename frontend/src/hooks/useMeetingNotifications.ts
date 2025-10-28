import { useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { useToastContext } from '../context/ToastContext';

interface MeetingNotification {
  meetingId: number;
  notifiedAt10Min: boolean;
  notifiedAt5Min: boolean;
  notifiedAtStart: boolean;
  meetingData: any; // Store meeting data locally
}

interface UseMeetingNotificationsProps {
  workspaceId?: number;
  onMeetingsChanged?: () => void; // Callback when new meetings are detected
}

export const useMeetingNotifications = ({ workspaceId, onMeetingsChanged }: UseMeetingNotificationsProps) => {
  const { info: toastInfo, warning: toastWarning, success: toastSuccess } = useToastContext();
  const notificationsRef = useRef<Map<number, MeetingNotification>>(new Map());
  const meetingsDataRef = useRef<any[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckedRef = useRef<string>(''); // Track last meeting IDs to detect changes

  // Fetch meetings once on mount or workspace change
  useEffect(() => {
    if (!workspaceId) return;

    const fetchMeetings = async () => {
      try {
        const response = await apiService.getUpcomingMeetings(workspaceId);
        if (!response.data?.meetings) return;

        const currentMeetingIds = response.data.meetings.map((m: any) => m.id).join(',');
        
        // Check if meetings have changed
        if (lastCheckedRef.current !== currentMeetingIds) {
          meetingsDataRef.current = response.data.meetings;
          lastCheckedRef.current = currentMeetingIds;
          
          // Initialize notifications for new meetings only
          for (const meeting of response.data.meetings) {
            if (!notificationsRef.current.has(meeting.id)) {
              notificationsRef.current.set(meeting.id, {
                meetingId: meeting.id,
                notifiedAt10Min: false,
                notifiedAt5Min: false,
                notifiedAtStart: false,
                meetingData: meeting,
              });
            }
          }
          
          if (onMeetingsChanged) {
            onMeetingsChanged();
          }
        }
      } catch (error) {
        console.error('Error fetching upcoming meetings:', error);
      }
    };

    fetchMeetings();
  }, [workspaceId, onMeetingsChanged]);

  // Check meeting times locally without backend calls
  useEffect(() => {
    const checkMeetingTimes = () => {
      const now = new Date();
      const meetings = meetingsDataRef.current;

      for (const meeting of meetings) {
        const notification = notificationsRef.current.get(meeting.id);
        if (!notification) continue;

        const startTime = new Date(meeting.startTime);
        const timeUntilStart = startTime.getTime() - now.getTime();
        const minutesUntilStart = Math.floor(timeUntilStart / 60000);

        // Get workspace name
        const workspaceName = meeting.workspace?.name || 'Workspace';
        const timeInfo = minutesUntilStart > 0 ? `starts in ${minutesUntilStart} minutes` : 'starting now';

        // Check for 10-minute notification
        if (minutesUntilStart <= 10 && minutesUntilStart > 5 && !notification.notifiedAt10Min) {
          const description = meeting.description 
            ? `${meeting.description} • ${workspaceName} • ${timeInfo}`
            : `${workspaceName} • ${timeInfo}`;
          toastInfo(`Meeting: ${meeting.title}`, description);
          notification.notifiedAt10Min = true;
        }

        // Check for 5-minute notification
        if (minutesUntilStart <= 5 && minutesUntilStart > 0 && !notification.notifiedAt5Min) {
          const description = meeting.description 
            ? `${meeting.description} • ${workspaceName} • ${timeInfo}`
            : `${workspaceName} • ${timeInfo}`;
          toastWarning(`Meeting starting soon: ${meeting.title}`, description);
          notification.notifiedAt5Min = true;
        }

        // Check for meeting started notification
        if (timeUntilStart <= 0 && timeUntilStart > -60000 && !notification.notifiedAtStart) {
          const description = meeting.description 
            ? `${meeting.description} • ${workspaceName}`
            : workspaceName;
          toastSuccess(`Meeting started: ${meeting.title}`, description);
          notification.notifiedAtStart = true;
          
          // Clean up after 1 hour past start time
          setTimeout(() => {
            notificationsRef.current.delete(meeting.id);
          }, 3600000);
        }
      }
    };

    // Check immediately and then every minute
    checkMeetingTimes();
    intervalRef.current = setInterval(checkMeetingTimes, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [toastInfo, toastWarning, toastSuccess]);
};
