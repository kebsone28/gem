/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const */
import { useMemo } from 'react';
import { fmtNum } from '../../utils/format';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../store/db';
import { motion } from 'framer-motion';
import {
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, PageHeader, ContentArea } from '../../components';
import {
  DASHBOARD_ACTION_TILE_PRIMARY,
  DASHBOARD_ACTION_TILE_SECONDARY,
  DASHBOARD_MINI_STAT_CARD,
  DASHBOARD_PRIMARY_BUTTON,
  DASHBOARD_STICKY_PANEL,
  StatusBadge,
  KPICard,
  ProgressBar,
} from '../../components/dashboards/DashboardComponents';

const TRADES = [
  {
    teamId: 'team_macons',
    label: 'Maçons',
    icon: '🧱',
    color: 'indigo',
    doneStatuses: ['Murs', 'Réseau', 'Intérieur', 'Terminé'],
    description: 'Travaux de maçonnerie (fondations, murs)',
  },
  {
    teamId: 'team_reseau',
    label: 'Réseau',
    icon: '🔌',
    color: 'blue',
    doneStatuses: ['Réseau', 'Intérieur', 'Terminé'],
    description: 'Câblage réseau + potelets',
  },
  {
    teamId: 'team_interieur',
    label: 'Électricien',
    icon: '💡',
    color: 'emerald',
    doneStatuses: ['Intérieur', 'Terminé'],
    description: 'Installation intérieure et compteur',
  },
  {
    teamId: 'team_livraison',
    label: 'Livreur / Contrôle',
    icon: '✅',
    color: 'amber',
    doneStatuses: ['Terminé'],
    description: 'Livraison kits + validation SENELEC',
  },
];

const TEXT_MAP: Record<string, string> = {
  indigo: 'text-indigo-400',
  blue: 'text-blue-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
};

