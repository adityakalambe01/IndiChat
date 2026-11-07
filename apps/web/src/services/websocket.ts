import {
  Message,
  MessageReceipt,
  TypingEventPayload,
  PresenceEventPayload,
  CallSignalPayload,
  SendMessagePayload,
  WebSocketMessage,
  ReactionEventPayload
} from '@chat/shared-types';
import { generateUUID } from '../utils/uuid';
import { getDeviceId } from '../utils/device';

type MessageCreatedHandler = (message: Message) => void;
type ReceiptUpdatedHandler = (receipt: MessageReceipt) => void;
type TypingUpdatedHandler = (event: TypingEventPayload) => void;
type PresenceUpdatedHandler = (event: PresenceEventPayload) => void;
type CallSignalHandler = (signal: CallSignalPayload) => void;
type DeviceRemovedHandler = (reason: string) => void;
type ReactionUpdatedHandler = (event: ReactionEventPayload) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private reconnectTimeout: number | null = null;
  private isExplicitlyClosed = false;

  private messageCreatedListeners = new Set<MessageCreatedHandler>();
  private receiptUpdatedListeners = new Set<ReceiptUpdatedHandler>();
  private typingUpdatedListeners = new Set<TypingUpdatedHandler>();
  private presenceUpdatedListeners = new Set<PresenceUpdatedHandler>();
  private callSignalListeners = new Set<CallSignalHandler>();
  private deviceRemovedListeners = new Set<DeviceRemovedHandler>();
  private reactionUpdatedListeners = new Set<ReactionUpdatedHandler>();

  public connect(token: string) {
    this.token = token;
    this.isExplicitlyClosed = false;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const deviceId = getDeviceId();
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(deviceId)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[WebSocket] Connected');
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (e) {
          console.error('[WebSocket] Failed to parse message', e);
        }
      };

      this.socket.onclose = (event) => {
        console.log('[WebSocket] Disconnected', event.code, event.reason);
        if (event.code === 4001) {
          this.isExplicitlyClosed = true;
          const reason = event.reason || 'Device session has been removed or logged out.';
          this.deviceRemovedListeners.forEach((fn) => fn(reason));
          return;
        }
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        console.error('[WebSocket] Error', err);
      };
    } catch (e) {
      console.error('[WebSocket] Connection failed', e);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout || !this.token) return;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.token && !this.isExplicitlyClosed) {
        this.connect(this.token);
      }
    }, 2000);
  }

  private handleServerMessage(msg: WebSocketMessage) {
    switch (msg.type) {
      case 'message.created':
        this.messageCreatedListeners.forEach((fn) => fn(msg.payload as Message));
        break;
      case 'message.receipt.updated':
        this.receiptUpdatedListeners.forEach((fn) => fn(msg.payload as MessageReceipt));
        break;
      case 'message.reaction.updated':
        this.reactionUpdatedListeners.forEach((fn) => fn(msg.payload as ReactionEventPayload));
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
        console.error('[WebSocket] Send failed', err);
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

  public onReactionUpdated(fn: ReactionUpdatedHandler) {
    this.reactionUpdatedListeners.add(fn);
    return () => { this.reactionUpdatedListeners.delete(fn); };
  }
}

export const wsClient = new WebSocketClient();
