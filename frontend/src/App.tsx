import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './layouts/Layout';
import BackgroundServices from './components/BackgroundServices';
import SessionWarningToast from './components/SessionWarningToast';
import OfflineBanner from './components/OfflineBanner';
import PWAPrompt from './components/PWAPrompt';
import SyncNotification from './components/SyncNotification';
import ImpersonationBanner from './components/ImpersonationBanner';
import { CommandPalette } from './components/common/CommandPalette';
import { Toaster } from 'react-hot-toast';
import { PERMISSIONS, hasPermission } from './utils/permissions';

// ── Lazy-loaded heavy pages ────────────────────────────────────────────────
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
const Approbation = lazy(() => import('./pages/Approbation'));
const MissionVerification = lazy(() => import('./pages/MissionVerification'));
const KoboTerminal = lazy(() => import('./pages/DashboardViews/KoboTerminal'));
const KoboMappingMaster = lazy(() => import('./pages/KoboMappingMaster'));
const OrganizationSettings = lazy(() => import('./pages/OrganizationSettings'));
const PVAutomation = lazy(() => import('./pages/PVAutomation'));
const Planning = lazy(() => import('./pages/Planning'));
const Alerts = lazy(() => import('./pages/Alerts'));

// Dev-only: MemoryDiagnostic loaded conditionally — zero cost in production
const MemoryDiagnostic = import.meta.env.DEV
  ? lazy(() =>
      import('./components/MemoryDiagnostic').then((m) => ({ default: m.MemoryDiagnostic }))
    )
  : null;

// ── Fallback loader ────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0D1E35]">
    <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

// ── Route guards ───────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
};

const PermissionRoute = ({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission: string;
}) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(user, permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

// ── App ────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Router>
      <ImpersonationBanner />
      {/* Dexie → syncStore bridge (must live inside React tree for useLiveQuery) */}
      <BackgroundServices />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/verify/mission/:identifier" element={<MissionVerification />} />

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
                <PermissionRoute permission={PERMISSIONS.VOIR_CARTE}>
                  <Terrain />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/cahier"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.VOIR_RAPPORTS}>
                  <Cahier />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/logistique"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.GERER_LOGISTIQUE}>
                  <Logistique />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/finances"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.VOIR_FINANCES}>
                  <Charges />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.GERER_PARAMETRES}>
                  <Settings />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/simulation"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.VOIR_SIMULATION}>
                  <Simulation />
                </PermissionRoute>
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
                <PermissionRoute permission={PERMISSIONS.GERER_LOGISTIQUE}>
                  <Bordereau />
                </PermissionRoute>
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
                <PermissionRoute permission={PERMISSIONS.GERER_UTILISATEURS}>
                  <AdminUsers />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/security"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.GERER_PARAMETRES}>
                  <SecuritySettings />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/diagnostic"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.VOIR_DIAGNOSTIC}>
                  <DiagnosticSante />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/mission"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.CREER_MISSION}>
                  <MissionOrder />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/approval"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.VALIDER_MISSION}>
                  <Approbation />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/kobo-terminal"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.ACCES_TERMINAL_KOBO}>
                  <KoboTerminal />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/kobo-mapping"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.GERER_PARAMETRES}>
                  <KoboMappingMaster />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/organization"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.GERER_PARAMETRES}>
                  <OrganizationSettings />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/pv-automation"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.GERER_PV}>
                  <PVAutomation />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/planning"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.VOIR_CARTE}>
                  <Planning />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/alerts"
            element={
              <ProtectedRoute>
                <PermissionRoute permission={PERMISSIONS.GERER_PV}>
                  <Alerts />
                </PermissionRoute>
              </ProtectedRoute>
            }
          />

          <Route path="/mission-order" element={<Navigate to="/admin/mission" replace />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>

      {/* System-level UI — always mounted, no logic */}
      <SessionWarningToast />
      <OfflineBanner />
      <PWAPrompt />
      <SyncNotification />
      <CommandPalette />
      <Toaster position="bottom-right" reverseOrder={false} />

      {/* Dev diagnostics — completely absent from production bundle */}
      {MemoryDiagnostic && (
        <Suspense fallback={null}>
          <MemoryDiagnostic />
        </Suspense>
      )}
    </Router>
  );
}

export default App;
