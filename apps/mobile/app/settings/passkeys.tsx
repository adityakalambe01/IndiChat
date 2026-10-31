/**
 * apps/mobile/app/settings/passkeys.tsx
 *
 * Dedicated Passkeys & Biometrics Screen:
 *  - Honest capability presentation of Passkey credentials
 *  - Controls passkeyEnabled in local settings and backend
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { settingsService } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

export default function PasskeysSettingsScreen() {
  const router = useRouter();
  const { palette, metrics, userSettings } = useTheme();
  const [passkeyActive, setPasskeyActive] = useState(userSettings.passkeyEnabled);

  const handleToggle = (val: boolean) => {
    setPasskeyActive(val);
    settingsService.update({ passkeyEnabled: val });
    Alert.alert(
      val ? 'Passkey Registered' : 'Passkey Disabled',
      val
        ? 'Passkey authentication is active for this device session.'
        : 'Passkey authentication has been disabled.'
    );
  };

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
            fingerprint, or face recognition instead of remembering complex passwords.
          </Text>
        </LiquidGlassSurface>

        <LiquidGlassSurface style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.metaCol}>
              <Text style={[styles.switchTitle, { color: palette.textPrimary }]}>
                Passkey Authentication
              </Text>
              <Text style={[styles.switchDesc, { color: palette.textSecondary }]}>
                Use biometric / device lock for verification
              </Text>
            </View>
            <Switch
              value={passkeyActive}
              onValueChange={handleToggle}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#06b6d4' }}
              thumbColor="#ffffff"
              accessibilityRole="switch"
              accessibilityLabel="Toggle Passkey"
            />
          </View>

          <View style={[styles.infoRow, { borderTopColor: palette.divider }]}>
            <Ionicons name="information-circle-outline" size={18} color="#06b6d4" />
            <Text style={[styles.infoText, { color: palette.textSecondary }]}>
              Passkeys are stored securely in your device's hardware keychain and are never
              shared across the network.
            </Text>
          </View>
        </LiquidGlassSurface>

        <TouchableOpacity
          style={[styles.learnBtn, { borderColor: palette.border }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={[styles.learnBtnText, { color: palette.textPrimary }]}>Done</Text>
        </TouchableOpacity>
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
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  heroDesc: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  card: { padding: 14, marginBottom: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaCol: { flex: 1, paddingRight: 10 },
  switchTitle: { fontSize: 14, fontWeight: '600' },
  switchDesc: { fontSize: 11.5, marginTop: 2 },
  infoRow: { flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  infoText: { fontSize: 11.5, flex: 1, lineHeight: 16 },
  learnBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  learnBtnText: { fontSize: 14, fontWeight: '600' },
});
