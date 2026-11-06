/**
 * apps/mobile/services/backup.ts
 *
 * Real Chat Backup & Archive Service:
 *  - Calls existing backend endpoint GET /api/v1/conversations/backup
 *  - Creates genuine JSON archive in local application sandbox storage
 *  - Verifies file readability and measures actual on-disk file size
 *  - Supports cancellation and safely cleans up partial files on abort/error
 *  - Discloses unencrypted plaintext storage and media attachment exclusion
 *  - Provides "View Local Archive" validation with strict safety limits:
 *      * Max file size: 10 MB
 *      * Max conversations: 500
 *      * Max total messages: 10,000 (max 2,000 per conversation)
 *      * Max message text length: 10,000 chars (truncated safely)
 *      * Zero content execution, zero remote media fetches, zero live database mutations
 */

import * as FileSystem from 'expo-file-system/legacy';
import { api } from './api';
import { settingsService } from './settings';
import { storage, STORAGE_KEYS } from './storage';

export const BACKUP_LIMITS = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_CONVERSATION_COUNT: 500,
  MAX_TOTAL_MESSAGES: 10000,
  MAX_MESSAGES_PER_CONVERSATION: 2000,
  MAX_MESSAGE_TEXT_LENGTH: 10000,
};

export interface BackupResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSizeBytes?: number;
  formattedSize?: string;
  exportedAt?: string;
  totalConversations?: number;
  totalMessages?: number;
  error?: string;
  cancelled?: boolean;
}

export interface BackupFileInfo {
  exists: boolean;
  uri?: string;
  sizeBytes?: number;
  formattedSize?: string;
  modificationTime?: number;
  readable?: boolean;
}

export interface ArchiveMessage {
  id: string;
  senderId: string;
  senderDisplayName?: string;
  type: string;
  content: string;
  createdAt: string;
  isTruncated?: boolean;
}

export interface ArchiveConversation {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  members: Array<{ userId: string; role: string; displayName: string; username: string }>;
  messages: ArchiveMessage[];
}

export interface ValidatedArchive {
  format: string;
  version: string;
  exportedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    email?: string;
    phoneNumber?: string;
  };
  summary: {
    totalConversations: number;
    totalMessages: number;
    fileSizeBytes: number;
  };
  conversations: ArchiveConversation[];
  filePath: string;
  fileName: string;
  formattedSize: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Ensures the dedicated backup directory exists in the app sandbox.
 */
async function ensureBackupDirectory(): Promise<string> {
  const baseDir = FileSystem.documentDirectory || '';
  const backupDir = `${baseDir}backups/`;
  const info = await FileSystem.getInfoAsync(backupDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
  }
  return backupDir;
}

/**
 * Safely removes a file from disk if it exists (used during cancellation cleanup).
 */
async function safeDeleteFile(filePath: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
  } catch (err) {
    // Suppress cleanup error
  }
}

/**
 * Checks information about the last recorded backup file on disk.
 */
export async function getLastBackupFileInfo(): Promise<BackupFileInfo | null> {
  try {
    const savedPath = await storage.getItem(STORAGE_KEYS.LAST_BACKUP_PATH);
    if (!savedPath) return null;

    const info = await FileSystem.getInfoAsync(savedPath);
    if (!info.exists) {
      return { exists: false, uri: savedPath };
    }

    const sizeBytes = (info as any).size || 0;
    let readable = false;
    try {
      const sample = await FileSystem.readAsStringAsync(savedPath, { length: 64 });
      readable = sample.length > 0;
    } catch {
      readable = false;
    }

    return {
      exists: true,
      uri: savedPath,
      sizeBytes,
      formattedSize: formatFileSize(sizeBytes),
      modificationTime: (info as any).modificationTime,
      readable,
    };
  } catch (err) {
    console.warn('Failed to inspect last backup file:', err);
    return null;
  }
}

/**
 * Executes a genuine local chat backup:
 *  1. Fetches real conversation records from backend GET /api/v1/conversations/backup
 *  2. Writes structured archive to local filesystem
 *  3. Measures actual on-disk byte size (no fabrication)
 *  4. Reads back the file to verify integrity and readability
 *  5. Safely deletes partial file if user cancels or operation fails
 *  6. Updates userSettings with actual timestamp and verified size
 */
