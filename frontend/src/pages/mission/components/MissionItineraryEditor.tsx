/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Calendar, Plus, Trash2, MapPin, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface MissionItineraryEditorProps {
  planning: string[];
  isReadOnly: boolean;
  onUpdateStep: (index: number, text: string) => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
}

/**
 * COMPOSANT : Éditeur d'Itinéraire / Planning RE-DESIGNÉ
 * Grille de cartes pliables optimisée pour l'efficacité visuelle.
 */
export const MissionItineraryEditor: React.FC<MissionItineraryEditorProps> = ({
  planning,
  isReadOnly,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
}) => {
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);

  const toggleExpand = (index: number) => {
    if (expandedIndices.includes(index)) {
      setExpandedIndices(expandedIndices.filter(i => i !== index));
    } else {
      setExpandedIndices([...expandedIndices, index]);
    }
  };

  return (
    <section className="glass-card !p-5 sm:!p-8 !rounded-[2.5rem] space-y-6 relative overflow-hidden group border-indigo-500/10 border-2">
      {/* Glow Effect */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/10 transition-all duration-1000" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl shadow-inner border border-indigo-500/20">
            <Calendar className="text-indigo-400" size={20} />
          </div>
          <div>
            <h2 className="!text-[11px] font-black text-white uppercase tracking-[0.2em] text-clamp-title">
              Déroulement de la Mission
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">
              Planning jour par jour • {planning.length} étapes
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <button
            onClick={onAddStep}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all active:scale-95 whitespace-nowrap"
          >
            <Plus size={14} /> Ajouter une journée
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
        {planning.map((step, i) => {
          const isExpanded = expandedIndices.includes(i);
          const lines = step.split('\n').filter(l => l.trim());
          const firstLine = lines[0] || 'Nouvelle journée de mission';

          return (
            <div 
              key={i} 
              className={`flex flex-col rounded-[1.8rem] transition-all duration-300 border ${
                isExpanded 
                  ? 'bg-slate-900/90 border-indigo-500/40 ring-4 ring-indigo-500/5 md:col-span-2 lg:col-span-2' 
                  : 'bg-slate-900/40 border-white/5 hover:border-white/20 hover:bg-slate-900/60'
              }`}
            >
              {/* Card Header (Pliable) */}
              <div 
                onClick={() => toggleExpand(i)}
                className="p-4 cursor-pointer flex items-start gap-3"
              >
                {/* Badge Jour */}
                <div className={`shrink-0 w-12 h-12 rounded-2xl flex flex-col items-center justify-center shadow-lg transition-colors ${
                  isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 border border-white/5'
                }`}>
                  <span className="text-[8px] font-black uppercase leading-none opacity-60">Jour</span>
                  <span className="text-[16px] font-black leading-none mt-1">{i + 1}</span>
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  <h3 className={`text-[11px] font-black uppercase tracking-wide truncate ${isExpanded ? 'text-indigo-400' : 'text-white'}`}>
                    {isExpanded ? `Détails du Jour ${i + 1}` : firstLine}
                  </h3>
                  {!isExpanded && (
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 italic font-medium">
                      {lines.length > 1 ? lines.slice(1).join(' ') : 'Préciser les activités...'}
                    </p>
                  )}
                  {isExpanded && (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-[8px] font-black text-emerald-400/80 uppercase">
                        <Clock size={10} /> 08:00 - 18:00
                      </div>
                      <div className="flex items-center gap-1 text-[8px] font-black text-indigo-400/80 uppercase">
                        <MapPin size={10} /> Localisation requise
                      </div>
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-slate-500">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Card Content (Déplié) */}
              {isExpanded && (
                <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="relative group/field mt-2">
                    <textarea
                      value={step}
                      readOnly={isReadOnly}
                      onChange={(e) => onUpdateStep(i, e.target.value)}
                      autoFocus
                      placeholder="Décrivez l'objectif de la journée, le trajet et les actions clés..."
                      className="w-full bg-slate-950/80 border border-white/10 rounded-2xl p-4 text-[11px] font-medium text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all min-h-[160px] resize-none custom-scrollbar shadow-inner"
                    />

                    {!isReadOnly && (
                      <div className="absolute top-3 right-3 flex gap-2 opacity-40 hover:opacity-100 transition-opacity">
                        {planning.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemoveStep(i); }}
                            className="p-2 text-slate-400 hover:text-rose-500 bg-black/20 hover:bg-rose-500/10 rounded-lg transition-all"
                            title="Supprimer cette journée"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex justify-between items-center px-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Appuyez sur l'en-tête pour réduire
                    </span>
                    {!isReadOnly && (
                       <button 
                         onClick={() => toggleExpand(i)}
                         className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest"
                       >
                         Valider & Fermer
                       </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {planning.length === 0 && (
          <div className="col-span-full text-center py-12 bg-slate-900/30 rounded-[2rem] border-2 border-dashed border-white/5">
            <Calendar size={32} className="mx-auto mb-4 opacity-20 text-indigo-400" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Aucune étape planifiée
            </p>
            <p className="text-[8px] text-slate-600 mt-1 uppercase">
              Commencez par ajouter le Jour 1 de votre mission
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
