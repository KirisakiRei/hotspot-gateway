import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getErrorMessage } from '@/lib/error';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Timeout configurations for different operations
export const TIMEOUTS = {
  DEFAULT: 15000,        // 15s for normal operations
  SLOW: 60000,           // 60s for slow operations (Mikrotik bulk)
  VERY_SLOW: 120000,     // 120s for very slow operations
};

// Extend AxiosRequestConfig to include skipAuthRedirect flag
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

// Create axios instance with default timeout
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUTS.DEFAULT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 - try refresh token (only for admin endpoints)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip auth redirect for portal endpoints (public APIs)
      if (originalRequest.skipAuthRedirect) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data.data;
        localStorage.setItem('access_token', accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login (admin only)
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/admin/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// ==========================================
// AUTHENTICATION
// ==========================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  login: (data: LoginRequest) => api.post<ApiResponse<LoginResponse>>('/auth/login', data),
  refresh: (refreshToken: string) => api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh', { refreshToken }),
  me: () => api.get<ApiResponse<LoginResponse['admin']>>('/auth/me'),
};

// ==========================================
// ADVERTISEMENTS
// ==========================================

export interface Advertisement {
  id: string;
  title: string;
  description?: string;
  videoType: 'YOUTUBE' | 'LOCAL' | 'GDRIVE' | 'URL';
  videoUrl: string;
  youtubeId?: string;
  thumbnailUrl?: string;
  duration: number;
  startTime: number;
  endTime?: number;
  displayDuration: number;
  skipable: boolean;
  skipAfter: number;
  priority: number;
  weight: number;
  isActive: boolean;
  // Database uses these field names
  views: number;
  completions: number;
  skips: number;
  avgWatchTime: number;
  completionRate: number;
  // Aliases for backward compat
  viewCount?: number;
  completionCount?: number;
  skipCount?: number;
}

export interface TrackAdRequest {
  userId?: string;
  deviceId?: string;
}

