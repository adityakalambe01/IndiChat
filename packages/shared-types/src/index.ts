export type UUID = string;

export interface User {
  id: UUID;
  phoneNumber?: string;
  email?: string;
  username: string;
  displayName: string;
  avatarKey?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  isOnline?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthResponse {
  tokens?: AuthTokens;
  user?: User;
  requiresTwoFactor?: boolean;
  message?: string;
}

export interface RegisterRequest {
  phoneNumber?: string;
  email?: string;
  username: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
  twoFactorPin?: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  browser?: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export type ConversationType = 'DIRECT' | 'GROUP';
export type MemberRole = 'ADMIN' | 'MEMBER';

export interface ConversationMember {
  userId: UUID;
  role: MemberRole;
  joinedAt: string;
  lastReadMessageId?: UUID;
  user?: User;
}

export interface MessageReceipt {
  messageId: UUID;
  userId: UUID;
  deliveredAt?: string;
  readAt?: string;
}

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'CALL';

export interface Message {
  id: UUID;
  conversationId: UUID;
  senderId: UUID;
  clientMessageId: UUID;
  type: MessageType;
  content: string;
  replyToId?: UUID;
  replyTo?: {
    id: UUID;
    senderDisplayName: string;
    content: string;
    type: MessageType;
  };
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  sender?: User;
  receipts?: MessageReceipt[];
  // Transient frontend statuses
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface FileAttachmentInfo {
  fileId?: string;
  fileName: string;
  fileType: MessageType;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  caption?: string;
}

export interface FileUploadResponse {
  fileId: string;
  fileName: string;
  fileType: MessageType;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
}

export interface Conversation {
  id: UUID;
  type: ConversationType;
  title?: string;
  createdBy?: UUID;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface CreateConversationRequest {
  type: ConversationType;
  title?: string;
  participantIds: UUID[];
}

export interface MessageHistoryResponse {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string;
}

// WebSocket Protocols
export type WebSocketClientAction =
  | 'message.send'
  | 'message.delivered'
  | 'message.read'
  | 'typing.start'
  | 'typing.stop'
  | 'presence.subscribe'
  | 'call.signal';

export type WebSocketServerAction =
  | 'message.created'
  | 'message.receipt.updated'
  | 'typing.updated'
  | 'presence.updated'
  | 'call.signal'
  | 'DEVICE_REMOVED'
  | 'error';

export interface SendMessagePayload {
  conversationId: UUID;
  clientMessageId: UUID;
  messageType: MessageType;
  content: string;
  replyToId?: UUID | null;
}

export interface WebSocketMessage<T = unknown> {
  type: WebSocketClientAction | WebSocketServerAction;
  requestId?: string;
  payload: T;
}

export interface TypingEventPayload {
  conversationId: UUID;
  userId: UUID;
  isTyping: boolean;
}

export interface PresenceEventPayload {
  userId: UUID;
  isOnline: boolean;
  lastSeenAt?: string;
}

export interface CallSignalPayload {
  targetUserId: UUID;
  senderUserId?: UUID;
  signalType: 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  data: unknown;
}

export interface MatchContactsRequest {
  phoneNumbers: string[];
}

export interface MatchedContactDto {
  userId: UUID;
  username: string;
  displayName: string;
  avatarKey?: string;
  phoneNumber: string;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface MatchContactsResponse {
  matches: MatchedContactDto[];
  matchedCount: number;
}

