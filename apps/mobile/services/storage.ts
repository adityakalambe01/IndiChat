import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'chat_access_token',
  REFRESH_TOKEN: 'chat_refresh_token',
  DEVICE_ID: 'chat_device_id',
  SERVER_URL: 'chat_server_url',
  CURRENT_USER: 'chat_current_user',
  SETTINGS: 'chat_app_settings',
  RECENT_GIFS: 'chat_recent_gifs',
  RECENT_STICKERS: 'chat_recent_stickers',
  CALL_HISTORY: 'chat_call_history',
  LAST_BACKUP_PATH: 'chat_last_backup_path',
};

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn('Storage setItem failed for key:', key, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage removeItem failed for key:', key, e);
    }
  },

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  async setJson(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage setJson failed for key:', key, e);
    }
  },

  async clearAuth(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.CURRENT_USER,
      ]);
    } catch (e) {
      console.warn('Storage clearAuth failed', e);
    }
  },
};
