/**
 * scripts/test_backup_service.mjs
 *
 * Automated regression test verifying genuine local chat backup:
 *  - Formats actual file sizes (B, KB, MB) accurately
 *  - Calls existing backend backup endpoint
 *  - Writes JSON archive with disclosures to app sandbox
 *  - Verifies readability and on-disk file size
 *  - Supports AbortController cancellation cleanly
 *  - Updates settingsService with verified actual timestamp and file size
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Register loader for extensionless TS imports and external boundaries
register(pathToFileURL(path.resolve('scripts/test-resolver.mjs')));

import test from 'node:test';
import assert from 'node:assert/strict';

// Dynamically import actual application logic after registering loader
const { performChatBackup, formatFileSize, getLastBackupFileInfo, loadAndValidateLocalArchive } = await import(
  '../apps/mobile/services/backup.ts'
);
const { api } = await import('../apps/mobile/services/api.ts');
const { settingsService } = await import('../apps/mobile/services/settings.ts');

test('formatFileSize: converts byte counts honestly without fabrication', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(25600), '25.0 KB');
  assert.equal(formatFileSize(1048576), '1.0 MB');
  assert.equal(formatFileSize(15728640), '15.0 MB');
});

test('performChatBackup: successfully exports genuine chat archive and measures disk size', async () => {
  // Mock backend GET /api/v1/conversations/backup response
  const originalGetChatBackup = api.getChatBackup;
  api.getChatBackup = async () => ({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    user: {
      id: 'usr-alice-123',
      username: 'alice',
      displayName: 'Alice Cooper',
      email: 'alice@example.com',
    },
    summary: {
      totalConversations: 3,
      totalMessages: 42,
    },
    conversations: [
      {
        id: 'conv-1',
        type: 'DIRECT',
        title: 'Bob Dylan',
        members: [{ userId: 'usr-bob-456', role: 'MEMBER', displayName: 'Bob Dylan' }],
        messages: [{ id: 'msg-1', senderId: 'usr-bob-456', type: 'TEXT', content: 'Hello Alice!' }],
      },
    ],
  });

  try {
    const progressStages = [];
    const result = await performChatBackup({
      onProgress: (stage) => progressStages.push(stage),
    });

    assert.equal(result.success, true);
    assert.ok(result.filePath?.includes('indichat_backup_'));
    assert.ok(result.fileSizeBytes > 0);
    assert.ok(result.formattedSize?.includes('KB') || result.formattedSize?.includes('B'));
    assert.equal(result.totalConversations, 3);
    assert.equal(result.totalMessages, 42);

    // Verify progress callbacks were invoked
    assert.ok(progressStages.length >= 3);
    assert.ok(progressStages.some((s) => s.includes('fetching')));
    assert.ok(progressStages.some((s) => s.includes('Writing')));

    // Verify settingsService was updated with verified disk size
    const settings = settingsService.getSettings();
    assert.equal(settings.backupSize, result.formattedSize);
    assert.ok(settings.lastBackupDate.includes(result.formattedSize));

    // Verify getLastBackupFileInfo inspects disk
    const fileInfo = await getLastBackupFileInfo();
    assert.ok(fileInfo !== null);
    assert.equal(fileInfo?.exists, true);
    assert.equal(fileInfo?.readable, true);
    assert.equal(fileInfo?.sizeBytes, result.fileSizeBytes);
  } finally {
    api.getChatBackup = originalGetChatBackup;
  }
});

test('performChatBackup: supports AbortController cancellation before network call', async () => {
  const controller = new AbortController();
  controller.abort(); // pre-abort

  const result = await performChatBackup({ signal: controller.signal });
  assert.equal(result.success, false);
  assert.equal(result.cancelled, true);
  assert.ok(result.error?.includes('cancelled'));
});

test('performChatBackup: reports backend network errors honestly', async () => {
  const originalGetChatBackup = api.getChatBackup;
  api.getChatBackup = async () => {
    throw new Error('Connection refused to backend port 8080');
  };

  try {
    const result = await performChatBackup();
    assert.equal(result.success, false);
    assert.equal(result.cancelled, false);
    assert.ok(result.error?.includes('Connection refused'));
  } finally {
    api.getChatBackup = originalGetChatBackup;
  }
});

test('loadAndValidateLocalArchive: successfully parses valid archive and enforces safety limits', async () => {
  const FileSystem = await import('expo-file-system');
  const testPath = `${FileSystem.documentDirectory}backups/test_valid.json`;
  const validArchive = {
    format: 'indichat-backup-archive',
    version: '1.0',
    exportedAt: '2026-11-01T12:00:00.000Z',
    user: { id: 'usr-1', username: 'bob', displayName: 'Bob' },
    conversations: [
      {
        id: 'c1',
        title: 'Alice',
        type: 'DIRECT',
        messages: [
          {
            id: 'm1',
            senderId: 'usr-2',
            senderName: 'Alice',
            content: 'A'.repeat(12000), // Exceeds 10,000 char limit -> should truncate
            createdAt: '2026-11-01T12:01:00.000Z',
          },
        ],
      },
    ],
  };

  await FileSystem.writeAsStringAsync(testPath, JSON.stringify(validArchive));

  const result = await loadAndValidateLocalArchive(testPath);
  assert.equal(result.valid, true);
  assert.ok(result.archive !== undefined);
  assert.equal(result.archive?.conversations.length, 1);
  assert.equal(result.archive?.conversations[0].messages.length, 1);
  // Verify message content in memory was capped to 10,000 characters for UI display
  assert.equal(result.archive?.conversations[0].messages[0].content.length, 10000);
  assert.equal(result.archive?.conversations[0].messages[0].isTruncated, true);

  // Verify original archive file on disk remains completely intact and unaltered
  const diskRaw = JSON.parse(await FileSystem.readAsStringAsync(testPath));
  assert.equal(diskRaw.conversations[0].messages[0].content.length, 12000);
});

test('loadAndValidateLocalArchive: rejects non-existent or malformed archives', async () => {
  const FileSystem = await import('expo-file-system');
  const missingResult = await loadAndValidateLocalArchive('file:///nonexistent/path.json');
  assert.equal(missingResult.valid, false);
  assert.ok(missingResult.error?.includes('not found'));

  const malformedPath = `${FileSystem.documentDirectory}backups/test_malformed.json`;
  await FileSystem.writeAsStringAsync(malformedPath, '{ "version": "1.0", broken json...');
  const malformedResult = await loadAndValidateLocalArchive(malformedPath);
  assert.equal(malformedResult.valid, false);
  assert.ok(malformedResult.error?.includes('Malformed') || malformedResult.error?.includes('JSON'));
});


