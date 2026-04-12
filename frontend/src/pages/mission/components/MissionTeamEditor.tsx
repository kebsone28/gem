import React from 'react';
import { Users, Trash2, Plus, Sparkles } from 'lucide-react';
import type { MissionMember } from '../core/missionTypes';

interface MissionTeamEditorProps {
  members: MissionMember[];
  isReadOnly: boolean;
  onUpdateMember: (index: number, field: keyof MissionMember, value: any) => void;
  onRemoveMember: (index: number) => void;
  onAddMember: () => void;
  onSyncDuration: () => void;
}

export const MissionTeamEditor: React.FC<MissionTeamEditorProps> = ({
  members,
  isReadOnly,
  onUpdateMember,
  onRemoveMember,
  onAddMember,
  onSyncDuration,
}) => {
  const isLocked = isReadOnly || members.some(() => false); // Placeholder but logically true if isReadOnly
  return (
    <section
      className={`glass-card !p-5 !rounded-[2rem] space-y-4 ${isLocked ? 'opacity-90' : ''}`}
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/5">
        <h2 className="font-black text-slate-800 dark:text-white uppercase tracking-wider !text-[10px] flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg">
            <Users size={14} className="text-indigo-500" />
          </div>{' '}
          Ressources Humaines Assignées
        </h2>
        <div className="flex gap-2">
          {!isLocked && (
            <>
              <button
                onClick={onSyncDuration}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200/50 dark:border-white/5"
                title="Synchroniser la durée avec le planning"
              >
                <Sparkles size={10} className="text-indigo-400" /> Auto-Durée
              </button>
              <button
                onClick={onAddMember}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-md shadow-indigo-500/20"
              >
                <Plus size={10} /> Ajouter
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {members.map((m, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-3 items-center p-3.5 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-white/5 transition-all group hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-0.5"
          >
            <div className="col-span-12 md:col-span-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs border border-indigo-200/50 dark:border-indigo-500/20">
                {m.name ? m.name.charAt(0) : '?'}
              </div>
              <input
                type="text"
                value={m.name}
                readOnly={isReadOnly}
                onChange={(e) => onUpdateMember(i, 'name', e.target.value)}
                className="w-full bg-transparent border-none text-xs font-bold text-slate-800 dark:text-white outline-none px-2 placeholder-slate-400"
                placeholder="Nom de l'opératif"
              />
            </div>
            <div className="col-span-12 md:col-span-2">
              <input
                type="text"
                value={m.role}
                readOnly={isReadOnly}
                onChange={(e) => onUpdateMember(i, 'role', e.target.value)}
                className="w-full bg-transparent border-none text-xs italic text-slate-600 dark:text-slate-400 outline-none px-2 placeholder-slate-400/50"
                placeholder="Spécialité/Rôle"
              />
            </div>
            <div className="col-span-6 md:col-span-3">
              <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800 p-2 rounded-xl ring-1 ring-slate-200/50 dark:ring-white/10 shadow-inner">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none bg-slate-100 dark:bg-white/5 py-1 px-1.5 rounded-md">
                  TAUX
                </span>
                <input
                  type="number"
                  min="0"
                  value={m.dailyIndemnity}
                  readOnly={isReadOnly}
                  onChange={(e) =>
                    onUpdateMember(i, 'dailyIndemnity', Math.max(0, Number(e.target.value)))
                  }
                  className="w-full bg-transparent border-none text-[11px] font-black text-emerald-700 dark:text-emerald-400 outline-none text-right focus:ring-0 placeholder-slate-400"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="col-span-6 md:col-span-3">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl ring-1 ring-slate-200 dark:ring-white/10 shadow-inner">
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest leading-none bg-white/20 dark:bg-white/5 py-1 px-1.5 rounded-md">
                  JOURS
                </span>
                <input
                  type="number"
                  min="1"
                  value={m.days}
                  readOnly={isReadOnly}
                  onChange={(e) => onUpdateMember(i, 'days', Math.max(1, Number(e.target.value)))}
                  className="w-full bg-transparent border-none text-[11px] font-black text-indigo-700 dark:text-indigo-400 outline-none text-center focus:ring-0 placeholder-slate-400"
                  placeholder="1"
                />
              </div>
            </div>
            {!isReadOnly && (
              <div className="col-span-2 md:col-span-1 flex justify-end pr-2">
                <button
                  onClick={() => onRemoveMember(i)}
                  className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-colors"
                  aria-label="Retirer le membre"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl text-slate-400">
            <Users size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">Aucun membre assigné</p>
            <p className="text-[10px] mt-1">Cliquez sur ajouter pour composer l'équipe</p>
          </div>
        )}
      </div>
    </section>
  );
};
