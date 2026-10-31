/**
 * apps/mobile/app/settings/account.tsx
 *
 * Account & Security Overview:
 *  - Displays verified email address
 *  - Links to dedicated security screens: Password, 2FA, Passkeys, Phone
 *  - Danger Zone: Delete My Account
 */

import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { palette, metrics, userSettings } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Account" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
          CREDENTIALS & AUTHENTICATION
        </Text>
        <LiquidGlassSurface style={styles.card}>
          {/* Email row */}
          <View style={[styles.row, { borderBottomColor: palette.divider }]}>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>Email Address</Text>
              <Text style={[styles.rowDesc, { color: palette.textSecondary }]}>
                {userSettings.email || 'user@example.com'}
              </Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>

          {/* Change Password */}
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/password')}
            accessibilityRole="button"
            accessibilityLabel="Change Password"
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>Change Password</Text>
              <Text style={[styles.rowDesc, { color: palette.textSecondary }]}>
                Update your account login password
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          {/* Two-Step Verification */}
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/two-factor')}
            accessibilityRole="button"
            accessibilityLabel="Two-Step Verification"
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>Two-Step Verification</Text>
              <Text style={[styles.rowDesc, { color: palette.textSecondary }]}>
                Require a 6-digit PIN on registration
              </Text>
            </View>
            <Text style={[styles.statusVal, { color: palette.textSecondary }]}>
              {userSettings.twoFactorEnabled ? 'Enabled' : 'Off'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          {/* Passkeys & Biometrics */}
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: palette.divider }]}
            onPress={() => router.push('/settings/passkeys')}
            accessibilityRole="button"
            accessibilityLabel="Passkeys and Biometrics"
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>Passkeys & Biometrics</Text>
              <Text style={[styles.rowDesc, { color: palette.textSecondary }]}>
                Passwordless authentication credentials
              </Text>
            </View>
            <Text style={[styles.statusVal, { color: palette.textSecondary }]}>
              {userSettings.passkeyEnabled ? 'Active' : 'Off'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          {/* Change Phone */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/settings/phone')}
            accessibilityRole="button"
            accessibilityLabel="Change Phone Number"
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>Change Phone Number</Text>
              <Text style={[styles.rowDesc, { color: palette.textSecondary }]}>
                {userSettings.phoneNumber}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </LiquidGlassSurface>

        {/* Danger Zone */}
        <Text style={[styles.sectionHeader, { color: '#f43f5e' }]}>DANGER ZONE</Text>
        <LiquidGlassSurface style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/settings/delete-account')}
            accessibilityRole="button"
            accessibilityLabel="Delete My Account"
          >
            <View style={[styles.dangerIconBox, { backgroundColor: 'rgba(244, 63, 94, 0.12)' }]}>
              <Ionicons name="trash-outline" size={18} color="#f43f5e" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: '#f43f5e' }]}>Delete My Account</Text>
              <Text style={[styles.rowDesc, { color: palette.textSecondary }]}>
                Permanently erase your messages, media, and keys
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </LiquidGlassSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 8,
  },
  card: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowContent: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowDesc: { fontSize: 11.5, marginTop: 2 },
  statusVal: { fontSize: 12, fontWeight: '600' },
  verifiedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  verifiedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#10b981',
  },
  dangerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
