import {
  Message,
  MessageReceipt,
  TypingEventPayload,
  PresenceEventPayload,
  CallSignalPayload,
  SendMessagePayload,
  WebSocketMessage
} from '@chat/shared-types';
import { generateUUID } from '../utils/uuid';
import { getDeviceId } from '../utils/device';
import { getApiBaseUrl, api, notifySessionExpired } from './api';
import { storage, STORAGE_KEYS } from './storage';

type MessageCreatedHandler = (message: Message) => void;
type ReceiptUpdatedHandler = (receipt: MessageReceipt) => void;
type TypingUpdatedHandler = (event: TypingEventPayload) => void;
type PresenceUpdatedHandler = (event: PresenceEventPayload) => void;
type CallSignalHandler = (signal: CallSignalPayload) => void;
type DeviceRemovedHandler = (reason: string) => void;
type ConnectionStatusHandler = (connected: boolean) => void;

export interface WebSocketClientOptions {
  storage?: typeof storage;
  api?: typeof api;
  notifySessionExpired?: typeof notifySessionExpired;
  getDeviceId?: typeof getDeviceId;
  getApiBaseUrl?: typeof getApiBaseUrl;
  WebSocketClass?: any;
}

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private reconnectTimeout: any = null;
  private isExplicitlyClosed = false;
  private isRefreshing = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  private storageService: typeof storage;
  private apiService: typeof api;
  private notifyExpiredFn: typeof notifySessionExpired;
  private getDeviceIdFn: typeof getDeviceId;
  private getApiBaseUrlFn: typeof getApiBaseUrl;
  private wsClass: any;

  private messageCreatedListeners = new Set<MessageCreatedHandler>();
  private receiptUpdatedListeners = new Set<ReceiptUpdatedHandler>();
  private typingUpdatedListeners = new Set<TypingUpdatedHandler>();
  private presenceUpdatedListeners = new Set<PresenceUpdatedHandler>();
  private callSignalListeners = new Set<CallSignalHandler>();
  private deviceRemovedListeners = new Set<DeviceRemovedHandler>();
  private connectionStatusListeners = new Set<ConnectionStatusHandler>();

  constructor(options?: WebSocketClientOptions) {
    this.storageService = options?.storage ?? storage;
    this.apiService = options?.api ?? api;
    this.notifyExpiredFn = options?.notifySessionExpired ?? notifySessionExpired;
    this.getDeviceIdFn = options?.getDeviceId ?? getDeviceId;
    this.getApiBaseUrlFn = options?.getApiBaseUrl ?? getApiBaseUrl;
    this.wsClass = options?.WebSocketClass ?? (typeof WebSocket !== 'undefined' ? WebSocket : (globalThis as any).WebSocket);
  }

  public async connect(token: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.token === token) {
      return;
    }
    this.token = token;
    this.isExplicitlyClosed = false;

    if (this.socket) {
      const oldSocket = this.socket;
      this.socket = null;
      try {
        oldSocket.onopen = null;
        oldSocket.onmessage = null;
        oldSocket.onerror = null;
        oldSocket.onclose = null;
        oldSocket.close();
      } catch {}
    }

    try {
      const baseUrl = await this.getApiBaseUrlFn();
      const wsProtocol = baseUrl.startsWith('https') ? 'wss:' : 'ws:';
      const hostPart = baseUrl.replace(/^https?:\/\//, '');
      const deviceId = await this.getDeviceIdFn();
      const wsUrl = `${wsProtocol}//${hostPart}/ws?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(deviceId)}`;

      console.log('[WebSocket] Connecting to:', wsUrl);
      const currentSocket = new this.wsClass(wsUrl);
      this.socket = currentSocket;

      currentSocket.onopen = () => {
        // Late events from an old socket cannot disrupt a newer connection
        if (this.socket !== currentSocket) return;

        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        this.notifyStatus(true);
      };

      currentSocket.onmessage = (event: any) => {
        // Late events from an old socket cannot disrupt a newer connection
        if (this.socket !== currentSocket) return;

        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (e) {
          console.error('[WebSocket] Failed to parse message', e);
        }
      };

      currentSocket.onclose = (event: any) => {
        // Late events from an old socket cannot disrupt a newer connection
        if (this.socket !== currentSocket) return;

        console.log('[WebSocket] Disconnected', event.code, event.reason);
        this.notifyStatus(false);

        if (event.code === 4001) {
          this.isExplicitlyClosed = true;
          this.token = null;
          this.reconnectAttempts = 0;
          const reason = event.reason || 'Device session has been removed or logged out.';
          this.deviceRemovedListeners.forEach((fn) => fn(reason));
          return;
        }

        if (event.code === 1008) {
          if (this.isExplicitlyClosed) return;
          console.warn('[WebSocket] Unauthorized handshake (code 1008). Attempting token refresh...');
          this.handleUnauthorizedClose();
          return;
        }

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      currentSocket.onerror = (err: any) => {
        // Late events from an old socket cannot disrupt a newer connection
        if (this.socket !== currentSocket) return;

        console.warn('[WebSocket] Error', err);
        this.notifyStatus(false);
      };
    } catch (e) {
      console.warn('[WebSocket] Connection failed to initialize', e);
      this.scheduleReconnect();
    }
  }

  private async handleUnauthorizedClose() {
    if (this.isExplicitlyClosed || this.isRefreshing) return;
    this.isRefreshing = true;

    try {
      const refreshToken = await this.storageService.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken || this.isExplicitlyClosed) {
        if (!this.isExplicitlyClosed) {
          this.disconnect();
          this.notifyExpiredFn('Session expired. Please log in again.');
        }
        return;
      }

      const newTokens = await this.apiService.refreshTokens(refreshToken);
      if (this.isExplicitlyClosed) return;

      if (newTokens?.accessToken) {
        await this.storageService.setItem(STORAGE_KEYS.ACCESS_TOKEN, newTokens.accessToken);
        if (newTokens.refreshToken) {
          await this.storageService.setItem(STORAGE_KEYS.REFRESH_TOKEN, newTokens.refreshToken);
        }
        if (this.isExplicitlyClosed) return;

        console.log('[WebSocket] Token refreshed successfully. Reconnecting...');
        this.reconnectAttempts = 0;
        this.connect(newTokens.accessToken);
        return;
      }
    } catch (err) {
      console.warn('[WebSocket] Token refresh failed:', err);
    } finally {
      this.isRefreshing = false;
    }

    if (this.isExplicitlyClosed) return;
    this.disconnect();
    this.notifyExpiredFn('Session expired. Please log in again.');
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    this.token = null;
    this.reconnectAttempts = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      const s = this.socket;
      this.socket = null;
      try {
        s.onopen = null;
        s.onmessage = null;
        s.onerror = null;
        s.onclose = null;
        s.close();
      } catch {}
    }
    this.notifyStatus(false);
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public isClosed(): boolean {
    return this.isExplicitlyClosed;
  }

  public hasScheduledReconnect(): boolean {
    return this.reconnectTimeout !== null;
  }

  public getSocket(): WebSocket | null {
    return this.socket;
  }

  public getMaxReconnectAttempts(): number {
    return this.MAX_RECONNECT_ATTEMPTS;
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout || !this.token || this.isExplicitlyClosed) return;
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[WebSocket] Max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnect.`);
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.token && !this.isExplicitlyClosed) {
        this.connect(this.token);
      }
    }, delay);
  }

  private handleServerMessage(msg: WebSocketMessage) {
    switch (msg.type) {
      case 'message.created':
        this.messageCreatedListeners.forEach((fn) => fn(msg.payload as Message));
        break;
      case 'message.receipt.updated':
        this.receiptUpdatedListeners.forEach((fn) => fn(msg.payload as MessageReceipt));
        break;
      case 'typing.updated':
        this.typingUpdatedListeners.forEach((fn) => fn(msg.payload as TypingEventPayload));
        break;
      case 'presence.updated':
        this.presenceUpdatedListeners.forEach((fn) => fn(msg.payload as PresenceEventPayload));
        break;
      case 'call.signal':
        this.callSignalListeners.forEach((fn) => fn(msg.payload as CallSignalPayload));
        break;
      case 'DEVICE_REMOVED':
        this.isExplicitlyClosed = true;
        {
          const reason = (msg.payload as any)?.reason || 'This device has been removed from linked devices.';
          this.deviceRemovedListeners.forEach((fn) => fn(reason));
        }
        break;
    }
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  private notifyStatus(connected: boolean) {
    this.connectionStatusListeners.forEach((fn) => fn(connected));
  }

  private send(action: string, payload: unknown, requestId?: string): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({
          type: action,
          requestId: requestId || generateUUID(),
          payload,
        }));
        return true;
      } catch (err) {
        console.warn('[WebSocket] Send failed', err);
        return false;
      }
    }
    return false;
  }

  public sendMessage(payload: SendMessagePayload): boolean {
    return this.send('message.send', payload);
  }

  public markDelivered(messageId: string, conversationId: string) {
    this.send('message.delivered', { messageId, conversationId });
  }

  public markRead(messageId: string, conversationId: string) {
    this.send('message.read', { messageId, conversationId });
  }

  public sendTyping(conversationId: string, isTyping: boolean) {
    this.send(isTyping ? 'typing.start' : 'typing.stop', { conversationId });
  }

  public sendCallSignal(signal: CallSignalPayload) {
    this.send('call.signal', signal);
  }

  // Listener subscriptions
  public onConnectionStatus(fn: ConnectionStatusHandler) {
    this.connectionStatusListeners.add(fn);
    fn(this.isConnected());
    return () => { this.connectionStatusListeners.delete(fn); };
  }

  public onMessageCreated(fn: MessageCreatedHandler) {
    this.messageCreatedListeners.add(fn);
    return () => { this.messageCreatedListeners.delete(fn); };
  }

  public onReceiptUpdated(fn: ReceiptUpdatedHandler) {
    this.receiptUpdatedListeners.add(fn);
    return () => { this.receiptUpdatedListeners.delete(fn); };
  }

  public onTypingUpdated(fn: TypingUpdatedHandler) {
    this.typingUpdatedListeners.add(fn);
    return () => { this.typingUpdatedListeners.delete(fn); };
  }

  public onPresenceUpdated(fn: PresenceUpdatedHandler) {
    this.presenceUpdatedListeners.add(fn);
    return () => { this.presenceUpdatedListeners.delete(fn); };
  }

  public onCallSignal(fn: CallSignalHandler) {
    this.callSignalListeners.add(fn);
    return () => { this.callSignalListeners.delete(fn); };
  }

  public onDeviceRemoved(fn: DeviceRemovedHandler) {
    this.deviceRemovedListeners.add(fn);
    return () => { this.deviceRemovedListeners.delete(fn); };
  }
}

export const wsClient = new WebSocketClient();
