import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRole, ROLES } from '../utils/permissions';
import { usePermissions } from '../hooks/usePermissions';
import AdminDashboard from './DashboardViews/AdminDashboard';
import ClientDashboard from './DashboardViews/ClientDashboard';
import TeamDashboard from './DashboardViews/TeamDashboard';
import ProjectManagerDashboard from './DashboardViews/ProjectManagerDashboard';
import AccountingDashboard from './DashboardViews/AccountingDashboard';
import AssetManagementDashboard from './DashboardViews/AssetManagementDashboard';

export default function Dashboard() {
  const { user } = useAuth();
  const { peut, PERMISSIONS } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      {(() => {
        // Ordre de priorité des vues
        if (peut(PERMISSIONS.DASHBOARD_ADMIN)) return <AdminDashboard />;
        if (peut(PERMISSIONS.DASHBOARD_PROJECT)) return <ProjectManagerDashboard />;
        if (peut(PERMISSIONS.DASHBOARD_ACCOUNTING)) return <AccountingDashboard />;
        if (peut(PERMISSIONS.DASHBOARD_ASSETS)) return <AssetManagementDashboard />;
        if (peut(PERMISSIONS.DASHBOARD_CLIENT)) return <ClientDashboard />;
        if (peut(PERMISSIONS.DASHBOARD_TEAM)) return <TeamDashboard />;
        
        // Fallback sécurisé
        return <TeamDashboard />;
      })()}
    </div>
  );
}
