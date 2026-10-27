import React from 'react';
import {
  MessageSquare,
  Phone,
  Radio,
  Users,
  Settings as SettingsIcon,
  Archive,
  CircleDashed,
} from 'lucide-react';
import { User } from '@chat/shared-types';

export type RailTab =
  | 'chats'
  | 'calls'
  | 'status'
  | 'channels'
  | 'communities'
  | 'meta_ai'
  | 'archived'
  | 'settings';

interface NavigationRailProps {
  activeTab: RailTab;
  onSelectTab: (tab: RailTab) => void;
  currentUser: User | null;
  unreadCount?: number;
  hasUnreadStatus?: boolean;
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
}) => {
  return (
    <nav className="wa-nav-rail" aria-label="Main Navigation">
      {/* Top action tabs */}
      <div className="wa-rail-top">
        {/* Chats Tab */}
        <button
          className={`wa-rail-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => onSelectTab('chats')}
          title="Chats"
          aria-label="Chats"
        >
          <div className="wa-rail-icon-wrapper">
            <MessageSquare size={22} />
            {unreadCount > 0 && (
              <span className="wa-rail-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>
        </button>

        {/* Calls Tab */}
        <button
          className={`wa-rail-btn ${activeTab === 'calls' ? 'active' : ''}`}
          onClick={() => onSelectTab('calls')}
          title="Calls"
          aria-label="Calls"
        >
          <div className="wa-rail-icon-wrapper">
            <Phone size={22} />
          </div>
        </button>

        {/* Status Tab */}
        <button
          className={`wa-rail-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => onSelectTab('status')}
          title="Status"
          aria-label="Status"
        >
          <div className="wa-rail-icon-wrapper">
            <CircleDashed size={22} />
            {hasUnreadStatus && <span className="wa-rail-dot" />}
          </div>
        </button>

        {/* Channels Tab */}
        <button
          className={`wa-rail-btn ${activeTab === 'channels' ? 'active' : ''}`}
          onClick={() => onSelectTab('channels')}
          title="Channels"
          aria-label="Channels"
        >
          <div className="wa-rail-icon-wrapper">
            <Radio size={22} />
          </div>
        </button>

        {/* Communities Tab */}
        <button
          className={`wa-rail-btn ${activeTab === 'communities' ? 'active' : ''}`}
          onClick={() => onSelectTab('communities')}
          title="Communities"
          aria-label="Communities"
        >
          <div className="wa-rail-icon-wrapper">
            <Users size={22} />
          </div>
        </button>

        {/* Meta AI Tab */}
        <button
          className={`wa-rail-btn wa-rail-ai ${activeTab === 'meta_ai' ? 'active' : ''}`}
          onClick={() => onSelectTab('meta_ai')}
          title="Ask Meta AI"
          aria-label="Ask Meta AI"
        >
          <div className="wa-rail-icon-wrapper">
            <MetaAiSwirlIcon size={24} />
          </div>
        </button>
      </div>

      {/* Bottom utility icons */}
      <div className="wa-rail-bottom">
        {/* Starred / Archived */}
        <button
          className={`wa-rail-btn ${activeTab === 'archived' ? 'active' : ''}`}
          onClick={() => onSelectTab('archived')}
          title="Archived"
          aria-label="Archived"
        >
          <div className="wa-rail-icon-wrapper">
            <Archive size={20} />
          </div>
        </button>

        {/* Settings */}
        <button
          className={`wa-rail-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
          title="Settings"
          aria-label="Settings"
          id="rail-settings-btn"
        >
          <div className="wa-rail-icon-wrapper">
            <SettingsIcon size={20} />
          </div>
        </button>

        {/* User Profile Avatar */}
        <button
          className="wa-rail-avatar-btn"
          onClick={() => onSelectTab('settings')}
          title={currentUser ? `${currentUser.displayName || currentUser.username} (Profile)` : 'Profile'}
          aria-label="User Profile"
        >
          <div className="avatar wa-rail-user-avatar">
            {currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
          </div>
        </button>
      </div>
    </nav>
  );
};
