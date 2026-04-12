import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowRight, Save, X } from 'lucide-react';
import type { Household } from '../../utils/types';

interface Conflict {
  local: Household;
  remote: Household;
  fields: string[];
}

interface SyncConflictResolverProps {
  isOpen: boolean;
  conflicts: Conflict[];
  onResolve: (resolved: Household[]) => void;
  onCancel: () => void;
}

export const SyncConflictResolver: React.FC<SyncConflictResolverProps> = ({
  isOpen,
  conflicts,
  onResolve,
  onCancel,
}) => {
  const [decisions, setDecisions] = React.useState<Record<string, 'local' | 'remote'>>({});

  React.useEffect(() => {
    if (isOpen) {
      const initial: Record<string, 'local' | 'remote'> = {};
      conflicts.forEach((c) => (initial[c.local.id] = 'remote')); // Par défaut on prend le nouveau (Kobo)
      setDecisions(initial);
    }
  }, [isOpen, conflicts]);

  const handleSelectAllLocal = () => {
    const newDecisions: Record<string, 'local' | 'remote'> = {};
    conflicts.forEach((c) => (newDecisions[c.local.id] = 'local'));
    setDecisions(newDecisions);
  };

  const handleSelectAllRemote = () => {
    const newDecisions: Record<string, 'local' | 'remote'> = {};
    conflicts.forEach((c) => (newDecisions[c.local.id] = 'remote'));
    setDecisions(newDecisions);
  };

  const handleApply = () => {
    const resolved = conflicts.map((c) => {
      const decision = decisions[c.local.id];
      return decision === 'local' ? c.local : c.remote;
    });
    onResolve(resolved);
  };

  if (!isOpen || conflicts.length === 0) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-5xl max-h-[85vh] bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-3xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white italic uppercase tracking-tight">
                  Conflits de Données Détectés
                </h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                  {conflicts.length} ménage(s) ont des informations différentes dans le nouveau
                  fichier.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 mr-4 border-r border-white/10 pr-4">
                <button
                  onClick={handleSelectAllLocal}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 transition-all border border-blue-500/20"
                >
                  Tout Local
                </button>
                <button
                  onClick={handleSelectAllRemote}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all border border-indigo-500/20"
                >
                  Tout Kobo/Import
                </button>
              </div>
              <button
                onClick={onCancel}
                className="p-3 rounded-2xl hover:bg-white/5 text-slate-500 transition-all"
                title="Fermer"
                aria-label="Fermer"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Conflicts List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conflicts.map((conflict, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr,auto,1fr] gap-6 p-6 rounded-3xl bg-white/5 border border-white/5 items-center"
              >
                {/* Local Column */}
                <button
                  onClick={() => setDecisions({ ...decisions, [conflict.local.id]: 'local' })}
                  className={`text-left p-6 rounded-2xl border-2 transition-all ${decisions[conflict.local.id] === 'local' ? 'border-blue-500 bg-blue-500/10' : 'border-transparent bg-white/5 opacity-50 hover:opacity-80'}`}
                >
                  <div className="text-[10px] font-black text-blue-400 uppercase mb-3 italic">
                    Base de Données Locale
                  </div>
                  <h4 className="text-white font-black uppercase text-sm mb-4 truncate">
                    {conflict.local.owner || 'Sans Nom'}
                  </h4>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-bold">STATUT:</span>
                      <span className="text-white font-black italic">{conflict.local.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-bold">GPS:</span>
                      <span className="text-white font-mono">
                        {conflict.local.location?.coordinates?.[1].toFixed(5)},{' '}
                        {conflict.local.location?.coordinates?.[0].toFixed(5)}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Directional Info */}
                <div className="flex flex-col items-center gap-2">
                  <ArrowRight className="text-slate-700" size={24} />
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">
                    ID: {conflict.local.id}
                  </span>
                </div>

                {/* Remote Column */}
                <button
                  onClick={() => setDecisions({ ...decisions, [conflict.remote.id]: 'remote' })}
                  className={`text-left p-6 rounded-2xl border-2 transition-all ${decisions[conflict.remote.id] === 'remote' ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent bg-white/5 opacity-50 hover:opacity-80'}`}
                >
                  <div className="text-[10px] font-black text-indigo-400 uppercase mb-3 italic">
                    Donnée Kobo / Import
                  </div>
                  <h4 className="text-white font-black uppercase text-sm mb-4 truncate">
                    {conflict.remote.owner || 'Sans Nom'}
                  </h4>

                  <div className="space-y-2">
                    {conflict.fields.map((field) => (
                      <div
                        key={field}
                        className="flex items-center justify-between text-[10px] bg-amber-500/10 p-1 px-2 rounded -mx-1"
                      >
                        <span className="text-amber-500 font-black tracking-tighter">
                          {field.toUpperCase()}:
                        </span>
                        <span className="text-white font-black italic">
                          {field === 'gps'
                            ? `${conflict.remote.location?.coordinates?.[1].toFixed(5)}, ${conflict.remote.location?.coordinates?.[0].toFixed(5)}`
                            : (conflict.remote as any)[field]}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="p-8 border-t border-white/5 bg-black/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <span className="text-blue-500">
                {Object.values(decisions).filter((v) => v === 'local').length} local
              </span>
              <span>•</span>
              <span className="text-indigo-500">
                {Object.values(decisions).filter((v) => v === 'remote').length} importés
              </span>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onCancel}
                className="px-8 py-4 rounded-2xl border border-white/10 text-white font-black uppercase tracking-widest text-[11px] hover:bg-white/5 transition-all"
              >
                Tout Annuler
              </button>
              <button
                onClick={handleApply}
                className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] hover:bg-indigo-500 transition-all flex items-center gap-3 shadow-xl shadow-indigo-600/20"
              >
                <Save size={16} />
                Appliquer les décisions
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