export const advertisementApi = {
  getActive: () => api.get<ApiResponse<Advertisement>>('/advertisements/active', { skipAuthRedirect: true }),
  trackView: (id: string, data: TrackAdRequest) => api.post<ApiResponse>(`/advertisements/${id}/view`, data, { skipAuthRedirect: true }),
  trackComplete: (id: string, data: TrackAdRequest) => api.post<ApiResponse>(`/advertisements/${id}/complete`, data, { skipAuthRedirect: true }),
  trackSkip: (id: string, data: TrackAdRequest) => api.post<ApiResponse>(`/advertisements/${id}/skip`, data, { skipAuthRedirect: true }),
  getAll: (params?: Record<string, string | number | boolean | undefined>) => api.get<ApiResponse<Advertisement[]>>('/advertisements', { params }),
  getById: (id: string) => api.get<ApiResponse<Advertisement>>(`/advertisements/${id}`),
  create: (data: Partial<Advertisement>) => api.post<ApiResponse<Advertisement>>('/advertisements', data),
  update: (id: string, data: Partial<Advertisement>) => api.patch<ApiResponse<Advertisement>>(`/advertisements/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse>(`/advertisements/${id}`),
  upload: (formData: FormData) => api.post<ApiResponse<{ filename: string; videoUrl: string; size: number }>>('/advertisements/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: TIMEOUTS.VERY_SLOW,
  }),
};

// ==========================================
// VOUCHERS
// ==========================================

export interface VoucherProfile {
  id: string;
  name: string;
  description?: string;
  duration: number; // in minutes
  quota?: number | string | null; // in bytes, null = unlimited
  uploadSpeed?: number | null; // in kbps
  downloadSpeed?: number | null; // in kbps
  sharedUsers: number;
  validityDays: number;
  price?: number | null;
  isActive: boolean;
  _count?: {
    vouchers: number;
  };
}

export interface Voucher {
  id: string;
  code: string;
  profileId: string;
  profile?: VoucherProfile;
  status: string;
  userId?: string;
  batchId?: string;
  generatedAt: Date;
  expiresAt: Date;
  usedAt?: Date;
}

export interface RequestVoucherRequest {
  phone: string;
  mac: string;
  ip: string;
}

export interface RedeemVoucherRequest {
  code: string;
  mac: string;
  ip: string;
}

export interface AuthenticateVoucherRequest {
  code: string;
  mac: string;
  ip: string;
  linkOrig?: string;
}

export interface CheckSessionRequest {
  mac: string;
}

export interface DisconnectRequest {
  mac: string;
}

export interface SessionInfo {
  mac: string;
  ip: string;
  username: string;
  uptime: string;
  bytesIn: string;
  bytesOut: string;
  expiresAt: Date;
  voucher: {
    code: string;
    profile: {
      name: string;
      duration: number;
      uploadSpeed: number;
      downloadSpeed: number;
    };
  };
}

export const voucherApi = {
  // Portal endpoints (public) - use SLOW timeout for Mikrotik operations
  request: (data: RequestVoucherRequest) => api.post<ApiResponse<{ voucher: Voucher; message: string }>>('/vouchers/request', data, { timeout: TIMEOUTS.SLOW, skipAuthRedirect: true }),
  resend: (data: RequestVoucherRequest) => api.post<ApiResponse<{ voucher: Voucher; message: string }>>('/vouchers/resend', data, { timeout: TIMEOUTS.SLOW, skipAuthRedirect: true }),
  redeem: (data: RedeemVoucherRequest) => api.post<ApiResponse<{ session: SessionInfo; message: string }>>('/vouchers/redeem', data, { timeout: TIMEOUTS.SLOW, skipAuthRedirect: true }),
  
  // Phase 3: Authentication endpoints - use SLOW for Mikrotik operations
  authenticate: (data: AuthenticateVoucherRequest) => api.post<ApiResponse<{ session: SessionInfo; message: string; loginUrl?: string }>>('/vouchers/authenticate', data, { timeout: TIMEOUTS.SLOW, skipAuthRedirect: true }),
  checkSession: (params: CheckSessionRequest) => api.get<ApiResponse<SessionInfo | null>>('/vouchers/check-session', { params, skipAuthRedirect: true }),
  disconnect: (data: DisconnectRequest) => api.post<ApiResponse<{ message: string }>>('/vouchers/disconnect', data, { skipAuthRedirect: true }),

  // Admin endpoints
  getProfiles: () => api.get<ApiResponse<VoucherProfile[]>>('/vouchers/profiles'),
  getProfile: (id: string) => api.get<ApiResponse<VoucherProfile>>(`/vouchers/profiles/${id}`),
  createProfile: (data: Partial<VoucherProfile>) => api.post<ApiResponse<VoucherProfile>>('/vouchers/profiles', data, { timeout: TIMEOUTS.SLOW }),
  updateProfile: (id: string, data: Partial<VoucherProfile>) => api.patch<ApiResponse<VoucherProfile>>(`/vouchers/profiles/${id}`, data, { timeout: TIMEOUTS.SLOW }),
  deleteProfile: (id: string, forceDelete = false) => 
    api.delete<ApiResponse>(`/vouchers/profiles/${id}`, { 
      params: { force: forceDelete },
      timeout: TIMEOUTS.VERY_SLOW  // 120s for bulk deletion
    }),
  syncProfiles: () => api.post<ApiResponse>('/vouchers/profiles/sync', {}, { timeout: TIMEOUTS.VERY_SLOW }),

  generate: (data: { profileId: string; quantity?: number; count?: number; prefix?: string; length?: number; format?: string; batchName?: string }) =>
    api.post<ApiResponse<Voucher[]>>('/vouchers/generate', data, { timeout: TIMEOUTS.SLOW }),
  getAll: (params?: Record<string, string | number | boolean | undefined>) => api.get<ApiResponse<Voucher[]>>('/vouchers', { params }),
  getById: (id: string) => api.get<ApiResponse<Voucher>>(`/vouchers/${id}`),
  disable: (id: string) => api.patch<ApiResponse>(`/vouchers/${id}/disable`),
  getStats: () => api.get<ApiResponse<Record<string, number>>>('/vouchers/stats'),
};

// ==========================================
// USERS
// ==========================================

export interface User {
  id: string;
  name?: string;
  email?: string;
  phone: string;
  mac?: string;       // Alias for macAddress
  macAddress?: string;
  ip?: string;        // Alias for ipAddress  
  ipAddress?: string;
  server?: string;
  status: string;
  isOnline?: boolean;
  isBlocked?: boolean;
  blockReason?: string;
  voucherId?: string;
  currentVoucherId?: string;
  quotaUsed?: number;
  timeUsed?: number;
  loginAt?: string;
  logoutAt?: string;
  createdAt: string;
  updatedAt: string;
  voucher?: Voucher;
  bytesIn?: number;
  bytesOut?: number;
  uptime?: string;
  sessionTime?: string;
}

export const userApi = {
  getAll: (params?: Record<string, string | number | boolean | undefined>) => api.get<ApiResponse<User[]>>('/users', { params, timeout: TIMEOUTS.SLOW }),
  getOnline: () => api.get<ApiResponse<User[]>>('/users/online', { timeout: TIMEOUTS.SLOW }),
  getStats: () => api.get<ApiResponse<{ total: number; online: number; offline: number; blocked: number }>>('/users/stats'),
  getById: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`),
  kick: (id: string) => api.put<ApiResponse>(`/users/${id}/kick`, {}, { timeout: TIMEOUTS.SLOW }),
  block: (id: string, reason?: string) => api.put<ApiResponse>(`/users/${id}/block`, { reason }),
  unblock: (id: string) => api.put<ApiResponse>(`/users/${id}/unblock`),
  delete: (id: string) => api.delete<ApiResponse>(`/users/${id}`),
};

