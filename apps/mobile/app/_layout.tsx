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

export default function RootLayout() {
  const router = useRouter();
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
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#111b21' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="chats" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="contacts" options={{ headerShown: false }} />
      </Stack>

      {/* Global Incoming Call Overlay */}
      {incomingCall && (
        <Modal visible transparent animationType="slide">
          <View style={styles.incomingCallOverlay}>
            <View style={styles.incomingCallCard}>
              <View style={styles.incomingCallAvatar}>
                <Ionicons
                  name={incomingCall.isVideo ? 'videocam' : 'call'}
                  size={36}
                  color="#25D366"
                />
              </View>
              <Text style={styles.incomingCallName}>{incomingCall.callerName}</Text>
              <Text style={styles.incomingCallType}>
                WhatsApp {incomingCall.isVideo ? 'Video' : 'Voice'} Call...
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
                >
                  <Ionicons name="call" size={26} color="#fff" />
                  <Text style={styles.callLabel}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Global Session Revoked / Removed Modal */}
      {sessionRevokedReason && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="alert-circle" size={36} color="#f15c6d" />
              </View>
              <Text style={styles.modalTitle}>Session Ended</Text>
              <Text style={styles.modalText}>{sessionRevokedReason}</Text>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => setSessionRevokedReason(null)}
              >
                <Text style={styles.modalBtnText}>Log In Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
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
    backgroundColor: '#202c33',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3942',
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
    color: '#e9edef',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalText: {
    color: '#8696a0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtn: {
    backgroundColor: '#00a884',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#111b21',
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
    backgroundColor: '#1f2c34',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3942',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
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
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  incomingCallType: {
    color: '#8696a0',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
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
