import React from 'react';
import {
  MessageSquare,
  Phone,
  Radio,
  Users,
  Settings as SettingsIcon,
  Archive,
  CircleDashed,
  Star,
} from 'lucide-react';
import { User } from '@chat/shared-types';

export type RailTab =
  | 'chats'
  | 'calls'
  | 'status'
  | 'channels'
  | 'communities'
  | 'starred'
  | 'meta_ai'
  | 'archived'
  | 'settings';

interface NavigationRailProps {
  activeTab: RailTab;
  onSelectTab: (tab: RailTab) => void;
  currentUser: User | null;
  unreadCount?: number;
  hasUnreadStatus?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

/**
 * Modern Meta AI 8-petal glowing swirl icon
 */
export const MetaAiSwirlIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <defs>
        <linearGradient id="metaAiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      {/* 8-ring swirl structure */}
      <circle cx="12" cy="12" r="9" stroke="url(#metaAiGradient)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="3 3.5" />
      <circle cx="12" cy="12" r="5" stroke="url(#metaAiGradient)" strokeWidth="2" strokeDasharray="2 3" opacity="0.85" />
      <circle cx="12" cy="12" r="1.8" fill="url(#metaAiGradient)" />
    </svg>
  );
};

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  unreadCount = 0,
  hasUnreadStatus = true,
  theme = 'dark',
  onToggleTheme,
}) => {
  const initials = currentUser?.displayName
    ? currentUser.displayName.slice(0, 2).toUpperCase()
    : (currentUser?.username?.slice(0, 2).toUpperCase() || 'RK');

  return (
    <nav className="app-nav-rail" aria-label="Primary navigation">
      {/* IndiChat Logo */}
      <div className="rail-logo" title="IndiChat">i</div>

      {/* Primary Rail Items */}
      <div className="rail-items">
        {/* Chats Tab */}
        <button
          className={`rail-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => onSelectTab('chats')}
          title="Chats"
          aria-label="Chats tab"
          data-rail-tab="chats"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {unreadCount > 0 && (
            <span className="rail-badge" id="railChatsBadge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Status Tab */}
        <button
          className={`rail-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => onSelectTab('status')}
          title="Status"
          aria-label="Status updates"
          data-rail-tab="status"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </button>

        {/* Calls Tab */}
        <button
          className={`rail-btn ${activeTab === 'calls' ? 'active' : ''}`}
          onClick={() => onSelectTab('calls')}
          title="Calls"
          aria-label="Calls log"
          data-rail-tab="calls"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>

        {/* Communities Tab */}
        <button
          className={`rail-btn ${activeTab === 'communities' ? 'active' : ''}`}
          onClick={() => onSelectTab('communities')}
          title="Communities"
          aria-label="Communities & Circles"
          data-rail-tab="communities"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>

        {/* Starred Messages Tab */}
        <button
          className={`rail-btn ${activeTab === 'starred' ? 'active' : ''}`}
          onClick={() => onSelectTab('starred')}
          title="Starred"
          aria-label="Starred messages"
          data-rail-tab="starred"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>

      {/* Rail Bottom */}
      <div className="rail-bottom">
        <button
          className="rail-btn theme-toggle-btn"
          id="railThemeToggleBtn"
          aria-label="Toggle theme"
          title="Toggle Light/Dark Theme"
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
        <button
          className={`rail-btn ${activeTab === 'settings' ? 'active' : ''}`}
          id="railSettingsBtn"
          aria-label="Open settings"
          title="Settings"
          data-rail-tab="settings"
          onClick={() => onSelectTab('settings')}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <div
          className="rail-user-avatar"
          id="railUserAvatarBtn"
          title={currentUser ? `${currentUser.displayName || currentUser.username} (Profile)` : 'Profile'}
          role="button"
          tabIndex={0}
          onClick={() => onSelectTab('settings')}
        >
          {initials}
          <div className="rail-user-online-dot" />
        </div>
      </div>
    </nav>
  );
};
