import React, { useState } from 'react';
import { User, Conversation, Message } from '@chat/shared-types';
import {
  Search,
  Check,
  CheckCheck,
  Users,
  MoreVertical,
  Plus,
  BellOff,
  X,
  Archive,
  Clock,
  Settings as SettingsIcon,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { notificationService, NotificationPermissionStatus } from '../../services/notifications';
import { SettingsView, SettingsSubView } from '../settings/SettingsView';
import { APP_NAME } from '../../config/appConfig';

type FilterType = 'all' | 'unread' | 'favourites' | 'groups';

interface ChatSidebarProps {
  currentUser: User;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onOpenNewChat: () => void;
  onLogout: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isMobileOpen: boolean;
  messages?: Message[];
  onUpdateUser?: (updated: Partial<User>) => void;
  onClearAllMessages?: () => void;
  onDeleteAllChats?: () => void;
  onOpenArchived?: () => void;
  onOpenStarred?: () => void;
  onOpenCommunities?: () => void;
  onOpenSettings?: () => void;
  typingUsers?: Record<string, boolean>;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  currentUser,
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewChat,
  onLogout,
  theme,
  onToggleTheme,
  isMobileOpen,
  messages = [],
  onUpdateUser,
  onClearAllMessages,
  onDeleteAllChats,
  onOpenArchived,
  onOpenStarred,
  onOpenCommunities,
  onOpenSettings,
  typingUsers = {},
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSubView, setSettingsSubView] = useState<SettingsSubView>('menu');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => notificationService.isDismissed());
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermissionStatus>(() =>
    notificationService.getPermissionStatus()
  );

  const handleToggleNotifications = async () => {
    if (!notificationService.isSupported()) {
      alert('Desktop notifications are not supported in this browser.');
      return;
    }

    if (notificationStatus === 'granted') {
      notificationService.showNotification('WhatsApp Notifications', {
        body: 'Push notifications are enabled and active!',
        username: currentUser.username || currentUser.displayName,
      });
      return;
    }

    const res = await notificationService.requestPermission();
    setNotificationStatus(res);
    if (res === 'granted') {
      setIsBannerDismissed(true);
      notificationService.showNotification('WhatsApp Notifications Active', {
        body: 'You will now receive desktop alerts for incoming messages.',
        username: currentUser.username || currentUser.displayName,
      });
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const title = getConversationTitle(c, currentUser.id).toLowerCase();
    const query = searchQuery.toLowerCase();
    if (!title.includes(query)) return false;

    if (activeFilter === 'unread') {
      return (c.unreadCount || 0) > 0;
    }
    if (activeFilter === 'groups') {
      return c.type === 'GROUP';
    }
    if (activeFilter === 'favourites') {
      const favs: string[] = JSON.parse(localStorage.getItem('wa_favourite_chat_ids') || '[]');
      return favs.includes(c.id);
    }
    return true;
  });

  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  function getConversationTitle(c: Conversation, currentUserId: string): string {
    if (c.type === 'GROUP' && c.title) return c.title;
    const otherMember = c.members.find((m) => m.userId !== currentUserId);
    return otherMember?.user?.displayName || otherMember?.user?.username || 'Chat';
  }

  function getOtherMember(c: Conversation, currentUserId: string) {
    if (c.type === 'GROUP') return null;
    return c.members.find((m) => m.userId !== currentUserId);
  }

  function formatTime(isoStr?: string): string {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    }
    return date.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  function renderReceipt(lastMsg: Conversation['lastMessage']) {
    if (!lastMsg || lastMsg.senderId !== currentUser.id) return null;
    const isRead = lastMsg.receipts?.some((r) => r.readAt != null) || lastMsg.status === 'read';
    const isDelivered = lastMsg.receipts?.some((r) => r.deliveredAt != null) || lastMsg.status === 'delivered';

    if (isRead) {
      return <span className="read-tick cyan" title="Read" style={{ marginRight: '4px' }}>✓✓</span>;
    }
    if (isDelivered) {
      return <span className="read-tick" title="Delivered" style={{ marginRight: '4px' }}>✓✓</span>;
    }
    return <span className="read-tick" title="Sent" style={{ marginRight: '4px' }}>✓</span>;
  }

  function renderMessageSnippet(msg: Conversation['lastMessage']): string {
    if (!msg) return 'No messages yet';
    if (msg.type === 'STICKER') return '🏷️ Sticker';
    if (msg.type === 'IMAGE') {
      try {
        const data = JSON.parse(msg.content);
        if (data.isGif || data.fileName?.toLowerCase().endsWith('.gif') || data.fileUrl?.toLowerCase().includes('.gif')) {
          return '🎞️ GIF';
        }
        return data.caption ? `📷 ${data.caption}` : '📷 Photo';
      } catch {
        return msg.content?.toLowerCase().includes('.gif') ? '🎞️ GIF' : '📷 Photo';
      }
    }
    if (msg.type === 'VIDEO') return '🎥 Video';
    if (msg.type === 'AUDIO') return '🎵 Audio';
    if (msg.type === 'DOCUMENT') {
      try {
        const data = JSON.parse(msg.content);
        return `📄 ${data.fileName || 'Document'}`;
      } catch {
        return '📄 Document';
      }
    }
    return msg.content || '';
  }

  if (isSettingsOpen) {
    return (
      <aside className={`app-sidebar ${!isMobileOpen ? 'collapsed' : ''}`}>
        <SettingsView
          currentUser={currentUser}
          conversations={conversations}
          messages={messages}
          onClose={() => setIsSettingsOpen(false)}
          onLogout={onLogout}
          onUpdateUser={onUpdateUser}
          onClearAllMessages={onClearAllMessages}
          onDeleteAllChats={onDeleteAllChats}
          initialSubView={settingsSubView}
        />
      </aside>
    );
  }

  return (
    <aside className={`app-sidebar ${!isMobileOpen ? 'collapsed' : ''}`} aria-label="Conversations and views list">
      <div className="sidebar-view active" id="sidebarView-chats">
        {/* Chats Header matching Approved Preview */}
        <div className="sidebar-header">
          <h1>Chats</h1>

          <div className="sidebar-actions">
            <button
              className="icon-btn"
              onClick={onOpenNewChat}
              title="New Chat"
              aria-label="New chat"
              id="btnNewChatHeader"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <button
              className="icon-btn"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              title="Menu"
              aria-label="Menu"
              id="btnSidebarMenu"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>

            {showMoreMenu && (
              <div className="sidebar-dropdown-menu" id="sidebarDropdownMenu" style={{ display: 'flex' }} role="menu">
                <button
                  className="menu-item-row"
                  id="menuActionNewGroup"
                  role="menuitem"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenNewChat();
                  }}
                >
                  👥 New Group
                </button>
                <button
                  className="menu-item-row"
                  id="menuActionStarred"
                  role="menuitem"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenStarred?.();
                  }}
                >
                  ★ Starred Messages
                </button>
                <button
                  className="menu-item-row"
                  id="menuActionMarkAllRead"
                  role="menuitem"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onClearAllMessages?.();
                  }}
                >
                  ✓ Mark All as Read
                </button>
                <button
                  className="menu-item-row"
                  id="menuActionSettings"
                  role="menuitem"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenSettings ? onOpenSettings() : setIsSettingsOpen(true);
                  }}
                >
                  ⚙ Settings
                </button>
                <button
                  className="menu-item-row"
                  id="menuActionTheme"
                  role="menuitem"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onToggleTheme();
                  }}
                >
                  {theme === 'dark' ? '☀ Light Mode' : '🌙 Dark Mode'}
                </button>
                <button
                  className="menu-item-row"
                  id="menuActionLogout"
                  role="menuitem"
                  style={{ color: 'var(--accent-danger, #ef4444)' }}
                  onClick={() => {
                    setShowMoreMenu(false);
                    onLogout();
                  }}
                >
                  🚪 Log Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search Bar matching Preview */}
        <div className="sidebar-search-box">
          <div className="search-input-wrap">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              id="sidebarSearchInput"
              placeholder="Search or start new chat"
              aria-label="Search chats"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="filter-chips-bar" role="tablist" aria-label="Chat filters">
          <button
            className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
            data-filter="all"
            role="tab"
            aria-selected={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-chip ${activeFilter === 'unread' ? 'active' : ''}`}
            data-filter="unread"
            role="tab"
            aria-selected={activeFilter === 'unread'}
            onClick={() => setActiveFilter('unread')}
          >
            Unread
          </button>
          <button
            className={`filter-chip ${activeFilter === 'groups' ? 'active' : ''}`}
            data-filter="groups"
            role="tab"
            aria-selected={activeFilter === 'groups'}
            onClick={() => setActiveFilter('groups')}
          >
            Groups
          </button>
        </div>

        {/* Conversations Scroll List */}
        <div className="conversations-scroll" id="conversationList" role="region" aria-label="Chat conversations">
          {filteredConversations.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              {searchQuery ? 'No chats found matching your search.' : 'No conversations yet.'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const title = getConversationTitle(conv, currentUser.id);
              const other = getOtherMember(conv, currentUser.id);
              const isOnline = other?.user?.isOnline || (other ? typingUsers[other.userId] : false);
              const isActive = conv.id === activeConversationId;
              const unread = conv.unreadCount || 0;
              const isContactTyping = other ? Boolean(typingUsers[other.userId]) : false;
              const avatarInitials = conv.type === 'GROUP' ? 'GP' : title.slice(0, 2).toUpperCase();
              const avatarBg = conv.type === 'GROUP' ? 'var(--brand-teal)' : '#005c4b';

              return (
                <div
                  key={conv.id}
                  className={`conversation-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectConversation(conv.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="convo-avatar" style={{ background: avatarBg }}>
                    {avatarInitials}
                    {isOnline && <div className="online-indicator" />}
                  </div>

                  <div className="convo-body">
                    <div className="convo-top">
                      <span className="convo-name">{title}</span>
                      <span className="convo-time">
                        {formatTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                      </span>
                    </div>

                    <div className="convo-bottom">
                      <span className="convo-snippet">
                        {renderReceipt(conv.lastMessage)}
                        <span>
                          {isContactTyping ? 'typing...' : renderMessageSnippet(conv.lastMessage)}
                        </span>
                      </span>

                      {unread > 0 && (
                        <span className="unread-pill">{unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
