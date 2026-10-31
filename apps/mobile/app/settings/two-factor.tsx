/**
 * apps/mobile/app/settings/two-factor.tsx
 *
 * Dedicated Two-Step Verification Screen:
 *  - Configures 6-digit PIN for account registration protection
 *  - Communicates with api.enableTwoFactor and api.disableTwoFactor
 *  - Updates settingsService and storage
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { settingsService } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { useUnsavedChangesGuard } from '../../utils/useUnsavedChangesGuard';

export default function TwoFactorSettingsScreen() {
  const router = useRouter();
  const { palette, metrics, userSettings } = useTheme();

  const [enabled, setEnabled] = useState(userSettings.twoFactorEnabled);
  const [pin, setPin] = useState(userSettings.twoFactorPin || '');
  const [loading, setLoading] = useState(false);

  const isDirty = enabled !== userSettings.twoFactorEnabled || (enabled && pin !== (userSettings.twoFactorPin || ''));

  useUnsavedChangesGuard(isDirty);

  const handleSave = async () => {
    if (enabled && pin.length !== 6) {
      Alert.alert('Required', 'PIN must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    try {
      if (enabled) {
        await api.updateTwoFactor(true, pin);
        settingsService.update({ twoFactorEnabled: true, twoFactorPin: pin });
        Alert.alert('Success', 'Two-step verification has been enabled.');
      } else {
        await api.updateTwoFactor(false);
        settingsService.update({ twoFactorEnabled: false, twoFactorPin: '' });
        Alert.alert('Disabled', 'Two-step verification has been turned off.');
      }
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update two-step verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="Two-Step Verification"
        rightActionText={isDirty ? 'Save' : undefined}
        onRightAction={handleSave}
        rightActionLoading={loading}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <LiquidGlassSurface style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <Ionicons name="shield-checkmark" size={26} color="#10b981" />
          </View>
          <Text style={[styles.heroTitle, { color: palette.textPrimary }]}>
            Enhanced Account Protection
          </Text>
          <Text style={[styles.heroDesc, { color: palette.textSecondary }]}>
            When enabled, you will need to enter your personal 6-digit PIN whenever you
            register your phone number with IndiChat on a new device.
          </Text>
        </LiquidGlassSurface>

        <LiquidGlassSurface style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.metaCol}>
              <Text style={[styles.switchTitle, { color: palette.textPrimary }]}>
                Two-Step Verification
              </Text>
              <Text style={[styles.switchDesc, { color: palette.textSecondary }]}>
                Require 6-digit PIN on registration
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#10b981' }}
              thumbColor="#ffffff"
              accessibilityRole="switch"
              accessibilityLabel="Toggle Two-Step Verification"
            />
          </View>

          {enabled && (
            <View style={[styles.pinGroup, { borderTopColor: palette.divider }]}>
              <Text style={[styles.pinLabel, { color: palette.textSecondary }]}>
                6-Digit Security PIN
              </Text>
              <TextInput
                value={pin}
                onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                style={[
                  styles.pinInput,
                  { color: palette.textPrimary, backgroundColor: palette.surfaceInput },
                ]}
                placeholder="• • • • • •"
                placeholderTextColor={palette.textSecondary}
              />
              <Text style={[styles.pinHint, { color: palette.textSecondary }]}>
                Do not share this PIN with anyone, including IndiChat staff.
              </Text>
            </View>
          )}
        </LiquidGlassSurface>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: palette.border }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.cancelBtnText, { color: palette.textPrimary }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, (!isDirty || loading) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isDirty || loading}
            accessibilityRole="button"
            accessibilityLabel="Save 2FA"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#070b0e" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
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
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
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
  pinGroup: { marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  pinLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  pinInput: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 18,
    letterSpacing: 6,
    textAlign: 'center',
  },
  pinHint: { fontSize: 11, marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: '#070b0e', fontSize: 14, fontWeight: '700' },
});
