/**
 * apps/mobile/app/settings/passkeys.tsx
 *
 * Dedicated Passkeys & Biometrics Screen:
 *  - Honest capability presentation of Passkey credentials
 *  - Replaces simulated passkey toggle with explicit 'In Development' badge
 *  - Preserves approved Liquid Glass UI in preview/preview-liquid-glass.html
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { FONTS } from '../../theme/tokens';

export default function PasskeysSettingsScreen() {
  const router = useRouter();
  const { palette, metrics } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Passkeys" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <LiquidGlassSurface style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <Ionicons name="key" size={26} color="#06b6d4" />
          </View>
          <Text style={[styles.heroTitle, { color: palette.textPrimary }]}>
            Passwordless Security
          </Text>
          <Text style={[styles.heroDesc, { color: palette.textSecondary }]}>
            Passkeys allow you to sign in to IndiChat using your device screen lock,
            fingerprint, or face recognition instead of passwords.
          </Text>
          <View style={styles.devBadge}>
            <Text style={styles.devBadgeText}>Hardware FIDO2 In Development</Text>
          </View>
        </LiquidGlassSurface>

        <LiquidGlassSurface style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.metaCol}>
              <Text style={[styles.rowTitle, { color: palette.textPrimary }]}>
                Mobile Biometric Passkeys
              </Text>
              <Text style={[styles.rowDesc, { color: palette.textSecondary }]}>
                Hardware security keys &amp; on-device biometrics
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
              <Text style={[styles.statusPillText, { color: '#eab308' }]}>Unavailable</Text>
            </View>
          </View>

          <View style={[styles.infoRow, { borderTopColor: palette.divider }]}>
            <Ionicons name="information-circle-outline" size={18} color="#06b6d4" />
            <Text style={[styles.infoText, { color: palette.textSecondary }]}>
              Native mobile FIDO2 / WebAuthn biometric enrollment is currently in development.
              IndiChat mobile currently uses username, password, and two-factor challenge PINs for authentication.
            </Text>
          </View>
        </LiquidGlassSurface>

        <TouchableOpacity
          style={[styles.doneBtn, { borderColor: palette.border }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={[styles.doneBtnText, { color: palette.textPrimary }]}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  heroCard: { padding: 18, alignItems: 'center', marginBottom: 16 },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  heroDesc: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  devBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  devBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: '#06b6d4',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: { padding: 14, marginBottom: 16 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metaCol: { flex: 1, paddingRight: 10 },
  rowTitle: { fontSize: 14, fontFamily: FONTS.semiBold },
  rowDesc: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: FONTS.regular,
    lineHeight: 16,
  },
  doneBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
});
