import React from 'react';
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
