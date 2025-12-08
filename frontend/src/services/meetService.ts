// Simple meet service wrapper for triggering bot join from the frontend
// Assumes a backend endpoint exists to handle starting the bot with a meeting link

import { apiService } from './api';

export interface BotJoinResponse {
  success: boolean;
  message?: string;
  data?: any;
}

class MeetService {
  // Track in-flight join requests to prevent duplicates
  private pendingJoinRequests = new Map<number, Promise<BotJoinResponse>>();

  async joinMeeting(meetingId: number, meetingLink: string): Promise<BotJoinResponse> {
    // Check if there's already a pending request for this meeting
    const existingRequest = this.pendingJoinRequests.get(meetingId);
    if (existingRequest) {
      console.log(`[MeetService] Deduplicating join request for meeting ${meetingId}`);
      return existingRequest;
    }
    // Ensure token is available and valid before making request
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      return { 
        success: false, 
        message: 'Authentication required. Please log in to join the meeting with the bot.' 
      };
    }

    // Refresh token in apiService from localStorage
    // This ensures apiService has the latest token
    (apiService as any).token = token;

    // Verify token is still valid (optional check - will fail gracefully if expired)
    // We don't await this to avoid blocking, but it helps catch expired tokens early
    const verifyPromise = apiService.verifyToken().catch(() => {
      // Token verification failed - will be caught by the actual request
      return null;
    });

    // Create the request promise and store it
    const requestPromise = (async (): Promise<BotJoinResponse> => {
      try {
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
            // Check if it's an auth error
            const isAuthError = byMeetingRes.error?.toLowerCase().includes('token') || 
                               byMeetingRes.error?.toLowerCase().includes('access') ||
                               byMeetingRes.error?.toLowerCase().includes('authentication') ||
                               byMeetingRes.error?.toLowerCase().includes('unauthorized');
            
            return { 
              success: false, 
              message: isAuthError 
                ? 'Authentication failed. Please log in again to join the meeting with the bot.'
                : byMeetingRes.error 
            };
          }

          return { success: true, message: byMeetingRes?.message || 'Bot join triggered', data: byMeetingRes?.data };
        } catch (primaryErr: any) {
          // Check if it's an auth error
          const isAuthError = primaryErr?.message?.toLowerCase().includes('token') || 
                             primaryErr?.message?.toLowerCase().includes('access') ||
                             primaryErr?.message?.toLowerCase().includes('authentication') ||
                             primaryErr?.message?.toLowerCase().includes('unauthorized');
          
          if (isAuthError) {
            return { 
              success: false, 
              message: 'Authentication failed. Please log in again to join the meeting with the bot.' 
            };
          }

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
              const isAuthError = fallbackRes.error?.toLowerCase().includes('token') || 
                                 fallbackRes.error?.toLowerCase().includes('access') ||
                                 fallbackRes.error?.toLowerCase().includes('authentication') ||
                                 fallbackRes.error?.toLowerCase().includes('unauthorized');
              
              return { 
                success: false, 
                message: isAuthError 
                  ? 'Authentication failed. Please log in again to join the meeting with the bot.'
                  : fallbackRes.error 
              };
            }

            return { success: true, message: fallbackRes?.message || 'Bot join triggered', data: fallbackRes?.data };
          } catch (fallbackErr: any) {
            const isAuthError = fallbackErr?.message?.toLowerCase().includes('token') || 
                               fallbackErr?.message?.toLowerCase().includes('access') ||
                               fallbackErr?.message?.toLowerCase().includes('authentication') ||
                               fallbackErr?.message?.toLowerCase().includes('unauthorized');
            
            return { 
              success: false, 
              message: isAuthError 
                ? 'Authentication failed. Please log in again to join the meeting with the bot.'
                : (fallbackErr?.message || 'Failed to trigger bot join')
            };
          }
        }
      } finally {
        // Remove from pending requests after completion (success or failure)
        this.pendingJoinRequests.delete(meetingId);
      }
    })();

    // Store the promise for deduplication
    this.pendingJoinRequests.set(meetingId, requestPromise);
    
    return requestPromise;
  }
}

export const meetService = new MeetService();
