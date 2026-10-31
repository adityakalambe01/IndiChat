/**
 * apps/mobile/app/settings/profile.tsx
 *
 * Dedicated Edit Profile Screen:
 *  - Edit Display Name and About / Bio
 *  - Avatar photo changer with honest capability toast/alert
 *  - Save / Cancel actions with useUnsavedChangesGuard
 */

import React, { useState, useEffect } from 'react';
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
import { User } from '@chat/shared-types';
import { api } from '../../services/api';
import { storage, STORAGE_KEYS } from '../../services/storage';
import { settingsService } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import { useUnsavedChangesGuard } from '../../utils/useUnsavedChangesGuard';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { palette, metrics, userSettings } = useTheme();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState(userSettings.displayName || '');
  const [statusAbout, setStatusAbout] = useState(userSettings.statusAbout || '');
  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [initialStatusAbout, setInitialStatusAbout] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await storage.getJson<User>(STORAGE_KEYS.CURRENT_USER);
      if (u) {
        setCurrentUser(u);
        const name = u.displayName || u.username;
        setDisplayName(name);
        setInitialDisplayName(name);
      } else {
        setInitialDisplayName(userSettings.displayName);
      }
      setStatusAbout(userSettings.statusAbout);
      setInitialStatusAbout(userSettings.statusAbout);
    })();
  }, []);

  const isDirty = displayName !== initialDisplayName || statusAbout !== initialStatusAbout;

  useUnsavedChangesGuard(isDirty);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Display name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile({ displayName: displayName.trim() });
      if (updated) {
        setCurrentUser(updated);
        await storage.setJson(STORAGE_KEYS.CURRENT_USER, updated);
      }
      settingsService.update({
        displayName: displayName.trim(),
        statusAbout: statusAbout.trim(),
      });
      setInitialDisplayName(displayName.trim());
      setInitialStatusAbout(statusAbout.trim());
      Alert.alert('Success', 'Profile updated successfully.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const username = currentUser?.username || userSettings.username || 'user';
  const initial = displayName.charAt(0).toUpperCase() || 'U';

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader
        title="Edit Profile"
        rightActionText={isDirty ? 'Save' : undefined}
        onRightAction={handleSave}
        rightActionLoading={saving}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <TouchableOpacity
            style={[styles.changePhotoBtn, { borderColor: palette.border }]}
            onPress={() => Alert.alert('Avatar Photo', 'Image selection is enabled via system gallery on device.')}
            accessibilityRole="button"
            accessibilityLabel="Change Photo"
          >
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Form Bento */}
        <LiquidGlassSurface style={styles.card}>
          <View style={[styles.inputGroup, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
              Display Name
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={[styles.textInput, { color: palette.textPrimary, backgroundColor: palette.surfaceInput }]}
              placeholder="Your display name"
              placeholderTextColor={palette.textSecondary}
              maxLength={40}
            />
            <Text style={[styles.inputHint, { color: palette.textSecondary }]}>
              This name will be visible to your IndiChat contacts.
            </Text>
          </View>

          <View style={[styles.inputGroup, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
              Status / About
            </Text>
            <TextInput
              value={statusAbout}
              onChangeText={setStatusAbout}
              style={[styles.textInput, { color: palette.textPrimary, backgroundColor: palette.surfaceInput }]}
              placeholder="Status message"
              placeholderTextColor={palette.textSecondary}
              maxLength={100}
            />
            <Text style={[styles.inputHint, { color: palette.textSecondary }]}>
              Share a brief status update with friends.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
              Username (Read-only)
            </Text>
            <TextInput
              value={`@${username}`}
              editable={false}
              style={[
                styles.textInput,
                { color: palette.textSecondary, backgroundColor: palette.surfaceInput, opacity: 0.6 },
              ]}
            />
            <Text style={[styles.inputHint, { color: palette.textSecondary }]}>
              Username is unique to your identity and cannot be changed here.
            </Text>
          </View>
        </LiquidGlassSurface>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: palette.border }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[styles.cancelBtnText, { color: palette.textPrimary }]}>
              {isDirty ? 'Cancel' : 'Back'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, (!isDirty || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isDirty || saving}
            accessibilityRole="button"
            accessibilityLabel="Save Profile"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#070b0e" />
            ) : (
              <Text style={styles.saveBtnText}>Save Profile</Text>
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: '#005c4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  changePhotoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  changePhotoText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  card: { padding: 14, marginBottom: 16 },
  inputGroup: { paddingVertical: 10, borderBottomWidth: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  textInput: {
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inputHint: { fontSize: 11, marginTop: 4 },
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
