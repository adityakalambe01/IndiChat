import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Conversation, Message, MessageType } from '@chat/shared-types';
import { wsClient } from '../../services/websocket';
import { soundEffects } from '../../services/audio';
import { AttachmentMenu } from './AttachmentMenu';
import { CameraModal } from './CameraModal';
import { AttachmentPreviewModal, formatFileSize, getFileExtension, getFileIconAndBadgeColor } from './AttachmentPreviewModal';
import { MediaLightboxModal } from './MediaLightboxModal';
import { EmojiPicker, MediaPickerMode } from './EmojiPicker';
import { getGiphyFallbacks } from './gifData';
import { settingsService } from '../../services/settings';
import { APP_NAME } from '../../config/appConfig';

import { api } from '../../services/api';
import { ContactDetailsPanel } from './ContactDetailsPanel';

import {
  Send,
  Paperclip,
  Smile,
  Sticker as StickerIcon,
  Phone,
  Video,
  ChevronLeft,
  Check,
  CheckCheck,
  Users,
  Clock,
  AlertCircle,
  Download,
  Upload,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  IndianRupee,
  CornerUpLeft,
  Star,
  Copy,
  Trash2,
  Play,
  Pause,
  Info,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { ChatEmptyState } from './ChatEmptyState';

interface ChatWindowProps {
  currentUser: User;
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string, type?: MessageType) => void;
  onBackToSidebar: () => void;
  typingUsers: Record<string, boolean>; // userId -> isTyping
  onStartCall: (targetUserId: string, isVideo: boolean) => void;
  onGoToCalls?: () => void;
  onSendDocument?: () => void;
  onAddContact?: () => void;
  onInviteFriend?: () => void;
  onNewCall?: () => void;
  onAskMetaAi?: () => void;
  onToggleDetails?: () => void;
}

interface ParsedAttachment {
  fileId?: string;
  fileName: string;
  fileType?: MessageType;
  mimeType?: string;
  fileSize?: number;
  fileUrl: string;
  caption?: string;
  isGif?: boolean;
  isSticker?: boolean;
}

function parseAttachment(content: string | any): ParsedAttachment | null {
  if (!content) return null;
  if (typeof content === 'object') {
    if (content.fileUrl || content.fileName) {
      return content as ParsedAttachment;
    }
  }
  if (typeof content === 'string') {
    try {
      const data = JSON.parse(content);
      if (data && typeof data === 'object' && (data.fileUrl || data.fileName)) {
        return data as ParsedAttachment;
      }
    } catch {
      // not JSON
    }
    if (content.startsWith('http') || content.startsWith('/api/') || content.startsWith('data:')) {
      return {
        fileUrl: content,
        fileName: 'attachment',
      };
    }
  }
  return null;
}

interface CallPayload {
  callType: 'voice' | 'video';
  status: 'connected' | 'missed' | 'no_answer' | 'declined';
  duration?: number;
  durationText?: string;
  endedAt?: string;
}

function parseCallContent(content: string | any): CallPayload | null {
  if (!content) return null;
  if (typeof content === 'object' && ('callType' in content || 'durationText' in content)) {
    return content as CallPayload;
  }
  if (typeof content === 'string') {
    try {
      const data = JSON.parse(content);
      if (data && typeof data === 'object' && ('callType' in data || 'durationText' in data)) {
        return data as CallPayload;
      }
    } catch {}
  }
  return null;
}

