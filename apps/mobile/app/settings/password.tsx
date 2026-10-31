/**
 * apps/mobile/app/settings/password.tsx
 *
 * Dedicated Change Password Screen:
 *  - Validates current, new, and confirm password fields
 *  - Communicates with api.changePassword
 *  - useUnsavedChangesGuard for unsaved edits
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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { useUnsavedChangesGuard } from '../../utils/useUnsavedChangesGuard';

export default function PasswordSettingsScreen() {
  const router = useRouter();
  const { palette, metrics } = useTheme();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isDirty = currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;

  useUnsavedChangesGuard(isDirty);

  const handleUpdate = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Required', 'Please fill in both current and new password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Validation', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="Change Password"
        rightActionText={isDirty ? 'Update' : undefined}
        onRightAction={handleUpdate}
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
        <LiquidGlassSurface style={styles.card}>
          <View style={[styles.inputGroup, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
              Current Password
            </Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              style={[styles.textInput, { color: palette.textPrimary, backgroundColor: palette.surfaceInput }]}
              placeholder="Enter current password"
              placeholderTextColor={palette.textSecondary}
            />
          </View>

          <View style={[styles.inputGroup, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
              New Password
            </Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              style={[styles.textInput, { color: palette.textPrimary, backgroundColor: palette.surfaceInput }]}
              placeholder="At least 8 characters"
              placeholderTextColor={palette.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
              Confirm New Password
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              style={[styles.textInput, { color: palette.textPrimary, backgroundColor: palette.surfaceInput }]}
              placeholder="Re-enter new password"
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
            style={[styles.saveBtn, (!isDirty || loading) && styles.saveBtnDisabled]}
            onPress={handleUpdate}
            disabled={!isDirty || loading}
            accessibilityRole="button"
            accessibilityLabel="Update Password"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#070b0e" />
            ) : (
              <Text style={styles.saveBtnText}>Update Password</Text>
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
  card: { padding: 14, marginBottom: 16 },
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
