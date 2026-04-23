 
import React from 'react';
import { Calendar, Plus, Trash2, MapPin } from 'lucide-react';

interface MissionItineraryEditorProps {
  planning: string[];
  isReadOnly: boolean;
  onUpdateStep: (index: number, text: string) => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
}

/**
 * COMPOSANT : Éditeur d'Itinéraire / Planning
 * Permet de définir les étapes quotidiennes de la mission.
 */
export const MissionItineraryEditor: React.FC<MissionItineraryEditorProps> = ({
  planning,
  isReadOnly,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
}) => {
  return (
    <section className="glass-card !p-8 !rounded-[2.5rem] space-y-6 relative overflow-hidden group">
      {/* Glow Effect */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full group-hover:bg-indigo-500/10 transition-colors duration-700" />

      <div className="flex items-center justify-between pb-4 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl shadow-inner border border-indigo-500/20">
            <Calendar className="text-indigo-400" size={20} />
          </div>
          <div>
            <h2 className="!text-[11px] font-black text-white uppercase tracking-[0.2em]">
              Itinéraire Détaillé
            </h2>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">
              Planification des étapes quotidiennes
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <button
            onClick={onAddStep}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/10 transition-all active:scale-95"
          >
            <Plus size={14} /> Ajouter une étape
          </button>
        )}
      </div>

      <div className="space-y-4 relative z-10">
        {planning.map((step, i) => (
          <div key={i} className="flex gap-6 group/item relative pl-10">
            {/* Timeline Line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-slate-800 group-last/item:h-8" />

            {/* Day Bubble */}
            <div className="absolute left-0 top-0 w-10 h-10 rounded-xl bg-slate-900 border-2 border-indigo-500/30 flex flex-col items-center justify-center z-10 shadow-lg group-hover/item:border-indigo-400 transition-colors">
              <span className="text-[8px] font-black text-indigo-400 uppercase leading-none">
                J
              </span>
              <span className="text-[12px] font-black text-white leading-none mt-0.5">{i + 1}</span>
            </div>

            <div className="flex-1 space-y-2">
              <div className="relative group/field">
                <textarea
                  value={step}
                  readOnly={isReadOnly}
                  onChange={(e) => onUpdateStep(i, e.target.value)}
                  placeholder="Décrivez l'objectif de la journée, le trajet et les actions clés..."
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-4 text-[11px] font-medium text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all min-h-[100px] resize-none custom-scrollbar group-hover/item:bg-slate-900/80"
                />

                {!isReadOnly && planning.length > 1 && (
                  <button
                    onClick={() => onRemoveStep(i)}
                    className="absolute top-4 right-4 p-2 text-slate-600 hover:text-rose-500 bg-black/20 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover/field:opacity-100 transition-all"
                    title="Supprimer cette étape"
                  >
                    <Trash2 size={14} />
                  </button>
                )}

                {/* Visual indicators for technicians */}
                <div className="mt-3 flex gap-4 text-[8px] font-black text-slate-500 uppercase tracking-widest pl-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={10} className="text-emerald-500/50" /> Trace GPS Pro
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={10} className="text-indigo-500/50" /> Sync Automatique
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {planning.length === 0 && (
          <div className="text-center py-12 bg-slate-900/30 rounded-3xl border-2 border-dashed border-white/5">
            <Calendar size={32} className="mx-auto mb-4 opacity-20 text-indigo-400" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Aucune étape planifiée
            </p>
            <p className="text-[8px] text-slate-600 mt-1 uppercase">
              Cliquez sur "Ajouter une étape" pour commencer
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
