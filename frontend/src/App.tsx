import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import type { UserRole } from './utils/types';
import Login from './pages/Login';
import Layout from './layouts/Layout';
import BackgroundServices from './components/BackgroundServices';
import SessionWarningToast from './components/SessionWarningToast';
import OfflineBanner from './components/OfflineBanner';
import PWAPrompt from './components/PWAPrompt';
import SyncNotification from './components/SyncNotification';
import { MemoryDiagnostic } from './components/MemoryDiagnostic';
import { Toaster } from 'react-hot-toast';

// ── Lazy-loaded heavy pages (avoids loading MapLibre/xlsx/jspdf on login) ──
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Terrain = lazy(() => import('./pages/Terrain'));
const Cahier = lazy(() => import('./pages/Cahier'));
const Logistique = lazy(() => import('./pages/Logistique'));
const Charges = lazy(() => import('./pages/Charges'));
const Settings = lazy(() => import('./pages/Settings'));
const Simulation = lazy(() => import('./pages/Simulation'));
const Reports = lazy(() => import('./pages/Reports'));
const Aide = lazy(() => import('./pages/Aide'));
const Bordereau = lazy(() => import('./pages/Bordereau'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const DiagnosticSante = lazy(() => import('./pages/DiagnosticSante'));
const SecuritySettings = lazy(() => import('./pages/SecuritySettings'));
const MissionOrder = lazy(() => import('./pages/MissionOrder'));
const KoboTerminal = lazy(() => import('./pages/Dashboard/KoboTerminal'));

// Fallback UI for code-split chunks loading
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0D1E35]">
    <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

const RoleRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: UserRole[] }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <BackgroundServices />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/terrain"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC', 'CHEF_EQUIPE', 'CLIENT_LSE']}>
                <Terrain />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cahier"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC']}>
                <Cahier />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/logistique"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC', 'DG_PROQUELEC']}>
                <Logistique />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/finances"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC', 'DG_PROQUELEC']}>
                <Charges />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC']}>
                <Settings />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/simulation"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC', 'DG_PROQUELEC']}>
                <Simulation />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/rapports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bordereau"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC', 'DG_PROQUELEC']}>
                <Bordereau />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/aide"
          element={
            <ProtectedRoute>
              <Aide />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC']}>
                <AdminUsers />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/security"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC']}>
                <SecuritySettings />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/diagnostic"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC']}>
                <DiagnosticSante />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/mission"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC']}>
                <MissionOrder />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kobo-terminal"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN_PROQUELEC', 'DG_PROQUELEC']}>
                <KoboTerminal />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      <SessionWarningToast />
      <OfflineBanner />
      <PWAPrompt />
      <MemoryDiagnostic />
      <SyncNotification />
      <Toaster position="bottom-right" reverseOrder={false} />
    </Router>
  );
}

export default App;
