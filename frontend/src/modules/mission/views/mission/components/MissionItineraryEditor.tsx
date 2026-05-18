/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Route, Plus, Trash2, ChevronDown, ChevronUp, Clock, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MissionItineraryEditorProps {
  planning: string[];
  isReadOnly: boolean;
  onUpdateStep: (index: number, text: string) => void;
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
}

const DAY_COLOURS = [
  { ring: 'ring-indigo-500/30', bg: 'bg-indigo-600',  text: 'text-indigo-400',  dot: 'bg-indigo-500' },
  { ring: 'ring-violet-500/30', bg: 'bg-violet-600',  text: 'text-violet-400',  dot: 'bg-violet-500' },
  { ring: 'ring-blue-500/30',   bg: 'bg-blue-600',    text: 'text-blue-400',    dot: 'bg-blue-500'   },
  { ring: 'ring-cyan-500/30',   bg: 'bg-cyan-600',    text: 'text-cyan-400',    dot: 'bg-cyan-500'   },
  { ring: 'ring-teal-500/30',   bg: 'bg-teal-600',    text: 'text-teal-400',    dot: 'bg-teal-500'   },
  { ring: 'ring-emerald-500/30',bg: 'bg-emerald-600', text: 'text-emerald-400', dot: 'bg-emerald-500'},
];

export const MissionItineraryEditor: React.FC<MissionItineraryEditorProps> = ({
  planning,
  isReadOnly,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
}) => {
  const [expanded, setExpanded] = useState<number[]>([]);

  const toggle = (i: number) =>
    setExpanded((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-[#0d1117] border border-white/[0.07] p-5 sm:p-7 space-y-5">
      {/* Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Route size={18} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-[12px] font-black text-white uppercase tracking-[0.15em]">Déroulement de la Mission</h2>
            <p className="text-[9px] font-semibold text-slate-600 mt-0.5">
              Planning jour par jour · <span className="text-indigo-400">{planning.length} étape{planning.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <button
            onClick={onAddStep}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/25 transition-all shrink-0"
          >
            <Plus size={12} />
            Ajouter une journée
          </button>
        )}
      </div>

      {/* ── Steps ── */}
      <div className="space-y-2 relative z-10">
        {planning.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-white/[0.05] rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3">
              <Route size={20} className="text-slate-700" />
            </div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Aucune étape planifiée</p>
            {!isReadOnly && (
              <button onClick={onAddStep} className="mt-3 text-[9px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest transition-colors">
                + Ajouter le Jour 1
              </button>
            )}
          </div>
        ) : (
          planning.map((step, i) => {
            const isOpen   = expanded.includes(i);
            const colour   = DAY_COLOURS[i % DAY_COLOURS.length];
            const lines    = step.split('\n').filter((l) => l.trim());
            const title    = lines[0] || `Journée ${i + 1}`;
            const preview  = lines.slice(1).join(' ') || 'Cliquer pour saisir les détails…';

            return (
              <motion.div
                key={i}
                layout
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? `bg-white/[0.04] border-white/10 ring-1 ${colour.ring}`
                    : 'bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10'
                }`}
              >
                {/* ── Card header ── */}
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-start gap-3 p-3.5 text-left"
                >
                  {/* Day badge */}
                  <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-md ${isOpen ? colour.bg : 'bg-white/[0.05] border border-white/[0.07]'}`}>
                    <span className={`text-[7px] font-black uppercase leading-none ${isOpen ? 'text-white/70' : 'text-slate-600'}`}>J</span>
                    <span className={`text-[15px] font-black leading-none ${isOpen ? 'text-white' : 'text-slate-400'}`}>{i + 1}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-black truncate ${isOpen ? colour.text : 'text-slate-300'}`}>
                      {isOpen ? `Journée ${i + 1} — Détails` : title}
                    </p>
                    {!isOpen && (
                      <p className="text-[9px] text-slate-600 mt-0.5 line-clamp-1 font-medium">{preview}</p>
                    )}
                    {isOpen && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[8px] font-bold text-slate-600">
                          <Clock size={8} /> 08:00 – 18:00
                        </span>
                        <span className="flex items-center gap-1 text-[8px] font-bold text-slate-600">
                          <MapPin size={8} /> Localisation requise
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={`shrink-0 p-1 rounded-lg transition-all ${isOpen ? colour.text : 'text-slate-700'}`}>
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {/* ── Expanded content ── */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5 space-y-3">
                        <div className="relative">
                          <textarea
                            value={step}
                            readOnly={isReadOnly}
                            onChange={(e) => onUpdateStep(i, e.target.value)}
                            autoFocus
                            placeholder="Décrivez l'objectif de la journée, le trajet et les actions clés…"
                            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5 text-[11px] font-medium text-slate-300 outline-none focus:border-indigo-500/40 focus:bg-indigo-500/[0.03] transition-all min-h-[130px] resize-none custom-scrollbar placeholder:text-slate-700"
                          />
                          {!isReadOnly && planning.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onRemoveStep(i); }}
                              className="absolute top-2.5 right-2.5 p-1.5 text-slate-700 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Supprimer cette journée"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[8px] text-slate-700 font-bold">Maj + Entrée pour sauter une ligne</span>
                          <div className="flex items-center gap-2">
                            {!isReadOnly && planning.length > 1 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onRemoveStep(i); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-[8px] font-black text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all uppercase tracking-widest"
                              >
                                <Trash2 size={9} />
                                Supprimer
                              </button>
                            )}
                            <button
                              onClick={() => toggle(i)}
                              className={`px-3 py-1.5 text-[8px] font-black rounded-lg uppercase tracking-widest transition-all ${colour.text} hover:bg-white/5`}
                            >
                              Fermer ↑
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </section>
  );
};
