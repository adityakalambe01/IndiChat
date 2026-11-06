/**
 * apps/mobile/app/settings/phone.tsx
 *
 * Dedicated Change Phone Number Screen:
 *  - Displays current registered phone number
 *  - Input for new phone number with ownership migration notice
 *  - useUnsavedChangesGuard for in-progress edits
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { settingsService } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { useUnsavedChangesGuard } from '../../utils/useUnsavedChangesGuard';

export default function PhoneSettingsScreen() {
  const router = useRouter();
  const { palette, metrics, userSettings } = useTheme();

  const [newPhone, setNewPhone] = useState('');
  const isDirty = newPhone.trim().length > 0;

  useUnsavedChangesGuard(isDirty);

  const handleNext = () => {
    if (!newPhone.trim() || newPhone.trim().length < 8) {
      Alert.alert('Required', 'Please enter a valid phone number with country code (e.g. +91 98765 00000).');
      return;
    }

    Alert.alert(
      'Confirm Phone Migration',
      `Migrate your IndiChat account from ${userSettings.phoneNumber} to ${newPhone.trim()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            settingsService.update({ phoneNumber: newPhone.trim() });
            Alert.alert('Phone Number Updated', 'Your registered phone number has been updated.');
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="Change Phone"
        rightActionText={isDirty ? 'Next' : undefined}
        onRightAction={handleNext}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <LiquidGlassSurface style={styles.card}>
          <Text style={[styles.infoText, { color: palette.textSecondary }]}>
            Changing your phone number will migrate your account info, encrypted groups, and
            settings to your new number. Before proceeding, ensure your new number can receive SMS
            verification codes.
          </Text>
        </LiquidGlassSurface>

        <LiquidGlassSurface style={styles.card}>
          <View style={[styles.inputGroup, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
              Current Phone Number
            </Text>
            <TextInput
              value={userSettings.phoneNumber}
              editable={false}
              style={[
                styles.textInput,
                { color: palette.textSecondary, backgroundColor: palette.surfaceInput, opacity: 0.6 },
              ]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
              New Phone Number (+91...)
            </Text>
            <TextInput
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              style={[
                styles.textInput,
                { color: palette.textPrimary, backgroundColor: palette.surfaceInput },
              ]}
              placeholder="+91 98765 43210"
              placeholderTextColor={palette.textSecondary}
            />
          </View>
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
            style={[styles.saveBtn, !isDirty && styles.saveBtnDisabled]}
            onPress={handleNext}
            disabled={!isDirty}
            accessibilityRole="button"
            accessibilityLabel="Next"
          >
            <Text style={styles.saveBtnText}>Next</Text>
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
  card: { padding: 14, marginBottom: 16 },
  infoText: { fontSize: 13, lineHeight: 19 },
  inputGroup: { paddingVertical: 10, borderBottomWidth: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  textInput: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
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
