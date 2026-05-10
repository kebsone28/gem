import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRole, ROLES } from '../utils/permissions';
import AdminDashboard from './DashboardViews/AdminDashboard';
import ClientDashboard from './DashboardViews/ClientDashboard';
import TeamDashboard from './DashboardViews/TeamDashboard';
import ProjectManagerDashboard from './DashboardViews/ProjectManagerDashboard';
import AccountingDashboard from './DashboardViews/AccountingDashboard';
import AssetManagementDashboard from './DashboardViews/AssetManagementDashboard';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  if (!user) return null;

  const normalizedRole = normalizeRole(user.role);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Dashboard selon le rôle normalisé */}
      {(() => {
        switch (normalizedRole) {
          // Admin & Direction (accès complet)
          case ROLES.ADMIN: // ADMIN_PROQUELEC
          case ROLES.DIRECTEUR: // DG_PROQUELEC, PROQUELEC_DG, PROQUELEC_DIRECTION, Sous-traitant directeur
          case ROLES.PLATFORM_ADMIN:
            return <AdminDashboard />;

          // Superviseurs LSE / Clients
          case ROLES.SUPERVISEUR: // CLIENT_LSE_SUPERVISEUR, SENELEC_SUPERVISEUR
          case ROLES.CONTROLEUR: // CLIENT_LSE_TECHNIQUE, SENELEC_CONTROLEUR
            return <ClientDashboard />;

          // Chef de projet
          case ROLES.CHEF_PROJET: // PROQUELEC_CHEF_PROJET
            return <ProjectManagerDashboard />;

          // Comptable
          case ROLES.COMPTABLE: // PROQUELEC_COMPTABLE
            return <AccountingDashboard />;

          // Gestion patrimoine
          case ROLES.PATRIMOINE: // PROQUELEC_PATRIMOINE
            return <AssetManagementDashboard />;

          // Employés terrain / Sous-traitants employés
          case ROLES.EMPLOYE: // PROQUELEC_EMPLOYE, SOUS_TRAITANT_EMPLOYE
          case ROLES.CHEF_EQUIPE:
            return <TeamDashboard />;

          default:
            return <AdminDashboard />;
        }
      })()}
    </div>
  );
}
