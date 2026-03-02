import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import type { UserRole } from './utils/types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Terrain from './pages/Terrain';
import Cahier from './pages/Cahier';
import Logistique from './pages/Logistique';
import Charges from './pages/Charges';
import Settings from './pages/Settings';
import Simulation from './pages/Simulation';
import Reports from './pages/Reports';
import Aide from './pages/Aide';
import AdminUsers from './pages/AdminUsers';
import Layout from './layouts/Layout';
import SessionWarningToast from './components/SessionWarningToast';

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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <SessionWarningToast />
    </Router>
  );
}

export default App;
