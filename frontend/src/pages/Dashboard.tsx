import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRole, ROLES } from '../utils/permissions';
import AdminDashboard from './DashboardViews/AdminDashboard';
import ClientDashboard from './DashboardViews/ClientDashboard';
import TeamDashboard from './DashboardViews/TeamDashboard';

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

  if (normalizedRole === ROLES.CLIENT_LSE) return <ClientDashboard />;
  if (normalizedRole === ROLES.CHEF_EQUIPE) return <TeamDashboard />;

  // Default to Admin or DG Dashboard which are similar
  return <AdminDashboard />;
}
