import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PageContainer, PageHeader, ContentArea, ModulePageShell } from '@components';
import { toast } from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { format, addDays } from 'date-fns';

// Import des composants optimisés
import { 
  PlanningFilters, 
  PlanningStats, 
  PlanningGanttChart 
} from '../components/planning';

// Import des hooks optimisés
import { 
  usePlanningDataOptimized,
  usePlanningErrorBoundary,
  PlanningErrorBoundaryWrapper 
} from '../hooks';

// Import des services
import { 
  buildWorkflowStages, 
  buildPlanningTasks, 
  buildTeamPlannings,
  buildPlanningStats,
  computeTheoreticalNeeds,
  getAvailablePlanningRegions,
  type PlanningTask,
  type TeamPlanning,
  type WorkflowStage,
} from '../services/planningDomainOptimized';

import { 
  type PlanningPhase,
} from '../services/planningAllocation';

// Constants locales
const PHASE_COLORS: Record<PlanningPhase, string> = {
  PREPARATION: '#8b5cf6',
  LIVRAISON: '#06b6d4',
  MACONNERIE: '#f59e0b',
  RESEAU: '#3b82f6',
  INTERIEUR: '#8b5cf6',
  CONTROLE: '#10b981',
  TERMINE: '#059669',
};

const PHASE_LABELS: Record<PlanningPhase, string> = {
  PREPARATION: 'Préparation',
  LIVRAISON: 'Livraison',
  MACONNERIE: 'Maçonnerie',
  RESEAU: 'Réseau',
  INTERIEUR: 'Installation',
  CONTROLE: 'Contrôle',
  TERMINE: 'Terminé',
};

type PhaseFilter = 'ALL' | PlanningPhase;

// Import des types
import type { ProjectConfig } from '../utils/types';

interface PlanningOptimizedPageProps {
  projectId: string;
  projectConfig?: ProjectConfig;
}

