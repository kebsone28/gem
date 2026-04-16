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
import { StatusBadge, KPICard, ProgressBar } from '../../components/dashboards/DashboardComponents';

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
        className="relative z-10 pt-12 pb-10"
      />

      <ContentArea padding="none" className="bg-transparent border-none shadow-none relative z-10">
        <div className="px-6 lg:px-12 pb-24 space-y-12">
          {/* Header & Main Call to Action */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status="info" label="ACCÈS BRIGADE OPS" />
                <span className="h-4 w-[1px] bg-white/10" />
                <span className="text-[10px] font-black text-blue-400/40 uppercase tracking-[0.3em] font-mono italic">
                  {myTrade ? `${myTrade.label.toUpperCase()} SPECIALIST` : 'TEAM LEADER'}
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-[0.8]">
                PERFORMANCE{' '}
                <span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                  TERRAIN
                </span>
              </h2>
            </div>
            <button
              onClick={() => navigate('/terrain')}
              className="h-14 px-8 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-blue-600/30 active:scale-95 flex items-center gap-3 italic"
            >
              <MapPin size={18} />
              OUVRIR LA CARTE INTERACTIVE
            </button>
          </header>

          {/* Dependency Alert */}
          {isBlocked && predecessorTrade && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-[2.5rem] bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl shadow-2xl flex items-start gap-6"
            >
              <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-inner shrink-0">
                <AlertTriangle size={28} className="text-amber-500" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 italic">
                  DÉPENDANCE OPÉRATIONNELLE DÉTECTÉE
                </h4>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-tight leading-relaxed">
                  L'équipe <span className="text-white italic">{predecessorTrade.label}</span> a
                  complété{' '}
                  <span className="text-white font-black italic">{predecessorTrade.progress}%</span>{' '}
                  des tâches. Le protocole GEM requiert{' '}
                  <span className="text-amber-400 font-black">80%</span> pour débloquer vos
                  prochaines unités.
                </p>
              </div>
            </motion.div>
          )}

          {/* Team KPIs */}
          {myTrade && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Pipeline of all teams */}
            <div className="lg:col-span-8 p-6 md:p-10 rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 pb-8 border-b border-white/5">
                <div className="space-y-1">
                  <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] italic flex items-center gap-3">
                    <Activity size={18} className="text-blue-500" /> GLOBAL OPS PIPELINE
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {total > 0
                      ? `REAL-TIME SYNC WITH ${fmtNum(total)} HOUSEHOLDS`
                      : 'AWAITING FIELD AGENT SYNC'}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {pipeline.map((trade, i) => {
                  const isMe = trade.teamId === user?.teamId;
                  return (
                    <motion.div
                      key={trade.teamId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`p-8 rounded-[2.5rem] border transition-all ${
                        isMe
                          ? `bg-blue-600/10 border-blue-500/30 shadow-xl shadow-blue-600/5`
                          : 'border-white/5 bg-white/[0.02] opacity-40 grayscale group hover:grayscale-0 hover:opacity-80 transition-all'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 text-2xl shadow-inner italic">
                            {trade.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-xl italic text-white uppercase tracking-tighter">
                                {trade.label}
                              </span>
                              {isMe && (
                                <span className="px-3 py-1 rounded-lg bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest italic shadow-lg">
                                  VOTRE UNITÉ
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5 italic">
                              {total > 0
                                ? `${fmtNum(trade.done ?? 0)} / ${fmtNum(total)} UNITS COMPLETED`
                                : trade.description}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-black text-3xl italic tracking-tighter ${TEXT_MAP[trade.color] || 'text-white'} drop-shadow-md`}
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
            <div className="lg:col-span-4 p-6 md:p-10 rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl flex flex-col">
              <h3 className="text-[11px] font-black mb-12 flex items-center gap-3 text-blue-400/40 uppercase tracking-[0.4em] italic">
                <MapPin size={18} className="text-blue-500" /> MISSION CORES
              </h3>

              {regionBreakdown.length > 0 ? (
                <div className="space-y-10 flex-1 overflow-y-auto pr-2 custom-scrollbar">
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
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 space-y-6 opacity-20 border border-dashed border-white/10 rounded-[2rem]">
                  <MapPin size={48} className="text-blue-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] italic">
                    AWAITING REGIONAL SYNC ARCHIVE...
                  </p>
                </div>
              )}

              <button
                onClick={() => navigate('/terrain')}
                className="mt-10 w-full flex items-center justify-center gap-4 h-20 border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-white/[0.03] text-slate-500 hover:text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] transition-all group italic"
              >
                <ExternalLink size={18} className="group-hover:text-blue-500 transition-colors" />{' '}
                EXPLORE GIS CORE
              </button>
            </div>
          </div>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