export async function performChatBackup(options?: {
  signal?: AbortSignal;
  onProgress?: (stage: string) => void;
}): Promise<BackupResult> {
  const { signal, onProgress } = options || {};
  let targetPath: string | null = null;

  try {
    if (signal?.aborted) {
      return { success: false, cancelled: true, error: 'Backup cancelled by user' };
    }

    onProgress?.('Connecting to server & fetching chat records...');
    const serverData = await api.getChatBackup(signal);

    if (signal?.aborted) {
      return { success: false, cancelled: true, error: 'Backup cancelled by user' };
    }

    onProgress?.('Preparing local backup archive...');
    const backupDir = await ensureBackupDirectory();

    const timestamp = new Date();
    const isoString = timestamp.toISOString();
    const dateTag = isoString.replace(/[:.]/g, '-');
    const fileName = `indichat_backup_${dateTag}.json`;
    targetPath = `${backupDir}${fileName}`;

    // Structure archive with clear disclosure metadata
    const archivePayload = {
      format: 'indichat-backup-archive',
      version: '1.0',
      exportedAt: isoString,
      encryption: 'NONE (Unencrypted Plaintext)',
      mediaIncluded: false,
      disclosure:
        'This archive contains conversation threads, participant metadata, and message text only. Media attachments stored in object storage (MinIO/S3) are excluded from this offline JSON file. The file is unencrypted, editable plaintext stored in the application sandbox. Authorship and timestamps are unauthenticated.',
      ...serverData,
    };

    if (signal?.aborted) {
      await safeDeleteFile(targetPath);
      return { success: false, cancelled: true, error: 'Backup cancelled by user' };
    }

    onProgress?.('Writing archive to local device storage...');
    const serialized = JSON.stringify(archivePayload, null, 2);
    await FileSystem.writeAsStringAsync(targetPath, serialized, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (signal?.aborted) {
      await safeDeleteFile(targetPath);
      return { success: false, cancelled: true, error: 'Backup cancelled by user' };
    }

    onProgress?.('Verifying file integrity and readability...');
    const fileInfo = await FileSystem.getInfoAsync(targetPath);
    if (!fileInfo.exists) {
      throw new Error('Backup write failed: File not found on disk after write operation.');
    }

    const actualBytes = (fileInfo as any).size ?? (typeof Blob !== 'undefined' ? new Blob([serialized]).size : serialized.length);
    if (actualBytes <= 0) {
      await safeDeleteFile(targetPath);
      throw new Error('Backup verification failed: Generated file on disk is empty (0 bytes).');
    }

    if (signal?.aborted) {
      await safeDeleteFile(targetPath);
      return { success: false, cancelled: true, error: 'Backup cancelled by user' };
    }

    // Verify readability by reading back and parsing
    const readBackContent = await FileSystem.readAsStringAsync(targetPath);
    const parsedVerification = JSON.parse(readBackContent);
    if (!parsedVerification || parsedVerification.format !== 'indichat-backup-archive') {
      await safeDeleteFile(targetPath);
      throw new Error('Backup integrity verification failed: Archive structure corrupted on read-back.');
    }

    const formattedSize = formatFileSize(actualBytes);
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedDate = `Today, ${timeStr} (${formattedSize})`;

    // Persist verified path and settings
    await storage.setItem(STORAGE_KEYS.LAST_BACKUP_PATH, targetPath);
    settingsService.update({
      lastBackupDate: formattedDate,
      backupSize: formattedSize,
    });

    const summary = serverData?.summary || {};
    const totalConversations = summary.totalConversations ?? (serverData?.conversations?.length || 0);
    const totalMessages = summary.totalMessages ?? 0;

    return {
      success: true,
      filePath: targetPath,
      fileName,
      fileSizeBytes: actualBytes,
      formattedSize,
      exportedAt: isoString,
      totalConversations,
      totalMessages,
    };
  } catch (err: any) {
    if (targetPath) {
      await safeDeleteFile(targetPath);
    }
    if (signal?.aborted || err?.name === 'AbortError') {
      return { success: false, cancelled: true, error: 'Backup cancelled by user' };
    }
    console.error('Chat backup failed:', err);
    return {
      success: false,
      cancelled: false,
      error: err?.message || 'An unexpected error occurred while creating chat backup.',
    };
  }
}

/**
 * Validates and safely loads a local chat backup archive for read-only inspection.
 * Strict security constraints:
 *  - Enforces file size limit (max 10 MB)
 *  - Enforces conversation count limit (max 500)
 *  - Enforces message count limit (max 10,000 total, max 2,000 per conv)
 *  - Safely truncates message text exceeding 10,000 characters
 *  - Zero execution, zero remote media fetches, zero live database merging
 */
export async function loadAndValidateLocalArchive(
  filePath?: string
): Promise<{ valid: boolean; archive?: ValidatedArchive; error?: string }> {
  try {
    const target = filePath || (await storage.getItem(STORAGE_KEYS.LAST_BACKUP_PATH));
    if (!target) {
      return { valid: false, error: 'No local backup archive found on this device.' };
    }

    // 1. Verify existence and physical size
    const info = await FileSystem.getInfoAsync(target);
    if (!info.exists) {
      return { valid: false, error: 'Archive file not found on disk. It may have been deleted or moved.' };
    }

    const sizeBytes = (info as any).size || 0;
    if (sizeBytes <= 0) {
      return { valid: false, error: 'The backup archive file is empty (0 bytes).' };
    }

    if (sizeBytes > BACKUP_LIMITS.MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `Archive size (${formatFileSize(sizeBytes)}) exceeds safety limit of 10 MB.`,
      };
    }

    // 2. Read contents safely
    let content: string;
    try {
      content = await FileSystem.readAsStringAsync(target, { encoding: FileSystem.EncodingType.UTF8 });
    } catch (readErr: any) {
      return { valid: false, error: `Unable to read archive from storage: ${readErr?.message || 'Read error'}` };
    }

    // 3. Parse JSON safely
    let raw: any;
    try {
      raw = JSON.parse(content);
    } catch {
      return { valid: false, error: 'Malformed archive: The file does not contain valid JSON.' };
    }

    // 4. Validate header format and version
    if (!raw || typeof raw !== 'object') {
      return { valid: false, error: 'Malformed archive: Root JSON structure must be an object.' };
    }

    if (raw.format !== 'indichat-backup-archive') {
      return {
        valid: false,
        error: `Unrecognized archive format (${raw.format || 'unknown'}). Expected 'indichat-backup-archive'.`,
      };
    }

    if (raw.version !== '1.0') {
      return {
        valid: false,
        error: `Unsupported archive version (${raw.version || 'none'}). Only version 1.0 is supported.`,
      };
    }

    if (!raw.user || typeof raw.user !== 'object' || !raw.user.username) {
      return { valid: false, error: 'Malformed archive: User account profile metadata is missing.' };
    }

    if (!Array.isArray(raw.conversations)) {
      return { valid: false, error: 'Malformed archive: Conversations array is missing or invalid.' };
    }

    if (raw.conversations.length > BACKUP_LIMITS.MAX_CONVERSATION_COUNT) {
      return {
        valid: false,
        error: `Archive contains ${raw.conversations.length} conversations, exceeding safety limit of ${BACKUP_LIMITS.MAX_CONVERSATION_COUNT}.`,
      };
    }

    // 5. Sanitize and enforce message limits
    let totalMessagesProcessed = 0;
    const sanitizedConversations: ArchiveConversation[] = [];

    for (const c of raw.conversations) {
      if (!c || typeof c !== 'object') continue;

      const rawMessages = Array.isArray(c.messages) ? c.messages : [];
      const messagesToProcess = rawMessages.slice(0, BACKUP_LIMITS.MAX_MESSAGES_PER_CONVERSATION);

      const sanitizedMessages: ArchiveMessage[] = [];
      for (const m of messagesToProcess) {
        if (totalMessagesProcessed >= BACKUP_LIMITS.MAX_TOTAL_MESSAGES) break;

        const rawContent = typeof m.content === 'string' ? m.content : String(m.content || '');
        const isTruncated = rawContent.length > BACKUP_LIMITS.MAX_MESSAGE_TEXT_LENGTH;
        const safeContent = isTruncated
          ? rawContent.slice(0, BACKUP_LIMITS.MAX_MESSAGE_TEXT_LENGTH)
          : rawContent;

        sanitizedMessages.push({
          id: String(m.id || `msg-${Math.random()}`),
          senderId: String(m.senderId || ''),
          senderDisplayName: typeof m.senderDisplayName === 'string' ? m.senderDisplayName : undefined,
          type: String(m.type || 'TEXT'),
          content: safeContent,
          createdAt: String(m.createdAt || new Date().toISOString()),
          isTruncated,
        });
        totalMessagesProcessed++;
      }

      const membersList = Array.isArray(c.members)
        ? c.members.map((mem: any) => ({
            userId: String(mem.userId || ''),
            role: String(mem.role || 'MEMBER'),
            displayName: String(mem.displayName || mem.username || 'Member'),
            username: String(mem.username || ''),
          }))
        : [];

      sanitizedConversations.push({
        id: String(c.id || `conv-${Math.random()}`),
        type: String(c.type || 'DIRECT'),
        title: String(c.title || (c.type === 'GROUP' ? 'Group Chat' : 'Direct Chat')),
        createdAt: String(c.createdAt || ''),
        updatedAt: String(c.updatedAt || ''),
        memberCount: membersList.length,
        members: membersList,
        messages: sanitizedMessages,
      });

      if (totalMessagesProcessed >= BACKUP_LIMITS.MAX_TOTAL_MESSAGES) break;
    }

    const pathSegments = target.split('/');
    const fileName = pathSegments[pathSegments.length - 1] || 'backup.json';

    return {
      valid: true,
      archive: {
        format: raw.format,
        version: raw.version,
        exportedAt: String(raw.exportedAt || ''),
        user: {
          id: String(raw.user.id || ''),
          username: String(raw.user.username || ''),
          displayName: String(raw.user.displayName || raw.user.username || ''),
          email: raw.user.email ? String(raw.user.email) : undefined,
          phoneNumber: raw.user.phoneNumber ? String(raw.user.phoneNumber) : undefined,
        },
        summary: {
          totalConversations: sanitizedConversations.length,
          totalMessages: totalMessagesProcessed,
          fileSizeBytes: sizeBytes,
        },
        conversations: sanitizedConversations,
        filePath: target,
        fileName,
        formattedSize: formatFileSize(sizeBytes),
      },
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Archive validation failed: ${err?.message || 'Unknown validation error'}`,
    };
  }
}
