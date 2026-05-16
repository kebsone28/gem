import React from 'react';
import type { TaskLibrary } from '@utils/types';

interface CahierNavigationProps {
  taskLibrary: TaskLibrary;
  selectedRole: string;
  setSelectedRole: (role: string) => void;
  documentMode: 'cahier' | 'contrat' | 'strategie';
  setDocumentMode: (mode: 'cahier' | 'contrat' | 'strategie') => void;
}

export const CahierNavigation: React.FC<CahierNavigationProps> = ({
  taskLibrary,
  selectedRole,
  setSelectedRole,
  documentMode,
  setDocumentMode,
}) => {
  return (
    <div className="mb-10 space-y-8">
      {/* Sélecteur de Rôles / Corps d'État */}
      <div className="flex flex-col gap-4">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Corps d'État & Missions</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {Object.entries(taskLibrary).map(([role, task]) => {
            const Icon = task.icon;
            const isSelected = selectedRole === role;
            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border p-4 transition-all duration-300 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 shadow-xl shadow-indigo-500/10'
                    : 'border-white/5 bg-white/5 text-slate-500 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-500 ${
                  isSelected ? 'bg-indigo-500 text-white rotate-0' : 'bg-slate-800 text-slate-500 group-hover:scale-110'
                }`}>
                  <Icon size={20} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest text-center leading-tight transition-colors ${
                  isSelected ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                }`}>
                  {role}
                </span>
                {isSelected && (
                  <div className="absolute -bottom-1 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sélecteur de Mode de Document */}
      <div className="flex flex-col gap-4">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Type de Document</span>
        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/50 rounded-2xl border border-white/5 w-fit">
          {[
            { id: 'cahier', label: 'Référentiel Technique' },
            { id: 'contrat', label: 'Clauses Contractuelles' },
            { id: 'strategie', label: 'Plan de Stratégie' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setDocumentMode(mode.id as any)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                documentMode === mode.id
                  ? 'bg-white text-slate-950 shadow-lg'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
