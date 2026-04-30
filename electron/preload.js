const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});

contextBridge.exposeInMainWorld('koboProxy', {
  fetchData: (token, assetUid) => ipcRenderer.invoke('kobo:fetchData', { token, assetUid }),
  testConnection: (token, assetUid) => ipcRenderer.invoke('kobo:testConnection', { token, assetUid }),
  saveToken: (token, username = 'default') =>
    ipcRenderer.invoke('kobo:saveToken', { token, username }),
  getToken: (username = 'default') => ipcRenderer.invoke('kobo:getToken', { username }),
});
