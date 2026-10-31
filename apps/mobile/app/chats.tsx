import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Conversation, Message, MessageReceipt } from '@chat/shared-types';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { storage, STORAGE_KEYS } from '../services/storage';
import { formatCallTimeAge } from '../utils/timeAgo';
import { callHistoryService, CallHistoryItem } from '../services/callHistory';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { LiquidGlassSurface } from '../components/LiquidGlassSurface';
import { CompactSearchField } from '../components/CompactSearchField';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'all' | 'unread' | 'favourites' | 'groups';
type BottomTabType = 'updates' | 'calls' | 'communities' | 'chats' | 'you';

interface ChatItemData {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string;
  avatarBg: string;
  avatarInitials?: string;
  isOnline?: boolean;
  avatarIcon?: string;
  avatarLetter?: string;
  hasTimerBadge?: boolean;
  timeStr: string;
  isUnreadTime?: boolean;
  unreadCount?: number;
  snippet: string;
  hasCallIcon?: boolean;
  hasCheckIcon?: boolean;
  hasCameraIcon?: boolean;
  hasVideoIcon?: boolean;
  hasDocIcon?: boolean;
  rawConversation?: Conversation;
}

export type { CallHistoryItem };

const PREVIEW_AVATAR_PALETTE = [
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#00a884', // Teal
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
];

function getDeterministicAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PREVIEW_AVATAR_PALETTE.length;
  return PREVIEW_AVATAR_PALETTE[idx];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return 'C';
}

// Meta AI 8-petal glowing swirl
const META_AI_SWIRL_COLORS = [
  '#8b5cf6', // 0 deg - violet
  '#d946ef', // 45 deg - magenta
  '#ec4899', // 90 deg - pink
  '#f43f5e', // 135 deg - rose
  '#a855f7', // 180 deg - purple
  '#6366f1', // 225 deg - indigo
  '#06b6d4', // 270 deg - cyan
  '#3b82f6', // 315 deg - electric blue
];

function MetaAiSwirlIcon() {
  return (
    <View style={styles.metaAiSwirlWrap}>
      {META_AI_SWIRL_COLORS.map((color, idx) => (
        <View
          key={idx}
          style={[
            styles.metaAiPetal,
            {
              backgroundColor: color,
              transform: [
                { rotate: `${idx * 45}deg` },
                { translateY: -8 },
              ],
            },
          ]}
        />
      ))}
      <View style={styles.metaAiCoreHole} />
    </View>
  );
}

