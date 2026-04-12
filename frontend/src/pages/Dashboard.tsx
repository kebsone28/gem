import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from './Dashboard/AdminDashboard';
import ClientDashboard from './Dashboard/ClientDashboard';
import TeamDashboard from './Dashboard/TeamDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'CLIENT_LSE') {
    return <ClientDashboard />;
  }

  if (user?.role === 'CHEF_EQUIPE') {
    return <TeamDashboard />;
  }

  // Default to Admin or DG Dashboard which are similar
  return <AdminDashboard />;
}
