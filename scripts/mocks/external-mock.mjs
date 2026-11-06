// Mock for external storage and React Native/Expo boundaries
export const Platform = { OS: 'android', select: (obj) => obj.android || obj.default };
export const NativeModules = {
  IndiChatAudioRoute: {
    startCallAudio: async (defaultToSpeaker) => ({ currentRoute: defaultToSpeaker ? 'speaker' : 'earpiece' }),
    setSpeakerphoneOn: async (on) => ({ isSpeakerphoneOn: on, currentRoute: on ? 'speaker' : 'earpiece' }),
    getAudioRoute: async () => ({ route: 'earpiece', isSpeaker: false }),
    stopCallAudio: async () => true,
  },
};
export const Constants = { expoConfig: { hostUri: '192.168.0.70:8081' } };
export const File = {};
export const UploadType = {};

// Mock for FileSystem
const mockDisk = new Map();
export const documentDirectory = 'file:///data/user/0/com.indichat.app/files/';
export const cacheDirectory = 'file:///data/user/0/com.indichat.app/cache/';
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' };

export async function makeDirectoryAsync(uri, options) {
  mockDisk.set(uri, { isDirectory: true });
}

export async function writeAsStringAsync(uri, contents, options) {
  mockDisk.set(uri, { isDirectory: false, contents, size: Buffer.byteLength(contents, 'utf8') });
}

export async function readAsStringAsync(uri, options) {
  const item = mockDisk.get(uri);
  if (!item) throw new Error('File not found: ' + uri);
  return item.contents;
}

export async function getInfoAsync(uri, options) {
  const item = mockDisk.get(uri);
  if (!item) return { exists: false, isDirectory: false };
  return {
    exists: true,
    isDirectory: item.isDirectory,
    size: item.size || 0,
    modificationTime: Date.now(),
    uri,
  };
}

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

// Mock for WebRTC Spike
export class MockMediaStreamTrack {
  constructor(kind, label = `${kind}-track`) {
    this.id = `track-${Math.random().toString(36).substring(2, 9)}`;
    this.kind = kind;
    this.label = label;
    this.readyState = 'live';
    this.muted = false;
    this.enabled = true;
    this._listeners = new Map();
  }

  stop() {
    this.readyState = 'ended';
    const endedHandlers = this._listeners.get('ended') || [];
    endedHandlers.forEach((cb) => cb());
  }

  addEventListener(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(cb);
  }

  simulateMute(muted) {
    this.muted = muted;
    const eventName = muted ? 'mute' : 'unmute';
    const handlers = this._listeners.get(eventName) || [];
    handlers.forEach((cb) => cb());
  }
}

export class MockMediaStream {
  constructor(tracks = []) {
    this.id = `stream-${Math.random().toString(36).substring(2, 9)}`;
    this._tracks = [...tracks];
  }

  getTracks() {
    return [...this._tracks];
  }

  getAudioTracks() {
    return this._tracks.filter((t) => t.kind === 'audio');
  }

  getVideoTracks() {
    return this._tracks.filter((t) => t.kind === 'video');
  }

  addTrack(track) {
    this._tracks.push(track);
  }

  toURL() {
    return `blob:mock-stream/${this.id}`;
  }
}
export { MockMediaStream as MediaStream };

let mockPermissionDenied = false;
export function setMockPermissionDenied(val) {
  mockPermissionDenied = val;
}

export const mediaDevices = {
  getUserMedia: async (constraints) => {
    if (mockPermissionDenied) {
      const err = new Error('Permission denied by user for camera/microphone');
      err.name = 'NotAllowedError';
      throw err;
    }
    const tracks = [];
    if (constraints.audio) tracks.push(new MockMediaStreamTrack('audio', 'Built-in Microphone'));
    if (constraints.video) tracks.push(new MockMediaStreamTrack('video', 'Built-in Camera'));
    return new MockMediaStream(tracks);
  },
};

export class RTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.signalingState = 'stable';
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.ontrack = null;
    this.onconnectionstatechange = null;
    this._localTracks = [];
  }

  addTrack(track, stream) {
    this._localTracks.push(track);
  }

  async createOffer(options) {
    return {
      type: 'offer',
      sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
    };
  }

  async setLocalDescription(desc) {
    if (desc.type === 'offer') {
      this.signalingState = 'have-local-offer';
    } else if (desc.type === 'answer') {
      this.signalingState = 'stable';
    }
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
    if (desc.type === 'offer') {
      this.signalingState = 'have-remote-offer';
    } else if (desc.type === 'answer') {
      this.signalingState = 'stable';
    }
  }

  async createAnswer() {
    return {
      type: 'answer',
      sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
    };
  }

  async addIceCandidate(candidate) {
    return true;
  }

  async getStats() {
    return new Map([
      ['inbound-rtp-audio', { type: 'inbound-rtp', kind: 'audio', packetsReceived: 150, bytesReceived: 24000 }],
      ['inbound-rtp-video', { type: 'inbound-rtp', kind: 'video', packetsReceived: 220, bytesReceived: 98000, framesDecoded: 45 }],
      ['candidate-pair', { type: 'candidate-pair', state: 'succeeded', nominated: true }],
    ]);
  }

  close() {
    this.signalingState = 'closed';
    this.connectionState = 'closed';
  }
}

export const RTCView = () => null;
export class RTCIceCandidate {
  constructor(init) {
    Object.assign(this, init);
  }
}
export class RTCSessionDescription {
  constructor(init) {
    Object.assign(this, init);
  }
}

// Shared types stubs
export const CallSignalPayload = {};
export const Message = {};
export const User = {};
export const Conversation = {};
export const MessageReceipt = {};
export const MessageType = {};
export const PresenceEventPayload = {};
export const TypingEventPayload = {};
export const SendMessagePayload = {};
export const WebSocketMessage = {};


