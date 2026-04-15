import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, LogOut } from 'lucide-react';

const ImpersonationBanner: React.FC = () => {
  const { user, stopImpersonation } = useAuth();

  // On affiche la bannière uniquement si l'utilisateur est simulé
  // On vérifie le flag impersonatedBy reçu du backend dans l'objet user
  if (!user || (!user.impersonatedBy && !(user as any).isSimulation)) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 via-orange-600 to-red-600 text-white shadow-2xl animate-in fade-in slide-in-from-top duration-500">
      <div className="max-w-7xl mx-auto px-4 py-2 md:py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-1.5 rounded-full animate-pulse shrink-0">
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] md:text-sm font-bold tracking-wide uppercase">
              Mode Simulation Actif
            </span>
            <span className="text-[10px] md:text-xs text-white/90">
              Vous agissez en tant que <strong className="text-white underline">{user.name}</strong>{' '}
              ({user.role}).
            </span>
          </div>
        </div>

        <button
          onClick={() => stopImpersonation()}
          className="flex items-center gap-2 bg-white text-red-600 px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-bold text-[10px] md:text-sm hover:bg-red-50 transition-all active:scale-95 shadow-lg group shrink-0"
        >
          <LogOut size={14} className="group-hover:translate-x-1 transition-transform" />
          Quitter la simulation
        </button>
      </div>

      {/* Barre de progression subtile pour rappeler l'expiration courte (visuel) */}
      <div className="h-0.5 bg-white/30 w-full overflow-hidden">
        <div className="h-full bg-white/60 animate-timeout-progress origin-left" />
      </div>

      <style>{`
                @keyframes timeout-progress {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
                .animate-timeout-progress {
                    animation: timeout-progress 1800s linear forwards; /* 30 min approx */
                }
                /* Offset pour le reste de l'app si nécessaire via CSS global */
                body { padding-top: 60px !important; }
            `}</style>
    </div>
  );
};

export default ImpersonationBanner;
