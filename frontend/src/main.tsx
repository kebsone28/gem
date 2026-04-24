/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
// ── Polyfill for crypto.randomUUID (Fix for non-secure HTTP contexts) ────────
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as any;
  };
}

import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/theme.css';
import './index.css';

import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { LabelsProvider } from './contexts/LabelsContext';
import { SyncProvider } from './contexts/SyncContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Pure service initialisation — independent of React lifecycle ───────────
import { startBackgroundSync } from './services/sync/backgroundSyncService';
import { initOfflineListener } from './services/offline/offlineService';
import logger from './utils/logger';

async function cleanupDevServiceWorkers() {
  if (!import.meta.env.DEV || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => key.includes('workbox') || key.includes('api-cache') || key.includes('households-mvt-cache'))
          .map((key) => caches.delete(key))
      );
    }

    logger.debug('💎 [PWA] Service workers de développement nettoyés');
  } catch (error) {
    logger.warn('⚠️ [PWA] Impossible de nettoyer les service workers en dev', error);
  }
}

// Start services before React mounts — they run for the full app lifetime
void cleanupDevServiceWorkers();
initOfflineListener();
startBackgroundSync();

// ── Render ─────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <LabelsProvider>
          <SyncProvider>
            <ThemeProvider>
              <ProjectProvider>
                <App />
              </ProjectProvider>
            </ThemeProvider>
          </SyncProvider>
        </LabelsProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
