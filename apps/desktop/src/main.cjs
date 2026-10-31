const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('./server.cjs');

let mainWindow = null;
let tray = null;
let embeddedServer = null;

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const gotTheLock = app.requestSingleInstanceLock();

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

    let targetBackend = process.env.BACKEND_URL || 'http://localhost:8080';

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
    mainWindow = new BrowserWindow({
      width: 1240,
      height: 840,
      minWidth: 860,
      minHeight: 600,
      title: 'IndiChat',
      icon: iconPath,
      backgroundColor: '#111b21',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
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

// IPC Handlers
ipcMain.on('open-external', (_event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
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
