/**
 * apps/mobile/app/settings/linked-devices.tsx
 *
 * Dedicated Linked Devices Screen:
 *  - Displays list of active Web & Desktop sessions
 *  - Link a Device button navigating to /settings/link-device
 *  - Remote session revocation via settingsService.removeLinkedDevice
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { settingsService, LinkedDevice } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

export default function LinkedDevicesSettingsScreen() {
  const router = useRouter();
  const { palette, metrics, userSettings } = useTheme();
  const [devices, setDevices] = useState<LinkedDevice[]>(userSettings.linkedDevices || []);

  useEffect(() => {
    const unsub = settingsService.subscribe((s) => {
      setDevices(s.linkedDevices || []);
    });
    return unsub;
  }, []);

  const handleRevokeDevice = (device: LinkedDevice) => {
    Alert.alert(
      'Remove Device Session',
      `Log out "${device.name}"? This device will be disconnected immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out Device',
          style: 'destructive',
          onPress: async () => {
            await settingsService.removeLinkedDevice(device.id);
            Alert.alert('Device Removed', `Session on ${device.name} has been revoked.`);
          },
        },
      ]
    );
  };

  const getPlatformIcon = (platform: string): keyof typeof Ionicons.glyphMap => {
    switch (platform) {
      case 'mac':
      case 'ios':
        return 'logo-apple';
      case 'windows':
        return 'logo-windows';
      case 'linux':
        return 'terminal';
      default:
        return 'globe-outline';
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="Linked Devices"
        rightIconName="qr-code-outline"
        onRightIconPress={() => router.push('/settings/link-device')}
        rightIconLabel="Link Device"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <LiquidGlassSurface style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <Ionicons name="hardware-chip" size={26} color="#6366f1" />
          </View>
          <Text style={[styles.heroTitle, { color: palette.textPrimary }]}>
            Multi-Device Architecture
          </Text>
          <Text style={[styles.heroDesc, { color: palette.textSecondary }]}>
            Use IndiChat on Web, Desktop, and Linux without keeping your mobile phone online.
            Sessions are end-to-end encrypted and can be revoked remotely anytime.
          </Text>
        </LiquidGlassSurface>

        <TouchableOpacity
          style={styles.linkDeviceBtn}
          onPress={() => router.push('/settings/link-device')}
          accessibilityRole="button"
          accessibilityLabel="Link a Device"
        >
          <Ionicons name="add-circle" size={20} color="#070b0e" />
          <Text style={styles.linkDeviceText}>Link a Device</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          ACTIVE SESSIONS ({devices.length})
        </Text>

        {devices.length === 0 ? (
          <LiquidGlassSurface style={styles.emptyCard}>
            <Ionicons name="laptop-outline" size={32} color={palette.textSecondary} />
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              No other active device sessions found.
            </Text>
          </LiquidGlassSurface>
        ) : (
          <LiquidGlassSurface style={styles.card}>
            {devices.map((dev, i) => (
              <TouchableOpacity
                key={dev.id}
                style={[
                  styles.deviceRow,
                  i < devices.length - 1 && { borderBottomColor: palette.divider, borderBottomWidth: 1 },
                ]}
                onPress={() => handleRevokeDevice(dev)}
                accessibilityRole="button"
                accessibilityLabel={`Session: ${dev.name}`}
              >
                <View style={styles.deviceIconCircle}>
                  <Ionicons name={getPlatformIcon(dev.platform)} size={18} color="#6366f1" />
                </View>
                <View style={styles.metaCol}>
                  <Text style={[styles.deviceName, { color: palette.textPrimary }]}>
                    {dev.name}
                  </Text>
                  <Text style={[styles.deviceSub, { color: palette.textSecondary }]}>
                    {dev.location} · {dev.lastActive}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRevokeDevice(dev)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#f43f5e" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </LiquidGlassSurface>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  heroCard: { padding: 16, alignItems: 'center', marginBottom: 16 },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  heroDesc: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  linkDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#10b981',
    marginBottom: 16,
  },
  linkDeviceText: { color: '#070b0e', fontSize: 14, fontWeight: '700' },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  card: { padding: 6, marginBottom: 16 },
  emptyCard: { padding: 24, alignItems: 'center', gap: 8, marginBottom: 16 },
  emptyText: { fontSize: 13 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 12,
  },
  deviceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCol: { flex: 1 },
  deviceName: { fontSize: 14, fontWeight: '600' },
  deviceSub: { fontSize: 11.5, marginTop: 2 },
});
