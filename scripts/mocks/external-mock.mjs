// Mock for external storage and React Native/Expo boundaries
export const Platform = { OS: 'android', select: (obj) => obj.android || obj.default };
export const Constants = { expoConfig: { hostUri: '192.168.0.70:8081' } };
export const File = {};
export const UploadType = {};

const store = new Map();
const AsyncStorage = {
  getItem: async (key) => store.get(key) || null,
  setItem: async (key, val) => store.set(key, String(val)),
  removeItem: async (key) => store.delete(key),
  multiRemove: async (keys) => keys.forEach((k) => store.delete(k)),
  clear: async () => store.clear(),
};

export default AsyncStorage;
export { AsyncStorage };

