const API_BASE_URL =  'http://localhost:5000/api'; // 

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface SignupRequest {
  name: string;
  email: string;
  password: string;
  timezone?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  profilePictureUrl?: string;
  timezone: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  emailVerified: boolean;
  preferences?: any;
  notificationSettings?: any;
}

interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

interface Workspace {
  id: number;
  name: string;
  description?: string;
  code: string;
  colorTheme?: string;
  role?: string;
  ownerId: number;
  memberCount: number;
  createdAt: string;
  joinedAt?: string;
  members?: Array<{
    id: number;
    userId: number;
    workspaceId: number;
    user: {
      id: number;
      email: string;
      name: string;
      profilePictureUrl?: string;
    };
  }>;
  owner?: {
    id: number;
    email: string;
    name: string;
    profilePictureUrl?: string;
  };
}

interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  members?: string[];
}

interface UploadProfilePictureResponse {
  message: string;
  imageUrl: string;
}

interface UploadAudioResponse {
  message: string;
  audioUrl: string;
}

interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  priority: string;
  workspace: string | null;
  isRead: boolean;
  actionRequired: boolean;
  relatedId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

class ApiService {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('authToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Try to extract a more detailed error message
        let errorMessage = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
        
        // If there's nested error information, extract it
        if (typeof data === 'object' && data.details) {
          errorMessage = data.details;
        }
        
        return {
          error: errorMessage,
        };
      }

      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      
      // Better error messages for common network issues
      let errorMessage = 'Network error occurred';
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        error: errorMessage,
      };
    }
  }

  // Authentication methods
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    // Demo account - skip backend call
    if (credentials.email.toLowerCase() === 'areeba@kairo.com' && credentials.password === 'Kairo123') {
      const demoToken = 'demo_token_' + Date.now();
      this.setToken(demoToken);
      
      return {
        data: {
          user: {
            id: 999,
            name: 'Areeba Riaz',
            email: 'areeba@kairo.com',
            profilePictureUrl: undefined,
            timezone: 'UTC',
            isActive: true,
            emailVerified: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            preferences: {},
            notificationSettings: {}
          },
          token: demoToken,
          message: 'Login successful'
        }
      };
    }

    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.data) {
      this.setToken(response.data.token);
      // If switching from demo to real account, clear any demo user data
      if (!response.data.token.startsWith('demo_token_')) {
        try {
          localStorage.removeItem('demoUser');
        } catch {}
      }
    }

    return response;
  }

  async signup(userData: SignupRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.data) {
      this.setToken(response.data.token);
      // Ensure demo data is cleared after real signup
      if (!response.data.token.startsWith('demo_token_')) {
        try {
          localStorage.removeItem('demoUser');
        } catch {}
      }
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });

    this.clearToken();
    try {
      localStorage.clear();
    } catch {}
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    // Check if this is a demo account
    const demoUser = localStorage.getItem('demoUser');
    const token = localStorage.getItem('authToken');
    
    if (demoUser && token && token.startsWith('demo_token_')) {
      try {
        const user = JSON.parse(demoUser);
        return {
          data: { user }
        };
      } catch (e) {
        console.error('Failed to parse demo user:', e);
      }
    }

    return this.request<{ user: User }>('/auth/me');
  }

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    return this.request<{ user: User }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async updatePreferences(preferences: any): Promise<ApiResponse> {
    return this.request('/auth/me/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  async updateNotificationSettings(settings: any): Promise<ApiResponse> {
    return this.request('/auth/me/notifications', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.request('/auth/me/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async verifyToken(): Promise<ApiResponse<{ valid: boolean; user: User }>> {
    return this.request<{ valid: boolean; user: User }>('/auth/verify');
  }

  // Token management
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Workspace methods
  async createWorkspace(workspaceData: CreateWorkspaceRequest): Promise<ApiResponse<{ workspace: Workspace }>> {
    return this.request<{ workspace: Workspace }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(workspaceData),
    });
  }

  async getUserWorkspaces(): Promise<ApiResponse<{ workspaces: Workspace[] }>> {
    return this.request<{ workspaces: Workspace[] }>('/workspaces');
  }

  async getWorkspaceById(id: number): Promise<ApiResponse<{ workspace: Workspace }>> {
    return this.request<{ workspace: Workspace }>(`/workspaces/${id}`);
  }

  async updateWorkspace(id: number, updates: Partial<{ name?: string; description?: string; colorTheme?: string }>): Promise<ApiResponse<{ workspace: Workspace }>> {
    return this.request<{ workspace: Workspace }>(`/workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteWorkspace(id: number): Promise<ApiResponse> {
    return this.request(`/workspaces/${id}`, {
      method: 'DELETE',
    });
  }

  async joinWorkspace(code: string): Promise<ApiResponse<{ workspace: Workspace; alreadyMember?: boolean }>> {
    return this.request<{ workspace: Workspace; alreadyMember?: boolean }>('/workspaces/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // Workspace invitation methods
  async inviteWorkspaceMembers(workspaceId: number, emails: string[], role: string = 'member'): Promise<ApiResponse<{ results: any[] }>> {
    return this.request<{ results: any[] }>(`/workspaces/${workspaceId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ emails, role }),
    });
  }

  async getPendingInvites(): Promise<ApiResponse<{ invites: any[] }>> {
    return this.request<{ invites: any[] }>('/workspaces/invites');
  }

  async acceptWorkspaceInvitation(inviteId: number): Promise<ApiResponse<{ workspace: any; member: any }>> {
    return this.request<{ workspace: any; member: any }>(`/workspaces/invites/${inviteId}/accept`, {
      method: 'POST',
    });
  }

  async rejectWorkspaceInvitation(inviteId: number): Promise<ApiResponse> {
    return this.request(`/workspaces/invites/${inviteId}/reject`, {
      method: 'POST',
    });
  }

  async getWorkspaceInvites(workspaceId: number, status?: string): Promise<ApiResponse<{ invites: any[] }>> {
    const params = status ? `?status=${status}` : '';
    return this.request<{ invites: any[] }>(`/workspaces/${workspaceId}/invites${params}`);
  }

  async getWorkspaceLogs(workspaceId: number, limit?: number, offset?: number): Promise<ApiResponse<{ logs: any[]; pagination: any }>> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ logs: any[]; pagination: any }>(`/workspaces/${workspaceId}/logs${queryString}`);
  }

  async searchWorkspaceMembers(workspaceId: number, email: string): Promise<ApiResponse<{ members: any[]; allMembers: any[]; userExistsButNotMember?: boolean; user?: { id: number; name?: string; email: string; profilePictureUrl?: string } }>> {
    const params = new URLSearchParams();
    params.append('email', email);
    const queryString = params.toString();
    return this.request<{ members: any[]; allMembers: any[]; userExistsButNotMember?: boolean; user?: { id: number; name?: string; email: string; profilePictureUrl?: string } }>(`/workspaces/${workspaceId}/members/search?${queryString}`);
  }

  // Meeting methods
  async createMeeting(meetingData: any): Promise<ApiResponse<{ meeting: any }>> {
    return this.request<{ meeting: any }>('/meetings', {
      method: 'POST',
      body: JSON.stringify(meetingData),
    });
  }

  async getMeetingsByWorkspace(workspaceId: number, filters?: any): Promise<ApiResponse<{ meetings: any[] }>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.upcoming) params.append('upcoming', 'true');
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ meetings: any[] }>(`/meetings/workspace/${workspaceId}${queryString}`);
  }

  async getUpcomingMeetings(workspaceId: number, limit?: number): Promise<ApiResponse<{ meetings: any[] }>> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ meetings: any[] }>(`/meetings/workspace/${workspaceId}/upcoming${queryString}`);
  }

  async getTodaysMeetings(workspaceId: number): Promise<ApiResponse<{ meetings: any[] }>> {
    return this.request<{ meetings: any[] }>(`/meetings/workspace/${workspaceId}/today`);
  }

  async getMyMeetings(filters?: any): Promise<ApiResponse<{ meetings: any[] }>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.upcoming) params.append('upcoming', 'true');
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ meetings: any[] }>(`/meetings/my-meetings${queryString}`);
  }

  async getMeetingById(meetingId: number): Promise<ApiResponse<{ meeting: any }>> {
    return this.request<{ meeting: any }>(`/meetings/${meetingId}`);
  }

  async updateMeeting(meetingId: number, updates: any): Promise<ApiResponse<{ meeting: any }>> {
    return this.request<{ meeting: any }>(`/meetings/${meetingId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteMeeting(meetingId: number): Promise<ApiResponse> {
    return this.request(`/meetings/${meetingId}`, {
      method: 'DELETE',
    });
  }

  async updateMeetingStatus(meetingId: number, status: string): Promise<ApiResponse<{ meeting: any }>> {
    return this.request<{ meeting: any }>(`/meetings/${meetingId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async updateParticipantStatus(meetingId: number, userId: number, status: string): Promise<ApiResponse<{ participant: any }>> {
    return this.request<{ participant: any }>(`/meetings/${meetingId}/participants/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getMeetingStatistics(workspaceId: number, startDate?: string, endDate?: string): Promise<ApiResponse<{ statistics: any }>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ statistics: any }>(`/meetings/workspace/${workspaceId}/statistics${queryString}`);
  }

  // Meeting notes
  async getMeetingNotes(meetingId: number): Promise<ApiResponse<{ notes: any[] }>> {
    return this.request<{ notes: any[] }>(`/meetings/${meetingId}/notes`);
  }

  async createMeetingNote(
    meetingId: number,
    note: { content: string; type?: 'manual' | 'timeline'; timestamp?: number; color?: string }
  ): Promise<ApiResponse<{ note: any }>> {
    return this.request<{ note: any }>(`/meetings/${meetingId}/notes`, {
      method: 'POST',
      body: JSON.stringify(note),
    });
  }

  async updateMeetingNote(
    meetingId: number,
    noteId: number,
    updates: Partial<{ content: string; timestamp: number; color: string }>
  ): Promise<ApiResponse<{ note: any }>> {
    return this.request<{ note: any }>(`/meetings/${meetingId}/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteMeetingNote(meetingId: number, noteId: number): Promise<ApiResponse> {
    return this.request(`/meetings/${meetingId}/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  // Upload methods
  async uploadProfilePicture(imageData: string, fileExtension?: string): Promise<ApiResponse<UploadProfilePictureResponse>> {
    return this.request<UploadProfilePictureResponse>('/upload/profile-picture', {
      method: 'POST',
      body: JSON.stringify({ imageData, fileExtension }),
    });
  }

  async uploadAudioRecording(audioData: string, fileExtension?: string): Promise<ApiResponse<UploadAudioResponse>> {
    return this.request<UploadAudioResponse>('/upload/audio-recording', {
      method: 'POST',
      body: JSON.stringify({ audioData, fileExtension }),
    });
  }

  // Notification methods
  async getNotifications(filters?: { isRead?: boolean; type?: string }): Promise<ApiResponse<NotificationsResponse>> {
    const params = new URLSearchParams();
    if (filters?.isRead !== undefined) {
      params.append('isRead', filters.isRead.toString());
    }
    if (filters?.type) {
      params.append('type', filters.type);
    }
    
    const queryString = params.toString();
    const endpoint = queryString ? `/notifications?${queryString}` : '/notifications';
    
    return this.request<NotificationsResponse>(endpoint);
  }

  async getUnreadNotificationCount(): Promise<ApiResponse<{ unreadCount: number }>> {
    return this.request<{ unreadCount: number }>('/notifications/unread-count');
  }

  async markNotificationAsRead(id: number): Promise<ApiResponse<{ notification: Notification }>> {
    return this.request<{ notification: Notification }>(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse<{ count: number }>> {
    return this.request<{ count: number }>('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(id: number): Promise<ApiResponse> {
    return this.request(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  // Meeting file methods
  async getMeetingFiles(meetingId: number): Promise<ApiResponse<{ files: any[] }>> {
    return this.request<{ files: any[] }>(`/meetings/${meetingId}/files`);
  }

  async uploadMeetingFile(meetingId: number, file: File): Promise<ApiResponse<{ file: any }>> {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseURL}/meetings/${meetingId}/files`;
    const token = this.getToken();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      let errorMessage = 'Network error occurred';
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      return { error: errorMessage };
    }
  }

  async downloadMeetingFile(meetingId: number, fileId: number): Promise<Blob | null> {
    const url = `${this.baseURL}/meetings/${meetingId}/files/${fileId}/download`;
    const token = this.getToken();

    try {
      const response = await fetch(url, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        console.error('Download failed:', response.statusText);
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.error('Download error:', error);
      return null;
    }
  }

  async deleteMeetingFile(meetingId: number, fileId: number): Promise<ApiResponse> {
    return this.request(`/meetings/${meetingId}/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  // Action Items
  async getActionItems(meetingId: number, status?: 'pending' | 'confirmed' | 'rejected'): Promise<ApiResponse<{ actionItems: any[] }>> {
    const query = status ? `?status=${status}` : '';
    return this.request<{ actionItems: any[] }>(`/action-items/meetings/${meetingId}${query}`);
  }

  async getLiveActionItems(meetingId: number, since?: string): Promise<ApiResponse<{ actionItems: any[]; latestUpdate: string | null }>> {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request<{ actionItems: any[]; latestUpdate: string | null }>(`/action-items/meetings/${meetingId}/live${query}`);
  }

  async getLiveTranscript(meetingId: number, since?: string): Promise<ApiResponse<{ entries: any[]; latestTimestamp: string; hasMore: boolean }>> {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request<{ entries: any[]; latestTimestamp: string; hasMore: boolean }>(`/meetings/${meetingId}/transcript/live${query}`);
  }

  async getTranscript(meetingId: number): Promise<ApiResponse<{ transcript: any[] }>> {
    return this.request<{ transcript: any[] }>(`/meetings/${meetingId}/transcript`);
  }

  async getPendingActionItems(meetingId: number): Promise<ApiResponse<{ actionItems: any[] }>> {
    return this.request<{ actionItems: any[] }>(`/action-items/meetings/${meetingId}/pending`);
  }

  async confirmActionItem(actionItemId: number): Promise<ApiResponse<{ actionItem: any }>> {
    return this.request<{ actionItem: any }>(`/action-items/${actionItemId}/confirm`, {
      method: 'POST',
    });
  }

  async rejectActionItem(actionItemId: number): Promise<ApiResponse<{ actionItem: any }>> {
    return this.request<{ actionItem: any }>(`/action-items/${actionItemId}/reject`, {
      method: 'POST',
    });
  }
}

export type { Notification, NotificationsResponse };

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;
