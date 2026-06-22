/**
 * 🎛️ AdminAIConfig - Page d'administration unifiée du système IA Souverain
 * Utilise le composant AIEngineAdminPanel en mode standalone
 */

import AIEngineAdminPanel from '@components/ia/AIEngineAdminPanel';
import { useAuth } from '@contexts/AuthContext';
import { Shield } from 'lucide-react';
import { hasPermission, PERMISSIONS } from '@core/security/permissions';

export default function AdminAIConfig() {
  const { user } = useAuth();

  const isAuthorized = hasPermission(user as any, PERMISSIONS.IA_CONFIG);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 text-center max-w-md">
          <Shield className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Accès restreint</h2>
          <p className="text-slate-400 text-sm mb-6">
            Cette page est réservée aux administrateurs système du bastion PROQUELEC.
          </p>
        </div>
      </div>
    );
  }

  // On passe typedUser pour respecter le contrat d'interface de AIEngineAdminPanel
  if (!user) return null;
  const typedUser = {
    role: user.role || 'USER',
    email: user.email || '',
    displayName: user.name,
  };

  return <AIEngineAdminPanel user={typedUser} standalone={true} />;
}