export default function TeamDashboard() {
  const { user } = useAuth();
  const households = useLiveQuery(() => db.households.toArray()) || [];
  const zones = useLiveQuery(() => db.zones.toArray()) || [];
  const navigate = useNavigate();
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const total = households.length;

  const pipeline = useMemo(() => {
    return TRADES.map((trade) => {
      let done: number;
      if (total === 0) {
        const demoMap: Record<string, number> = {
          team_macons: 82,
          team_reseau: 64,
          team_interieur: 47,
          team_livraison: 31,
        };
        return {
          ...trade,
          progress: demoMap[trade.teamId] ?? 0,
          done: 0,
          total: 0,
          activeZones: 0,
        };
      }
      done = households.filter((h) => trade.doneStatuses.includes(h.status)).length;
      const progress = Math.round((done / total) * 100);

      const zoneIds = new Set(
        households.filter((h) => trade.doneStatuses.includes(h.status)).map((h) => h.zoneId)
      );
      const activeZones = zoneIds.size;

      return { ...trade, progress, done, total, activeZones };
    });
  }, [households, total]);

  const myTrade = user?.teamId ? pipeline.find((t) => t.teamId === user.teamId) : null;
  const myIndex = myTrade ? pipeline.findIndex((t) => t.teamId === user?.teamId) : -1;
  const predecessorTrade = myIndex > 0 ? pipeline[myIndex - 1] : null;
  const isBlocked = predecessorTrade ? predecessorTrade.progress < 80 : false;

  const completedCount = myTrade?.done ?? 0;
  const pendingCount = (myTrade?.total ?? 0) - completedCount;

  const regionBreakdown = useMemo(() => {
    if (!myTrade || total === 0) return [];
    const regionMap: Record<string, { done: number; all: number }> = {};
    households.forEach((h) => {
      const zone = zones.find((z) => z.id === h.zoneId);
      const region = zone?.region ?? zone?.name ?? 'Inconnue';
      if (!regionMap[region]) regionMap[region] = { done: 0, all: 0 };
      regionMap[region].all++;
      if (myTrade.doneStatuses.includes(h.status)) regionMap[region].done++;
    });
    return Object.entries(regionMap)
      .map(([region, { done, all }]) => ({
        region,
        done,
        all,
        pct: Math.round((done / all) * 100),
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4);
  }, [myTrade, households, zones]);

  return (
    <PageContainer className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/10 via-blue-600/5 to-transparent pointer-events-none" />

      <PageHeader
        title="DASHBOARD ÉQUIPE"
        subtitle="Pilotage opérationnel et performance des brigades terrain"
        icon={
          <ShieldCheck
            size={28}
            className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]"
          />
        }
        className="relative z-10 pt-6 pb-4"
      />

      <ContentArea padding="none" className="bg-transparent border-none shadow-none relative z-10">
        <div className="px-3 sm:px-6 lg:px-12 pb-16 sm:pb-24 space-y-6 sm:space-y-8 lg:space-y-12">
          <header className={DASHBOARD_STICKY_PANEL}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={isBlocked ? 'warning' : 'info'} label={isBlocked ? 'Brigade en attente' : 'Brigade active'} />
                    <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-300/55">
                      {myTrade ? `${myTrade.label.toUpperCase()} specialist` : 'team leader'}
                    </span>
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">
                    Vue equipe terrain
                  </h2>
                  <p className="text-[13px] text-slate-400">
                    Priorites, pipeline et execution de la brigade en cours.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/terrain')}
                  className={`${DASHBOARD_PRIMARY_BUTTON} w-full lg:w-auto lg:min-w-[220px]`}
                >
                  <MapPin size={18} />
                  Ouvrir la carte
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate('/planning')}
                  className={DASHBOARD_ACTION_TILE_SECONDARY}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.06em]">Planning</p>
                      <p className="mt-1 text-[12px] text-slate-400">Voir les prochaines missions</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/logistique')}
                  className={DASHBOARD_ACTION_TILE_SECONDARY}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.06em]">Logistique</p>
                      <p className="mt-1 text-[12px] text-slate-400">Kits et ressources terrain</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => scrollToSection('team-pipeline')}
                  className={DASHBOARD_ACTION_TILE_SECONDARY}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                      <Activity size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.06em]">Pipeline</p>
                      <p className="mt-1 text-[12px] text-slate-400">Suivi de toutes les equipes</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => scrollToSection('team-regions')}
                  className={DASHBOARD_ACTION_TILE_PRIMARY}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.06em]">Suivi zone</p>
                      <p className="mt-1 text-[12px] text-blue-100/90">Priorites regionales</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-3">
                  {[
                    { label: 'Ma progression', value: myTrade ? `${myTrade.progress}%` : '—', icon: TrendingUp },
                    { label: 'Zones actives', value: myTrade?.activeZones ?? 0, icon: MapPin },
                    { label: 'Terminees', value: fmtNum(completedCount), icon: CheckCircle2 },
                    { label: 'Restantes', value: fmtNum(Math.max(0, pendingCount)), icon: Clock },
                  ].map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className={DASHBOARD_MINI_STAT_CARD}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.06em] text-slate-400">
                            {label}
                          </p>
                          <p className="mt-1 text-xl font-black tracking-tight text-white">{value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* Dependency Alert */}
          {isBlocked && predecessorTrade && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 sm:p-8 rounded-[1.6rem] sm:rounded-[2.5rem] bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl shadow-2xl flex items-start gap-3 sm:gap-6"
            >
              <div className="w-11 h-11 sm:w-14 sm:h-14 bg-amber-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-inner shrink-0">
                <AlertTriangle size={28} className="text-amber-500" />
              </div>
              <div>
                <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-[0.08em] sm:tracking-widest text-amber-400">
                  Dependance operationnelle detectee
                </h4>
                <p className="text-[11px] sm:text-[11px] font-bold text-slate-300 mt-2 tracking-tight leading-relaxed">
                  L'equipe <span className="text-white">{predecessorTrade.label}</span> a
                  complete <span className="text-white font-black">{predecessorTrade.progress}%</span> des taches. Le protocole GEM requiert{' '}
                  <span className="text-amber-400 font-black">80%</span> pour débloquer vos
                  prochaines unités.
                </p>
              </div>
            </motion.div>
          )}

          {/* Team KPIs */}
          {myTrade && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
              <KPICard
                title="MON AVANCEMENT"
                value={`${myTrade.progress}%`}
                icon={<TrendingUp size={22} />}
                trend={{ value: 0, isUp: true, label: 'OBJECTIF BRIGADE' }}
              />
              <KPICard
                title="ZONES ACTIVES"
                value={myTrade.activeZones || myTrade.progress > 0 ? myTrade.activeZones : '—'}
                icon={<MapPin size={22} />}
                trend={{ value: 0, isUp: true, label: 'CLUSTERS GÉOGRAPHIQUES' }}
              />
              <KPICard
                title="UNITÉS TERMINÉES"
                value={total > 0 ? fmtNum(completedCount) : '—'}
                icon={<CheckCircle2 size={22} />}
                trend={{ value: 0, isUp: true, label: 'LIVRÉ & VALIDÉ' }}
              />
              <KPICard
                title="UNITÉS RESTANTES"
                value={total > 0 ? fmtNum(pendingCount) : '—'}
                icon={<Clock size={22} />}
                trend={{ value: 0, isUp: false, label: 'BACKLOG OPS' }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-10">
            {/* Pipeline of all teams */}
            <div id="team-pipeline" className="lg:col-span-8 p-4 sm:p-6 md:p-10 rounded-[1.8rem] sm:rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mb-5 sm:mb-12 pb-5 sm:pb-8 border-b border-white/5">
                <div className="space-y-1">
                  <h3 className="text-[11px] sm:text-[11px] font-black text-blue-300/65 uppercase tracking-[0.08em] sm:tracking-[0.26em] flex items-center gap-2 sm:gap-3">
                    <Activity size={18} className="text-blue-500" /> Pipeline operations
                  </h3>
                  <p className="text-[10px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] sm:tracking-widest">
                    {total > 0
                      ? `Sync terrain sur ${fmtNum(total)} menages`
                      : 'En attente de synchro terrain'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-6">
                {pipeline.map((trade, i) => {
                  const isMe = trade.teamId === user?.teamId;
                  return (
                    <motion.div
                      key={trade.teamId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border transition-all ${
                        isMe
                          ? `bg-blue-600/10 border-blue-500/30 shadow-xl shadow-blue-600/5`
                          : 'border-white/5 bg-white/[0.02] opacity-40 grayscale group hover:grayscale-0 hover:opacity-80 transition-all'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="flex items-start gap-4 sm:gap-5 min-w-0">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 text-xl sm:text-2xl shadow-inner italic shrink-0">
                            {trade.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              <span className="font-black text-lg sm:text-xl text-white uppercase tracking-tight">
                                {trade.label}
                              </span>
                              {isMe && (
                                <span className="px-3 py-1 rounded-lg bg-blue-600 text-white text-[10px] sm:text-[9px] font-black uppercase tracking-[0.08em] sm:tracking-widest shadow-lg">
                                  Votre unite
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.06em] sm:tracking-widest mt-1.5">
                              {total > 0
                                ? `${fmtNum(trade.done ?? 0)} / ${fmtNum(total)} menages traites`
                                : trade.description}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-black text-2xl sm:text-3xl tracking-tighter ${TEXT_MAP[trade.color] || 'text-white'} drop-shadow-md shrink-0`}
                        >
                          {trade.progress}%
                        </span>
                      </div>
                      <ProgressBar
                        label=""
                        percentage={trade.progress}
                        status={trade.progress >= 80 ? 'success' : 'info'}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right column: Regional breakdown */}
            <div id="team-regions" className="lg:col-span-4 p-4 sm:p-6 md:p-10 rounded-[1.8rem] sm:rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl flex flex-col">
              <h3 className="text-[11px] sm:text-[11px] font-black mb-5 sm:mb-12 flex items-center gap-2 sm:gap-3 text-blue-300/65 uppercase tracking-[0.08em] sm:tracking-[0.26em]">
                <MapPin size={18} className="text-blue-500" /> Zones prioritaires
              </h3>

              {regionBreakdown.length > 0 ? (
                <div className="space-y-4 sm:space-y-10 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {regionBreakdown.map(({ region, done, all, pct: p }, i) => (
                    <div key={region}>
                      <ProgressBar
                        label={region}
                        count={`${done}/${all}`}
                        percentage={p}
                        status={p >= 70 ? 'success' : 'info'}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 sm:py-20 space-y-4 sm:space-y-6 opacity-20 border border-dashed border-white/10 rounded-[1.5rem] sm:rounded-[2rem]">
                  <MapPin size={48} className="text-blue-500" />
                  <p className="text-[10px] sm:text-[10px] font-black uppercase tracking-[0.08em] sm:tracking-[0.26em]">
                    En attente de synchro regionale...
                  </p>
                </div>
              )}

              <button
                onClick={() => navigate('/terrain')}
                className="mt-5 sm:mt-10 w-full flex items-center justify-center gap-3 sm:gap-4 h-14 sm:h-20 border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-white/[0.03] text-slate-400 hover:text-white rounded-[1.3rem] sm:rounded-[2rem] font-black text-[10px] sm:text-[10px] uppercase tracking-[0.08em] sm:tracking-[0.22em] transition-all group"
              >
                <ExternalLink size={18} className="group-hover:text-blue-500 transition-colors" />{' '}
                Ouvrir la carte detaillee
              </button>
            </div>
          </div>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
