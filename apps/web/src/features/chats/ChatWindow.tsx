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
  ArrowUpRight
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const dragCounterRef = useRef<number>(0);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark incoming messages as read when opening conversation (respecting read receipts privacy setting)
  useEffect(() => {
    if (conversation && settingsService.getSettings().readReceipts) {
      messages.forEach((msg) => {
        if (msg.senderId !== currentUser.id) {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    wsClient.sendTyping(conversation.id, false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
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
    const isRead = userReadReceiptsEnabled && msg.receipts?.some((r) => r.readAt != null);
    const isDelivered = msg.receipts?.some((r) => r.deliveredAt != null);

    if (isRead) {
      return (
        <span title="Read">
          <CheckCheck size={14} className="receipt-icon read" />
        </span>
      );
    }
    if (isDelivered) {
      return (
        <span title="Delivered">
          <CheckCheck size={14} className="receipt-icon delivered" />
        </span>
      );
    }
    return (
      <span title="Sent">
        <Check size={14} className="receipt-icon sent" />
      </span>
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

    // Default TEXT message
    return <span className="message-text">{msg.content}</span>;
  };

  return (
    <main
      className="chat-area"
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
        <div className="chat-header-info">
          <button className="icon-btn" onClick={onBackToSidebar} style={{ marginRight: '-4px' }} aria-label="Back">
            <ChevronLeft size={22} />
          </button>
          <div className={`avatar ${isOtherOnline ? 'online' : ''}`}>
            {conversation.type === 'GROUP' ? <Users size={20} /> : chatTitle.charAt(0).toUpperCase()}
          </div>
          <div className="chat-header-details">
            <h2 className="chat-header-name" style={{ margin: 0, fontSize: '1rem' }}>{chatTitle}</h2>
            {isTyping ? (
              <span className="chat-header-status typing">
                typing
                <span className="typing-dots">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </span>
            ) : (
              <span className={`chat-header-status ${isOtherOnline ? 'online' : ''}`}>
                {conversation.type === 'GROUP'
                  ? `${conversation.members.length} participants`
                  : (isOtherOnline ? 'online' : 'offline')}
              </span>
            )}
          </div>
        </div>

        <div className="sidebar-actions">
          {otherMember && (
            <>
              <button
                className="icon-btn"
                onClick={() => onStartCall(otherMember.userId, false)}
                title="Audio Call"
                aria-label="Audio Call"
              >
                <Phone size={19} />
              </button>
              <button
                className="icon-btn"
                onClick={() => onStartCall(otherMember.userId, true)}
                title="Video Call"
                aria-label="Video Call"
              >
                <Video size={20} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="messages-container">
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

          return (
            <React.Fragment key={msg.id || msg.clientMessageId || `msg-${index}`}>
              {showDateSeparator && (
                <div className="message-date-separator">{currentDateLabel}</div>
              )}

              <div
                className={`message-row ${isOutgoing ? 'outgoing' : 'incoming'} ${isSticker ? 'has-sticker-row' : ''} ${isGif ? 'has-gif-row' : ''}`}
              >
                <div
                  className={`message-bubble ${isOutgoing ? 'outgoing' : 'incoming'} ${
                    isMedia && !isGif ? 'has-media' : ''
                  } ${msg.type === 'DOCUMENT' ? 'has-document' : ''} ${
                    isSticker ? 'has-sticker' : ''
                  } ${isGif ? 'has-gif' : ''} ${isCall ? 'has-call' : ''}`}
                  onClick={() => {
                    if (isCall && otherMember) {
                      onStartCall(otherMember.userId, callData?.callType === 'video');
                    }
                  }}
                  title={isCall ? 'Click to call back' : undefined}
                >
                  {!isOutgoing && conversation.type === 'GROUP' && (
                    <div className="message-sender-name">
                      {msg.sender?.displayName || msg.sender?.username}
                    </div>
                  )}
                  {renderMessageContent(msg)}
                  {!isCall && (
                    <div className="message-meta">
                      <span className="message-time">{formatMessageTime(msg.createdAt)}</span>
                      {renderReceiptStatus(msg)}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji, GIF & Sticker Picker Popup */}
      {showEmoji && (
        <EmojiPicker
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

      {/* Chat Input Bar */}
      <div className="chat-input-bar">
        <button
          className={`icon-btn ${showEmoji && mediaPickerMode === 'emojis' ? 'active' : ''}`}
          onClick={() => {
            if (showEmoji && mediaPickerMode === 'emojis') {
              setShowEmoji(false);
            } else {
              setMediaPickerMode('emojis');
              setShowEmoji(true);
            }
          }}
          title="Emojis"
          aria-label="Emojis"
        >
          <Smile size={22} />
        </button>

        <button
          className={`icon-btn gif-input-btn ${showEmoji && mediaPickerMode === 'gifs' ? 'active' : ''}`}
          onClick={() => {
            if (showEmoji && mediaPickerMode === 'gifs') {
              setShowEmoji(false);
            } else {
              setMediaPickerMode('gifs');
              setShowEmoji(true);
            }
          }}
          title="Search & Send GIFs"
          aria-label="GIFs"
        >
          <span className="gif-btn-text">GIF</span>
        </button>

        <button
          className={`icon-btn ${showEmoji && mediaPickerMode === 'stickers' ? 'active' : ''}`}
          onClick={() => {
            if (showEmoji && mediaPickerMode === 'stickers') {
              setShowEmoji(false);
            } else {
              setMediaPickerMode('stickers');
              setShowEmoji(true);
            }
          }}
          title="Stickers"
          aria-label="Stickers"
        >
          <StickerIcon size={21} />
        </button>

        <button
          className={`icon-btn ${showAttachmentMenu ? 'active' : ''}`}
          title="Attach files, photos, camera"
          aria-label="Attach"
          onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
        >
          <Paperclip size={20} />
        </button>

        <div className="input-box-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Type a message"
            rows={1}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!inputText.trim()}
          title="Send"
          aria-label="Send Message"
        >
          <Send size={18} />
        </button>
      </div>
    </main>
  );
};
