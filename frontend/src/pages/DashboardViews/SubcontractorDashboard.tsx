import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../store/db';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  TrendingUp,
  Activity,
  MapPin,
  Target,
  Settings,
  BarChart3,
  Upload,
  Eye,
} from 'lucide-react';
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
import { fmtNum } from '../../utils/format';

interface SubcontractorMetrics {
  // Performance
  missionsCompletees: number;
  qualiteTravaux: number;
  delaisRespectes: number;
  scorePerformance: number;

  // Équipes
  personnelActif: number;
  performanceEquipes: number;
  formationNecessaire: number;
  tauxPresence: number;

  // Reporting
  rapportsSoumis: number;
  validationsClient: number;
  correctionsRequises: number;
  tempsMoyenSoumission: number;

  // Opérationnel
  tachesAssignees: number;
  tachesEnCours: number;
  tachesTerminees: number;
  efficaciteMoyenne: number;
}

interface MissionData {
  id: string;
  titre: string;
  zone: string;
  statut: 'en_attente' | 'en_cours' | 'terminee' | 'validee' | 'requiert_correction';
  dateDebut: Date;
  dateFin?: Date;
  equipe: string;
  progression: number;
  qualite: number;
  rapportSoumis: boolean;
}

interface TeamData {
  id: string;
  nom: string;
  membres: number;
  missionsActives: number;
  performance: number;
  presence: number;
  competences: string[];
}

