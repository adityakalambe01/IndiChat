/**
 * test-sandbox-preload.cjs
 *
 * Test-only preload script used exclusively to verify Electron's renderer process
 * sandbox status without modifying the production preload bridge.
 */
const { contextBridge, ipcRenderer } = require('electron');

const diagnostic = {
  sandboxed: process.sandboxed,
  processType: process.type,
  hasProcessGlobal: typeof process !== 'undefined',
  platform: process.platform,
  arch: process.arch
};

contextBridge.exposeInMainWorld('sandboxDiagnostic', diagnostic);

// Deliver diagnostic payload directly to main process via IPC
ipcRenderer.send('sandbox-diagnostic-result', diagnostic);

