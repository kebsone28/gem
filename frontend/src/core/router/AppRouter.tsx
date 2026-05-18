import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../layouts/Layout';
import { hasPermission, normalizeRole } from '../../core/security/permissions';
import { getAllModules } from '../../core/kernel/registry';

export const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0D1E35]">
    <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children, noLayout }: { children: React.ReactNode; noLayout?: boolean }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return noLayout ? <>{children}</> : <Layout>{children}</Layout>;
};

const PermissionRoute = ({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission: string | readonly string[];
}) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(user, permission)) {
    return <Navigate to="/home" replace />;
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
    return <Navigate to="/home" replace />;
  }
  return <>{children}</>;
};

export const AppRouter = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* 1. Static Public/Utility Routes */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        
        {/* 2. Dynamic Modules from Registry */}
        {getAllModules().map((module) => {
          let element = <module.component />;

          // Apply Permission Guard
          if (module.requiredPermission) {
            element = (
              <PermissionRoute permission={module.requiredPermission}>
                {element}
              </PermissionRoute>
            );
          }

          // Apply Role Guard
          if (module.allowedRoles) {
            element = (
              <RoleRoute allowedRoles={module.allowedRoles}>
                {element}
              </RoleRoute>
            );
          }

          // Apply Auth & Layout Wrapper
          if (module.key !== 'login' && module.key !== 'mission_verification') {
            element = (
              <ProtectedRoute noLayout={module.noLayout}>
                {element}
              </ProtectedRoute>
            );
          }

          return <Route key={module.key} path={module.route} element={element} />;
        })}

        {/* 3. Legacy Redirects & Fallbacks */}
        <Route path="/finances" element={<Navigate to="/charges" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  );
};
