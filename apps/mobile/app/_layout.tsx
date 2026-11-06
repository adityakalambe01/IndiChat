import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { registerForPushNotificationsAsync, setupNotificationListeners } from '../services/notifications';
import { wsClient } from '../services/websocket';
import { api, onSessionExpired } from '../services/api';
import { STORAGE_KEYS, storage } from '../services/storage';
import { settingsService } from '../services/settings';
import { callHistoryService } from '../services/callHistory';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { ThemeProvider, useTheme } from '../theme/useTheme';
import { LiquidGlassSurface } from '../components/LiquidGlassSurface';
import { AmbientCanvas } from '../components/AmbientCanvas';
import { navigationAnimation } from '../theme/navigation';
import { CallOverlay } from '../components/CallOverlay';

function RootNavigation() {
  const router = useRouter();
  const { palette, isDark, isReducedMotion } = useTheme();
  const [sessionRevokedReason, setSessionRevokedReason] = useState<string | null>(null);

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
    Linking.getInitialURL().then((url) => {
      if (url) {
        const match = url.match(/indichat:\/\/([^?]+)(\?.*)?/);
        if (match) {
          const route = '/' + match[1];
          const query = match[2] || '';
          router.navigate(`${route}${query}` as any);
        }
      }
    }).catch((e) => {
      console.warn('Initial URL handling failed:', e);
    });

    const unsubLinking = Linking.addEventListener('url', (event) => {
      try {
        const url = event.url;
        const match = url.match(/indichat:\/\/([^?]+)(\?.*)?/);
        if (match) {
          const route = '/' + match[1];
          const query = match[2] || '';
          router.navigate(`${route}${query}` as any);
        }
      } catch (e) {
        console.warn('Deep link routing failed:', e);
      }
    });

    return () => {
      cleanupNotifications?.();
      unsubDeviceRemoved();
      unsubExpired();
      unsubLinking.remove();
    };
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AmbientCanvas />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: navigationAnimation(isReducedMotion),
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

      {/* Global Real WebRTC Call Interface (Incoming, Outgoing, Connected) */}
      <CallOverlay />

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
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

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
