import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Message,
  MessageType,
  MessageReceipt,
} from '@chat/shared-types';
import { api, getApiBaseUrl } from '../../services/api';
import { wsClient } from '../../services/websocket';
import { storage, STORAGE_KEYS } from '../../services/storage';
import { callHistoryService, CallHistoryItem } from '../../services/callHistory';
import { generateUUID } from '../../utils/uuid';
import { EMOJI_CATEGORIES, EmojiItem } from '../../data/emojiData';
import {
  GIF_CATEGORIES,
  CURATED_GIFS,
  GifItem,
  searchGifsLocally,
  getGifsByCategory,
  fetchOnlineGifs,
  getGiphyFallbacks,
} from '../../data/gifData';
import {
  STICKER_PACKS,
  StickerPack,
  StickerItem,
  searchStickers,
} from '../../data/stickerData';
import { StickerView } from '../../components/StickerView';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Emojis category tabs with icons
const EMOJI_TAB_CATEGORIES = [
  { id: 'recents', icon: '🕒', name: 'Recent' },
  { id: 'smileys', icon: '😀', name: 'Smileys' },
  { id: 'people', icon: '✋', name: 'People' },
  { id: 'animals', icon: '🐶', name: 'Animals' },
  { id: 'food', icon: '🍔', name: 'Food' },
  { id: 'activities', icon: '⚽', name: 'Activities' },
  { id: 'travel', icon: '✈️', name: 'Travel' },
  { id: 'objects', icon: '💡', name: 'Objects' },
  { id: 'symbols', icon: '🔣', name: 'Symbols' },
  { id: 'flags', icon: '🚩', name: 'Flags' },
];

function isEmojiOnly(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  const emojiRegex = /^(?:[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{FE0E}]|[\u{FE0F}]|\s)+$/u;
  const codePoints = Array.from(trimmed.replace(/\s+/g, ''));
  return codePoints.length > 0 && codePoints.length <= 4 && emojiRegex.test(trimmed);
}

interface ParsedAttachment {
  fileId?: string;
  fileName?: string;
  fileType?: MessageType;
  mimeType?: string;
  fileSize?: number;
  fileUrl: string;
  caption?: string;
  isGif?: boolean;
  isSticker?: boolean;
}

function resolveMediaUrl(url?: string, baseUrl?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/') && baseUrl) {
    return `${baseUrl.replace(/\/+$/, '')}${trimmed}`;
  }
  return trimmed;
}

