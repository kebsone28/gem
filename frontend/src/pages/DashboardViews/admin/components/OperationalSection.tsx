import React from 'react';
import { LayoutGrid, Box, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProgressBar } from '../../../../components/dashboards/DashboardComponents';
import { fmtNum } from '../../../../utils/format';
import { useNavigate } from 'react-router-dom';
import type { DashboardMetrics } from '../types';

interface OperationalSectionProps {
  metrics: DashboardMetrics;
  zonesCount: number;
}

export const OperationalSection: React.FC<OperationalSectionProps> = ({ metrics, zonesCount }) => {
  const navigate = useNavigate();
  const pipeline = metrics?.pipeline ?? { murs: 0, reseau: 0, interieur: 0, validated: 0 };
  const performance = metrics?.performance ?? {
    avgPerDay: 0,
    daysWorked: 0,
    avgcâblePerHouse: 0,
    efficiencyRate: 0,
  };
  const logistics = metrics?.logistics ?? { kitPrepared: 0, kitLoaded: 0, gap: 0 };
  const total = metrics?.totalHouseholds || 1;
  const electrifiedHouseholds = metrics?.electrifiedHouseholds || 0;
  const progressPercent = metrics?.progressPercent || 0;
  const avgPerDay = Number(performance.avgPerDay || 0);
  const avgCablePerHouse = Number(performance.avgcâblePerHouse || 0);
  const logisticsGap = Number(logistics.gap || 0);
  const activityBars = avgPerDay > 0 ? [42, 58, 50, 76, 82, 96, 88] : [12, 18, 14, 20, 16, 22, 18];

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      <div className="p-4 sm:p-6 md:p-10 rounded-[1.8rem] sm:rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-12 pb-5 sm:pb-8 border-b border-white/5">
          <div className="space-y-1">
            <h3 className="text-[11px] sm:text-[11px] font-black text-blue-300/65 uppercase tracking-[0.08em] sm:tracking-[0.28em] flex items-center gap-2 sm:gap-3 italic text-white">
              <LayoutGrid size={18} className="text-blue-500" /> FLUX OPÉRATIONNEL DES TRAVAUX
            </h3>
            <p className="text-[10px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] sm:tracking-widest italic">
              {zonesCount > 0
                ? `SYNCHRONISÉ AVEC ${zonesCount} ZONES OPÉRATIONNELLES`
                : 'EN ATTENTE DE CARTOGRAPHIE'}
            </p>
          </div>

          <button
            onClick={() => navigate('/bordereau')}
            className="h-11 sm:h-10 w-full sm:w-auto px-5 sm:px-6 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-blue-400 hover:text-white rounded-xl sm:rounded-full text-[10px] sm:text-[9px] font-black uppercase tracking-[0.08em] sm:tracking-widest transition-all italic active:scale-95"
          >
            ANALYSE DÉTAILLÉE →
          </button>
        </div>

        <div className="space-y-4 sm:space-y-8">
          <ProgressBar
            label="Maçonnerie Structurelle"
            count={`${pipeline.murs || 0} SITES`}
            percentage={Math.round(((pipeline.murs || 0) / total) * 100)}
          />
          <ProgressBar
            label="Réseaux & Infrastructures"
            count={`${pipeline.reseau || 0} SITES`}
            percentage={Math.round(((pipeline.reseau || 0) / total) * 100)}
          />
          <ProgressBar
            label="Installations Intérieures"
            count={`${pipeline.interieur || 0} SITES`}
            percentage={Math.round(((pipeline.interieur || 0) / total) * 100)}
          />
          <ProgressBar
            label="Mise en Service Finale"
            count={`${electrifiedHouseholds} SITES`}
            percentage={progressPercent}
            status="success"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1fr] gap-4 sm:gap-8">
        <div className="relative overflow-hidden p-4 sm:p-6 md:p-10 rounded-[1.8rem] sm:rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-xl">
          <div className="pointer-events-none absolute right-[-12%] top-[-18%] h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] sm:tracking-[0.36em] italic flex items-center gap-2 sm:gap-3 text-white">
                <Box size={18} className="text-blue-500" /> SUIVI LOGISTIQUE
              </h3>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Flux matériel et pression terrain
              </p>
            </div>

            <div className="rounded-2xl border border-blue-500/15 bg-blue-500/10 px-4 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-300/70">
                Kits préparés
              </p>
              <p className="mt-1 text-3xl font-black italic text-white">
                {fmtNum(logistics.kitPrepared || 0)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Câble moyen / ménage
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="text-3xl font-black italic text-white">{avgCablePerHouse}m</span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Ratio
                </span>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-rose-500/12 bg-[linear-gradient(180deg,rgba(244,63,94,0.08),rgba(15,23,42,0.2))] p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-300/80">
                Écart logistique
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="text-3xl font-black italic text-rose-400">
                  {logisticsGap >= 0 ? `-${logisticsGap}` : logisticsGap}
                </span>
                <span className="rounded-full border border-rose-500/15 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300">
                  À surveiller
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.35rem] border border-white/6 bg-slate-950/30 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Lecture rapide
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {logistics.kitPrepared > 0
                    ? 'Le stock projeté suit le rythme actuel de déploiement.'
                    : 'Aucun mouvement logistique significatif enregistré pour le moment.'}
                </p>
              </div>
              <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl border border-white/6 bg-white/[0.04] text-blue-300">
                <Box size={18} />
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden p-4 sm:p-6 md:p-10 rounded-[1.8rem] sm:rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-xl flex flex-col">
          <div className="pointer-events-none absolute left-[-10%] bottom-[-24%] h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[11px] sm:text-[11px] font-black uppercase tracking-[0.08em] sm:tracking-[0.28em] italic flex items-center gap-2 sm:gap-3 text-white">
                <Activity size={18} className="text-blue-500" /> GÉNÉRATION JOURNALIÈRE
              </h3>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Rendement moyen projeté
              </p>
            </div>

            <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">
              7 jours
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-between py-4 sm:py-6">
            <div className="text-center">
              <div className="text-5xl sm:text-7xl font-black text-white italic tracking-tighter drop-shadow-xl">
                {avgPerDay}
              </div>
              <p className="text-[10px] sm:text-[10px] font-black text-blue-300/65 uppercase tracking-[0.08em] sm:tracking-[0.24em] mt-2 italic">
                RENDEMENT MOYEN / JOUR
              </p>
              <p className="mt-3 text-sm text-slate-400">
                {avgPerDay > 0
                  ? 'La cadence journalière reste correctement alimentée.'
                  : "Aucune cadence n'est encore remontée pour alimenter cette vue."}
              </p>
            </div>

            <div className="mt-6 rounded-[1.35rem] border border-white/6 bg-slate-950/30 px-4 py-4 sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Signal opérationnel
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-300/80">
                  {avgPerDay > 0 ? 'Actif' : 'En attente'}
                </span>
              </div>

              <div className="w-full h-24 sm:h-28 flex items-end justify-between gap-2">
                {activityBars.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.45, delay: i * 0.04 }}
                    className={`flex-1 rounded-t-[0.9rem] transition-colors cursor-pointer ${
                      avgPerDay > 0 ? 'bg-blue-500/40 hover:bg-blue-400/60' : 'bg-white/10 hover:bg-white/15'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
