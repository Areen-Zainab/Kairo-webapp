const API_BASE_URL = 'http://localhost:5000/api'; // 

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
    // Always refresh token from localStorage before making request
    // This ensures we have the latest token even if it was updated elsewhere
    // CRITICAL: Don't clear existing token if localStorage is temporarily unavailable
    try {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken && storedToken.trim()) {
        // Token exists in localStorage - use it
        this.token = storedToken.trim();
      } else if (!storedToken) {
        // Token is missing from localStorage
        // Only clear from memory if we're certain it was intentionally removed
        // Don't clear if we already have a token in memory (might be a localStorage access issue)
        if (!this.token) {
          // No token in memory either - this is expected for unauthenticated requests
          // Don't log warning for auth endpoints
          const isAuthEndpoint = endpoint.startsWith('/auth/');
          if (!isAuthEndpoint) {
            console.warn(`[ApiService] No token in localStorage or memory for ${endpoint}`);
          }
        }
        // Keep existing token in memory if localStorage is empty but we have one
        // This prevents clearing valid tokens due to localStorage timing issues
      }
    } catch (error) {
      console.error('[ApiService] Error reading token from localStorage:', error);
      // Continue with existing token if localStorage access fails
      // Don't clear this.token - it might still be valid
    }

    const url = `${this.baseURL}${endpoint}`;

    // Build headers - ensure Authorization is included if token exists
    // CRITICAL: Build headers object carefully to ensure Authorization is always included when token exists
    const headers: Record<string, string> = {};

    // First, set Content-Type
    headers['Content-Type'] = 'application/json';

    // Then, spread any custom headers from options (but don't let them overwrite Authorization)
    if (options.headers) {
      // Handle both Headers object and plain object
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          // Don't copy Authorization from options.headers - we'll set it ourselves
          if (key.toLowerCase() !== 'authorization') {
            headers[key] = value;
          }
        });
      } else if (typeof options.headers === 'object') {
        // Plain object - spread it but exclude Authorization
        Object.entries(options.headers).forEach(([key, value]) => {
          if (key.toLowerCase() !== 'authorization' && value) {
            headers[key] = String(value);
          }
        });
      }
    }

    // Always include Authorization header if token is available
    // Set it LAST to ensure it's never overwritten
    if (this.token && this.token.trim()) {
      const authValue = `Bearer ${this.token.trim()}`;
      headers['Authorization'] = authValue;

      // Log for debugging
      if (endpoint.includes('/meetings')) {
        console.log(`[ApiService] Adding Authorization header for ${endpoint} (token length: ${this.token.length})`);
      }
    } else {
      // Log warning if token is missing for protected endpoints
      // (Some endpoints like /auth/login don't need tokens)
      const isAuthEndpoint = endpoint.startsWith('/auth/');
      if (!isAuthEndpoint) {
        console.warn(`[ApiService] No token available for request to ${endpoint}`);
        // Try one more time to get token from localStorage
        const lastChanceToken = localStorage.getItem('authToken');
        if (lastChanceToken && lastChanceToken.trim()) {
          console.log(`[ApiService] Recovered token from localStorage for ${endpoint}`);
          this.token = lastChanceToken.trim();
          headers['Authorization'] = `Bearer ${this.token.trim()}`;
        }
      }
    }

    // Verify Authorization header is set before making request
    if (!headers['Authorization'] && !endpoint.startsWith('/auth/')) {
      console.error(`[ApiService] CRITICAL: Authorization header missing for ${endpoint} even though token exists: ${!!this.token}`);
    }

    // CRITICAL: Build config carefully - options.headers should NOT overwrite our headers
    // Extract headers from options separately to prevent overwrite
    const { headers: optionsHeaders, ...restOptions } = options;

    // Final check: ensure Authorization is in headers before building config
    const finalHeaders = { ...headers };
    if (this.token && this.token.trim() && !finalHeaders['Authorization']) {
      console.error(`[ApiService] CRITICAL BUG: Token exists but Authorization header missing! Adding it now.`);
      finalHeaders['Authorization'] = `Bearer ${this.token.trim()}`;
    }

    const config: RequestInit = {
      ...restOptions, // Spread options first (without headers)
      headers: finalHeaders, // Then set our carefully constructed headers (this takes precedence)
      method: options.method || 'GET', // Ensure method is set
    };

    // Final verification: ensure Authorization header is in the final config
    if (finalHeaders['Authorization'] && endpoint.includes('/meetings')) {
      const authHeader = typeof config.headers === 'object' && !(config.headers instanceof Headers)
        ? (config.headers as any)['Authorization']
        : null;
      if (authHeader) {
        console.log(`[ApiService] Verified Authorization header in config for ${endpoint} (${authHeader.substring(0, 20)}...)`);
      } else {
        console.error(`[ApiService] CRITICAL: Authorization header missing from final config for ${endpoint}!`);
      }
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized - only clear token if it's actually expired or invalid
        if (response.status === 401) {
          // Try to extract a more detailed error message
          let errorMessage = data.error || data.message || 'Authentication required';

          // If there's nested error information, extract it
          if (typeof data === 'object' && data.details) {
            errorMessage = data.details;
          }

          // Only clear token for actual expiration or invalid token errors
          // Don't clear for "Access token required" - that might just mean token wasn't sent
          const shouldClearToken = errorMessage.toLowerCase().includes('token expired') ||
            errorMessage.toLowerCase().includes('invalid token') ||
            errorMessage.toLowerCase().includes('invalid or inactive user');

          if (shouldClearToken && this.token) {
            console.warn(`[ApiService] Received 401 with token error for ${endpoint}: ${errorMessage}`);
            console.warn(`[ApiService] Clearing token due to: ${errorMessage}`);
            this.clearToken();
          } else if (!this.token) {
            console.warn(`[ApiService] Received 401 for ${endpoint}, but no token was sent`);
            // Try to recover token from localStorage one more time
            const recoveredToken = localStorage.getItem('authToken');
            if (recoveredToken && recoveredToken.trim()) {
              console.log(`[ApiService] Token recovered from localStorage after 401 - this suggests a timing issue`);
              this.token = recoveredToken.trim();
            }
          } else {
            // Token exists in memory but got 401
            // This could mean:
            // 1. Token wasn't sent in header (bug)
            // 2. Token is invalid/expired (but we're not clearing it because error message doesn't indicate expiration)
            // 3. Backend issue
            console.warn(`[ApiService] Received 401 for ${endpoint}, but token exists in memory (error: ${errorMessage})`);
            console.warn(`[ApiService] Token in memory: ${this.token ? 'exists' : 'missing'}, length: ${this.token?.length || 0}`);

            // If error is "Access token required", it means header wasn't sent
            // This is a bug - token exists but wasn't included
            if (errorMessage.toLowerCase().includes('access token required')) {
              console.error(`[ApiService] BUG: Token exists but wasn't sent in Authorization header for ${endpoint}`);
            }
          }

          // Provide more helpful error message
          if (errorMessage === 'Access token required' || errorMessage === 'Authentication required') {
            // If we have a token but got this error, it's likely a bug
            if (this.token) {
              errorMessage = 'Authentication error occurred. Please try again or refresh the page.';
            } else {
              errorMessage = 'Please log in to continue. Your session may have expired.';
            }
          }

          return {
            error: errorMessage,
          };
        }

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
      console.log('[ApiService] Demo login successful, token set');

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

    if (response.data && response.data.token) {
      this.setToken(response.data.token);
      console.log('[ApiService] Login successful, token set');
      // If switching from demo to real account, clear any demo user data
      if (!response.data.token.startsWith('demo_token_')) {
        try {
          localStorage.removeItem('demoUser');
        } catch { }
      }
    } else {
      console.warn('[ApiService] Login response missing token');
    }

    return response;
  }

  async signup(userData: SignupRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.data && response.data.token) {
      this.setToken(response.data.token);
      console.log('[ApiService] Signup successful, token set');
      // Ensure demo data is cleared after real signup
      if (!response.data.token.startsWith('demo_token_')) {
        try {
          localStorage.removeItem('demoUser');
        } catch { }
      }
    } else {
      console.warn('[ApiService] Signup response missing token');
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
    } catch { }
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
    if (!token || !token.trim()) {
      console.warn('[ApiService] Attempted to set empty token');
      return;
    }
    this.token = token.trim();
    try {
      localStorage.setItem('authToken', this.token);
      console.log('[ApiService] Token set successfully');
    } catch (error) {
      console.error('[ApiService] Error setting token in localStorage:', error);
      // Still keep token in memory even if localStorage fails
    }
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    // Always check localStorage for the latest token
    const storedToken = localStorage.getItem('authToken');
    if (storedToken && storedToken.trim()) {
      this.token = storedToken.trim();
      return true;
    }
    // Clear token from memory if not in localStorage
    if (this.token) {
      this.token = null;
    }
    return false;
  }

  /**
   * Refresh token from localStorage
   * Call this before making requests if you suspect the token might be stale
   */
  refreshToken(): void {
    try {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken && storedToken.trim()) {
        this.token = storedToken.trim();
        console.log('[ApiService] Token refreshed from localStorage');
      } else if (!storedToken) {
        // Token missing from localStorage
        // Only clear from memory if we're certain it was intentionally removed
        // Keep existing token in memory to prevent race conditions
        if (!this.token) {
          // No token in memory either - this is fine, user might not be logged in
        } else {
          // We have a token in memory but not in localStorage
          // This could be a localStorage issue or the token was cleared elsewhere
          // Keep the token in memory for this request - it might still be valid
          console.warn('[ApiService] Token not found in localStorage, but keeping token in memory (may still be valid)');
        }
      }
    } catch (error) {
      console.error('[ApiService] Error refreshing token:', error);
      // Don't clear this.token on error - keep existing token
    }
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
    // Ensure token is refreshed before making request
    // Note: request() will also refresh token, but this ensures we have it before the request
    this.refreshToken();

    // Double-check token is available before making request
    if (!this.token) {
      const tokenFromStorage = localStorage.getItem('authToken');
      if (tokenFromStorage && tokenFromStorage.trim()) {
        this.token = tokenFromStorage.trim();
        console.log('[ApiService] Token recovered from localStorage in createMeeting');
      } else {
        console.error('[ApiService] No token available for createMeeting - user may need to log in');
        return {
          error: 'Please log in to create a meeting. Your session may have expired.'
        };
      }
    }

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
    // Ensure token is refreshed before making request
    this.refreshToken();

    // Double-check token is available
    if (!this.token) {
      const tokenFromStorage = localStorage.getItem('authToken');
      if (tokenFromStorage && tokenFromStorage.trim()) {
        this.token = tokenFromStorage.trim();
      }
    }

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
  async getActionItems(meetingId: number | string, status?: 'pending' | 'confirmed' | 'rejected'): Promise<ApiResponse<{ actionItems: any[] }>> {
    const query = status ? `?status=${status}` : '';
    return this.request<{ actionItems: any[] }>(`/action-items/meetings/${meetingId}${query}`);
  }

  async getLiveActionItems(meetingId: number | string, since?: string): Promise<ApiResponse<{ actionItems: any[]; latestUpdate: string | null }>> {
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

  // AI Insights methods
  async getAIInsights(meetingId: number): Promise<ApiResponse<{
    summary: {
      paragraph: string;
      bullets: string[];
      confidence?: number;
    } | null;
    keyDecisions: Array<{
      decision: string;
      context: string;
      impact: string;
      participants: string[];
      timestamp?: number;
      confidence?: number;
    }>;
    actionItems: Array<{
      item: string;
      assignee?: string;
      dueDate?: string;
      priority?: string;
      confidence?: number;
    }>;
    sentiment: {
      overall: string;
      confidence: number;
      breakdown: {
        positive: number;
        neutral: number;
        negative: number;
      };
    } | null;
    topics: Array<{
      name: string;
      mentions: number;
      sentiment: string;
    }>;
    participants: Array<{
      name: string;
      speakingTime: number | string;
      speakingTimeSeconds?: number;
      engagement: string;
      keyContributions: string[];
      sentiment?: string;
    }>;
    generated: boolean;
    generating?: boolean;
    progress?: number;
  }>> {
    return this.request(`/meetings/${meetingId}/ai-insights`);
  }

  async regenerateAIInsights(meetingId: number): Promise<ApiResponse<{
    success: boolean;
    message: string;
  }>> {
    return this.request(`/meetings/${meetingId}/ai-insights/regenerate`, {
      method: 'POST',
    });
  }
}

export type { Notification, NotificationsResponse };

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;
