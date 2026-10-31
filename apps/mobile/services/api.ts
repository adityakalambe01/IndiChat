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
  MatchContactsRequest,
  MatchContactsResponse,
  MatchedContactDto
} from '@chat/shared-types';

import { storage, STORAGE_KEYS } from './storage';
import { getDeviceDetails } from '../utils/device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { File as ExpoFile, UploadType } from 'expo-file-system';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Automatically deduce optimal default server URL based on runtime environment
function getDefaultHost(): string {
  // Expo debugger host usually has host:port (e.g. 192.168.1.3:8081)
  const debuggerHost = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost && typeof debuggerHost === 'string') {
    const ip = debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8080`;
    }
  }

  // iOS Simulator directly shares macOS host network and connects to 127.0.0.1
  if (Platform.OS === 'ios' && !Constants.isDevice) {
    return 'http://127.0.0.1:8080';
  }

  // Android emulator routes to host through 10.0.2.2
  if (Platform.OS === 'android' && !Constants.isDevice) {
    return 'http://10.0.2.2:8080';
  }

  // Active host LAN IP for physical device access
  return 'http://192.168.1.3:8080';
}

let activeBaseUrl: string | null = null;
const sessionExpiredCallbacks = new Set<(message: string) => void>();

export async function getApiBaseUrl(): Promise<string> {
  if (activeBaseUrl) return activeBaseUrl;
  const custom = await storage.getItem(STORAGE_KEYS.SERVER_URL);
  if (custom && custom.trim().length > 0) {
    activeBaseUrl = custom.trim().replace(/\/+$/, '');
  } else {
    activeBaseUrl = getDefaultHost();
  }
  return activeBaseUrl;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  activeBaseUrl = clean;
  await storage.setItem(STORAGE_KEYS.SERVER_URL, clean);
}

export function onSessionExpired(callback: (reason: string) => void): () => void {
  sessionExpiredCallbacks.add(callback);
  return () => {
    sessionExpiredCallbacks.delete(callback);
  };
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getDeviceHeaders(): Promise<Record<string, string>> {
  try {
    const details = await getDeviceDetails();
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
  const baseUrl = await getApiBaseUrl();
  const authHeader = await getAuthHeader();
  const deviceHeaders = await getDeviceHeaders();

  const headers = {
    'Content-Type': 'application/json',
    ...deviceHeaders,
    ...authHeader,
    ...options.headers,
  };

  const url = `${baseUrl}/api/v1${endpoint}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiError(0, `Cannot connect to server at ${baseUrl}. Ensure backend is running and mobile is on same network.`);
  }

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
      sessionExpiredCallbacks.forEach((fn) =>
        fn(errorMsg || 'Your session has ended or this device was logged out.')
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
  // Config
  getBaseUrl: getApiBaseUrl,
  setBaseUrl: setApiBaseUrl,

  // Auth
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  register: async (data: RegisterRequest) => {
    const details = await getDeviceDetails();
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

  login: async (data: LoginRequest) => {
    const details = await getDeviceDetails();
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

  // Conversations
  getConversations: () => request<Conversation[]>('/conversations'),

  getConversation: (id: string) => request<Conversation>(`/conversations/${id}`),

  createConversation: (data: CreateConversationRequest) =>
    request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Messages
  getMessages: (conversationId: string, cursor?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (cursor) params.set('cursor', cursor);
    return request<MessageHistoryResponse>(`/conversations/${conversationId}/messages?${params.toString()}`);
  },

  sendMessage: (payload: SendMessagePayload) =>
    request<Message>('/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  markDelivered: (messageId: string) =>
    request<void>(`/messages/${messageId}/delivered`, {
      method: 'POST',
    }),

  markRead: (messageId: string) =>
    request<void>(`/messages/${messageId}/read`, {
      method: 'POST',
    }),

  // Push Device Tokens
  registerDeviceToken: (token: string, platform = Platform.OS) =>
    request<void>('/devices/token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  unregisterDeviceToken: (token: string) =>
    request<void>('/devices/token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
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

  // File Upload (supporting captured camera photos, gallery images, documents, audio across React Native & Web)
  uploadFile: async (file: { uri: string; name: string; type: string }): Promise<FileUploadResponse> => {
    const baseUrl = await getApiBaseUrl();
    const token = await storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const uploadUrl = `${baseUrl}/api/v1/files/upload`;

    // 1. Native ExpoFile upload (fastest & most reliable on Android/iOS; completely bypasses fetch FormData conversion)
    if (Platform.OS !== 'web') {
      try {
        const expoFile = new ExpoFile(file.uri);
        if (typeof expoFile.upload === 'function') {
          const uploadRes = await expoFile.upload(uploadUrl, {
            uploadType: UploadType.MULTIPART,
            fieldName: 'file',
            mimeType: file.type || 'application/octet-stream',
            headers,
          });

          if (uploadRes.status >= 200 && uploadRes.status < 300) {
            return JSON.parse(uploadRes.body) as FileUploadResponse;
          }
          let errorMsg = `Upload failed with status ${uploadRes.status}`;
          try {
            const data = JSON.parse(uploadRes.body);
            if (data.message) errorMsg = data.message;
          } catch {}
          throw new ApiError(uploadRes.status, errorMsg);
        }
      } catch (nativeErr: any) {
        if (nativeErr instanceof ApiError) throw nativeErr;
        console.warn('Native ExpoFile upload failed, attempting Blob fallback:', nativeErr);
      }
    }

    // 2. Blob-based upload (compatible with modern WinterCG Expo fetch and Web)
    try {
      const blobRes = await fetch(file.uri);
      const blob = await blobRes.blob();
      const formData = new FormData();
      formData.append('file', blob, file.name);

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }

      let errorMsg = `Upload failed: ${res.statusText}`;
      try {
        const data = await res.json();
        if (data.message) errorMsg = data.message;
      } catch {}
      throw new ApiError(res.status, errorMsg);
    } catch (blobErr: any) {
      if (blobErr instanceof ApiError) throw blobErr;
      console.warn('Blob upload failed, attempting ExpoFile in FormData:', blobErr);
    }

    // 3. Fallback: Wrap in ExpoFile and append to FormData (implements .bytes() for WinterCG)
    try {
      const expoFile = new ExpoFile(file.uri);
      const formData = new FormData();
      formData.append('file', expoFile as any);

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }

      let errorMsg = `Upload failed: ${res.statusText}`;
      try {
        const data = await res.json();
        if (data.message) errorMsg = data.message;
      } catch {}
      throw new ApiError(res.status, errorMsg);
    } catch (finalErr: any) {
      if (finalErr instanceof ApiError) throw finalErr;
      throw new ApiError(500, finalErr.message || 'File upload failed');
    }
  },

  matchContacts: async (phoneNumbers: string[], defaultRegion = 'US'): Promise<MatchContactsResponse> => {
    return request<MatchContactsResponse>('/contacts/match', {
      method: 'POST',
      body: JSON.stringify({ phoneNumbers, defaultRegion }),
    });
  },
};
