const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('indichatDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: '1.0.0',
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url)
});
