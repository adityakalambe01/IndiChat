/**
 * apps/mobile/components/LocalArchiveViewerModal.tsx
 *
 * Read-Only Local Archive Viewer Modal:
 *  - Safely displays local backup snapshot in read-only mode
 *  - Discloses unauthenticated plaintext nature of the archive
 *  - Warns on account discrepancy (if archive user != current logged-in user)
 *  - Strictly treats content as untrusted: zero execution, zero remote media fetches, zero live database merging
 *  - Preserves approved Liquid Glass design system
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { ValidatedArchive, ArchiveConversation } from '../services/backup';
import { User } from '@chat/shared-types';
import { FONTS } from '../theme/tokens';

interface LocalArchiveViewerModalProps {
  visible: boolean;
  archive: ValidatedArchive | null;
  currentUser: User | null;
  onClose: () => void;
}

export const LocalArchiveViewerModal: React.FC<LocalArchiveViewerModalProps> = ({
  visible,
  archive,
  currentUser,
  onClose,
}) => {
  const { palette } = useTheme();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  if (!visible || !archive) return null;

  const conversations = archive.conversations || [];
  const selectedConv: ArchiveConversation | undefined =
    conversations.find((c) => c.id === selectedConvId) || conversations[0];

  const isAccountMismatch =
    Boolean(currentUser?.username) &&
    archive.user?.username &&
    currentUser?.username?.toLowerCase() !== archive.user?.username?.toLowerCase();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.divider }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close Archive Viewer"
          >
            <Ionicons name="close" size={24} color={palette.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>
              View Local Archive
            </Text>
            <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>
              {archive.fileName} ({archive.formattedSize})
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
          {/* Unauthenticated Security Warning Banner */}
          <LiquidGlassSurface style={[styles.warningCard, { borderColor: 'rgba(234, 179, 8, 0.3)' }]}>
            <View style={styles.warningTitleRow}>
              <Ionicons name="warning-outline" size={18} color="#eab308" style={{ marginRight: 6 }} />
              <Text style={styles.warningHeading}>Unauthenticated Plaintext Snapshot</Text>
            </View>
            <Text style={[styles.warningBody, { color: palette.textSecondary }]}>
              This archive is stored as an editable plaintext JSON document on this device. Its contents,
              timestamps, and message authorship are not cryptographically signed or authenticated.
              Displayed strictly in read-only mode without modifying live chats.
            </Text>
          </LiquidGlassSurface>

          {/* Account Discrepancy Notice */}
          {isAccountMismatch && (
            <LiquidGlassSurface style={[styles.mismatchCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <View style={styles.warningTitleRow}>
                <Ionicons name="alert-circle-outline" size={18} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.mismatchHeading}>Account Discrepancy</Text>
              </View>
              <Text style={[styles.mismatchBody, { color: palette.textSecondary }]}>
                This archive was exported for user <Text style={{ color: palette.textPrimary, fontWeight: '700' }}>@{archive.user.username}</Text>,
                but you are currently signed in as <Text style={{ color: palette.textPrimary, fontWeight: '700' }}>@{currentUser?.username}</Text>.
                No live data will be overwritten or merged.
              </Text>
            </LiquidGlassSurface>
          )}

          {/* Archive Metadata Summary Bento */}
          <LiquidGlassSurface style={styles.metaBento}>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Exported At</Text>
              <Text style={[styles.metaVal, { color: palette.textPrimary }]}>
                {new Date(archive.exportedAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Account Profile</Text>
              <Text style={[styles.metaVal, { color: palette.textPrimary }]}>
                {archive.user.displayName} (@{archive.user.username})
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Total Conversations</Text>
              <Text style={[styles.metaVal, { color: palette.textPrimary }]}>
                {archive.summary.totalConversations}
              </Text>
            </View>
            <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Total Messages</Text>
              <Text style={[styles.metaVal, { color: palette.textPrimary }]}>
                {archive.summary.totalMessages}
              </Text>
            </View>
          </LiquidGlassSurface>

          {/* Conversations Selector Tabs */}
          <Text style={[styles.sectionHeading, { color: palette.textSecondary }]}>
            CONVERSATIONS IN ARCHIVE ({conversations.length})
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.convChipsScroll}>
            {conversations.map((c) => {
              const active = c.id === selectedConv?.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.convChip,
                    active
                      ? { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981' }
                      : { backgroundColor: palette.surfaceElevated, borderColor: palette.border },
                  ]}
                  onPress={() => setSelectedConvId(c.id)}
                  accessibilityRole="tab"
                  accessibilityLabel={c.title}
                >
                  <Text style={[styles.convChipText, { color: active ? '#10b981' : palette.textPrimary }]}>
                    {c.title} ({c.messages.length})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Message Thread Inspector */}
          {selectedConv && (
            <LiquidGlassSurface style={styles.messagesContainer}>
              <View style={[styles.convHeaderRow, { borderBottomColor: palette.divider }]}>
                <View>
                  <Text style={[styles.convHeaderTitle, { color: palette.textPrimary }]}>
                    {selectedConv.title}
                  </Text>
                  <Text style={[styles.convHeaderSub, { color: palette.textSecondary }]}>
                    {selectedConv.type} • {selectedConv.messages.length} archived messages
                  </Text>
                </View>
              </View>

              {selectedConv.messages.length === 0 ? (
                <Text style={[styles.emptyMsg, { color: palette.textSecondary }]}>
                  No messages recorded in this conversation snapshot.
                </Text>
              ) : (
                selectedConv.messages.map((m, idx) => {
                  const isCurrentAuthor =
                    m.senderId === archive.user.id || m.senderDisplayName === archive.user.displayName;
                  return (
                    <View
                      key={m.id || idx}
                      style={[
                        styles.msgBubble,
                        isCurrentAuthor
                          ? [styles.outgoingBubble, { backgroundColor: '#005c4b' }]
                          : [styles.incomingBubble, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }],
                      ]}
                    >
                      <Text style={[styles.msgSender, { color: isCurrentAuthor ? '#86efac' : '#53bdeb' }]}>
                        {m.senderDisplayName || (isCurrentAuthor ? archive.user.displayName : 'Participant')}
                      </Text>

                      {/* Content strictly rendered as untrusted plain text */}
                      {m.type === 'TEXT' ? (
                        <Text style={[styles.msgText, { color: '#ffffff' }]} selectable>
                          {m.content}
                        </Text>
                      ) : (
                        <View style={styles.offlineAttachmentBox}>
                          <Ionicons name="document-attach-outline" size={16} color="#8696a0" />
                          <Text style={styles.offlineAttachmentText}>
                            [{m.type} Attachment — Not bundled in text archive]
                          </Text>
                        </View>
                      )}

                      {m.isTruncated && (
                        <Text style={styles.truncatedWarning}>
                          [Display truncated: text exceeded 10,000 characters. Original archive file on disk remains unaltered.]
                        </Text>
                      )}

                      <Text style={[styles.msgTime, { color: 'rgba(255, 255, 255, 0.6)' }]}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  );
                })
              )}
            </LiquidGlassSurface>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { padding: 6, marginRight: 8 },
  headerTitleCol: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bold },
  headerSubtitle: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  scrollBody: { flex: 1 },
  scrollContent: { padding: 16 },
  warningCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
  },
  warningTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  warningHeading: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#eab308' },
  warningBody: { fontSize: 11.5, fontFamily: FONTS.regular, lineHeight: 16 },
  mismatchCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  mismatchHeading: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#ef4444' },
  mismatchBody: { fontSize: 11.5, fontFamily: FONTS.regular, lineHeight: 16 },
  metaBento: { padding: 14, borderRadius: 14, marginBottom: 16 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  metaLabel: { fontSize: 12.5, fontFamily: FONTS.regular },
  metaVal: { fontSize: 12.5, fontFamily: FONTS.semiBold },
  sectionHeading: {
    fontSize: 11.5,
    fontFamily: FONTS.bold,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  convChipsScroll: { marginBottom: 16 },
  convChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  convChipText: { fontSize: 12.5, fontFamily: FONTS.semiBold },
  messagesContainer: { padding: 14, borderRadius: 14, minHeight: 180 },
  convHeaderRow: {
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  convHeaderTitle: { fontSize: 15, fontFamily: FONTS.semiBold },
  convHeaderSub: { fontSize: 11.5, fontFamily: FONTS.regular, marginTop: 2 },
  emptyMsg: { fontSize: 13, fontFamily: FONTS.regular, textAlign: 'center', marginVertical: 20 },
  msgBubble: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '85%',
  },
  incomingBubble: { alignSelf: 'flex-start' },
  outgoingBubble: { alignSelf: 'flex-end' },
  msgSender: { fontSize: 11, fontFamily: FONTS.bold, marginBottom: 4 },
  msgText: { fontSize: 13.5, fontFamily: FONTS.regular, lineHeight: 18 },
  msgTime: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  offlineAttachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    gap: 6,
  },
  offlineAttachmentText: {
    fontSize: 11.5,
    fontFamily: FONTS.regular,
    color: '#8696a0',
    fontStyle: 'italic',
  },
  truncatedWarning: {
    fontSize: 10.5,
    fontFamily: FONTS.semiBold,
    color: '#eab308',
    marginTop: 4,
  },
});
