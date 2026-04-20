/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from './DashboardViews/AdminDashboard';
import ClientDashboard from './DashboardViews/ClientDashboard';
import TeamDashboard from './DashboardViews/TeamDashboard';

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
