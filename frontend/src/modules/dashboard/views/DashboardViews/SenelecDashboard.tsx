import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { usePermissions } from '@hooks/usePermissions';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/store/db';
import { motion } from 'framer-motion';
import {
   ShieldCheck,
   Zap,
   CheckCircle2,
   AlertTriangle,
   FileText,
   Eye,
   TrendingUp,
   Award,
   BarChart3,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '@components';
import {
   DASHBOARD_ACTION_TILE_PRIMARY,
   DASHBOARD_ACTION_TILE_SECONDARY,
   DASHBOARD_MINI_STAT_CARD,
   DASHBOARD_PRIMARY_BUTTON,
   DASHBOARD_STICKY_PANEL,
   StatusBadge,
   KPICard,
   ProgressBar,
} from '@components/dashboards/DashboardComponents';
import { fmtNum } from '@utils/format';

interface SupervisionMetrics {
  // Supervision technique
  conformiteNormes: number;
  inspectionsRealisees: number;
  nonConformites: number;
  autorisationsDelivrees: number;

  // Qualité
  scoreQualiteGlobal: number;
  auditsRealises: number;
  rapportsValidation: number;

  // Réglementaire
  proceduresConformes: number;
  risquesIdentifies: number;
  interventionsUrgentes: number;

  // Performance
  tempsMoyenValidation: number;
  tauxReussiteInspection: number;
  delaiMoyenCorrection: number;
}

interface InspectionData {
  id: string;
  date: Date;
  site: string;
  inspecteur: string;
  statut: 'conforme' | 'non_conforme' | 'en_attente';
  norme: string;
  observations: string;
  recommandations: string[];
}

interface ComplianceData {
  norme: string;
  conformite: number;
  sitesVerifies: number;
  nonConformites: number;
  dernierControle: Date;
}

export default function SenelecDashboard() {
  const { user } = useAuth();
  const { peut, PERMISSIONS } = usePermissions();
  const navigate = useNavigate();
  const households = useLiveQuery(() => db.households.toArray()) || [];
  const zones = useLiveQuery(() => db.zones.toArray()) || [];

  const [selectedView, setSelectedView] = useState<
    'overview' | 'inspections' | 'compliance' | 'reports'
  >('overview');

  // Vérification des permissions
  const canViewMissions = peut(PERMISSIONS.MISSIONS_READ);
  const canValidateInstallations = peut(PERMISSIONS.MISSIONS_VALIDATE);
  const canRejectDossiers = peut(PERMISSIONS.TERRAIN_REJECT);
  const canManagePV = peut(PERMISSIONS.DOCS_PV);
  const canViewAlerts = peut(PERMISSIONS.UI_ALERTS);

  // Calcul des métriques de supervision
  const supervisionMetrics: SupervisionMetrics = useMemo(() => {
    const total = households.length;
    const completed = households.filter((h) => h.status === 'Terminé').length;
    const inProgress = households.filter(
      (h) => !['Non encore installée', 'Terminé', 'Inéligible'].includes(h.status ?? '')
    ).length;

    // Simulations des métriques SENELEC
    const conformiteNormes = 90; // valeur représentative — à brancher sur API
    const inspectionsRealisees = Math.floor(total * 0.9); // 90% inspectés
    const nonConformites = Math.floor(inspectionsRealisees * 0.08); // 8% NC
    const autorisationsDelivrees = completed;

    const scoreQualiteGlobal = 92; // valeur représentative — à brancher sur API
    const auditsRealises = Math.floor(total * 0.15); // 15% audités
    const rapportsValidation = completed;

    const proceduresConformes = Math.floor(total * 0.95); // 95% conformes
    const risquesIdentifies = Math.floor(total * 0.03); // 3% risques
    const interventionsUrgentes = Math.floor(total * 0.02); // 2% urgentes

    const tempsMoyenValidation = 2.5; // jours
    const tauxReussiteInspection = 92; // %
    const delaiMoyenCorrection = 5; // jours

    return {
      conformiteNormes,
      inspectionsRealisees,
      nonConformites,
      autorisationsDelivrees,
      scoreQualiteGlobal,
      auditsRealises,
      rapportsValidation,
      proceduresConformes,
      risquesIdentifies,
      interventionsUrgentes,
      tempsMoyenValidation,
      tauxReussiteInspection,
      delaiMoyenCorrection,
    };
  }, [households]);

  // Données d'inspections simulées
  const recentInspections: InspectionData[] = useMemo(() => {
    return [
      {
        id: '1',
        date: new Date(),
        site: 'Zone A - Lot 123',
        inspecteur: 'Inspecteur SENELEC 1',
        statut: 'conforme',
        norme: 'NF C 15-100',
        observations: 'Installation conforme aux normes',
        recommandations: ['Maintenance préventive recommandée'],
      },
      {
        id: '2',
        date: new Date(new Date().setDate(new Date().getDate() - 1)),
        site: 'Zone B - Lot 456',
        inspecteur: 'Inspecteur SENELEC 2',
        statut: 'non_conforme',
        norme: 'NF C 15-100',
        observations: 'Non-conformité détectée sur la mise à la terre',
        recommandations: ['Corriger la mise à la terre', 'Nouvelle inspection requise'],
      },
      {
        id: '3',
        date: new Date(new Date().setDate(new Date().getDate() - 2)),
        site: 'Zone C - Lot 789',
        inspecteur: 'Inspecteur SENELEC 3',
        statut: 'en_attente',
        norme: 'NF C 15-100',
        observations: 'Inspection en cours de traitement',
        recommandations: ['En attente de validation finale'],
      },
    ];
  }, []);

  // Données de conformité par norme
  const complianceData: ComplianceData[] = useMemo(() => {
    return [
      {
        norme: 'NF C 15-100',
        conformite: 92,
        sitesVerifies: 150,
        nonConformites: 12,
        dernierControle: new Date(),
      },
      {
        norme: 'IEC 60364',
        conformite: 88,
        sitesVerifies: 120,
        nonConformites: 14,
        dernierControle: new Date(new Date().setDate(new Date().getDate() - 1)),
      },
      {
        norme: 'Normes SENELEC',
        conformite: 95,
        sitesVerifies: 180,
        nonConformites: 9,
        dernierControle: new Date(new Date().setDate(new Date().getDate() - 2)),
      },
    ];
  }, []);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderViewSelector = () => (
    <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
      {[
        { id: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
        { id: 'inspections', label: 'Inspections', icon: Eye },
        { id: 'compliance', label: 'Conformité', icon: CheckCircle2 },
        { id: 'reports', label: 'Rapports', icon: FileText },
      ].map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setSelectedView(id as any)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            selectedView === id
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <PageContainer className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/10 via-blue-600/5 to-transparent pointer-events-none" />

      <PageHeader
        title="TABLEAU DE BORD SENELEC"
        subtitle="Supervision technique et contrôle qualité des installations électriques"
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
          {/* Header avec navigation */}
          <header className={DASHBOARD_STICKY_PANEL}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status="success" label="Superviseur SENELEC" />
                    <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-300/55">
                      Contrôle qualité et conformité
                    </span>
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">
                    Console de supervision technique
                  </h2>
                  <p className="text-[13px] text-slate-400">
                    Inspection, validation et surveillance des installations électriques.
                  </p>
                </div>
                {renderViewSelector()}
              </div>

              {/* Actions rapides */}
              <div className="grid grid-cols-2 gap-3">
                {canValidateInstallations && (
                  <button
                    onClick={() => navigate('/inspections')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <Eye size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Inspections
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Planifier et effectuer</p>
                      </div>
                    </div>
                  </button>
                )}
                {canManagePV && (
                  <button
                    onClick={() => navigate('/pv')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">PV</p>
                        <p className="mt-1 text-[12px] text-slate-400">Générer et valider</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewAlerts && (
                  <button
                    onClick={() => navigate('/alertes')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Alertes
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Suivi et gestion</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewMissions && (
                  <button
                    onClick={() => navigate('/rapports/senelec')}
                    className={DASHBOARD_ACTION_TILE_PRIMARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                        <BarChart3 size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Rapports
                        </p>
                        <p className="mt-1 text-[12px] text-blue-100/90">Supervision globale</p>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* KPIs principaux */}
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-3">
                  {[
                    {
                      label: 'Conformité',
                      value: `${supervisionMetrics.conformiteNormes.toFixed(1)}%`,
                      icon: CheckCircle2,
                    },
                    {
                      label: 'Inspections',
                      value: supervisionMetrics.inspectionsRealisees,
                      icon: Eye,
                    },
                    {
                      label: 'Qualité',
                      value: `${supervisionMetrics.scoreQualiteGlobal.toFixed(1)}/100`,
                      icon: Award,
                    },
                    {
                      label: 'Risques',
                      value: supervisionMetrics.risquesIdentifies,
                      icon: AlertTriangle,
                    },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className={DASHBOARD_MINI_STAT_CARD}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.06em] text-slate-400">
                            {label}
                          </p>
                          <p className="mt-1 text-xl font-black tracking-tight text-white">
                            {value}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* Vue d'ensemble */}
          {selectedView === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* KPIs de supervision */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
                <KPICard
                  title="CONFORMITÉ NORMES"
                  value={`${supervisionMetrics.conformiteNormes.toFixed(1)}%`}
                  icon={<CheckCircle2 size={22} />}
                  trend={{ value: 2.5, isUp: true, label: 'CE MOIS' }}
                />
                <KPICard
                  title="INSPECTIONS RÉALISÉES"
                  value={supervisionMetrics.inspectionsRealisees}
                  icon={<Eye size={22} />}
                  trend={{ value: 15, isUp: true, label: 'SEMAINE DERNIÈRE' }}
                />
                <KPICard
                  title="SCORE QUALITÉ"
                  value={`${supervisionMetrics.scoreQualiteGlobal.toFixed(1)}/100`}
                  icon={<Award size={22} />}
                  trend={{ value: 1.2, isUp: true, label: 'AMÉLIORATION' }}
                />
                <KPICard
                  title="TAUX RÉUSSITE"
                  value={`${supervisionMetrics.tauxReussiteInspection}%`}
                  icon={<TrendingUp size={22} />}
                  trend={{ value: 0, isUp: true, label: 'STABLE' }}
                />
              </div>

              {/* Alertes et interventions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <AlertTriangle size={18} className="text-blue-500" /> Alertes Actives
                  </h3>
                  <div className="space-y-3">
                    {supervisionMetrics.nonConformites > 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-sm text-amber-400">
                          ⚠️ {supervisionMetrics.nonConformites} non-conformités en attente
                        </p>
                      </div>
                    )}
                    {supervisionMetrics.interventionsUrgentes > 0 && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-red-400">
                          🚨 {supervisionMetrics.interventionsUrgentes} interventions urgentes
                          requises
                        </p>
                      </div>
                    )}
                    {supervisionMetrics.risquesIdentifies > 0 && (
                      <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <p className="text-sm text-orange-400">
                          📋 {supervisionMetrics.risquesIdentifies} risques identifiés
                        </p>
                      </div>
                    )}
                    {supervisionMetrics.nonConformites === 0 &&
                      supervisionMetrics.interventionsUrgentes === 0 && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <p className="text-sm text-emerald-400">✅ Aucune alerte active</p>
                        </div>
                      )}
                  </div>
                </div>

                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <Zap size={18} className="text-blue-500" /> Performance Supervision
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Temps moyen validation</span>
                      <span className="text-sm font-medium text-white">
                        {supervisionMetrics.tempsMoyenValidation} jours
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Délai moyen correction</span>
                      <span className="text-sm font-medium text-white">
                        {supervisionMetrics.delaiMoyenCorrection} jours
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Autorisations délivrées</span>
                      <span className="text-sm font-medium text-emerald-400">
                        {supervisionMetrics.autorisationsDelivrees}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Audits réalisés</span>
                      <span className="text-sm font-medium text-blue-400">
                        {supervisionMetrics.auditsRealises}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue inspections */}
          {selectedView === 'inspections' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <Eye size={18} className="text-blue-500" /> Inspections Récentes
                </h3>
                <div className="space-y-3">
                  {recentInspections.map((inspection) => (
                    <div
                      key={inspection.id}
                      className={`p-4 rounded-lg border ${
                        inspection.statut === 'conforme'
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : inspection.statut === 'non_conforme'
                            ? 'bg-red-500/10 border-red-500/20'
                            : 'bg-amber-500/10 border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                inspection.statut === 'conforme'
                                  ? 'bg-emerald-500 text-white'
                                  : inspection.statut === 'non_conforme'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-amber-500 text-white'
                              }`}
                            >
                              {inspection.statut === 'conforme'
                                ? 'Conforme'
                                : inspection.statut === 'non_conforme'
                                  ? 'Non conforme'
                                  : 'En attente'}
                            </span>
                            <span className="text-sm font-medium text-white">
                              {inspection.site}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mb-1">
                            {inspection.norme} • {inspection.inspecteur} •{' '}
                            {inspection.date.toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-sm text-white mb-2">{inspection.observations}</p>
                          {inspection.recommandations.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-slate-400 mb-1">Recommandations:</p>
                              <ul className="list-disc list-inside text-xs text-slate-300">
                                {inspection.recommandations.map((rec, i) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue conformité */}
          {selectedView === 'compliance' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <CheckCircle2 size={18} className="text-blue-500" /> Conformité par Norme
                </h3>
                <div className="space-y-4">
                  {complianceData.map((compliance) => (
                    <div
                      key={compliance.norme}
                      className="p-4 bg-white/[0.02] rounded-lg border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-white">{compliance.norme}</h4>
                        <span
                          className={`text-sm font-medium ${
                            compliance.conformite >= 90
                              ? 'text-emerald-400'
                              : compliance.conformite >= 80
                                ? 'text-amber-400'
                                : 'text-red-400'
                          }`}
                        >
                          {compliance.conformite}%
                        </span>
                      </div>
                      <ProgressBar
                        label="Taux de conformité"
                        count={`${compliance.sitesVerifies - compliance.nonConformites} / ${compliance.sitesVerifies} sites`}
                        percentage={compliance.conformite}
                        status={
                          compliance.conformite >= 90
                            ? 'success'
                            : compliance.conformite >= 80
                              ? 'warning'
                              : 'info'
                        }
                      />
                      <div className="mt-2 flex justify-between text-xs text-slate-400">
                        <span>{compliance.nonConformites} non-conformités</span>
                        <span>
                          Dernier contrôle: {compliance.dernierControle.toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue rapports */}
          {selectedView === 'reports' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <FileText size={18} className="text-blue-500" /> Rapports de Supervision
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => navigate('/rapports/inspections')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Rapports d'Inspection</p>
                        <p className="text-xs text-slate-400">
                          {supervisionMetrics.inspectionsRealisees} inspections
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/rapports/conformite')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={20} className="text-emerald-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Rapports de Conformité</p>
                        <p className="text-xs text-slate-400">
                          {complianceData.length} normes vérifiées
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/rapports/audits')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Award size={20} className="text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Rapports d'Audit</p>
                        <p className="text-xs text-slate-400">
                          {supervisionMetrics.auditsRealises} audits réalisés
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/rapports/performances')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 size={20} className="text-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Rapports de Performance</p>
                        <p className="text-xs text-slate-400">Indicateurs KPIs</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ContentArea>
    </PageContainer>
  );
}
