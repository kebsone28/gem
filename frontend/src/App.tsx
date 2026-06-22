import React, { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import BackgroundServices from './components/BackgroundServices';
import ImpersonationBanner from './components/ImpersonationBanner';
import ChatNotificationHandler from './components/ChatNotificationHandler';
import { Toaster } from 'react-hot-toast';
import { LazyRouteErrorBoundary } from './components/LazyRouteErrorBoundary';
import { useWebSockets } from './hooks/useWebSockets';
import { AppRouter, PageLoader } from './core/router/AppRouter';
import { initKernelOrchestrator } from './core/events/KernelOrchestrator';

// ── App ────────────────────────────────────────────────────────────────────
function App() {
  const { isLoading } = useAuth();
  useWebSockets();

  // 🚀 Démarrage du Kernel Orchestrator (une seule fois, cleanup HMR)
  useEffect(() => {
    const cleanup = initKernelOrchestrator();
    return cleanup;
  }, []);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Router>
      <ImpersonationBanner />
      <BackgroundServices />
      <ChatNotificationHandler />
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', borderRadius: '1rem' } }} />

      <LazyRouteErrorBoundary>
        <AppRouter />
      </LazyRouteErrorBoundary>
    </Router>
  );
}

export default App;
