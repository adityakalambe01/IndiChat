import { generateUUID } from '../utils/uuid';
import { api } from './api';
import { storage, STORAGE_KEYS } from './storage';

export type PrivacyOption = 'everyone' | 'contacts' | 'contacts_except' | 'nobody';
export type OnlinePrivacyOption = 'everyone' | 'same_as_last_seen';
export type FontSizeOption = 'small' | 'medium' | 'large';
export type AppearanceModeOption = 'system' | 'light' | 'dark';
export type ReducedMotionOption = 'system' | 'on' | 'off';

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

export interface MobileAppSettings {
  // Linked Devices
  linkedDevices: LinkedDevice[];

  // Account
  passkeyEnabled: boolean;
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

  // Appearance & Materials (Client-side preferences)
  appearanceMode: AppearanceModeOption;
  blurRadius: number; // 0 to 40 blur level (maps to native intensity 0-100)
  reduceTransparency: boolean;
  reducedMotion: ReducedMotionOption;
}

const DEFAULT_SETTINGS: MobileAppSettings = {
  linkedDevices: [],
  passkeyEnabled: false,
  twoFactorEnabled: false,
  twoFactorPin: '',
  securityNotifications: true,
  email: '',
  emailVerified: true,
  phoneNumber: '+91 98765 43210',
  username: '',
  displayName: '',
  statusAbout: 'Hey there! I am using IndiChat.',

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
  lastBackupDate: 'Never',
  backupSize: '0 MB',

  language: 'en',

  // System accessibility defaults
  appearanceMode: 'system',
  blurRadius: 20,
  reduceTransparency: false,
  reducedMotion: 'system',
};

type SettingsListener = (settings: MobileAppSettings) => void;

class SettingsService {
  private settings: MobileAppSettings = { ...DEFAULT_SETTINGS };
  private listeners = new Set<SettingsListener>();
  private isSyncing = false;
  private currentUserId: string | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    const saved = await storage.getJson<MobileAppSettings>(STORAGE_KEYS.SETTINGS);
    if (saved) {
      this.settings = { ...DEFAULT_SETTINGS, ...saved };
      this.notify();
    }
  }

  public async loadForUser(userId: string): Promise<void> {
    this.currentUserId = userId;
    const key = `${STORAGE_KEYS.SETTINGS}_${userId}`;
    const saved = await storage.getJson<MobileAppSettings>(key);
    if (saved) {
      this.settings = { ...DEFAULT_SETTINGS, ...saved };
    } else {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    this.notify();
  }

  public resetForLogout(): void {
    this.currentUserId = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.notify();
  }

  private async persist(): Promise<void> {
    const key = this.currentUserId ? `${STORAGE_KEYS.SETTINGS}_${this.currentUserId}` : STORAGE_KEYS.SETTINGS;
    await storage.setJson(key, this.settings);
  }

  public getSettings(): MobileAppSettings {
    return { ...this.settings };
  }

  public async syncWithBackend(): Promise<void> {
    if (this.isSyncing) return;
    const token = await storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
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
      if (Array.isArray(backendDevices)) {
        const mappedDevices: LinkedDevice[] = backendDevices.map((d: any) => ({
          id: d.id,
          name: d.name || d.deviceName,
          platform: (d.platform || 'android').toLowerCase() as any,
          browser: d.browser || 'App Session',
          location: d.location || 'Local Device',
          ipAddress: d.ipAddress || '127.0.0.1',
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

  public updateLocal(partial: Partial<MobileAppSettings>): MobileAppSettings {
    this.settings = { ...this.settings, ...partial };
    this.persist();
    this.notify();
    return this.getSettings();
  }

  public update(partial: Partial<MobileAppSettings>): MobileAppSettings {
    this.updateLocal(partial);

    // Sync only backend-supported fields asynchronously
    const backendKeys = [
      'passkeyEnabled',
      'twoFactorEnabled',
      'securityNotifications',
      'statusAbout',
      'privacyLastSeen',
      'privacyOnline',
      'privacyProfilePhoto',
      'privacyLinks',
      'privacyStatus',
      'privacyExcludedContacts',
      'readReceipts',
      'enterIsSend',
      'mediaVisibility',
      'fontSize',
      'language',
    ] as const;

    const backendPayload: any = {};
    let hasBackendKey = false;
    for (const key of backendKeys) {
      if (key in partial) {
        backendPayload[key] = (partial as any)[key];
        hasBackendKey = true;
      }
    }

    if (hasBackendKey) {
      storage.getItem(STORAGE_KEYS.ACCESS_TOKEN).then((token) => {
        if (token) {
          api.updateUserSettings(backendPayload).catch((err) => {
            console.warn('Failed to persist settings to backend:', err);
          });
        }
      });
    }

    return this.getSettings();
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.getSettings();
    this.listeners.forEach((fn) => fn(current));
  }

  // Linked Devices helpers
  public async addLinkedDevice(device: Omit<LinkedDevice, 'id' | 'isCurrent'>): Promise<LinkedDevice> {
    const newDevice: LinkedDevice = {
      ...device,
      id: `dev-${generateUUID().substring(0, 8)}`,
      isCurrent: false,
    };

    this.update({
      linkedDevices: [...this.settings.linkedDevices, newDevice],
    });

    try {
      const saved = await api.linkDevice({
        deviceName: device.name,
        platform: device.platform,
        browser: device.browser,
        location: device.location,
        ipAddress: device.ipAddress,
      });
      if (saved && saved.id) {
        this.updateLocal({
          linkedDevices: this.settings.linkedDevices.map((d) => (d.id === newDevice.id ? { ...d, id: saved.id } : d)),
        });
      }
    } catch (e) {
      console.warn('Failed to register device to backend:', e);
    }

    return newDevice;
  }

  public async removeLinkedDevice(deviceId: string): Promise<void> {
    this.update({
      linkedDevices: this.settings.linkedDevices.filter((d) => d.id !== deviceId),
    });

    try {
      await api.removeLinkedDevice(deviceId);
    } catch (e) {
      console.warn('Failed to remove device on backend:', e);
    }
  }

  public async logOutAllOtherDevices(): Promise<void> {
    this.update({
      linkedDevices: this.settings.linkedDevices.filter((d) => d.isCurrent),
    });

    try {
      await api.removeOtherLinkedDevices();
    } catch (e) {
      console.warn('Failed to remove other devices on backend:', e);
    }
  }
}

export const settingsService = new SettingsService();
