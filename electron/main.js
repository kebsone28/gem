const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const https = require('https');

let keytar = null;
try {
  keytar = require('keytar');
} catch {
  console.warn('keytar not available; tokens will not be OS-protected');
}

const SERVICE_NAME = 'Proquelec-Kobo';
const DEV_SERVER_URL = process.env.ELECTRON_DEV_SERVER_URL || 'http://localhost:5173';

async function waitForDevServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Dev server not ready yet.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return false;
}

async function loadRenderer(win) {
  if (!app.isPackaged) {
    const isReady = await waitForDevServer(DEV_SERVER_URL);
    if (!isReady) {
      dialog.showErrorBox(
        'Frontend non disponible',
        `Le serveur frontend ne répond pas sur ${DEV_SERVER_URL}.\nLancez npm run dev:saas puis relancez Electron.`
      );
      return;
    }

    try {
      await win.loadURL(DEV_SERVER_URL);
    } catch (err) {
      if (err?.code !== 'ERR_ABORTED') throw err;
    }
    return;
  }

  const indexPath = path.join(app.getAppPath(), 'frontend', 'dist', 'index.html');
  try {
    await win.loadFile(indexPath);
  } catch (err) {
    if (err?.code !== 'ERR_ABORTED') throw err;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  loadRenderer(win).catch(err => {
    console.error('Erreur chargement application:', err);
    dialog.showErrorBox('Erreur', `Impossible de charger l'application\n${err.message}`);
  });
}

function registerKoboHandlers() {
  ipcMain.handle('kobo:testConnection', async (_event, { token, assetUid }) => {
    if (!token) throw new Error('Token requis');
    const base = 'https://kf.kobotoolbox.org/api/v2';
    const url = assetUid ? `${base}/assets/${assetUid}/` : `${base}/assets/`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Token ${token}` },
      dispatcher: new https.Agent({ keepAlive: true, rejectUnauthorized: true }),
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
      dispatcher: new https.Agent({ keepAlive: true, rejectUnauthorized: true }),
    });
    if (res.status === 401) throw new Error('Token invalide');
    if (!res.ok) throw new Error(`Erreur Kobo ${res.status}`);
    const data = await res.json();
    return data.results || data;
  });

  ipcMain.handle('kobo:saveToken', async (_event, { username = 'default', token }) => {
    if (!token) throw new Error('Token requis');
    if (!keytar) throw new Error('Stockage sécurisé indisponible');
    await keytar.setPassword(SERVICE_NAME, username, token);
    return true;
  });

  ipcMain.handle('kobo:getToken', async (_event, { username = 'default' }) => {
    if (!keytar) throw new Error('Stockage sécurisé indisponible');
    return (await keytar.getPassword(SERVICE_NAME, username)) || null;
  });
}

app.whenReady().then(() => {
  registerKoboHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
