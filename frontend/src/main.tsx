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

function hardenDomRemoveChild() {
  if (typeof window === 'undefined' || typeof Node === 'undefined') {
    return;
  }

  const originalRemoveChild = Node.prototype.removeChild;
  if ((originalRemoveChild as any).__gemSafeRemoveChild) {
    return;
  }

  const safeRemoveChild = function <T extends Node>(this: Node, child: T): T {
    try {
      return originalRemoveChild.call(this, child) as T;
    } catch (error) {
      const isDetachedChild =
        error instanceof DOMException &&
        error.name === 'NotFoundError' &&
        child &&
        child.parentNode !== this;

      if (isDetachedChild) {
        logger.warn('[DOM] removeChild ignored because the node was already detached');
        return child;
      }

      throw error;
    }
  };

  (safeRemoveChild as any).__gemSafeRemoveChild = true;
  Node.prototype.removeChild = safeRemoveChild as typeof Node.prototype.removeChild;
}

function initMobileViewportSizing() {
  if (typeof window === 'undefined') {
    return;
  }

  const setViewportHeight = () => {
    const height = window.visualViewport?.height || window.innerHeight;
    if (height > 0) {
      document.documentElement.style.setProperty('--gem-vh', `${height}px`);
    }
  };

  setViewportHeight();
  window.addEventListener('resize', setViewportHeight, { passive: true });
  window.addEventListener('orientationchange', setViewportHeight, { passive: true });
  window.visualViewport?.addEventListener('resize', setViewportHeight, { passive: true });
}

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
hardenDomRemoveChild();
initMobileViewportSizing();
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
