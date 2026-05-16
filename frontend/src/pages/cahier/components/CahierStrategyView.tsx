import React from 'react';
import { Target, Map, Flag, Zap, ShieldCheck } from 'lucide-react';
import type { OperationalStrategyTemplate } from '../../../data/operationalStrategyTemplates';
import { isStrategyHeading } from '../utils/cahierUtils';

interface CahierStrategyViewProps {
  operationalStrategy: OperationalStrategyTemplate;
  isEditing: boolean;
  editData: any;
  setEditData: React.Dispatch<React.SetStateAction<any>>;
}

export const CahierStrategyView: React.FC<CahierStrategyViewProps> = ({
  operationalStrategy,
  isEditing,
  editData,
  setEditData,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-950/40 border border-white/5 rounded-[2.5rem] p-6 md:p-12 backdrop-blur-xl shadow-2xl relative">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
          <Target size={250} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-12 pb-8 border-b border-white/10">
            <div className="h-16 w-16 rounded-[1.5rem] bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-xl shadow-amber-900/10">
              <Map size={32} />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.4em] text-amber-500">Plan de Déploiement</p>
              <h2 className="text-3xl font-black text-white">{operationalStrategy.title}</h2>
            </div>
          </div>

          {isEditing ? (
            <textarea
              value={editData.strategyContent}
              onChange={(e) => setEditData((prev: any) => ({ ...prev, strategyContent: e.target.value }))}
              className="w-full h-[500px] bg-slate-950 border border-amber-500/30 rounded-2xl p-6 text-slate-300 text-sm focus:border-amber-500 outline-none resize-none font-mono leading-relaxed"
              placeholder="Décrivez la stratégie opérationnelle..."
            />
          ) : (
            <div className="space-y-6">
              {operationalStrategy.content.map((line, i) => {
                const isHeading = isStrategyHeading(line);
                const isStep = /^Étape\s+\d+/i.test(line);
                const isZone = /^ZONE\s+/i.test(line);

                return (
                  <div
                    key={i}
                    className={`relative ${
                      isHeading 
                        ? 'mt-12 mb-6' 
                        : 'ml-0 md:ml-4'
                    }`}
                  >
                    {isHeading ? (
                      <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border ${
                        isStep 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
                          : isZone 
                            ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' 
                            : 'bg-white/5 border-white/10 text-white'
                      }`}>
                        {isStep ? <Flag size={18} /> : isZone ? <Zap size={18} /> : <div className="h-2 w-2 rounded-full bg-current" />}
                        <span className="text-sm font-black uppercase tracking-widest">{line}</span>
                      </div>
                    ) : (
                      <div className="flex gap-4 p-4 rounded-xl hover:bg-white/[0.02] transition-colors group">
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-700 group-hover:bg-amber-500 transition-colors" />
                        <p className="text-base text-slate-400 leading-relaxed font-medium">
                          {line}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-16 p-8 rounded-3xl bg-emerald-500/[0.03] border border-emerald-500/10 flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={20} />
              </div>
              <p className="text-xs font-bold text-emerald-100/60 uppercase tracking-widest">Validation Stratégique PROQUELEC OK</p>
            </div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
              Document de Travail Confidentiel — Version 1.2
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
