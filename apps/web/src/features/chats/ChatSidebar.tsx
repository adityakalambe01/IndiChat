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
    const isRead = lastMsg.receipts?.some((r) => r.readAt != null);
    const isDelivered = lastMsg.receipts?.some((r) => r.deliveredAt != null);

    if (isRead) {
      return <CheckCheck size={15} className="receipt-icon read" />;
    }
    if (isDelivered) {
      return <CheckCheck size={15} className="receipt-icon delivered" />;
    }
    return <Check size={15} className="receipt-icon sent" />;
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
      <aside className={`sidebar ${!isMobileOpen ? 'collapsed' : ''}`}>
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
    <aside className={`sidebar ${!isMobileOpen ? 'collapsed' : ''}`}>
      {/* WhatsApp Header matching Screenshot 1 */}
      <div className="wa-sidebar-header">
        <h1 className="wa-header-title">WhatsApp</h1>

        <div className="wa-header-actions">
          {/* 3-dots Menu */}
          <div style={{ position: 'relative' }}>
            <button
              className="icon-btn"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              title="More options"
              aria-label="More options"
            >
              <MoreVertical size={20} />
            </button>

            {showMoreMenu && (
              <div className="wa-dropdown-menu">
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenNewChat();
                  }}
                >
                  <span>New group</span>
                </button>
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenCommunities?.();
                  }}
                >
                  <span>New community</span>
                </button>
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenArchived?.();
                  }}
                >
                  <span>Starred messages</span>
                </button>
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onOpenSettings ? onOpenSettings() : setIsSettingsOpen(true);
                  }}
                >
                  <SettingsIcon size={16} />
                  <span>Settings</span>
                </button>
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onToggleTheme();
                  }}
                >
                  <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </button>
                <button
                  className="wa-dropdown-item"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onLogout();
                  }}
                  style={{ color: '#ef4444' }}
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>

          {/* Green circular '+' button */}
          <button
            className="wa-header-green-btn"
            onClick={onOpenNewChat}
            title="New chat"
            aria-label="New chat"
            id="btn-whatsapp-new-chat"
          >
            <Plus size={20} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search or start a new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Chips Pills Row matching Screenshot 1 */}
      <div className="wa-filter-chips-row">
        <button
          className={`wa-filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All
        </button>

        <button
          className={`wa-filter-chip ${activeFilter === 'unread' ? 'active' : ''}`}
          onClick={() => setActiveFilter('unread')}
        >
          <span>Unread</span>
          {totalUnreadCount > 0 && (
            <span className="wa-chip-badge">{totalUnreadCount}</span>
          )}
        </button>

        <button
          className={`wa-filter-chip ${activeFilter === 'favourites' ? 'active' : ''}`}
          onClick={() => setActiveFilter('favourites')}
        >
          Favourites
        </button>

        <button
          className={`wa-filter-chip ${activeFilter === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveFilter('groups')}
        >
          Groups
        </button>

        <button
          className="wa-filter-chip wa-filter-add"
          onClick={() => {
            alert('Custom label filters: You can organize your chats with custom tags and labels.');
          }}
          title="Add custom filter"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Notification Banner matching Screenshot 1 */}
      {!isBannerDismissed && notificationStatus !== 'granted' && (
        <div className="sidebar-notification-banner" onClick={handleToggleNotifications}>
          <div className="sidebar-notification-banner-icon">
            <BellOff size={18} color="#00a884" />
          </div>
          <div className="sidebar-notification-banner-content">
            <span className="sidebar-notification-banner-title">
              Message and call notifications are off.{' '}
              <span className="sidebar-notification-banner-link">Turn on</span>
            </span>
          </div>
          <button
            className="sidebar-notification-banner-close"
            onClick={(e) => {
              e.stopPropagation();
              setIsBannerDismissed(true);
              notificationService.setDismissed(true);
            }}
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Archived Row matching Screenshot 1 */}
      <div
        className="wa-archived-row"
        onClick={() => (onOpenArchived ? onOpenArchived() : setActiveFilter('all'))}
        role="button"
        tabIndex={0}
      >
        <div className="wa-archived-left">
          <Archive size={19} className="wa-archived-icon" />
          <span className="wa-archived-title">Archived</span>
        </div>
        <span className="wa-archived-count">18</span>
      </div>

      {/* Conversation List */}
      <div className="conversation-list">
        {filteredConversations.length === 0 ? (
          <div className="wa-empty-list-notice">
            {searchQuery ? 'No chats found matching your search.' : (
              <div>
                <p>No conversations in this filter.</p>
                <button
                  className="btn-primary"
                  style={{ marginTop: '12px', padding: '8px 16px', fontSize: '0.85rem' }}
                  onClick={onOpenNewChat}
                >
                  Start a Chat
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const title = getConversationTitle(conv, currentUser.id);
            const other = getOtherMember(conv, currentUser.id);
            const isOnline = other?.user?.isOnline;
            const isActive = conv.id === activeConversationId;
            const unread = conv.unreadCount || 0;
            const isContactTyping = other ? Boolean(typingUsers[other.userId]) : false;

            return (
              <div
                key={conv.id}
                className={`conversation-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className={`avatar ${isOnline ? 'online' : ''}`}>
                  {conv.type === 'GROUP' ? <Users size={20} /> : title.charAt(0).toUpperCase()}
                </div>

                <div className="conversation-content">
                  <div className="conversation-row">
                    <span className="conversation-title">{title}</span>
                    <span
                      className="conversation-time"
                      style={unread > 0 ? { color: '#25d366', fontWeight: 600 } : undefined}
                    >
                      {formatTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                    </span>
                  </div>

                  <div className="conversation-subtitle">
                    <div className="last-message-snippet">
                      {!isContactTyping && renderReceipt(conv.lastMessage)}

                      {isContactTyping ? (
                        <span className="wa-typing-snippet">typing...</span>
                      ) : (
                        <span>{renderMessageSnippet(conv.lastMessage)}</span>
                      )}
                    </div>

                    {unread > 0 && (
                      <span className="badge-unread">{unread}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
