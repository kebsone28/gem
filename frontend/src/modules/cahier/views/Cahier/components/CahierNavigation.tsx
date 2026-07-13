import React from 'react';
import type { TaskLibrary } from '@utils/types';
import { Layers, FileText, Briefcase, FileSignature, ChevronRight, Save } from 'lucide-react';

interface CahierNavigationProps {
  taskLibrary: TaskLibrary;
  selectedRoles: string[];
  setSelectedRoles: (roles: string[]) => void;
  selectedContractLot?: string;
  setSelectedContractLot?: (lot: string) => void;
  documentMode: 'cahier' | 'contrat' | 'strategie';
  setDocumentMode: (mode: 'cahier' | 'contrat' | 'strategie') => void;
  isFusedMode?: boolean;
}

export const CahierNavigation: React.FC<CahierNavigationProps> = ({
  taskLibrary,
  selectedRoles = [],
  setSelectedRoles,
  selectedContractLot,
  setSelectedContractLot,
  documentMode,
  setDocumentMode,
  isFusedMode = false,
}) => {
  return (
    <div className="flex flex-col w-full gap-6 bg-slate-900/40 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5 shadow-2xl z-20 relative">
      {/* 📁 Modes de Document */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 ml-2 flex items-center gap-2">
          <Layers size={12} />
          Espace de Travail
        </h3>
        <div className="flex flex-row gap-2 overflow-x-auto custom-scrollbar pb-2">
          {[
            { id: 'cahier', label: 'Référentiel Technique', icon: FileText, color: 'emerald' },
            { id: 'contrat', label: 'Clauses Contractuelles', icon: FileSignature, color: 'amber' },
            { id: 'strategie', label: 'Plan de Stratégie', icon: Briefcase, color: 'fuchsia' },
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = documentMode === mode.id;

            // Map colors dynamically for Tailwind safe-listing
            const bgClass = {
              emerald:
                'bg-emerald-500/10 text-emerald-400 shadow-emerald-500/10 ring-emerald-500/20',
              amber: 'bg-amber-500/10 text-amber-400 shadow-amber-500/10 ring-amber-500/20',
              fuchsia:
                'bg-fuchsia-500/10 text-fuchsia-400 shadow-fuchsia-400/10 ring-fuchsia-500/20',
            }[mode.color];

            const iconClass = {
              emerald: 'text-emerald-400',
              amber: 'text-amber-400',
              fuchsia: 'text-fuchsia-400',
            }[mode.color];

            return (
              <button
                key={mode.id}
                onClick={() => setDocumentMode(mode.id as any)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
                  isSelected
                    ? `${bgClass} shadow-lg ring-1`
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon size={16} className={isSelected ? iconClass : 'text-slate-500'} />
                {mode.label}
                {isSelected && <ChevronRight size={14} className="ml-auto opacity-50" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Sélecteur contextuel selon le mode */}
      {documentMode === 'cahier' && isFusedMode && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-500 w-full">
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 ml-2">
            Mode Fusionné
          </h3>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Layers size={16} />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Électricien + Maçonnerie + Logistique
            </span>
          </div>
        </div>
      )}

      {/* Sélecteur contextuel selon le mode */}
      {documentMode === 'cahier' && !isFusedMode && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-500 w-full">
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 ml-2">
            Corps d'État ({Object.keys(taskLibrary).length})
          </h3>
          <div className="flex flex-wrap gap-2 overflow-x-auto custom-scrollbar pb-2">
            {(() => {
              const ROLE_TO_LOT: Record<string, string> = {
                Préparateur: 'LOT A - Pré-câblage',
                Logistique: 'LOT B - Installation Intérieure',
                Maçonnerie: 'LOT B - Installation Intérieure',
                Électricien: 'LOT B - Installation Intérieure',
                'Réseau Extérieur': 'LOT C - Réseau Extérieur',
                'Audit & Contrôle Qualité (PROQUELEC)': 'Contrôle & Validation',
                'Contrôle & Validation': 'Contrôle & Validation',
              };

              const grouped: Record<string, Array<[string, any]>> = {};
              Object.entries(taskLibrary).forEach(([role, task]) => {
                const lot = ROLE_TO_LOT[role] || 'Autres';
                if (!grouped[lot]) grouped[lot] = [];
                grouped[lot].push([role, task]);
              });

              return Object.entries(grouped).map(([lotName, tasks]) => (
                <div key={lotName} className="flex flex-col gap-2 shrink-0 w-full lg:w-auto">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1 ml-2">
                    {lotName}
                  </h4>
                  <div className="flex flex-row gap-2 flex-wrap lg:flex-nowrap">
                    {tasks.map(([role, task]) => {
                      const Icon = task.icon;
                      const isSelected = selectedRoles.includes(role);

                      const handleClick = () => {
                        if (isSelected) {
                          setSelectedRoles(selectedRoles.filter((r) => r !== role));
                        } else {
                          setSelectedRoles([...selectedRoles, role]);
                        }
                      };

                      return (
                        <button
                          key={role}
                          onClick={handleClick}
                          className={`group relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 text-left w-full lg:w-auto max-w-xs ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-400 shadow-lg ring-1 ring-emerald-500/30'
                              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                          }`}
                        >
                          <div
                            className={`flex items-center justify-center transition-all duration-500 ${
                              isSelected
                                ? 'text-emerald-400'
                                : 'text-slate-500 group-hover:scale-110'
                            }`}
                          >
                            <Icon size={16} />
                          </div>
                          <span className="text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
                            {role}
                          </span>
                          {isSelected && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 rounded-t-full bg-emerald-400 shadow-md shadow-emerald-400/50" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {documentMode === 'contrat' && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-500 w-full">
          <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 ml-2">
            Lots Contractuels (3)
          </h3>
          <div className="flex flex-row gap-2 overflow-x-auto custom-scrollbar pb-2">
            {[
              { id: 'LOT A', label: 'LOT A - Pré-câblage' },
              { id: 'LOT B', label: 'LOT B - Installation Intérieure' },
              { id: 'LOT C', label: 'LOT C - Réseau Extérieur' },
            ].map((lot) => {
              const isSelected = selectedContractLot === lot.id;
              return (
                <button
                  key={lot.id}
                  onClick={() => setSelectedContractLot && setSelectedContractLot(lot.id)}
                  className={`group relative flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 w-full text-left ${
                    isSelected
                      ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/20'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center transition-all duration-500 ${
                      isSelected ? 'text-indigo-400' : 'text-slate-500 group-hover:scale-110'
                    }`}
                  >
                    <FileSignature size={18} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
                    {lot.label}
                  </span>
                  {isSelected && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 rounded-t-full bg-indigo-400 shadow-md shadow-indigo-400/50" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {documentMode === 'strategie' && (
        <div className="flex flex-col items-center justify-center flex-1 opacity-50 select-none animate-in fade-in slide-in-from-left-4 duration-500">
          <Briefcase size={48} className="text-slate-600 mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center px-4">
            Document Stratégique Global
          </p>
        </div>
      )}
    </div>
  );
};
