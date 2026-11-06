/**
 * apps/mobile/app/settings/backup.tsx
 *
 * Dedicated Chat Backup Screen:
 *  - Performs genuine local chat history export using backend GET /api/v1/conversations/backup
 *  - Writes JSON archive to local app sandbox directory
 *  - Displays actual on-disk file size and verifies readability
 *  - Supports cancellation via AbortController
 *  - Clearly discloses encryption status (Plaintext) and media attachment scope (Excluded)
 *  - Preserves approved Liquid Glass UI and design tokens
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LiquidGlassSurface } from '../../components/LiquidGlassSurface';
import {
  performChatBackup,
  getLastBackupFileInfo,
  loadAndValidateLocalArchive,
  BackupFileInfo,
  BackupResult,
  ValidatedArchive,
} from '../../services/backup';
import { storage, STORAGE_KEYS } from '../../services/storage';
import { User } from '@chat/shared-types';
import { LocalArchiveViewerModal } from '../../components/LocalArchiveViewerModal';

export default function BackupSettingsScreen() {
  const { palette, metrics, userSettings } = useTheme();
  const [backingUp, setBackingUp] = useState(false);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [verifiedFile, setVerifiedFile] = useState<BackupFileInfo | null>(null);
  const [validatingArchive, setValidatingArchive] = useState(false);
  const [viewerArchive, setViewerArchive] = useState<ValidatedArchive | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check existing backup and current user on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const [fileInfo, user] = await Promise.all([
        getLastBackupFileInfo(),
        storage.getJson<User>(STORAGE_KEYS.CURRENT_USER),
      ]);
      if (isMounted) {
        setVerifiedFile(fileInfo);
        setCurrentUser(user);
      }
    })();
    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleOpenArchiveViewer = async () => {
    if (validatingArchive) return;
    setValidatingArchive(true);

    try {
      const result = await loadAndValidateLocalArchive();
      if (!result.valid || !result.archive) {
        Alert.alert(
          'Unable to Open Archive',
          result.error || 'The local backup file could not be validated.'
        );
        return;
      }
      setViewerArchive(result.archive);
      setShowViewer(true);
    } catch (err: any) {
      Alert.alert('Archive Error', err?.message || 'Failed to parse local archive.');
    } finally {
      setValidatingArchive(false);
    }
  };

  const handleStartBackup = async () => {
    if (backingUp) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setBackingUp(true);
    setProgressStage('Initializing export...');

    try {
      const result: BackupResult = await performChatBackup({
        signal: controller.signal,
        onProgress: (stage) => setProgressStage(stage),
      });

      if (result.cancelled) {
        Alert.alert('Export Cancelled', 'The backup operation was cancelled before completion.');
        return;
      }

      if (!result.success || result.error) {
        Alert.alert('Backup Failed', result.error || 'Failed to generate local backup archive.');
        return;
      }

      // Re-verify on-disk file stats
      const freshInfo = await getLastBackupFileInfo();
      setVerifiedFile(freshInfo);

      Alert.alert(
        'Backup Complete',
        `Chat history exported successfully.\n\n` +
          `• File: ${result.fileName}\n` +
          `• Actual Size: ${result.formattedSize} (${result.fileSizeBytes?.toLocaleString()} bytes)\n` +
          `• Conversations: ${result.totalConversations}\n` +
          `• Messages: ${result.totalMessages}\n` +
          `• Verification: Readability verified on local storage.`
      );
    } catch (err: any) {
      if (controller.signal.aborted) {
        Alert.alert('Export Cancelled', 'The backup operation was cancelled.');
      } else {
        Alert.alert('Backup Failed', err?.message || 'An unexpected error occurred during export.');
      }
    } finally {
      setBackingUp(false);
      setProgressStage(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancelBackup = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setProgressStage('Cancelling...');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScreenHeader title="Chat Backup" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: metrics.scrollBottomPadding },
        ]}
      >
        {/* Hero Card */}
        <LiquidGlassSurface style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <Ionicons name="cloud-upload" size={26} color="#10b981" />
          </View>
          <Text style={[styles.heroTitle, { color: palette.textPrimary }]}>
            Local Chat History Export
          </Text>
          <Text style={[styles.heroDesc, { color: palette.textSecondary }]}>
            Exports your conversation history and metadata directly from the backend into a
            structured JSON archive within this device's private app sandbox.
          </Text>
        </LiquidGlassSurface>

        {/* Technical Disclosures Card */}
        <LiquidGlassSurface style={styles.card}>
          <View style={styles.disclosureHeader}>
            <Ionicons name="shield-outline" size={18} color="#06b6d4" style={{ marginRight: 8 }} />
            <Text style={[styles.disclosureHeading, { color: palette.textPrimary }]}>
              Storage &amp; Encryption Disclosures
            </Text>
          </View>

          <View style={[styles.disclosureRow, { borderBottomColor: palette.divider }]}>
            <Ionicons name="document-text-outline" size={16} color={palette.textSecondary} style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.disclosureLabel, { color: palette.textPrimary }]}>
                Format: Unencrypted Plaintext JSON
              </Text>
              <Text style={[styles.disclosureDesc, { color: palette.textSecondary }]}>
                The exported archive is written unencrypted to your local device application sandbox. Keep your device locked to protect your data.
              </Text>
            </View>
          </View>

          <View style={styles.disclosureRow}>
            <Ionicons name="images-outline" size={16} color="#f59e0b" style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.disclosureLabel, { color: palette.textPrimary }]}>
                Media Attachments: Excluded
              </Text>
              <Text style={[styles.disclosureDesc, { color: palette.textSecondary }]}>
                Photos, videos, voice notes, and documents stored in MinIO/S3 object storage are not bundled into this offline text archive.
              </Text>
            </View>
          </View>
        </LiquidGlassSurface>

        {/* Archive Metadata & Verified Status */}
        <LiquidGlassSurface style={styles.card}>
          <View style={[styles.row, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Last Export</Text>
            <Text style={[styles.value, { color: palette.textPrimary }]}>
              {userSettings.lastBackupDate || 'Never'}
            </Text>
          </View>

          <View style={[styles.row, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Verified Size on Disk</Text>
            <Text style={[styles.value, { color: palette.textPrimary }]}>
              {verifiedFile?.exists
                ? `${verifiedFile.formattedSize} (${verifiedFile.sizeBytes?.toLocaleString()} B)`
                : userSettings.backupSize || '0 B'}
            </Text>
          </View>

          <View style={[styles.row, { borderBottomColor: palette.divider }]}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Storage Location</Text>
            <Text style={[styles.value, { color: palette.textPrimary }]}>
              App Sandbox (/backups)
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>On-Disk Readability</Text>
            <View style={styles.badgeRow}>
              {verifiedFile?.exists ? (
                <>
                  <Ionicons name="checkmark-circle" size={15} color="#10b981" style={{ marginRight: 4 }} />
                  <Text style={[styles.value, { color: '#10b981' }]}>Verified Readable</Text>
                </>
              ) : (
                <Text style={[styles.value, { color: palette.textSecondary }]}>
                  {userSettings.lastBackupDate ? 'File missing from sandbox' : 'No export created'}
                </Text>
              )}
            </View>
          </View>

          {/* View Local Archive Action Button (Only shown when file physically exists on disk) */}
          {verifiedFile?.exists && (
            <TouchableOpacity
              style={[styles.viewArchiveBtn, { borderColor: palette.divider }]}
              onPress={handleOpenArchiveViewer}
              disabled={validatingArchive}
              accessibilityRole="button"
              accessibilityLabel="View Local Archive"
            >
              {validatingArchive ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <>
                  <Ionicons name="eye-outline" size={17} color="#10b981" style={{ marginRight: 6 }} />
                  <Text style={[styles.viewArchiveBtnText, { color: palette.textPrimary }]}>
                    View Local Archive
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </LiquidGlassSurface>

        {/* In-Flight Progress Display */}
        {backingUp && (
          <LiquidGlassSurface style={[styles.progressCard, { borderColor: '#10b981' }]}>
            <ActivityIndicator size="small" color="#10b981" style={{ marginRight: 10 }} />
            <Text style={[styles.progressText, { color: palette.textPrimary }]}>
              {progressStage || 'Exporting...'}
            </Text>
          </LiquidGlassSurface>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {!backingUp ? (
            <TouchableOpacity
              style={styles.backupBtn}
              onPress={handleStartBackup}
              accessibilityRole="button"
              accessibilityLabel="Back Up Now"
            >
              <Text style={styles.backupBtnText}>Back Up Now</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancelBackup}
              accessibilityRole="button"
              accessibilityLabel="Cancel Export"
            >
              <Text style={styles.cancelBtnText}>Cancel Export</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Read-Only Local Archive Viewer Modal */}
      <LocalArchiveViewerModal
        visible={showViewer}
        archive={viewerArchive}
        currentUser={currentUser}
        onClose={() => setShowViewer(false)}
      />
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
  disclosureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  disclosureHeading: { fontSize: 13, fontWeight: '700' },
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disclosureLabel: { fontSize: 12, fontWeight: '600' },
  disclosureDesc: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  progressText: { fontSize: 12, fontWeight: '500', flex: 1 },
  actionsContainer: { marginTop: 4 },
  backupBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupBtnText: { color: '#070b0e', fontSize: 14, fontWeight: '700' },
  cancelBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  viewArchiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  viewArchiveBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
