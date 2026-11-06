import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User as UserIcon,
  Key,
  Lock,
  MessageSquare,
  Bell,
  Keyboard,
  HelpCircle,
  LogOut,
  Search,
  Laptop,
} from 'lucide-react';
import { User, Conversation, Message } from '@chat/shared-types';
import { AppSettings, settingsService } from '../../services/settings';
import { SUPPORTED_LANGUAGES, getTranslation } from '../../utils/i18n';
import { LinkedDevicesView } from './LinkedDevicesView';
import { AccountView } from './AccountView';
import { PrivacyView } from './PrivacyView';
import { ChatsSettingsView } from './ChatsSettingsView';
import { ProfileView } from './ProfileView';
import { NotificationsSettingsView } from './NotificationsSettingsView';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

export type SettingsSubView =
  | 'menu'
  | 'profile'
  | 'account'
  | 'privacy'
  | 'chats'
  | 'notifications'
  | 'linked_devices';

interface SettingsViewProps {
  currentUser: User;
  conversations: Conversation[];
  messages: Message[];
  onClose: () => void;
  onLogout: () => void;
  onUpdateUser?: (updated: Partial<User>) => void;
  onClearAllMessages?: () => void;
  onDeleteAllChats?: () => void;
  initialSubView?: SettingsSubView;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  conversations,
  messages,
  onClose,
  onLogout,
  onUpdateUser,
  onClearAllMessages,
  onDeleteAllChats,
  initialSubView = 'menu',
}) => {
  const [subView, setSubView] = useState<SettingsSubView>(initialSubView);
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.getSettings());
  const [searchQuery, setSearchQuery] = useState('');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return localStorage.getItem(`wa_custom_avatar_${currentUser.id}`) || '';
  });

  useEffect(() => {
    const unsub = settingsService.subscribe((newSettings) => {
      setSettings(newSettings);
    });
    return unsub;
  }, []);

  const getSubViewTitle = (view: SettingsSubView): string => {
    switch (view) {
      case 'profile':
        return 'Profile';
      case 'account':
        return 'Account';
      case 'privacy':
        return 'Privacy';
      case 'chats':
        return 'Chats';
      case 'notifications':
        return 'Notifications';
      case 'linked_devices':
        return 'Linked devices';
      default:
        return currentUser.displayName || currentUser.username || 'Settings';
    }
  };

  const handleHeaderBack = () => {
    if (subView === 'menu') {
      onClose();
    } else {
      setSubView('menu');
    }
  };

  const handleEditMood = () => {
    const current = settings.statusAbout || 'Current mood';
    const newMood = prompt('Set current mood / about status:', current);
    if (newMood !== null && newMood.trim()) {
      settingsService.update({ statusAbout: newMood.trim() });
    }
  };

  return (
    <div className="settings-drawer-container">
      {/* Top Header matching Screenshot */}
      <div className="wa-settings-top-header">
        {subView !== 'menu' && (
          <button
            className="icon-btn"
            onClick={handleHeaderBack}
            title="Back to settings"
            aria-label="Back"
            style={{ marginRight: '8px' }}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="wa-settings-name-title">{getSubViewTitle(subView)}</h1>
      </div>

      {/* Main Content */}
      <div className="settings-drawer-body">
        {subView === 'menu' && (
          <div className="wa-settings-menu-scroll">
            {/* Search Input matching Screenshot */}
            <div className="sidebar-search" style={{ padding: '4px 16px 12px 16px' }}>
              <div className="search-input-wrapper">
                <Search size={18} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Profile Hero Center matching Screenshot */}
            <div className="wa-settings-hero-profile">
              {/* Speech bubble pointing down */}
              <div
                className="wa-mood-speech-bubble"
                onClick={handleEditMood}
                title="Click to edit current mood"
                role="button"
                tabIndex={0}
              >
                <span>{settings.statusAbout || 'Current mood'}</span>
                <div className="wa-bubble-tail" />
              </div>

              {/* Large circular avatar */}
              <div
                className="wa-settings-hero-avatar-wrap"
                onClick={() => setSubView('profile')}
                title="Click to view profile"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={currentUser.displayName}
                    className="wa-settings-hero-img"
                    onError={() => setAvatarUrl('')}
                  />
                ) : (
                  <div
                    className="wa-settings-hero-img wa-settings-hero-fallback"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--accent, #00a884)',
                      color: '#ffffff',
                      fontSize: '44px',
                      fontWeight: 600,
                      borderRadius: '50%',
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp Settings Menu Items matching Screenshot */}
            <div className="wa-settings-clean-list">
              {/* 1. Profile */}
              <div
                className="wa-clean-item"
                onClick={() => setSubView('profile')}
                id="menu-item-profile"
              >
                <div className="wa-clean-item-icon">
                  <UserIcon size={22} />
                </div>
                <div className="wa-clean-item-text">
                  <span className="wa-clean-item-title">Profile</span>
                  <span className="wa-clean-item-sub">Name, profile picture, username</span>
                </div>
              </div>

              {/* 2. Account */}
              <div
                className="wa-clean-item"
                onClick={() => setSubView('account')}
                id="menu-item-account"
              >
                <div className="wa-clean-item-icon">
                  <Key size={22} />
                </div>
                <div className="wa-clean-item-text">
                  <span className="wa-clean-item-title">Account</span>
                  <span className="wa-clean-item-sub">Security notifications, account info</span>
                </div>
              </div>

              {/* 3. Privacy */}
              <div
                className="wa-clean-item"
                onClick={() => setSubView('privacy')}
                id="menu-item-privacy"
              >
                <div className="wa-clean-item-icon">
                  <Lock size={22} />
                </div>
                <div className="wa-clean-item-text">
                  <span className="wa-clean-item-title">Privacy</span>
                  <span className="wa-clean-item-sub">Blocked contacts, disappearing messages</span>
                </div>
              </div>

              {/* 4. Chats */}
              <div
                className="wa-clean-item"
                onClick={() => setSubView('chats')}
                id="menu-item-chats"
              >
                <div className="wa-clean-item-icon">
                  <MessageSquare size={22} />
                </div>
                <div className="wa-clean-item-text">
                  <span className="wa-clean-item-title">Chats</span>
                  <span className="wa-clean-item-sub">Theme, wallpaper, chat settings</span>
                </div>
              </div>

              {/* 5. Notifications */}
              <div
                className="wa-clean-item"
                onClick={() => setSubView('notifications')}
                id="menu-item-notifications"
              >
                <div className="wa-clean-item-icon">
                  <Bell size={22} />
                </div>
                <div className="wa-clean-item-text">
                  <span className="wa-clean-item-title">Notifications</span>
                  <span className="wa-clean-item-sub">Messages, groups, sounds</span>
                </div>
              </div>

              {/* 6. Linked devices */}
              <div
                className="wa-clean-item"
                onClick={() => setSubView('linked_devices')}
                id="menu-item-linked-devices"
              >
                <div className="wa-clean-item-icon">
                  <Laptop size={22} />
                </div>
                <div className="wa-clean-item-text">
                  <span className="wa-clean-item-title">Linked devices</span>
                  <span className="wa-clean-item-sub">See active devices and remote logout</span>
                </div>
              </div>

              {/* 7. Keyboard shortcuts */}
              <div
                className="wa-clean-item"
                onClick={() => setShowShortcutsModal(true)}
                id="menu-item-shortcuts"
              >
                <div className="wa-clean-item-icon">
                  <Keyboard size={22} />
                </div>
                <div className="wa-clean-item-text">
                  <span className="wa-clean-item-title">Keyboard shortcuts</span>
                  <span className="wa-clean-item-sub">Keyboard shortcuts</span>
                </div>
              </div>

              {/* 8. Help */}
              <div
                className="wa-clean-item"
                onClick={() => alert('WhatsApp Web Help: FAQs, Privacy policy, and contact support.')}
                id="menu-item-help"
              >
                <div className="wa-clean-item-icon">
                  <HelpCircle size={22} />
                </div>
                <div className="wa-clean-item-text">
                  <span className="wa-clean-item-title">Help</span>
                  <span className="wa-clean-item-sub">Help centre, contact us, privacy policy</span>
                </div>
              </div>

              {/* 9. Log out */}
              <div
                className="wa-clean-item wa-clean-logout"
                onClick={onLogout}
                id="menu-item-logout"
              >
                <div className="wa-clean-item-icon" style={{ color: '#ef4444' }}>
                  <LogOut size={22} />
                </div>
                <div className="wa-clean-item-text">
                  <span className="wa-clean-item-title" style={{ color: '#ef4444' }}>Log out</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SubViews */}
        {subView === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            settings={settings}
            onUpdateUser={onUpdateUser}
            avatarUrl={avatarUrl}
            onAvatarChange={(url) => setAvatarUrl(url)}
          />
        )}

        {subView === 'account' && (
          <AccountView
            currentUser={currentUser}
            settings={settings}
            onLogout={onLogout}
            onUpdateUser={onUpdateUser}
          />
        )}

        {subView === 'privacy' && (
          <PrivacyView
            currentUser={currentUser}
            conversations={conversations}
            settings={settings}
          />
        )}

        {subView === 'chats' && (
          <ChatsSettingsView
            currentUser={currentUser}
            settings={settings}
            messages={messages}
            conversations={conversations}
            onClearAllMessages={onClearAllMessages}
            onDeleteAllChats={onDeleteAllChats}
          />
        )}

        {subView === 'notifications' && (
          <NotificationsSettingsView settings={settings} />
        )}

        {subView === 'linked_devices' && (
          <LinkedDevicesView
            settings={settings}
            onBack={() => setSubView('menu')}
          />
        )}
      </div>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};