// ==========================================
// MIKROTIK
// ==========================================

export const mikrotikApi = {
  getStatus: () => api.get<ApiResponse<{ connected: boolean }>>('/mikrotik/status'),
  connect: () => api.post<ApiResponse<{ connected?: boolean }>>('/mikrotik/connect'),
  getUsers: () => api.get<ApiResponse<Array<{ '.id': string; name: string; profile: string; disabled: string; password?: string; 'mac-address'?: string; comment?: string }>>>('/mikrotik/users'),
  getActiveSessions: () => api.get<ApiResponse<Array<{ '.id': string; user: string; address: string; 'mac-address': string; uptime: string; 'bytes-in'?: string; 'bytes-out'?: string }>>>('/mikrotik/active-sessions'),
  getProfiles: () => api.get<ApiResponse<Array<{ '.id': string; name: string; 'shared-users': string; 'rate-limit'?: string }>>>('/mikrotik/profiles'),
  disconnect: (username: string) => api.post<ApiResponse>('/mikrotik/disconnect', { username }),
  
  // Phase 4: Monitoring endpoints
  getSystemResources: () => api.get<ApiResponse<SystemResources>>('/mikrotik/monitoring/system'),
  getSessionsStats: () => api.get<ApiResponse<SessionsStats>>('/mikrotik/monitoring/sessions'),
  getInterfaceStats: (name?: string) => api.get<ApiResponse<InterfaceStats>>(`/mikrotik/monitoring/interface/${name || 'ether1'}`),
  getHotspotStats: () => api.get<ApiResponse<HotspotStats>>('/mikrotik/monitoring/hotspot'),
  getMonitoringDashboard: () => api.get<ApiResponse<MonitoringDashboard>>('/mikrotik/monitoring/dashboard'),
};

// Phase 4: Monitoring interfaces
export interface SystemResources {
  uptime: string;
  version: string;
  cpuLoad: number;
  freeMemory: number;
  totalMemory: number;
  freeHddSpace: number;
  totalHddSpace: number;
  boardName: string;
  architecture: string;
}

export interface SessionsStats {
  totalSessions: number;
  totalBytesIn: number;
  totalBytesOut: number;
  totalTraffic: number;
  sessions: Array<{
    id: string;
    user: string;
    address: string;
    mac: string;
    uptime: string;
    bytesIn: number;
    bytesOut: number;
    loginBy: string;
  }>;
}

export interface InterfaceStats {
  name: string;
  rxByte: number;
  txByte: number;
  rxPacket: number;
  txPacket: number;
  rxDrop: number;
  txDrop: number;
  rxError: number;
  txError: number;
  running: boolean;
}

export interface HotspotStats {
  totalUsers: number;
  activeUsers: number;
  totalProfiles: number;
  usersData: Array<{
    name: string;
    profile: string;
    uptime: string;
    bytesIn: string;
    bytesOut: string;
  }>;
}

export interface MonitoringDashboard {
  system: SystemResources;
  sessions: SessionsStats;
  hotspot: HotspotStats;
  interface: InterfaceStats;
  timestamp: string;
}

// ==========================================
// WHATSAPP GATEWAY
// ==========================================

export interface WaSessionInfo {
  id: string;
  phone: string;
  name: string | null;
  active: boolean;
  state: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'CLOSING';
  sentCount: number;
  paired: boolean;
  qrAvailable: boolean;
  pairedAt: string | null;
  lastSeenAt: string | null;
  lastError: string | null;
}

