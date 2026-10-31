/**
 * apps/mobile/app/settings/index.tsx
 *
 * Settings Home ("You"):
 *  - Profile Hero card with tap-to-edit navigation to /settings/profile
 *  - Categorized Bento cards: Account & Security, Chat & Appearance, System & Session
 *  - Vertically scrollable with 120px bottom dock clearance
 *  - Live appearance mode badge indicator
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
import { User } from '@chat/shared-types';
import { Ionicons } from '@expo/vector-icons';
import { storage, STORAGE_KEYS } from '../../services/storage';
import { settingsService, MobileAppSettings } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import Constants from 'expo-constants';

export default function SettingsHomeScreen() {
  const router = useRouter();
  const { palette, metrics, userSettings } = useTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      const u = await storage.getJson<User>(STORAGE_KEYS.CURRENT_USER);
      if (u) setCurrentUser(u);
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to end your session on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await storage.clearAuth();
            settingsService.resetForLogout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const displayName = currentUser?.displayName || userSettings.displayName || 'User';
  const username = currentUser?.username || userSettings.username || 'user';
  const initial = displayName.charAt(0).toUpperCase() || 'U';

  const appearanceLabel =
    userSettings.appearanceMode === 'dark'
      ? 'Dark Obsidian'
      : userSettings.appearanceMode === 'light'
      ? 'Daylight'
      : 'System';

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="You" showBack={false} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Hero Card */}
        <LiquidGlassSurface style={styles.profileCard}>
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => router.push('/settings/profile')}
            accessibilityRole="button"
            accessibilityLabel="Edit Profile"
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={[styles.profileName, { color: palette.textPrimary }]}>
                {displayName}
              </Text>
              <Text style={[styles.profileUsername, { color: palette.textSecondary }]}>
                @{username} · {userSettings.phoneNumber}
              </Text>
              <Text style={styles.profileAbout} numberOfLines={1}>
                {userSettings.statusAbout}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
          </TouchableOpacity>
        </LiquidGlassSurface>

        {/* Section 1: Account & Security */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          ACCOUNT & SECURITY
        </Text>
        <LiquidGlassSurface style={styles.bentoCard}>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/account')}
            accessibilityRole="button"
            accessibilityLabel="Account and Login"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#10b981" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                Account & Login
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                Password, 2-Step verification, Passkeys
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/privacy')}
            accessibilityRole="button"
            accessibilityLabel="Privacy and Read Receipts"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
              <Ionicons name="lock-closed" size={18} color="#06b6d4" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                Privacy & Read Receipts
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                Last seen, cyan checkmarks, profile photo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/settings/linked-devices')}
            accessibilityRole="button"
            accessibilityLabel="Linked Devices"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
              <Ionicons name="hardware-chip" size={18} color="#6366f1" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                Linked Devices
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                Web & Desktop active sessions
              </Text>
            </View>
            <Text style={[styles.badgeText, { color: palette.textSecondary }]}>
              {userSettings.linkedDevices.length} active
            </Text>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </LiquidGlassSurface>

        {/* Section 2: Chat & Appearance */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          CHAT & APPEARANCE
        </Text>
        <LiquidGlassSurface style={styles.bentoCard}>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/appearance')}
            accessibilityRole="button"
            accessibilityLabel="Appearance and Materials"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
              <Ionicons name="color-palette" size={18} color="#06b6d4" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                Appearance & Materials
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                Liquid glass, theme, blur level, reduced motion
              </Text>
            </View>
            <Text style={[styles.badgeText, { color: '#06b6d4' }]}>{appearanceLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/chats')}
            accessibilityRole="button"
            accessibilityLabel="Chats and Wallpaper"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="chatbubbles" size={18} color="#10b981" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                Chats & Wallpaper
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                Enter is send, media visibility, backup
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/notifications')}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="notifications" size={18} color="#f59e0b" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                Notifications
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                Alert tones, vibration, priority banners
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/language')}
            accessibilityRole="button"
            accessibilityLabel="App Language"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
              <Ionicons name="globe" size={18} color="#8b5cf6" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                App Language
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                English, हिन्दी, Español, Français...
              </Text>
            </View>
            <Text style={[styles.badgeText, { color: palette.textSecondary }]}>
              {userSettings.language.toUpperCase()}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/settings/storage')}
            accessibilityRole="button"
            accessibilityLabel="Storage and Data"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <Ionicons name="pie-chart" size={18} color="#3b82f6" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                Storage & Data
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                Network counters, cache clearance
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </LiquidGlassSurface>

        {/* Section 3: System & Session */}
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          SYSTEM & SESSION
        </Text>
        <LiquidGlassSurface style={styles.bentoCard}>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/server')}
            accessibilityRole="button"
            accessibilityLabel="Backend Server Settings"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="cloud" size={18} color="#10b981" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                Backend Server
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                Host URL & latency diagnostics
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/help')}
            accessibilityRole="button"
            accessibilityLabel="Help and Support"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
              <Ionicons name="help-circle" size={18} color="#06b6d4" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: palette.textPrimary }]}>
                Help & Support
              </Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                FAQ, licenses, app info
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Log Out"
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(244, 63, 94, 0.12)' }]}>
              <Ionicons name="log-out" size={18} color="#f43f5e" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: '#f43f5e' }]}>Log Out</Text>
              <Text style={[styles.menuDesc, { color: palette.textSecondary }]}>
                End active session on this device
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </LiquidGlassSurface>

        {/* Footer info reading actual package/app version */}
        <View style={styles.footerWrap}>
          <Text style={[styles.footerText, { color: palette.textSecondary }]}>
            IndiChat v{Constants.expoConfig?.version || '1.0.0'} · Liquid Glass
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    padding: 16,
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#005c4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  profileUsername: {
    fontSize: 12,
    marginTop: 2,
  },
  profileAbout: {
    fontSize: 11.5,
    color: '#10b981',
    marginTop: 3,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 8,
  },
  bentoCard: {
    marginBottom: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuContent: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuDesc: {
    fontSize: 11.5,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11.5,
  },
});
