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
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fmtNum } from '../../utils/format';
import { PageContainer, PageHeader, ContentArea } from '../../components';
import { StatusBadge, KPICard, ProgressBar } from '../../components/dashboards/DashboardComponents';

export default function ClientDashboard() {
  const navigate = useNavigate();

  // ─── Live Dexie data ──────────────────────────────────────────
  const households = useLiveQuery(() => db.households.toArray()) || [];
  const zones = useLiveQuery(() => db.zones.toArray()) || [];

  const total = households.length;
  const done = households.filter(
    (h) => h.status === 'Terminé' || h.status === 'Réception: Validée'
  ).length;
  const inProgress = households.filter(
    (h) =>
      !['Non débuté', 'Terminé', 'Réception: Validée', 'Inéligible', 'Problème'].includes(
        h.status ?? ''
      )
  ).length;
  const pending = households.filter((h) => h.status === 'Non débuté').length;
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
        className="relative z-10 pt-12 pb-10"
      />

      <ContentArea padding="none" className="bg-transparent border-none shadow-none relative z-10">
        <div className="px-6 lg:px-12 pb-24 space-y-12">
          {/* Header & Actions */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status="success" label="ACCÈS CLIENT SÉCURISÉ" />
                <span className="h-4 w-[1px] bg-white/10" />
                <span className="text-[10px] font-black text-blue-400/40 uppercase tracking-[0.3em] font-mono italic">
                  PROJECT STATUS REAL-TIME
                </span>
              </div>
              <h2 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-[0.8]">
                SUIVI{' '}
                <span className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                  DYNAMIQUE
                </span>
              </h2>
            </div>
            <button
              onClick={() => navigate('/rapports')}
              className="h-14 px-8 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-blue-600/30 active:scale-95 flex items-center gap-3 italic"
            >
              <FileText size={18} />
              GÉNÉRER UN RAPPORT EXÉCUTIF
            </button>
          </header>

          {/* Main Progress Logic */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-10 md:p-14 rounded-[3.5rem] bg-slate-900/40 border border-white/10 shadow-3xl relative overflow-hidden backdrop-blur-3xl group"
          >
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/[0.03] to-transparent pointer-events-none" />

            <div className="flex flex-col md:flex-row items-center gap-16 relative z-10">
              <div className="flex-1 w-full space-y-8">
                <div className="space-y-2">
                  <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] italic flex items-center gap-3">
                    <TrendingUp size={18} className="text-emerald-400" /> GLOBAL PROJECT ADVANCEMENT
                  </h3>
                  <div className="flex items-baseline gap-4">
                    <span className="text-8xl md:text-9xl font-black text-white tracking-tighter italic leading-none drop-shadow-xl">
                      {pct}%
                    </span>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-4 py-1.5 rounded-xl border border-emerald-500/20 italic">
                      SYSTÈME OPÉRATIONNEL
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
                    <motion.div
                      className={`h-full rounded-full shadow-[0_0_20px] ${pct >= 70 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-emerald-500/50' : 'bg-gradient-to-r from-blue-600 to-blue-400 shadow-blue-500/50'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest italic font-mono">
                    <span>DEPL. START</span>
                    <span className="text-white/60">
                      {fmtNum(done)} / {fmtNum(total)} UNITS COMPLETED
                    </span>
                    <span>OPTIMAL TARGET</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Regional breakdown */}
            <div className="lg:col-span-8 p-10 rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
              <div className="flex items-center justify-between mb-12 pb-8 border-b border-white/5">
                <h3 className="text-[11px] font-black tracking-[0.4em] text-blue-400/40 uppercase italic flex items-center gap-3">
                  <MapPin size={18} className="text-blue-500" /> TOP-PRIORITY REGIONS
                </h3>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">
                  {topRegions.length} ACTIVE CLUSTERS
                </p>
              </div>

              {topRegions.length > 0 ? (
                <div className="space-y-10">
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
                <div className="flex flex-col items-center py-20 text-center space-y-6 opacity-20 border border-dashed border-white/10 rounded-[2rem]">
                  <MapPin size={48} className="text-blue-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] italic">
                    SYNCHRONIZING REGIONAL DATA ARCHIVE...
                  </p>
                </div>
              )}
            </div>

            {/* Recent validations */}
            <div className="lg:col-span-4 p-10 rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl flex flex-col">
              <h3 className="text-[11px] font-black mb-10 flex items-center gap-3 text-blue-400/40 uppercase tracking-[0.4em] italic">
                <TrendingUp size={18} className="text-emerald-400" /> RECENT VALIDATIONS
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
                        className="flex items-center gap-5 p-5 rounded-2xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.06] transition-all"
                      >
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/10">
                          <CheckCircle2 size={18} className="text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-black text-white italic truncate uppercase tracking-tight">
                            {h.id?.toString().substring(0, 10)}
                          </p>
                          <p className="text-[9px] font-black text-blue-400/40 uppercase tracking-widest truncate mt-1 italic leading-none">
                            {zone?.name ?? 'OPS ZONE UNKNOWN'}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 space-y-6 opacity-20 border border-dashed border-white/10 rounded-[2rem]">
                  <CheckCircle2 size={48} className="text-blue-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">
                    AWAITING FIELD AGENT VALIDATION
                  </p>
                  <button
                    onClick={() => navigate('/rapports')}
                    className="text-blue-400 font-black text-[10px] flex items-center gap-3 hover:text-white transition-all uppercase tracking-widest italic group"
                  >
                    ACCESS FULL ARCHIVE{' '}
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