export interface WaStatus {
  connected: boolean;
  enabled: boolean;
  roundRobinThreshold: number;
  autoReconnect: boolean;
  sessions: Array<{
    phone: string;
    name: string | null;
    active: boolean;
    state: WaSessionInfo['state'];
    sentCount: number;
    paired: boolean;
    qrAvailable: boolean;
    pairedAt: string | null;
    lastSeenAt: string | null;
    lastError: string | null;
  }>;
  totalSentToday: number;
}

export interface WaMessageLogRow {
  id: string;
  sessionPhone: string;
  recipientPhone: string;
  messageType: 'TEXT' | 'VOUCHER' | 'INCOMING';
  message: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'RECEIVED' | 'REJECTED';
  errorMessage: string | null;
  voucherCode: string | null;
  sentAt: string | null;
  createdAt: string;
}

export const whatsappApi = {
  getStatus: () => api.get<ApiResponse<WaStatus>>('/whatsapp/status'),
  getConfig: () => api.get<ApiResponse<{ enabled: boolean; roundRobinThreshold: number; autoReconnect: boolean }>>('/whatsapp/config'),
  updateConfig: (data: { enabled?: boolean; roundRobinThreshold?: number; autoReconnect?: boolean }) =>
    api.put<ApiResponse>('/whatsapp/config', data),
  test: () => api.post<ApiResponse<{ connected: boolean; detail: string }>>('/whatsapp/test'),

  // Sessions
  getSessions: () => api.get<ApiResponse<WaSessionInfo[]>>('/whatsapp/sessions'),
  addSession: (data: { phone: string; name?: string }) => api.post<ApiResponse<WaSessionInfo>>('/whatsapp/sessions', data),
  updateSession: (phone: string, data: { name?: string; active?: boolean }) =>
    api.put<ApiResponse<WaSessionInfo>>(`/whatsapp/sessions/${phone}`, data),
  removeSession: (phone: string) => api.delete<ApiResponse>(`/whatsapp/sessions/${phone}`),
  getQr: (phone: string) => api.get<ApiResponse<{ qr: string }>>(`/whatsapp/sessions/${phone}/qr`),
  connect: (phone: string) => api.post<ApiResponse<WaSessionInfo>>(`/whatsapp/sessions/${phone}/connect`),
  logout: (phone: string) => api.post<ApiResponse>(`/whatsapp/sessions/${phone}/logout`),

  // Send / contact
  send: (data: { phone: string; message: string }) => api.post<ApiResponse<{ sent: boolean }>>('/whatsapp/send', data),
  sendVoucher: (data: { phone: string; voucherCode: string; profile: { name: string; duration: number; quota?: number; validityDays?: number } }) =>
    api.post<ApiResponse<{ sent: boolean }>>('/whatsapp/send-voucher', data),
  checkNumber: (phone: string) => api.post<ApiResponse<{ phone: string; exists: boolean }>>('/whatsapp/check-number', { phone }),
  contactInfo: (phone: string) => api.post<ApiResponse<{ phone: string; name: string | null; pushName: string | null; isWhatsApp: boolean }>>('/whatsapp/contact-info', { phone }),

  // Logs
  getLogs: (params: { limit?: number; offset?: number; status?: string; sessionPhone?: string; recipientPhone?: string }) =>
    api.get<ApiResponse<{ rows: WaMessageLogRow[]; total: number }>>('/whatsapp/logs', { params }),
};

// ==========================================
// ADMIN MANAGEMENT
// ==========================================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RolePermission {
  id: string;
  name: string;
  permissions: {
    dashboard: boolean;
    users: { view: boolean; create: boolean; edit: boolean; delete: boolean };
    vouchers: { view: boolean; create: boolean; edit: boolean; delete: boolean };
    ads: { view: boolean; create: boolean; edit: boolean; delete: boolean };
    router: { view: boolean; edit: boolean };
    logs: { view: boolean };
    settings: { view: boolean; edit: boolean };
  };
  userCount?: number;
  isCustom?: boolean;
}

export const adminApi = {
  // Admin users CRUD
  getAdmins: () => api.get<ApiResponse<AdminUser[]>>('/admin/users'),
  getAdmin: (id: string) => api.get<ApiResponse<AdminUser>>(`/admin/users/${id}`),
  createAdmin: (data: { email: string; password: string; name: string; role: string; isActive?: boolean }) => 
    api.post<ApiResponse<AdminUser>>('/admin/users', data),
  updateAdmin: (id: string, data: Partial<{ email: string; password: string; name: string; role: string; isActive: boolean }>) => 
    api.put<ApiResponse<AdminUser>>(`/admin/users/${id}`, data),
  deleteAdmin: (id: string) => api.delete<ApiResponse>(`/admin/users/${id}`),

  // Role permissions
  getRoles: () => api.get<ApiResponse<RolePermission[]>>('/admin/roles'),
  updateRole: (role: string, permissions: RolePermission['permissions']) => api.put<ApiResponse>(`/admin/roles/${role}`, permissions),
  createRole: (name: string, permissions: RolePermission['permissions']) => api.post<ApiResponse>('/admin/roles', { name, permissions }),
  deleteRole: (role: string) => api.delete<ApiResponse>(`/admin/roles/${role}`),
};

