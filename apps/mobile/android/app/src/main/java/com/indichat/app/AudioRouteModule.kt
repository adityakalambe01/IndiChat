package com.indichat.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * AudioRouteModule:
 * Native Android AudioManager controller for WebRTC calling:
 *  - Supports API 31+ setCommunicationDevice with legacy fallback to setSpeakerphoneOn
 *  - Handles USAGE_VOICE_COMMUNICATION AudioFocus requests and abandonment
 *  - Restores previous AudioMode and routing state on teardown
 *  - Emits audio route change events to React Native
 */
class AudioRouteModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), AudioManager.OnAudioFocusChangeListener {

    private val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var previousAudioMode: Int = AudioManager.MODE_NORMAL
    private var previousSpeakerphoneOn: Boolean = false
    private var audioFocusRequest: AudioFocusRequest? = null
    private var isAudioActive: Boolean = false

    override fun getName(): String = "IndiChatAudioRoute"

    override fun onAudioFocusChange(focusChange: Int) {
        val params = Arguments.createMap()
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                Log.d(TAG, "Audio focus lost permanently")
                params.putString("event", "focus_loss")
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                Log.d(TAG, "Audio focus lost transiently")
                params.putString("event", "focus_loss_transient")
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                Log.d(TAG, "Audio focus lost transient duck")
                params.putString("event", "focus_loss_duck")
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                Log.d(TAG, "Audio focus gained")
                params.putString("event", "focus_gain")
            }
        }
        sendEvent("onAudioFocusChange", params)
    }

    @ReactMethod
    fun startCallAudio(defaultToSpeaker: Boolean, promise: Promise) {
        try {
            if (!isAudioActive) {
                previousAudioMode = audioManager.mode
                previousSpeakerphoneOn = audioManager.isSpeakerphoneOn
                isAudioActive = true
            }

            // 1. Request Voice Communication Audio Focus
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val attributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()

                audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(attributes)
                    .setOnAudioFocusChangeListener(this)
                    .build()

                audioManager.requestAudioFocus(audioFocusRequest!!)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    this,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                )
            }

            // 2. Set MODE_IN_COMMUNICATION
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

            // 3. Configure initial speaker/earpiece route
            applySpeakerphone(defaultToSpeaker)

            val result = Arguments.createMap()
            result.putBoolean("success", true)
            result.putString("currentRoute", getCurrentRouteName())
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting call audio: ${e.message}", e)
            promise.reject("AUDIO_START_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun setSpeakerphoneOn(enable: Boolean, promise: Promise) {
        try {
            applySpeakerphone(enable)
            val result = Arguments.createMap()
            result.putBoolean("success", true)
            result.putBoolean("isSpeakerphoneOn", isSpeakerphoneActive())
            result.putString("currentRoute", getCurrentRouteName())
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error toggling speakerphone: ${e.message}", e)
            promise.reject("SPEAKER_TOGGLE_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun isSpeakerphoneOn(promise: Promise) {
        promise.resolve(isSpeakerphoneActive())
    }

    @ReactMethod
    fun getAudioRoute(promise: Promise) {
        val result = Arguments.createMap()
        result.putString("route", getCurrentRouteName())
        result.putBoolean("isSpeaker", isSpeakerphoneActive())
        promise.resolve(result)
    }

    @ReactMethod
    fun stopCallAudio(promise: Promise) {
        try {
            if (isAudioActive) {
                // 1. Clear API 31+ communication device if applicable
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    audioManager.clearCommunicationDevice()
                }

                // 2. Restore previous speakerphone state
                @Suppress("DEPRECATION")
                audioManager.isSpeakerphoneOn = previousSpeakerphoneOn

                // 3. Restore previous AudioMode
                audioManager.mode = previousAudioMode

                // 4. Abandon AudioFocus
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest!!)
                    audioFocusRequest = null
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.abandonAudioFocus(this)
                }

                isAudioActive = false
            }

            val result = Arguments.createMap()
            result.putBoolean("success", true)
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping call audio: ${e.message}", e)
            promise.reject("AUDIO_STOP_FAILED", e.message, e)
        }
    }

    private fun applySpeakerphone(enable: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (enable) {
                val speakerDevice = audioManager.availableCommunicationDevices.firstOrNull {
                    it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                }
                if (speakerDevice != null) {
                    audioManager.setCommunicationDevice(speakerDevice)
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.isSpeakerphoneOn = true
                }
            } else {
                val earpieceDevice = audioManager.availableCommunicationDevices.firstOrNull {
                    it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
                }
                if (earpieceDevice != null) {
                    audioManager.setCommunicationDevice(earpieceDevice)
                } else {
                    audioManager.clearCommunicationDevice()
                    @Suppress("DEPRECATION")
                    audioManager.isSpeakerphoneOn = false
                }
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager.isSpeakerphoneOn = enable
        }
    }

    private fun isSpeakerphoneActive(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val commDevice = audioManager.communicationDevice
            if (commDevice != null) {
                commDevice.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
            } else {
                @Suppress("DEPRECATION")
                audioManager.isSpeakerphoneOn
            }
        } else {
            @Suppress("DEPRECATION")
            audioManager.isSpeakerphoneOn
        }
    }

    private fun getCurrentRouteName(): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val commDevice = audioManager.communicationDevice
            if (commDevice != null) {
                return when (commDevice.type) {
                    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
                    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "earpiece"
                    AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
                    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
                    AudioDeviceInfo.TYPE_BLE_HEADSET -> "bluetooth"
                    AudioDeviceInfo.TYPE_WIRED_HEADSET,
                    AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
                    AudioDeviceInfo.TYPE_USB_HEADSET -> "wired"
                    else -> "unknown"
                }
            }
        }

        return if (audioManager.isSpeakerphoneOn) "speaker" else "earpiece"
    }

    private fun sendEvent(eventName: String, params: Any?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send event $eventName: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "IndiChatAudioRoute"
    }
}

