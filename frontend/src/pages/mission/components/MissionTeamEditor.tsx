/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Users, Trash2, Plus, Sparkles, Lock, DollarSign, CalendarDays } from 'lucide-react';
import type { MissionMember } from '../core/missionTypes';

interface MissionTeamEditorProps {
  members: MissionMember[];
  isReadOnly: boolean;
  onUpdateMember: (index: number, field: keyof MissionMember, value: any) => void;
  onRemoveMember: (index: number) => void;
  onAddMember: () => void;
  onSyncDuration: () => void;
}

/** Colour palette for member avatar initials */
const AVATAR_COLOURS = [
  'from-indigo-600 to-violet-600',
  'from-blue-600 to-cyan-500',
  'from-emerald-600 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-600 to-pink-500',
  'from-purple-600 to-indigo-500',
];

export const MissionTeamEditor: React.FC<MissionTeamEditorProps> = ({
  members,
  isReadOnly,
  onUpdateMember,
  onRemoveMember,
  onAddMember,
  onSyncDuration,
}) => {
  const totalIndemnites = members.reduce((s, m) => s + (m.dailyIndemnity || 0) * (m.days || 1), 0);

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-[#0d1117] border border-white/[0.07] p-5 sm:p-7 space-y-5">
      {/* Ambient glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/[0.06] relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Users size={18} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-[12px] font-black text-white uppercase tracking-[0.15em]">Ressources Humaines</h2>
            <p className="text-[9px] font-semibold text-slate-600 mt-0.5">
              {members.length === 0 ? 'Aucun membre assigné' : `${members.length} membre${members.length > 1 ? 's' : ''} · ${new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(totalIndemnites)} XOF total`}
            </p>
          </div>
        </div>

        {!isReadOnly ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onSyncDuration}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/[0.07] text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              title="Synchroniser la durée avec le planning"
            >
              <Sparkles size={11} className="text-indigo-400" />
              <span className="hidden sm:inline">Auto-Durée</span>
            </button>
            <button
              onClick={onAddMember}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Plus size={11} />
              Ajouter
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <Lock size={9} className="text-slate-700" />
            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Verrouillé</span>
          </div>
        )}
      </div>

      {/* ── Member list ── */}
      <div className="space-y-2 relative z-10">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/[0.06] rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-3">
              <Users size={20} className="text-slate-700" />
            </div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Aucun membre assigné</p>
            {!isReadOnly && (
              <button onClick={onAddMember} className="mt-3 text-[9px] font-black text-indigo-500 hover:text-indigo-400 uppercase tracking-widest transition-colors">
                + Ajouter le premier membre
              </button>
            )}
          </div>
        ) : (
          members.map((m, i) => {
            const initials = (m.name || '?').substring(0, 2).toUpperCase();
            const colour   = AVATAR_COLOURS[i % AVATAR_COLOURS.length];
            const total    = (m.dailyIndemnity || 0) * (m.days || 1);

            return (
              <div
                key={i}
                className="group flex items-center gap-3 p-3 bg-white/[0.025] border border-white/[0.06] rounded-2xl hover:bg-white/[0.04] hover:border-white/10 transition-all"
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colour} flex items-center justify-center shrink-0 shadow-md`}>
                  <span className="text-[11px] font-black text-white">{initials}</span>
                </div>

                {/* Name + Role */}
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                  <input
                    type="text"
                    value={m.name}
                    readOnly={isReadOnly}
                    onChange={(e) => onUpdateMember(i, 'name', e.target.value)}
                    placeholder="Nom complet"
                    className="bg-transparent border-none outline-none text-[11px] font-bold text-white placeholder:text-slate-700 focus:ring-0 w-full"
                  />
                  <input
                    type="text"
                    value={m.role}
                    readOnly={isReadOnly}
                    onChange={(e) => onUpdateMember(i, 'role', e.target.value)}
                    placeholder="Rôle / Spécialité"
                    className="bg-transparent border-none outline-none text-[10px] font-semibold text-slate-500 italic placeholder:text-slate-700 focus:ring-0 w-full"
                  />
                </div>

                {/* Taux + Jours */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                    <DollarSign size={9} className="text-emerald-500 shrink-0" />
                    <input
                      type="number"
                      min="0"
                      value={m.dailyIndemnity}
                      readOnly={isReadOnly}
                      onChange={(e) => onUpdateMember(i, 'dailyIndemnity', Math.max(0, Number(e.target.value)))}
                      className="w-14 bg-transparent border-none outline-none text-[11px] font-black text-emerald-400 text-right focus:ring-0"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                    <CalendarDays size={9} className="text-indigo-400 shrink-0" />
                    <input
                      type="number"
                      min="1"
                      value={m.days}
                      readOnly={isReadOnly}
                      onChange={(e) => onUpdateMember(i, 'days', Math.max(1, Number(e.target.value)))}
                      className="w-8 bg-transparent border-none outline-none text-[11px] font-black text-indigo-400 text-center focus:ring-0"
                      placeholder="1"
                    />
                  </div>
                </div>

                {/* Total indemnité */}
                <div className="hidden sm:block text-right shrink-0 min-w-[72px]">
                  <p className="text-[10px] font-black text-white font-mono">
                    {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(total)}
                  </p>
                  <p className="text-[7px] text-slate-700 font-bold uppercase tracking-widest">XOF</p>
                </div>

                {/* Delete */}
                {!isReadOnly && (
                  <button
                    onClick={() => onRemoveMember(i)}
                    className="p-2 text-slate-700 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    aria-label="Retirer le membre"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer total ── */}
      {members.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.05] relative z-10">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-700">{members.length} membre{members.length > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-600 font-bold">Total indemnités :</span>
            <span className="text-[12px] font-black text-white font-mono">
              {new Intl.NumberFormat('fr-FR').format(totalIndemnites)}
            </span>
            <span className="text-[8px] text-slate-600 font-bold">XOF</span>
          </div>
        </div>
      )}
    </section>
  );
};