// ==========================================
// SETTINGS
// ==========================================

export interface Setting {
  id: string;
  key: string;
  value: string;
  type: string;
  group: string;
  description?: string;
}

export const settingApi = {
  getAll: () => api.get<ApiResponse<Setting[]>>('/settings'),
  getMikrotik: () => api.get<ApiResponse<Setting[]>>('/settings/mikrotik'),
  getPortal: () => api.get<ApiResponse<Setting[]>>('/settings/portal'),
  getByKey: (key: string) => api.get<ApiResponse<Setting>>(`/settings/${key}`),
  update: (key: string, value: string) => api.put<ApiResponse<Setting>>(`/settings/${key}`, { value }),
  bulkUpdate: (settings: Record<string, string>) => {
    // Convert object to array format that backend expects
    const settingsArray = Object.entries(settings).map(([key, value]) => ({ key, value }));
    return api.put<ApiResponse>('/settings', settingsArray);
  },
  testMikrotik: (config: Record<string, string>) => api.post<ApiResponse<{ connected: boolean; message: string }>>('/settings/test-mikrotik', config),
};

// ==========================================
// DASHBOARD
// ==========================================

export interface DashboardStats {
  users: {
    total: number;
    online: number;
    offline: number;
    blocked: number;
    today: number;
    month: number;
  };
  vouchers: {
    total: number;
    unused: number;
    active: number;
    used: number;
    expired: number;
    todayRedeemed: number;
    monthRedeemed: number;
  };
  advertisements: {
    total: number;
    active: number;
    totalViews: number;
    totalCompletions: number;
    completionRate: number;
  };
  sessions: {
    active: number;
    today: number;
    month: number;
  };
  topProfiles: Array<{
    id: string;
    name: string;
    voucherCount: number;
    price: number;
  }>;
  activity: Array<{
    date: string;
    users: number;
  }>;
}

export const dashboardApi = {
  getStats: () => api.get<ApiResponse<DashboardStats>>('/dashboard/stats'),
  getRecentUsers: (limit?: number) => api.get<ApiResponse<Array<{ id: string; name?: string | null; phone: string; mac?: string | null; macAddress?: string | null; isOnline?: boolean; createdAt: string }>>>('/dashboard/recent-users', { params: { limit } }),
  getRecentVouchers: (limit?: number) => api.get<ApiResponse<Array<{ id: string; code: string; status: string; profile?: { name: string }; users?: { name: string }[]; createdAt?: string; generatedAt?: string }>>>('/dashboard/recent-vouchers', { params: { limit } }),
  getRecentLogs: (limit?: number) => api.get<ApiResponse<Array<{ id: string; type: string; action: string; admin?: { name: string }; createdAt: string }>>>('/dashboard/recent-logs', { params: { limit } }),
  getTopAdvertisements: (limit?: number) => api.get<ApiResponse<Advertisement[]>>('/dashboard/top-advertisements', { params: { limit } }),
};

// ==========================================
// LOGS
// ==========================================

export interface SystemLog {
  id: string;
  type: string;
  action: string;
  description?: string;
  status: string;
  userId?: string;
  adminId?: string;
  ipAddress?: string;
  macAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
}

export const logApi = {
  getAll: (params?: Record<string, string | number | boolean | undefined>) => api.get<ApiResponse<SystemLog[]>>('/logs', { params }),
  getById: (id: string) => api.get<ApiResponse<SystemLog>>(`/logs/${id}`),
  getActions: () => api.get<ApiResponse<string[]>>('/logs/actions'),
  getEntities: () => api.get<ApiResponse<string[]>>('/logs/entities'),
  cleanup: (daysOld: number) => api.delete<ApiResponse>('/logs/cleanup', { params: { daysOld } }),
};

// ==========================================
// HELPERS
// ==========================================

export const handleApiError = (error: unknown): string => {
  return getErrorMessage(error, 'An unexpected error occurred');
};

export { api };
