import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { registerForPushNotificationsAsync, setupNotificationListeners } from '../services/notifications';
import { wsClient } from '../services/websocket';
import { api, onSessionExpired } from '../services/api';
import { STORAGE_KEYS, storage } from '../services/storage';
import { settingsService } from '../services/settings';
import { callHistoryService } from '../services/callHistory';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from '../theme/useTheme';
import { LiquidGlassSurface } from '../components/LiquidGlassSurface';

function RootNavigation() {
  const router = useRouter();
  const { palette, isDark } = useTheme();
  const [sessionRevokedReason, setSessionRevokedReason] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    senderUserId: string;
    callerName: string;
    isVideo: boolean;
  } | null>(null);

  useEffect(() => {
    // Auto-connect websocket if authenticated token is present in storage
    storage.getItem(STORAGE_KEYS.ACCESS_TOKEN).then((token) => {
      if (token && !wsClient.isConnected()) {
        wsClient.connect(token);
      }
    });

    registerForPushNotificationsAsync();
    const cleanupNotifications = setupNotificationListeners((data) => {
      if (data?.conversationId) {
        router.push(`/chat/${data.conversationId}?name=${encodeURIComponent(data.title || 'Chat')}`);
      }
    });

    const handleRevoked = async (reason: string) => {
      wsClient.disconnect();
      await storage.clearAuth();
      settingsService.resetForLogout();
      setSessionRevokedReason(
        reason || 'This device was removed from your linked devices. You have been logged out.'
      );
      router.replace('/');
    };

    const unsubDeviceRemoved = wsClient.onDeviceRemoved(handleRevoked);
    const unsubExpired = onSessionExpired(handleRevoked);

    const unsubCall = wsClient.onCallSignal((signal) => {
      if (signal.signalType === 'offer' && signal.senderUserId) {
        const callerName = (signal.data as any)?.callerName || 'Incoming Caller';
        const isVideo = Boolean((signal.data as any)?.isVideo);
        setIncomingCall({
          senderUserId: signal.senderUserId,
          callerName,
          isVideo,
        });
      } else if (signal.signalType === 'hangup') {
        setIncomingCall(null);
      }
    });

    return () => {
      cleanupNotifications?.();
      unsubDeviceRemoved();
      unsubExpired();
      unsubCall();
    };
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="chats" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="contacts" options={{ headerShown: false }} />

        {/* Dedicated Settings Stack Screens */}
        <Stack.Screen name="settings/index" options={{ headerShown: false }} />
        <Stack.Screen name="settings/appearance" options={{ headerShown: false }} />
        <Stack.Screen name="settings/profile" options={{ headerShown: false }} />
        <Stack.Screen name="settings/account" options={{ headerShown: false }} />
        <Stack.Screen name="settings/password" options={{ headerShown: false }} />
        <Stack.Screen name="settings/two-factor" options={{ headerShown: false }} />
        <Stack.Screen name="settings/passkeys" options={{ headerShown: false }} />
        <Stack.Screen name="settings/phone" options={{ headerShown: false }} />
        <Stack.Screen name="settings/delete-account" options={{ headerShown: false }} />
        <Stack.Screen name="settings/privacy" options={{ headerShown: false }} />
        <Stack.Screen name="settings/chats" options={{ headerShown: false }} />
        <Stack.Screen name="settings/wallpaper" options={{ headerShown: false }} />
        <Stack.Screen name="settings/backup" options={{ headerShown: false }} />
        <Stack.Screen name="settings/notifications" options={{ headerShown: false }} />
        <Stack.Screen name="settings/language" options={{ headerShown: false }} />
        <Stack.Screen name="settings/storage" options={{ headerShown: false }} />
        <Stack.Screen name="settings/linked-devices" options={{ headerShown: false }} />
        <Stack.Screen name="settings/link-device" options={{ headerShown: false }} />
        <Stack.Screen name="settings/help" options={{ headerShown: false }} />
        <Stack.Screen name="settings/server" options={{ headerShown: false }} />
      </Stack>

      {/* Global Incoming Call Overlay */}
      {incomingCall && (
        <Modal visible transparent animationType="slide">
          <View style={styles.incomingCallOverlay}>
            <LiquidGlassSurface style={styles.incomingCallCard}>
              <View style={styles.incomingCallAvatar}>
                <Ionicons
                  name={incomingCall.isVideo ? 'videocam' : 'call'}
                  size={36}
                  color="#25D366"
                />
              </View>
              <Text style={[styles.incomingCallName, { color: palette.textPrimary }]}>
                {incomingCall.callerName}
              </Text>
              <Text style={[styles.incomingCallType, { color: palette.textSecondary }]}>
                IndiChat {incomingCall.isVideo ? 'Video' : 'Voice'} Call...
              </Text>

              <View style={styles.callButtonsRow}>
                <TouchableOpacity
                  style={[styles.callCircleBtn, styles.declineBtn]}
                  onPress={() => {
                    callHistoryService.addCall({
                      contactName: incomingCall.callerName,
                      targetUserId: incomingCall.senderUserId,
                      isVideo: incomingCall.isVideo,
                      type: 'missed',
                      duration: 'Declined',
                    });
                    wsClient.sendCallSignal({
                      targetUserId: incomingCall.senderUserId,
                      signalType: 'hangup',
                      data: {},
                    });
                    setIncomingCall(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Decline Call"
                >
                  <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  <Text style={styles.callLabel}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.callCircleBtn, styles.acceptBtn]}
                  onPress={async () => {
                    const senderId = incomingCall.senderUserId;
                    const callerName = incomingCall.callerName;
                    const isVideo = incomingCall.isVideo;
                    setIncomingCall(null);

                    callHistoryService.addCall({
                      contactName: callerName,
                      targetUserId: senderId,
                      isVideo,
                      type: 'incoming',
                      duration: 'Ongoing',
                    });

                    wsClient.sendCallSignal({
                      targetUserId: senderId,
                      signalType: 'answer',
                      data: {},
                    });

                    try {
                      const convs = await api.getConversations();
                      const conv = convs?.find((c) =>
                        c.members?.some((m) => m.userId === senderId || m.user?.id === senderId)
                      );
                      if (conv) {
                        router.push(
                          `/chat/${conv.id}?name=${encodeURIComponent(callerName)}&targetUserId=${senderId}&acceptedCall=${isVideo ? 'video' : 'voice'}`
                        );
                        return;
                      }
                      const newConv = await api.createConversation({ type: 'DIRECT', participantIds: [senderId] });
                      router.push(
                        `/chat/${newConv.id}?name=${encodeURIComponent(callerName)}&targetUserId=${senderId}&acceptedCall=${isVideo ? 'video' : 'voice'}`
                      );
                    } catch (e) {
                      router.push(
                        `/chat/${senderId}?name=${encodeURIComponent(callerName)}&targetUserId=${senderId}&acceptedCall=${isVideo ? 'video' : 'voice'}`
                      );
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Accept Call"
                >
                  <Ionicons name="call" size={26} color="#fff" />
                  <Text style={styles.callLabel}>Accept</Text>
                </TouchableOpacity>
              </View>
            </LiquidGlassSurface>
          </View>
        </Modal>
      )}

      {/* Global Session Revoked / Removed Modal */}
      {sessionRevokedReason && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalBg}>
            <LiquidGlassSurface style={styles.modalCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="alert-circle" size={36} color="#f15c6d" />
              </View>
              <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>Session Ended</Text>
              <Text style={[styles.modalText, { color: palette.textSecondary }]}>{sessionRevokedReason}</Text>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: palette.accent }]}
                onPress={() => setSessionRevokedReason(null)}
                accessibilityRole="button"
                accessibilityLabel="Log In Again"
              >
                <Text style={styles.modalBtnText}>Log In Again</Text>
              </TouchableOpacity>
            </LiquidGlassSurface>
          </View>
        </Modal>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigation />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(241, 92, 109, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#070b0e',
    fontWeight: '700',
    fontSize: 15,
  },
  incomingCallOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  incomingCallCard: {
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  incomingCallAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#25D366',
  },
  incomingCallName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  incomingCallType: {
    fontSize: 15,
    marginBottom: 32,
    textAlign: 'center',
  },
  callButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 16,
  },
  callCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    backgroundColor: '#ea4335',
  },
  acceptBtn: {
    backgroundColor: '#25D366',
  },
  callLabel: {
    position: 'absolute',
    bottom: -22,
    color: '#8696a0',
    fontSize: 12,
    fontWeight: '600',
  },
});
