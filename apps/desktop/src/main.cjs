const electron = require('electron');
const app = electron && typeof electron === 'object' ? electron.app : undefined;
const BrowserWindow = electron && typeof electron === 'object' ? electron.BrowserWindow : undefined;
const Menu = electron && typeof electron === 'object' ? electron.Menu : undefined;
const Tray = electron && typeof electron === 'object' ? electron.Tray : undefined;
const nativeImage = electron && typeof electron === 'object' ? electron.nativeImage : undefined;
const shell = electron && typeof electron === 'object' ? electron.shell : undefined;
const ipcMain = electron && typeof electron === 'object' ? electron.ipcMain : undefined;
const path = require('path');
const fs = require('fs');
const { startServer } = require('./server.cjs');

let mainWindow = null;
let tray = null;
let embeddedServer = null;

// Configuration Persistence & Server URL Validation
function getConfigPath() {
  try {
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'desktop-config.json');
    }
  } catch (_) {}
  return path.join(process.cwd(), 'desktop-config.json');
}

function sanitizeServerUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Server URL must be a non-empty string');
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    throw new Error('Server URL must be a non-empty string');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    throw new Error('Invalid URL format: unable to parse');
  }

  // Accept only valid HTTP/HTTPS URLs (retain local development HTTP support)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.`);
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    throw new Error('Embedded credentials (username/password) are not permitted in server URL');
  }

  // Validate hostname
  if (!parsed.hostname || parsed.hostname.length === 0) {
    throw new Error('Server URL must include a valid hostname');
  }

  // Return normalized origin (preserves protocol, host, and port without trailing slash)
  return parsed.origin;
}

function loadPersistedServerUrl(customConfigPath) {
  try {
    const filePath = customConfigPath || getConfigPath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data && data.serverUrl) {
        return sanitizeServerUrl(data.serverUrl);
      }
    }
  } catch (err) {
    console.warn('[Desktop Config] Failed to read desktop-config.json:', err.message);
  }
  return process.env.BACKEND_URL || 'http://localhost:8080';
}

function savePersistedServerUrl(newUrl, customConfigPath) {
  const sanitized = sanitizeServerUrl(newUrl);
  try {
    const filePath = customConfigPath || getConfigPath();
    const configDir = path.dirname(filePath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    let data = {};
    if (fs.existsSync(filePath)) {
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
      } catch (_) {}
    }
    data.serverUrl = sanitized;
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Desktop Config] Failed to write desktop-config.json:', err.message);
    throw new Error('Failed to persist server URL: ' + err.message);
  }
  return sanitized;
}

function validateIpcSender(event, targetWindow) {
  if (!targetWindow || !targetWindow.webContents) {
    throw new Error('Main window is not initialized');
  }
  if (!event || !event.sender || event.sender !== targetWindow.webContents) {
    throw new Error('Unauthorized IPC sender: caller does not match main window');
  }
  if (event.senderFrame && event.senderFrame.parent !== null) {
    throw new Error('Unauthorized IPC sender: sub-frames are not permitted');
  }
}

let targetBackend = loadPersistedServerUrl();

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

if (app) {
  const gotTheLock = typeof app.requestSingleInstanceLock === 'function' ? app.requestSingleInstanceLock() : false;

  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    app.whenReady().then(async () => {
    // 1. Set Linux App User Model ID
    if (process.platform === 'linux') {
      app.setAppUserModelId('org.indichat.IndiChat');
    }

    // 2. Resolve static assets path
    let staticDir = path.join(__dirname, '..', 'dist-web');
    if (!fs.existsSync(staticDir)) {
      // Check monorepo sibling path (apps/web/dist)
      const siblingWebDist = path.resolve(__dirname, '../../web/dist');
      if (fs.existsSync(siblingWebDist)) {
        staticDir = siblingWebDist;
      }
    }

    targetBackend = loadPersistedServerUrl();

    // 3. Start local embedded proxy server for production/packaged execution
    let startUrl = '';
    if (isDev && process.env.VITE_DEV_SERVER) {
      startUrl = process.env.VITE_DEV_SERVER;
    } else {
      try {
        const { localUrl, server } = await startServer({
          staticDir,
          targetBackendUrl: targetBackend
        });
        embeddedServer = server;
        startUrl = localUrl;
      } catch (err) {
        console.error('Failed to start embedded server:', err);
        startUrl = `file://${path.join(staticDir, 'index.html')}`;
      }
    }

    // 4. Create Main Application Window
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';

    mainWindow = new BrowserWindow({
      width: 1240,
      height: 840,
      minWidth: 860,
      minHeight: 600,
      title: 'IndiChat',
      icon: iconPath,
      backgroundColor: '#111b21',
      show: false,
      titleBarStyle: isMac ? 'hiddenInset' : (isWin ? 'hidden' : 'default'),
      trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    // 5. Native Permissions (Media & Notifications for calls and messaging)
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['media', 'notifications', 'audioCapture', 'videoCapture'];
      if (allowedPermissions.includes(permission)) {
        return callback(true);
      }
      callback(false);
    });

    // 6. Native Linux Application Menu
    createApplicationMenu();

    // 7. System Tray Integration
    createSystemTray(iconPath);

    // 8. Load IndiChat
    mainWindow.loadURL(startUrl);

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http:') || url.startsWith('https:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    mainWindow.on('close', (event) => {
      if (!app.isQuitting) {
        // Keep in tray on close if user prefers
        // Uncomment to minimize to tray:
        // event.preventDefault();
        // mainWindow.hide();
      }
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Re-create window if requested
    } else if (mainWindow) {
      mainWindow.show();
    }
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    if (embeddedServer) {
      try {
        embeddedServer.close();
      } catch (e) {}
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
}

// IPC Handlers
if (ipcMain) {
  ipcMain.on('open-external', (_event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://')) && shell) {
      shell.openExternal(url);
    }
  });

  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('get-server-url', (event) => {
    validateIpcSender(event, mainWindow);
    return targetBackend;
  });

  ipcMain.handle('set-server-url', async (event, url) => {
    validateIpcSender(event, mainWindow);
    const sanitized = savePersistedServerUrl(url);
    targetBackend = sanitized;
    return { success: true, serverUrl: sanitized };
  });
}

function createSystemTray(iconPath) {
  try {
    if (!fs.existsSync(iconPath)) return;
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
    tray = new Tray(trayIcon);
    tray.setToolTip('IndiChat Messenger');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open IndiChat',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.warn('[Desktop Tray] Tray initialization warning:', err.message);
  }
}

function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.reload()
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Ctrl+Shift+I',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About IndiChat',
          click: () => {
            shell.openExternal('https://github.com/adityakalambe01');
          }
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/adityakalambe01/IndiChat');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = {
  sanitizeServerUrl,
  validateIpcSender,
  getConfigPath,
  loadPersistedServerUrl,
  savePersistedServerUrl
};
