import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRole, ROLES } from '../utils/permissions';
import AdminDashboard from './DashboardViews/AdminDashboard';
import ClientDashboard from './DashboardViews/ClientDashboard';
import TeamDashboard from './DashboardViews/TeamDashboard';
import ProjectManagerDashboard from './DashboardViews/ProjectManagerDashboard';
import AccountingDashboard from './DashboardViews/AccountingDashboard';
import SenelecDashboard from './DashboardViews/SenelecDashboard';
import SubcontractorDashboard from './DashboardViews/SubcontractorDashboard';
import AssetManagementDashboard from './DashboardViews/AssetManagementDashboard';
import ProjectSelector from '../components/ProjectSelector';

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
      {/* Sélecteur de projet en haut */}
      <div className="p-6 pb-0">
        <ProjectSelector />
      </div>
      
      {/* Dashboard selon le rôle normalisé */}
      {(() => {
        switch (normalizedRole) {
          case ROLES.PROQUELEC_ADMIN:
          case ROLES.PROQUELEC_DG:
          case ROLES.PROQUELEC_DIRECTION:
            return <AdminDashboard />;
          
          case ROLES.CLIENT_LSE_SUPERVISEUR:
          case ROLES.CLIENT_LSE_TECHNIQUE:
            return <ClientDashboard />;
          
          case ROLES.PROQUELEC_CHEF_PROJET:
            return <ProjectManagerDashboard />;
          
          case ROLES.PROQUELEC_COMPTABLE:
            return <AccountingDashboard />;
          
          case ROLES.PROQUELEC_PATRIMOINE:
            return <AssetManagementDashboard />;
          
          case ROLES.PROQUELEC_EMPLOYE:
            return <TeamDashboard />;
          
          case ROLES.SENELEC_SUPERVISEUR:
          case ROLES.SENELEC_CONTROLEUR:
            return <SenelecDashboard />;
          
          case ROLES.SOUS_TRAITANT_DIRECTEUR:
          case ROLES.SOUS_TRAITANT_EMPLOYE:
            return <SubcontractorDashboard />;
          
          default:
            return <AdminDashboard />;
        }
      })()}
    </div>
  );
}