function getDateSeparatorLabel(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const timeMs = d.getTime();

  if (timeMs >= startOfToday) {
    return 'Today';
  }
  if (timeMs >= startOfYesterday && timeMs < startOfToday) {
    return 'Yesterday';
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const weekday = weekdays[d.getDay()];
  const day = d.getDate();
  const month = months[d.getMonth()];

  if (d.getFullYear() === now.getFullYear()) {
    return `${weekday}, ${day} ${month}`;
  }
  return `${weekday}, ${day} ${month} ${d.getFullYear()}`;
}


/**
 * Resilient image and GIF component that automatically handles
 * multi-CDN fallbacks, referrer policy, and prevents broken images across devices.
 */
const MessageMediaImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = '' }) => {
  const fallbacks = useMemo(() => getGiphyFallbacks(src), [src]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const handleError = () => {
    if (currentIdx + 1 < fallbacks.length) {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const currentSrc = fallbacks[currentIdx] || src;

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onError={handleError}
    />
  );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({
  currentUser,
  conversation,
  messages,
  onSendMessage,
  onBackToSidebar,
  typingUsers,
  onStartCall,
  onGoToCalls,
  onSendDocument,
  onAddContact,
  onInviteFriend,
  onNewCall,
  onAskMetaAi,
  onToggleDetails,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [mediaPickerMode, setMediaPickerMode] = useState<MediaPickerMode>('emojis');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [lightboxMedia, setLightboxMedia] = useState<{
    isOpen: boolean;
    url: string;
    type: 'IMAGE' | 'VIDEO';
    fileName: string;
    caption?: string;
    senderName?: string;
    timestamp?: string;
  } | null>(null);

  // New parity states: Details panel, in-chat search, quoted reply, reactions, payments
  const [showDetails, setShowDetails] = useState(false);
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [inChatMatchIndex, setInChatMatchIndex] = useState(0);
  const [quotedReplyMessage, setQuotedReplyMessage] = useState<Message | null>(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('500');
  const [paymentNote, setPaymentNote] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [localReactions, setLocalReactions] = useState<Record<string, { reactions: any[]; summaries: any[] }>>({});
  const [localStarred, setLocalStarred] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const dragCounterRef = useRef<number>(0);

  // In-chat search matching
  const matchingMessageIds = useMemo(() => {
    if (!inChatSearchQuery.trim()) return [];
    const q = inChatSearchQuery.toLowerCase();
    return messages
      .filter((m) => m.content && m.content.toLowerCase().includes(q))
      .map((m) => m.id);
  }, [messages, inChatSearchQuery]);

  useEffect(() => {
    setInChatMatchIndex(0);
    if (matchingMessageIds.length > 0) {
      const el = document.getElementById(`msg-${matchingMessageIds[0]}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [inChatSearchQuery, matchingMessageIds]);

  const handleNextMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const nextIdx = (inChatMatchIndex + 1) % matchingMessageIds.length;
    setInChatMatchIndex(nextIdx);
    const el = document.getElementById(`msg-${matchingMessageIds[nextIdx]}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handlePrevMatch = () => {
    if (matchingMessageIds.length === 0) return;
    const prevIdx = (inChatMatchIndex - 1 + matchingMessageIds.length) % matchingMessageIds.length;
    setInChatMatchIndex(prevIdx);
    const el = document.getElementById(`msg-${matchingMessageIds[prevIdx]}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark incoming messages as read when opening conversation (respecting read receipts privacy setting)
  useEffect(() => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (conversation && settingsService.getSettings().readReceipts) {
      messages.forEach((msg) => {
        if (msg.senderId !== currentUser.id && UUID_REGEX.test(msg.id)) {
          const isRead = msg.receipts?.some((r) => r.userId === currentUser.id && r.readAt != null);
          if (!isRead) {
            wsClient.markRead(msg.id, conversation.id);
          }
        }
      });
    }
  }, [conversation?.id, messages.length, currentUser.id]);

  // Clipboard paste support (e.g. pasting screenshots or copied files directly)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!conversation) return;
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        setSelectedFiles(Array.from(e.clipboardData.files));
        setShowPreviewModal(true);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [conversation]);

  if (!conversation) {
    return (
      <main className="chat-area">
        <ChatEmptyState
          onGoToCalls={onGoToCalls || (() => {})}
          onSendDocument={onSendDocument || (() => {})}
          onAddContact={onAddContact || (() => {})}
          onInviteFriend={
            onInviteFriend ||
            (() => {
              navigator.clipboard?.writeText(window.location.origin);
              alert('Invite link copied to clipboard!');
            })
          }
          onNewCall={onNewCall || onGoToCalls || (() => {})}
          onAskMetaAi={onAskMetaAi || (() => {})}
        />
      </main>
    );
  }

  const otherMember = conversation.type === 'DIRECT'
    ? conversation.members.find((m) => m.userId !== currentUser.id)
    : null;

  const chatTitle = conversation.type === 'GROUP'
    ? (conversation.title || 'Group')
    : (otherMember?.user?.displayName || otherMember?.user?.username || 'Chat');

  const isOtherOnline = otherMember?.user?.isOnline;
  const isTyping = otherMember ? typingUsers[otherMember.userId] : false;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    // Typing debounce
    wsClient.sendTyping(conversation.id, true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      wsClient.sendTyping(conversation.id, false);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const enterIsSend = settingsService.getSettings().enterIsSend;
    if (enterIsSend) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    } else {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), 'TEXT');
    soundEffects.playOutgoingSent();
    setInputText('');
    setQuotedReplyMessage(null);
    wsClient.sendTyping(conversation.id, false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleReactionPick = (msgId: string, emoji: string) => {
    setActiveReactionMessageId(null);
    api.addReaction(msgId, emoji)
      .then((res) => {
        setLocalReactions((prev) => ({
          ...prev,
          [msgId]: { reactions: res.reactions, summaries: res.summaries },
        }));
      })
      .catch(console.warn);
  };

  const handleToggleStar = (msgId: string) => {
    api.toggleStarMessage(msgId)
      .then((res) => {
        setLocalStarred((prev) => ({
          ...prev,
          [msgId]: res.isStarred,
        }));
      })
      .catch(console.warn);
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard?.writeText(text);
    alert('Message copied to clipboard');
  };

  const handleConfirmFastPayment = () => {
    const amt = parseFloat(paymentAmount) || 500;
    const payload = JSON.stringify({
      transactionId: `UPI${Date.now()}`,
      amount: amt,
      currency: 'INR',
      note: paymentNote || 'Fast Payment',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    });
    onSendMessage(payload, 'PAYMENT');
    soundEffects.playOutgoingSent();
    setShowPaymentModal(false);
    setPaymentNote('');
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSelectGif = (gifUrl: string, title?: string) => {
    const payload = JSON.stringify({
      fileUrl: gifUrl,
      fileName: title ? `${title}.gif` : 'animation.gif',
      isGif: true,
      caption: '',
    });
    onSendMessage(payload, 'IMAGE');
    soundEffects.playOutgoingSent();
    setShowEmoji(false);
  };

  const handleSelectSticker = (stickerUrl: string, name?: string) => {
    const payload = JSON.stringify({
      fileUrl: stickerUrl,
      fileName: name || 'sticker.png',
      isSticker: true,
    });
    onSendMessage(payload, 'STICKER');
    soundEffects.playOutgoingSent();
    setShowEmoji(false);
  };

  const handleSelectFiles = (files: File[]) => {
    setSelectedFiles(files);
    setShowPreviewModal(true);
  };

  const handleCapturePhoto = (file: File) => {
    setSelectedFiles([file]);
    setShowPreviewModal(true);
  };

  const handleSendAttachment = async (payload: { content: string; messageType: MessageType }) => {
    onSendMessage(payload.content, payload.messageType);
    soundEffects.playOutgoingSent();
    setShowPreviewModal(false);
    setSelectedFiles([]);
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
      setShowPreviewModal(true);
    }
  };

  function formatMessageTime(isoStr: string): string {
    const date = new Date(isoStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderReceiptStatus(msg: Message) {
    if (msg.senderId !== currentUser.id) return null;

    if (msg.status === 'sending') {
      return (
        <span title="Sending...">
          <Clock size={12} className="receipt-icon sending" style={{ opacity: 0.6 }} />
        </span>
      );
    }

    if (msg.status === 'failed') {
      return (
        <span title="Failed to send">
          <AlertCircle size={14} className="receipt-icon error" style={{ color: '#ef4444' }} />
        </span>
      );
    }

    const userReadReceiptsEnabled = settingsService.getSettings().readReceipts;
    const isRead = (userReadReceiptsEnabled && msg.receipts?.some((r) => r.readAt != null)) || msg.status === 'read';
    const isDelivered = msg.receipts?.some((r) => r.deliveredAt != null) || msg.status === 'delivered';

    if (isRead) {
      return (
        <span className="read-tick cyan" title="Read">✓✓</span>
      );
    }
    if (isDelivered) {
      return (
        <span className="read-tick" title="Delivered">✓✓</span>
      );
    }
    return (
      <span className="read-tick" title="Sent">✓</span>
    );
  }

  const renderMessageContent = (msg: Message) => {
    if (msg.type === 'STICKER') {
      const att = parseAttachment(msg.content);
      const stickerUrl = att?.fileUrl || msg.content;
      const fileName = att?.fileName || 'Sticker';

      return (
        <div className="message-sticker-bubble">
          <img
            src={stickerUrl}
            alt={fileName}
            className="message-sticker-content"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    if (msg.type === 'IMAGE') {
      const att = parseAttachment(msg.content);
      const imgUrl = att?.fileUrl || msg.content;
      const caption = att?.caption;
      const fileName = att?.fileName || 'image.jpg';
      const senderName = msg.sender?.displayName || msg.sender?.username || 'Photo';
      const isGif = Boolean(
        att?.isGif ||
        fileName.toLowerCase().endsWith('.gif') ||
        imgUrl.toLowerCase().includes('.gif') ||
        imgUrl.includes('giphy') ||
        imgUrl.includes('tenor')
      );

      return (
        <div className={`message-image-bubble ${isGif ? 'is-gif-bubble' : ''}`}>
          <div
            className="message-image-container"
            onClick={() =>
              setLightboxMedia({
                isOpen: true,
                url: imgUrl,
                type: 'IMAGE',
                fileName,
                caption,
                senderName,
                timestamp: formatMessageTime(msg.createdAt),
              })
            }
          >
            <MessageMediaImage
              src={imgUrl}
              alt={fileName}
              className="message-image-content"
            />
            <div className="message-image-overlay">
              <span className="view-fullscreen-hint">{isGif ? 'Click to view GIF' : 'Click to enlarge'}</span>
            </div>
          </div>
          {caption && <div className="message-attachment-caption">{caption}</div>}
        </div>
      );
    }

    if (msg.type === 'VIDEO') {
      const att = parseAttachment(msg.content);
      const videoUrl = att?.fileUrl || msg.content;
      const caption = att?.caption;
      const fileName = att?.fileName || 'video.mp4';
      const senderName = msg.sender?.displayName || msg.sender?.username || 'Video';

      return (
        <div className="message-video-bubble">
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="message-video-content"
            onClick={(e) => {
              // Double click or button for lightbox
              if (e.detail === 2) {
                setLightboxMedia({
                  isOpen: true,
                  url: videoUrl,
                  type: 'VIDEO',
                  fileName,
                  caption,
                  senderName,
                  timestamp: formatMessageTime(msg.createdAt),
                });
              }
            }}
          />
          {caption && <div className="message-attachment-caption">{caption}</div>}
        </div>
      );
    }

    if (msg.type === 'AUDIO') {
      const att = parseAttachment(msg.content);
      const audioUrl = att?.fileUrl || msg.content;

      return (
        <div className="message-audio-bubble">
          <audio src={audioUrl} controls className="message-audio-content" />
        </div>
      );
    }

    if (msg.type === 'DOCUMENT') {
      const att = parseAttachment(msg.content);
      const fileUrl = att?.fileUrl || msg.content;
      const fileName = att?.fileName || 'Document';
      const fileSize = att?.fileSize ? formatFileSize(att.fileSize) : '';
      const caption = att?.caption;
      const ext = getFileExtension(fileName);
      const { icon: DocIcon, color: badgeColor } = getFileIconAndBadgeColor(ext);

      const downloadUrl = fileUrl.includes('?') ? `${fileUrl}&download=true` : `${fileUrl}?download=true`;

      return (
        <div className="message-document-bubble">
          <a
            href={downloadUrl}
            download={fileName}
            className="document-card-link"
            title={`Download ${fileName}`}
          >
            <div className="doc-icon-badge" style={{ borderColor: badgeColor }}>
              <DocIcon size={26} color={badgeColor} />
              <span className="doc-ext-tag" style={{ backgroundColor: badgeColor }}>
                {ext}
              </span>
            </div>
            <div className="doc-details">
              <span className="doc-name">{fileName}</span>
              <div className="doc-meta">
                {fileSize && <span>{fileSize} • </span>}
                <span>{ext} File</span>
              </div>
            </div>
            <div className="doc-download-btn" title="Download file">
              <Download size={18} />
            </div>
          </a>
          {caption && <div className="message-attachment-caption">{caption}</div>}
        </div>
      );
    }

    // CALL message
    const callData = parseCallContent(msg.content);
    if (msg.type === 'CALL' || callData) {
      const isVideo = callData?.callType === 'video';
      const callTitle = isVideo ? 'Video call' : 'Voice call';
      let callSubtitle = callData?.durationText || 'Voice call';
      if (!callData?.durationText) {
        if (callData?.status === 'no_answer') callSubtitle = 'No answer';
        else if (callData?.status === 'missed') callSubtitle = 'Missed';
        else if (callData?.status === 'declined') callSubtitle = 'Declined';
        else if (callData?.duration && callData.duration > 0) {
          callSubtitle = callData.duration < 60 ? `${callData.duration} sec` : `${Math.floor(callData.duration / 60)} min`;
        }
      }
      const isOutgoing = msg.senderId === currentUser.id;
      const isMissedOrDeclined = callData?.status === 'missed' || callData?.status === 'declined';

      return (
        <div className="web-call-bubble-content">
          <div className={`web-call-icon-circle ${isOutgoing ? 'outgoing' : 'incoming'}`}>
            {isVideo ? <Video size={18} /> : <Phone size={18} />}
            <div className={`web-call-arrow-badge ${isOutgoing ? 'outgoing' : 'incoming'}`}>
              {isOutgoing ? (
                <ArrowUpRight size={10} color="#00a884" />
              ) : (
                <ArrowDownLeft size={10} color={isMissedOrDeclined ? '#f15c6d' : '#8696a0'} />
              )}
            </div>
          </div>
          <div className="web-call-details">
            <span className="web-call-title">{callTitle}</span>
            <span className="web-call-subtitle" style={!isOutgoing && isMissedOrDeclined ? { color: '#f15c6d' } : undefined}>
              {callSubtitle}
            </span>
          </div>
          <span className="web-call-time">{formatMessageTime(msg.createdAt)}</span>
        </div>
      );
    }

    if (msg.type === 'PAYMENT' || (typeof msg.content === 'string' && msg.content.includes('"type":"PAYMENT"'))) {
      let paymentData: any = null;
      try {
        paymentData = JSON.parse(msg.content);
      } catch (_) {}
      return (
        <div className="web-payment-bubble" style={{ padding: '8px 12px', background: 'rgba(0, 168, 132, 0.1)', border: '1px solid rgba(0, 168, 132, 0.25)', borderRadius: '8px', minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--brand-teal)' }}>UPI Payment</span>
            <span style={{ fontSize: '9px', padding: '1px 5px', background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', borderRadius: '3px', fontWeight: 600 }}>Simulation (Demo)</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
            ₹{paymentData?.amount || 500}
          </div>
          {paymentData?.note && (
            <div style={{ fontSize: '12px', color: 'var(--text-sec)', marginTop: '2px' }}>
              {paymentData.note}
            </div>
          )}
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Demo card · No actual money transferred
          </div>
        </div>
      );
    }

    // Default TEXT message
    return <span className="message-text">{msg.content}</span>;
  };

  return (
    <section
      className="app-chat-window"
      id="appChatWindow"
      aria-label="Active conversation view"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="chat-drag-drop-overlay">
          <div className="drag-drop-card">
            <Upload size={48} color="#00a884" />
            <h3>Drop files here</h3>
            <p>Send photos, videos, documents, or any file format</p>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <header className="chat-header">
        <div
          className="chat-header-contact"
          id="chatHeaderContact"
          role="button"
          tabIndex={0}
          aria-label="View contact info"
          onClick={() => {
            setShowDetails((prev) => !prev);
            onToggleDetails?.();
          }}
          style={{ cursor: 'pointer' }}
        >
          <div
            className="chat-header-avatar"
            id="chatHeaderAvatar"
            style={{ background: conversation.type === 'GROUP' ? 'var(--brand-teal)' : '#005c4b' }}
          >
            {conversation.type === 'GROUP' ? <Users size={20} /> : chatTitle.slice(0, 2).toUpperCase()}
          </div>
          <div className="chat-header-info">
            <div className="chat-header-name" id="chatHeaderName">{chatTitle}</div>
            <div className={`chat-header-status ${isOtherOnline ? '' : 'offline'}`} id="chatHeaderStatus">
              {isTyping ? 'typing...' : (isOtherOnline ? 'Online' : 'Offline')}
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          {otherMember && (
            <>
              <button
                className="icon-btn"
                id="btnAudioCall"
                onClick={() => onStartCall(otherMember.userId, false)}
                title="Audio Call"
                aria-label="Audio call"
              >
                <Phone size={18} />
              </button>
              <button
                className="icon-btn"
                id="btnVideoCall"
                onClick={() => onStartCall(otherMember.userId, true)}
                title="Video Call"
                aria-label="Video call"
              >
                <Video size={18} />
              </button>
            </>
          )}
          <button
            className="icon-btn"
            id="btnToggleInChatSearch"
            onClick={() => setShowInChatSearch((prev) => !prev)}
            title="Search in chat"
            aria-label="Search inside chat"
          >
            <Search size={18} />
          </button>
          <button
            className="icon-btn"
            id="btnToggleDetails"
            onClick={() => {
              setShowDetails((prev) => !prev);
              onToggleDetails?.();
            }}
            title="Contact Details"
            aria-label="Toggle contact details"
          >
            <Info size={18} />
          </button>
        </div>
      </header>

      {/* In-Chat Search Bar (Collapsible) */}
      <div className="inchat-search-bar in-chat-search-bar" id="inChatSearchBar" style={{ display: showInChatSearch ? 'flex' : 'none' }}>
        <Search size={16} color="var(--text-sec)" />
        <input
          id="inChatSearchInput"
          className="inchat-search-input"
          type="text"
          placeholder="Search in this chat..."
          aria-label="Search messages in active chat"
          value={inChatSearchQuery}
          onChange={(e) => setInChatSearchQuery(e.target.value)}
        />
        <span className="inchat-matches-count in-chat-matches-count" id="inChatMatchesCount">
          {matchingMessageIds.length === 0
            ? (inChatSearchQuery ? 'No matches' : '')
            : `${inChatMatchIndex + 1} of ${matchingMessageIds.length}`}
        </span>
        <button
          type="button"
          className="icon-btn"
          id="btnInChatPrev"
          onClick={handlePrevMatch}
          disabled={matchingMessageIds.length === 0}
          title="Previous match"
        >
          ▲
        </button>
        <button
          type="button"
          className="icon-btn"
          id="btnInChatNext"
          onClick={handleNextMatch}
          disabled={matchingMessageIds.length === 0}
          title="Next match"
        >
          ▼
        </button>
        <button
          type="button"
          className="icon-btn"
          id="btnCloseInChatSearch"
          onClick={() => {
            setShowInChatSearch(false);
            setInChatSearchQuery('');
          }}
          title="Close search"
        >
          ✕
        </button>
      </div>

      {/* Messages Stream */}
      <div className="messages-stream" id="messagesStream" role="log" aria-live="polite" aria-label="Message stream">
        <div className="encryption-notice">
          🔒 Messages and calls are end-to-end encrypted. No one outside of this chat, not even IndiChat, can read or listen to them.
        </div>

        {messages.map((msg, index) => {
          const isOutgoing = msg.senderId === currentUser.id;
          const isMedia = msg.type === 'IMAGE' || msg.type === 'VIDEO';
          const isSticker = msg.type === 'STICKER';
          const callData = parseCallContent(msg.content);
          const att = parseAttachment(msg.content);
          const isGif = Boolean(
            att?.isGif ||
            att?.fileName?.toLowerCase().endsWith('.gif') ||
            att?.fileUrl?.toLowerCase().includes('.gif') ||
            (typeof msg.content === 'string' && (msg.content.includes('.gif') || msg.content.includes('giphy') || msg.content.includes('tenor')))
          );
          const isCall = msg.type === 'CALL' || Boolean(callData);

          const prevMsg = index > 0 ? messages[index - 1] : null;
          const currentDateLabel = msg.createdAt ? getDateSeparatorLabel(msg.createdAt) : null;
          const prevDateLabel = prevMsg?.createdAt ? getDateSeparatorLabel(prevMsg.createdAt) : null;
          const showDateSeparator = Boolean(
            currentDateLabel && (!prevDateLabel || currentDateLabel !== prevDateLabel)
          );

          const isHighlighted = inChatSearchQuery && msg.content && typeof msg.content === 'string' && msg.content.toLowerCase().includes(inChatSearchQuery.toLowerCase());

          return (
            <React.Fragment key={msg.id || msg.clientMessageId || `msg-${index}`}>
              {showDateSeparator && (
                <div className="date-divider">{currentDateLabel}</div>
              )}

              <div
                id={`msg-${msg.id}`}
                className={`message-bubble ${isOutgoing ? 'outgoing' : 'incoming'} ${isHighlighted ? 'highlighted' : ''}`}
                onClick={() => {
                  if (isCall && otherMember) {
                    onStartCall(otherMember.userId, callData?.callType === 'video');
                  }
                }}
                title={isCall ? 'Click to call back' : undefined}
              >
                {!isOutgoing && conversation.type === 'GROUP' && (
                  <div className="message-sender-name" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-emerald)', marginBottom: '2px' }}>
                    {msg.sender?.displayName || msg.sender?.username}
                  </div>
                )}

                {/* Floating Action Bar on Hover */}
                <div className="bubble-action-bar">
                  <button
                    type="button"
                    className="bubble-action-btn"
                    data-action="reply"
                    onClick={(e) => { e.stopPropagation(); setQuotedReplyMessage(msg); }}
                    title="Reply"
                  >
                    <CornerUpLeft size={13} />
                  </button>
                  <button
                    type="button"
                    className="bubble-action-btn"
                    data-action="reaction-pick"
                    onClick={(e) => { e.stopPropagation(); setActiveReactionMessageId(activeReactionMessageId === msg.id ? null : msg.id); }}
                    title="React"
                  >
                    <Smile size={13} />
                  </button>
                  <button
                    type="button"
                    className="bubble-action-btn"
                    data-action="star"
                    onClick={(e) => { e.stopPropagation(); handleToggleStar(msg.id); }}
                    title="Star"
                  >
                    <Star size={13} fill={localStarred[msg.id] || msg.isStarred ? '#f59e0b' : 'none'} color={localStarred[msg.id] || msg.isStarred ? '#f59e0b' : 'inherit'} />
                  </button>
                  <button
                    type="button"
                    className="bubble-action-btn"
                    data-action="copy"
                    onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg.content); }}
                    title="Copy"
                  >
                    <Copy size={13} />
                  </button>
                </div>

                {/* Reaction Popover */}
                {activeReactionMessageId === msg.id && (
                  <div className="reaction-picker-popover" style={{ position: 'absolute', top: '-42px', left: '0' }}>
                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="reaction-emoji-btn"
                        onClick={(e) => { e.stopPropagation(); handleReactionPick(msg.id, emoji); }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {renderMessageContent(msg)}

                {/* Reaction Badges on Bubble */}
                {(() => {
                  const summaries = localReactions[msg.id]?.summaries ?? msg.reactionSummaries;
                  if (!summaries || summaries.length === 0) return null;
                  return (
                    <div className="reactions-row">
                      {summaries.map((s: any) => (
                        <span
                          key={s.emoji}
                          className="reaction-badge"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReactionPick(msg.id, s.emoji);
                          }}
                        >
                          <span>{s.emoji}</span>
                          <span>{s.count}</span>
                        </span>
                      ))}
                    </div>
                  );
                })()}

                {!isCall && (
                  <div className="bubble-meta">
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {renderReceiptStatus(msg)}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji, GIF & Sticker Picker Popup */}
      {showEmoji && (
        <EmojiPicker
          className="emoji-gif-sticker-panel emoji-picker-panel"
          initialMode={mediaPickerMode}
          onSelectEmoji={handleEmojiClick}
          onSelectGif={handleSelectGif}
          onSelectSticker={handleSelectSticker}
          onClose={() => setShowEmoji(false)}
        />
      )}

      {/* WhatsApp Web Attachment Flyout Menu */}
      <AttachmentMenu
        isOpen={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onSelectFiles={handleSelectFiles}
        onOpenCamera={() => setShowCameraModal(true)}
      />

      {/* WhatsApp Web Camera Modal */}
      <CameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapturePhoto={handleCapturePhoto}
      />

      {/* WhatsApp Web Attachment Staging Preview Modal */}
      <AttachmentPreviewModal
        isOpen={showPreviewModal}
        files={selectedFiles}
        onClose={() => {
          setShowPreviewModal(false);
          setSelectedFiles([]);
        }}
        onSendAttachment={handleSendAttachment}
      />

      {/* Fullscreen Media Lightbox Modal */}
      {lightboxMedia && (
        <MediaLightboxModal
          isOpen={lightboxMedia.isOpen}
          mediaUrl={lightboxMedia.url}
          mediaType={lightboxMedia.type}
          fileName={lightboxMedia.fileName}
          caption={lightboxMedia.caption}
          senderName={lightboxMedia.senderName}
          timestamp={lightboxMedia.timestamp}
          onClose={() => setLightboxMedia(null)}
        />
      )}

      {/* Quoted Message Reply Bar */}
      {quotedReplyMessage && (
        <div className="quoted-reply-active-bar" id="quotedReplyActiveBar" style={{ display: 'flex' }}>
          <div className="quoted-reply-text">
            <strong id="quotedReplyAuthor">
              Replying to {quotedReplyMessage.sender?.displayName || quotedReplyMessage.sender?.username || 'Message'}
            </strong>
            <span id="quotedReplyText">{quotedReplyMessage.content}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            id="btnCancelQuotedReply"
            onClick={() => setQuotedReplyMessage(null)}
            title="Cancel reply"
            aria-label="Cancel reply"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Chat Composer Bar matching Approved Preview */}
      <form
        className="chat-composer-bar"
        id="chatComposerForm"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <button
          type="button"
          className="icon-btn"
          id="btnEmojiPickerToggle"
          aria-label="Insert Emoji, GIF or Sticker"
          title="Emoji, GIF & Stickers"
          onClick={() => {
            setMediaPickerMode('emojis');
            setShowEmoji((prev) => !prev);
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>

        <button
          type="button"
          className="icon-btn"
          id="btnAttachment"
          aria-label="Add attachment"
          title="Attach file"
          onClick={() => setShowAttachmentMenu((prev) => !prev)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <input
          type="text"
          className="composer-input-field"
          id="composerInputField"
          placeholder="Type a message (Press Enter to send)..."
          autoComplete="off"
          aria-label="Compose message"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />

        <button
          type="button"
          className="icon-btn"
          id="btnRupeePayment"
          aria-label="Fast ₹ Payment demo"
          title="Send Rupee Payment"
          onClick={() => setShowPaymentModal(true)}
        >
          ₹
        </button>

        <button
          type="submit"
          className="composer-send-btn"
          id="btnSendMessage"
          aria-label="Send message"
          title="Send"
          disabled={!inputText.trim()}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>

      {/* Fast UPI Rupee Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div
            className="modal-card"
            style={{
              maxWidth: '380px',
              width: '100%',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 16px)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Fast UPI Payment
                </h3>
                <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', borderRadius: '4px', fontWeight: 600 }}>
                  Sandbox Preview
                </span>
              </div>
              <button className="icon-btn" onClick={() => setShowPaymentModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              color: '#eab308',
              marginBottom: '14px',
              lineHeight: '1.4'
            }}>
              ⚠️ <strong>Sandbox Simulation</strong>: UPI payment messaging is a demo preview. No actual financial transfer, banking transaction, or money debit is performed.
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-sec)', display: 'block', marginBottom: '6px' }}>
                Amount (INR ₹)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-main)'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-sec)', display: 'block', marginBottom: '6px' }}>
                Payment Note (Optional)
              </label>
              <input
                type="text"
                placeholder="Dinner, split bill, etc."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  fontSize: '13px',
                  color: 'var(--text-main)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-secondary"
                style={{ flex: 1, padding: '10px' }}
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                id="btnConfirmPayment"
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'var(--brand-teal)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm, 6px)',
                  fontWeight: 600
                }}
                onClick={handleConfirmFastPayment}
              >
                Send Simulated Payment Card (₹{paymentAmount || '0'})
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
