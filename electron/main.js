const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
let keytar = null;
try { keytar = require('keytar'); } catch (e) { console.warn('keytar not available; tokens will not be OS-protected'); }

const SERVICE_NAME = 'Proquelec-Kobo';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Charger la page principale du projet
  const isDev = !app.isPackaged;
  const indexPath = isDev
    ? path.join(__dirname, '..', 'index.html')
    : path.join(__dirname, '..', 'dist', 'index.html');

  win.loadFile(indexPath).catch(err => {
    console.error('Erreur chargement index.html:', err);
    dialog.showErrorBox('Erreur', `Impossible de charger index.html\n${err.message}`);
  });

  // Ouvrir les outils de dev si on le souhaite (commenter en prod)
  // win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // Handlers Kobo proxy (évite CORS et exposition token)
  ipcMain.handle('kobo:testConnection', async (_event, { token, assetUid }) => {
    if (!token) throw new Error('Token requis');
    const base = 'https://kf.kobotoolbox.org/api/v2';
    const url = assetUid ? `${base}/assets/${assetUid}/` : `${base}/assets/`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Token ${token}` },
      dispatcher: new https.Agent({ keepAlive: true, rejectUnauthorized: true })
    });
    if (res.status === 401) throw new Error('Token invalide');
    if (!res.ok) throw new Error(`Erreur Kobo ${res.status}`);
    return { ok: true };
  });

  ipcMain.handle('kobo:fetchData', async (_event, { token, assetUid }) => {
    if (!token || !assetUid) throw new Error('Token et Asset UID requis');
    const base = 'https://kf.kobotoolbox.org/api/v2';
    const url = `${base}/assets/${assetUid}/data/?format=json`;
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}` },
      dispatcher: new https.Agent({ keepAlive: true, rejectUnauthorized: true })
    });
    if (res.status === 401) throw new Error('Token invalide');
    if (!res.ok) throw new Error(`Erreur Kobo ${res.status}`);
    const data = await res.json();
    return data.results || data;
  });

  // Stockage sécurisé du token via OS (keytar)
  ipcMain.handle('kobo:saveToken', async (_event, { username = 'default', token }) => {
    if (!token) throw new Error('Token requis');
    if (!keytar) throw new Error('Stockage sécurisé indisponible (keytar non chargé)');
    await keytar.setPassword(SERVICE_NAME, username, token);
    return true;
  });

  ipcMain.handle('kobo:getToken', async (_event, { username = 'default' }) => {
    if (!keytar) throw new Error('Stockage sécurisé indisponible (keytar non chargé)');
    const token = await keytar.getPassword(SERVICE_NAME, username);
    return token || null;
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
