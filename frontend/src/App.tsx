 
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
import { LazyRouteErrorBoundary } from './components/LazyRouteErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { PERMISSIONS, ROLES, hasPermission, normalizeRole } from './utils/permissions';

function lazyWithRetry<T extends React.ComponentType<Record<string, never>>>(
  importer: () => Promise<{ default: T }>,
  cacheKey: string
) {
  return lazy(async () => {
    try {
      const module = await importer();
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(cacheKey);
      }
      return module;
    } catch (error) {
      if (typeof window !== 'undefined') {
        const hasRetried = window.sessionStorage.getItem(cacheKey) === '1';
        if (!hasRetried) {
          window.sessionStorage.setItem(cacheKey, '1');
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
}

// ── Lazy-loaded heavy pages ────────────────────────────────────────────────
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'), 'lazy:dashboard');
const Terrain = lazyWithRetry(() => import('./pages/Terrain'), 'lazy:terrain');
const Cahier = lazyWithRetry(() => import('./pages/Cahier'), 'lazy:cahier');
const Logistique = lazyWithRetry(() => import('./pages/Logistique'), 'lazy:logistique');
const Charges = lazyWithRetry(() => import('./pages/Charges'), 'lazy:charges');
const Settings = lazyWithRetry(() => import('./pages/Settings'), 'lazy:settings');
const Simulation = lazyWithRetry(() => import('./pages/Simulation'), 'lazy:simulation');
const Reports = lazyWithRetry(() => import('./pages/Reports'), 'lazy:reports');
const Aide = lazyWithRetry(() => import('./pages/Aide'), 'lazy:aide');
const Bordereau = lazyWithRetry(() => import('./pages/Bordereau'), 'lazy:bordereau');
const AdminUsers = lazyWithRetry(() => import('./pages/AdminUsers'), 'lazy:admin-users');
const AdminPermissions = lazyWithRetry(() => import('./pages/AdminPermissions'), 'lazy:admin-permissions');
const DiagnosticSante = lazyWithRetry(() => import('./pages/DiagnosticSante'), 'lazy:diagnostic');
const SecuritySettings = lazyWithRetry(() => import('./pages/SecuritySettings'), 'lazy:security');
const MissionOrder = lazyWithRetry(() => import('./pages/MissionOrder'), 'lazy:mission-order');
const Approbation = lazyWithRetry(() => import('./pages/Approbation'), 'lazy:approbation');
const MissionVerification = lazyWithRetry(
  () => import('./pages/MissionVerification'),
  'lazy:mission-verification'
);
const KoboTerminal = lazyWithRetry(
  () => import('./pages/DashboardViews/KoboTerminal'),
  'lazy:kobo-terminal'
);
const InternalKoboSubmissions = lazyWithRetry(
  () => import('./pages/InternalKoboSubmissions'),
  'lazy:internal-kobo-submissions'
);
const GemCollect = lazyWithRetry(
  () => import('./pages/GemCollect'),
  'lazy:gem-collect'
);
const KoboMappingMaster = lazyWithRetry(
  () => import('./pages/KoboMappingMaster'),
  'lazy:kobo-mapping'
);
const OrganizationSettings = lazyWithRetry(
  () => import('./pages/OrganizationSettings'),
  'lazy:organization'
);
const PVAutomation = lazyWithRetry(() => import('./pages/PVAutomation'), 'lazy:pv-automation');
const Planning = lazyWithRetry(() => import('./pages/Planning'), 'lazy:planning');
const PlanningFormation = lazyWithRetry(
  () => import('./pages/PlanningFormation'),
  'lazy:planning-formation'
);
const Alerts = lazyWithRetry(() => import('./pages/Alerts'), 'lazy:alerts');
const Communication = lazyWithRetry(() => import('./pages/Communication'), 'lazy:communication');

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
  permission: string | string[];
}) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(user, permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const RoleRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const role = normalizeRole(user.role);
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

// ── App ────────────────────────────────────────────────────────────────────
function App() {
  const { user } = useAuth();

  return (
    <Router>
      <ImpersonationBanner />
      {/* Dexie → syncStore bridge (must live inside React tree for useLiveQuery) */}
      <BackgroundServices />

      <LazyRouteErrorBoundary>
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
                  <PermissionRoute permission={[PERMISSIONS.VOIR_RAPPORTS_TERRAIN, PERMISSIONS.VOIR_RAPPORTS_FINANCIERS]}>
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
              element={<Navigate to="/charges" replace />}
            />

            <Route
              path="/charges"
              element={
                <ProtectedRoute>
                  <RoleRoute allowedRoles={[ROLES.ADMIN, ROLES.DG, ROLES.COMPTABLE]}>
                    <Charges />
                  </RoleRoute>
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
              path="/admin/permissions"
              element={
                <ProtectedRoute>
                  <PermissionRoute permission={PERMISSIONS.GERER_UTILISATEURS}>
                    <AdminPermissions />
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
              path="/admin/internal-kobo"
              element={
                <ProtectedRoute>
                  <PermissionRoute permission={PERMISSIONS.ACCES_TERMINAL_KOBO}>
                    <InternalKoboSubmissions />
                  </PermissionRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/gem-collect"
              element={
                <ProtectedRoute>
                  <PermissionRoute permission={PERMISSIONS.VOIR_CARTE}>
                    <GemCollect />
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
              path="/communication"
              element={
                <ProtectedRoute>
                  <Communication />
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
              path="/planning-formation"
              element={
                <ProtectedRoute>
                  <PermissionRoute permission={PERMISSIONS.VOIR_CARTE}>
                    <PlanningFormation />
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
            <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
          </Routes>
        </Suspense>
      </LazyRouteErrorBoundary>

      {/* System-level UI — always mounted, no logic */}
      <SessionWarningToast />
      <OfflineBanner />
      <PWAPrompt />
      <SyncNotification />
      <CommandPalette />
      <Toaster position="bottom-right" reverseOrder={false} />

    </Router>
  );
}

export default App;
