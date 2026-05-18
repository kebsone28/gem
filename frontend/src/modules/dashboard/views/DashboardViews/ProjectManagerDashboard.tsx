import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../../api/client';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../store/db';
import { motion } from 'framer-motion';
import {
   ShieldCheck,
   Users,
   TrendingUp,
   AlertTriangle,
   Activity,
   BarChart3,
   Target,
   Clock,
   CheckCircle2,
   FileText,
   Settings,
   DollarSign,
   Zap,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../../../../components';
import {
   DASHBOARD_ACTION_TILE_PRIMARY,
   DASHBOARD_ACTION_TILE_SECONDARY,
   DASHBOARD_MINI_STAT_CARD,
   DASHBOARD_STICKY_PANEL,
   StatusBadge,
   KPICard,
   ProgressBar,
} from '../../../../components/dashboards/DashboardComponents';
import { useProject } from '../../../../contexts/ProjectContext';
import { SECTOR_PACKS } from '../../../../config/packs/sectorPacks';
import { fmtNum } from '../../../../utils/format';

interface ProjectMetrics {
  overallProgress: number;
  budgetUtilization: number;
  timelineAdherence: number;
  qualityScore: number;
  activeTeams: number;
  atRiskTasks: number;
  monthlyBurnRate: number;
  projectedCompletion: Date;
}

interface TeamCoordinationMetrics {
  teamPerformance: Array<{
    id: string;
    name: string;
    progress: number;
    efficiency: number;
    workload: number;
  }>;
  dependencies: Array<{
    from: string;
    to: string;
    status: 'blocking' | 'warning' | 'ok';
  }>;
  resourceAllocation: Array<{
    teamId: string;
    allocated: number;
    capacity: number;
    utilization: number;
  }>;
}

interface RiskManagementMetrics {
  identifiedRisks: Array<{
    id: string;
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    probability: number;
    impact: number;
    status: 'open' | 'mitigated' | 'accepted';
  }>;
  mitigationPlans: Array<{
    riskId: string;
    plan: string;
    owner: string;
    dueDate: Date;
  }>;
  contingencyReserves: number;
}

const ViewSelector = ({ selectedView, setSelectedView }: { 
  selectedView: 'overview' | 'teams' | 'risks' | 'reports';
  setSelectedView: React.Dispatch<React.SetStateAction<'overview' | 'teams' | 'risks' | 'reports'>>;
}) => (
  <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
    {[
      { id: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
      { id: 'teams', label: 'Équipes', icon: Users },
      { id: 'risks', label: 'Risques', icon: AlertTriangle },
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

export default function ProjectManagerDashboard() {
   const { peut, PERMISSIONS } = usePermissions();
   const navigate = useNavigate();
   const { project } = useProject();
   const households = useLiveQuery(() => db.households.toArray()) || [];
   const teams = useLiveQuery(() => db.teams.toArray()) || [];

   const [selectedView, setSelectedView] = useState<'overview' | 'teams' | 'risks' | 'reports'>(
     'overview'
   );

   // Vérification des permissions
   const canViewTeams = peut(PERMISSIONS.UI_TEAMS);
   const canViewMissions = peut(PERMISSIONS.MISSIONS_READ);
   const canViewFinances = peut(PERMISSIONS.FINANCE_READ);
   const canViewReports = peut(PERMISSIONS.TERRAIN_READ);
   const canManagePlanning = peut(PERMISSIONS.MISSIONS_PLANNING);
   const [realStats, setRealStats] = useState<any>(null);

   // 📡 FETCH REAL ANALYTICS (PHASE 4 ENGINE)
   useEffect(() => {
     if (project?.id) {
       apiClient.get(`/projects/${project.id}/analytics`)
         .then(res => {
           if (res.data?.success) {
             setRealStats(res.data.data.stats);
           }
         })
         .catch(err => console.error('Error fetching real analytics:', err));
     }
   }, [project?.id]);

   // Calcul des métriques de projet
   const projectMetrics: ProjectMetrics = useMemo(() => {
     const total = households.length;
     const completed = households.filter((h) => h.status === 'Terminé' || h.status === 'APPROVED').length;
     
     // Priorité aux stats réelles du serveur si disponibles
     const overallProgress = realStats?.overallProgress ?? (total > 0 ? Math.round((completed / total) * 100) : 0);

     const budgetUtilization = Math.min(85, overallProgress);
     const timelineAdherence = realStats ? realStats.slaScore : (overallProgress >= 70 ? 95 : Math.max(60, overallProgress - 10));
     const qualityScore = realStats?.approvalRate ?? 100;

     const activeTeams = teams.filter((t) => t.status === 'active').length;
     const atRiskTasks = realStats?.activityLevel < 5 ? 10 : 0; // Alerte si peu d'activité
     const monthlyBurnRate = 125000; 

     const projectedCompletion = new Date();
     projectedCompletion.setMonth(projectedCompletion.getMonth() + (100 - overallProgress) / 20);

     return {
       overallProgress,
       budgetUtilization,
       timelineAdherence,
       qualityScore,
       activeTeams,
       atRiskTasks,
       monthlyBurnRate,
       projectedCompletion,
     };
   }, [households, teams, realStats]);

   // Récupération du Pack Sectoriel
   const sectorPack = useMemo(() => {
     const sectorId = project?.config?.sector || 'elec_bt';
     return Object.values(SECTOR_PACKS).find(p => p.id === sectorId) || SECTOR_PACKS.ELECTRICITY_BT;
   }, [project]);

   // Calcul des métriques de coordination d'équipe
   const teamCoordination: TeamCoordinationMetrics = useMemo(() => {
     const teamPerformance = teams.map((team) => {
       const teamHouseholds = households.filter((h) => h.assignedTeams?.includes(team.id));
       const completed = teamHouseholds.filter((h) => h.status === 'Terminé').length;
       const progress =
         teamHouseholds.length > 0 ? Math.round((completed / teamHouseholds.length) * 100) : 0;
       const efficiency = Math.min(100, progress + 10); // +10% déterministe — à brancher sur API
       const workload = teamHouseholds.length;

       return {
         id: team.id,
         name: team.name,
         progress,
         efficiency,
         workload,
       };
     });

     // Simulation des dépendances
     const dependencies = [
       { from: 'team_macons', to: 'team_reseau', status: 'ok' as const },
       { from: 'team_reseau', to: 'team_interieur', status: 'warning' as const },
       { from: 'team_interieur', to: 'team_livraison', status: 'ok' as const },
     ];

     const resourceAllocation = teams.map((team) => {
       const allocated = Math.round(team.capacity * 0.8);
       return {
         teamId: team.id,
         allocated,
         capacity: team.capacity,
         utilization:
           team.capacity > 0 ? Math.min(100, Math.round((allocated / team.capacity) * 100)) : 80,
       };
     });

     return { teamPerformance, dependencies, resourceAllocation };
   }, [teams, households]);

   // Calcul des métriques de gestion des risques
   const riskManagement: RiskManagementMetrics = useMemo(() => {
     const identifiedRisks = [
       {
         id: 'risk_1',
         title: 'Retard livraison matériel',
         severity: 'medium' as const,
         probability: 0.3,
         impact: 0.7,
         status: 'open' as const,
       },
       {
         id: 'risk_2',
         title: "Pénurie d'électriciens qualifiés",
         severity: 'high' as const,
         probability: 0.2,
         impact: 0.8,
         status: 'mitigated' as const,
       },
       {
         id: 'risk_3',
         title: 'Conditions météorologiques défavorables',
         severity: 'low' as const,
         probability: 0.4,
         impact: 0.3,
         status: 'accepted' as const,
       },
     ];

     const mitigationPlans = [
       {
         riskId: 'risk_1',
         plan: 'Diversification fournisseurs + stock de sécurité',
         owner: 'Logistique',
         dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
       },
       {
         riskId: 'risk_2',
         plan: 'Formation accélérée + recrutement',
         owner: 'RH',
         dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
       },
     ];

     const contingencyReserves = 15; // 15% de budget

     return { identifiedRisks, mitigationPlans, contingencyReserves };
   }, []);

   const scrollToSection = (sectionId: string) => {
     document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
   };

   return (
    <PageContainer className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/10 via-blue-600/5 to-transparent pointer-events-none" />

      <PageHeader
        title="GED OS | PILOTAGE OPÉRATIONNEL"
        subtitle="Gestion de Projet & Coordination Multi-Équipes"
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
                    <StatusBadge status="success" label="Chef de projet" />
                    <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-300/55">
                      GED OS — {project?.name || 'Projet Actif'}
                    </span>
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">
                    Console de gestion projet
                  </h2>
                  <p className="text-[13px] text-slate-400">
                    Vue stratégique avec coordination d'équipes et gestion des risques.
                  </p>
                </div>
                <ViewSelector />
              </div>

              {/* Actions rapides */}
              <div className="grid grid-cols-2 gap-3">
                {canManagePlanning && (
                  <button
                    onClick={() => navigate('/planning')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Planning
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Gantt et ressources</p>
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
                        <p className="mt-1 text-[12px] text-slate-400">
                          Composition et performance
                        </p>
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
                        <p className="mt-1 text-[12px] text-slate-400">Suivi et validation</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewReports && (
                  <button
                    onClick={() => navigate('/rapports')}
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
                        <p className="mt-1 text-[12px] text-blue-100/90">Génération et export</p>
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
                      label: 'Progression',
                      value: `${projectMetrics.overallProgress}%`,
                      icon: TrendingUp,
                    },
                    {
                      label: 'Budget utilisé',
                      value: `${projectMetrics.budgetUtilization.toFixed(1)}%`,
                      icon: DollarSign,
                    },
                    { label: 'Équipes actives', value: projectMetrics.activeTeams, icon: Users },
                    {
                      label: 'Tâches à risque',
                      value: projectMetrics.atRiskTasks,
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
              {/* KPIs stratégiques */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
                <KPICard
                  title="PROGRESSION GLOBALE"
                  value={`${projectMetrics.overallProgress}%`}
                  icon={<TrendingUp size={22} />}
                  trend={{ value: 5, isUp: true, label: 'CE MOIS' }}
                />
                <KPICard
                  title="UTILISATION BUDGET"
                  value={`${projectMetrics.budgetUtilization.toFixed(1)}%`}
                  icon={<DollarSign size={22} />}
                  trend={{ value: 2, isUp: false, label: 'OPTIMISATION' }}
                />
                <KPICard
                  title="QUALITÉ MOYENNE"
                  value={`${projectMetrics.qualityScore.toFixed(1)}/100`}
                  icon={<CheckCircle2 size={22} />}
                  trend={{ value: 3, isUp: true, label: 'AMÉLIORATION' }}
                />
                <KPICard
                  title="ADHÉRENCE CALENDRIER"
                  value={`${projectMetrics.timelineAdherence}%`}
                  icon={<Clock size={22} />}
                  trend={{ value: 0, isUp: true, label: 'STABLE' }}
                />
              </div>

              {/* 🧩 KPI MÉTIER (DYNAMIC SECTOR PACK) */}
              <div className="p-6 rounded-[2rem] bg-gradient-to-br from-indigo-600/10 to-purple-600/5 border border-indigo-500/20 shadow-xl">
                <h3 className="text-[11px] font-black mb-6 flex items-center gap-3 text-indigo-400 uppercase tracking-[0.25em]">
                  <Activity size={18} /> Performance Métier : {sectorPack.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {sectorPack.kpis.map((kpi) => (
                    <div key={kpi.id} className="relative p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all group">
                      <div className="absolute top-4 right-4 text-indigo-500/20 group-hover:text-indigo-500/40 transition-colors">
                        <BarChart3 size={24} />
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{kpi.label}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-white">
                          {/* Simulation de valeur basée sur la progression globale */}
                          {Math.round(projectMetrics.overallProgress * (0.8 + Math.random() * 0.4))}
                        </p>
                        <span className="text-xs font-bold text-slate-400 uppercase">{kpi.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI HINTS */}
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="text-[9px] font-black text-indigo-300 uppercase tracking-tighter mr-2 py-1">Optimisation IA disponible :</span>
                  {sectorPack.aiFeatures.map((feature) => (
                    <div key={feature} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                      <Zap size={10} /> {feature}
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance des équipes */}
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <Users size={18} className="text-blue-500" /> Performance des Équipes
                </h3>
                <div className="space-y-3">
                  {teamCoordination.teamPerformance.slice(0, 4).map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <Users size={16} className="text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{team.name}</p>
                          <p className="text-xs text-slate-400">{team.workload} tâches assignées</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-white">{team.progress}%</p>
                        <p className="text-xs text-slate-400">
                          Efficacité: {team.efficiency.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projection et alertes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <Target size={18} className="text-blue-500" /> Projection d'Achèvement
                  </h3>
                  <div className="text-center">
                    <p className="text-3xl font-black text-white">
                      {projectMetrics.projectedCompletion.toLocaleDateString('fr-FR', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">
                      Basé sur le rythme actuel de {projectMetrics.overallProgress}%
                    </p>
                  </div>
                </div>

                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <Zap size={18} className="text-blue-500" /> Taux de Burn Mensuel
                  </h3>
                  <div className="text-center">
                    <p className="text-3xl font-black text-white">
                      {fmtNum(projectMetrics.monthlyBurnRate)} FCFA
                    </p>
                    <p className="text-sm text-slate-400 mt-2">
                      Dépenses opérationnelles mensuelles
                    </p>
                  </div>
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
                  <Activity size={18} className="text-blue-500" /> Coordination des Équipes
                </h3>

                {/* Dépendances */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-white mb-3">Dépendances Inter-Équipes</h4>
                  <div className="space-y-2">
                    {teamCoordination.dependencies.map((dep, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          dep.status === 'blocking'
                            ? 'bg-red-500/10 border-red-500/30'
                            : dep.status === 'warning'
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : 'bg-emerald-500/10 border-emerald-500/30'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full ${
                            dep.status === 'blocking'
                              ? 'bg-red-500'
                              : dep.status === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}
                        />
                        <span className="text-sm text-white">
                          {dep.from} → {dep.to}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            dep.status === 'blocking'
                              ? 'bg-red-500 text-white'
                              : dep.status === 'warning'
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {dep.status === 'blocking'
                            ? 'Bloquant'
                            : dep.status === 'warning'
                              ? 'Attention'
                              : 'OK'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Allocation des ressources */}
                <div>
                  <h4 className="text-sm font-medium text-white mb-3">Allocation des Ressources</h4>
                  <div className="space-y-2">
                    {teamCoordination.resourceAllocation.map((resource) => (
                      <div
                        key={resource.teamId}
                        className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/5"
                      >
                        <div className="flex-1">
                          <p className="text-sm text-white">Équipe {resource.teamId}</p>
                          <p className="text-xs text-slate-400">
                            {resource.allocated} / {resource.capacity} ressources allouées
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-white">{resource.utilization}%</p>
                          <p className="text-xs text-slate-400">utilisation</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue risques */}
          {selectedView === 'risks' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Risques identifiés */}
                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <AlertTriangle size={18} className="text-blue-500" /> Risques Identifiés
                  </h3>
                  <div className="space-y-3">
                    {riskManagement.identifiedRisks.map((risk) => (
                      <div
                        key={risk.id}
                        className={`p-3 rounded-lg border ${
                          risk.severity === 'critical'
                            ? 'bg-red-500/10 border-red-500/30'
                            : risk.severity === 'high'
                              ? 'bg-red-500/10 border-red-500/20'
                              : risk.severity === 'medium'
                                ? 'bg-amber-500/10 border-amber-500/20'
                                : 'bg-blue-500/10 border-blue-500/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">{risk.title}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Probabilité: {(risk.probability * 100).toFixed(0)}% | Impact:{' '}
                              {(risk.impact * 100).toFixed(0)}%
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              risk.status === 'open'
                                ? 'bg-red-500 text-white'
                                : risk.status === 'mitigated'
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-blue-500 text-white'
                            }`}
                          >
                            {risk.status === 'open'
                              ? 'Ouvert'
                              : risk.status === 'mitigated'
                                ? 'Atténué'
                                : 'Accepté'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plans de mitigation */}
                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <Settings size={18} className="text-blue-500" /> Plans de Mitigation
                  </h3>
                  <div className="space-y-3">
                    {riskManagement.mitigationPlans.map((plan) => (
                      <div
                        key={plan.riskId}
                        className="p-3 bg-white/[0.02] rounded-lg border border-white/5"
                      >
                        <p className="text-sm text-white mb-2">{plan.plan}</p>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Responsable: {plan.owner}</span>
                          <span>Échéance: {plan.dueDate.toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Réserve de contingence */}
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <DollarSign size={18} className="text-blue-500" /> Réserve de Contingence
                </h3>
                <div className="text-center">
                  <p className="text-3xl font-black text-white">
                    {riskManagement.contingencyReserves}%
                  </p>
                  <p className="text-sm text-slate-400 mt-2">du budget total alloué aux imprévus</p>
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
                  <FileText size={18} className="text-blue-500" /> Rapports Disponibles
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {canViewReports && (
                    <button
                      onClick={() => navigate('/rapports')}
                      className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-blue-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Rapports Techniques</p>
                          <p className="text-xs text-slate-400">Progression et conformité</p>
                        </div>
                      </div>
                    </button>
                  )}
                  {canViewFinances && (
                    <button
                      onClick={() => navigate('/rapports/financiers')}
                      className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <DollarSign size={20} className="text-emerald-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Rapports Financiers</p>
                          <p className="text-xs text-slate-400">Budget et dépenses</p>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ContentArea>
    </PageContainer>
  );
}
