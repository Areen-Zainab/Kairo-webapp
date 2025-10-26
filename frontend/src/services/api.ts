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
  id: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
  audioSampleUrl?: string;
  timezone: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  preferences?: any;
  notificationSettings?: any;
}

interface AuthResponse {
  user: User;
  token: string;
  message: string;
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
        return {
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Authentication methods
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.data) {
      this.setToken(response.data.token);
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
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });

    this.clearToken();
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
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
}

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;
