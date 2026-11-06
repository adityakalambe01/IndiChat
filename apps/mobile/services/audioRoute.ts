/**
 * apps/mobile/services/audioRoute.ts
 *
 * TypeScript wrapper for native Android AudioManager controller (IndiChatAudioRoute):
 *  - Controls speakerphone vs earpiece communication device routing
 *  - Handles audio focus for USAGE_VOICE_COMMUNICATION
 *  - Graceful fallback for Web and non-Android environments
 */

import { NativeModules, Platform } from 'react-native';

const { IndiChatAudioRoute } = NativeModules;

export type AudioRouteName = 'speaker' | 'earpiece' | 'bluetooth' | 'wired' | 'unknown';

export interface AudioRouteStatus {
  route: AudioRouteName;
  isSpeaker: boolean;
}

class AudioRouteService {
  private isAvailable: boolean = Platform.OS === 'android' && Boolean(IndiChatAudioRoute);

  /**
   * Initializes call audio mode (MODE_IN_COMMUNICATION) and requests audio focus.
   */
  async startCallAudio(defaultToSpeaker: boolean = false): Promise<{ success: boolean; currentRoute: AudioRouteName }> {
    if (!this.isAvailable) {
      return { success: true, currentRoute: defaultToSpeaker ? 'speaker' : 'earpiece' };
    }
    try {
      const res = await IndiChatAudioRoute.startCallAudio(defaultToSpeaker);
      return { success: true, currentRoute: (res?.currentRoute as AudioRouteName) || (defaultToSpeaker ? 'speaker' : 'earpiece') };
    } catch (e) {
      console.warn('[AudioRoute] startCallAudio failed:', e);
      return { success: false, currentRoute: defaultToSpeaker ? 'speaker' : 'earpiece' };
    }
  }

  /**
   * Sets speakerphone active or inactive using API 31+ setCommunicationDevice with fallback.
   */
  async setSpeakerphoneOn(enable: boolean): Promise<{ success: boolean; isSpeaker: boolean; currentRoute: AudioRouteName }> {
    if (!this.isAvailable) {
      return { success: true, isSpeaker: enable, currentRoute: enable ? 'speaker' : 'earpiece' };
    }
    try {
      const res = await IndiChatAudioRoute.setSpeakerphoneOn(enable);
      return {
        success: true,
        isSpeaker: Boolean(res?.isSpeakerphoneOn),
        currentRoute: (res?.currentRoute as AudioRouteName) || (enable ? 'speaker' : 'earpiece'),
      };
    } catch (e) {
      console.warn('[AudioRoute] setSpeakerphoneOn failed:', e);
      return { success: false, isSpeaker: enable, currentRoute: enable ? 'speaker' : 'earpiece' };
    }
  }

  /**
   * Returns current active audio route.
   */
  async getAudioRoute(): Promise<AudioRouteStatus> {
    if (!this.isAvailable) {
      return { route: 'earpiece', isSpeaker: false };
    }
    try {
      const res = await IndiChatAudioRoute.getAudioRoute();
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
      return true;
    }
    try {
      await IndiChatAudioRoute.stopCallAudio();
      return true;
    } catch (e) {
      console.warn('[AudioRoute] stopCallAudio failed:', e);
      return false;
    }
  }
}

export const audioRouteService = new AudioRouteService();
