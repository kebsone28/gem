import React from 'react';
// ── Polyfill for crypto.randomUUID (Fix for non-secure HTTP contexts) ────────
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
    crypto.randomUUID = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
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
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Pure service initialisation — independent of React lifecycle ───────────
import { startBackgroundSync } from './services/sync/backgroundSyncService';
import { initOfflineListener } from './services/offline/offlineService';

// Start services before React mounts — they run for the full app lifetime
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
                            <App />
                        </ThemeProvider>
                    </SyncProvider>
                </LabelsProvider>
            </AuthProvider>
        </ErrorBoundary>
    </React.StrictMode>
);
