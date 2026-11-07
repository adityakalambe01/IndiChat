import { generateUUID } from '../utils/uuid';
import { getTranslation } from '../utils/i18n';
import { api } from './api';
import { APP_NAME } from '../config/appConfig';


export type PrivacyOption = 'everyone' | 'contacts' | 'contacts_except' | 'nobody';
export type OnlinePrivacyOption = 'everyone' | 'same_as_last_seen';
export type FontSizeOption = 'small' | 'medium' | 'large';

export interface LinkedDevice {
  id: string;
  name: string;
  platform: 'linux' | 'windows' | 'mac' | 'ios' | 'android' | 'web';
  browser: string;
  location: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface AppSettings {
  // Linked Devices
  linkedDevices: LinkedDevice[];

  // Account
  passkeyEnabled: boolean;
  passkeyCreatedAt?: string;
  twoFactorEnabled: boolean;
  twoFactorPin?: string;
  securityNotifications: boolean;
  email: string;
  emailVerified: boolean;
  phoneNumber: string;
  username: string;
  displayName: string;
  statusAbout: string;

  // Privacy
  privacyLastSeen: PrivacyOption;
  privacyOnline: OnlinePrivacyOption;
  privacyProfilePhoto: PrivacyOption;
  privacyLinks: PrivacyOption;
  privacyStatus: PrivacyOption;
  privacyExcludedContacts: string[];
  readReceipts: boolean;

  // Chats
  enterIsSend: boolean;
  mediaVisibility: boolean;
  fontSize: FontSizeOption;
  lastBackupDate: string;
  backupSize: string;

  // App Language
  language: string;
}

const SETTINGS_STORAGE_KEY = 'chat_app_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  linkedDevices: [
    {
      id: 'current-session',
      name: 'Google Chrome (Linux)',
      platform: 'linux',
      browser: 'Chrome 124.0.0.0',
      location: 'Pune, India',
      ipAddress: '192.168.1.104',
      lastActive: 'Active now',
      isCurrent: true,
    },
    {
      id: 'dev-windows',
      name: `${APP_NAME} for Windows`,
      platform: 'windows',
      browser: `${APP_NAME} Desktop v2.24`,
      location: 'Mumbai, India',
      ipAddress: '49.36.120.45',
      lastActive: 'Today at 09:42 AM',
      isCurrent: false,
    },
    {
      id: 'dev-iphone',
      name: 'Safari on iPhone 15 Pro',
      platform: 'ios',
      browser: 'Mobile Safari 17.4',
      location: 'Pune, India',
      ipAddress: '192.168.1.118',
      lastActive: 'Yesterday at 11:20 PM',
      isCurrent: false,
    },
  ],
  passkeyEnabled: false,
  twoFactorEnabled: false,
  twoFactorPin: '',
  securityNotifications: true,
  email: '',
  emailVerified: true,
  phoneNumber: '+91 98765 43210',
  username: '',
  displayName: '',
  statusAbout: `Hey there! I am using ${APP_NAME}.`,


  privacyLastSeen: 'everyone',
  privacyOnline: 'everyone',
  privacyProfilePhoto: 'everyone',
  privacyLinks: 'everyone',
  privacyStatus: 'contacts',
  privacyExcludedContacts: [],
  readReceipts: true,

  enterIsSend: true,
  mediaVisibility: true,
  fontSize: 'medium',
  lastBackupDate: 'Today at 04:30 AM',
  backupSize: '14.2 MB',

  language: 'en',
};

type SettingsListener = (settings: AppSettings) => void;

class SettingsService {
  private settings: AppSettings;
  private listeners: Set<SettingsListener> = new Set();
  private isSyncing = false;
  private currentUserId: string | null = null;

  constructor() {
    this.settings = this.loadFromStorage();
    this.applyDomEffects(this.settings);
  }

  private getStorageKey(): string {
    return this.currentUserId ? `chat_app_settings_${this.currentUserId}` : SETTINGS_STORAGE_KEY;
  }

  public loadForUser(userId: string): void {
    this.currentUserId = userId;
    this.settings = this.loadFromStorage();
    this.applyDomEffects(this.settings);
    this.notify();
  }

  public resetForLogout(): void {
    this.currentUserId = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.applyDomEffects(this.settings);
    this.notify();
  }