const GifMediaImage: React.FC<{
  uri: string;
  style?: any;
  resizeMode?: 'cover' | 'contain';
}> = ({ uri, style, resizeMode = 'cover' }) => {
  const fallbacks = useMemo(() => getGiphyFallbacks(uri), [uri]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const handleError = () => {
    if (currentIdx + 1 < fallbacks.length) {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const currentSrc = fallbacks[currentIdx] || uri;

  return (
    <Image
      source={{ uri: currentSrc }}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
    />
  );
};

function parseAttachment(content: string): ParsedAttachment | null {
  if (!content || typeof content !== 'string') return null;
  const trimmed = content.trim();

  // 1. Try JSON payload (including double-serialized strings)
  if (trimmed.startsWith('{') || trimmed.startsWith('"{\\"')) {
    try {
      let data: any = JSON.parse(trimmed);
      if (typeof data === 'string' && data.startsWith('{')) {
        data = JSON.parse(data);
      }
      if (data && typeof data === 'object') {
        const fileUrl = data.fileUrl || data.url || data.src || '';
        const isStk =
          data.isSticker === true ||
          data.fileType === 'STICKER' ||
          data.type === 'STICKER' ||
          (typeof fileUrl === 'string' && (fileUrl.startsWith('data:image/svg') || fileUrl.includes('.svg')));
        const isG =
          data.isGif === true ||
          data.fileType === 'GIF' ||
          data.type === 'GIF' ||
          (data.fileName && data.fileName.toLowerCase().endsWith('.gif')) ||
          (typeof fileUrl === 'string' && (fileUrl.toLowerCase().includes('.gif') || fileUrl.includes('giphy') || fileUrl.includes('tenor')));

        return {
          fileUrl,
          fileName: data.fileName || (isStk ? 'sticker.svg' : isG ? 'animation.gif' : 'attachment'),
          fileType: isStk ? 'STICKER' : isG ? 'IMAGE' : data.fileType,
          mimeType: data.mimeType,
          fileSize: data.fileSize,
          caption: data.caption,
          isGif: isG,
          isSticker: isStk,
        };
      }
    } catch {}
  }

  // 2. Direct SVG XML string
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) {
    return {
      fileUrl: trimmed,
      fileName: 'sticker.svg',
      fileType: 'STICKER',
      isSticker: true,
    };
  }

  // 3. Direct SVG data URI
  if (trimmed.startsWith('data:image/svg+xml')) {
    return {
      fileUrl: trimmed,
      fileName: 'sticker.svg',
      fileType: 'STICKER',
      isSticker: true,
    };
  }

  // 4. Direct URLs or relative API paths
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('data:')
  ) {
    const isStk = trimmed.toLowerCase().includes('.svg') || trimmed.startsWith('data:image/svg');
    const isG =
      trimmed.toLowerCase().includes('.gif') ||
      trimmed.includes('giphy.com') ||
      trimmed.includes('tenor.com');

    return {
      fileUrl: trimmed,
      fileName: isStk ? 'sticker.svg' : isG ? 'animation.gif' : 'attachment',
      fileType: isStk ? 'STICKER' : isG ? 'IMAGE' : undefined,
      isGif: isG,
      isSticker: isStk,
    };
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

function parseCallContent(content: string): CallPayload | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object' && ('callType' in data || 'durationText' in data)) {
      return data as CallPayload;
    }
  } catch {}
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

function parseDurationToSecs(text?: string): number {
  if (!text) return 0;
  let total = 0;
  const minMatch = text.match(/(\d+)\s*min/);
  const secMatch = text.match(/(\d+)\s*sec/);
  if (minMatch) total += parseInt(minMatch[1], 10) * 60;
  if (secMatch) total += parseInt(secMatch[1], 10);
  return total;
}

function convertCallToMessage(
  call: CallHistoryItem,
  convId: string,
  myUserId?: string
): Message {
  const isOutgoing = call.type === 'outgoing';
  const durationSec = parseDurationToSecs(call.duration);

  return {
    id: call.id,
    conversationId: convId,
    senderId: isOutgoing ? (myUserId || 'current-user') : (call.targetUserId || 'other-user'),
    clientMessageId: call.id,
    type: 'CALL',
    content: JSON.stringify({
      callType: call.isVideo ? 'video' : 'voice',
      status: call.type === 'missed' ? 'missed' : call.duration === 'No answer' ? 'no_answer' : 'connected',
      duration: durationSec,
      durationText: call.duration || call.subtitle || (call.type === 'missed' ? 'Missed' : 'Voice call'),
      endedAt: new Date(call.timestamp).toISOString(),
    }),
    createdAt: new Date(call.timestamp).toISOString(),
    receipts: [],
    status: 'delivered',
  };
}

function mergeMessagesWithCalls(
  baseMsgs: Message[],
  calls: CallHistoryItem[],
  convId?: string,
  targetId?: string | null,
  cName?: string,
  currentU?: User | null
): Message[] {
  const matchingCalls = calls.filter((c) => {
    if (convId && c.conversationId && c.conversationId === convId) return true;
    if (targetId && c.targetUserId && c.targetUserId === targetId) return true;
    if (cName && c.contactName && c.contactName.trim().toLowerCase() === cName.trim().toLowerCase()) return true;
    return false;
  });

  const callMsgs: Message[] = matchingCalls.map((c) =>
    convertCallToMessage(c, convId || 'chat', currentU?.id)
  );

  const mergedMap = new Map<string, Message>();
  baseMsgs.forEach((m) => {
    mergedMap.set(m.id || m.clientMessageId || `msg-${m.createdAt}`, m);
  });

  callMsgs.forEach((cm) => {
    const alreadyExists = baseMsgs.some(
      (m) =>
        m.id === cm.id ||
        (m.type === 'CALL' && Math.abs(new Date(m.createdAt).getTime() - new Date(cm.createdAt).getTime()) < 5000)
    );
    if (!alreadyExists) {
      mergedMap.set(cm.id, cm);
    }
  });

  const result = Array.from(mergedMap.values());
  result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return result;
}





export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { palette, metrics, isDark } = useTheme();
  const router = useRouter();
  const {
    id: conversationId,
    name: queryName,
    type: queryType,
    unread: queryUnread,
    targetUserId: queryTargetUserId,
    autoCall: queryAutoCall,
    acceptedCall: queryAcceptedCall,
  } = useLocalSearchParams<{
    id: string;
    name?: string;
    type?: string;
    unread?: string;
    targetUserId?: string;
    autoCall?: 'voice' | 'video';
    acceptedCall?: 'voice' | 'video';
  }>();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(queryTargetUserId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  // Modals & Panels
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState('smileys');
  const [emojiSearchQuery, setEmojiSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([
    '😀', '😂', '😍', '👍', '❤️', '🔥', '🎉', '🙏', '💯', '✨', '👏', '🥳', '😎', '🙌', '🥰', '🚀'
  ]);
  const [selectedGifCategory, setSelectedGifCategory] = useState('trending');
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifsList, setGifsList] = useState<GifItem[]>([]);
  const [isSearchingGifs, setIsSearchingGifs] = useState(false);
  const [selectedStickerPack, setSelectedStickerPack] = useState(STICKER_PACKS[0]?.id || 'reactions');
  const [stickerSearchQuery, setStickerSearchQuery] = useState('');

  // Filter emojis based on selected category or search query
  const filteredEmojis = useMemo(() => {
    const q = emojiSearchQuery.trim().toLowerCase();
    if (!q) {
      if (selectedEmojiCategory === 'recents') {
        return recentEmojis.map((e) => ({ emoji: e, name: '', keywords: [] }));
      }
      return EMOJI_CATEGORIES.find((c) => c.id === selectedEmojiCategory)?.emojis || [];
    }
    const results: EmojiItem[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (item.name.toLowerCase().includes(q) || item.keywords.some((k) => k.toLowerCase().includes(q))) {
          results.push(item);
        }
      }
    }
    return results;
  }, [emojiSearchQuery, selectedEmojiCategory, recentEmojis]);

  // Filter stickers based on selected pack or search query
  const activeStickerPackData = useMemo(() => {
    const pack = STICKER_PACKS.find((p) => p.id === selectedStickerPack) || STICKER_PACKS[0];
    if (!stickerSearchQuery.trim()) return pack?.stickers || [];
    return searchStickers(stickerSearchQuery, pack?.stickers || []);
  }, [selectedStickerPack, stickerSearchQuery]);

  // Load / search GIFs globally from Google Tenor when category, query, or tab changes
  useEffect(() => {
    if (mediaPickerTab !== 'gif') return;
    let active = true;
    const query = gifSearchQuery.trim();

    setIsSearchingGifs(true);
    // Instant fetch for category switches, 250ms debounce while typing search queries
    const delay = query ? 250 : 0;

    const timer = setTimeout(async () => {
      try {
        const results = await fetchOnlineGifs(query, selectedGifCategory, apiBaseUrl);
        if (active) {
          setGifsList(results || []);
        }
      } catch {
        if (active) {
          setGifsList([]);
        }
      } finally {
        if (active) setIsSearchingGifs(false);
      }
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [gifSearchQuery, selectedGifCategory, mediaPickerTab, apiBaseUrl]);

  const handleSelectEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setRecentEmojis((prev) => [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 32));
  };

  const handleEmojiBackspace = () => {
    setInputText((prev) => {
      const arr = Array.from(prev);
      if (arr.length === 0) return '';
      return arr.slice(0, -1).join('');
    });
  };

  const handleSendGif = (gifUrl: string, title?: string) => {
    const payload = JSON.stringify({
      fileUrl: gifUrl,
      fileName: title ? `${title}.gif` : 'animation.gif',
      isGif: true,
      caption: '',
    });
    handleSendMessage(payload, 'IMAGE');
    setShowMediaPicker(false);
  };

  const handleSendSticker = (stickerUrl: string, name?: string) => {
    const payload = JSON.stringify({
      fileUrl: stickerUrl,
      fileName: name || 'sticker.png',
      isSticker: true,
    });
    handleSendMessage(payload, 'STICKER');
    setShowMediaPicker(false);
  };

  // Preview attachment before sending
  const [pendingFile, setPendingFile] = useState<{
    uri: string;
    name: string;
    type: string;
    size?: number;
    previewType: MessageType;
  } | null>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Fullscreen media lightbox
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string;
    caption?: string;
    title?: string;
  } | null>(null);

  // Calling modal
  const [activeCall, setActiveCall] = useState<{
    targetName: string;
    isVideo: boolean;
    status: 'calling' | 'connected';
    duration: number;
    isMuted: boolean;
  } | null>(null);

  // Incoming call state in chat screen
  const [incomingCall, setIncomingCall] = useState<{
    senderUserId: string;
    callerName: string;
    isVideo: boolean;
  } | null>(null);

  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const hasAutoCalledRef = useRef(false);
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;
  const incomingCallRef = useRef(incomingCall);
  incomingCallRef.current = incomingCall;

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Auto-scroll and adjust bottom spacing when keyboard appears
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardOpen(true);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardOpen(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const contactName = queryName || 'Chat';

  // Load user and messages
  useEffect(() => {
    (async () => {
      const u = await storage.getJson<User>(STORAGE_KEYS.CURRENT_USER);
      if (u) setCurrentUser(u);
      const base = await getApiBaseUrl();
      setApiBaseUrl(base);

      let loadedMessages: Message[] = [];
      if (conversationId && !conversationId.startsWith('c-')) {
        try {
          const res = await api.getMessages(conversationId);
          if (res.messages && res.messages.length > 0) {
            loadedMessages = res.messages;

            // Mark all unread incoming messages as seen
            res.messages.forEach((msg) => {
              if (u && msg.senderId !== u.id) {
                const isRead = msg.receipts?.some((r) => r.userId === u.id && r.readAt != null);
                if (!isRead) {
                  wsClient.markRead(msg.id, conversationId);
                  api.markRead(msg.id).catch(() => {});
                }
              }
            });
          }
        } catch (e) {
          console.warn('Failed to load backend messages:', e);
        }

        // If targetUserId is not yet set from query params, resolve it from messages or conversation members
        if (!queryTargetUserId) {
          if (loadedMessages.length > 0) {
            const incomingMsg = loadedMessages.find((m: Message) => u && m.senderId !== u.id);
            if (incomingMsg) {
              setTargetUserId(incomingMsg.senderId);
            }
          }

          api.getConversation(conversationId).then((conv) => {
            if (conv && conv.members) {
              const other = conv.members.find((m) => {
                const mid = m.userId || m.user?.id;
                const myId = u?.id;
                return mid && myId && mid !== myId;
              });
              if (other) {
                setTargetUserId(other.userId || other.user?.id || null);
              }
            }
          }).catch(() => {});
        }
      }

      // Merge backend messages with call history logs at their timestamp
      try {
        const history = await callHistoryService.getHistory();
        const merged = mergeMessagesWithCalls(
          loadedMessages,
          history,
          conversationId,
          queryTargetUserId || null,
          contactName,
          u
        );
        setMessages(merged);
      } catch (err) {
        setMessages(loadedMessages);
      } finally {
        setLoading(false);
      }
    })();
  }, [conversationId, contactName, queryTargetUserId]);

  // Keep chat thread in sync with call logs live
  useEffect(() => {
    const unsubHistory = callHistoryService.onHistoryChange((updatedCalls) => {
      setMessages((prev) =>
        mergeMessagesWithCalls(
          prev,
          updatedCalls,
          conversationId,
          targetUserId,
          contactName,
          currentUser
        )
      );
    });
    return () => unsubHistory();
  }, [conversationId, targetUserId, contactName, currentUser]);

  // Mark incoming unread messages as read when viewing conversation
  useEffect(() => {
    if (!currentUser || !conversationId) return;
    messages.forEach((msg) => {
      if (msg.senderId !== currentUser.id) {
        const isRead = msg.receipts?.some((r) => r.userId === currentUser.id && r.readAt != null);
        if (!isRead) {
          wsClient.markRead(msg.id, conversationId);
          api.markRead(msg.id).catch(() => {});
        }
      }
    });
  }, [conversationId, messages.length, currentUser?.id]);

  // WebSocket listeners
  useEffect(() => {
    if (!conversationId) return;

    const unsubMsg = wsClient.onMessageCreated((msg: Message) => {
      if (currentUser && msg.senderId !== currentUser.id) {
        if (msg.conversationId === conversationId) {
          // Since user is actively in this chat, mark new incoming message as seen immediately!
          wsClient.markRead(msg.id, conversationId);
          api.markRead(msg.id).catch(() => {});
        } else {
          // Message for another chat, acknowledge delivery
          wsClient.markDelivered(msg.id, msg.conversationId);
        }
      }

      if (msg.conversationId === conversationId) {
        setMessages((prev) => {
          const matchIndex = prev.findIndex(
            (m) =>
              (Boolean(msg.clientMessageId) && m.clientMessageId === msg.clientMessageId) ||
              (Boolean(msg.id) && m.id === msg.id)
          );
          const isRead = msg.receipts?.some((r) => r.readAt != null);
          const isDelivered = msg.receipts?.some((r) => r.deliveredAt != null);
          const status = isRead ? 'read' : isDelivered ? 'delivered' : 'sent';
          if (matchIndex >= 0) {
            const next = [...prev];
            next[matchIndex] = { ...msg, status };
            return next;
          }
          return [...prev, { ...msg, status }];
        });
      }
    });

    const unsubReceipt = wsClient.onReceiptUpdated((receipt: MessageReceipt) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === receipt.messageId) {
            const receipts = m.receipts ? [...m.receipts] : [];
            const idx = receipts.findIndex((r) => r.userId === receipt.userId);
            if (idx >= 0) receipts[idx] = receipt;
            else receipts.push(receipt);
            const isRead = receipts.some((r) => r.readAt != null);
            const isDelivered = receipts.some((r) => r.deliveredAt != null);
            return {
              ...m,
              receipts,
              status: isRead ? 'read' : isDelivered ? 'delivered' : m.status,
            };
          }
          return m;
        })
      );
    });

    const unsubCall = wsClient.onCallSignal((signal) => {
      if (signal.signalType === 'offer' && signal.senderUserId) {
        const caller = (signal.data as any)?.callerName || contactName || 'Incoming Caller';
        setIncomingCall({
          senderUserId: signal.senderUserId,
          callerName: caller,
          isVideo: Boolean((signal.data as any)?.isVideo),
        });
      } else if (signal.signalType === 'answer') {
        setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null));
      } else if (signal.signalType === 'hangup') {
        const call = activeCallRef.current;
        const incoming = incomingCallRef.current;
        if (incoming) {
          callHistoryService.addCall({
            conversationId: conversationId || undefined,
            contactName: incoming.callerName || contactName,
            targetUserId: incoming.senderUserId,
            isVideo: incoming.isVideo,
            type: 'missed',
            duration: 'Missed',
            subtitle: 'Missed',
          });
        } else if (call) {
          const isConnected = call.status === 'connected' && call.duration > 0;
          let durationText: string;
          if (isConnected) {
            if (call.duration < 60) {
              durationText = `${call.duration} sec`;
            } else {
              const mins = Math.floor(call.duration / 60);
              const secs = call.duration % 60;
              durationText = secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`;
            }
          } else {
            durationText = 'No answer';
          }

          callHistoryService.addCall({
            conversationId: conversationId || undefined,
            contactName: contactName || call.targetName,
            targetUserId: targetUserId || undefined,
            isVideo: call.isVideo,
            type: isConnected ? 'incoming' : 'missed',
            duration: durationText,
            subtitle: durationText,
          });
        }
        setActiveCall(null);
        setIncomingCall(null);
      }
    });

    return () => {
      unsubMsg();
      unsubReceipt();
      unsubCall();
    };
  }, [conversationId, contactName]);

  // Handle accepted call passed from chats screen navigation
  useEffect(() => {
    if (queryAcceptedCall) {
      setActiveCall({
        targetName: contactName,
        isVideo: queryAcceptedCall === 'video',
        status: 'connected',
        duration: 0,
        isMuted: false,
      });
    }
  }, [queryAcceptedCall, contactName]);

  // Handle autoCall when entering from Calls tab or New Call contact modal
  useEffect(() => {
    if (queryAutoCall && targetUserId && !hasAutoCalledRef.current) {
      hasAutoCalledRef.current = true;
      handleStartCall(queryAutoCall === 'video');
    }
  }, [queryAutoCall, targetUserId]);

  // Call duration counter
  useEffect(() => {
    let interval: any;
    if (activeCall && activeCall.status === 'connected') {
      interval = setInterval(() => {
        setActiveCall((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  const handleSendMessage = async (content: string, type: MessageType = 'TEXT') => {
    if (!content.trim()) return;

    const clientMsgId = generateUUID();
    const optimisticMessage: Message = {
      id: clientMsgId,
      conversationId: conversationId || 'demo-triv',
      senderId: currentUser?.id || 'current-user',
      clientMessageId: clientMsgId,
      type,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      sender: currentUser || undefined,
      receipts: [],
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setShowMediaPicker(false);

    // If active conversation on backend, send via API
    if (conversationId && !conversationId.startsWith('demo-')) {
      try {
        const saved = await api.sendMessage({
          conversationId,
          clientMessageId: clientMsgId,
          messageType: type,
          content: content.trim(),
        });

        const isRead = saved.receipts?.some((r) => r.readAt != null);
        const isDelivered = saved.receipts?.some((r) => r.deliveredAt != null);
        const status = isRead ? 'read' : isDelivered ? 'delivered' : 'sent';

        setMessages((prev) =>
          prev.map((m) =>
            (m.clientMessageId && m.clientMessageId === clientMsgId) || m.id === clientMsgId
              ? { ...saved, status }
              : m
          )
        );
      } catch (err) {
        wsClient.sendMessage({
          conversationId,
          clientMessageId: clientMsgId,
          messageType: type,
          content: content.trim(),
        });
      }
    } else {
      // Simulate sent tick in demo mode
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMsgId ? { ...m, status: 'sent' } : m
          )
        );
      }, 400);
    }
  };

  // Attachments Handling
  const handlePickImage = async () => {
    setShowAttachmentMenu(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Allow media library access to send photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video' || asset.uri.toLowerCase().endsWith('.mp4');
      setPendingFile({
        uri: asset.uri,
        name: asset.fileName || (isVideo ? 'video.mp4' : 'photo.jpg'),
        type: isVideo ? 'video/mp4' : 'image/jpeg',
        size: asset.fileSize,
        previewType: isVideo ? 'VIDEO' : 'IMAGE',
      });
      setPendingCaption('');
    }
  };

  const handleCaptureCamera = async () => {
    setShowAttachmentMenu(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Allow camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPendingFile({
        uri: asset.uri,
        name: asset.fileName || 'camera_photo.jpg',
        type: 'image/jpeg',
        size: asset.fileSize,
        previewType: 'IMAGE',
      });
      setPendingCaption('');
    }
  };

  const handlePickDocument = async () => {
    setShowAttachmentMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setPendingFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
          size: file.size,
          previewType: 'DOCUMENT',
        });
        setPendingCaption('');
      }
    } catch (err: any) {
      console.warn('Doc picker error', err);
    }
  };

  const handleConfirmSendAttachment = async () => {
    if (!pendingFile) return;
    setUploadingFile(true);

    try {
      let fileUrl = pendingFile.uri;
      if (conversationId && !conversationId.startsWith('demo-')) {
        const uploadRes = await api.uploadFile({
          uri: pendingFile.uri,
          name: pendingFile.name,
          type: pendingFile.type,
        });
        fileUrl = uploadRes.fileUrl;
      }

      const attachmentPayload = {
        fileName: pendingFile.name,
        fileType: pendingFile.previewType,
        fileSize: pendingFile.size || 0,
        fileUrl,
        caption: pendingCaption.trim() || undefined,
      };

      setPendingFile(null);
      setPendingCaption('');

      await handleSendMessage(JSON.stringify(attachmentPayload), pendingFile.previewType);
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Failed to send attachment.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleStartCall = (isVideo: boolean) => {
    const effectiveTargetId =
      targetUserId ||
      (conversationId && !conversationId.startsWith('c-') ? conversationId : null);

    if (!effectiveTargetId) {
      Alert.alert('Unable to Call', 'Contact information is still loading. Please try again in a moment.');
      return;
    }

    setActiveCall({
      targetName: contactName,
      isVideo,
      status: 'calling',
      duration: 0,
      isMuted: false,
    });

    wsClient.sendCallSignal({
      targetUserId: effectiveTargetId,
      signalType: 'offer',
      data: {
        isVideo,
        callerName: currentUser?.displayName || currentUser?.username || 'IndiChat User',
      },
    });
  };

  const handleHangupCall = () => {
    const effectiveTargetId =
      targetUserId ||
      (conversationId && !conversationId.startsWith('c-') ? conversationId : null);
    if (effectiveTargetId) {
      wsClient.sendCallSignal({
        targetUserId: effectiveTargetId,
        signalType: 'hangup',
        data: {},
      });
    }

    const currentCall = activeCallRef.current || activeCall;
    if (currentCall) {
      const isVoice = !currentCall.isVideo;
      const isConnected = currentCall.status === 'connected' && currentCall.duration > 0;
      let durationText: string;
      if (isConnected) {
        if (currentCall.duration < 60) {
          durationText = `${currentCall.duration} sec`;
        } else {
          const mins = Math.floor(currentCall.duration / 60);
          const secs = currentCall.duration % 60;
          durationText = secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`;
        }
      } else {
        durationText = 'No answer';
      }

      const status = isConnected ? 'connected' : 'no_answer';

      const callPayload = {
        callType: isVoice ? 'voice' : 'video',
        status,
        duration: currentCall.duration,
        durationText,
        endedAt: new Date().toISOString(),
      };

      // 1. Post to chat thread as WhatsApp call bubble
      handleSendMessage(JSON.stringify(callPayload), 'CALL');

      // 2. Persist in call history logs
      callHistoryService.addCall({
        conversationId: conversationId || undefined,
        contactName: contactName || currentCall.targetName,
        targetUserId: effectiveTargetId || undefined,
        isVideo: currentCall.isVideo,
        type: 'outgoing',
        duration: durationText,
        subtitle: durationText,
      });
    }

    setActiveCall(null);
    setIncomingCall(null);
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    wsClient.sendCallSignal({
      targetUserId: incomingCall.senderUserId,
      signalType: 'answer',
      data: {},
    });
    setTargetUserId(incomingCall.senderUserId);
    setActiveCall({
      targetName: incomingCall.callerName,
      isVideo: incomingCall.isVideo,
      status: 'connected',
      duration: 0,
      isMuted: false,
    });
    setIncomingCall(null);
  };

  const handleDeclineIncomingCall = () => {
    if (!incomingCall) return;
    wsClient.sendCallSignal({
      targetUserId: incomingCall.senderUserId,
      signalType: 'hangup',
      data: {},
    });

    const callPayload = {
      callType: incomingCall.isVideo ? 'video' : 'voice',
      status: 'declined',
      duration: 0,
      durationText: 'Declined',
      endedAt: new Date().toISOString(),
    };
    handleSendMessage(JSON.stringify(callPayload), 'CALL');

    callHistoryService.addCall({
      conversationId: conversationId || undefined,
      contactName: incomingCall.callerName,
      targetUserId: incomingCall.senderUserId,
      isVideo: incomingCall.isVideo,
      type: 'missed',
      duration: 'Declined',
      subtitle: 'Declined',
    });

    setIncomingCall(null);
  };

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return '14:22';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '14:22';
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderBubbleContent = (msg: Message, isOutgoing: boolean = false) => {
    const parsed = parseAttachment(msg.content);

    // 1. Sticker Message
    const isSticker =
      msg.type === 'STICKER' ||
      parsed?.fileType === 'STICKER' ||
      parsed?.isSticker === true;

    if (isSticker) {
      const stickerUrl = resolveMediaUrl(parsed?.fileUrl || msg.content, apiBaseUrl);
      return (
        <View style={styles.stickerBubbleWrap}>
          <StickerView uri={stickerUrl} size={140} baseUrl={apiBaseUrl} />
        </View>
      );
    }

    // 2. GIF or Image Message
    const isGif = Boolean(
      parsed?.isGif ||
      (parsed as any)?.fileType === 'GIF' ||
      (parsed?.fileName && parsed.fileName.toLowerCase().endsWith('.gif')) ||
      (parsed?.fileUrl && parsed.fileUrl.toLowerCase().includes('.gif')) ||
      (typeof msg.content === 'string' && (msg.content.includes('.gif') || msg.content.includes('giphy') || msg.content.includes('tenor')))
    );

    if (isGif || msg.type === 'IMAGE' || (parsed && parsed.fileType === 'IMAGE')) {
      const rawUrl = parsed?.fileUrl || msg.content;
      const imgUrl = resolveMediaUrl(rawUrl, apiBaseUrl);
      return (
        <View style={isGif ? styles.gifBubbleWrap : styles.imageBubbleWrap}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setLightboxMedia({ url: imgUrl, caption: parsed?.caption, title: isGif ? 'GIF' : contactName })}
          >
            <GifMediaImage uri={imgUrl} style={isGif ? styles.gifBubble : styles.imageBubble} resizeMode="cover" />
          </TouchableOpacity>
          {parsed?.caption ? (
            <Text style={[styles.messageText, { color: isOutgoing ? palette.bubbleOutText : palette.bubbleInText }]}>
              {parsed.caption}
            </Text>
          ) : null}
        </View>
      );
    }

    // 3. Emoji Only or Regular Text
    const singleOrFewEmoji = isEmojiOnly(msg.content);

    return (
      <View>
        {/* Quoted Reply Message Preview */}
        {msg.replyTo && (
          <View style={styles.replyPreviewCard}>
            <View style={styles.replyAccentBar} />
            <View style={styles.replyContent}>
              <Text style={styles.replyAuthor}>{msg.replyTo.senderDisplayName || 'Replied Message'}</Text>
              <Text style={styles.replySnippet} numberOfLines={2}>
                {msg.replyTo.content}
              </Text>
            </View>
          </View>
        )}

        <Text
          style={[
            styles.messageText,
            { color: isOutgoing ? palette.bubbleOutText : palette.bubbleInText },
            singleOrFewEmoji && styles.bigEmojiText,
          ]}
        >
          {msg.content}
        </Text>
      </View>
    );
  };

  const renderCallBubble = (msg: Message, isOutgoing: boolean, timeStr: string) => {
    const callData = parseCallContent(msg.content);
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

    const isMissedOrDeclined = callData?.status === 'missed' || callData?.status === 'declined';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleStartCall(isVideo)}
        style={[
          styles.callBubbleCard,
          isOutgoing ? styles.callBubbleOutgoing : styles.callBubbleIncoming,
        ]}
      >
        <View style={styles.callBubbleMainRow}>
          {/* WhatsApp Circular Icon with directional arrow */}
          <View
            style={[
              styles.callBubbleIconCircle,
              isOutgoing ? styles.callBubbleIconCircleOut : styles.callBubbleIconCircleIn,
            ]}
          >
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={18}
              color="#ffffff"
            />
            <View
              style={[
                styles.callBubbleArrowBadge,
                isOutgoing ? styles.callBubbleArrowBadgeOut : styles.callBubbleArrowBadgeIn,
              ]}
            >
              <Ionicons
                name={isOutgoing ? 'arrow-up' : 'arrow-down'}
                size={9}
                color={isOutgoing ? '#25D366' : isMissedOrDeclined ? '#f15c6d' : '#8696a0'}
                style={{
                  transform: [{ rotate: isOutgoing ? '45deg' : '-45deg' }],
                }}
              />
            </View>
          </View>

          {/* Call details */}
          <View style={styles.callBubbleInfoCol}>
            <Text style={styles.callBubbleTitle}>{callTitle}</Text>
            <Text
              style={[
                styles.callBubbleSubtitle,
                isOutgoing ? styles.callBubbleSubtitleOut : styles.callBubbleSubtitleIn,
                !isOutgoing && isMissedOrDeclined && { color: '#f15c6d' },
              ]}
              numberOfLines={1}
            >
              {callSubtitle}
            </Text>
          </View>

          {/* Timestamp */}
          <View style={styles.callBubbleTimeCol}>
            <Text
              style={[
                styles.callBubbleTimeText,
                isOutgoing ? styles.callBubbleTimeTextOut : styles.callBubbleTimeTextIn,
              ]}
            >
              {timeStr}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessageItem = ({ item, index }: { item: Message; index: number }) => {
    const isOutgoing = item.senderId === (currentUser?.id || 'current-user');
    const isRead = item.status === 'read' || item.receipts?.some((r) => r.readAt != null);
    const isDelivered = item.status === 'delivered' || item.receipts?.some((r) => r.deliveredAt != null);
    const timeStr = formatMessageTime(item.createdAt);

    const prevMsg = index > 0 ? messages[index - 1] : null;
    const currentDateLabel = item.createdAt ? getDateSeparatorLabel(item.createdAt) : null;
    const prevDateLabel = prevMsg?.createdAt ? getDateSeparatorLabel(prevMsg.createdAt) : null;
    const showDateSeparator = Boolean(
      currentDateLabel && (!prevDateLabel || currentDateLabel !== prevDateLabel)
    );

    const isCallMessage = item.type === 'CALL' || parseCallContent(item.content) !== null;
    const parsed = parseAttachment(item.content);
    const isSticker =
      item.type === 'STICKER' ||
      parsed?.fileType === 'STICKER' ||
      parsed?.isSticker === true;

    const isGif = Boolean(
      parsed?.isGif ||
      (parsed as any)?.fileType === 'GIF' ||
      (parsed?.fileName && parsed.fileName.toLowerCase().endsWith('.gif')) ||
      (parsed?.fileUrl && parsed.fileUrl.toLowerCase().includes('.gif')) ||
      (typeof item.content === 'string' && (item.content.includes('.gif') || item.content.includes('giphy') || item.content.includes('tenor')))
    );

    const isFrameless = isSticker || isGif;

    return (
      <View key={item.id || item.clientMessageId || `msg-${index}`}>
        {showDateSeparator && (
          <View style={styles.dateSeparatorWrap}>
            <View style={[styles.dateSeparatorPill, { backgroundColor: palette.pillDateBg }]}>
              <Text style={[styles.dateSeparatorText, { color: palette.pillDateText }]}>{currentDateLabel}</Text>
            </View>
          </View>
        )}

        <View
          style={[
            styles.bubbleWrapper,
            isOutgoing ? styles.outgoingWrapper : styles.incomingWrapper,
          ]}
        >
          {isCallMessage ? (
            renderCallBubble(item, isOutgoing, timeStr)
          ) : (
            <View
              style={[
                styles.bubble,
                isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
                {
                  backgroundColor: isOutgoing ? palette.bubbleOutBg : palette.bubbleInBg,
                  borderColor: isOutgoing ? palette.bubbleOutBorder : palette.bubbleInBorder,
                },
                isFrameless && styles.framelessBubbleContainer,
              ]}
            >
              {renderBubbleContent(item, isOutgoing)}

              {/* Timestamp and Delivery Receipts */}
              <View style={[styles.metaRow, isFrameless && styles.framelessMetaRow]}>
                <Text
                  style={[
                    styles.timeText,
                    { color: isOutgoing && !isDark ? palette.textSecondary : isDark ? 'rgba(233, 237, 239, 0.65)' : palette.textSecondary },
                    isFrameless && styles.framelessTimeText,
                  ]}
                >
                  {timeStr}
                </Text>
                {isOutgoing && (
                  <View style={!isDark && isRead ? { backgroundColor: palette.tickBacking, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 } : undefined}>
                    <Ionicons
                      name={
                        isRead || isDelivered
                          ? 'checkmark-done'
                          : item.status === 'sending'
                          ? 'time-outline'
                          : 'checkmark'
                      }
                      size={14}
                      color={
                        isRead
                          ? '#53bdeb'
                          : isFrameless
                          ? '#ffffff'
                          : 'rgba(233, 237, 239, 0.6)'
                      }
                    />
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Top Liquid Glass Header matching preview viewConversation() */}
      <LiquidGlassSurface
        variant="chrome"
        style={[
          styles.topHeader,
          {
            paddingTop: insets.top,
            height: 56 + insets.top,
            borderBottomColor: palette.border,
            borderBottomWidth: 1,
          },
        ]}
      >
        <View style={styles.topHeaderLeft}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => router.back()}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
            {queryUnread && Number(queryUnread) > 0 ? (
              <View style={styles.backBadgePill}>
                <Text style={styles.backBadgeText}>{queryUnread}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Contact Avatar: 34x34 squircle with 12px radius */}
          <View style={[styles.contactHeaderAvatar, { backgroundColor: '#10b981' }]}>
            <Text style={styles.contactHeaderAvatarText}>
              {(contactName || 'C').charAt(0).toUpperCase()}
            </Text>
            <View style={[styles.onlineIndicatorDotSmall, { borderColor: palette.bg }]} />
          </View>

          {/* Contact Name & Online Status in Emerald */}
          <View style={styles.contactHeaderMeta}>
            <Text style={[styles.contactHeaderTitle, { color: palette.textPrimary }]} numberOfLines={1}>
              {contactName}
            </Text>
            <Text style={styles.contactHeaderSubtitle}>Online now</Text>
          </View>
        </View>

        {/* Video & Voice Call Action Buttons */}
        <View style={styles.topHeaderRight}>
          <TouchableOpacity
            style={styles.headerCallBtn}
            onPress={() => handleStartCall(false)}
            accessibilityLabel="Audio Call"
          >
            <Ionicons name="call-outline" size={20} color={palette.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCallBtn}
            onPress={() => handleStartCall(true)}
            accessibilityLabel="Video Call"
          >
            <Ionicons name="videocam-outline" size={22} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>
      </LiquidGlassSurface>

      {/* Messages List Area */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id || item.clientMessageId || Math.random().toString()}
          renderItem={renderMessageItem}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[
            styles.messagesContent,
            messages.length === 0 && { flexGrow: 1, justifyContent: 'center' },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyMessagesContainer}>
              <View style={[styles.e2eeBanner, { backgroundColor: palette.pillDateBg, borderColor: palette.border }]}>
                <Ionicons name="lock-closed" size={13} color="#10b981" style={{ marginBottom: 4 }} />
                <Text style={[styles.e2eeBannerText, { color: palette.pillDateText }]}>
                  Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.
                </Text>
              </View>
              <Text style={[styles.emptyMessagesSubtitle, { color: palette.textSecondary }]}>
                Say hello to start the conversation! 👋
              </Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Floating Modern Liquid Glass Chat Composer matching preview */}
      <View
        style={[
          styles.composerWrapper,
          {
            paddingBottom: isKeyboardOpen ? 6 : Math.max(insets.bottom, 10),
          },
        ]}
      >
        <LiquidGlassSurface
          variant="chrome"
          style={[
            styles.floatingComposerCapsule,
            {
              borderColor: palette.border,
            },
          ]}
        >
          {/* Plus (+) Button for Attachments */}
          <TouchableOpacity
            style={styles.composerIconBtn}
            onPress={() => setShowAttachmentMenu(true)}
            activeOpacity={0.7}
            accessibilityLabel="Attachments"
          >
            <Ionicons name="add" size={24} color={palette.textSecondary} />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={[styles.composerTextInput, { color: palette.textPrimary }]}
            placeholder="Type a message..."
            placeholderTextColor={palette.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            onFocus={() => {
              setShowMediaPicker(false);
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 150);
            }}
          />

          {/* Sparkles / Stickers Shortcut */}
          <TouchableOpacity
            style={styles.composerIconBtn}
            onPress={() => {
              if (!showMediaPicker) {
                Keyboard.dismiss();
                setShowMediaPicker(true);
              } else {
                setShowMediaPicker(false);
              }
            }}
            accessibilityLabel="Stickers"
          >
            <Ionicons
              name={showMediaPicker ? 'keypad-outline' : 'sparkles-outline'}
              size={20}
              color={showMediaPicker ? '#10b981' : palette.textSecondary}
            />
          </TouchableOpacity>

          {/* Quick ₹ Rupee Button */}
          <TouchableOpacity
            style={styles.composerIconBtn}
            onPress={() => Alert.alert('UPI Payment', 'Quick ₹ Rupee payment demo on IndiChat')}
            activeOpacity={0.7}
            accessibilityLabel="Rupee"
          >
            <Text style={[styles.rupeeGlyph, { color: palette.textSecondary }]}>₹</Text>
          </TouchableOpacity>

          {/* Camera Button */}
          <TouchableOpacity
            style={styles.composerIconBtn}
            onPress={handleCaptureCamera}
            activeOpacity={0.7}
            accessibilityLabel="Camera"
          >
            <Ionicons name="camera-outline" size={22} color={palette.textSecondary} />
          </TouchableOpacity>

          {/* Emerald Green Circular Send Button */}
          <TouchableOpacity
            style={styles.composerSendBtn}
            onPress={() => {
              if (inputText.trim()) {
                handleSendMessage(inputText, 'TEXT');
              } else {
                handleSendMessage('🎵 Voice message', 'AUDIO');
              }
            }}
            activeOpacity={0.8}
            accessibilityLabel="Send message"
          >
            <Ionicons
              name={inputText.trim() ? 'send' : 'mic'}
              size={18}
              color="#070b0e"
            />
          </TouchableOpacity>
        </LiquidGlassSurface>
      </View>

      {/* Attachment Options Action Modal */}
      <Modal visible={showAttachmentMenu} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAttachmentMenu(false)}
        >
          <View style={styles.attachmentSheet}>
            <View style={styles.attachmentGrid}>
              <TouchableOpacity style={styles.attachmentOption} onPress={handleCaptureCamera}>
                <View style={[styles.optionCircle, { backgroundColor: '#d3396d' }]}>
                  <Ionicons name="camera" size={26} color="#fff" />
                </View>
                <Text style={styles.optionLabel}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOption} onPress={handlePickImage}>
                <View style={[styles.optionCircle, { backgroundColor: '#ac44cf' }]}>
                  <Ionicons name="images" size={26} color="#fff" />
                </View>
                <Text style={styles.optionLabel}>Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentOption} onPress={handlePickDocument}>
                <View style={[styles.optionCircle, { backgroundColor: '#5f66cd' }]}>
                  <Ionicons name="document-text" size={26} color="#fff" />
                </View>
                <Text style={styles.optionLabel}>Document</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachmentOption}
                onPress={() => {
                  setShowAttachmentMenu(false);
                  Alert.alert('Payments', 'Send money via UPI');
                }}
              >
                <View style={[styles.optionCircle, { backgroundColor: '#00a884' }]}>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>₹</Text>
                </View>
                <Text style={styles.optionLabel}>Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Media / Sticker / Emoji Panel */}
      {showMediaPicker && (
        <View style={[styles.mediaPickerContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {/* Top Mode Navigation: Emoji | GIF | Sticker */}
          <View style={styles.pickerTabsRow}>
            <TouchableOpacity
              style={[styles.pickerTab, mediaPickerTab === 'emoji' && styles.pickerTabActive]}
              onPress={() => setMediaPickerTab('emoji')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="happy-outline"
                size={19}
                color={mediaPickerTab === 'emoji' ? '#25D366' : '#8696a0'}
              />
              <Text
                style={[
                  styles.pickerTabTitle,
                  mediaPickerTab === 'emoji' && styles.pickerTabTitleActive,
                ]}
              >
                Emoji
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerTab, mediaPickerTab === 'gif' && styles.pickerTabActive]}
              onPress={() => setMediaPickerTab('gif')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="film-outline"
                size={19}
                color={mediaPickerTab === 'gif' ? '#25D366' : '#8696a0'}
              />
              <Text
                style={[
                  styles.pickerTabTitle,
                  mediaPickerTab === 'gif' && styles.pickerTabTitleActive,
                ]}
              >
                GIF
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerTab, mediaPickerTab === 'sticker' && styles.pickerTabActive]}
              onPress={() => setMediaPickerTab('sticker')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="sparkles-outline"
                size={19}
                color={mediaPickerTab === 'sticker' ? '#25D366' : '#8696a0'}
              />
              <Text
                style={[
                  styles.pickerTabTitle,
                  mediaPickerTab === 'sticker' && styles.pickerTabTitleActive,
                ]}
              >
                Stickers
              </Text>
            </TouchableOpacity>
          </View>

          {/* 1. EMOJI PANEL */}
          {mediaPickerTab === 'emoji' && (
            <View style={{ flex: 1 }}>
              {/* Emoji Search & Backspace Bar */}
              <View style={styles.pickerSearchBarRow}>
                <Ionicons name="search" size={17} color="#8696a0" />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search emojis..."
                  placeholderTextColor="#8696a0"
                  value={emojiSearchQuery}
                  onChangeText={setEmojiSearchQuery}
                  autoCapitalize="none"
                />
                {emojiSearchQuery ? (
                  <TouchableOpacity onPress={() => setEmojiSearchQuery('')}>
                    <Ionicons name="close-circle" size={17} color="#8696a0" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={handleEmojiBackspace} style={{ paddingHorizontal: 4 }}>
                  <Ionicons name="backspace-outline" size={22} color="#8696a0" />
                </TouchableOpacity>
              </View>

              {/* Emoji Categories Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.emojiCategoriesBar}
                contentContainerStyle={styles.emojiCategoriesContent}
              >
                {EMOJI_TAB_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.emojiCategoryTab,
                      selectedEmojiCategory === cat.id && !emojiSearchQuery && styles.emojiCategoryTabActive,
                    ]}
                    onPress={() => {
                      setSelectedEmojiCategory(cat.id);
                      setEmojiSearchQuery('');
                    }}
                  >
                    <Text style={styles.emojiCategoryText}>{cat.icon}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Emoji Grid */}
              <FlatList
                data={filteredEmojis}
                keyExtractor={(e, idx) => `${e.emoji}-${idx}`}
                numColumns={8}
                contentContainerStyle={{ padding: 6, paddingBottom: 16 }}
                initialNumToRender={48}
                maxToRenderPerBatch={48}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.emojiItem}
                    activeOpacity={0.6}
                    onPress={() => handleSelectEmoji(item.emoji)}
                  >
                    <Text style={styles.emojiText}>{item.emoji}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.pickerEmptyState}>
                    <Text style={styles.pickerEmptyStateText}>No emojis found</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* 2. GIF PANEL */}
          {mediaPickerTab === 'gif' && (
            <View style={{ flex: 1 }}>
              {/* GIF Search Bar */}
              <View style={styles.pickerSearchBarRow}>
                <Ionicons name="search" size={17} color="#8696a0" />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search GIFs via GIPHY & Tenor..."
                  placeholderTextColor="#8696a0"
                  value={gifSearchQuery}
                  onChangeText={setGifSearchQuery}
                  autoCapitalize="none"
                />
                {isSearchingGifs ? (
                  <ActivityIndicator size="small" color="#25D366" />
                ) : gifSearchQuery ? (
                  <TouchableOpacity onPress={() => setGifSearchQuery('')}>
                    <Ionicons name="close-circle" size={17} color="#8696a0" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* GIF Categories Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.gifCategoriesBar}
                contentContainerStyle={styles.gifCategoriesContent}
              >
                {GIF_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.gifCategoryPill,
                      selectedGifCategory === cat.id && !gifSearchQuery && styles.gifCategoryPillActive,
                    ]}
                    onPress={() => {
                      setSelectedGifCategory(cat.id);
                      setGifSearchQuery('');
                    }}
                  >
                    <Text style={{ fontSize: 13 }}>{cat.icon}</Text>
                    <Text
                      style={[
                        styles.gifCategoryPillText,
                        selectedGifCategory === cat.id && !gifSearchQuery && styles.gifCategoryPillTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* GIFs Grid */}
              <FlatList
                data={gifsList}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={{ padding: 6, paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.gifGridCard}
                    activeOpacity={0.8}
                    onPress={() => handleSendGif(item.url, item.title)}
                  >
                    <GifMediaImage uri={item.url} style={styles.gifGridImage} resizeMode="cover" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.pickerEmptyState}>
                    {isSearchingGifs ? (
                      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                        <ActivityIndicator size="small" color="#25D366" />
                        <Text style={[styles.pickerEmptyStateText, { marginTop: 8 }]}>
                          {gifSearchQuery.trim() ? `Searching GIPHY & Tenor for "${gifSearchQuery}"...` : 'Loading GIFs...'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.pickerEmptyStateText}>
                        {gifSearchQuery.trim() ? `No GIFs found for "${gifSearchQuery}"` : 'No GIFs found'}
                      </Text>
                    )}
                  </View>
                }
              />
            </View>
          )}

          {/* 3. STICKER PANEL */}
          {mediaPickerTab === 'sticker' && (
            <View style={{ flex: 1 }}>
              {/* Sticker Search Bar */}
              <View style={styles.pickerSearchBarRow}>
                <Ionicons name="search" size={17} color="#8696a0" />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search stickers..."
                  placeholderTextColor="#8696a0"
                  value={stickerSearchQuery}
                  onChangeText={setStickerSearchQuery}
                  autoCapitalize="none"
                />
                {stickerSearchQuery ? (
                  <TouchableOpacity onPress={() => setStickerSearchQuery('')}>
                    <Ionicons name="close-circle" size={17} color="#8696a0" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Sticker Packs Tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.stickerPacksBar}
                contentContainerStyle={styles.stickerPacksContent}
              >
                {STICKER_PACKS.map((pack) => (
                  <TouchableOpacity
                    key={pack.id}
                    style={[
                      styles.stickerPackTab,
                      selectedStickerPack === pack.id && !stickerSearchQuery && styles.stickerPackTabActive,
                    ]}
                    onPress={() => {
                      setSelectedStickerPack(pack.id);
                      setStickerSearchQuery('');
                    }}
                  >
                    <Text style={{ fontSize: 13 }}>{pack.icon}</Text>
                    <Text
                      style={[
                        styles.stickerPackTabText,
                        selectedStickerPack === pack.id && !stickerSearchQuery && styles.stickerPackTabTextActive,
                      ]}
                    >
                      {pack.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Stickers Grid with SvgXml vector rendering */}
              <FlatList
                data={activeStickerPackData}
                keyExtractor={(s) => s.id}
                numColumns={4}
                contentContainerStyle={{ padding: 6, paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stickerGridCard}
                    activeOpacity={0.7}
                    onPress={() => handleSendSticker(item.url, item.name)}
                  >
                    <StickerView uri={item.url} size={66} />
                    <Text style={styles.stickerCardName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.pickerEmptyState}>
                    <Text style={styles.pickerEmptyStateText}>No stickers found</Text>
                  </View>
                }
              />
            </View>
          )}
        </View>
      )}

      {/* Attachment Preview Modal */}
      {pendingFile && (
        <Modal visible transparent animationType="slide">
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <TouchableOpacity onPress={() => setPendingFile(null)}>
                <Ionicons name="close" size={26} color="#e9edef" />
              </TouchableOpacity>
              <Text style={styles.previewHeaderTitle}>{pendingFile.name}</Text>
              <View style={{ width: 26 }} />
            </View>

            <View style={styles.previewImageBox}>
              <Image source={{ uri: pendingFile.uri }} style={styles.previewImage} resizeMode="contain" />
            </View>

            <View style={styles.previewBottomBar}>
              <TextInput
                style={styles.previewCaptionInput}
                placeholder="Add a caption..."
                placeholderTextColor="#8696a0"
                value={pendingCaption}
                onChangeText={setPendingCaption}
              />
              <TouchableOpacity
                style={styles.previewSendCircle}
                onPress={handleConfirmSendAttachment}
                disabled={uploadingFile}
              >
                {uploadingFile ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Ionicons name="send" size={20} color="#000" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Fullscreen Calling Interface */}
      {activeCall && (
        <Modal visible animationType="slide">
          <View style={styles.callingOverlay}>
            {/* Top Bar with Security Badge & Contact Name */}
            <View style={styles.callingTopHeader}>
              <View style={styles.e2eePill}>
                <Ionicons name="lock-closed" size={13} color="#25D366" />
                <Text style={styles.e2eePillText}>End-to-end encrypted</Text>
              </View>
              <Text style={styles.callingTargetName}>{activeCall.targetName}</Text>
              <Text style={styles.callingStatusText}>
                {activeCall.status === 'calling'
                  ? 'Calling...'
                  : `${activeCall.isVideo ? 'Video' : 'Voice'} Call • ${formatDuration(activeCall.duration)}`}
              </Text>
            </View>

            {/* Video Call Body vs Voice Call Body */}
            {activeCall.isVideo ? (
              <View style={styles.videoStreamContainer}>
                {/* Remote Video Stream Simulation */}
                <View style={styles.remoteVideoCanvas}>
                  {!isVideoMuted ? (
                    <View style={styles.remoteVideoActiveFeed}>
                      <View style={styles.callingAvatarLarge}>
                        <Text style={styles.callingAvatarInitials}>
                          {activeCall.targetName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.remoteVideoActiveLabel}>
                        {activeCall.status === 'connected' ? 'Live Video Connected' : 'Connecting Video...'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.videoOffPlaceholder}>
                      <Ionicons name="videocam-off" size={48} color="#8696a0" />
                      <Text style={{ color: '#8696a0', marginTop: 8, fontSize: 14 }}>Video Paused</Text>
                    </View>
                  )}
                </View>

                {/* Self Picture-in-Picture Preview Window */}
                <View style={styles.selfPipWindow}>
                  <View style={styles.pipInner}>
                    <Ionicons name="person" size={26} color="#53bdeb" />
                    <Text style={styles.pipText}>You</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pipFlipBtn}
                    onPress={() => setIsFrontCamera((prev) => !prev)}
                  >
                    <Ionicons name="camera-reverse" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Voice Call Concentric Waveform Avatar */
              <View style={styles.voiceCallCenter}>
                <View style={styles.callPulseOuter}>
                  <View style={styles.callPulseMiddle}>
                    <View style={styles.callingAvatar}>
                      <Text style={styles.callingAvatarText}>
                        {activeCall.targetName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Floating Glassmorphism Controls Dock */}
            <View style={styles.callingControlsDock}>
              {/* Speaker Toggle */}
              <TouchableOpacity
                style={[styles.callCtrlBtn, isSpeakerOn && styles.callCtrlBtnActive]}
                onPress={() => setIsSpeakerOn((prev) => !prev)}
              >
                <Ionicons
                  name={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'}
                  size={24}
                  color={isSpeakerOn ? '#000' : '#fff'}
                />
              </TouchableOpacity>

              {/* Video Toggle / Upgrade to Video */}
              <TouchableOpacity
                style={[
                  styles.callCtrlBtn,
                  activeCall.isVideo && !isVideoMuted && styles.callCtrlBtnActive,
                ]}
                onPress={() => {
                  if (activeCall.isVideo) {
                    setIsVideoMuted((prev) => !prev);
                  } else {
                    setActiveCall((prev) => (prev ? { ...prev, isVideo: true } : null));
                  }
                }}
              >
                <Ionicons
                  name={
                    activeCall.isVideo
                      ? isVideoMuted
                        ? 'videocam-off'
                        : 'videocam'
                      : 'videocam-outline'
                  }
                  size={24}
                  color={activeCall.isVideo && !isVideoMuted ? '#000' : '#fff'}
                />
              </TouchableOpacity>

              {/* Mic Mute Toggle */}
              <TouchableOpacity
                style={[styles.callCtrlBtn, activeCall.isMuted && styles.callCtrlBtnMuted]}
                onPress={() => setActiveCall((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null))}
              >
                <Ionicons
                  name={activeCall.isMuted ? 'mic-off' : 'mic'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              {/* End Call Button */}
              <TouchableOpacity style={styles.hangupCircleBtn} onPress={handleHangupCall}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Incoming Call Modal in chat screen */}
      {incomingCall && (
        <Modal visible transparent animationType="slide">
          <View style={styles.incomingModalOverlay}>
            <View style={styles.incomingModalCard}>
              <View style={styles.incomingModalAvatarCircle}>
                <Ionicons
                  name={incomingCall.isVideo ? 'videocam' : 'call'}
                  size={32}
                  color="#25D366"
                />
              </View>
              <Text style={styles.incomingModalCallerName}>{incomingCall.callerName}</Text>
              <Text style={styles.incomingModalCallType}>
                WhatsApp {incomingCall.isVideo ? 'Video' : 'Voice'} Call...
              </Text>

              <View style={styles.incomingModalButtonsRow}>
                <TouchableOpacity
                  style={[styles.incomingCircleBtn, styles.incomingDeclineBtn]}
                  onPress={handleDeclineIncomingCall}
                >
                  <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.incomingBtnLabel}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.incomingCircleBtn, styles.incomingAcceptBtn]}
                  onPress={handleAcceptIncomingCall}
                >
                  <Ionicons name="call" size={24} color="#fff" />
                  <Text style={styles.incomingBtnLabel}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Lightbox Media Modal for GIFs & Photos */}
      {lightboxMedia && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxMedia(null)}>
          <View style={styles.lightboxOverlay}>
            <View style={[styles.lightboxHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity style={styles.lightboxCloseBtn} onPress={() => setLightboxMedia(null)}>
                <Ionicons name="close" size={28} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.lightboxTitle} numberOfLines={1}>{lightboxMedia.title || 'Media'}</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.lightboxMediaBox}>
              <Image source={{ uri: lightboxMedia.url }} style={styles.lightboxImage} resizeMode="contain" />
            </View>
            {lightboxMedia.caption ? (
              <View style={[styles.lightboxCaptionBox, { paddingBottom: insets.bottom + 12 }]}>
                <Text style={styles.lightboxCaptionText}>{lightboxMedia.caption}</Text>
              </View>
            ) : null}
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f13',
  },
  topHeader: {
    height: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  headerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 4,
  },
  contactHeaderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  contactHeaderAvatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  onlineIndicatorDotSmall: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
  },
  contactHeaderMeta: {
    flex: 1,
    minWidth: 0,
  },
  contactHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  contactHeaderSubtitle: {
    fontSize: 10.5,
    color: '#10b981',
    fontWeight: '500',
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
  },
  backBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarBox: {
    position: 'relative',
    marginRight: 10,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  clockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0a0f13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContactName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  callCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 16,
  },
  callIconBtn: {
    padding: 2,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContent: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 6,
  },
  dateSeparatorWrap: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorPill: {
    backgroundColor: '#182229',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  dateSeparatorText: {
    color: '#8696a0',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  callBubbleCard: {
    minWidth: 205,
    maxWidth: 250,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  callBubbleOutgoing: {
    backgroundColor: '#005c4b',
    borderTopRightRadius: 2,
  },
  callBubbleIncoming: {
    backgroundColor: '#1f2c34',
    borderTopLeftRadius: 2,
  },
  callBubbleMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callBubbleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    position: 'relative',
  },
  callBubbleIconCircleOut: {
    backgroundColor: '#004d40',
  },
  callBubbleIconCircleIn: {
    backgroundColor: '#182229',
  },
  callBubbleArrowBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBubbleArrowBadgeOut: {
    backgroundColor: '#00332c',
  },
  callBubbleArrowBadgeIn: {
    backgroundColor: '#111b21',
  },
  callBubbleInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  callBubbleTitle: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  callBubbleSubtitle: {
    fontSize: 13,
  },
  callBubbleSubtitleOut: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  callBubbleSubtitleIn: {
    color: '#8696a0',
  },
  callBubbleTimeCol: {
    alignSelf: 'flex-end',
    marginLeft: 8,
  },
  callBubbleTimeText: {
    fontSize: 11,
  },
  callBubbleTimeTextOut: {
    color: 'rgba(255, 255, 255, 0.65)',
  },
  callBubbleTimeTextIn: {
    color: 'rgba(233, 237, 239, 0.6)',
  },
  bubbleWrapper: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  outgoingWrapper: {
    justifyContent: 'flex-end',
  },
  incomingWrapper: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    position: 'relative',
  },
  outgoingBubble: {
    borderTopRightRadius: 4,
  },
  incomingBubble: {
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  replyPreviewCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#f43f5e',
  },
  replyAccentBar: {
    width: 0,
  },
  replyContent: {
    flex: 1,
    paddingLeft: 6,
  },
  replyAuthor: {
    color: '#f43f5e',
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  replySnippet: {
    color: '#94a3b8',
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    color: 'rgba(233, 237, 239, 0.65)',
    fontSize: 11,
  },
  imageBubble: {
    width: 240,
    height: 190,
    borderRadius: 8,
  },
  stickerBubble: {
    width: 140,
    height: 140,
  },
  bigEmojiText: {
    fontSize: 38,
    lineHeight: 46,
    paddingVertical: 4,
  },
  stickerBubbleContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
  },
  framelessBubbleContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    borderRadius: 0,
  },
  stickerBubbleWrap: {
    padding: 2,
  },
  gifBubbleWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gifBubble: {
    width: 230,
    height: 180,
    borderRadius: 12,
  },
  imageBubbleWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 4,
  },
  framelessMetaRow: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
  },
  framelessTimeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  stickerMetaRow: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stickerTimeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  capsuleEmojiBtn: {
    paddingRight: 8,
    paddingLeft: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerWrapper: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  floatingComposerCapsule: {
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  composerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerTextInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 6,
    paddingHorizontal: 4,
    maxHeight: 100,
  },
  rupeeGlyph: {
    fontSize: 17,
    fontWeight: '700',
  },
  composerSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  attachmentSheet: {
    backgroundColor: '#1f2428',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  attachmentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  attachmentOption: {
    alignItems: 'center',
  },
  optionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    color: '#e9edef',
    fontSize: 12,
    fontWeight: '500',
  },
  mediaPickerContainer: {
    height: 360,
    backgroundColor: '#161a1d',
    borderTopWidth: 1,
    borderTopColor: '#2b3036',
  },
  pickerTabsRow: {
    flexDirection: 'row',
    height: 46,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3036',
    backgroundColor: '#121517',
  },
  pickerTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
  },
  pickerTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#25D366',
  },
  pickerTabTitle: {
    color: '#8696a0',
    fontSize: 13.5,
    fontWeight: '600',
  },
  pickerTabTitleActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  pickerSearchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2428',
    marginHorizontal: 10,
    marginVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 38,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2b3036',
  },
  pickerSearchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 0,
  },
  emojiCategoriesBar: {
    height: 44,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3036',
    backgroundColor: '#161a1d',
  },
  emojiCategoriesContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    height: 44,
  },
  emojiCategoryTab: {
    height: 36,
    paddingHorizontal: 10,
    marginHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  emojiCategoryTabActive: {
    backgroundColor: '#2a3138',
    borderBottomWidth: 2,
    borderBottomColor: '#25D366',
  },
  emojiCategoryText: {
    fontSize: 20,
    lineHeight: 24,
  },
  emojiItem: {
    width: SCREEN_WIDTH / 8,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 28,
  },
  gifCategoriesBar: {
    height: 48,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3036',
    backgroundColor: '#161a1d',
  },
  gifCategoriesContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    height: 48,
  },
  gifCategoryPill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#20272c',
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#2b3036',
  },
  gifCategoryPillActive: {
    backgroundColor: '#00a884',
    borderColor: '#25D366',
  },
  gifCategoryPillText: {
    color: '#8696a0',
    fontSize: 12,
    fontWeight: '600',
  },
  gifCategoryPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  gifGridCard: {
    flex: 1,
    margin: 4,
    height: 110,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2a3138',
  },
  gifGridImage: {
    width: '100%',
    height: '100%',
  },
  gifCardFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  gifCardTitle: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '500',
  },
  stickerPacksBar: {
    height: 50,
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3036',
    backgroundColor: '#161a1d',
  },
  stickerPacksContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
    height: 50,
  },
  stickerPackTab: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: '#20272c',
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#2b3036',
  },
  stickerPackTabActive: {
    backgroundColor: '#00a884',
    borderColor: '#25D366',
  },
  stickerPackTabText: {
    color: '#8696a0',
    fontSize: 12,
    fontWeight: '600',
  },
  stickerPackTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  stickerGridCard: {
    flex: 1 / 4,
    aspectRatio: 1,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerCardName: {
    color: '#8696a0',
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  pickerEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  pickerEmptyStateText: {
    color: '#8696a0',
    fontSize: 14,
    marginTop: 8,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  lightboxHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  lightboxMediaBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  lightboxCaptionBox: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lightboxCaptionText: {
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#0a0f13',
  },
  previewHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  previewHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewImageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1f2428',
    gap: 8,
  },
  previewCaptionInput: {
    flex: 1,
    backgroundColor: '#2a3138',
    color: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  previewSendCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callingOverlay: {
    flex: 1,
    backgroundColor: '#0b141a',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  callingTopHeader: {
    alignItems: 'center',
    width: '100%',
  },
  e2eePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(31, 36, 40, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 16,
  },
  e2eePillText: {
    color: '#8696a0',
    fontSize: 12,
  },
  callingTargetName: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  callingStatusText: {
    color: '#25D366',
    fontSize: 15,
    fontWeight: '500',
  },
  videoStreamContainer: {
    flex: 1,
    width: '100%',
    marginVertical: 20,
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
  },
  remoteVideoCanvas: {
    flex: 1,
    backgroundColor: '#111b21',
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  remoteVideoActiveFeed: {
    width: '100%',
    height: '100%',
    backgroundColor: '#182229',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoScanlineEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 168, 132, 0.04)',
  },
  callingAvatarLarge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#202c33',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00a884',
    marginBottom: 14,
  },
  callingAvatarInitials: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '700',
  },
  remoteVideoActiveLabel: {
    color: '#8696a0',
    fontSize: 13,
  },
  videoOffPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfPipWindow: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 96,
    height: 128,
    borderRadius: 12,
    backgroundColor: '#202c33',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  pipInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipText: {
    color: '#8696a0',
    fontSize: 11,
    marginTop: 4,
  },
  pipFlipBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
  },
  voiceCallCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callPulseOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callPulseMiddle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(37, 211, 102, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callingAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#202c33',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#25D366',
  },
  callingAvatarText: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '700',
  },
  callingControlsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#1f2428',
    borderRadius: 36,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  callCtrlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2a3942',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callCtrlBtnActive: {
    backgroundColor: '#25D366',
  },
  callCtrlBtnMuted: {
    backgroundColor: '#f15c6d',
  },
  hangupCircleBtn: {
    backgroundColor: '#f15c6d',
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  incomingModalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1f2428',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  incomingModalAvatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2a3942',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#25D366',
  },
  incomingModalCallerName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  incomingModalCallType: {
    color: '#8696a0',
    fontSize: 14,
    marginBottom: 24,
  },
  incomingModalButtonsRow: {
    flexDirection: 'row',
    gap: 36,
    alignItems: 'center',
  },
  incomingCircleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingDeclineBtn: {
    backgroundColor: '#f15c6d',
  },
  incomingAcceptBtn: {
    backgroundColor: '#25D366',
  },
  incomingBtnLabel: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    position: 'absolute',
    bottom: -20,
  },
  emptyMessagesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  e2eeBanner: {
    backgroundColor: '#1f2428',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
    maxWidth: '90%',
  },
  e2eeBannerText: {
    color: '#8696a0',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyMessagesSubtitle: {
    color: '#8696a0',
    fontSize: 14,
  },
});
