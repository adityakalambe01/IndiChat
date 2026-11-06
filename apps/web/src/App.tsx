import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './services/api';
import { wsClient } from './services/websocket';
import { soundEffects } from './services/audio';
import { notificationService } from './services/notifications';
import { User, Conversation, Message, MessageReceipt, AuthResponse, MessageType } from '@chat/shared-types';
import { NavigationRail, RailTab } from './components/NavigationRail';
import { ChatSidebar } from './features/chats/ChatSidebar';
import { ChatWindow } from './features/chats/ChatWindow';
import { CallsSidebar } from './features/calls/CallsSidebar';
import { CallsEmptyState } from './features/calls/CallsEmptyState';
import { StatusSidebar } from './features/status/StatusSidebar';
import { StatusEmptyState } from './features/status/StatusEmptyState';
import { StatusViewerModal } from './features/status/StatusViewerModal';
import { CreateStatusModal } from './features/status/CreateStatusModal';
import { ChannelsSidebar } from './features/channels/ChannelsSidebar';
import { ChannelsEmptyState } from './features/channels/ChannelsEmptyState';
import { ChannelFeedView } from './features/channels/ChannelFeedView';
import { CreateChannelModal } from './features/channels/CreateChannelModal';
import { CommunitiesSidebar } from './features/communities/CommunitiesSidebar';
import { CommunitiesEmptyState } from './features/communities/CommunitiesEmptyState';
import { CreateCommunityModal } from './features/communities/CreateCommunityModal';
import { MetaAiChatView } from './features/meta_ai/MetaAiChatView';
import { DialpadModal } from './features/calls/DialpadModal';
import { AuthModal } from './features/auth/AuthModal';
import { NewChatModal } from './features/chats/NewChatModal';
import { CallModal } from './features/calls/CallModal';
import { NotificationModal } from './features/notifications/NotificationModal';
import { SettingsView } from './features/settings/SettingsView';
import { generateUUID } from './utils/uuid';
import { resetDeviceId } from './utils/device';
import { settingsService } from './services/settings';
import { SessionRevokedModal } from './features/auth/SessionRevokedModal';
import { APP_NAME, APP_FULL_TITLE } from './config/appConfig';
import { UserStatus } from './data/statusData';
import { ChannelItem } from './data/channelData';
import { CommunityItem } from './data/communityData';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RailTab>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isMobileOpen, setIsMobileOpen] = useState(true);
  const [sessionRevokedReason, setSessionRevokedReason] = useState<string | null>(null);
  const isLoggingOutRef = useRef(false);

  // Feature specific states
  const [selectedStatus, setSelectedStatus] = useState<UserStatus | null>(null);
  const [showCreateStatusModal, setShowCreateStatusModal] = useState(false);
  const [createStatusInitialType, setCreateStatusInitialType] = useState<'text' | 'image'>('text');

  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);

  const [showCreateCommunityModal, setShowCreateCommunityModal] = useState(false);
  const [showDialpadModal, setShowDialpadModal] = useState(false);

  // Calling state
  const [activeCall, setActiveCall] = useState<{
    targetUserId: string;
    targetName: string;
    isVideo: boolean;
    isIncoming: boolean;
    incomingOfferData?: any;
  } | null>(null);

  // Modals
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Theme & Document Title
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.title = APP_FULL_TITLE;
  }, []);

  // Notifications prompt
  useEffect(() => {
    if (
      currentUser &&
      notificationService.isSupported() &&
      notificationService.getPermissionStatus() === 'default' &&
      !notificationService.isDismissed()
    ) {
      const timer = setTimeout(() => {
        setShowNotificationModal(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  // Load existing session
  useEffect(() => {
    const token = localStorage.getItem('chat_access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.getMe()
      .then((user) => {
        setCurrentUser(user);
        settingsService.loadForUser(user.id);
        wsClient.connect(token);
        loadConversations();
        notificationService.syncDeviceToken();
        settingsService.syncWithBackend();
      })
      .catch((err) => {
        localStorage.removeItem('chat_access_token');
        localStorage.removeItem('chat_refresh_token');
        resetDeviceId();
        const msg = err instanceof Error ? err.message : '';
        if (msg && (msg.toLowerCase().includes('revoked') || msg.toLowerCase().includes('removed'))) {
          setSessionRevokedReason('This device was removed from your linked devices. You have been logged out.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const list = await api.getConversations();
      setConversations(list);
    } catch (e) {
      console.error('Failed to load backend conversations:', e);
      setConversations([]);
    }
  }, []);

  // Messages fetcher for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    api.getMessages(activeConversationId)
      .then((res) => {
        setMessages(res.messages);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c))
        );
      })
      .catch((e) => console.error('Failed to load messages', e));
  }, [activeConversationId]);

  // WebSocket event listeners
  useEffect(() => {
    if (!currentUser) return;

    const unsubMsg = wsClient.onMessageCreated((msg: Message) => {
      if (msg.conversationId === activeConversationId) {
        setMessages((prev) => {
          const matchIndex = prev.findIndex(
            (m) =>
              (Boolean(msg.clientMessageId) && m.clientMessageId === msg.clientMessageId) ||
              (Boolean(msg.id) && m.id === msg.id)
          );
          if (matchIndex >= 0) {
            const next = [...prev];
            next[matchIndex] = { ...msg, status: 'sent' };
            return next;
          }
          return [...prev, msg];
        });
      }

      if (msg.senderId !== currentUser.id) {
        soundEffects.playIncomingMessage();
        wsClient.markDelivered(msg.id, msg.conversationId);

        const senderName = msg.sender?.displayName || msg.sender?.username || 'New Message';
        const conv = conversations.find((c) => c.id === msg.conversationId);
        const title = conv?.type === 'GROUP' ? (conv.title || 'Group Chat') : senderName;
        const body = msg.content;

        notificationService.showNotification(title, {
          body,
          tag: msg.conversationId,
          username: senderName,
          onClick: () => {
            setActiveConversationId(msg.conversationId);
            setActiveTab('chats');
            setIsMobileOpen(false);
          },
        });
      }

      setConversations((prev) => {
        return prev.map((c) => {
          if (c.id === msg.conversationId) {
            const isCurrent = c.id === activeConversationId;
            return {
              ...c,
              lastMessage: msg,
              updatedAt: msg.createdAt,
              unreadCount: isCurrent ? 0 : (c.unreadCount || 0) + (msg.senderId !== currentUser.id ? 1 : 0),
            };
          }
          return c;
        });
      });
    });

    const unsubReceipt = wsClient.onReceiptUpdated((receipt: MessageReceipt) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === receipt.messageId) {
            const receipts = m.receipts ? [...m.receipts] : [];
            const idx = receipts.findIndex((r) => r.userId === receipt.userId);
            if (idx >= 0) receipts[idx] = receipt;
            else receipts.push(receipt);
            return { ...m, receipts };
          }
          return m;
        })
      );
    });

    const unsubTyping = wsClient.onTypingUpdated((event) => {
      if (event.conversationId === activeConversationId) {
        setTypingUsers((prev) => ({
          ...prev,
          [event.userId]: event.isTyping,
        }));
      }
    });

    const unsubPresence = wsClient.onPresenceUpdated((event) => {
      setConversations((prev) =>
        prev.map((c) => {
          const updatedMembers = c.members.map((m) => {
            if (m.userId === event.userId && m.user) {
              return {
                ...m,
                user: {
                  ...m.user,
                  isOnline: event.isOnline,
                  lastSeenAt: event.lastSeenAt || m.user.lastSeenAt,
                },
              };
            }
            return m;
          });
          return { ...c, members: updatedMembers };
        })
      );
    });

    const unsubCall = wsClient.onCallSignal((signal) => {
      if (signal.signalType === 'offer' && signal.senderUserId) {
        const callerNameFromSignal = (signal.data as any)?.callerName;
        const matchingMember = conversations
          .flatMap((c) => c.members || [])
          .find((m) => m && (m.userId === signal.senderUserId || m.user?.id === signal.senderUserId));
        const caller = matchingMember?.user;
        const targetName = callerNameFromSignal || caller?.displayName || caller?.username || 'Incoming Caller';

        setActiveCall({
          targetUserId: signal.senderUserId,
          targetName,
          isVideo: Boolean((signal.data as any)?.isVideo),
          isIncoming: true,
          incomingOfferData: signal.data,
        });
      } else if (signal.signalType === 'hangup') {
        setActiveCall(null);
      }
    });

    return () => {
      unsubMsg();
      unsubReceipt();
      unsubTyping();
      unsubPresence();
      unsubCall();
    };
  }, [currentUser, activeConversationId, conversations]);

  const handleAuthenticated = (res: AuthResponse) => {
    if (!res.user || !res.tokens) return;
    setCurrentUser(res.user);
    settingsService.loadForUser(res.user.id);
    wsClient.connect(res.tokens.accessToken);
    loadConversations();
    notificationService.syncDeviceToken();
    settingsService.syncWithBackend();
  };

  const handleLogout = useCallback((notifyBackend = true, keepRevokedReason = false) => {
    isLoggingOutRef.current = true;
    if (!keepRevokedReason) {
      setSessionRevokedReason(null);
    }
    setShowNotificationModal(false);

    if (notifyBackend) {
      api.logout().catch((e) => {
        console.warn('Backend logout warning:', e);
      });
    }

    try {
      notificationService.unregister();
    } catch {}

    wsClient.disconnect();
    localStorage.removeItem('chat_access_token');
    localStorage.removeItem('chat_refresh_token');
    resetDeviceId();
    settingsService.resetForLogout();
    setCurrentUser(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);

    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 1500);
  }, []);

  const handleSendMessage = async (content: string, messageType: MessageType = 'TEXT') => {
    if (!currentUser || !activeConversationId) return;

    const clientMsgId = generateUUID();
    const optimisticMessage: Message = {
      id: clientMsgId,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      clientMessageId: clientMsgId,
      type: messageType,
      content,
      createdAt: new Date().toISOString(),
      sender: currentUser,
      receipts: [],
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimisticMessage]);


    const payload = {
      conversationId: activeConversationId,
      clientMessageId: clientMsgId,
      messageType,
      content,
    };

    try {
      const saved = await api.sendMessage(payload);
      setMessages((prev) =>
        prev.map((m) =>
          (m.clientMessageId && m.clientMessageId === clientMsgId) || m.id === clientMsgId
            ? { ...saved, status: 'sent' }
            : m
        )
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? { ...c, lastMessage: saved, updatedAt: saved.createdAt }
            : c
        )
      );
    } catch (err) {
      console.warn('HTTP API send failed, trying WebSocket fallback:', err);
      const sentWs = wsClient.sendMessage(payload);
      if (!sentWs) {
        setMessages((prev) =>
          prev.map((m) =>
            (m.clientMessageId && m.clientMessageId === clientMsgId) || m.id === clientMsgId
              ? { ...m, status: 'failed' }
              : m
          )
        );
      }
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setActiveTab('chats');
    setIsMobileOpen(false);
  };

  const handleStartCall = (targetUserId: string, isVideo: boolean) => {
    const activeConv = conversations.find((c) => c.id === activeConversationId);
    const targetMember = activeConv?.members.find((m) => m.userId === targetUserId);

    setActiveCall({
      targetUserId,
      targetName: targetMember?.user?.displayName || targetMember?.user?.username || targetUserId || 'Contact',
      isVideo,
      isIncoming: false,
    });
  };

  const handleHangupCall = (stats?: { duration: number; connected: boolean; isVideo: boolean }) => {
    if (activeCall && activeConversationId) {
      const isConnected = Boolean(stats?.connected && (stats?.duration ?? 0) > 0);
      let durationText: string;
      if (isConnected) {
        const d = stats!.duration;
        durationText = d < 60 ? `${d} sec` : `${Math.floor(d / 60)} min ${d % 60} sec`;
      } else {
        durationText = activeCall.isIncoming ? 'Missed' : 'No answer';
      }

      const callPayload = {
        callType: activeCall.isVideo ? 'video' : 'voice',
        status: isConnected ? 'connected' : activeCall.isIncoming ? 'missed' : 'no_answer',
        duration: stats?.duration || 0,
        durationText,
        endedAt: new Date().toISOString(),
      };

      handleSendMessage(JSON.stringify(callPayload), 'CALL');
    }
    setActiveCall(null);
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;
  const totalUnreads = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="typing-dots" style={{ transform: 'scale(1.5)', marginBottom: '16px' }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <div>Loading {APP_NAME}...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <AuthModal onAuthenticated={handleAuthenticated} />
        <SessionRevokedModal
          isOpen={Boolean(sessionRevokedReason)}
          reason={sessionRevokedReason || undefined}
          onClose={() => setSessionRevokedReason(null)}
        />
      </>
    );
  }

  return (
    <div className="app-container">
      {/* 1. Leftmost Navigation Rail matching WhatsApp Web */}
      <NavigationRail
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'chats') {
            setActiveConversationId(null);
          }
        }}
        currentUser={currentUser}
        unreadCount={totalUnreads}
        hasUnreadStatus={true}
      />

      {/* 2. Sidebar based on active navigation tab */}
      {(activeTab === 'chats' || activeTab === 'archived') && (
        <ChatSidebar
          currentUser={currentUser}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onOpenNewChat={() => setShowNewChatModal(true)}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          isMobileOpen={isMobileOpen}
          messages={messages}
          onUpdateUser={(updated) => setCurrentUser((prev) => (prev ? { ...prev, ...updated } : prev))}
          onClearAllMessages={() => {
            setMessages([]);
            loadConversations();
          }}
          onDeleteAllChats={() => {
            setConversations([]);
            setActiveConversationId(null);
            setMessages([]);
          }}
          onOpenArchived={() => setActiveTab('archived')}
          onOpenCommunities={() => setActiveTab('communities')}
          onOpenSettings={() => setActiveTab('settings')}
          typingUsers={typingUsers}
        />
      )}

      {activeTab === 'calls' && (
        <CallsSidebar
          onStartCallWithContact={(contactName, isVideo) => {
            handleStartCall(contactName, isVideo);
          }}
          onOpenNewCallModal={() => setShowNewChatModal(true)}
          onShowDialpad={() => setShowDialpadModal(true)}
        />
      )}

      {activeTab === 'status' && (
        <StatusSidebar
          currentUser={currentUser}
          onSelectStatus={(status) => setSelectedStatus(status)}
          onOpenCreateStatus={(type) => {
            setCreateStatusInitialType(type);
            setShowCreateStatusModal(true);
          }}
        />
      )}

      {activeTab === 'channels' && (
        <ChannelsSidebar
          selectedChannelId={selectedChannel?.id || null}
          onSelectChannel={(channel) => setSelectedChannel(channel)}
          onCreateChannel={() => setShowCreateChannelModal(true)}
        />
      )}

      {activeTab === 'communities' && (
        <CommunitiesSidebar
          onStartCommunity={() => setShowCreateCommunityModal(true)}
          onSelectCommunityGroup={(groupName) => {
            alert(`Opening community group: ${groupName}`);
          }}
        />
      )}

      {activeTab === 'settings' && (
        <aside className="sidebar">
          <SettingsView
            currentUser={currentUser}
            conversations={conversations}
            messages={messages}
            onClose={() => setActiveTab('chats')}
            onLogout={handleLogout}
            onUpdateUser={(updated) => setCurrentUser((prev) => (prev ? { ...prev, ...updated } : prev))}
            onClearAllMessages={() => {
              setMessages([]);
              loadConversations();
            }}
            onDeleteAllChats={() => {
              setConversations([]);
              setActiveConversationId(null);
              setMessages([]);
            }}
            initialSubView="menu"
          />
        </aside>
      )}

      {/* 3. Main Content Panel */}
      {activeTab === 'chats' && (
        <ChatWindow
          currentUser={currentUser}
          conversation={activeConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onBackToSidebar={() => setIsMobileOpen(true)}
          typingUsers={typingUsers}
          onStartCall={handleStartCall}
          onGoToCalls={() => setActiveTab('calls')}
          onSendDocument={() => setShowNewChatModal(true)}
          onAddContact={() => setShowNewChatModal(true)}
          onInviteFriend={() => {
            navigator.clipboard?.writeText(window.location.origin);
            alert('WhatsApp invite link copied to clipboard!');
          }}
          onNewCall={() => setActiveTab('calls')}
          onAskMetaAi={() => setActiveTab('meta_ai')}
        />
      )}

      {activeTab === 'archived' && (
        <ChatWindow
          currentUser={currentUser}
          conversation={activeConversation}
          messages={messages}
          onSendMessage={handleSendMessage}
          onBackToSidebar={() => setIsMobileOpen(true)}
          typingUsers={typingUsers}
          onStartCall={handleStartCall}
          onGoToCalls={() => setActiveTab('calls')}
          onSendDocument={() => setShowNewChatModal(true)}
          onAddContact={() => setShowNewChatModal(true)}
          onInviteFriend={() => {
            navigator.clipboard?.writeText(window.location.origin);
            alert('WhatsApp invite link copied to clipboard!');
          }}
          onNewCall={() => setActiveTab('calls')}
          onAskMetaAi={() => setActiveTab('meta_ai')}
        />
      )}

      {activeTab === 'calls' && (
        <main className="chat-area">
          <CallsEmptyState
            onStartCall={() => setShowNewChatModal(true)}
            onNewCallLink={() => {
              const link = `${window.location.origin}/call/meet-${Date.now().toString(36)}`;
              navigator.clipboard?.writeText(link);
              alert(`Call link created & copied: ${link}`);
            }}
            onCallNumber={() => setShowDialpadModal(true)}
          />
        </main>
      )}

      {activeTab === 'status' && (
        <main className="chat-area">
          <StatusEmptyState
            onTextStatus={() => {
              setCreateStatusInitialType('text');
              setShowCreateStatusModal(true);
            }}
            onPhotoVideoStatus={() => {
              setCreateStatusInitialType('image');
              setShowCreateStatusModal(true);
            }}
          />
        </main>
      )}

      {activeTab === 'channels' && (
        selectedChannel ? (
          <ChannelFeedView
            channel={selectedChannel}
            onBack={() => setSelectedChannel(null)}
          />
        ) : (
          <main className="chat-area">
            <ChannelsEmptyState
              onCreateChannel={() => setShowCreateChannelModal(true)}
              onExploreChannels={() => {
                alert('Explore trending channels: Sports, Entertainment, Tech, and News.');
              }}
            />
          </main>
        )
      )}

      {activeTab === 'communities' && (
        <main className="chat-area">
          <CommunitiesEmptyState
            onStartCommunity={() => setShowCreateCommunityModal(true)}
          />
        </main>
      )}

      {activeTab === 'meta_ai' && (
        <MetaAiChatView onBack={() => setActiveTab('chats')} />
      )}

      {activeTab === 'settings' && (
        <main className="chat-area">
          <ChatWindow
            currentUser={currentUser}
            conversation={null}
            messages={[]}
            onSendMessage={handleSendMessage}
            onBackToSidebar={() => setIsMobileOpen(true)}
            typingUsers={typingUsers}
            onStartCall={handleStartCall}
            onGoToCalls={() => setActiveTab('calls')}
            onSendDocument={() => setShowNewChatModal(true)}
            onAddContact={() => setShowNewChatModal(true)}
            onInviteFriend={() => {
              navigator.clipboard?.writeText(window.location.origin);
              alert('WhatsApp invite link copied to clipboard!');
            }}
            onNewCall={() => setActiveTab('calls')}
            onAskMetaAi={() => setActiveTab('meta_ai')}
          />
        </main>
      )}

      {/* 4. Modals */}
      {showNewChatModal && (
        <NewChatModal
          currentUser={currentUser}
          onClose={() => setShowNewChatModal(false)}
          onConversationCreated={(newConv) => {
            setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
            setActiveConversationId(newConv.id);
            setActiveTab('chats');
            setIsMobileOpen(false);
          }}
        />
      )}

      {activeCall && (
        <CallModal
          targetUserId={activeCall.targetUserId}
          targetName={activeCall.targetName}
          callerName={currentUser?.displayName || currentUser?.username || 'WhatsApp User'}
          isVideo={activeCall.isVideo}
          isIncoming={activeCall.isIncoming}
          incomingOfferData={activeCall.incomingOfferData}
          onHangup={handleHangupCall}
        />
      )}

      {/* Dialpad Modal */}
      <DialpadModal
        isOpen={showDialpadModal}
        onClose={() => setShowDialpadModal(false)}
        onStartCall={(num, isVideo) => {
          handleStartCall(num, isVideo);
        }}
      />

      {/* Status Viewer Story Modal */}
      {selectedStatus && (
        <StatusViewerModal
          status={selectedStatus}
          onClose={() => setSelectedStatus(null)}
          onSendReply={(replyText, contactName) => {
            console.log(`Reply to ${contactName}: ${replyText}`);
          }}
        />
      )}

      {/* Create Status Modal */}
      <CreateStatusModal
        isOpen={showCreateStatusModal}
        initialType={createStatusInitialType}
        onClose={() => setShowCreateStatusModal(false)}
        onStatusCreated={(newStatus) => {
          console.log('Status created:', newStatus);
        }}
      />

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={() => setShowCreateChannelModal(false)}
        onChannelCreated={(newCh) => {
          setSelectedChannel(newCh);
        }}
      />

      {/* Create Community Modal */}
      <CreateCommunityModal
        isOpen={showCreateCommunityModal}
        onClose={() => setShowCreateCommunityModal(false)}
        onCommunityCreated={(newComm) => {
          console.log('Community created:', newComm);
        }}
      />

      {/* Desktop Notification Prompt */}
      <NotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onGranted={() => {
          notificationService.syncDeviceToken();
        }}
      />
    </div>
  );
};
