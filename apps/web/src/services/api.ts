import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  Conversation,
  CreateConversationRequest,
  MessageHistoryResponse,
  Message,
  SendMessagePayload,
  FileUploadResponse,
  CallLog,
  CreateCallLogRequest
} from '@chat/shared-types';

import { getDeviceDetails } from '../utils/device';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('chat_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getDeviceHeaders(): Record<string, string> {
  try {
    const details = getDeviceDetails();
    return {
      'X-Device-Id': details.deviceId,
      'X-Device-Name': details.deviceName,
      'X-Device-Platform': details.platform,
      'X-Device-Browser': details.browser,
    };
  } catch {
    return {};
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getDeviceHeaders(),
    ...getAuthHeader(),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `Request failed: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data.message) errorMsg = data.message;
    } catch {
      // fallback
    }

    if (
      res.status === 401 &&
      !endpoint.startsWith('/auth/login') &&
      !endpoint.startsWith('/auth/register') &&
      !endpoint.startsWith('/auth/logout')
    ) {
      window.dispatchEvent(
        new CustomEvent('chat:session_expired', {
          detail: { message: errorMsg || 'Your session has ended or this device was logged out.' }
        })
      );
    }

    throw new ApiError(res.status, errorMsg);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  // Auth
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  register: (data: RegisterRequest) => {
    const details = getDeviceDetails();
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: details.deviceId,
        deviceName: details.deviceName,
        platform: details.platform,
        browser: details.browser,
        ...data,
      }),
    });
  },

  login: (data: LoginRequest) => {
    const details = getDeviceDetails();
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: details.deviceId,
        deviceName: details.deviceName,
        platform: details.platform,
        browser: details.browser,
        ...data,
      }),
    });
  },

  // Users
  getMe: () => request<User>('/users/me'),
  searchUsers: (query: string) => request<User[]>(`/users/search?q=${encodeURIComponent(query)}`),

  // Conversations
  getConversations: () => request<Conversation[]>('/conversations'),
  createConversation: (data: CreateConversationRequest) => request<Conversation>('/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Messages
  getMessages: (conversationId: string, cursor?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.set('cursor', cursor);
    return request<MessageHistoryResponse>(`/conversations/${conversationId}/messages?${params.toString()}`);
  },

  sendMessage: (payload: SendMessagePayload) => request<Message>('/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  markDelivered: (messageId: string) => request<void>(`/messages/${messageId}/delivered`, {
    method: 'POST',
  }),

  markRead: (messageId: string) => request<void>(`/messages/${messageId}/read`, {
    method: 'POST',
  }),

  // Device Tokens (Push Notifications)
  registerDeviceToken: (token: string, platform = 'web') => request<void>('/devices/token', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  }),

  unregisterDeviceToken: (token: string) => request<void>('/devices/token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  }),

  // File Uploads
  uploadFile: async (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('chat_access_token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      let errorMsg = `Upload failed: ${res.statusText}`;
      try {
        const data = await res.json();
        if (data.message) errorMsg = data.message;
      } catch {
        // fallback
      }
      throw new ApiError(res.status, errorMsg);
    }

    return res.json();
  },

  // User Profile & Account Settings
  updateProfile: (data: { displayName?: string; username?: string; email?: string; phoneNumber?: string }) =>
    request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>('/users/me/password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePasskey: (enabled: boolean) =>
    request<{ message: string }>('/users/me/passkey', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  updateTwoFactor: (enabled: boolean, pin?: string) =>
    request<{ message: string }>('/users/me/2fa', {
      method: 'POST',
      body: JSON.stringify({ enabled, pin }),
    }),

  // Linked Devices
  getLinkedDevices: () => request<any[]>('/devices'),

  linkDevice: (data: {
    deviceName: string;
    platform?: string;
    browser?: string;
    location?: string;
    ipAddress?: string;
  }) =>
    request<any>('/devices/link', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeLinkedDevice: (deviceId: string) =>
    request<{ message: string }>(`/devices/${deviceId}`, {
      method: 'DELETE',
    }),

  removeOtherLinkedDevices: () =>
    request<{ message: string }>('/devices/others', {
      method: 'DELETE',
    }),

  // Settings & Privacy
  getUserSettings: () => request<any>('/settings'),

  updateUserSettings: (data: any) =>
    request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Chat Backup & History
  getChatBackup: () => request<any>('/conversations/backup'),

  clearAllMessages: () =>
    request<{ message: string }>('/conversations/messages/clear', {
      method: 'DELETE',
    }),

  deleteAllChats: () =>
    request<{ message: string }>('/conversations/all', {
      method: 'DELETE',
    }),

  // Message Reactions & Starred Messages
  addReaction: (messageId: string, emoji: string) =>
    request<{ messageId: string; reactions: any[]; summaries: any[] }>(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  removeReaction: (messageId: string, emoji: string) =>
    request<{ messageId: string; reactions: any[]; summaries: any[] }>(
      `/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
      { method: 'DELETE' }
    ),

  toggleStarMessage: (messageId: string) =>
    request<{ messageId: string; isStarred: boolean }>(`/messages/${messageId}/star`, {
      method: 'POST',
    }),

  getStarredMessages: () => request<Message[]>('/messages/starred'),

  // Communities & Circles
  getCommunities: () => request<any[]>('/communities'),

  createCommunity: (data: { name: string; description?: string; channelNames?: string[] }) =>
    request<any>('/communities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addSubGroup: (communityId: string, data: { name: string; isAnnouncement?: boolean }) =>
    request<any>(`/communities/${communityId}/channels`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Status Stories
  getStatuses: () => request<any[]>('/status'),

  createStatus: (data: { mediaUrl: string; mediaType?: string; caption?: string }) =>
    request<any>('/status', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Call Logs & Dialer
  getCallHistory: () => request<CallLog[]>('/calls/history'),

  logCall: (data: CreateCallLogRequest) =>
    request<CallLog>('/calls/logs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Passkeys
  getPasskeys: () => request<any[]>('/users/me/passkeys'),

  registerPasskey: (data: { credentialId: string; publicKey?: string; nickname: string }) =>
    request<any>('/users/me/passkeys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removePasskey: (credentialId: string) =>
    request<{ message: string }>(`/users/me/passkeys/${encodeURIComponent(credentialId)}`, {
      method: 'DELETE',
    }),
};

