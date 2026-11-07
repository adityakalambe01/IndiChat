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
export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'CALL' | 'PAYMENT';
export interface MessageReaction {
    id?: UUID;
    messageId: UUID;
    userId: UUID;
    emoji: string;
    createdAt?: string;
    user?: User;
}
export interface ReactionSummary {
    emoji: string;
    count: number;
    userIds: UUID[];
}
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
    reactions?: MessageReaction[];
    reactionSummaries?: ReactionSummary[];
    isStarred?: boolean;
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
export type WebSocketClientAction = 'message.send' | 'message.delivered' | 'message.read'
/**
 * @deprecated Reactions are mutated via REST (POST /api/v1/messages/{id}/reactions, DELETE /api/v1/messages/{id}/reactions).
 * WebSocket is used for real-time distribution ('message.reaction.updated').
 * Inbound WS action is retained with conversation membership authorization for backward compatibility.
 */
 | 'message.reaction' | 'typing.start' | 'typing.stop' | 'presence.subscribe' | 'call.signal';
export type WebSocketServerAction = 'message.created' | 'message.receipt.updated' | 'message.reaction.updated' | 'typing.updated' | 'presence.updated' | 'call.signal' | 'DEVICE_REMOVED' | 'error';
export interface SendMessagePayload {
    conversationId: UUID;
    clientMessageId: UUID;
    messageType: MessageType;
    content: string;
    replyToId?: UUID | null;
}
export interface ReactionEventPayload {
    messageId: UUID;
    conversationId: UUID;
    userId: UUID;
    emoji: string;
    action: 'add' | 'remove';
    reactions?: MessageReaction[];
    summaries?: ReactionSummary[];
}
export interface StarMessageRequest {
    messageId: UUID;
    conversationId: UUID;
    isStarred: boolean;
}
export interface CommunityChannel {
    id: UUID;
    communityId: UUID;
    conversationId: UUID;
    name: string;
    isAnnouncement: boolean;
    createdAt: string;
}
export interface Community {
    id: UUID;
    name: string;
    description?: string;
    avatarKey?: string;
    createdBy: UUID;
    createdAt: string;
    updatedAt: string;
    channels: CommunityChannel[];
    memberCount?: number;
}
export interface CreateCommunityRequest {
    name: string;
    description?: string;
    channelNames?: string[];
}
export interface AddSubGroupRequest {
    communityId: UUID;
    name: string;
    isAnnouncement?: boolean;
}
export interface StatusStory {
    id: UUID;
    userId: UUID;
    mediaUrl: string;
    mediaType: 'text' | 'image' | 'video';
    caption?: string;
    createdAt: string;
    expiresAt: string;
    user?: User;
}
export interface CreateStatusStoryRequest {
    mediaUrl: string;
    mediaType: 'text' | 'image' | 'video';
    caption?: string;
}
export type CallDirection = 'outgoing' | 'incoming' | 'missed';
export type CallType = 'voice' | 'video';
export type CallStatus = 'completed' | 'connected' | 'missed' | 'rejected' | 'busy' | 'no_answer';
/**
 * CallLog represents a personal, client-reported call journal entry.
 * Note: These records reflect client-reported session outcomes upon call termination,
 * not server-verified WebRTC signaling transcripts or cryptographic proof.
 */
export interface CallLog {
    id: UUID;
    userId: UUID;
    callerId: UUID;
    receiverId: UUID;
    peerId?: UUID;
    direction: CallDirection;
    callType: CallType;
    status: CallStatus;
    durationSeconds: number;
    conversationId?: UUID;
    createdAt: string;
    user?: User;
    caller?: User;
    receiver?: User;
    peer?: User;
}
export interface CreateCallLogRequest {
    peerUserId?: UUID;
    callerId?: UUID;
    receiverId?: UUID;
    direction?: CallDirection | string;
    callType?: CallType | string;
    type?: CallType | string;
    status?: CallStatus | string;
    durationSeconds: number;
    conversationId?: UUID;
}
export interface PasskeyCredentialDto {
    id: string;
    nickname: string;
    createdAt: string;
    lastUsedAt?: string;
}
export interface PaymentMessagePayload {
    transactionId: string;
    amount: number;
    currency: string;
    note?: string;
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
    timestamp: string;
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