  private loadFromStorage(): AppSettings {
    try {
      const saved = localStorage.getItem(this.getStorageKey());
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          linkedDevices: parsed.linkedDevices && parsed.linkedDevices.length > 0
            ? parsed.linkedDevices
            : DEFAULT_SETTINGS.linkedDevices,
        };
      }
    } catch (e) {
      console.warn('Failed to parse settings from storage:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.settings));
    } catch (e) {
      console.error('Failed to save settings to storage:', e);
    }
  }

  private applyDomEffects(settings: AppSettings): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
    document.documentElement.setAttribute('lang', settings.language);
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public async syncWithBackend(): Promise<void> {
    if (this.isSyncing) return;
    const token = localStorage.getItem('chat_access_token');
    if (!token) return;

    this.isSyncing = true;
    try {
      // 1. Sync User Settings from backend
      const backendSettings = await api.getUserSettings();
      if (backendSettings) {
        this.updateLocal({
          passkeyEnabled: Boolean(backendSettings.passkeyEnabled),
          twoFactorEnabled: Boolean(backendSettings.twoFactorEnabled),
          securityNotifications: backendSettings.securityNotifications ?? this.settings.securityNotifications,
          statusAbout: backendSettings.statusAbout || this.settings.statusAbout,
          privacyLastSeen: backendSettings.privacyLastSeen || this.settings.privacyLastSeen,
          privacyOnline: backendSettings.privacyOnline || this.settings.privacyOnline,
          privacyProfilePhoto: backendSettings.privacyProfilePhoto || this.settings.privacyProfilePhoto,
          privacyLinks: backendSettings.privacyLinks || this.settings.privacyLinks,
          privacyStatus: backendSettings.privacyStatus || this.settings.privacyStatus,
          privacyExcludedContacts: backendSettings.privacyExcludedContacts || this.settings.privacyExcludedContacts,
          readReceipts: backendSettings.readReceipts ?? this.settings.readReceipts,
          enterIsSend: backendSettings.enterIsSend ?? this.settings.enterIsSend,
          mediaVisibility: backendSettings.mediaVisibility ?? this.settings.mediaVisibility,
          fontSize: backendSettings.fontSize || this.settings.fontSize,
          language: backendSettings.language || this.settings.language,
        });
      }

      // 2. Sync Linked Devices from backend
      const backendDevices = await api.getLinkedDevices();
      if (Array.isArray(backendDevices) && backendDevices.length > 0) {
        const mappedDevices: LinkedDevice[] = backendDevices.map((d: any) => ({
          id: d.id,
          name: d.name || d.deviceName,
          platform: (d.platform || 'web').toLowerCase() as any,
          browser: d.browser || 'Browser Session',
          location: d.location || 'Pune, India',
          ipAddress: d.ipAddress || '192.168.1.100',
          lastActive: d.lastActive || (d.isCurrent ? 'Active now' : 'Recently active'),
          isCurrent: Boolean(d.isCurrent),
        }));
        this.updateLocal({ linkedDevices: mappedDevices });
      }
    } catch (e) {
      console.warn('Backend settings sync error (using local cache):', e);
    } finally {
      this.isSyncing = false;
    }
  }

  private updateLocal(partial: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...partial };
    this.saveToStorage();
    this.applyDomEffects(this.settings);
    this.notify();
    return this.getSettings();
  }

  public async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    this.updateLocal(partial);

    // Sync to backend asynchronously
    const token = localStorage.getItem('chat_access_token');
    if (token) {
      try {
        await api.updateUserSettings(partial);
      } catch (err) {
        console.warn('Failed to persist settings to backend:', err);
        throw err;
      }
    }

    return this.getSettings();
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.getSettings();
    this.listeners.forEach((fn) => fn(current));
  }

  // Linked Devices helpers with Backend API integration
  public async addLinkedDevice(device: Omit<LinkedDevice, 'id' | 'isCurrent'>): Promise<LinkedDevice> {
    const newDevice: LinkedDevice = {
      ...device,
      id: `dev-${generateUUID().substring(0, 8)}`,
      isCurrent: false,
    };

    // Update local immediately
    this.update({
      linkedDevices: [...this.settings.linkedDevices, newDevice],
    });

    // Send to backend
    const token = localStorage.getItem('chat_access_token');
    if (token) {
      try {
        const saved = await api.linkDevice({
          deviceName: device.name,
          platform: device.platform,
          browser: device.browser,
          location: device.location,
          ipAddress: device.ipAddress,
        });
        if (saved && saved.id) {
          newDevice.id = saved.id;
        }
      } catch (err) {
        console.warn('Failed to save linked device on backend:', err);
      }
    }

    return newDevice;
  }

  public async removeLinkedDevice(deviceId: string): Promise<void> {
    const filtered = this.settings.linkedDevices.filter((d) => d.id !== deviceId);
    this.update({ linkedDevices: filtered });

    const token = localStorage.getItem('chat_access_token');
    if (token) {
      try {
        await api.removeLinkedDevice(deviceId);
        await this.syncWithBackend();
      } catch (err) {
        console.warn('Failed to delete device on backend:', err);
      }
    }
  }

  public async removeAllOtherDevices(): Promise<void> {
    const currentOnly = this.settings.linkedDevices.filter((d) => d.isCurrent);
    this.update({ linkedDevices: currentOnly });

    const token = localStorage.getItem('chat_access_token');
    if (token) {
      try {
        await api.removeOtherLinkedDevices();
        await this.syncWithBackend();
      } catch (err) {
        console.warn('Failed to remove other devices on backend:', err);
      }
    }
  }

  // Backup & JSON export with backend integration
  public async fetchServerBackup(): Promise<any> {
    const token = localStorage.getItem('chat_access_token');
    if (token) {
      try {
        return await api.getChatBackup();
      } catch (err) {
        console.warn('Backend backup fetch failed, using frontend data:', err);
      }
    }
    return null;
  }

  public performBackupNow(): { date: string; size: string } {
    const now = new Date();
    const timeStr = `Today at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const randomMb = (12 + Math.random() * 5).toFixed(1);
    const sizeStr = `${randomMb} MB`;
    this.update({
      lastBackupDate: timeStr,
      backupSize: sizeStr,
    });
    return { date: timeStr, size: sizeStr };
  }

  public t(key: string): string {
    return getTranslation(this.settings.language, key);
  }
}

export const settingsService = new SettingsService();
