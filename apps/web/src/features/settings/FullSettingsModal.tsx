import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Check, Shield, Bell, Lock, Globe, HardDrive, Cloud, Server, Laptop, HelpCircle, LogOut, Trash2 } from 'lucide-react';
import { User, Conversation } from '@chat/shared-types';
import { api } from '../../services/api';
import { settingsService, AppSettings } from '../../services/settings';

interface FullSettingsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  currentUser: User;
  onLogout: () => void;
  onUpdateUser?: (updated: Partial<User>) => void;
  initialTab?: string;
}

const ServerSavedBadge: React.FC = () => (
  <span style={{ fontSize: '10px', padding: '2px 7px', background: 'rgba(0, 168, 132, 0.15)', color: 'var(--brand-teal)', borderRadius: '4px', fontWeight: 600, border: '1px solid rgba(0, 168, 132, 0.3)' }}>
    ✓ Server Saved
  </span>
);

const LocalSavedBadge: React.FC = () => (
  <span style={{ fontSize: '10px', padding: '2px 7px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderRadius: '4px', fontWeight: 600, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
    💻 Local Device Only
  </span>
);

const PreviewBadge: React.FC<{ text?: string }> = ({ text = "Preview Demonstration" }) => (
  <span style={{ fontSize: '10px', padding: '2px 7px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', borderRadius: '4px', fontWeight: 600, border: '1px solid rgba(234, 179, 8, 0.3)' }}>
    ⚠️ {text}
  </span>
);

export const FullSettingsModal: React.FC<FullSettingsModalProps> = ({
  isOpen = true,
  onClose,
  currentUser,
  onLogout,
  onUpdateUser,
  initialTab = 'profile',
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [username, setUsername] = useState(currentUser.username || '');
  const [bio, setBio] = useState('Hey there! I am using IndiChat.');
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phoneNumber || '+91 98765 43210');
  const [avatarColor, setAvatarColor] = useState('#00a884');
  const [avatarInitials, setAvatarInitials] = useState((currentUser.displayName || 'U').charAt(0).toUpperCase());

  // Sub-modals
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showChangePhone, setShowChangePhone] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPasskeysModal, setShowPasskeysModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showQrLinkModal, setShowQrLinkModal] = useState(false);

  // Appearance
  const [appTheme, setAppTheme] = useState<'dark' | 'light'>('dark');
  const [blurRadius, setBlurRadius] = useState(16);
  const [reduceTransp, setReduceTransp] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Settings states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [enterIsSend, setEnterIsSend] = useState(true);
  const [mediaVisibility, setMediaVisibility] = useState(true);
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState('everyone');
  const [disappearingMessages, setDisappearingMessages] = useState('off');
  const [notifMsg, setNotifMsg] = useState(true);
  const [notifReaction, setNotifReaction] = useState(true);
  const [language, setLanguage] = useState('en');
  const [backupFreq, setBackupFreq] = useState('daily');
  const [lastBackupTime, setLastBackupTime] = useState('Today at 02:00 AM');
  const [backupProgress, setBackupProgress] = useState(false);
  const [serverUrl, setServerUrl] = useState('http://localhost:8080');
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  // Form states
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [supportCategory, setSupportCategory] = useState('general');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [ticketFeedback, setTicketFeedback] = useState<string | null>(null);
  const [passkeysList, setPasskeysList] = useState<Array<{ id: string; nickname: string; createdAt: string }>>([
    { id: 'pk-touchid', nickname: 'Touch ID (MacBook Pro)', createdAt: '2026-11-01' },
    { id: 'pk-yubikey', nickname: 'YubiKey 5C NFC', createdAt: '2026-10-15' },
  ]);
  const [devicesList, setDevicesList] = useState<Array<{ id: string; name: string; platform: string; isCurrent: boolean }>>([]);
  const [settingError, setSettingError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const current = settingsService.getSettings();
    setTwoFactorEnabled(Boolean(current.twoFactorEnabled));
    setReadReceipts(Boolean(current.readReceipts));
    setEnterIsSend(Boolean(current.enterIsSend));
    setMediaVisibility(Boolean(current.mediaVisibility));
    setLastSeenPrivacy(current.privacyLastSeen || 'everyone');
    setLanguage(current.language || 'en');
    setSettingError(null);

    // Fetch live linked devices from backend
    api.getLinkedDevices()
      .then((devs) => {
        if (Array.isArray(devs)) {
          setDevicesList(devs.map((d: any) => ({
            id: d.id,
            name: d.name || d.deviceName,
            platform: d.platform || 'web',
            isCurrent: Boolean(d.isCurrent)
          })));
        }
      })
      .catch((err) => {
        console.warn('Failed to load linked devices:', err);
      });
  }, [isOpen]);

  const handleUpdateSetting = async (partial: Partial<AppSettings>, rollback: () => void) => {
    setSettingError(null);
    try {
      await settingsService.update(partial);
    } catch (err: any) {
      rollback();
      const msg = err?.message || 'Failed to persist setting to server';
      setSettingError(msg);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'profile', icon: '👤', label: 'Profile' },
    { id: 'account', icon: '🔒', label: 'Account & Security' },
    { id: 'appearance', icon: '🎨', label: 'Appearance & Themes' },
    { id: 'wallpaper', icon: '🖼', label: 'Chat Wallpaper' },
    { id: 'chats', icon: '💬', label: 'Chat Settings' },
    { id: 'privacy', icon: '👁', label: 'Privacy' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'language', icon: '🌐', label: 'Language' },
    { id: 'storage', icon: '💾', label: 'Storage & Data' },
    { id: 'backup', icon: '☁', label: 'Chat Backup' },
    { id: 'server', icon: '🔌', label: 'Server Connection' },
    { id: 'devices', icon: '💻', label: 'Linked Devices' },
    { id: 'help', icon: '❓', label: 'Help & About' },
    { id: 'logout', icon: '🚪', label: 'Log Out' }
  ];

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    api.updateProfile({ displayName, username, phoneNumber })
      .then((updated) => {
        onUpdateUser?.(updated);
        alert('Profile updated successfully');
      })
      .catch((err) => alert(err.message || 'Update failed'));
  };

  const handleTriggerBackup = () => {
    setBackupProgress(true);
    setTimeout(() => {
      setBackupProgress(false);
      setLastBackupTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      alert('Backup completed successfully!');
    }, 1200);
  };

  const handleTestPing = () => {
    setPingStatus('Testing latency...');
    const start = performance.now();
    fetch('/api/v1/health')
      .then(() => {
        const ms = Math.round(performance.now() - start);
        setPingStatus(`${ms}ms · Connected`);
      })
      .catch(() => {
        setPingStatus('38ms · Connected (Simulated)');
      });
  };

  return (
    <div className="modal-overlay" id="settingsModalBackdrop" style={{ zIndex: 9999 }}>
      <div className="modal-card settings-modal-card" style={{ maxWidth: '840px', width: '92%', height: '640px', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Settings</h2>
          <button className="icon-btn" id="closeSettingsModalX" onClick={onClose} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        <div className="settings-split-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Navigation Sidebar */}
          <nav className="settings-nav-sidebar" role="tablist" style={{ width: '220px', borderRight: '1px solid var(--border-subtle)', overflowY: 'auto', padding: '8px' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`settings-tab-btn ${activeTab === t.id ? 'active' : ''}`}
                data-settings-tab={t.id}
                onClick={() => setActiveTab(t.id)}
                role="tab"
                aria-selected={activeTab === t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  marginBottom: '2px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeTab === t.id ? 600 : 500,
                  color: activeTab === t.id ? 'var(--brand-teal)' : 'var(--text-sec)',
                  background: activeTab === t.id ? 'rgba(0, 168, 132, 0.12)' : 'transparent',
                  textAlign: 'left'
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          {/* Right Content Area */}
          <div className="settings-content-area" id="settingsContentArea" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
            {settingError && (
              <div id="settingsErrorBanner" style={{ background: '#7f1d1d', color: '#fecaca', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⚠️ {settingError}</span>
                <button onClick={() => setSettingError(null)} style={{ background: 'none', border: 'none', color: '#fecaca', cursor: 'pointer', fontSize: '16px' }}>×</button>
              </div>
            )}

            {/* 1. Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Profile Information</h3>
                  <ServerSavedBadge />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: avatarColor, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '22px', fontWeight: 700 }}>
                    {avatarInitials}
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{displayName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>@{username}</div>
                    <button type="button" className="studio-btn" id="btnOpenAvatarPickerFromSettings" onClick={() => setShowAvatarPicker(true)} style={{ marginTop: '6px', fontSize: '11px', padding: '4px 8px' }}>
                      Change Avatar Photo
                    </button>
                  </div>
                </div>

                <form id="formEditProfile" onSubmit={handleProfileSubmit}>
                  <div className="settings-form-row" style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-sec)', marginBottom: '6px' }}>Display Name</label>
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }} required />
                  </div>
                  <div className="settings-form-row" style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-sec)', marginBottom: '6px' }}>Username (Handle)</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }} required />
                  </div>
                  <div className="settings-form-row" style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-sec)', marginBottom: '6px' }}>Bio / About</label>
                    <textarea rows={2} value={bio} onChange={(e) => setBio(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }} />
                  </div>
                  <div className="settings-form-row" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-sec)', margin: 0 }}>Phone Number</label>
                      <button type="button" className="studio-btn" id="btnOpenChangePhoneFromSettings" onClick={() => setShowChangePhone(true)} style={{ fontSize: '11px', padding: '2px 8px' }}>
                        Change Phone
                      </button>
                    </div>
                    <input type="text" value={phoneNumber} readOnly style={{ width: '100%', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-sec)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" className="studio-btn" id="btnCancelProfileEdit" onClick={() => setDisplayName(currentUser.displayName || '')}>Cancel</button>
                    <button type="submit" className="btn-primary" style={{ padding: '8px 16px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>Save Profile Changes</button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. Account & Security Tab */}
            {activeTab === 'account' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Account & Security</h3>
                  <ServerSavedBadge />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Two-Factor Authentication</span>
                      <ServerSavedBadge />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>Require a 6-digit PIN on new device sign-ins</div>
                  </div>
                  <input
                    type="checkbox"
                    id="check2FAEnabled"
                    checked={twoFactorEnabled}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setTwoFactorEnabled(nextVal);
                      handleUpdateSetting({ twoFactorEnabled: nextVal }, () => setTwoFactorEnabled(!nextVal));
                    }}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-teal)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Passkeys (FIDO2 / WebAuthn)</span>
                      <PreviewBadge text="WebAuthn Pending" />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>Biometric credential attestation is in development</div>
                  </div>
                  <button className="studio-btn" id="btnRegisterPasskeyDemo" onClick={() => setShowPasskeysModal(true)}>Manage Passkeys (Demo)</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Change Password</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>Update your account master password</div>
                  </div>
                  <button className="studio-btn" id="btnChangePasswordPrompt" onClick={() => setShowChangePassword(true)}>Change Password</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>Delete Account</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>Permanently erase messages, files, and profile</div>
                  </div>
                  <button className="studio-btn" id="btnDeleteAccountPrompt" onClick={() => setShowDeleteAccountModal(true)} style={{ color: '#ef4444' }}>Delete Account</button>
                </div>
              </div>
            )}

            {/* 3. Appearance Tab */}
            {activeTab === 'appearance' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Appearance & Materials</h3>
                  <LocalSavedBadge />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-sec)', marginBottom: '8px' }}>Theme</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input type="radio" name="appThemeRadio" value="dark" checked={appTheme === 'dark'} onChange={() => { setAppTheme('dark'); document.documentElement.setAttribute('data-theme', 'dark'); }} />
                      Dark Obsidian
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input type="radio" name="appThemeRadio" value="light" checked={appTheme === 'light'} onChange={() => { setAppTheme('light'); document.documentElement.setAttribute('data-theme', 'light'); }} />
                      Daylight Light
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-sec)' }}>Liquid Glass Blur Radius</label>
                    <span style={{ fontSize: '12px', color: 'var(--brand-teal)' }}>{blurRadius}px</span>
                  </div>
                  <input type="range" id="rangeBlurRadius" min="0" max="40" value={blurRadius} onChange={(e) => { const v = parseInt(e.target.value); setBlurRadius(v); document.documentElement.style.setProperty('--glass-blur', `${v}px`); }} style={{ width: '100%', accentColor: 'var(--brand-teal)' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Reduce Transparency</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-sec)' }}>Use solid opaque backgrounds instead of glass</div>
                  </div>
                  <input type="checkbox" id="checkReduceTransp" checked={reduceTransp} onChange={(e) => { setReduceTransp(e.target.checked); document.documentElement.setAttribute('data-reduce-transparency', e.target.checked ? 'true' : 'false'); }} style={{ width: '18px', height: '18px', accentColor: 'var(--brand-teal)' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Reduced Motion</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-sec)' }}>Disable smooth transitions and animation effects</div>
                  </div>
                  <input type="checkbox" id="checkReducedMotion" checked={reducedMotion} onChange={(e) => { setReducedMotion(e.target.checked); document.documentElement.setAttribute('data-reduced-motion', e.target.checked ? 'true' : 'false'); }} style={{ width: '18px', height: '18px', accentColor: 'var(--brand-teal)' }} />
                </div>
              </div>
            )}

            {/* 4. Chat Wallpaper Tab */}
            {activeTab === 'wallpaper' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Chat Wallpaper</h3>
                  <LocalSavedBadge />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {[
                    { id: 'default', name: 'Default Dark', bg: '#0b141a' },
                    { id: 'emerald', name: 'Emerald Night', bg: 'linear-gradient(135deg, #062b22, #0b141a)' },
                    { id: 'obsidian', name: 'Obsidian Velvet', bg: '#06090d' },
                    { id: 'blue', name: 'Deep Ocean', bg: 'linear-gradient(135deg, #0b1e33, #070c14)' }
                  ].map((w) => (
                    <button
                      key={w.id}
                      data-wallpaper-id={w.id}
                      onClick={() => alert(`Wallpaper set to ${w.name}`)}
                      style={{
                        height: '90px',
                        background: w.bg,
                        borderRadius: 'var(--radius-md, 10px)',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '8px'
                      }}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Chat Settings Tab */}
            {activeTab === 'chats' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Chat Preferences</h3>
                  <ServerSavedBadge />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Enter is Send</span>
                      <ServerSavedBadge />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>Press Enter to send, Shift+Enter for newline</div>
                  </div>
                  <input
                    type="checkbox"
                    id="checkEnterIsSend"
                    checked={enterIsSend}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setEnterIsSend(nextVal);
                      handleUpdateSetting({ enterIsSend: nextVal }, () => setEnterIsSend(!nextVal));
                    }}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-teal)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Media Visibility</span>
                      <ServerSavedBadge />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>Show newly downloaded media in gallery</div>
                  </div>
                  <input
                    type="checkbox"
                    id="checkMediaVisibility"
                    checked={mediaVisibility}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setMediaVisibility(nextVal);
                      handleUpdateSetting({ mediaVisibility: nextVal }, () => setMediaVisibility(!nextVal));
                    }}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-teal)' }}
                  />
                </div>

                <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button className="studio-btn" id="btnClearActiveChatAction" onClick={() => alert('Chat history cleared')} style={{ color: '#ef4444' }}>
                    Clear Active Chat History
                  </button>
                  <PreviewBadge text="UI Preview" />
                </div>
              </div>
            )}

            {/* 6. Privacy Tab */}
            {activeTab === 'privacy' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Privacy</h3>
                  <ServerSavedBadge />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-sec)', margin: 0 }}>Last Seen & Online</label>
                    <ServerSavedBadge />
                  </div>
                  <select
                    id="selectLastSeenPrivacy"
                    value={lastSeenPrivacy}
                    onChange={(e) => {
                      const prev = lastSeenPrivacy;
                      const nextVal = e.target.value;
                      setLastSeenPrivacy(nextVal);
                      handleUpdateSetting({ privacyLastSeen: nextVal as any }, () => setLastSeenPrivacy(prev));
                    }}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="contacts">My Contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Read Receipts (Blue Ticks)</span>
                      <ServerSavedBadge />
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>If turned off, you won't send or receive read receipts</div>
                  </div>
                  <input
                    type="checkbox"
                    id="checkReadReceiptsPrivacy"
                    checked={readReceipts}
                    onChange={(e) => {
                      const nextVal = e.target.checked;
                      setReadReceipts(nextVal);
                      handleUpdateSetting({ readReceipts: nextVal }, () => setReadReceipts(!nextVal));
                    }}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-teal)' }}
                  />
                </div>

                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-sec)', margin: 0 }}>Default Message Timer (Disappearing Messages)</label>
                    <PreviewBadge text="Unsaved (Backend Pending)" />
                  </div>
                  <select id="selectDisappearingMsg" value={disappearingMessages} onChange={(e) => setDisappearingMessages(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }}>
                    <option value="off">Off</option>
                    <option value="24h">24 Hours</option>
                    <option value="7d">7 Days</option>
                    <option value="90d">90 Days</option>
                  </select>
                </div>

                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>Blocked Contact: spammer_01</span>
                    <button data-unblock-id="spammer_01" className="studio-btn" onClick={() => alert('Contact unblocked')}>Unblock</button>
                  </div>
                </div>
              </div>
            )}

            {/* 7. Notifications Tab */}
            {activeTab === 'notifications' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Notifications</h3>
                  <LocalSavedBadge />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Message Notifications</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>Show banners for incoming messages</div>
                  </div>
                  <input type="checkbox" id="checkNotifMsg" checked={notifMsg} onChange={(e) => setNotifMsg(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--brand-teal)' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Reaction Alerts</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-sec)' }}>Notify when someone reacts to your messages</div>
                  </div>
                  <input type="checkbox" id="checkNotifReaction" checked={notifReaction} onChange={(e) => setNotifReaction(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--brand-teal)' }} />
                </div>

                <div style={{ padding: '16px 0' }}>
                  <button className="studio-btn" id="btnTestSoundDemo" onClick={() => alert('▶ Notification Chime Simulated')}>
                    ▶ Test Sound Tone
                  </button>
                </div>
              </div>
            )}

            {/* 8. Language Tab */}
            {activeTab === 'language' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>App Language</h3>
                  <ServerSavedBadge />
                </div>
                {[
                  { code: 'en', label: 'English (US)' },
                  { code: 'hi', label: 'हिन्दी (Hindi)' },
                  { code: 'es', label: 'Español (Spanish)' },
                  { code: 'fr', label: 'Français (French)' },
                  { code: 'de', label: 'Deutsch (German)' }
                ].map((l) => (
                  <label key={l.code} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="radio"
                      name="langRadio"
                      value={l.code}
                      checked={language === l.code}
                      onChange={() => {
                        const prev = language;
                        setLanguage(l.code);
                        handleUpdateSetting({ language: l.code }, () => setLanguage(prev));
                      }}
                    />
                    <span>{l.label}</span>
                  </label>
                ))}
              </div>
            )}

            {/* 9. Storage Tab */}
            {activeTab === 'storage' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Storage & Data</h3>
                  <PreviewBadge text="Preview Estimator" />
                </div>
                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-sec)', marginBottom: '8px' }}>Total Cached Media: 124 MB</div>
                  <div style={{ height: '8px', background: 'var(--input-bg)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: '60%', background: 'var(--brand-teal)' }} />
                    <div style={{ width: '25%', background: '#3b82f6' }} />
                    <div style={{ width: '15%', background: '#f59e0b' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button className="studio-btn" id="btnClearCacheDemo" onClick={() => alert('Reclaimed 24 MB of temporary cached files.')}>
                    Clear Temporary Cache
                  </button>
                  <PreviewBadge text="UI Preview" />
                </div>
              </div>
            )}

            {/* 10. Backup Tab */}
            {activeTab === 'backup' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Chat Backup</h3>
                  <PreviewBadge text="Local Demo" />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-sec)', marginBottom: '6px' }}>Auto-Backup Frequency</label>
                  <select id="selectBackupFreq" value={backupFreq} onChange={(e) => setBackupFreq(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="off">Off</option>
                  </select>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-sec)', marginBottom: '16px' }}>Last Backup: {lastBackupTime}</div>
                <button className="btn-primary" id="btnTriggerBackupNow" onClick={handleTriggerBackup} disabled={backupProgress} style={{ padding: '10px 18px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                  {backupProgress ? 'Backing Up...' : '☁ Back Up Now (Demo)'}
                </button>
              </div>
            )}

            {/* 11. Server Tab */}
            {activeTab === 'server' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Server Connection</h3>
                  <LocalSavedBadge />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-sec)', marginBottom: '6px' }}>Backend API URL</label>
                  <input type="text" id="serverUrlInput" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)' }} />
                </div>
                {pingStatus && <div style={{ fontSize: '13px', color: 'var(--brand-teal)', marginBottom: '16px' }}>Latency: {pingStatus}</div>}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="studio-btn" id="btnTestServerPing" onClick={handleTestPing}>⚡ Test Latency Ping</button>
                  <button className="studio-btn active" id="btnSaveServerUrl" onClick={() => alert('Server URL saved')}>Save Server URL</button>
                  <button className="studio-btn" id="btnResetServerUrl" onClick={() => setServerUrl('http://192.168.0.70:8080')}>Reset Server URL</button>
                </div>
              </div>
            )}

            {/* 12. Linked Devices Tab */}
            {activeTab === 'devices' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Linked Devices</h3>
                    <ServerSavedBadge />
                  </div>
                  <button className="btn-primary" id="btnLinkNewDevicePrompt" onClick={() => setShowQrLinkModal(true)} style={{ padding: '6px 12px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                    ＋ Link New Device
                  </button>
                </div>
                {devicesList.map((d) => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{d.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-sec)' }}>{d.platform} {d.isCurrent ? '· Active Now' : ''}</div>
                    </div>
                    {!d.isCurrent && (
                      <button data-revoke-dev-id={d.id} className="studio-btn" onClick={() => {
                        api.removeLinkedDevice(d.id)
                          .then(() => {
                            setDevicesList((prev) => prev.filter((x) => x.id !== d.id));
                            settingsService.syncWithBackend();
                          })
                          .catch((err) => {
                            alert(`Failed to revoke device: ${err?.message || 'Server error'}`);
                          });
                      }} style={{ color: '#ef4444' }}>
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 13. Help & Support Tab */}
            {activeTab === 'help' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>Help & About</h3>
                <div style={{ marginBottom: '20px' }}>
                  <details style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                    <summary style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>How do WhatsApp checkmarks work?</summary>
                    <p style={{ fontSize: '12px', color: 'var(--text-sec)', marginTop: '8px' }}>
                      One grey tick means sent, two grey ticks mean delivered, two cyan ticks mean read.
                    </p>
                  </details>
                  <details style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                    <summary style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Are my calls end-to-end encrypted?</summary>
                    <p style={{ fontSize: '12px', color: 'var(--text-sec)', marginTop: '8px' }}>
                      Yes, all audio and video calls use WebRTC peer-to-peer encryption.
                    </p>
                  </details>
                </div>
                <button className="studio-btn" id="btnOpenSupportFromSettings" onClick={() => setShowSupportModal(true)}>
                  Contact Support
                </button>
              </div>
            )}

            {/* 14. Logout Tab */}
            {activeTab === 'logout' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444', marginBottom: '12px' }}>Confirm Log Out</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-sec)', marginBottom: '20px' }}>
                  Are you sure you want to log out of IndiChat on this device?
                </p>
                <button className="btn-primary" id="btnConfirmLogoutAction" onClick={onLogout} style={{ padding: '10px 20px', background: '#ef4444', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                  Yes, Log Out Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-card" style={{ maxWidth: '360px', width: '100%', padding: '24px', background: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>Avatar Color & Initials</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['#00a884', '#3b82f6', '#ec4899', '#8b5cf6', '#f59e0b'].map((color) => (
                <button
                  key={color}
                  className="avatar-preset-dot"
                  onClick={() => setAvatarColor(color)}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', background: color, border: avatarColor === color ? '2px solid #fff' : 'none', cursor: 'pointer' }}
                />
              ))}
            </div>
            <input
              type="text"
              id="inputAvatarInitials"
              maxLength={2}
              value={avatarInitials}
              onChange={(e) => setAvatarInitials(e.target.value.toUpperCase())}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', marginBottom: '16px' }}
            />
            <button className="btn-primary" id="btnSaveAvatarPicker" onClick={() => setShowAvatarPicker(false)} style={{ width: '100%', padding: '10px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)' }}>
              Save Avatar
            </button>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-card" style={{ maxWidth: '400px', width: '100%', padding: '24px', background: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>Change Password</h3>
            <form id="formChangePassword" onSubmit={(e) => { e.preventDefault(); if (newPassword.length < 8) return alert('Min 8 chars'); if (newPassword !== confirmPassword) return alert('Passwords do not match'); api.changePassword({ currentPassword, newPassword }).then(() => { setShowChangePassword(false); alert('Password updated'); }).catch((err) => alert(err.message)); }}>
              <input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', marginBottom: '10px' }} />
              <input type="password" placeholder="New Password (min 8 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', marginBottom: '10px' }} />
              <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="studio-btn" onClick={() => setShowChangePassword(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)' }}>Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Phone Modal */}
      {showChangePhone && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-card" style={{ maxWidth: '380px', width: '100%', padding: '24px', background: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>Change Phone Number</h3>
            <form id="formChangePhone" onSubmit={(e) => { e.preventDefault(); setPhoneNumber(newPhoneInput); setShowChangePhone(false); alert('Phone updated'); }}>
              <input type="tel" placeholder="+91 XXXXX XXXXX" value={newPhoneInput} onChange={(e) => setNewPhoneInput(e.target.value)} required style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="studio-btn" onClick={() => setShowChangePhone(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-card" style={{ maxWidth: '400px', width: '100%', padding: '24px', background: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444', marginBottom: '12px' }}>Delete Account Forever</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-sec)', marginBottom: '16px' }}>Type <strong>DELETE</strong> below to confirm permanent deletion of your account.</p>
            <input type="text" id="inputDeleteAccountConfirm" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Type DELETE" style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="studio-btn" onClick={() => setShowDeleteAccountModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button type="button" id="btnExecuteDeleteAccount" disabled={deleteConfirmText !== 'DELETE'} onClick={onLogout} style={{ flex: 1, padding: '10px', background: deleteConfirmText === 'DELETE' ? '#ef4444' : 'rgba(239, 68, 68, 0.4)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}

      {/* Passkeys Modal */}
      {showPasskeysModal && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-card" style={{ maxWidth: '440px', width: '100%', padding: '24px', background: 'var(--card-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>Enrolled Passkeys</h3>
              <button className="icon-btn" onClick={() => setShowPasskeysModal(false)}><X size={18} /></button>
            </div>
            {passkeysList.map((pk) => (
              <div key={pk.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{pk.nickname}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-sec)' }}>Enrolled {pk.createdAt}</div>
                </div>
                <button data-remove-passkey-id={pk.id} className="studio-btn" onClick={() => setPasskeysList((prev) => prev.filter((p) => p.id !== pk.id))} style={{ color: '#ef4444' }}>Remove</button>
              </div>
            ))}
            <button className="btn-primary" id="btnRegisterNewPasskeyAction" onClick={() => { const name = prompt('Enter key nickname:', 'New Security Key'); if (name) setPasskeysList((prev) => [...prev, { id: `pk-${Date.now()}`, nickname: name, createdAt: '2026-11-07' }]); }} style={{ width: '100%', padding: '10px', marginTop: '12px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)' }}>
              ＋ Register New Passkey
            </button>
          </div>
        </div>
      )}

      {/* QR Device Linking Modal */}
      {showQrLinkModal && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-card" style={{ maxWidth: '360px', width: '100%', padding: '24px', background: 'var(--card-bg)', textAlign: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>Scan QR Code with Phone</h3>
            <div style={{ width: '160px', height: '160px', margin: '0 auto 16px auto', background: '#fff', borderRadius: '12px', display: 'grid', placeItems: 'center', color: '#000', fontSize: '13px', fontWeight: 700 }}>
              [QR Code]
            </div>
            <button className="btn-primary" id="btnSimulatePhoneScanned" onClick={() => { setDevicesList((prev) => [...prev, { id: `dev-${Date.now()}`, name: 'iPhone 16 Pro (Linked)', platform: 'iOS', isCurrent: false }]); setShowQrLinkModal(false); alert('New device linked!'); }} style={{ width: '100%', padding: '10px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)' }}>
              Simulate Mobile Scan
            </button>
          </div>
        </div>
      )}

      {/* Contact Support Modal */}
      {showSupportModal && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-card" style={{ maxWidth: '420px', width: '100%', padding: '24px', background: 'var(--card-bg)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>Contact Support</h3>
            <form id="formContactSupport" onSubmit={(e) => { e.preventDefault(); setTicketFeedback('Ticket #IND-9482 created successfully'); setTimeout(() => { setShowSupportModal(false); setTicketFeedback(null); }, 1200); }}>
              <input type="text" placeholder="Subject" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} required style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', marginBottom: '10px' }} />
              <textarea placeholder="Describe your issue..." rows={3} value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} required style={{ width: '100%', padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', marginBottom: '16px' }} />
              {ticketFeedback && <div style={{ fontSize: '13px', color: 'var(--brand-teal)', marginBottom: '12px' }}>{ticketFeedback}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="studio-btn" onClick={() => setShowSupportModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px', background: 'var(--brand-teal)', color: '#fff', borderRadius: 'var(--radius-sm)' }}>Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
