import React from 'react';
import { 
  Target, 
  Package, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw, 
  Scale, 
  Zap, 
  FileText,
  Smartphone,
  CheckCircle2,
  XCircle,
  ArrowRightCircle
} from 'lucide-react';
import type { CahierTask } from '@utils/types';
import { CahierSection } from './CahierSection';

interface CahierTechnicalViewProps {
  currentTask: CahierTask;
  isEditing: boolean;
  editData: any;
  setEditData: React.Dispatch<React.SetStateAction<any>>;
  showAdvancedSections: boolean;
  automatedRate: number | null;
  handleExportWord: () => void;
  selectedRole: string;
}

export const CahierTechnicalView: React.FC<CahierTechnicalViewProps> = ({
  currentTask,
  isEditing,
  editData,
  setEditData,
  showAdvancedSections,
  automatedRate,
  handleExportWord,
  selectedRole,
}) => {
  const synopticSchema = currentTask.technicalImages?.[0];
  const synopticLeftNotes = synopticSchema?.notes?.slice(0, 2) || [];
  const synopticRightNotes = synopticSchema?.notes?.slice(2) || [];

  return (
    <div className="flex gap-8 relative animate-in fade-in slide-in-from-bottom-4 duration-700 p-8 w-full">
      
      {/* 📖 Main Document Content */}
      <div className="flex-1 space-y-16 w-full min-w-0">
        <div className="space-y-16">
          <CahierSection title="Missions & Exigences Techniques" color="#3b82f6" id="section-missions">
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 md:p-8 backdrop-blur-xl">
              {isEditing ? (
                <div className="flex flex-col rounded-2xl border border-indigo-500/30 bg-slate-950/80 overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all shadow-inner">
                  <div className="flex items-center gap-1 border-b border-indigo-500/20 bg-indigo-500/10 px-3 py-2">
                    {['B', 'I', 'U'].map((style) => (
                      <button key={style} className="h-6 w-6 rounded-md hover:bg-white/10 text-[11px] font-bold text-slate-300">{style}</button>
                    ))}
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <span className="text-[10px] font-mono text-indigo-400/70 ml-2">markdown supported</span>
                  </div>
                  <textarea
                    title="Modifier les missions"
                    value={editData.missions}
                    onChange={(e) => setEditData((prev: any) => ({ ...prev, missions: e.target.value }))}
                    className="w-full h-64 bg-transparent p-5 text-slate-200 text-sm outline-none resize-y font-mono leading-relaxed custom-scrollbar placeholder:text-slate-600"
                    placeholder="- Mission 1..."
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-4 relative w-full">
                  {/* Decorative Line in Read Mode */}
                  <div className="absolute left-[2.25rem] top-4 bottom-4 w-px bg-indigo-500/10 hidden sm:block" />
                  {currentTask.missions.map((m: string, i: number) => (
                    <div
                      key={i}
                      className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 hover:-translate-y-1 w-full ${
                        m.startsWith('ART 1.5') || m.includes('Reporting')
                          ? 'border-indigo-500/30 bg-indigo-500/10 shadow-[0_8px_30px_rgb(99,102,241,0.15)] hover:shadow-[0_8px_30px_rgb(99,102,241,0.25)] hover:bg-indigo-500/20'
                          : 'border-white/5 bg-slate-900/40 hover:border-indigo-500/30 hover:bg-slate-800/60 hover:shadow-xl'
                      }`}
                    >
                      {/* Subtle hover gradient */}
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                      
                      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4 sm:gap-6 w-full">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 shadow-inner ${
                            m.startsWith('ART 1.5') || m.includes('Reporting')
                              ? 'bg-indigo-500 text-white shadow-indigo-500/25'
                              : 'bg-slate-950 text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 border border-white/5 group-hover:border-indigo-500/30'
                          }`}
                        >
                          <Target size={20} className={m.startsWith('ART 1.5') || m.includes('Reporting') ? 'animate-pulse' : ''} />
                        </div>
                        <div className="min-w-0 flex-1 w-full pt-1">
                          {(() => {
                            const [art, ...rest] = m.split(' : ');
                            const detail = rest.join(' : ');
                            return detail ? (
                              <div className="flex flex-col gap-1 w-full">
                                <p className="text-sm sm:text-base leading-relaxed text-slate-300">
                                  <span className="text-[11px] font-black uppercase tracking-[0.1em] text-indigo-400 mr-2">
                                    {art} :
                                  </span>
                                  {detail}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm sm:text-base leading-relaxed text-slate-300 pt-2">{m}</p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CahierSection>

          <CahierSection title="Cadre Hygiène & Sécurité (HSE)" color="#f43f5e" id="section-hse">
            <div className="rounded-3xl border border-rose-500/10 bg-rose-500/[0.02] p-5 md:p-8 backdrop-blur-xl">
              {isEditing ? (
                <div className="flex flex-col rounded-2xl border border-rose-500/30 bg-slate-950/80 overflow-hidden focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500/50 transition-all shadow-inner">
                  <div className="flex items-center gap-1 border-b border-rose-500/20 bg-rose-500/10 px-3 py-2">
                    <span className="text-[10px] font-mono text-rose-400/70 ml-2">markdown supported</span>
                  </div>
                  <textarea
                    title="Modifier les règles HSE"
                    value={editData.hse}
                    onChange={(e) => setEditData((prev: any) => ({ ...prev, hse: e.target.value }))}
                    className="w-full h-40 bg-transparent p-5 text-rose-200 text-sm outline-none resize-y font-mono leading-relaxed custom-scrollbar placeholder:text-rose-900"
                    placeholder="- Casque obligatoire..."
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-4 w-full">
                  {currentTask.hse.map((h: string, i: number) => (
                    <div
                      key={i}
                      className="group relative overflow-hidden rounded-2xl border border-rose-500/10 bg-rose-500/[0.02] p-5 sm:p-6 transition-all duration-500 hover:-translate-y-1 hover:border-rose-500/30 hover:bg-rose-500/[0.05] hover:shadow-[0_8px_30px_rgb(244,63,94,0.1)] w-full"
                    >
                      {/* Subtle hover gradient */}
                      <div className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                      <div className="relative flex flex-col sm:flex-row items-start gap-4 sm:gap-6 w-full">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 transition-transform duration-500 group-hover:scale-110 shadow-inner">
                          <AlertTriangle size={20} />
                        </div>
                        <div className="min-w-0 flex-1 w-full pt-1">
                          {(() => {
                            const [title, ...rest] = h.split(' : ');
                            const detail = rest.join(' : ');
                            return detail ? (
                              <div className="flex flex-col gap-1 w-full">
                                <p className="text-sm sm:text-base leading-relaxed text-slate-300">
                                  <span className="text-[11px] font-black uppercase tracking-[0.1em] text-rose-400 mr-2">
                                    {title} :
                                  </span>
                                  {detail}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm sm:text-base leading-relaxed text-slate-300 pt-2">{h}</p>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CahierSection>
        </div>

        <div className="space-y-16">
          <CahierSection title="Matériaux & Intrants" color="#f59e0b" id="section-materiaux">
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 md:p-8 backdrop-blur-xl">
              {isEditing ? (
                <div className="flex flex-col rounded-2xl border border-amber-500/30 bg-slate-950/80 overflow-hidden focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500/50 transition-all shadow-inner">
                  <div className="flex items-center gap-1 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    <span className="text-[10px] font-mono text-amber-400/70 ml-2">markdown supported</span>
                  </div>
                  <textarea
                    title="Modifier les matériaux"
                    value={editData.materials}
                    onChange={(e) => setEditData((prev: any) => ({ ...prev, materials: e.target.value }))}
                    className="w-full h-40 bg-transparent p-5 text-amber-200 text-sm outline-none resize-y font-mono leading-relaxed custom-scrollbar placeholder:text-amber-900"
                    placeholder="- Ciment..."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {currentTask.materials.map((m: string, i: number) => (
                    <div
                      key={i}
                      className={`group relative overflow-hidden rounded-xl border p-4 sm:p-5 transition-all duration-500 hover:-translate-y-1 w-full ${
                        m.startsWith('- Matériel fourni') || m.includes('Client')
                          ? 'border-amber-500/30 bg-amber-500/10 shadow-[0_8px_20px_rgb(245,158,11,0.1)]'
                          : 'border-white/5 bg-slate-900/40 hover:border-amber-500/30 hover:bg-slate-800/60 hover:shadow-lg'
                      }`}
                    >
                      <div className="relative flex items-center gap-4 w-full">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110 shadow-inner ${
                          m.startsWith('- Matériel fourni') ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-slate-950 text-amber-500/70 border border-white/5'
                        }`}>
                          <Package size={18} />
                        </div>
                        <span className={`text-sm font-medium flex-1 min-w-0 leading-relaxed ${
                          m.startsWith('- Matériel fourni') ? 'text-amber-100' : 'text-slate-300'
                        }`}>
                          {m.replace('- ', '')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CahierSection>

          {showAdvancedSections && (
            <>
              <CahierSection title="Pénalités & Barèmes" color="#10b981" id="section-finances">
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6 space-y-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-emerald-400 uppercase font-black mb-1.5">Tarif (FCFA)</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={editData.pricing.dailyRate}
                              onChange={(e) => setEditData((prev: any) => ({
                                ...prev,
                                pricing: { ...prev.pricing, dailyRate: e.target.valueAsNumber || 0 }
                              }))}
                              className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-emerald-300 text-sm focus:border-emerald-500 outline-none"
                            />
                            {automatedRate && editData.pricing.dailyRate !== automatedRate && (
                              <button
                                onClick={() => setEditData((prev: any) => ({
                                  ...prev,
                                  pricing: { ...prev.pricing, dailyRate: automatedRate }
                                }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-400 p-1"
                              >
                                <RefreshCw size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] text-emerald-400 uppercase font-black mb-1.5">Effectif</label>
                          <input
                            type="number"
                            value={editData.pricing.personnelCount}
                            onChange={(e) => setEditData((prev: any) => ({
                              ...prev,
                              pricing: { ...prev.pricing, personnelCount: e.target.valueAsNumber || 0 }
                            }))}
                            className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-emerald-300 text-sm focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                      <textarea
                        value={editData.pricing.penalties}
                        onChange={(e) => setEditData((prev: any) => ({
                          ...prev,
                          pricing: { ...prev.pricing, penalties: e.target.value }
                        }))}
                        className="w-full h-24 bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-emerald-300 text-xs focus:border-emerald-500 outline-none resize-none font-mono"
                        placeholder="Clauses pénales..."
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-2xl bg-slate-950/50 p-4 border border-white/5">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coût Unitaire</span>
                        <span className="text-lg font-black text-emerald-400">
                          {currentTask.pricing?.dailyRate?.toLocaleString()} <span className="text-[10px] text-emerald-600">FCFA</span>
                        </span>
                      </div>
                      <div className="text-[11px] leading-relaxed text-emerald-500/70 italic border-l-2 border-emerald-500/20 pl-3">
                        {currentTask.pricing?.penalties}
                      </div>
                      <div className="pt-2">
                        <div className="flex items-center justify-between bg-emerald-500/10 px-4 py-3 rounded-xl border border-emerald-500/20">
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Total Lot</span>
                          <span className="text-xl font-black text-emerald-400">
                            {(
                              (currentTask.pricing?.dailyRate || 0) *
                              (currentTask.pricing?.personnelCount || 0) *
                              (currentTask.pricing?.durationDays || 0)
                            ).toLocaleString()} <span className="text-xs uppercase">FCFA</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CahierSection>

              <CahierSection title="Juridique & Conformité" color="#a855f7" id="section-juridique">
                <div className="rounded-3xl border border-purple-500/10 bg-purple-500/[0.02] p-6 space-y-3">
                  {currentTask.legal?.map((item: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 group">
                      <Scale size={14} className="text-purple-500 mt-1 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-[11px] italic leading-relaxed text-slate-400">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </CahierSection>
            </>
          )}
        </div>

        {/* SECTION INNOVATION - KOBO GUIDE & SCHÉMA */}
        <div className="pt-10 border-t border-white/5 space-y-16">
          <CahierSection title="Guide de Saisie Kobo & Contrôles GED OS" color="#22d3ee" id="section-kobo">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
            {currentTask.koboGuide?.map((block, i) => (
              <div key={i} className="flex flex-col rounded-3xl border border-cyan-500/10 bg-cyan-500/[0.02] p-6 transition-all hover:border-cyan-500/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                    <Smartphone size={20} />
                  </div>
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-cyan-200 leading-tight">
                    {block.title}
                  </h5>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-2">Points de Contrôle</span>
                    <ul className="space-y-2">
                      {block.checks.map((c, ci) => (
                        <li key={ci} className="flex gap-2 text-[11px] text-slate-300 leading-relaxed">
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {block.blockers && block.blockers.length > 0 && (
                    <div>
                      <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block mb-2">Points Bloquants</span>
                      <ul className="space-y-2">
                        {block.blockers.map((b, bi) => (
                          <li key={bi} className="flex gap-2 text-[11px] text-rose-300/80 leading-relaxed">
                            <XCircle size={12} className="text-rose-500 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CahierSection>

        {synopticSchema && (
          <section className="rounded-[2.5rem] border border-cyan-500/20 bg-slate-950/60 p-6 md:p-10 shadow-2xl">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Architecture de Branchement</p>
                <h4 className="mt-2 text-2xl font-black text-white md:text-3xl">Synoptique Séquentiel</h4>
              </div>
              <div className="flex items-center gap-4 bg-slate-900/50 px-5 py-2.5 rounded-2xl border border-white/5">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alimentation</span>
                  <span className="text-xs font-bold text-cyan-400">230 V ~ 50 Hz</span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <Zap size={20} className="text-cyan-400" />
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/5 bg-white p-4 shadow-2xl shadow-cyan-900/20 transition-transform hover:scale-[1.01] duration-500">
              <img
                src={synopticSchema.url}
                alt={synopticSchema.label}
                className="h-auto w-full rounded-2xl object-contain"
              />
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="space-y-4">
                {synopticLeftNotes.map((block) => (
                  <div key={block.title} className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 transition-all hover:bg-slate-900/60">
                    <h5 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">{block.title}</h5>
                    <ul className="space-y-2.5">
                      {block.lines.map((line) => (
                        <li key={line} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                          <ArrowRightCircle size={14} className="text-cyan-500 shrink-0 mt-1" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {synopticRightNotes.map((block) => (
                  <div key={block.title} className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 transition-all hover:bg-slate-900/60">
                    <h5 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">{block.title}</h5>
                    <ul className="space-y-2.5">
                      {block.lines.map((line) => (
                        <li key={line} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                          <ArrowRightCircle size={14} className="text-cyan-500 shrink-0 mt-1" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {synopticSchema.legend && (
              <div className="mt-8 rounded-2xl bg-slate-950/80 p-5 border border-white/5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-4">Légende Normalisée</span>
                <div className="flex flex-wrap gap-2">
                  {synopticSchema.legend.map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold text-slate-200">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {showAdvancedSections && (
          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck size={200} className="text-indigo-500" />
            </div>
            <div className="relative z-10 max-w-4xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-900/40">
                  <ShieldCheck size={28} />
                </div>
                <h4 className="text-2xl font-black text-white uppercase tracking-widest">Performance & Garantie</h4>
              </div>
              <p className="text-lg text-indigo-100/70 leading-relaxed italic mb-10">
                "Le modèle PROQUELEC repose sur la <span className="text-white font-bold underline decoration-indigo-500 underline-offset-4">Réception Finale Digitale</span>. Chaque donnée saisie via Kobo constitue l'unique preuve contractuelle de la conformité des prestations, libérant les paiements après validation par le Chef de Projet."
              </p>
              <button
                onClick={handleExportWord}
                className="w-full sm:w-auto bg-white text-indigo-600 font-black px-10 py-5 rounded-2xl flex items-center justify-center gap-4 transition-all hover:bg-indigo-50 hover:scale-[1.02] active:scale-95 shadow-2xl shadow-indigo-500/20 uppercase tracking-widest text-sm"
              >
                <FileText size={20} />
                Générer le bordereau contractuel complet (.docx)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Signature Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
        <div className="border-2 border-dashed border-white/10 p-10 rounded-[2rem] flex flex-col items-center justify-center gap-4">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Visa Direction PROQUELEC</span>
          <div className="h-px w-20 bg-white/10" />
        </div>
        <div className="border-2 border-dashed border-white/10 p-10 rounded-[2rem] flex flex-col items-center justify-center gap-4">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Visa Prestataire ({selectedRole})</span>
          <div className="h-px w-20 bg-white/10" />
        </div>
      </div>
      </div>

    </div>
  );
};
