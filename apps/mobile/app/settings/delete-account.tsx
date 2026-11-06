/**
 * apps/mobile/app/settings/delete-account.tsx
 *
 * Dedicated Delete Account Danger Zone Screen:
 *  - Displays critical warnings regarding permanent data erasure
 *  - Confirmation check before account termination
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
import { Ionicons } from '@expo/vector-icons';
import { storage } from '../../services/storage';
import { settingsService } from '../../services/settings';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';

export default function DeleteAccountSettingsScreen() {
  const router = useRouter();
  const { palette, metrics, userSettings } = useTheme();

  const [confirmInput, setConfirmInput] = useState('');

  const handleDelete = () => {
    if (confirmInput.trim().toLowerCase() !== 'delete') {
      Alert.alert('Confirmation', 'Please type DELETE to confirm permanent account removal.');
      return;
    }

    Alert.alert(
      'Final Warning: Delete Account',
      'This action is irreversible. All your messages, groups, and linked device sessions will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            await storage.clearAuth();
            settingsService.resetForLogout();
            Alert.alert('Account Deleted', 'Your IndiChat account data has been erased.');
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Delete Account" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        <LiquidGlassSurface style={[styles.dangerCard, { borderColor: 'rgba(244, 63, 94, 0.35)' }]}>
          <View style={styles.warningRow}>
            <Ionicons name="warning" size={24} color="#f43f5e" />
            <Text style={styles.warningHeading}>Permanent Action</Text>
          </View>
          <Text style={[styles.warningBody, { color: palette.textSecondary }]}>
            Deleting your account will:
          </Text>
          <View style={styles.bulletList}>
            <Text style={[styles.bulletItem, { color: palette.textSecondary }]}>
              • Delete your account info and profile photo
            </Text>
            <Text style={[styles.bulletItem, { color: palette.textSecondary }]}>
              • Delete you from all IndiChat groups
            </Text>
            <Text style={[styles.bulletItem, { color: palette.textSecondary }]}>
              • Erase your message history on this device
            </Text>
            <Text style={[styles.bulletItem, { color: palette.textSecondary }]}>
              • Revoke all linked web & desktop device sessions
            </Text>
          </View>
        </LiquidGlassSurface>

        <LiquidGlassSurface style={styles.card}>
          <Text style={[styles.label, { color: palette.textSecondary }]}>
            To confirm deletion, type <Text style={{ color: '#f43f5e', fontWeight: '700' }}>DELETE</Text> below:
          </Text>
          <TextInput
            value={confirmInput}
            onChangeText={setConfirmInput}
            autoCapitalize="characters"
            style={[
              styles.confirmInput,
              { color: palette.textPrimary, backgroundColor: palette.surfaceInput, borderColor: palette.border },
            ]}
            placeholder="Type DELETE"
            placeholderTextColor={palette.textSecondary}
          />
        </LiquidGlassSurface>

        <TouchableOpacity
          style={[styles.deleteBtn, confirmInput.trim().toLowerCase() !== 'delete' && styles.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={confirmInput.trim().toLowerCase() !== 'delete'}
          accessibilityRole="button"
          accessibilityLabel="Permanently Delete Account"
        >
          <Text style={styles.deleteBtnText}>Permanently Delete My Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  dangerCard: { padding: 16, marginBottom: 16, backgroundColor: 'rgba(244, 63, 94, 0.08)' },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  warningHeading: { fontSize: 16, fontWeight: '700', color: '#f43f5e' },
  warningBody: { fontSize: 13, marginBottom: 8 },
  bulletList: { gap: 4 },
  bulletItem: { fontSize: 12, lineHeight: 18 },
  card: { padding: 14, marginBottom: 16 },
  label: { fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  confirmInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  deleteBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
