// Simple meet service wrapper for triggering bot join from the frontend
// Assumes a backend endpoint exists to handle starting the bot with a meeting link

import { apiService } from './api';

export interface BotJoinResponse {
  success: boolean;
  message?: string;
  data?: any;
}

class MeetService {
  async joinMeeting(meetingId: number, meetingLink: string): Promise<BotJoinResponse> {
    // Preferred: meeting-scoped route
    try {
      const byMeetingRes = await (apiService as any).request(`/meetings/${meetingId}/bot/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ meetingLink }),
      });

      if (byMeetingRes?.error) {
        throw new Error(byMeetingRes.error);
      }

      return { success: true, message: byMeetingRes?.message || 'Bot join triggered', data: byMeetingRes?.data };
    } catch (primaryErr: any) {
      // Fallback: generic route accepts meetingId + meetingLink
      try {
        const fallbackRes = await (apiService as any).request(`/meetings/bot/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ meetingId, meetingLink }),
        });

        if (fallbackRes?.error) {
          return { success: false, message: fallbackRes.error };
        }

        return { success: true, message: fallbackRes?.message || 'Bot join triggered', data: fallbackRes?.data };
      } catch (fallbackErr: any) {
        return { success: false, message: fallbackErr?.message || 'Failed to trigger bot join' };
      }
    }
  }
}

export const meetService = new MeetService();
