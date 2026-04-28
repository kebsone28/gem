 
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../store/db';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  TrendingUp,
  MapPin,
  FileText,
  ArrowRight,
  Activity,
  ShieldCheck,
  Clock3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fmtNum } from '../../utils/format';
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

export default function ClientDashboard() {
  const navigate = useNavigate();
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ─── Live Dexie data ──────────────────────────────────────────
  const households = useLiveQuery(() => db.households.toArray()) || [];
  const zones = useLiveQuery(() => db.zones.toArray()) || [];

  const total = households.length;
  const done = households.filter(
    (h) => h.status === 'Terminé' || h.status === 'Réception: Validée'
  ).length;
  const inProgress = households.filter(
    (h) =>
      !['Non encore installée', 'Terminé', 'Réception: Validée', 'Inéligible', 'Problème'].includes(
        h.status ?? ''
      )
  ).length;
  const pending = households.filter((h) => h.status === 'Non encore installée').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Recent validated households (last 5 "Terminé")
  const recentValidated = households
    .filter((h) => h.status === 'Terminé' || h.status === 'Réception: Validée')
    .slice(-5)
    .reverse();

  // Regional breakdown (top 4 by total)
  const regionData: Record<string, { done: number; total: number }> = {};
  households.forEach((h) => {
    const zone = zones.find((z) => z.id === h.zoneId);
    const r = zone?.region ?? zone?.name ?? 'Inconnue';
    if (!regionData[r]) regionData[r] = { done: 0, total: 0 };
    regionData[r].total++;
    if (h.status === 'Terminé' || h.status === 'Réception: Validée') regionData[r].done++;
  });
  const topRegions = Object.entries(regionData)
    .map(([name, { done: d, total: t }]) => ({
      name,
      done: d,
      total: t,
      pct: t > 0 ? Math.round((d / t) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
  const biggestRegion = topRegions[0] || null;
  const clientSignals = [
    {
      label: 'Charge restante',
      value: fmtNum(pending),
      helper: pending > 0 ? `${fmtNum(inProgress)} en cours de traitement` : 'Aucun site en attente',
      tone:
        pending > 0
          ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
      icon: Clock3,
    },
    {
      label: 'Rythme client',
      value: `${pct}%`,
      helper: `${fmtNum(done)} menages valides sur ${fmtNum(total)}`,
      tone: 'border-blue-500/20 bg-blue-500/10 text-blue-200',
      icon: TrendingUp,
    },
    {
      label: 'Region moteur',
      value: biggestRegion?.name || 'N/A',
      helper: biggestRegion ? `${biggestRegion.pct}% de completion` : 'Aucune region active',
      tone: 'border-violet-500/20 bg-violet-500/10 text-violet-200',
      icon: MapPin,
    },
  ];

  return (
    <PageContainer className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/10 via-blue-600/5 to-transparent pointer-events-none" />

      <PageHeader
        title="DASHBOARD CLIENT"
        subtitle="Interface de suivi d'avancement pour les partenaires institutionnels"
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
                    <StatusBadge status="success" label="Client connecte" />
                    <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-300/55">
                      Avancement projet en temps reel
                    </span>
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">
                    Vue client
                  </h2>
                  <p className="text-[13px] text-slate-400">
                    Lecture rapide de la progression, des regions et des validations.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/rapports')}
                  className={`${DASHBOARD_PRIMARY_BUTTON} w-full lg:w-auto lg:min-w-[220px]`}
                >
                  <FileText size={18} />
                  Ouvrir les rapports
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate('/terrain')}
                  className={DASHBOARD_ACTION_TILE_SECONDARY}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.06em]">Carte terrain</p>
                      <p className="mt-1 text-[12px] text-slate-400">Voir les zones actives</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => scrollToSection('client-regions')}
                  className={DASHBOARD_ACTION_TILE_SECONDARY}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.06em]">Regions</p>
                      <p className="mt-1 text-[12px] text-slate-400">Suivre les performances</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => scrollToSection('client-validations')}
                  className={DASHBOARD_ACTION_TILE_SECONDARY}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.06em]">Validations</p>
                      <p className="mt-1 text-[12px] text-slate-400">Derniers menages traites</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => scrollToSection('client-overview')}
                  className={DASHBOARD_ACTION_TILE_PRIMARY}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                      <Activity size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.06em]">Progression</p>
                      <p className="mt-1 text-[12px] text-blue-100/90">Point de situation</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-3">
                  {[
                    { label: 'Progression', value: `${pct}%`, icon: TrendingUp },
                    { label: 'Raccordes', value: fmtNum(done), icon: CheckCircle2 },
                    { label: 'En cours', value: fmtNum(inProgress), icon: Activity },
                    { label: 'Regions actives', value: topRegions.length, icon: MapPin },
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

              <div className="grid gap-3 border-t border-white/6 pt-3 md:grid-cols-3">
                {clientSignals.map(({ label, value, helper, tone, icon: Icon }) => (
                  <div key={label} className={`rounded-[1.2rem] border p-4 ${tone}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-80">
                          {label}
                        </p>
                        <p className="mt-2 text-2xl font-black tracking-tight text-white">
                          {value}
                        </p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                        <Icon size={18} />
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-300">
                      {helper}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </header>

          {/* Main Progress Logic */}
          <motion.div
            id="client-overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 sm:p-6 md:p-14 rounded-[1.6rem] sm:rounded-3xl md:rounded-[3.5rem] bg-slate-900/40 border border-white/10 shadow-3xl relative overflow-hidden backdrop-blur-3xl group"
          >
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/[0.03] to-transparent pointer-events-none" />

            <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-16 relative z-10">
              <div className="flex-1 w-full space-y-5 sm:space-y-8">
                <div className="space-y-2">
                  <h3 className="text-[11px] sm:text-[11px] font-black text-blue-300/65 uppercase tracking-[0.08em] sm:tracking-[0.26em] flex items-center gap-2 sm:gap-3">
                    <TrendingUp size={18} className="text-emerald-400" /> Avancement global
                  </h3>
                  <div className="flex flex-wrap items-end gap-3 md:gap-4">
                    <span className="text-[4rem] sm:text-6xl md:text-9xl font-black text-white tracking-tighter italic leading-none drop-shadow-xl">
                      {pct}%
                    </span>
                    <span className="text-[10px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-[0.06em] sm:tracking-[0.15em] md:tracking-widest bg-emerald-500/10 px-3 md:px-4 py-1.5 rounded-xl border border-emerald-500/20 mt-1 md:mt-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                      Suivi client actif
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="h-3 sm:h-4 w-full bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
                    <motion.div
                      className={`h-full rounded-full shadow-[0_0_20px] ${pct >= 70 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-emerald-500/50' : 'bg-gradient-to-r from-blue-600 to-blue-400 shadow-blue-500/50'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] sm:text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.06em] sm:tracking-widest font-mono flex-wrap gap-2">
                    <span className="shrink-0">debut</span>
                    <span className="text-white/60 text-center flex-1">
                      {fmtNum(done)} / {fmtNum(total)} menages termines
                    </span>
                    <span className="shrink-0 text-right">objectif</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
            <KPICard
              title="TOTAL MÉNAGES"
              value={total > 0 ? fmtNum(total) : '—'}
              icon={<Users size={22} />}
              trend={{ value: 0, isUp: true, label: 'BASE DE DONNÉES CLOUD' }}
            />
            <KPICard
              title="SITES RACCORDÉS"
              value={total > 0 ? fmtNum(done) : '—'}
              icon={<CheckCircle2 size={22} />}
              trend={{ value: pct, isUp: true, label: "TAUX D'ÉLECTRIFICATION" }}
            />
            <KPICard
              title="UNITÉS EN COURS"
              value={total > 0 ? fmtNum(inProgress) : '—'}
              icon={<Activity size={22} />}
              trend={{ value: 0, isUp: true, label: 'PHASES ACTIVES TERRAIN' }}
            />
            <KPICard
              title="EN ATTENTE"
              value={total > 0 ? fmtNum(pending) : '—'}
              icon={<MapPin size={22} />}
              trend={{ value: 0, isUp: false, label: "FILES D'ATTENTE" }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-10">
            {/* Regional breakdown */}
            <div id="client-regions" className="lg:col-span-8 p-4 sm:p-6 md:p-10 rounded-[1.8rem] sm:rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
              <div className="flex items-center justify-between gap-4 mb-5 sm:mb-12 pb-5 sm:pb-8 border-b border-white/5">
                <h3 className="text-[11px] sm:text-[11px] font-black tracking-[0.08em] sm:tracking-[0.26em] text-blue-300/65 uppercase flex items-center gap-2 sm:gap-3">
                  <MapPin size={18} className="text-blue-500" /> Regions prioritaires
                </h3>
                <p className="text-[10px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.06em] sm:tracking-widest">
                  {topRegions.length} clusters actifs
                </p>
              </div>

              {topRegions.length > 0 ? (
                <div className="space-y-4 sm:space-y-10">
                  {topRegions.map((r) => (
                    <div key={r.name}>
                      <ProgressBar
                        label={r.name}
                        count={`${fmtNum(r.done)} / ${fmtNum(r.total)} UNITS`}
                        percentage={r.pct}
                        status={r.pct >= 70 ? 'success' : r.pct >= 40 ? 'info' : 'warning'}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 sm:py-20 text-center space-y-4 sm:space-y-6 opacity-20 border border-dashed border-white/10 rounded-[1.5rem] sm:rounded-[2rem]">
                  <MapPin size={48} className="text-blue-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] sm:tracking-[0.4em]">
                    Synchronisation des donnees regionales...
                  </p>
                </div>
              )}
            </div>

            {/* Recent validations */}
            <div id="client-validations" className="lg:col-span-4 p-4 sm:p-6 md:p-10 rounded-[1.8rem] sm:rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl flex flex-col">
              <h3 className="text-[11px] sm:text-[11px] font-black mb-5 sm:mb-10 flex items-center gap-2 sm:gap-3 text-blue-300/65 uppercase tracking-[0.08em] sm:tracking-[0.26em]">
                <TrendingUp size={18} className="text-emerald-400" /> Validations recentes
              </h3>

              {recentValidated.length > 0 ? (
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {recentValidated.map((h, i) => {
                    const zone = zones.find((z) => z.id === h.zoneId);
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-3 sm:gap-5 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.06] transition-all"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/10">
                          <CheckCircle2 size={18} className="text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-[13px] font-black text-white truncate uppercase tracking-tight">
                            {h.id?.toString().substring(0, 10)}
                          </p>
                          <p className="text-[10px] sm:text-[9px] font-black text-blue-300/60 uppercase tracking-[0.06em] sm:tracking-widest truncate mt-1 leading-none">
                            {zone?.name ?? 'OPS ZONE UNKNOWN'}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 sm:py-20 space-y-4 sm:space-y-6 opacity-20 border border-dashed border-white/10 rounded-[1.5rem] sm:rounded-[2rem]">
                  <CheckCircle2 size={48} className="text-blue-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] sm:tracking-[0.2em]">
                    En attente de validations terrain
                  </p>
                  <button
                    onClick={() => navigate('/rapports')}
                    className="text-blue-400 font-black text-[10px] flex items-center gap-3 hover:text-white transition-all uppercase tracking-[0.08em] sm:tracking-widest group"
                  >
                    Ouvrir l'archive{' '}
                    <ArrowRight
                      size={14}
                      className="group-hover:translate-x-2 transition-transform"
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
