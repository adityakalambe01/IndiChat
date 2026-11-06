import React, { useState } from 'react';
import { Bell, Volume2, ShieldCheck } from 'lucide-react';
import { AppSettings, settingsService } from '../../services/settings';
import { notificationService } from '../../services/notifications';

interface NotificationsSettingsViewProps {
  settings: AppSettings;
}

export const NotificationsSettingsView: React.FC<NotificationsSettingsViewProps> = ({ settings }) => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('wa_sound_alerts') !== 'false';
  });
  const [notifsStatus, setNotifsStatus] = useState(() => notificationService.getPermissionStatus());

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('wa_sound_alerts', String(enabled));
  };

  const handleRequestPermission = async () => {
    const res = await notificationService.requestPermission();
    setNotifsStatus(res);
    if (res === 'granted') {
      notificationService.showNotification('WhatsApp', {
        body: 'Notifications are now active for incoming messages.',
      });
    }
  };

  return (
    <div className="wa-notifications-settings-content" style={{ padding: '16px 0' }}>
      {/* Desktop Alerts */}
      <div className="settings-item" onClick={handleRequestPermission}>
        <div className="settings-icon-badge badge-green">
          <Bell size={20} />
        </div>
        <div className="settings-item-content">
          <span className="settings-item-title">Desktop Notifications</span>
          <span className="settings-item-subtitle">
            Status: {notifsStatus === 'granted' ? 'Allowed ✅' : notifsStatus === 'denied' ? 'Blocked ❌' : 'Default (click to allow)'}
          </span>
        </div>
      </div>

      {/* Sound Alerts */}
      <div
        className="settings-item"
        onClick={() => handleToggleSound(!soundEnabled)}
      >
        <div className="settings-icon-badge badge-blue">
          <Volume2 size={20} />
        </div>
        <div className="settings-item-content">
          <span className="settings-item-title">Message Sounds</span>
          <span className="settings-item-subtitle">
            Play sounds for incoming and outgoing messages
          </span>
        </div>
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={() => {}}
          className="settings-toggle-checkbox"
        />
      </div>

      {/* Security Alerts */}
      <div
        className="settings-item"
        onClick={() => settingsService.update({ securityNotifications: !settings.securityNotifications })}
      >
        <div className="settings-icon-badge badge-teal">
          <ShieldCheck size={20} />
        </div>
        <div className="settings-item-content">
          <span className="settings-item-title">Show security notifications</span>
          <span className="settings-item-subtitle">
            Get notified when your security code changes for a contact's phone
          </span>
        </div>
        <input
          type="checkbox"
          checked={settings.securityNotifications}
          onChange={() => {}}
          className="settings-toggle-checkbox"
        />
      </div>
    </div>
  );
};
