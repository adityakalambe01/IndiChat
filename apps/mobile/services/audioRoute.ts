/**
 * apps/mobile/services/audioRoute.ts
 *
 * Native Android AudioManager / iOS RTCAudioSession routing (IndiChatAudioRoute):
 *  - Controls speakerphone vs earpiece communication device routing
 *  - Handles audio focus for USAGE_VOICE_COMMUNICATION
 *  - Reports unsupported routing without inventing a device state
 */

import { NativeModules, Platform } from 'react-native';

export type AudioRouteName = 'speaker' | 'earpiece' | 'bluetooth' | 'wired' | 'unknown';

export interface AudioRouteStatus {
  route: AudioRouteName;
  isSpeaker: boolean;
}

class AudioRouteService {
  get isAvailable(): boolean {
    return (Platform.OS === 'android' || Platform.OS === 'ios') &&
      ['startCallAudio', 'setSpeakerphoneOn', 'getAudioRoute', 'stopCallAudio'].every(
        key => typeof NativeModules.IndiChatAudioRoute?.[key] === 'function'
      );
  }

  /**
   * Initializes call audio mode (MODE_IN_COMMUNICATION) and requests audio focus.
   */
  async startCallAudio(defaultToSpeaker: boolean = false): Promise<{ success: boolean; currentRoute: AudioRouteName }> {
    if (!this.isAvailable) {
      return { success: false, currentRoute: 'unknown' };
    }
    try {
      const res = await NativeModules.IndiChatAudioRoute.startCallAudio(defaultToSpeaker);
      return { success: res?.success !== false && ['speaker', 'earpiece', 'bluetooth', 'wired'].includes(res?.currentRoute), currentRoute: res?.currentRoute || 'unknown' };
    } catch (e) {
      console.warn('[AudioRoute] startCallAudio failed:', e);
      return { success: false, currentRoute: 'unknown' };
    }
  }

  /**
   * Sets speakerphone active or inactive using API 31+ setCommunicationDevice with fallback.
   */
  async setSpeakerphoneOn(enable: boolean): Promise<{ success: boolean; isSpeaker: boolean; currentRoute: AudioRouteName }> {
    if (!this.isAvailable) {
      return { success: false, isSpeaker: false, currentRoute: 'unknown' };
    }
    try {
      const res = await NativeModules.IndiChatAudioRoute.setSpeakerphoneOn(enable);
      return {
        success: res?.success !== false && typeof res?.isSpeakerphoneOn === 'boolean' && ['speaker', 'earpiece', 'bluetooth', 'wired'].includes(res?.currentRoute),
        isSpeaker: Boolean(res?.isSpeakerphoneOn),
        currentRoute: (res?.currentRoute as AudioRouteName) || 'unknown',
      };
    } catch (e) {
      console.warn('[AudioRoute] setSpeakerphoneOn failed:', e);
      return { success: false, isSpeaker: false, currentRoute: 'unknown' };
    }
  }

  /**
   * Returns current active audio route.
   */
  async getAudioRoute(): Promise<AudioRouteStatus> {
    if (!this.isAvailable) {
      return { route: 'unknown', isSpeaker: false };
    }
    try {
      const res = await NativeModules.IndiChatAudioRoute.getAudioRoute();
      return {
        route: (res?.route as AudioRouteName) || 'unknown',
        isSpeaker: Boolean(res?.isSpeaker),
      };
    } catch {
      return { route: 'unknown', isSpeaker: false };
    }
  }

  /**
   * Returns whether speakerphone is currently active.
   */
  async isSpeakerphoneOn(): Promise<boolean> {
    const status = await this.getAudioRoute();
    return status.isSpeaker;
  }

  /**
   * Releases audio focus and restores previous audio mode and routing.
   */
  async stopCallAudio(): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }
    try {
      const result = await NativeModules.IndiChatAudioRoute.stopCallAudio();
      return result === true || result?.success === true;
    } catch (e) {
      console.warn('[AudioRoute] stopCallAudio failed:', e);
      return false;
    }
  }
}

export const audioRouteService = new AudioRouteService();