export default function SubcontractorDashboard() {
  const { user } = useAuth();
  const { peut, PERMISSIONS } = usePermissions();
  const navigate = useNavigate();
  const households = useLiveQuery(() => db.households.toArray()) || [];
  const zones = useLiveQuery(() => db.zones.toArray()) || [];

  const [selectedView, setSelectedView] = useState<'overview' | 'missions' | 'teams' | 'reports'>(
    'overview'
  );

  // Vérification des permissions
  const canViewMissions = peut(PERMISSIONS.MISSIONS_READ);
  const canAccessKobo = peut(PERMISSIONS.TERRAIN_TERMINAL);
  const canViewTeams = peut(PERMISSIONS.UI_TEAMS);
  const canViewReports = peut(PERMISSIONS.TERRAIN_READ);
  const canViewAlerts = peut(PERMISSIONS.UI_ALERTS);
  const canViewSync = peut(PERMISSIONS.SYSTEM_SYNC);

  // Calcul des métriques sous-traitant
  const subcontractorMetrics: SubcontractorMetrics = useMemo(() => {
    const total = households.filter((h) => h.assignedTeams?.includes(user?.teamId || '')).length;
    const completed = households.filter(
      (h) => h.assignedTeams?.includes(user?.teamId || '') && h.status === 'Terminé'
    ).length;
    const inProgress = households.filter(
      (h) =>
        h.assignedTeams?.includes(user?.teamId || '') &&
        !['Non encore installée', 'Terminé', 'Inéligible'].includes(h.status ?? '')
    ).length;

    // Simulations des métriques sous-traitant
    const missionsCompletees = completed;
    const qualiteTravaux = 93; // valeur représentative — à brancher sur API
    const delaisRespectes = 91; // valeur représentative — à brancher sur API
    const scorePerformance = (qualiteTravaux + delaisRespectes) / 2;

    const personnelActif = 10; // valeur représentative
    const performanceEquipes = 89; // valeur représentative
    const formationNecessaire = Math.floor(personnelActif * 0.15); // 15% besoin formation
    const tauxPresence = 95; // valeur représentative

    const rapportsSoumis = Math.floor(total * 0.95);
    const validationsClient = Math.floor(rapportsSoumis * 0.9);
    const correctionsRequises = rapportsSoumis - validationsClient;
    const tempsMoyenSoumission = 1.5; // jours

    const tachesAssignees = total;
    const tachesEnCours = inProgress;
    const tachesTerminees = completed;
    const efficaciteMoyenne = scorePerformance;

    return {
      missionsCompletees,
      qualiteTravaux,
      delaisRespectes,
      scorePerformance,
      personnelActif,
      performanceEquipes,
      formationNecessaire,
      tauxPresence,
      rapportsSoumis,
      validationsClient,
      correctionsRequises,
      tempsMoyenSoumission,
      tachesAssignees,
      tachesEnCours,
      tachesTerminees,
      efficaciteMoyenne,
    };
  }, [households, user]);

  // Données des missions
  const missionsData: MissionData[] = useMemo(() => {
    return [
      {
        id: '1',
        titre: 'Installation Zone A - Lot 123',
        zone: 'Zone A',
        statut: 'validee',
        dateDebut: new Date(new Date().setDate(new Date().getDate() - 5)),
        dateFin: new Date(new Date().setDate(new Date().getDate() - 2)),
        equipe: 'Équipe Alpha',
        progression: 100,
        qualite: 95,
        rapportSoumis: true,
      },
      {
        id: '2',
        titre: 'Installation Zone B - Lot 456',
        zone: 'Zone B',
        statut: 'en_cours',
        dateDebut: new Date(new Date().setDate(new Date().getDate() - 3)),
        equipe: 'Équipe Beta',
        progression: 65,
        qualite: 88,
        rapportSoumis: false,
      },
      {
        id: '3',
        titre: 'Installation Zone C - Lot 789',
        zone: 'Zone C',
        statut: 'requiert_correction',
        dateDebut: new Date(new Date().setDate(new Date().getDate() - 7)),
        dateFin: new Date(new Date().setDate(new Date().getDate() - 1)),
        equipe: 'Équipe Gamma',
        progression: 100,
        qualite: 72,
        rapportSoumis: true,
      },
      {
        id: '4',
        titre: 'Installation Zone D - Lot 101',
        zone: 'Zone D',
        statut: 'en_attente',
        dateDebut: new Date(new Date().setDate(new Date().getDate() + 1)),
        equipe: 'Équipe Delta',
        progression: 0,
        qualite: 0,
        rapportSoumis: false,
      },
    ];
  }, []);

  // Données des équipes
  const teamsData: TeamData[] = useMemo(() => {
    return [
      {
        id: '1',
        nom: 'Équipe Alpha',
        membres: 3,
        missionsActives: 2,
        performance: 95,
        presence: 98,
        competences: ['Électricité', 'Sécurité', 'Kobo'],
      },
      {
        id: '2',
        nom: 'Équipe Beta',
        membres: 2,
        missionsActives: 1,
        performance: 88,
        presence: 95,
        competences: ['Électricité', 'Maintenance'],
      },
      {
        id: '3',
        nom: 'Équipe Gamma',
        membres: 3,
        missionsActives: 1,
        performance: 72,
        presence: 92,
        competences: ['Électricité', 'Sécurité'],
      },
      {
        id: '4',
        nom: 'Équipe Delta',
        membres: 2,
        missionsActives: 0,
        performance: 85,
        presence: 96,
        competences: ['Électricité', 'Formation'],
      },
    ];
  }, []);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Composants de navigation
  const ViewSelector = () => (
    <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
      {[
        { id: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
        { id: 'missions', label: 'Missions', icon: Target },
        { id: 'teams', label: 'Équipes', icon: Users },
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
        title="TABLEAU DE BORD SOUS-TRAITANT"
        subtitle="Suivi des missions terrain et performance des équipes"
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
                    <StatusBadge status="info" label="Sous-traitant" />
                    <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-300/55">
                      Opérations terrain et reporting
                    </span>
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">
                    Console d'exécution des missions
                  </h2>
                  <p className="text-[13px] text-slate-400">
                    Suivi des tâches assignées, performance équipes et rapports.
                  </p>
                </div>
                <ViewSelector />
              </div>

              {/* Actions rapides */}
              <div className="grid grid-cols-2 gap-3">
                {canAccessKobo && (
                  <button
                    onClick={() => navigate('/kobo')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <Upload size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">Kobo</p>
                        <p className="mt-1 text-[12px] text-slate-400">Soumettre données</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewMissions && (
                  <button
                    onClick={() => navigate('/missions')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <Target size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Missions
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Voir les tâches</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewTeams && (
                  <button
                    onClick={() => navigate('/equipes')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Équipes
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Gérer le personnel</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewReports && (
                  <button
                    onClick={() => navigate('/rapports/terrain')}
                    className={DASHBOARD_ACTION_TILE_PRIMARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Rapports
                        </p>
                        <p className="mt-1 text-[12px] text-blue-100/90">Soumettre et suivre</p>
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
                      label: 'Missions',
                      value: subcontractorMetrics.missionsCompletees,
                      icon: Target,
                    },
                    {
                      label: 'Qualité',
                      value: `${subcontractorMetrics.qualiteTravaux.toFixed(1)}%`,
                      icon: CheckCircle2,
                    },
                    { label: 'Équipes', value: subcontractorMetrics.personnelActif, icon: Users },
                    {
                      label: 'Performance',
                      value: `${subcontractorMetrics.scorePerformance.toFixed(1)}%`,
                      icon: TrendingUp,
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
              {/* KPIs de performance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
                <KPICard
                  title="MISSIONS TERMINÉES"
                  value={subcontractorMetrics.missionsCompletees}
                  icon={<Target size={22} />}
                  trend={{ value: 8, isUp: true, label: 'CE MOIS' }}
                />
                <KPICard
                  title="QUALITÉ TRAVAUX"
                  value={`${subcontractorMetrics.qualiteTravaux.toFixed(1)}%`}
                  icon={<CheckCircle2 size={22} />}
                  trend={{ value: 2.1, isUp: true, label: 'AMÉLIORATION' }}
                />
                <KPICard
                  title="DÉLAIS RESPECTÉS"
                  value={`${subcontractorMetrics.delaisRespectes.toFixed(1)}%`}
                  icon={<Clock size={22} />}
                  trend={{ value: 1.5, isUp: true, label: 'PROGRÈS' }}
                />
                <KPICard
                  title="TAUX PRÉSENCE"
                  value={`${subcontractorMetrics.tauxPresence.toFixed(1)}%`}
                  icon={<Users size={22} />}
                  trend={{ value: 0.5, isUp: false, label: 'STABLE' }}
                />
              </div>

              {/* Performance et alertes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <Activity size={18} className="text-blue-500" /> Performance Globale
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Score de performance</span>
                      <span className="text-sm font-medium text-white">
                        {subcontractorMetrics.scorePerformance.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Efficacité moyenne</span>
                      <span className="text-sm font-medium text-white">
                        {subcontractorMetrics.efficaciteMoyenne.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Temps moyen soumission</span>
                      <span className="text-sm font-medium text-white">
                        {subcontractorMetrics.tempsMoyenSoumission} jours
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Validations client</span>
                      <span className="text-sm font-medium text-emerald-400">
                        {subcontractorMetrics.validationsClient}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <AlertTriangle size={18} className="text-blue-500" /> Alertes et Actions
                  </h3>
                  <div className="space-y-3">
                    {subcontractorMetrics.correctionsRequises > 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-sm text-amber-400">
                          ⚠️ {subcontractorMetrics.correctionsRequises} corrections requises
                        </p>
                      </div>
                    )}
                    {subcontractorMetrics.formationNecessaire > 0 && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-sm text-blue-400">
                          📚 {subcontractorMetrics.formationNecessaire} personnes en formation
                        </p>
                      </div>
                    )}
                    {subcontractorMetrics.tachesEnCours > 0 && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <p className="text-sm text-emerald-400">
                          🔄 {subcontractorMetrics.tachesEnCours} tâches en cours
                        </p>
                      </div>
                    )}
                    {subcontractorMetrics.correctionsRequises === 0 && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <p className="text-sm text-emerald-400">✅ Aucune action requise</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue missions */}
          {selectedView === 'missions' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <Target size={18} className="text-blue-500" /> Missions Assignées
                </h3>
                <div className="space-y-3">
                  {missionsData.map((mission) => (
                    <div
                      key={mission.id}
                      className={`p-4 rounded-lg border ${
                        mission.statut === 'validee'
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : mission.statut === 'requiert_correction'
                            ? 'bg-red-500/10 border-red-500/20'
                            : mission.statut === 'en_cours'
                              ? 'bg-blue-500/10 border-blue-500/20'
                              : 'bg-slate-500/10 border-slate-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                mission.statut === 'validee'
                                  ? 'bg-emerald-500 text-white'
                                  : mission.statut === 'requiert_correction'
                                    ? 'bg-red-500 text-white'
                                    : mission.statut === 'en_cours'
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-slate-500 text-white'
                              }`}
                            >
                              {mission.statut === 'validee'
                                ? 'Validée'
                                : mission.statut === 'requiert_correction'
                                  ? 'Correction requise'
                                  : mission.statut === 'en_cours'
                                    ? 'En cours'
                                    : 'En attente'}
                            </span>
                            <span className="text-sm font-medium text-white">{mission.titre}</span>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">
                            {mission.zone} • {mission.equipe} •{' '}
                            {mission.dateDebut.toLocaleDateString('fr-FR')}
                          </p>
                          {mission.progression > 0 && (
                            <ProgressBar
                              label="Progression"
                              percentage={mission.progression}
                              status={
                                mission.progression >= 80
                                  ? 'success'
                                  : mission.progression >= 50
                                    ? 'warning'
                                    : 'info'
                              }
                            />
                          )}
                          {mission.qualite > 0 && (
                            <div className="mt-2 flex justify-between text-xs text-slate-400">
                              <span>Qualité: {mission.qualite}%</span>
                              <span>
                                Rapport: {mission.rapportSoumis ? 'Soumis' : 'En attente'}
                              </span>
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

          {/* Vue équipes */}
          {selectedView === 'teams' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <Users size={18} className="text-blue-500" /> Performance des Équipes
                </h3>
                <div className="space-y-4">
                  {teamsData.map((team) => (
                    <div
                      key={team.id}
                      className="p-4 bg-white/[0.02] rounded-lg border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-white">{team.nom}</h4>
                        <span
                          className={`text-sm font-medium ${
                            team.performance >= 90
                              ? 'text-emerald-400'
                              : team.performance >= 80
                                ? 'text-amber-400'
                                : 'text-red-400'
                          }`}
                        >
                          {team.performance}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                        <span>{team.membres} membres</span>
                        <span>{team.missionsActives} missions actives</span>
                        <span>Présence: {team.presence}%</span>
                        <span>Compétences: {team.competences.join(', ')}</span>
                      </div>
                      <ProgressBar
                        label="Performance"
                        percentage={team.performance}
                        status={
                          team.performance >= 90
                            ? 'success'
                            : team.performance >= 80
                              ? 'warning'
                              : 'info'
                        }
                      />
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
                  <FileText size={18} className="text-blue-500" /> Rapports Terrain
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => navigate('/rapports/soumission')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Upload size={20} className="text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Soumettre un rapport</p>
                        <p className="text-xs text-slate-400">Nouveau rapport terrain</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/rapports/historique')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Eye size={20} className="text-emerald-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Historique</p>
                        <p className="text-xs text-slate-400">
                          {subcontractorMetrics.rapportsSoumis} rapports
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/rapports/corrections')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={20} className="text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Corrections</p>
                        <p className="text-xs text-slate-400">
                          {subcontractorMetrics.correctionsRequises} requises
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
                        <p className="text-sm font-medium text-white">Performance</p>
                        <p className="text-xs text-slate-400">KPIs et indicateurs</p>
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
