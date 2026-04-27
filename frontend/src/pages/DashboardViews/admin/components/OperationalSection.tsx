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
  const daysWorked = Number(performance.daysWorked || 0);
  const avgCablePerHouse = Number(performance.avgcâblePerHouse || 0);
  const kitsLoaded = Number(logistics.kitLoaded || 0);
  const logisticsGap = Number(logistics.gap || 0);
  const activityBars = avgPerDay > 0 ? [42, 58, 50, 76, 82, 96, 88] : [12, 18, 14, 20, 16, 22, 18];
  const miniStats = [
    {
      label: 'Zones',
      value: fmtNum(zonesCount),
      tone: 'text-blue-300',
    },
    {
      label: 'Cadence jour',
      value: fmtNum(avgPerDay),
      tone: 'text-emerald-300',
    },
    {
      label: 'Kits chargés',
      value: fmtNum(kitsLoaded),
      tone: 'text-amber-300',
    },
  ];
  const operationalSteps = [
    {
      label: 'Maçonnerie Structurelle',
      count: `${pipeline.murs || 0} SITES`,
      percentage: Math.round(((pipeline.murs || 0) / total) * 100),
      status: undefined as 'success' | undefined,
    },
    {
      label: 'Réseaux & Infrastructures',
      count: `${pipeline.reseau || 0} SITES`,
      percentage: Math.round(((pipeline.reseau || 0) / total) * 100),
      status: undefined as 'success' | undefined,
    },
    {
      label: 'Installations Intérieures',
      count: `${pipeline.interieur || 0} SITES`,
      percentage: Math.round(((pipeline.interieur || 0) / total) * 100),
      status: undefined as 'success' | undefined,
    },
    {
      label: 'Mise en Service Finale',
      count: `${electrifiedHouseholds} SITES`,
      percentage: progressPercent,
      status: 'success' as const,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10">
      <div className="rounded-[1.8rem] sm:rounded-3xl md:rounded-[3rem] border border-white/5 bg-slate-900/40 p-4 shadow-2xl backdrop-blur-3xl sm:p-6 md:p-8 xl:p-10">
        <div className="mb-6 grid grid-cols-1 gap-5 border-b border-white/5 pb-5 sm:mb-8 sm:gap-6 sm:pb-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <h3 className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white sm:gap-3 sm:tracking-[0.24em]">
              <LayoutGrid size={18} className="text-blue-500" /> FLUX OPÉRATIONNEL DES TRAVAUX
              </h3>
              <p className="max-w-3xl text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 sm:tracking-[0.22em]">
              {zonesCount > 0
                ? `SYNCHRONISÉ AVEC ${zonesCount} ZONES OPÉRATIONNELLES`
                : 'EN ATTENTE DE CARTOGRAPHIE'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {miniStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-4"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {stat.label}
                  </p>
                  <p className={`mt-2 text-xl font-black tracking-tight sm:text-2xl ${stat.tone}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/bordereau')}
            className="h-11 w-full rounded-2xl border border-blue-500/20 bg-blue-600/10 px-5 text-[10px] font-black uppercase tracking-[0.12em] text-blue-400 transition-all hover:bg-blue-600 hover:text-white active:scale-95 sm:h-10 sm:w-auto sm:min-w-[220px] sm:rounded-full sm:px-6 sm:text-[9px] sm:tracking-[0.2em]"
          >
            ANALYSE DÉTAILLÉE →
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {operationalSteps.map((step) => (
            <div
              key={step.label}
              className="rounded-[1.35rem] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-5"
            >
              <ProgressBar
                label={step.label}
                count={step.count}
                percentage={step.percentage}
                status={step.status}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="relative overflow-hidden rounded-[1.8rem] border border-white/5 bg-slate-900/40 p-4 shadow-xl backdrop-blur-3xl sm:rounded-3xl sm:p-6 md:p-8">
          <div className="pointer-events-none absolute right-[-12%] top-[-18%] h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="mb-5 grid grid-cols-1 gap-4 sm:mb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-white sm:gap-3 sm:text-[11px] sm:tracking-[0.28em]">
                <Box size={18} className="text-blue-500" /> SUIVI LOGISTIQUE
              </h3>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Flux matériel et pression terrain
              </p>
            </div>

            <div className="rounded-2xl border border-blue-500/15 bg-blue-500/10 px-4 py-3 text-left sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-300/70">
                Kits préparés
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {fmtNum(logistics.kitPrepared || 0)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[1.35rem] border border-white/6 bg-white/[0.03] p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                Câble moyen / ménage
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="text-2xl font-black tracking-tight text-white sm:text-3xl">{avgCablePerHouse}m</span>
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
                <span className="text-2xl font-black tracking-tight text-rose-400 sm:text-3xl">
                  {logisticsGap >= 0 ? `-${logisticsGap}` : logisticsGap}
                </span>
                <span className="rounded-full border border-rose-500/15 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300">
                  À surveiller
                </span>
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-emerald-500/12 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(15,23,42,0.2))] p-4 sm:p-5 md:col-span-2 xl:col-span-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300/80">
                Kits chargés
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {fmtNum(kitsLoaded)}
                </span>
                <span className="rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                  Flux actif
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.35rem] border border-white/6 bg-slate-950/30 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Lecture rapide
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
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

        <div className="relative flex flex-col overflow-hidden rounded-[1.8rem] border border-white/5 bg-slate-900/40 p-4 shadow-xl backdrop-blur-3xl sm:rounded-3xl sm:p-6 md:p-8">
          <div className="pointer-events-none absolute left-[-10%] bottom-[-24%] h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-white sm:gap-3 sm:tracking-[0.24em]">
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

          <div className="flex flex-1 flex-col justify-between py-4 sm:py-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div className="text-center lg:text-left">
                <div className="text-5xl font-black tracking-tighter text-white drop-shadow-xl sm:text-6xl">
                  {avgPerDay}
                </div>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-blue-300/65 sm:tracking-[0.22em]">
                  Rendement moyen / jour
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {avgPerDay > 0
                    ? 'La cadence journalière reste correctement alimentée.'
                    : "Aucune cadence n'est encore remontée pour alimenter cette vue."}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3 text-left">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                      Jours actifs
                    </p>
                    <p className="mt-2 text-xl font-black tracking-tight text-white">
                      {fmtNum(daysWorked)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3 text-left">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                      Statut
                    </p>
                    <p className="mt-2 text-base font-black tracking-tight text-blue-300">
                      {avgPerDay > 0 ? 'Actif' : 'En attente'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-white/6 bg-slate-950/30 px-4 py-4 sm:px-5">
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
    </div>
  );
};