function getSnippetInfo(msg?: any): {
  snippet: string;
  hasCameraIcon?: boolean;
  hasVideoIcon?: boolean;
  hasDocIcon?: boolean;
} {
  if (!msg) return { snippet: 'No messages yet' };

  if (msg.type === 'STICKER') {
    return { snippet: '🏷️ Sticker' };
  }

  let parsed: any = null;
  if (typeof msg.content === 'string' && (msg.content.startsWith('{') || msg.content.startsWith('['))) {
    try {
      parsed = JSON.parse(msg.content);
    } catch {
      // not json
    }
  }

  if (parsed?.isSticker || parsed?.fileType === 'STICKER') {
    return { snippet: '🏷️ Sticker' };
  }

  if (
    parsed?.isGif ||
    parsed?.fileType === 'GIF' ||
    parsed?.fileName?.toLowerCase().endsWith('.gif') ||
    parsed?.fileUrl?.toLowerCase().includes('.gif') ||
    (typeof msg.content === 'string' && (msg.content.includes('.gif') || msg.content.includes('giphy') || msg.content.includes('tenor')))
  ) {
    return { snippet: '🎞️ GIF' };
  }

  if (msg.type === 'IMAGE' || parsed?.fileType === 'IMAGE') {
    const caption = parsed?.caption;
    return {
      snippet: caption ? `📷 ${caption}` : '📷 Photo',
    };
  }

  if (msg.type === 'VIDEO' || parsed?.fileType === 'VIDEO') {
    const caption = parsed?.caption;
    return {
      snippet: caption ? `🎥 ${caption}` : '🎥 Video',
    };
  }

  if (msg.type === 'AUDIO' || parsed?.fileType === 'AUDIO') {
    return { snippet: '🎵 Audio' };
  }

  if (msg.type === 'DOCUMENT' || parsed?.fileType === 'DOCUMENT') {
    const fileName = parsed?.fileName || 'Document';
    return {
      snippet: `📄 ${fileName}`,
    };
  }

  if (
    typeof msg.content === 'string' &&
    (msg.content.startsWith('data:image/svg+xml') ||
      msg.content.startsWith('<svg') ||
      msg.content.toLowerCase().endsWith('.svg'))
  ) {
    return { snippet: '🏷️ Sticker' };
  }

  return { snippet: msg.content || 'No messages yet' };
}

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { palette, metrics, isDark } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const callsScrollY = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeTab, setActiveTab] = useState<BottomTabType>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (params.tab && ['updates', 'calls', 'communities', 'chats', 'you'].includes(params.tab)) {
      setActiveTab(params.tab as BottomTabType);
    }
  }, [params.tab]);

  // Calls Tab State
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [isCallsScrolledDown, setIsCallsScrolledDown] = useState(false);
  const [callsSearchQuery, setCallsSearchQuery] = useState('');
  const [selectedCallDetails, setSelectedCallDetails] = useState<CallHistoryItem | null>(null);
  const [showKeypadModal, setShowKeypadModal] = useState(false);
  const [keypadNumber, setKeypadNumber] = useState('');
  const [showNewCallModal, setShowNewCallModal] = useState(false);

  // Top popup menu state (...)
  const [showTopMenu, setShowTopMenu] = useState(false);

  // Payments modal
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);

  // New Chat Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  // Meta AI modal state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponses, setAiResponses] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: 'Hi! I’m IndiChat Meta AI. Ask me anything, plan ideas, or write messages.' },
  ]);
  const [aiThinking, setAiThinking] = useState(false);

  // Incoming Call state
  const [incomingCall, setIncomingCall] = useState<{
    senderUserId: string;
    callerName: string;
    isVideo: boolean;
  } | null>(null);

  // Helper to record a call in callHistory & storage
  const recordCall = useCallback((contactName: string, isVideo: boolean, subtitle?: string, type: 'incoming' | 'outgoing' | 'missed' = 'outgoing', conversationId?: string) => {
    callHistoryService.addCall({
      conversationId,
      contactName,
      isVideo,
      type,
      subtitle,
      duration: subtitle || (type === 'missed' ? 'Missed' : 'Ongoing'),
    });
  }, []);

  // Helper to initiate a call with a contact
  const navigateToCall = useCallback(
    (contactName: string, isVideo: boolean, subtitle?: string) => {
      const matchingConv = conversations.find((c) => {
        const other = c.members?.find((m) => m.userId !== currentUser?.id);
        const otherName = other?.user?.displayName || other?.user?.username || c.title;
        return (
          otherName?.toLowerCase() === contactName.toLowerCase() ||
          c.title?.toLowerCase() === contactName.toLowerCase()
        );
      });

      recordCall(contactName, isVideo, subtitle, 'outgoing', matchingConv?.id);

      if (matchingConv) {
        const other = matchingConv.members?.find((m) => m.userId !== currentUser?.id);
        const targetUserId = other?.userId || other?.user?.id || '';
        router.push(
          `/chat/${matchingConv.id}?name=${encodeURIComponent(contactName)}&targetUserId=${targetUserId}&autoCall=${isVideo ? 'video' : 'voice'}`
        );
      } else if (conversations.length > 0) {
        const firstConv = conversations[0];
        const other = firstConv.members?.find((m) => m.userId !== currentUser?.id);
        const targetUserId = other?.userId || other?.user?.id || '';
        router.push(
          `/chat/${firstConv.id}?name=${encodeURIComponent(contactName)}&targetUserId=${targetUserId}&autoCall=${isVideo ? 'video' : 'voice'}`
        );
      } else {
        Alert.alert('No Contacts Available', 'Start a conversation with a user first before calling.');
      }
    },
    [conversations, currentUser?.id, recordCall, router]
  );

  // Load conversations and call history from backend / storage
  const loadData = useCallback(async () => {
    try {
      const user = await storage.getJson<User>(STORAGE_KEYS.CURRENT_USER);
      if (user) {
        setCurrentUser(user);
      }
      const token = await storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token && !wsClient.isConnected()) {
        wsClient.connect(token);
      }
      const list = await api.getConversations();
      if (list) {
        setConversations(list);
      }
      const savedCalls = await callHistoryService.getHistory();
      if (savedCalls) {
        setCallHistory(savedCalls);
      }
    } catch (e: any) {
      console.warn('Backend conversations load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubHistory = callHistoryService.onHistoryChange((calls) => {
      setCallHistory(calls);
    });
    return () => unsubHistory();
  }, [loadData]);

  // Keep call timeage labels updated live every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCallHistory((prev) => [...prev]);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Refresh conversations and unread counts whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // WebSocket event listeners
  useEffect(() => {
    const unsubMsg = wsClient.onMessageCreated((msg: Message) => {
      // If message is incoming to current user, acknowledge delivery immediately!
      if (currentUser && msg.senderId !== currentUser.id) {
        wsClient.markDelivered(msg.id, msg.conversationId);
      }

      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === msg.conversationId);
        if (existingIdx >= 0) {
          const updated = {
            ...prev[existingIdx],
            lastMessage: msg,
            updatedAt: msg.createdAt,
            unreadCount: (prev[existingIdx].unreadCount || 0) + (msg.senderId !== currentUser?.id ? 1 : 0),
          };
          const next = [...prev];
          next.splice(existingIdx, 1);
          return [updated, ...next];
        } else {
          loadData();
          return prev;
        }
      });
    });

    const unsubReceipt = wsClient.onReceiptUpdated((receipt: MessageReceipt) => {
      setConversations((prev) =>
        prev.map((c) => {
          let updatedConv = c;
          if (c.lastMessage && c.lastMessage.id === receipt.messageId) {
            const receipts = c.lastMessage.receipts ? [...c.lastMessage.receipts] : [];
            const idx = receipts.findIndex((r) => r.userId === receipt.userId);
            if (idx >= 0) receipts[idx] = receipt;
            else receipts.push(receipt);
            const isRead = receipts.some((r) => r.readAt != null);
            const isDelivered = receipts.some((r) => r.deliveredAt != null);
            updatedConv = {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                receipts,
                status: isRead ? 'read' : isDelivered ? 'delivered' : c.lastMessage.status,
              },
            };
          }
          // If this user has read the message, clear unread count for conversation
          if (receipt.readAt && currentUser && receipt.userId === currentUser.id) {
            updatedConv = { ...updatedConv, unreadCount: 0 };
          }
          return updatedConv;
        })
      );
    });

    const unsubCall = wsClient.onCallSignal((signal) => {
      if (signal.signalType === 'offer' && signal.senderUserId) {
        const caller = conversations
          .flatMap((c) => c.members || [])
          .find((m) => m.userId === signal.senderUserId)?.user;

        setIncomingCall({
          senderUserId: signal.senderUserId,
          callerName: caller?.displayName || caller?.username || 'Incoming Caller',
          isVideo: Boolean((signal.data as any)?.isVideo),
        });
      } else if (signal.signalType === 'hangup') {
        setIncomingCall(null);
      }
    });

    return () => {
      unsubMsg();
      unsubReceipt();
      unsubCall();
    };
  }, [currentUser, conversations, loadData]);

  // Handle Search Users for New Chat
  useEffect(() => {
    if (!showNewChatModal) return;
    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const users = await api.searchUsers(searchUserQuery);
        setSearchedUsers(users.filter((u) => u.id !== currentUser?.id));
      } catch (err) {
        console.warn('Search users error:', err);
      } finally {
        setSearchingUsers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchUserQuery, showNewChatModal, currentUser]);

  const handleStartDirectChat = async (targetUser: User) => {
    setCreatingChat(true);
    try {
      const conv = await api.createConversation({
        type: 'DIRECT',
        participantIds: [targetUser.id],
      });
      setShowNewChatModal(false);
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      router.push(`/chat/${conv.id}?name=${encodeURIComponent(targetUser.displayName || targetUser.username)}&type=DIRECT&targetUserId=${targetUser.id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start chat');
    } finally {
      setCreatingChat(false);
    }
  };

  const handleCreateGroupChat = async () => {
    if (!groupTitle.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for the group.');
      return;
    }
    if (selectedUserIds.length === 0) {
      Alert.alert('Select Members', 'Select at least one member for the group.');
      return;
    }

    setCreatingChat(true);
    try {
      const conv = await api.createConversation({
        type: 'GROUP',
        title: groupTitle.trim(),
        participantIds: selectedUserIds,
      });
      setShowNewChatModal(false);
      setGroupTitle('');
      setSelectedUserIds([]);
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      router.push(`/chat/${conv.id}?name=${encodeURIComponent(conv.title || 'Group')}&type=GROUP`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create group');
    } finally {
      setCreatingChat(false);
    }
  };

  // Quick camera launch
  const handleLaunchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required.');
      return;
    }
    await ImagePicker.launchCameraAsync({ quality: 0.8 });
  };

  // Meta AI send prompt
  const handleSendAiPrompt = () => {
    if (!aiPrompt.trim()) return;
    const userText = aiPrompt.trim();
    setAiResponses((prev) => [...prev, { sender: 'user', text: userText }]);
    setAiPrompt('');
    setAiThinking(true);

    setTimeout(() => {
      let reply = 'I’m Meta AI on IndiChat! I can assist with message summaries, calculations, local searches, and conversation ideas.';
      if (userText.toLowerCase().includes('weather')) {
        reply = 'Pune weather is sunny and pleasant at 27°C with light wind.';
      } else if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('hi')) {
        reply = 'Hi! How can I help you today?';
      }
      setAiResponses((prev) => [...prev, { sender: 'ai', text: reply }]);
      setAiThinking(false);
    }, 700);
  };

  // Handle Scroll to toggle inline "Chats" title in top bar
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y > 32 && !isScrolledDown) {
      setIsScrolledDown(true);
    } else if (y <= 32 && isScrolledDown) {
      setIsScrolledDown(false);
    }
  };

  // Native-driven smooth opacity fade for sticky "Chats" title
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [20, 48],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerTitleTranslateY = scrollY.interpolate({
    inputRange: [20, 48],
    outputRange: [4, 0],
    extrapolate: 'clamp',
  });

  // Handle Calls scroll
  const handleCallsScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y > 32 && !isCallsScrolledDown) {
      setIsCallsScrolledDown(true);
    } else if (y <= 32 && isCallsScrolledDown) {
      setIsCallsScrolledDown(false);
    }
  };

  const callsHeaderTitleOpacity = callsScrollY.interpolate({
    inputRange: [20, 48],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const callsHeaderTitleTranslateY = callsScrollY.interpolate({
    inputRange: [20, 48],
    outputRange: [4, 0],
    extrapolate: 'clamp',
  });

  // Filtered Calls list
  // Filtered Calls list
  // Filtered Calls list
  const displayCallsList = useMemo(() => {
    if (!callsSearchQuery.trim()) return callHistory;
    const q = callsSearchQuery.toLowerCase();
    return callHistory.filter(
      (c) =>
        c.contactName.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.timeStr.toLowerCase().includes(q)
    );
  }, [callsSearchQuery, callHistory]);

  // Real backend conversations list
  const displayChatsList = useMemo(() => {
    let list: ChatItemData[] = [];

    // 1. Add any live conversations from backend
    if (conversations && conversations.length > 0) {
      conversations.forEach((c) => {
        const otherMember = c.members?.find((m) => m.userId !== currentUser?.id);
        const title =
          c.type === 'GROUP' && c.title
            ? c.title
            : otherMember?.user?.displayName ||
              otherMember?.user?.username ||
              c.title ||
              'Chat';
        const isUnread = (c.unreadCount || 0) > 0;

        let timeStr = 'Recently';
        if (c.lastMessage?.createdAt || c.updatedAt) {
          const date = new Date(c.lastMessage?.createdAt || c.updatedAt);
          const now = new Date();
          const isToday = date.toDateString() === now.toDateString();
          timeStr = isToday
            ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }

        const snippetInfo = getSnippetInfo(c.lastMessage);
        const otherUser = otherMember?.user;
        const isOnline = otherUser?.isOnline ?? false;
        const avatarBg = getDeterministicAvatarColor(title || c.id);
        const avatarInitials = c.type === 'GROUP' ? '' : getInitials(title);

        list.push({
          id: c.id,
          type: c.type,
          title,
          avatarBg,
          avatarInitials,
          isOnline,
          hasTimerBadge: false,
          timeStr,
          isUnreadTime: isUnread,
          unreadCount: c.unreadCount || 0,
          snippet: snippetInfo.snippet,
          hasCameraIcon: snippetInfo.hasCameraIcon,
          hasVideoIcon: snippetInfo.hasVideoIcon,
          hasDocIcon: snippetInfo.hasDocIcon,
          rawConversation: c,
        });
      });
    }

    // 2. Filter by Tab
    if (activeFilter === 'unread') {
      list = list.filter((item) => (item.unreadCount || 0) > 0);
    } else if (activeFilter === 'groups') {
      list = list.filter((item) => item.type === 'GROUP');
    }

    // 3. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) => item.title.toLowerCase().includes(q) || item.snippet.toLowerCase().includes(q)
      );
    }

    return list;
  }, [conversations, activeFilter, searchQuery, currentUser]);

  // Total unread count dynamically computed
  const totalUnreadCount = useMemo(() => {
    return displayChatsList.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  }, [displayChatsList]);

  // Count of unread conversations for the filter chip
  const unreadChatsCount = useMemo(() => {
    return displayChatsList.filter((c) => (c.unreadCount || 0) > 0).length;
  }, [displayChatsList]);

  // List Header Component containing Search Bar, Filter Chips, and Bento Section Title
  const renderListHeader = () => (
    <View style={styles.listHeaderWrapper}>
      {/* Compact Search Field matching preview */}
      <CompactSearchField
        ref={searchInputRef}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search conversations..."
        style={{ marginBottom: 6 }}
      />

      {/* Filter Chips: [ All ] [ Unread (n) ] [ Favourites ] [ Groups ] */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipsContainer}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: activeFilter === 'all' ? 'rgba(16, 185, 129, 0.18)' : palette.surfaceInput,
              borderColor: activeFilter === 'all' ? 'rgba(16, 185, 129, 0.4)' : palette.border,
            },
          ]}
          onPress={() => setActiveFilter('all')}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: activeFilter === 'all' ? '#10b981' : palette.textSecondary, fontWeight: activeFilter === 'all' ? '700' : '500' },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: activeFilter === 'unread' ? 'rgba(16, 185, 129, 0.18)' : palette.surfaceInput,
              borderColor: activeFilter === 'unread' ? 'rgba(16, 185, 129, 0.4)' : palette.border,
            },
          ]}
          onPress={() => setActiveFilter('unread')}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: activeFilter === 'unread' ? '#10b981' : palette.textSecondary, fontWeight: activeFilter === 'unread' ? '700' : '500' },
            ]}
          >
            {unreadChatsCount > 0 ? `Unread ${unreadChatsCount}` : 'Unread'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: activeFilter === 'favourites' ? 'rgba(16, 185, 129, 0.18)' : palette.surfaceInput,
              borderColor: activeFilter === 'favourites' ? 'rgba(16, 185, 129, 0.4)' : palette.border,
            },
          ]}
          onPress={() => setActiveFilter('favourites')}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: activeFilter === 'favourites' ? '#10b981' : palette.textSecondary, fontWeight: activeFilter === 'favourites' ? '700' : '500' },
            ]}
          >
            Favourites
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: activeFilter === 'groups' ? 'rgba(16, 185, 129, 0.18)' : palette.surfaceInput,
              borderColor: activeFilter === 'groups' ? 'rgba(16, 185, 129, 0.4)' : palette.border,
            },
          ]}
          onPress={() => setActiveFilter('groups')}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: activeFilter === 'groups' ? '#10b981' : palette.textSecondary, fontWeight: activeFilter === 'groups' ? '700' : '500' },
            ]}
          >
            Groups
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bento Section Title */}
      <Text style={[styles.bentoSectionTitle, { color: palette.textSecondary }]}>Recent Conversations</Text>
    </View>
  );

  const renderChatRow = ({ item }: { item: ChatItemData }) => {
    const isUnread = (item.unreadCount || 0) > 0;

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={() => {
          setConversations((prev) =>
            prev.map((c) => (c.id === item.id ? { ...c, unreadCount: 0 } : c))
          );
          const other = item.rawConversation?.members?.find((m) => m.userId !== currentUser?.id);
          const targetUserId = other?.userId || other?.user?.id || '';
          router.push(
            `/chat/${item.id}?name=${encodeURIComponent(item.title)}&type=${item.type}&targetUserId=${targetUserId}&unread=${item.unreadCount || 0}`
          );
        }}
      >
        {/* Avatar: 46x46 squircle (16px radius) matching preview */}
        <View style={styles.avatarWrapper}>
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: item.avatarBg },
            ]}
          >
            {item.type === 'GROUP' ? (
              <Ionicons name="people" size={22} color="#ffffff" />
            ) : (
              <Text style={styles.avatarLetterText}>
                {item.avatarInitials || item.title.slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          {item.isOnline && (
            <View style={[styles.onlineIndicatorDot, { borderColor: palette.bg }]} />
          )}
          {item.hasTimerBadge && (
            <View style={styles.disappearingTimerBadge}>
              <Ionicons name="time-outline" size={11} color="#e9edef" />
            </View>
          )}
        </View>

        {/* Chat Content */}
        <View style={styles.chatTextContainer}>
          <View style={styles.nameTimeRow}>
            <Text style={[styles.contactName, { color: palette.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.timeLabel, { color: palette.textSecondary }]}>
              {item.timeStr}
            </Text>
          </View>

          <View style={styles.snippetRow}>
            <View style={styles.snippetInner}>
              {/* Cyan #53bdeb read ticks or delivered/sent ticks */}
              {item.rawConversation?.lastMessage && item.rawConversation.lastMessage.senderId === currentUser?.id && (
                <View style={!isDark && (item.rawConversation.lastMessage.receipts?.some((r) => r.readAt != null) || item.rawConversation.lastMessage.status === 'read') ? { backgroundColor: palette.tickBacking, borderRadius: 3, paddingHorizontal: 2, marginRight: 4 } : { marginRight: 4 }}>
                  <Ionicons
                    name={
                      item.rawConversation.lastMessage.receipts?.some((r) => r.readAt != null) ||
                      item.rawConversation.lastMessage.status === 'read'
                        ? 'checkmark-done'
                        : item.rawConversation.lastMessage.receipts?.some((r) => r.deliveredAt != null) ||
                          item.rawConversation.lastMessage.status === 'delivered'
                        ? 'checkmark-done'
                        : 'checkmark'
                    }
                    size={14}
                    color={
                      item.rawConversation.lastMessage.receipts?.some((r) => r.readAt != null) ||
                      item.rawConversation.lastMessage.status === 'read'
                        ? '#53bdeb'
                        : palette.textSecondary
                    }
                  />
                </View>
              )}
              {item.hasCallIcon && (
                <Ionicons
                  name="call"
                  size={13}
                  color={palette.textSecondary}
                  style={{ marginRight: 4, transform: [{ rotate: '135deg' }] }}
                />
              )}
              {item.hasCheckIcon && (
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={palette.textSecondary}
                  style={{ marginRight: 3 }}
                />
              )}
              {item.hasVideoIcon && (
                <Ionicons
                  name="videocam"
                  size={14}
                  color={palette.textSecondary}
                  style={{ marginRight: 4 }}
                />
              )}
              {item.hasCameraIcon && (
                <Ionicons
                  name="camera"
                  size={14}
                  color={palette.textSecondary}
                  style={{ marginRight: 4 }}
                />
              )}
              {item.hasDocIcon && (
                <Ionicons
                  name="document-text"
                  size={14}
                  color={palette.textSecondary}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={[styles.snippetText, { color: palette.textSecondary }]} numberOfLines={1}>
                {item.snippet}
              </Text>
            </View>

            {isUnread && (
              <View style={styles.unreadCountPill}>
                <Text style={styles.unreadCountNumber}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Calls Screen List Header Component matching preview viewCalls()
  const renderCallsHeader = () => (
    <View style={styles.callsHeaderWrapper}>
      {/* Bento Hero Card: Encrypted Calling */}
      <LiquidGlassSurface variant="card" style={{ padding: 16, marginHorizontal: 16, marginTop: 4, marginBottom: 14 }}>
        <Text style={[styles.bentoHeroTitle, { color: palette.textPrimary }]}>Encrypted Calling</Text>
        <Text style={[styles.bentoHeroDesc, { color: palette.textSecondary }]}>
          Crystal-clear peer-to-peer audio and video calls with WebRTC encryption.
        </Text>
        <View style={styles.callsActionsRow}>
          <TouchableOpacity
            style={styles.callsHeroBtn}
            onPress={() => Alert.alert('Call Link', 'Share link copied to clipboard.')}
            activeOpacity={0.7}
          >
            <View style={styles.callsHeroIconCircle}>
              <Ionicons name="link" size={18} color="#10b981" />
            </View>
            <Text style={styles.callsHeroLabel}>Create link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.callsHeroBtn}
            onPress={() => Alert.alert('Schedule Call', 'Select contact and time to schedule a call.')}
            activeOpacity={0.7}
          >
            <View style={styles.callsHeroIconCircle}>
              <Ionicons name="calendar-outline" size={18} color="#10b981" />
            </View>
            <Text style={styles.callsHeroLabel}>Schedule</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.callsHeroBtn}
            onPress={() => setShowNewCallModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.callsHeroIconCircle}>
              <Ionicons name="call" size={18} color="#10b981" />
            </View>
            <Text style={styles.callsHeroLabel}>New call</Text>
          </TouchableOpacity>
        </View>
      </LiquidGlassSurface>

      {/* Search Bar for Calls */}
      <CompactSearchField
        value={callsSearchQuery}
        onChangeText={setCallsSearchQuery}
        placeholder="Search calls..."
        style={{ marginBottom: 6 }}
      />

      {/* "Recent Calls" Section Heading */}
      <Text style={[styles.bentoSectionTitle, { color: palette.textSecondary }]}>Recent Calls</Text>
    </View>
  );

  // Calls Row Component matching preview viewCalls()
  const renderCallRow = ({ item }: { item: CallHistoryItem }) => {
    const isMissed = item.type === 'missed';

    return (
      <TouchableOpacity
        style={styles.callRow}
        activeOpacity={0.7}
        onPress={() => {
          Alert.alert(
            `Call ${item.contactName}`,
            `Choose call type for ${item.contactName}:`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Voice Call',
                onPress: () => {
                  navigateToCall(item.contactName, false, item.subtitle);
                },
              },
              {
                text: 'Video Call',
                onPress: () => {
                  navigateToCall(item.contactName, true, item.subtitle);
                },
              },
            ]
          );
        }}
      >
        {/* Avatar: 46x46 squircle (16px radius) */}
        <View style={[styles.avatarCircle, { backgroundColor: item.isVideo ? '#06b6d4' : '#10b981' }]}>
          <Text style={styles.avatarLetterText}>
            {item.contactName.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.callContentContainer}>
          <Text
            style={[
              styles.callContactName,
              { color: isMissed ? '#f43f5e' : palette.textPrimary },
            ]}
            numberOfLines={1}
          >
            {item.contactName}
            {item.callCount ? `  (${item.callCount})` : ''}
          </Text>

          <View style={styles.callStatusRow}>
            <Text style={[styles.callStatusText, { color: palette.textSecondary }]}>
              {isMissed ? '↙ Missed' : (item.type === 'outgoing' ? '↗ Outgoing' : '↙ Incoming')} · {formatCallTimeAge(item.timestamp || item.timeStr)}
            </Text>
          </View>
        </View>

        {/* Right: Audio/Video Call Button */}
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigateToCall(item.contactName, item.isVideo, item.subtitle)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={item.isVideo ? 'videocam' : 'call'}
            size={18}
            color="#10b981"
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Updates View matching preview viewUpdates()
  const renderUpdatesView = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 96 }}
    >
      <Text style={[styles.bentoSectionTitle, { paddingHorizontal: 0 }]}>Status Stories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
        <TouchableOpacity
          style={styles.storyCol}
          onPress={handleLaunchCamera}
          activeOpacity={0.7}
        >
          <View style={[styles.storyAvatarDashed, { borderColor: '#10b981', backgroundColor: palette.surfaceElevated }]}>
            <Ionicons name="add" size={24} color="#10b981" />
          </View>
          <Text style={[styles.storyLabel, { color: palette.textSecondary }]}>My Status</Text>
        </TouchableOpacity>

        {/* Contact stories from conversations */}
        {conversations.slice(0, 5).map((conv) => {
          const other = conv.members?.find((m) => m.userId !== currentUser?.id);
          const name = conv.title || other?.user?.displayName || other?.user?.username || 'Friend';
          return (
            <TouchableOpacity
              key={conv.id}
              style={styles.storyCol}
              onPress={() => Alert.alert(`Status Story`, `Viewing ${name}'s status update.`)}
              activeOpacity={0.7}
            >
              <View style={[styles.storyAvatarSolid, { borderColor: '#10b981', backgroundColor: '#00a884' }]}>
                <Text style={styles.storyInitial}>{name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.storyLabel, { color: palette.textSecondary }]} numberOfLines={1}>{name.split(' ')[0]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Hero Bento Card */}
      <LiquidGlassSurface variant="card" style={{ padding: 16, marginTop: 12 }}>
        <Text style={[styles.bentoHeroTitle, { color: palette.textPrimary }]}>Small Moments, Shared</Text>
        <Text style={[styles.bentoHeroDesc, { color: palette.textSecondary }]}>
          Stories disappear after 24 hours. Protected with end-to-end encryption.
        </Text>
        <TouchableOpacity
          style={styles.emeraldStudioBtn}
          onPress={handleLaunchCamera}
          activeOpacity={0.8}
        >
          <Text style={styles.emeraldStudioBtnText}>Add Text or Photo Update</Text>
        </TouchableOpacity>
      </LiquidGlassSurface>
    </ScrollView>
  );

  // Communities View matching preview viewCommunities()
  const renderCommunitiesView = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 96 }}
    >
      <LiquidGlassSurface variant="card" style={{ padding: 16, marginTop: 4, marginBottom: 14 }}>
        <Text style={[styles.bentoHeroTitle, { color: palette.textPrimary }]}>Connected Circles</Text>
        <Text style={[styles.bentoHeroDesc, { color: palette.textSecondary }]}>
          Organize topics, teams, and family chats under shared umbrella circles.
        </Text>
        <TouchableOpacity
          style={styles.emeraldStudioBtn}
          onPress={() => {
            setIsGroupMode(true);
            setShowNewChatModal(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.emeraldStudioBtnText}>Create Community Circle</Text>
        </TouchableOpacity>
      </LiquidGlassSurface>

      <Text style={[styles.bentoSectionTitle, { paddingHorizontal: 0 }]}>Your Circles · 2</Text>
      <LiquidGlassSurface variant="card" style={{ overflow: 'hidden' }}>
        <TouchableOpacity
          style={[styles.menuRowItem, { borderBottomColor: palette.border }]}
          onPress={() => Alert.alert('Tech Design Circle', '3 sub-groups · 42 members')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuRowIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Ionicons name="people" size={18} color="#10b981" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.menuRowTitle, { color: palette.textPrimary }]}>Tech Design Circle</Text>
            <Text style={[styles.menuRowDesc, { color: palette.textSecondary }]}>3 sub-groups · 42 members</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuRowItem}
          onPress={() => Alert.alert('Bengaluru Cyclists', 'Weekend routes & meetups')}
          activeOpacity={0.7}
        >
          <View style={[styles.menuRowIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
            <Ionicons name="people" size={18} color="#06b6d4" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.menuRowTitle, { color: palette.textPrimary }]}>Bengaluru Cyclists</Text>
            <Text style={[styles.menuRowDesc, { color: palette.textSecondary }]}>Weekend routes & meetups</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
        </TouchableOpacity>
      </LiquidGlassSurface>
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Sticky Liquid Glass Page Header */}
      <LiquidGlassSurface
        variant="chrome"
        style={[
          styles.pageHeader,
          {
            paddingTop: insets.top,
            height: 56 + insets.top,
            borderBottomColor: palette.border,
          },
        ]}
      >
        <View style={styles.pageHeaderLeft}>
          <Text style={[styles.pageHeaderTitle, { color: palette.textPrimary }]}>
            {activeTab === 'chats'
              ? 'IndiChat'
              : activeTab === 'calls'
              ? 'Calls'
              : activeTab === 'updates'
              ? 'Updates'
              : 'Circles'}
          </Text>
        </View>

        <View style={styles.pageHeaderRight}>
          {activeTab === 'chats' && (
            <>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={handleLaunchCamera}
                activeOpacity={0.7}
                accessibilityLabel="Camera"
              >
                <Ionicons name="camera-outline" size={20} color={palette.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => (searchInputRef.current as any)?.focus()}
                activeOpacity={0.7}
                accessibilityLabel="Search"
              >
                <Ionicons name="search-outline" size={20} color={palette.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => router.push('/contacts')}
                activeOpacity={0.7}
                accessibilityLabel="Find or Add Contacts"
              >
                <Ionicons name="add" size={24} color={palette.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setShowTopMenu(!showTopMenu)}
                activeOpacity={0.7}
                accessibilityLabel="More Options"
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={palette.textSecondary} />
              </TouchableOpacity>
            </>
          )}

          {activeTab === 'calls' && (
            <>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setShowNewCallModal(true)}
                activeOpacity={0.7}
                accessibilityLabel="Start Call"
              >
                <Ionicons name="add" size={24} color={palette.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setShowTopMenu(!showTopMenu)}
                activeOpacity={0.7}
                accessibilityLabel="Menu"
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={palette.textSecondary} />
              </TouchableOpacity>
            </>
          )}

          {activeTab === 'updates' && (
            <>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={handleLaunchCamera}
                activeOpacity={0.7}
                accessibilityLabel="Add Story"
              >
                <Ionicons name="camera-outline" size={20} color={palette.textSecondary} />
              </TouchableOpacity>
            </>
          )}

          {activeTab === 'communities' && (
            <>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => {
                  setIsGroupMode(true);
                  setShowNewChatModal(true);
                }}
                activeOpacity={0.7}
                accessibilityLabel="New Circle"
              >
                <Ionicons name="add" size={24} color={palette.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </LiquidGlassSurface>

      {/* Top Dropdown Menu */}
      {showTopMenu && (
        <Modal visible transparent animationType="fade">
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowTopMenu(false)}
          >
            <View
              style={[
                styles.dropdownMenu,
                {
                  top: insets.top + 54,
                  backgroundColor: palette.surfaceElevated || '#1a2530',
                  borderColor: palette.border,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowTopMenu(false);
                  setShowAiModal(true);
                }}
              >
                <Ionicons name="sparkles" size={18} color="#a855f7" style={{ marginRight: 10 }} />
                <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>Meta AI Assistant</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowTopMenu(false);
                  setShowPaymentsModal(true);
                }}
              >
                <Ionicons name="card-outline" size={18} color="#10b981" style={{ marginRight: 10 }} />
                <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>Payments (₹)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowTopMenu(false);
                  setIsGroupMode(true);
                  setShowNewChatModal(true);
                }}
              >
                <Ionicons name="people-outline" size={18} color={palette.textSecondary} style={{ marginRight: 10 }} />
                <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>New group</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowTopMenu(false);
                  router.push('/contacts');
                }}
              >
                <Ionicons name="person-add-outline" size={18} color={palette.textSecondary} style={{ marginRight: 10 }} />
                <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>Find contacts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowTopMenu(false);
                  router.push('/settings/linked-devices');
                }}
              >
                <Ionicons name="laptop-outline" size={18} color={palette.textSecondary} style={{ marginRight: 10 }} />
                <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>Linked devices</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowTopMenu(false);
                  router.push('/settings');
                }}
              >
                <Ionicons name="settings-outline" size={18} color={palette.textSecondary} style={{ marginRight: 10 }} />
                <Text style={[styles.menuItemText, { color: palette.textPrimary }]}>Settings</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Main List Area: Updates vs Communities vs Calls vs Chats */}
      {activeTab === 'updates' ? (
        renderUpdatesView()
      ) : activeTab === 'communities' ? (
        renderCommunitiesView()
      ) : activeTab === 'calls' ? (
        <Animated.FlatList
          data={displayCallsList}
          keyExtractor={(item) => item.id}
          renderItem={renderCallRow}
          ListHeaderComponent={renderCallsHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="call-outline" size={32} color="#8696a0" />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                {callsSearchQuery ? 'No calls found' : 'No recent calls'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
                {callsSearchQuery
                  ? `No call records match "${callsSearchQuery}"`
                  : 'Start a voice or video call with friends using the Keypad or New Call button.'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={[styles.rowSeparator, { backgroundColor: palette.border }]} />}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 12) + 96,
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: callsScrollY } } }],
            { useNativeDriver: true, listener: handleCallsScroll }
          )}
          scrollEventThrottle={16}
        />
      ) : loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <Animated.FlatList
          data={displayChatsList}
          keyExtractor={(item) => item.id}
          renderItem={renderChatRow}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={36} color="#10b981" />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                {searchQuery
                  ? 'No results found'
                  : activeFilter === 'unread'
                  ? 'No unread chats'
                  : activeFilter === 'groups'
                  ? 'No group chats yet'
                  : 'No chats yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
                {searchQuery
                  ? `No conversations match "${searchQuery}"`
                  : activeFilter === 'all'
                  ? 'Tap the + button to start a conversation with any registered user.'
                  : `You don't have any ${activeFilter} chats at the moment.`}
              </Text>
              {activeFilter === 'all' && !searchQuery && (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => setShowNewChatModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color="#070b0e" style={{ marginRight: 6 }} />
                  <Text style={styles.emptyActionBtnText}>Start New Chat</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ItemSeparatorComponent={() => <View style={[styles.rowSeparator, { backgroundColor: palette.border }]} />}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 12) + 96,
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true, listener: handleScroll }
          )}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor="#10b981"
            />
          }
        />
      )}

      {/* Floating Modern Bottom Navigation Dock: [ Updates | Calls | Circles | Chats (dot) | You ] */}
      <LiquidGlassSurface
        variant="chrome"
        style={[
          styles.floatingBottomDock,
          {
            bottom: Math.max(insets.bottom, 12) + 6,
            borderColor: palette.border,
          },
        ]}
      >
        {/* 1. Updates */}
        <TouchableOpacity
          style={[
            styles.dockTab,
            activeTab === 'updates' && { backgroundColor: palette.dockActiveBg },
          ]}
          onPress={() => setActiveTab('updates')}
        >
          <Ionicons
            name={activeTab === 'updates' ? 'disc' : 'disc-outline'}
            size={20}
            color={activeTab === 'updates' ? palette.dockActiveColor : palette.dockInactiveColor}
          />
          <Text
            style={[
              styles.dockLabel,
              { color: activeTab === 'updates' ? palette.dockActiveColor : palette.dockInactiveColor },
              activeTab === 'updates' && { fontWeight: '700' },
            ]}
          >
            Updates
          </Text>
        </TouchableOpacity>

        {/* 2. Calls */}
        <TouchableOpacity
          style={[
            styles.dockTab,
            activeTab === 'calls' && { backgroundColor: palette.dockActiveBg },
          ]}
          onPress={() => setActiveTab('calls')}
        >
          <Ionicons
            name={activeTab === 'calls' ? 'call' : 'call-outline'}
            size={20}
            color={activeTab === 'calls' ? palette.dockActiveColor : palette.dockInactiveColor}
          />
          <Text
            style={[
              styles.dockLabel,
              { color: activeTab === 'calls' ? palette.dockActiveColor : palette.dockInactiveColor },
              activeTab === 'calls' && { fontWeight: '700' },
            ]}
          >
            Calls
          </Text>
        </TouchableOpacity>

        {/* 3. Circles (Communities) */}
        <TouchableOpacity
          style={[
            styles.dockTab,
            activeTab === 'communities' && { backgroundColor: palette.dockActiveBg },
          ]}
          onPress={() => setActiveTab('communities')}
        >
          <Ionicons
            name={activeTab === 'communities' ? 'people' : 'people-outline'}
            size={20}
            color={activeTab === 'communities' ? palette.dockActiveColor : palette.dockInactiveColor}
          />
          <Text
            style={[
              styles.dockLabel,
              { color: activeTab === 'communities' ? palette.dockActiveColor : palette.dockInactiveColor },
              activeTab === 'communities' && { fontWeight: '700' },
            ]}
          >
            Circles
          </Text>
        </TouchableOpacity>

        {/* 4. Chats */}
        <TouchableOpacity
          style={[
            styles.dockTab,
            activeTab === 'chats' && { backgroundColor: palette.dockActiveBg },
          ]}
          onPress={() => setActiveTab('chats')}
        >
          <View style={{ position: 'relative' }}>
            <Ionicons
              name={activeTab === 'chats' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
              size={20}
              color={activeTab === 'chats' ? palette.dockActiveColor : palette.dockInactiveColor}
            />
            {totalUnreadCount > 0 && (
              <View style={styles.dockBadge}>
                <Text style={styles.dockBadgeText}>{totalUnreadCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.dockLabel,
              { color: activeTab === 'chats' ? palette.dockActiveColor : palette.dockInactiveColor },
              activeTab === 'chats' && { fontWeight: '700' },
            ]}
          >
            Chats
          </Text>
        </TouchableOpacity>

        {/* 5. You (Settings/Profile) */}
        <TouchableOpacity
          style={styles.dockTab}
          onPress={() => router.push('/settings')}
        >
          <View style={[styles.youAvatar, { backgroundColor: '#10b981' }]}>
            <Text style={styles.youAvatarText}>
              {(currentUser?.displayName || currentUser?.username || 'Y').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.dockLabel, { color: palette.dockInactiveColor }]}>You</Text>
        </TouchableOpacity>
      </LiquidGlassSurface>

      {/* Call Details Modal (opened via ⓘ button) */}
      {selectedCallDetails && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.callDetailsCard}>
              <View style={styles.callDetailsHeader}>
                <View style={styles.callAvatarCircle}>
                  <Ionicons name="person" size={26} color="#53bdeb" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.callDetailsName}>{selectedCallDetails.contactName}</Text>
                  {selectedCallDetails.subtitle ? (
                    <Text style={styles.callDetailsSubtitle}>{selectedCallDetails.subtitle}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => setSelectedCallDetails(null)}>
                  <Ionicons name="close" size={24} color="#8696a0" />
                </TouchableOpacity>
              </View>

              <View style={styles.callDetailsBody}>
                <View style={styles.callDetailsRow}>
                  <Ionicons
                    name={selectedCallDetails.isVideo ? 'videocam' : 'call'}
                    size={20}
                    color="#25D366"
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.callDetailsTitle}>
                      {selectedCallDetails.type === 'incoming' ? 'Incoming' : 'Outgoing'}{' '}
                      {selectedCallDetails.isVideo ? 'Video' : 'Voice'} Call
                    </Text>
                    <Text style={styles.callDetailsMeta}>
                      {formatCallTimeAge(selectedCallDetails.timestamp || selectedCallDetails.timeStr)} • {selectedCallDetails.duration || 'Ongoing'}
                    </Text>
                  </View>
                  <Text style={styles.callDataText}>{selectedCallDetails.dataUsed || '14.2 MB'}</Text>
                </View>

                {/* Quick Action Buttons */}
                <View style={styles.callDetailsActions}>
                  <TouchableOpacity
                    style={styles.callDetailActionBtn}
                    onPress={() => {
                      const name = selectedCallDetails.contactName;
                      setSelectedCallDetails(null);
                      navigateToCall(name, false);
                    }}
                  >
                    <Ionicons name="call" size={20} color="#25D366" />
                    <Text style={styles.callDetailActionText}>Voice</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.callDetailActionBtn}
                    onPress={() => {
                      const name = selectedCallDetails.contactName;
                      setSelectedCallDetails(null);
                      navigateToCall(name, true);
                    }}
                  >
                    <Ionicons name="videocam" size={20} color="#25D366" />
                    <Text style={styles.callDetailActionText}>Video</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.callDetailActionBtn}
                    onPress={() => {
                      const name = selectedCallDetails.contactName;
                      setSelectedCallDetails(null);
                      const matchingConv = conversations.find((c) => {
                        const other = c.members?.find((m) => m.userId !== currentUser?.id);
                        const otherName = other?.user?.displayName || other?.user?.username || c.title;
                        return otherName?.toLowerCase() === name.toLowerCase();
                      });
                      if (matchingConv) {
                        const other = matchingConv.members?.find((m) => m.userId !== currentUser?.id);
                        const targetUserId = other?.userId || other?.user?.id || '';
                        router.push(`/chat/${matchingConv.id}?name=${encodeURIComponent(name)}&targetUserId=${targetUserId}&type=DIRECT`);
                      } else if (conversations.length > 0) {
                        router.push(`/chat/${conversations[0].id}?name=${encodeURIComponent(name)}&type=DIRECT`);
                      }
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={20} color="#25D366" />
                    <Text style={styles.callDetailActionText}>Message</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Keypad Modal */}
      {showKeypadModal && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.keypadModalContent}>
              <View style={styles.keypadHeader}>
                <Text style={styles.keypadTitle}>Keypad</Text>
                <TouchableOpacity onPress={() => setShowKeypadModal(false)}>
                  <Ionicons name="close" size={24} color="#8696a0" />
                </TouchableOpacity>
              </View>

              <View style={styles.keypadDisplay}>
                <Text style={styles.keypadDisplayText} numberOfLines={1}>
                  {keypadNumber || 'Enter number'}
                </Text>
                {keypadNumber ? (
                  <TouchableOpacity onPress={() => setKeypadNumber((prev) => prev.slice(0, -1))}>
                    <Ionicons name="backspace-outline" size={24} color="#8696a0" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Grid 1 to 9, *, 0, # */}
              <View style={styles.keypadGrid}>
                {[
                  { num: '1', sub: '' },
                  { num: '2', sub: 'ABC' },
                  { num: '3', sub: 'DEF' },
                  { num: '4', sub: 'GHI' },
                  { num: '5', sub: 'JKL' },
                  { num: '6', sub: 'MNO' },
                  { num: '7', sub: 'PQRS' },
                  { num: '8', sub: 'TUV' },
                  { num: '9', sub: 'WXYZ' },
                  { num: '*', sub: '' },
                  { num: '0', sub: '+' },
                  { num: '#', sub: '' },
                ].map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.keypadKey}
                    onPress={() => setKeypadNumber((prev) => prev + item.num)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.keypadKeyNumber}>{item.num}</Text>
                    {item.sub ? <Text style={styles.keypadKeySub}>{item.sub}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Green Circular Call Button */}
              <View style={styles.keypadCallRow}>
                <TouchableOpacity
                  style={styles.keypadCallBtn}
                  onPress={() => {
                    if (!keypadNumber.trim()) {
                      Alert.alert('Enter Number', 'Please enter a phone number or name to call.');
                      return;
                    }
                    const num = keypadNumber.trim();
                    setShowKeypadModal(false);
                    setKeypadNumber('');
                    navigateToCall(num, false);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={28} color="#000000" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* New Call Contact Selector Modal */}
      {showNewCallModal && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.newCallModalContent}>
              <View style={styles.keypadHeader}>
                <Text style={styles.keypadTitle}>New Call</Text>
                <TouchableOpacity onPress={() => setShowNewCallModal(false)}>
                  <Ionicons name="close" size={24} color="#8696a0" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }}>
                {conversations && conversations.length > 0 ? (
                  conversations.map((conv) => {
                    const member = conv.members?.find((m) => m.userId !== currentUser?.id);
                    const name =
                      conv.type === 'GROUP' && conv.title
                        ? conv.title
                        : member?.user?.displayName || member?.user?.username || conv.title || 'Chat';
                    return (
                      <View key={conv.id} style={styles.callRow}>
                        <View style={styles.callAvatarCircle}>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                            {name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.callContentContainer}>
                          <Text style={styles.callContactName}>{name}</Text>
                          <Text style={styles.callSubtitle}>
                            {conv.type === 'GROUP' ? 'Group' : member?.user?.username ? `@${member.user.username}` : 'Direct Chat'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 14 }}>
                          <TouchableOpacity
                            onPress={() => {
                              setShowNewCallModal(false);
                              recordCall(name, false);
                              const member = conv.members?.find((m) => m.userId !== currentUser?.id);
                              const targetUserId = member?.userId || member?.user?.id || '';
                              router.push(
                                `/chat/${conv.id}?name=${encodeURIComponent(name)}&targetUserId=${targetUserId}&autoCall=voice`
                              );
                            }}
                          >
                            <Ionicons name="call" size={22} color="#25D366" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setShowNewCallModal(false);
                              recordCall(name, true);
                              const member = conv.members?.find((m) => m.userId !== currentUser?.id);
                              const targetUserId = member?.userId || member?.user?.id || '';
                              router.push(
                                `/chat/${conv.id}?name=${encodeURIComponent(name)}&targetUserId=${targetUserId}&autoCall=video`
                              );
                            }}
                          >
                            <Ionicons name="videocam" size={22} color="#25D366" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={36} color="#8696a0" style={{ marginBottom: 8 }} />
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                      No Contacts Yet
                    </Text>
                    <Text style={{ color: '#8696a0', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
                      Start a chat with a user or use the Keypad to dial any number directly.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyActionBtn}
                      onPress={() => {
                        setShowNewCallModal(false);
                        setShowKeypadModal(true);
                      }}
                    >
                      <Ionicons name="grid-outline" size={16} color="#000" style={{ marginRight: 6 }} />
                      <Text style={styles.emptyActionBtnText}>Open Keypad</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Meta AI Chat Modal */}
      <Modal visible={showAiModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.aiModalContent}>
            <View style={styles.aiModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.aiBadgeSmall}>
                  <Ionicons name="sparkles" size={16} color="#fff" />
                </View>
                <Text style={styles.aiModalTitle}>Meta AI</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAiModal(false)}>
                <Ionicons name="close" size={24} color="#8696a0" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: 14 }}>
              {aiResponses.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.aiBubble,
                    item.sender === 'user' ? styles.aiBubbleUser : styles.aiBubbleBot,
                  ]}
                >
                  <Text style={styles.aiBubbleText}>{item.text}</Text>
                </View>
              ))}
              {aiThinking && (
                <View style={[styles.aiBubble, styles.aiBubbleBot]}>
                  <ActivityIndicator size="small" color="#a855f7" />
                </View>
              )}
            </ScrollView>

            <View style={styles.aiInputRow}>
              <TextInput
                style={styles.aiTextInput}
                placeholder="Ask Meta AI anything..."
                placeholderTextColor="#8696a0"
                value={aiPrompt}
                onChangeText={setAiPrompt}
              />
              <TouchableOpacity
                style={styles.aiSendBtn}
                onPress={handleSendAiPrompt}
                disabled={!aiPrompt.trim()}
              >
                <Ionicons name="arrow-up" size={20} color="#111b21" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payments Modal (Rupee Symbol) */}
      <Modal visible={showPaymentsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.paymentsCard}>
            <View style={styles.rupeeBigCircle}>
              <Text style={styles.rupeeBigText}>₹</Text>
            </View>
            <Text style={styles.paymentsTitle}>Payments</Text>
            <Text style={styles.paymentsDesc}>
              Send and receive money seamlessly using UPI on WhatsApp.
            </Text>
            <TouchableOpacity
              style={styles.paymentsActionBtn}
              onPress={() => {
                setShowPaymentsModal(false);
                Alert.alert('UPI Ready', 'UPI account linked successfully.');
              }}
            >
              <Text style={styles.paymentsActionText}>Set Up UPI Payments</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 14 }}
              onPress={() => setShowPaymentsModal(false)}
            >
              <Text style={{ color: '#8696a0', fontSize: 14 }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* New Chat & Group Modal */}
      <Modal visible={showNewChatModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.newChatCard}>
            <View style={styles.newChatHeader}>
              <Text style={styles.newChatTitle}>
                {isGroupMode ? 'New Group' : 'New Chat'}
              </Text>
              <TouchableOpacity onPress={() => setShowNewChatModal(false)}>
                <Ionicons name="close" size={24} color="#aebac1" />
              </TouchableOpacity>
            </View>

            <View style={styles.chatModeTabs}>
              <TouchableOpacity
                style={[styles.chatModeTab, !isGroupMode && styles.chatModeTabActive]}
                onPress={() => setIsGroupMode(false)}
              >
                <Text style={[styles.chatModeText, !isGroupMode && styles.chatModeTextActive]}>
                  Direct Chat
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chatModeTab, isGroupMode && styles.chatModeTabActive]}
                onPress={() => setIsGroupMode(true)}
              >
                <Text style={[styles.chatModeText, isGroupMode && styles.chatModeTextActive]}>
                  Group Chat
                </Text>
              </TouchableOpacity>
            </View>

            {!isGroupMode && (
              <TouchableOpacity
                style={styles.findContactsModalBtn}
                onPress={() => {
                  setShowNewChatModal(false);
                  router.push('/contacts');
                }}
              >
                <View style={styles.findContactsIconWrap}>
                  <Ionicons name="people" size={20} color="#00a884" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.findContactsModalTitle}>Find Contacts</Text>
                  <Text style={styles.findContactsModalSubtitle}>Discover friends from your phonebook</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#8696a0" />
              </TouchableOpacity>
            )}

            {isGroupMode && (
              <TextInput
                style={styles.modalTextInput}
                placeholder="Group Subject / Title"
                placeholderTextColor="#8696a0"
                value={groupTitle}
                onChangeText={setGroupTitle}
              />
            )}

            <TextInput
              style={styles.modalTextInput}
              placeholder="Search username or name..."
              placeholderTextColor="#8696a0"
              value={searchUserQuery}
              onChangeText={setSearchUserQuery}
            />

            {searchingUsers ? (
              <ActivityIndicator color="#25D366" style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={searchedUsers}
                keyExtractor={(u) => u.id}
                style={{ maxHeight: 280 }}
                renderItem={({ item }) => {
                  const isSelected = selectedUserIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={styles.userPickerRow}
                      onPress={() => {
                        if (isGroupMode) {
                          setSelectedUserIds((prev) =>
                            isSelected ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                          );
                        } else {
                          handleStartDirectChat(item);
                        }
                      }}
                    >
                      <View style={styles.userPickerAvatar}>
                        <Text style={styles.userPickerInitial}>
                          {(item.displayName || item.username).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userPickerName}>{item.displayName || item.username}</Text>
                        <Text style={styles.userPickerUsername}>@{item.username}</Text>
                      </View>
                      {isGroupMode && (
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? '#25D366' : '#8696a0'}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {isGroupMode && (
              <TouchableOpacity
                style={styles.createGroupActionBtn}
                onPress={handleCreateGroupChat}
                disabled={creatingChat}
              >
                {creatingChat ? (
                  <ActivityIndicator color="#0b1014" />
                ) : (
                  <Text style={styles.createGroupActionText}>
                    Create Group ({selectedUserIds.length})
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <Modal visible transparent animationType="slide">
          <View style={styles.incomingCallOverlay}>
            <View style={styles.incomingCallCard}>
              <View style={styles.incomingCallAvatar}>
                <Ionicons
                  name={incomingCall.isVideo ? 'videocam' : 'call'}
                  size={36}
                  color="#25D366"
                />
              </View>
              <Text style={styles.incomingCallName}>{incomingCall.callerName}</Text>
              <Text style={styles.incomingCallType}>
                WhatsApp {incomingCall.isVideo ? 'Video' : 'Voice'} Call...
              </Text>

              <View style={styles.callButtonsRow}>
                <TouchableOpacity
                  style={[styles.callCircleBtn, styles.declineBtn]}
                  onPress={() => {
                    wsClient.sendCallSignal({
                      targetUserId: incomingCall.senderUserId,
                      signalType: 'hangup',
                      data: {},
                    });
                    setIncomingCall(null);
                  }}
                >
                  <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.callLabel}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.callCircleBtn, styles.acceptBtn]}
                  onPress={() => {
                    wsClient.sendCallSignal({
                      targetUserId: incomingCall.senderUserId,
                      signalType: 'answer',
                      data: {},
                    });
                    const senderId = incomingCall.senderUserId;
                    const callerName = incomingCall.callerName;
                    const isVideo = incomingCall.isVideo;
                    setIncomingCall(null);
                    recordCall(callerName, isVideo, 'Incoming Call');

                    const conv = conversations.find((c) =>
                      c.members?.some((m) => m.userId === senderId || m.user?.id === senderId)
                    );

                    if (conv) {
                      router.push(
                        `/chat/${conv.id}?name=${encodeURIComponent(callerName)}&targetUserId=${senderId}&acceptedCall=${isVideo ? 'video' : 'voice'}`
                      );
                    } else {
                      api.createConversation({ type: 'DIRECT', participantIds: [senderId] }).then((newConv) => {
                        router.push(
                          `/chat/${newConv.id}?name=${encodeURIComponent(callerName)}&targetUserId=${senderId}&acceptedCall=${isVideo ? 'video' : 'voice'}`
                        );
                      }).catch(() => {
                        router.push(
                          `/chat/direct-${senderId}?name=${encodeURIComponent(callerName)}&targetUserId=${senderId}&acceptedCall=${isVideo ? 'video' : 'voice'}`
                        );
                      });
                    }
                  }}
                >
                  <Ionicons name="call" size={26} color="#fff" />
                  <Text style={styles.callLabel}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f13',
  },
  pageHeader: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  pageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageHeaderTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  pageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  bentoHeroTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  bentoHeroDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  emeraldStudioBtn: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emeraldStudioBtnText: {
    color: '#070b0e',
    fontSize: 13,
    fontWeight: '700',
  },
  storyCol: {
    alignItems: 'center',
    marginRight: 14,
  },
  storyAvatarDashed: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  storyAvatarSolid: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  storyInitial: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  storyLabel: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  menuRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuRowIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  menuRowDesc: {
    fontSize: 11.5,
    marginTop: 2,
  },
  onlineIndicatorDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10b981',
    borderWidth: 2,
  },
  stickyHeader: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0f13',
    paddingTop: Platform.OS === 'android' ? 6 : 0,
    zIndex: 10,
  },
  threeDotsCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f2428',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInlineTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  capsulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2428',
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 10,
    gap: 8,
  },
  capsuleIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupeeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e9edef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupeeSymbol: {
    color: '#0a0f13',
    fontSize: 14,
    fontWeight: '800',
  },
  greenPlusCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeaderWrapper: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  largeChatsTitle: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  metaAiSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2428',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
  },
  metaAiSearchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    paddingVertical: 2,
  },
  filterChipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 7,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#10b981',
  },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  archivedIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  archivedTitleText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  archivedCountText: {
    color: '#8696a0',
    fontSize: 14,
    fontWeight: '500',
  },
  chatRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  astrotalkRing: {
    borderWidth: 1.5,
    borderColor: '#eab308',
  },
  avatarLetterText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  disappearingTimerBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0a0f13',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0a0f13',
  },
  chatTextContainer: {
    flex: 1,
  },
  nameTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '400',
  },
  timeLabelGreen: {
    color: '#10b981',
    fontWeight: '600',
  },
  snippetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  snippetInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  snippetText: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  unreadCountPill: {
    backgroundColor: '#10b981',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadCountNumber: {
    color: '#070b0e',
    fontSize: 10.5,
    fontWeight: '800',
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaAiButton: {
    position: 'absolute',
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#181e24',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#a855f7',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 20,
  },
  metaAiSwirlWrap: {
    width: 32,
    height: 32,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaAiPetal: {
    width: 6,
    height: 11,
    borderRadius: 3,
    position: 'absolute',
    top: 10.5,
    left: 13,
  },
  metaAiCoreHole: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#181e24',
    position: 'absolute',
  },
  rbiBadgeInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  metroBadgeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  gpayBadgeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  gpayLetter: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563eb',
  },
  daxabitBadgeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  floatingBottomDock: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
  dockTab: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  dockTabActive: {
    borderRadius: 18,
  },
  dockTabChatsActive: {
    borderRadius: 18,
  },
  dockLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  dockLabelActive: {
    fontWeight: '700',
  },
  dockBadge: {
    position: 'absolute',
    top: -3,
    right: -7,
    backgroundColor: '#10b981',
    height: 15,
    minWidth: 15,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockBadgeText: {
    color: '#070b0e',
    fontSize: 9.5,
    fontWeight: '800',
  },
  youAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youAvatarText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  callsHeaderWrapper: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  callsSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2428',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
  },
  callsActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
    marginTop: 4,
  },
  callsHeroBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  callsHeroIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  callsHeroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  recentSectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  callRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 11,
    alignItems: 'center',
  },
  callAvatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callContentContainer: {
    flex: 1,
    marginLeft: 12,
  },
  callContactName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  callSubtitle: {
    color: '#8696a0',
    fontSize: 14,
    marginTop: 1,
  },
  callStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  callStatusText: {
    color: '#8696a0',
    fontSize: 14,
  },
  callRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callTimeText: {
    color: '#8696a0',
    fontSize: 13,
    marginRight: 14,
  },
  callInfoBtn: {
    padding: 4,
  },
  callsHeaderCenterTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callDetailsCard: {
    backgroundColor: '#1f2428',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    width: '100%',
  },
  callDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  callDetailsName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  callDetailsSubtitle: {
    color: '#8696a0',
    fontSize: 14,
    marginTop: 2,
  },
  callDetailsBody: {
    gap: 16,
  },
  callDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161c22',
    padding: 14,
    borderRadius: 12,
  },
  callDetailsTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  callDetailsMeta: {
    color: '#8696a0',
    fontSize: 13,
    marginTop: 2,
  },
  callDataText: {
    color: '#8696a0',
    fontSize: 13,
  },
  callDetailsActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  callDetailActionBtn: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161c22',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  callDetailActionText: {
    color: '#25D366',
    fontSize: 13,
    fontWeight: '600',
  },
  keypadModalContent: {
    backgroundColor: '#1f2428',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    width: '100%',
  },
  keypadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  keypadTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  keypadDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  keypadDisplayText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 1.5,
    textAlign: 'center',
    flex: 1,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    paddingHorizontal: 16,
  },
  keypadKey: {
    width: '28%',
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2a3138',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyNumber: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
  },
  keypadKeySub: {
    color: '#8696a0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  keypadCallRow: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  keypadCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCallModalContent: {
    backgroundColor: '#1f2428',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    width: '100%',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 70,
    right: 16,
    backgroundColor: '#1f2428',
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 215,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#2d3238',
    zIndex: 99,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    color: '#e9edef',
    fontSize: 14.5,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  aiModalContent: {
    backgroundColor: '#1f2428',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
  },
  aiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3036',
  },
  aiBadgeSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiModalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  aiBubble: {
    padding: 12,
    borderRadius: 14,
    marginVertical: 4,
    maxWidth: '82%',
  },
  aiBubbleBot: {
    backgroundColor: '#2a3138',
    alignSelf: 'flex-start',
  },
  aiBubbleUser: {
    backgroundColor: '#005c4b',
    alignSelf: 'flex-end',
  },
  aiBubbleText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
  },
  aiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#2b3036',
    gap: 8,
  },
  aiTextInput: {
    flex: 1,
    backgroundColor: '#2a3138',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
  },
  aiSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentsCard: {
    backgroundColor: '#1f2428',
    margin: 24,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  rupeeBigCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  rupeeBigText: {
    color: '#000',
    fontSize: 36,
    fontWeight: '900',
  },
  paymentsTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  paymentsDesc: {
    color: '#8696a0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  paymentsActionBtn: {
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  paymentsActionText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  newChatCard: {
    backgroundColor: '#1f2428',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    maxHeight: '85%',
  },
  newChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  newChatTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '700',
  },
  chatModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#0a0f13',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  chatModeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  chatModeTabActive: {
    backgroundColor: '#1f2428',
  },
  chatModeText: {
    color: '#8696a0',
    fontSize: 13,
    fontWeight: '600',
  },
  chatModeTextActive: {
    color: '#25D366',
  },
  modalTextInput: {
    backgroundColor: '#0a0f13',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 10,
  },
  userPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3036',
  },
  userPickerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userPickerInitial: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  userPickerName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  userPickerUsername: {
    color: '#8696a0',
    fontSize: 13,
  },
  createGroupActionBtn: {
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  createGroupActionText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  incomingCallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  incomingCallCard: {
    width: '100%',
    backgroundColor: '#1f2428',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
  },
  incomingCallAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  incomingCallName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  incomingCallType: {
    color: '#8696a0',
    fontSize: 14,
    marginBottom: 28,
  },
  callButtonsRow: {
    flexDirection: 'row',
    gap: 36,
  },
  callCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: '#f15c6d',
  },
  acceptBtn: {
    backgroundColor: '#25D366',
  },
  callLabel: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(31, 36, 40, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#8696a0',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyActionBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  findContactsModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202c33',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a3942',
  },
  findContactsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 168, 132, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  findContactsModalTitle: {
    color: '#e9edef',
    fontSize: 14,
    fontWeight: '600',
  },
  findContactsModalSubtitle: {
    color: '#8696a0',
    fontSize: 12,
    marginTop: 2,
  },
});