const PlanningOptimizedPage: React.FC<PlanningOptimizedPageProps> = ({
  projectId,
  projectConfig,
}) => {
  // Hook de données optimisé
  const {
    households,
    teams,
    isLoading,
    isRefreshing,
    dataSource,
    refresh,
    lastUpdate,
  } = usePlanningDataOptimized(projectId);

  // Hook d'error boundary
  const errorBoundary = usePlanningErrorBoundary({
    component: 'PlanningOptimizedPage',
    maxRetries: 3,
    onError: (error, errorInfo) => {
      console.error('Planning page error:', error, errorInfo);
      toast.error('Une erreur est survenue dans le planning');
    },
  });

  // État des filtres
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('ALL');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedTrade, setSelectedTrade] = useState('ALL');
  const [selectedTeam, setSelectedTeam] = useState('ALL');
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline' | 'kanban' | 'gantt'>('gantt');
  const [ganttDate, setGanttDate] = useState(new Date());

  // Calculs optimisés avec useMemo
  const availableRegions = useMemo(() => 
    getAvailablePlanningRegions(households),
    [households]
  );

  const theoreticalNeeds = useMemo(() => 
    computeTheoreticalNeeds({
      households,
      teams,
      targetMonths: 6,
      selectedRegion,
      productionRates: projectConfig?.productionRates,
    }),
    [households, teams, selectedRegion, projectConfig]
  );

  const workflowStages = useMemo(() => 
    theoreticalNeeds ? buildWorkflowStages({
      households,
      teams,
      projectConfig,
      targetMonths: 6,
      selectedRegion,
    }) : [],
    [households, teams, projectConfig, selectedRegion, theoreticalNeeds]
  );

  const planningTasks = useMemo(() => {
    if (!workflowStages.length) return [];
    
    // Construction des tâches avec allocation optimisée
    return buildPlanningTasks({
      households: households.map(household => ({
        ...household,
        assignedTeamId: household.assignedTeamId || undefined,
      })),
      allocationPlanByHousehold: new Map(), // Sera rempli par l'allocation
    });
  }, [households, workflowStages]);

  const teamPlannings = useMemo(() => 
    buildTeamPlannings(planningTasks, teams),
    [planningTasks, teams]
  );

  const planningStats = useMemo(() => 
    buildPlanningStats(planningTasks, selectedRegion),
    [planningTasks, selectedRegion]
  );

  // Gestionnaires d'événements
  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      toast.success('Données du planning actualisées');
    } catch (error) {
      toast.error('Erreur lors de l\'actualisation');
    }
  }, [refresh]);

  const handlePhaseFilterChange = useCallback((value: string) => {
    setPhaseFilter(value as PhaseFilter);
  }, []);

  const handleRegionChange = useCallback((value: string) => {
    setSelectedRegion(value);
  }, []);

  const handleTradeChange = useCallback((value: string) => {
    setSelectedTrade(value);
  }, []);

  const handleTeamChange = useCallback((value: string) => {
    setSelectedTeam(value);
  }, []);

  const handleGanttDateChange = useCallback((date: Date) => {
    setGanttDate(date);
  }, []);

  const handleTaskClick = useCallback((task: any) => {
    toast.success(`Tâche sélectionnée: ${task.name}`);
    // TODO: Ouvrir le panneau de détails de la tâche
  }, []);

  // Préparation des données pour les composants
  const ganttTasks = useMemo(() => 
    planningTasks.map(task => ({
      id: task.id,
      name: task.householdName,
      startDate: task.startDate || new Date(),
      endDate: task.endDate || addDays(new Date(), task.plannedDuration),
      progress: task.phaseProgress,
      teamName: task.teamName,
      phase: task.phase,
      isDelayed: task.isDelayed,
      isBlocked: task.existingAlerts?.some(alert => alert.type === 'BLOCKED') || false,
      color: PHASE_COLORS[task.phase] || '#6B7280',
    })),
    [planningTasks]
  );

  const statsData = useMemo(() => ({
    totalTasks: planningTasks.length,
    completedTasks: planningTasks.filter(task => task.phaseProgress === 100).length,
    delayedTasks: planningTasks.filter(task => task.isDelayed).length,
    activeTeams: teamPlannings.filter(team => team.status === 'busy').length,
    workingDays: theoreticalNeeds?.workingDays || 0,
    efficiency: planningStats.completed > 0 
      ? Math.round((planningStats.completed / planningStats.total) * 100)
      : 0,
  }), [planningTasks, teamPlannings, theoreticalNeeds, planningStats]);

  // État de chargement
  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader 
          title="Planning Optimisé"
          subtitle="Chargement..."
        />
        <ContentArea>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </ContentArea>
      </PageContainer>
    );
  }

  return (
    <PlanningErrorBoundaryWrapper 
      options={{ 
        component: 'PlanningOptimizedPage',
        maxRetries: 3 
      }}
    >
      <PageContainer>
        <PageHeader 
          title="Planning Optimisé"
          subtitle={`Dernière mise à jour: ${lastUpdate ? format(lastUpdate, 'dd/MM/yyyy HH:mm') : 'Jamais'}`}
          actions={
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>
          }
        />

        <ContentArea>
          <div className="space-y-6">
            {/* Filtres avancés */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <PlanningFilters
                phaseFilter={phaseFilter}
                selectedRegion={selectedRegion}
                selectedTrade={selectedTrade}
                selectedTeam={selectedTeam}
                availableRegions={availableRegions}
                availableTeams={teams}
                onPhaseFilterChange={handlePhaseFilterChange}
                onRegionChange={handleRegionChange}
                onTradeChange={handleTradeChange}
                onTeamChange={handleTeamChange}
                onReset={() => {
                  setPhaseFilter('ALL');
                  setSelectedRegion('ALL');
                  setSelectedTrade('ALL');
                  setSelectedTeam('ALL');
                }}
                isLoading={isRefreshing}
              />
            </motion.div>

            {/* Statistiques en temps réel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <PlanningStats
                totalTasks={statsData.totalTasks}
                completedTasks={statsData.completedTasks}
                delayedTasks={statsData.delayedTasks}
                activeTeams={statsData.activeTeams}
                workingDays={statsData.workingDays}
                efficiency={statsData.efficiency}
                isLoading={isRefreshing}
              />
            </motion.div>

            {/* Diagramme de Gantt */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <PlanningGanttChart
                tasks={ganttTasks}
                currentDate={ganttDate}
                onDateChange={handleGanttDateChange}
                onTaskClick={handleTaskClick}
                isLoading={isRefreshing}
              />
            </motion.div>

            {/* Informations de débogage (en développement) */}
            {process.env.NODE_ENV === 'development' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300"
              >
                <h3 className="font-semibold mb-2">Informations de Débogage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><strong>Source de données:</strong> {dataSource}</p>
                    <p><strong>Ménages:</strong> {households.length}</p>
                    <p><strong>Équipes:</strong> {teams.length}</p>
                    <p><strong>Tâches:</strong> {planningTasks.length}</p>
                  </div>
                  <div>
                    <p><strong>Besoins théoriques:</strong> {theoreticalNeeds ? 'Calculés' : 'Non calculés'}</p>
                    <p><strong>Étapes de workflow:</strong> {workflowStages.length}</p>
                    <p><strong>Plannings d'équipe:</strong> {teamPlannings.length}</p>
                    <p><strong>Statistiques:</strong> {planningStats.total} totales</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </ContentArea>
      </PageContainer>
    </PlanningErrorBoundaryWrapper>
  );
};

export default PlanningOptimizedPage;
