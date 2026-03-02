const { contextBridge, ipcRenderer } = require('electron');

// Exposer une API minimale côté renderer si besoin
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform
});

// Proxy sécurisé pour Kobo (évite l'exposition du token dans le renderer)
contextBridge.exposeInMainWorld('koboProxy', {
  fetchData: (token, assetUid) => ipcRenderer.invoke('kobo:fetchData', { token, assetUid }),
  testConnection: (token, assetUid) => ipcRenderer.invoke('kobo:testConnection', { token, assetUid }),
  saveToken: (token, username = 'default') => ipcRenderer.invoke('kobo:saveToken', { token, username }),
  getToken: (username = 'default') => ipcRenderer.invoke('kobo:getToken', { username })
});
