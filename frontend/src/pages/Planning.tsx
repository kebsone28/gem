import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, Home, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, Wrench, Hammer, Zap,
  Filter, RefreshCw, History, X, ShieldCheck, Download
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';

import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { PageContainer, PageHeader, ContentArea, ModulePageShell } from '@components';
import { DASHBOARD_STICKY_PANEL, MODULE_ACCENTS } from '../components/dashboards/DashboardComponents';
import { missionSageService } from '../services/ai/MissionSageService';
import type { AIResponse, AIState, RegionalSummary } from '../services/ai/MissionSageService';
import { useProject } from '../contexts/ProjectContext';
import { usePlanningData } from '../hooks/usePlanningData';
import { usePlanningAuditHistory } from '../hooks/usePlanningAuditHistory';
import { usePlanningDelayAlerts } from '../hooks/usePlanningDelayAlerts';
import {
  PHASE_COLORS,
  PHASE_LABELS,
  buildPlanningAllocationPlan,
  buildPlanningStats,
  buildPlanningTasks,
  buildRegionalPlanningSummaries,
  buildTeamPlannings,
  buildWorkflowStages,
  computeTheoreticalNeeds,
  filterPlanningTasks,
  filterVisibleTeamPlannings,
  getAvailablePlanningRegions,
  getPlanningWorkDaysPerWeek,
  type PhaseFilter,
  type PlanningTask,
} from '../services/planningDomain';
import {
  isLogisticsPlanningTeam,
  isPreparationPlanningTeam,
  teamMatchesPlanningRegion,
} from '../services/planningAllocation';
import type { AuditLog } from '../utils/types';

type ViewMode = 'calendar' | 'timeline' | 'kanban' | 'gantt';

const GANTT_WINDOW_DAYS = 21;

const REGIONAL_CAPACITY_METRICS = [
  { actualKey: 'livraison', theoreticalKey: 'livraison', label: 'Livraison' },
  { actualKey: 'macons', theoreticalKey: 'macons', label: 'Maçons' },
  { actualKey: 'reseau', theoreticalKey: 'reseau', label: 'Réseau' },
  { actualKey: 'interieur_type1', theoreticalKey: 'interieur', label: 'Installation' },
  { actualKey: 'controle', theoreticalKey: 'controle', label: 'Contrôle' },
] as const;

const TRADE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tous les métiers' },
  { value: 'logistique', label: 'Livraison' },
  { value: 'macons', label: 'Maçonnerie' },
  { value: 'reseau', label: 'Réseau' },
  { value: 'interieur_type1', label: 'Installation' },
  { value: 'controle', label: 'Contrôle' },
] as const;

const GANTT_PHASE_METADATA = [
  {
    stageKey: 'FORMATION' as const,
    phase: undefined,
    label: 'Formation électricien',
    dependencies: [] as Array<'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'>,
    chipClass: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    fillColor: '#f59e0b',
  },
  {
    stageKey: 'LIVRAISON' as const,
    phase: 'LIVRAISON' as const,
    label: 'Livraison matériel',
    dependencies: ['FORMATION'] as Array<'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'>,
    chipClass: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200',
    fillColor: '#06b6d4',
  },
  {
    stageKey: 'MACONNERIE' as const,
    phase: 'MACONNERIE' as const,
    label: 'Travaux maçonnerie',
    dependencies: ['LIVRAISON'] as Array<'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'>,
    chipClass: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    fillColor: '#f59e0b',
  },
  {
    stageKey: 'RESEAU' as const,
    phase: 'RESEAU' as const,
    label: 'Travaux réseau',
    dependencies: ['LIVRAISON'] as Array<'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'>,
    chipClass: 'border-blue-400/20 bg-blue-500/10 text-blue-200',
    fillColor: '#3b82f6',
  },
  {
    stageKey: 'INSTALLATION' as const,
    phase: 'INTERIEUR' as const,
    label: 'Travaux intérieur',
    dependencies: ['FORMATION', 'MACONNERIE', 'RESEAU'] as Array<'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'>,
    chipClass: 'border-violet-400/20 bg-violet-500/10 text-violet-200',
    fillColor: '#8b5cf6',
  },
  {
    stageKey: 'CONTROLE' as const,
    phase: 'CONTROLE' as const,
    label: 'Suivi contrôle et reporting',
    dependencies: ['INSTALLATION'] as Array<'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'>,
    chipClass: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    fillColor: '#10b981',
  },
] as const;

type VisibleStageKey = (typeof GANTT_PHASE_METADATA)[number]['stageKey'];
type VisiblePhase = 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INTERIEUR' | 'CONTROLE';
type DependencyKey = 'FORMATION' | VisibleStageKey;

type StageExecutionPlan = {
  stageKey: DependencyKey;
  phase?: VisiblePhase;
  label: string;
  chipClass: string;
  fillColor: string;
  dependencies: DependencyKey[];
  teamCount: number;
  requiredTeams: number;
  progress: number;
  siteCount: number;
  completedCount: number;
  remainingHouseholds: number;
  projectedWorkingDays: number | null;
  durationDays: number;
  startDay: number;
  endDay: number;
  windowStart: Date;
  windowEnd: Date;
  atRisk: boolean;
  isBlocked: boolean;
  details?: string;
  teamLabel: string;
};

type PlanningMode = 'automatic' | 'manual';

type ManualPlanningOverride = {
  start: string;
  end: string;
  durationDays?: number;
};

type PlanningRow = {
  id: string;
  kind: 'formation' | 'stage';
  label: string;
  teamName: string;
  stageKey: DependencyKey;
  phase?: VisiblePhase;
  chipClass: string;
  fillColor: string;
  status: 'active' | 'inactive' | 'virtual';
  teamCount: number;
  requiredTeams: number;
  progress: number;
  siteCount: number;
  projectedWorkingDays: number | null;
  autoStart: Date;
  autoEnd: Date;
  autoDurationDays: number;
  effectiveStart: Date;
  effectiveEnd: Date;
  effectiveDurationDays: number;
  dependencies: DependencyKey[];
  dependencyLabels: string[];
  teamLabel: string;
  atRisk: boolean;
  isBlocked: boolean;
};

const toDateInputValue = (date: Date) => format(date, 'yyyy-MM-dd');

const fromDateInputValue = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getPlanningRowStatusLabel = (row: Pick<PlanningRow, 'status' | 'atRisk' | 'isBlocked'>) => {
  if (row.isBlocked) return 'Bloqué';
  if (row.atRisk) return 'Sous tension';
  if (row.status === 'virtual') return 'Prévisionnel';
  if (row.status === 'inactive') return 'Inactive';
  return 'Planifié';
};

const getPlanningRowStatusClass = (row: Pick<PlanningRow, 'status' | 'atRisk' | 'isBlocked'>) => {
  if (row.isBlocked) return 'text-rose-400';
  if (row.atRisk) return 'text-amber-400';
  if (row.status === 'virtual') return 'text-cyan-300';
  if (row.status === 'inactive') return 'text-slate-500';
  return 'text-emerald-400';
};

interface PlanningAiSection {
  title: string;
  items: string[];
}

function cleanMissionSageText(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/^"+|"+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitMissionSageItems(value: string): string[] {
  return value
    .split(/\s+(?=(?:\d+\.|-)\s+)/)
    .map((item) => cleanMissionSageText(item).replace(/^[-\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function formatPlanningAiRecommendation(message: string): { lead: string; sections: PlanningAiSection[] } {
  const normalized = message.replace(/\r?\n/g, ' ').trim();
  const headingPattern = /\*\*([^*]+)\*\*/g;
  const matches = Array.from(normalized.matchAll(headingPattern));

  if (matches.length === 0) {
    const lead = cleanMissionSageText(normalized);
    return {
      lead: lead.length > 320 ? `${lead.slice(0, 320).trim()}...` : lead,
      sections: [],
    };
  }

  const firstHeadingIndex = matches[0].index ?? 0;
  const lead = cleanMissionSageText(normalized.slice(0, firstHeadingIndex));
  const sections = matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
      return {
        title: cleanMissionSageText(match[1]),
        items: splitMissionSageItems(normalized.slice(start, end)),
      };
    })
    .filter((section) => section.title && section.items.length > 0)
    .slice(0, 3);

  return {
    lead: lead || 'Synthèse MissionSage pour le planning opérationnel.',
    sections,
  };
}

export default function Planning() {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedTrade, setSelectedTrade] = useState<string>('ALL');
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [targetMonths, setTargetMonths] = useState<number>(6);
  const [includeSaturday, setIncludeSaturday] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [planningMode, setPlanningMode] = useState<PlanningMode>('automatic');
  const [showAudit, setShowAudit] = useState(false);
  const [showManualPlanner, setShowManualPlanner] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [aiRecommendation, setAiRecommendation] = useState<AIResponse | null>(null);

  const { project } = useProject();
  const currentProjectId = project?.id || null;
  const [manualPlanningOverrides, setManualPlanningOverrides] = useState<Record<string, ManualPlanningOverride>>({});
  const { households, teams, isLoading, isRefreshing, dataSource, refresh: refreshPlanningData } =
    usePlanningData(currentProjectId);
  const activeTeams = useMemo(() => teams.filter((team) => team.status === 'active'), [teams]);
  const { historyLogs, isLoadingHistory } = usePlanningAuditHistory(showAudit);
  const planningAccent = MODULE_ACCENTS.planning;
  const formattedAiRecommendation = useMemo(
    () => (aiRecommendation ? formatPlanningAiRecommendation(aiRecommendation.message) : null),
    [aiRecommendation]
  );

  // Export de l'historique vers Excel
  const handleExportHistoryToExcel = useCallback(() => {
    if (historyLogs.length === 0) {
      toast.error("Aucun historique à exporter.");
      return;
    }

    const data = historyLogs.map(log => ({
      "Date": format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr }),
      "Action": log.action,
      "Détails": log.details,
      "Utilisateur": log.userName,
      "Sévérité": log.severity,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historique Planning");
    XLSX.writeFile(wb, `Historique_Planning_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    toast.success("Historique exporté en Excel !");
  }, [historyLogs]);

  // Analyse IA Proactive (déplacée après le calcul des `stats` pour éviter erreur de référence)

  // 🗺️ Récupérer les régions uniques disponibles
  const availableRegions = useMemo(() => {
    return getAvailablePlanningRegions(households);
  }, [households]);

  useEffect(() => {
    if (typeof project?.duration === 'number' && Number.isFinite(project.duration) && project.duration > 0) {
      const timer = setTimeout(() => {
        setTargetMonths(Math.max(1, Math.round(project.duration ?? 0)));
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [project?.id, project?.duration]);

  useEffect(() => {
    if (!currentProjectId || typeof window === 'undefined') {
      setManualPlanningOverrides({});
      return;
    }

    const raw = window.localStorage.getItem(`gem-planning-manual-${currentProjectId}`);
    if (!raw) {
      setManualPlanningOverrides({});
      return;
    }

    try {
      setManualPlanningOverrides(JSON.parse(raw) as Record<string, ManualPlanningOverride>);
    } catch {
      setManualPlanningOverrides({});
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId || typeof window === 'undefined') return;
    window.localStorage.setItem(`gem-planning-manual-${currentProjectId}`, JSON.stringify(manualPlanningOverrides));
  }, [currentProjectId, manualPlanningOverrides]);
  useEffect(() => {
    if (planningMode === 'automatic') {
      setShowManualPlanner(false);
    }
  }, [planningMode]);

  // 1. Calculer les besoins théoriques en équipes
  const theoreticalNeeds = useMemo(() => {
    return computeTheoreticalNeeds({
      households,
      teams: activeTeams,
      targetMonths,
      selectedRegion,
      productionRates: project?.config?.productionRates,
      includeSaturday,
    });
  }, [activeTeams, households, includeSaturday, targetMonths, project?.config?.productionRates, selectedRegion]);

  const workflowStages = useMemo(
    () =>
      buildWorkflowStages({
        households,
        teams: activeTeams,
        projectConfig: project?.config,
        targetMonths,
        selectedRegion,
        includeSaturday,
      }),
    [activeTeams, households, includeSaturday, project?.config, selectedRegion, targetMonths]
  );

  const workflowSummary = useMemo(() => {
    const targetCalendarDays = workflowStages.reduce(
      (sum, stage) => sum + Math.max(stage.calendarDays, 0),
      0
    );
    const projectedCalendarDays = workflowStages.some((stage) => stage.projectedCalendarDays === null)
      ? null
      : workflowStages.reduce((sum, stage) => sum + (stage.projectedCalendarDays || 0), 0);
    const blockedStages = workflowStages.filter((stage) => stage.atRisk).length;
    const completedStages = workflowStages.filter((stage) => stage.progress >= 100).length;

    return {
      targetCalendarDays,
      projectedCalendarDays,
      blockedStages,
      completedStages,
      workDaysPerWeek: getPlanningWorkDaysPerWeek(includeSaturday),
    };
  }, [includeSaturday, workflowStages]);

  const allocationPlanByHousehold = useMemo(() => {
    return buildPlanningAllocationPlan({
      households,
      teams: activeTeams,
      projectConfig: project?.config,
    });
  }, [activeTeams, households, project?.config]);

  // Transformer les données en tâches de planning
  const tasks = useMemo((): PlanningTask[] => {
    return buildPlanningTasks({
      households,
      allocationPlanByHousehold,
    });
  }, [allocationPlanByHousehold, households]);
  usePlanningDelayAlerts(currentProjectId, tasks);

  // Filtrer l'historique pour l'affichage dans le panneau latéral
  const filteredHistoryLogs = useMemo(() => {
    if (!userFilter) return historyLogs;
    const filter = userFilter.toLowerCase();
    return historyLogs.filter(log =>
      (log.userName?.toLowerCase() || '').includes(filter) ||
      (log.details?.toLowerCase() || '').includes(filter) ||
      (log.action?.toLowerCase() || '').includes(filter)
    );
  }, [historyLogs, userFilter]);

  // 🔍 Filtrer les tâches
  const filteredTasks = useMemo(() => {
    return filterPlanningTasks({
      tasks,
      selectedRegion,
      phaseFilter,
      selectedTeam,
      selectedTrade,
    });
  }, [tasks, phaseFilter, selectedTeam, selectedRegion, selectedTrade]);

  const stats = useMemo(() => {
    return buildPlanningStats(filteredTasks, 'ALL');
  }, [filteredTasks]);

  const selectedTradeLabel = useMemo(
    () => TRADE_FILTER_OPTIONS.find((option) => option.value === selectedTrade)?.label || 'Tous les métiers',
    [selectedTrade]
  );
  const selectedTeamLabel = useMemo(
    () => teams.find((team) => team.id === selectedTeam)?.name || 'Toutes équipes',
    [selectedTeam, teams]
  );
  const selectedPhaseLabel = useMemo(() => {
    if (phaseFilter === 'ALL') return 'Toutes phases';
    if (phaseFilter === 'TERMINE') return 'Terminé';
    return PHASE_LABELS[phaseFilter as keyof typeof PHASE_LABELS] || phaseFilter;
  }, [phaseFilter]);
  const hasAdvancedFilters = useMemo(
    () =>
      phaseFilter !== 'ALL' ||
      selectedTeam !== 'ALL' ||
      selectedTrade !== 'ALL' ||
      selectedRegion !== 'ALL',
    [phaseFilter, selectedRegion, selectedTeam, selectedTrade]
  );
  const activeFilterCount = useMemo(
    () =>
      [phaseFilter !== 'ALL', selectedTeam !== 'ALL', selectedTrade !== 'ALL', selectedRegion !== 'ALL'].filter(Boolean)
        .length,
    [phaseFilter, selectedRegion, selectedTeam, selectedTrade]
  );

  const visibleTeamPlannings = useMemo(() => {
    const teamPlannings = buildTeamPlannings(filteredTasks, activeTeams);
    return filterVisibleTeamPlannings(teamPlannings, selectedTrade);
  }, [activeTeams, filteredTasks, selectedTrade]);

  // Analyse IA Proactive
  useEffect(() => {
    const getAiAdvice = async () => {
      if (households.length > 0 && !isLoading && activeTeams.length > 0) {
        const regionalSummaries: RegionalSummary[] = buildRegionalPlanningSummaries({
          availableRegions: availableRegions.filter(
            (region): region is string => typeof region === 'string' && region.length > 0
          ),
          households,
          tasks: filteredTasks,
          teams: activeTeams,
        });
        const advice = await missionSageService.processQuery(
          "Analyse le planning visible et suggère des réaffectations pour les métiers en retard.",
          { role: 'CHEF_PROJET', displayName: 'Coordinateur' },
          {
            stats: stats as unknown as AIState['stats'],
            auditLogs: [] as AuditLog[],
            households,
            teams: activeTeams,
            regionalSummaries,
          }
        );
        setAiRecommendation(advice);
      }
    };
    getAiAdvice();
  }, [activeTeams, availableRegions, filteredTasks, households, isLoading, stats]);

  const ganttWindowStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 1 }),
    [currentDate]
  );
  const ganttWindowEnd = useMemo(
    () => addDays(ganttWindowStart, GANTT_WINDOW_DAYS - 1),
    [ganttWindowStart]
  );
  const ganttDays = useMemo(
    () => eachDayOfInterval({ start: ganttWindowStart, end: ganttWindowEnd }),
    [ganttWindowEnd, ganttWindowStart]
  );
  const planningAnchorDate = useMemo(() => {
    const taskDates = filteredTasks
      .map((task) => task.startDate)
      .filter((date): date is Date => date instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime());

    return taskDates[0] || startOfWeek(currentDate, { weekStartsOn: 1 });
  }, [currentDate, filteredTasks]);
  const stageExecutionPlans = useMemo(() => {
    const workflowStageMap = new Map(workflowStages.map((stage) => [stage.key, stage]));
    const resolved = new Map<DependencyKey, StageExecutionPlan>();
    const buildStagePlan = (stageKey: DependencyKey): StageExecutionPlan | null => {
      if (resolved.has(stageKey)) return resolved.get(stageKey)!;

      const workflowStage = workflowStageMap.get(stageKey);
      if (!workflowStage) return null;

      const visibleMeta = GANTT_PHASE_METADATA.find((meta) => meta.stageKey === stageKey);
      const dependencies = visibleMeta?.dependencies || [];
      const dependencyPlans: StageExecutionPlan[] = dependencies
        .map((dependencyKey) => buildStagePlan(dependencyKey))
        .filter((plan): plan is StageExecutionPlan => plan !== null);
      const durationDays = Math.max(workflowStage.projectedCalendarDays ?? workflowStage.calendarDays ?? 1, 1);
      const startDay: number = dependencyPlans.length > 0 ? Math.max(...dependencyPlans.map((plan) => plan.endDay)) + 1 : 1;
      const endDay = startDay + durationDays - 1;

      const plan: StageExecutionPlan = {
        stageKey,
        phase: visibleMeta?.phase,
        label: visibleMeta?.label || workflowStage.label,
        chipClass: visibleMeta?.chipClass || 'border-white/10 bg-white/5 text-white',
        fillColor: visibleMeta?.fillColor || '#64748b',
        dependencies,
        teamCount: workflowStage.teamCount,
        requiredTeams: workflowStage.requiredTeams,
        progress: workflowStage.progress,
        siteCount: workflowStage.householdsCount,
        completedCount: workflowStage.completedCount,
        remainingHouseholds: workflowStage.remainingHouseholds,
        projectedWorkingDays: workflowStage.projectedWorkingDays,
        durationDays,
        startDay,
        endDay,
        windowStart: addDays(planningAnchorDate, Math.max(startDay - 1, 0)),
        windowEnd: addDays(planningAnchorDate, Math.max(endDay - 1, 0)),
        atRisk: workflowStage.atRisk,
        isBlocked: workflowStage.isBlocked,
        details: workflowStage.details,
        teamLabel: workflowStage.teamLabel,
      };

      resolved.set(stageKey, plan);
      return plan;
    };

    buildStagePlan('FORMATION');

    return GANTT_PHASE_METADATA
      .map((meta) => buildStagePlan(meta.stageKey))
      .filter((plan): plan is NonNullable<typeof plan> => plan !== null);
  }, [planningAnchorDate, workflowStages]);
  const planningRows = useMemo((): PlanningRow[] => {
    const stageMap = new Map(stageExecutionPlans.map((plan) => [plan.stageKey, plan]));
    const dependencyLabelMap = new Map(stageExecutionPlans.map((plan) => [plan.stageKey, plan.label]));
    const stageOrder: DependencyKey[] = ['FORMATION', 'LIVRAISON', 'MACONNERIE', 'RESEAU', 'INSTALLATION', 'CONTROLE'];

    const buildEffectiveDates = (rowId: string, autoStart: Date, autoEnd: Date) => {
      const override = planningMode === 'manual' ? manualPlanningOverrides[rowId] : undefined;
      const manualStart = override?.start ? fromDateInputValue(override.start) : null;
      const manualEnd = override?.end ? fromDateInputValue(override.end) : null;
      const manualDuration = typeof override?.durationDays === 'number' && override.durationDays > 0 ? override.durationDays : null;
      const effectiveStart = manualStart || autoStart;
      const candidateEnd = manualDuration ? addDays(effectiveStart, manualDuration - 1) : manualEnd || autoEnd;
      const effectiveEnd = candidateEnd >= effectiveStart ? candidateEnd : effectiveStart;
      const autoDurationDays = Math.max(differenceInCalendarDays(autoEnd, autoStart) + 1, 1);
      const effectiveDurationDays = Math.max(differenceInCalendarDays(effectiveEnd, effectiveStart) + 1, 1);
      return { effectiveStart, effectiveEnd, autoDurationDays, effectiveDurationDays };
    };

    const rows = stageOrder
      .map((stageKey): PlanningRow | null => {
        const stagePlan = stageMap.get(stageKey);
        if (!stagePlan) return null;

        const { effectiveStart, effectiveEnd, autoDurationDays, effectiveDurationDays } = buildEffectiveDates(
          stageKey,
          stagePlan.windowStart,
          stagePlan.windowEnd
        );
        return {
          id: stageKey,
          kind: stageKey === 'FORMATION' ? 'formation' : 'stage',
          label: stagePlan.label,
          teamName: stagePlan.label,
          stageKey,
          phase: stagePlan.phase,
          chipClass: stagePlan.chipClass,
          fillColor: stagePlan.fillColor,
          status: stagePlan.teamCount > 0 ? 'active' : 'virtual',
          teamCount: stagePlan.teamCount,
          requiredTeams: stagePlan.requiredTeams,
          progress: stagePlan.progress,
          siteCount: stagePlan.siteCount,
          projectedWorkingDays: stagePlan.projectedWorkingDays,
          autoStart: stagePlan.windowStart,
          autoEnd: stagePlan.windowEnd,
          autoDurationDays,
          effectiveStart,
          effectiveEnd,
          effectiveDurationDays,
          dependencies: stagePlan.dependencies,
          dependencyLabels: stagePlan.dependencies.map((dependency) => dependencyLabelMap.get(dependency) ?? dependency),
          teamLabel: stagePlan.teamLabel,
          atRisk: stagePlan.atRisk,
          isBlocked: stagePlan.isBlocked,
        };
      });

    return rows.filter((row): row is PlanningRow => row !== null);
  }, [manualPlanningOverrides, planningMode, stageExecutionPlans]);
  const planningRowMap = useMemo(() => new Map(planningRows.map((row) => [row.id, row])), [planningRows]);
  const latestStageEndMap = useMemo(() => {
    const next = new Map<DependencyKey, Date>();
    planningRows.forEach((row) => {
      const current = next.get(row.stageKey);
      if (!current || row.effectiveEnd > current) {
        next.set(row.stageKey, row.effectiveEnd);
      }
    });
    return next;
  }, [planningRows]);
  const manualOverrideCount = useMemo(() => Object.keys(manualPlanningOverrides).length, [manualPlanningOverrides]);
  const handlePlanningDateChange = useCallback(
    (rowId: string, field: 'start' | 'end', value: string) => {
      setManualPlanningOverrides((current) => {
        const row = planningRowMap.get(rowId);
        const fallbackStart = row?.effectiveStart ?? row?.autoStart ?? new Date();
        const fallbackEnd = row?.effectiveEnd ?? row?.autoEnd ?? fallbackStart;
        const currentOverride = current[rowId];
        const nextStart = field === 'start' ? value : currentOverride?.start || toDateInputValue(fallbackStart);
        const nextEnd = field === 'end' ? value : currentOverride?.end || toDateInputValue(fallbackEnd);
        const parsedStart = fromDateInputValue(nextStart) ?? fallbackStart;
        const parsedEnd = fromDateInputValue(nextEnd) ?? fallbackEnd;
        const normalizedEnd = parsedEnd >= parsedStart ? parsedEnd : parsedStart;
        return {
          ...current,
          [rowId]: {
            start: toDateInputValue(parsedStart),
            end: toDateInputValue(normalizedEnd),
            durationDays: Math.max(differenceInCalendarDays(normalizedEnd, parsedStart) + 1, 1),
          },
        };
      });
    },
    [planningRowMap]
  );
  const handlePlanningDurationChange = useCallback(
    (rowId: string, value: string) => {
      setManualPlanningOverrides((current) => {
        const row = planningRowMap.get(rowId);
        const fallbackStart = row?.effectiveStart ?? row?.autoStart ?? new Date();
        const currentOverride = current[rowId];
        const parsedStart = fromDateInputValue(currentOverride?.start || toDateInputValue(fallbackStart)) ?? fallbackStart;
        const parsedDuration = Number(value);
        const durationDays = Number.isFinite(parsedDuration) && parsedDuration > 0 ? Math.floor(parsedDuration) : 1;
        const endDate = addDays(parsedStart, durationDays - 1);
        return {
          ...current,
          [rowId]: {
            start: toDateInputValue(parsedStart),
            end: toDateInputValue(endDate),
            durationDays,
          },
        };
      });
    },
    [planningRowMap]
  );
  const clearManualPlanningRow = useCallback((rowId: string) => {
    setManualPlanningOverrides((current) => {
      if (!current[rowId]) return current;
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }, []);
  const resetManualPlanning = useCallback(() => {
    setManualPlanningOverrides({});
    setPlanningMode('automatic');
    setShowManualPlanner(false);
  }, []);
  const resetPlanningFilters = useCallback(() => {
    setPhaseFilter('ALL');
    setSelectedTeam('ALL');
    setSelectedTrade('ALL');
    setSelectedRegion('ALL');
    toast.success('Filtres du planning réinitialisés');
  }, []);
  const manualPlannerRows = useMemo(
    () =>
      planningRows.map((row) => {
        const dependencyEnd = row.dependencies.reduce<Date | null>((latest, dependency) => {
          const dependencyDate = latestStageEndMap.get(dependency);
          if (!dependencyDate) return latest;
          return !latest || dependencyDate > latest ? dependencyDate : latest;
        }, null);
        return {
          ...row,
          dependencyEnd,
          hasManualOverride: Boolean(manualPlanningOverrides[row.id]),
        };
      }),
    [latestStageEndMap, manualPlanningOverrides, planningRows]
  );
  const ganttTeamRows = useMemo(
    () =>
      planningRows.map((row) => {
        const startIndex = differenceInCalendarDays(row.effectiveStart, ganttWindowStart);
        const endIndex = differenceInCalendarDays(row.effectiveEnd, ganttWindowStart);
        const clampedStart = Math.max(0, startIndex);
        const clampedEnd = Math.min(ganttDays.length - 1, endIndex);
        const visibleSpanDays = clampedEnd >= clampedStart ? clampedEnd - clampedStart + 1 : 0;

        return {
          ...row,
          firstActiveIndex: clampedStart,
          lastActiveIndex: clampedEnd,
          visibleSpanDays,
          isVisibleOnWindow: endIndex >= 0 && startIndex <= ganttDays.length - 1,
        };
      }),
    [ganttDays.length, ganttWindowStart, planningRows]
  );
  const ganttSummary = useMemo(
    () => ({
      sites: stageExecutionPlans.length > 0 ? Math.max(...stageExecutionPlans.map((plan) => plan.siteCount)) : 0,
      delayed: planningRows.filter((row) => row.atRisk).length,
      activeTeams: activeTeams.length,
      trades: planningRows.length,
    }),
    [activeTeams.length, planningRows, stageExecutionPlans]
  );

  const handleExportGanttToWord = useCallback(async () => {
    if (planningRows.length === 0) {
      toast.error('Aucune ligne de planning à exporter.');
      return;
    }

    const rows = planningRows.map((row) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: row.teamName })],
          }),
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: row.label })],
          }),
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: `${row.teamCount}/${row.requiredTeams}` })],
          }),
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                text:
                  row.effectiveStart && row.effectiveEnd
                    ? `${format(row.effectiveStart, 'dd/MM/yyyy', { locale: fr })} → ${format(row.effectiveEnd, 'dd/MM/yyyy', {
                        locale: fr,
                      })}`
                    : '-',
              }),
            ],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                text: row.kind === 'formation' ? 'Stage' : row.status === 'virtual' ? 'Prévisionnel' : row.status === 'inactive' ? 'Inactive' : 'Active',
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: row.isBlocked ? 'Bloqué' : row.atRisk ? 'Sous tension' : `${row.progress}%` })],
          }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'Planning Gantt par métier',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: `${project?.name || 'Projet actif'} · Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`,
                  italics: true,
                }),
              ],
            }),
            new Paragraph({
              spacing: { before: 180, after: 80 },
              children: [
                new TextRun({ text: 'Période visible : ', bold: true }),
                new TextRun(
                  `${format(ganttWindowStart, 'dd MMM yyyy', { locale: fr })} → ${format(ganttWindowEnd, 'dd MMM yyyy', { locale: fr })}`
                ),
              ],
            }),
            new Paragraph({
              spacing: { after: 180 },
              children: [
                new TextRun({ text: 'Filtres : ', bold: true }),
                new TextRun(
                  `Région ${selectedRegion === 'ALL' ? 'Toutes' : selectedRegion} · Mode ${planningMode === 'manual' ? 'Manuel' : 'Automatique'}`
                ),
              ],
            }),
            new Paragraph({
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({ text: 'Synthèse visible : ', bold: true }),
                new TextRun(
                  `${ganttSummary.trades} corps métier · ${ganttSummary.sites} sites · ${ganttSummary.activeTeams} équipes actives · ${ganttSummary.delayed} métier(s) sous tension`
                ),
              ],
            }),
            ...planningRows.flatMap((row) => [
              new Paragraph({
                text: `${row.teamName} · ${row.label} · ${format(row.effectiveStart, 'dd/MM/yyyy', { locale: fr })} → ${format(row.effectiveEnd, 'dd/MM/yyyy', { locale: fr })}`,
                heading: HeadingLevel.HEADING_2,
              }),
            ]),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    'Équipe',
                    'Étape',
                    'Capacité',
                    'Fenêtre active',
                    'Mode',
                    'Progression',
                  ].map(
                    (label) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: label, bold: true })],
                          }),
                        ],
                      })
                  ),
                }),
                ...rows,
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `PLANNING_GANTT_${format(new Date(), 'yyyyMMdd_HHmm')}.docx`);
  }, [
    planningMode,
    planningRows,
    ganttSummary.delayed,
    ganttSummary.activeTeams,
    ganttSummary.sites,
    ganttSummary.trades,
    ganttWindowEnd,
    ganttWindowStart,
    project?.name,
    selectedRegion,
  ]);

  // ✍️ Gestion des affectations manuelles
  const handleRefresh = useCallback(async () => {
    await refreshPlanningData();
    toast.success('Planning actualisé');
  }, [refreshPlanningData]);

  return (
    <PageContainer>
      <PageHeader
        title="Planning des Travaux"
        subtitle="Coordination par equipe, zone et phase"
        icon={Calendar}
        accent="planning"
        actions={
          <button
            onClick={() => setShowAudit(true)}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all active:scale-95 sm:w-auto ${planningAccent.badge} hover:bg-white/[0.08]`}
          >
            <History size={16} /> Historique
          </button>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">Chargement du planning...</span>
        </div>
      )}

      {!isLoading && (
        <ModulePageShell accent="planning" className="p-4 sm:p-6">
        <ContentArea className="bg-transparent border-none shadow-none p-0">
          {/* ── MOTEUR D'ORCHESTRATION DYNAMIQUE ── */}
          <div className={`relative mb-4 rounded-3xl border p-3 sm:mb-5 sm:p-4 lg:p-5 ${planningAccent.surface}`}>
            <div className="absolute top-0 right-0 hidden sm:block p-5 opacity-5">
              <Zap size={72} className="text-indigo-400" />
            </div>

            <div className="relative z-10 grid gap-3 lg:gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.15fr)_auto] xl:items-center">
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-semibold text-white">Objectif de realisation</h3>
                <p className="text-[11px] sm:text-xs text-indigo-200/70">Calcul dynamique des ressources necessaires par zone.</p>
              </div>

              <div className="grid w-full grid-cols-1 gap-2 rounded-2xl border border-white/5 bg-slate-950/50 p-3 sm:grid-cols-[auto,1fr,auto,auto] sm:items-center sm:gap-3 xl:min-w-[31rem]">
                <span className="text-[10px] font-semibold text-slate-400 sm:ml-2">Region</span>
                <select
                  value={selectedRegion} // selectedRegion est déjà 'ALL' par défaut
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="min-h-10 min-w-0 rounded-xl border border-indigo-500/20 bg-indigo-500/15 px-3 py-2 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  title="Sélectionner la région pour le calcul"
                >
                  <option value="ALL">Toutes les régions</option>
                  {availableRegions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                <span className="text-[10px] font-semibold text-slate-400 sm:ml-2">Duree cible</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={targetMonths}
                    onChange={(e) => setTargetMonths(Math.max(1, Number(e.target.value)))} // Minimum 1 mois
                    title="Durée cible en mois"
                    className="h-10 w-16 rounded-xl border border-indigo-500/20 bg-indigo-500/15 px-3 py-2 text-center font-semibold text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-indigo-300 sm:mr-2">mois</span>
                </div>
              </div>

              <label className="flex min-h-10 w-full items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/50 px-3.5 py-2.5 text-sm text-slate-200 xl:w-auto xl:max-w-[18rem]">
                <input
                  type="checkbox"
                  checked={includeSaturday}
                  onChange={(event) => setIncludeSaturday(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-indigo-500"
                />
                <span className="leading-tight">Inclure le samedi dans le calcul</span>
              </label>
            </div>

            {theoreticalNeeds && (
              <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-5 sm:gap-3">
                {[
                  {
                    label: 'Équipes Livraison',
                    value: theoreticalNeeds.livraison,
                    rate: theoreticalNeeds.effectiveRates.livraison,
                    icon: Users,
                    color: 'text-cyan-400',
                  },
                  {
                    label: 'Équipes Maçons',
                    value: theoreticalNeeds.macons,
                    rate: theoreticalNeeds.effectiveRates.macons,
                    icon: Hammer,
                    color: 'text-amber-500',
                  },
                  {
                    label: 'Équipes Réseau',
                    value: theoreticalNeeds.reseau,
                    rate: theoreticalNeeds.effectiveRates.reseau,
                    icon: Zap,
                    color: 'text-blue-500',
                  },
                  {
                    label: 'Équipes Installation',
                    value: theoreticalNeeds.interieur,
                    rate: theoreticalNeeds.effectiveRates.interieur,
                    icon: Wrench,
                    color: 'text-purple-500',
                  },
                  {
                    label: 'Contrôleurs',
                    value: theoreticalNeeds.controle,
                    rate: theoreticalNeeds.effectiveRates.controle,
                    icon: ShieldCheck,
                    color: 'text-emerald-500',
                  }
                ].map((need, idx) => (
                  <div key={idx} className="bg-slate-950/45 p-3 sm:p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white/5 ${need.color}`}><need.icon size={16} /></div>
                    <div>
                      <p className="text-[11px] font-medium text-slate-400">{need.label}</p>
                      <p className="text-lg sm:text-xl font-semibold text-white leading-none">{need.value}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{need.rate.toFixed(1)} ménages/équipe/j</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {workflowStages.length > 0 && (
            <div className="mb-4 rounded-3xl border border-white/5 bg-slate-900/50 p-4 sm:mb-6 sm:p-6">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Workflow synchronisé des travaux</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Formation, livraison, maçonnerie, réseau, installation et contrôle sont recalés sur les
                    ménages, les équipes actives, la durée projet, le rythme ouvré et la capacité réelle
                    configurée sur chaque équipe.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {[
                    { label: 'Jours/semaine', value: workflowSummary.workDaysPerWeek },
                    { label: 'Durée projet', value: `${targetMonths} mois` },
                    { label: 'Horizon cible', value: `${workflowSummary.targetCalendarDays} j` },
                    {
                      label: 'Horizon projeté',
                      value:
                        workflowSummary.projectedCalendarDays === null
                          ? 'Bloqué'
                          : `${workflowSummary.projectedCalendarDays} j`,
                    },
                    { label: 'Étapes à risque', value: workflowSummary.blockedStages },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3">
                      <div className="text-[11px] font-medium text-slate-500">{item.label}</div>
                      <div className="mt-1 text-lg font-semibold text-white">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {workflowStages.map((stage) => (
                  <div
                    key={stage.key}
                    className={`rounded-2xl border px-4 py-4 ${
                      stage.atRisk ? 'border-rose-500/20 bg-rose-950/10' : 'border-white/5 bg-slate-950/30'
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-white">{stage.label}</h4>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                              stage.atRisk
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {stage.atRisk ? 'Capacité insuffisante' : 'Capacité alignée'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          {stage.teamLabel}: {stage.teamCount} active(s) / {stage.requiredTeams} requise(s)
                          {stage.details ? ` · ${stage.details}` : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Capacité/jour</div>
                          <div className="text-sm font-semibold text-white">{stage.dailyCapacity || 0}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Cadence / équipe</div>
                          <div className="text-sm font-semibold text-white">{stage.ratePerTeam}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Progression</div>
                          <div className="text-sm font-semibold text-white">{stage.progress}%</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Durée cible</div>
                          <div className="text-sm font-semibold text-white">{stage.workingDays} j</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Horizon projeté</div>
                          <div className="text-sm font-semibold text-white">
                            {stage.projectedWorkingDays === null ? 'Bloqué' : `${stage.projectedWorkingDays} j`}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Couverture projet</div>
                          <div className="text-sm font-semibold text-white">
                            {stage.key === 'FORMATION'
                              ? `${stage.teamCount}/${stage.requiredTeams} équipes`
                              : `${stage.projectCapacity}/${stage.householdsCount}`}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Fenêtre cible</div>
                          <div className="text-sm font-semibold text-white">
                            J{stage.startDay} → J{stage.endDay}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          {stage.completedCount}/{stage.key === 'FORMATION' ? Math.max(stage.requiredTeams, 1) : stage.householdsCount}{' '}
                          {stage.progressLabel}
                        </span>
                        <span className="font-medium text-white">{stage.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            stage.atRisk ? 'bg-rose-500' : 'bg-cyan-500'
                          }`}
                          style={{ width: `${Math.min(stage.progress, 100)}%` }}
                        />
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        Reste {stage.remainingHouseholds}{' '}
                        {stage.key === 'FORMATION' ? 'équipe(s) à rendre opérationnelle(s)' : 'ménage(s) à traiter'}.
                        {stage.projectedWorkingDays === null
                          ? ' Aucune équipe active sur cette étape.'
                          : ` Au rythme actuel, cette étape demande ${stage.projectedWorkingDays} jour(s) ouvrés.`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BARRE D'OUTILS ── */}
          <div className={`${DASHBOARD_STICKY_PANEL} mb-4 rounded-2xl p-3`}>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Filtre Phase */}
              <div className="flex min-h-11 items-center gap-2 bg-slate-900/60 rounded-xl px-3 py-2 border border-white/5">
                <Filter size={14} className="text-slate-500" />
                <select
                  value={phaseFilter}
                  onChange={(e) => setPhaseFilter(e.target.value as PhaseFilter)}
                  className="bg-transparent text-sm font-medium text-slate-300 outline-none py-1 min-w-0"
                  title="Filtrer par phase"
                >
                  <option value="ALL">Toutes phases</option>
                  <option value="LIVRAISON">Livraison</option>
                  <option value="MACONNERIE">Maçonnerie</option>
                  <option value="RESEAU">Réseau</option>
                  <option value="INTERIEUR">Installation</option>
                  <option value="CONTROLE">Contrôle</option>
                  <option value="TERMINE">Terminé</option>
                </select>
              </div>

              {/* Filtre Équipe */}
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="min-h-11 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 outline-none w-full sm:w-auto"
                title="Filtrer par équipe"
              >
                <option value="ALL">Toutes équipes</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>

              <select
                value={selectedTrade}
                onChange={(e) => setSelectedTrade(e.target.value)}
                className="min-h-11 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 outline-none w-full sm:w-auto"
                title="Filtrer par métier"
              >
                {TRADE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-stretch sm:items-center gap-2 w-full xl:w-auto xl:justify-end">
              {/* Mode de vue */}
              <div className="grid min-w-0 flex-1 grid-cols-4 bg-slate-900/60 rounded-xl p-1 sm:flex-none sm:w-auto">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-2 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Chronologie
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-2 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Calendrier
                </button>
                <button
                  onClick={() => setViewMode('gantt')}
                  className={`px-2 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${viewMode === 'gantt' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Gantt
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-2 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${viewMode === 'kanban' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Flux
                </button>
              </div>

              <div className="grid grid-cols-2 rounded-xl border border-white/8 bg-slate-950/40 p-1">
                <button
                  onClick={() => setPlanningMode('automatic')}
                  className={`px-3 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all ${
                    planningMode === 'automatic' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Auto
                </button>
                <button
                  onClick={() => setPlanningMode('manual')}
                  className={`px-3 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all ${
                    planningMode === 'manual' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Manuel
                </button>
              </div>

              <button
                onClick={() => {
                  setPlanningMode('manual');
                  setShowManualPlanner(true);
                }}
                className="min-h-11 shrink-0 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 text-amber-200 transition-colors hover:bg-amber-500/20"
                title="Ouvrir les réglages manuels du planning"
              >
                Réglages{manualOverrideCount > 0 ? ` (${manualOverrideCount})` : ''}
              </button>

              <div
                className={`min-h-11 shrink-0 whitespace-nowrap px-3 rounded-xl border text-xs font-semibold flex items-center justify-center ${
                  dataSource === 'server'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : dataSource === 'local'
                      ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                      : 'border-slate-700 bg-slate-900/60 text-slate-400'
                }`}
                title="Source de données du planning"
              >
                {dataSource === 'server'
                  ? 'Source: Serveur'
                  : dataSource === 'local'
                    ? 'Source: Cache local'
                    : 'Source: Aucune donnée'}
              </div>

              <button
                onClick={handleRefresh}
                className="min-h-11 shrink-0 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all flex items-center justify-center gap-2"
                title="Actualiser"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                <span className="text-sm font-medium">Actualiser</span>
              </button>

              {viewMode === 'gantt' && (
                <button
                  onClick={handleExportGanttToWord}
                  className="min-h-11 shrink-0 px-4 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/20 rounded-xl text-blue-200 transition-all flex items-center justify-center gap-2"
                  title="Exporter le Gantt visible en Word"
                >
                  <Download size={16} />
                  <span className="text-sm font-medium">Word</span>
                </button>
              )}
              {planningMode === 'manual' && (
                <button
                  onClick={resetManualPlanning}
                  className="min-h-11 shrink-0 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 text-amber-200 transition-colors hover:bg-amber-500/20"
                  title="Revenir au planning automatique"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

            <div className="mt-3 flex flex-col gap-3 border-t border-white/5 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/8 bg-slate-950/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {filteredTasks.length} tâches visibles
                </span>
                <span className="rounded-full border border-white/8 bg-slate-950/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {planningRows.length} lignes de pilotage
                </span>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">
                  {selectedRegion === 'ALL' ? 'Toutes régions' : selectedRegion}
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                  {selectedPhaseLabel}
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                  {selectedTradeLabel}
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                  {selectedTeamLabel}
                </span>
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-200">
                  {targetMonths} mois
                </span>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                  includeSaturday
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-700 bg-slate-950/40 text-slate-400'
                }`}>
                  {includeSaturday ? 'Samedi inclus' : 'Lun-Ven'}
                </span>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                  planningMode === 'manual'
                    ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                    : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200'
                }`}>
                  {planningMode === 'manual' ? 'Mode manuel' : 'Mode auto'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  {hasAdvancedFilters
                    ? `${activeFilterCount} filtre(s) actif(s) sur le périmètre affiché.`
                    : 'Aucun filtre restrictif actif. Vue complète du planning visible.'}
                </p>

                {hasAdvancedFilters && (
                  <button
                    onClick={resetPlanningFilters}
                    className="rounded-xl border border-white/8 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                    title="Réinitialiser les filtres de région, phase, équipe et métier"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── CONSEILLER IA (MISSION SAGE) ── */}
          {aiRecommendation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="rounded-xl bg-blue-500 p-2 text-white">
                  <Zap size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="text-xs font-semibold text-blue-300">Conseil intelligent</h4>
                    <span className="text-[11px] font-mono text-blue-400/60">MissionSage v8.0</span>
                  </div>

                  <p className="max-w-5xl text-sm leading-relaxed text-slate-100">
                    {formattedAiRecommendation?.lead}
                  </p>

                  {formattedAiRecommendation && formattedAiRecommendation.sections.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                      {formattedAiRecommendation.sections.map((section) => (
                        <div
                          key={section.title}
                          className="rounded-xl border border-blue-400/10 bg-slate-950/25 p-3"
                        >
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
                            {section.title}
                          </p>
                          <ul className="mt-2 space-y-2">
                            {section.items.map((item) => (
                              <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiRecommendation.actionLabel && (
                    <button className="mt-3 text-xs font-medium text-blue-300 hover:underline">
                      {aiRecommendation.actionLabel} →
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STATISTIQUES ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Home size={14} className="text-blue-400" />
                <span className="text-[11px] font-medium text-slate-400">Total</span>
              </div>
              <span className="text-xl sm:text-2xl font-semibold text-white">{stats.total}</span>
            </div>

            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-[11px] font-medium text-slate-400">Termines</span>
              </div>
              <span className="text-xl sm:text-2xl font-semibold text-emerald-400">{stats.completed}</span>
            </div>

            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-rose-400" />
                <span className="text-[11px] font-medium text-slate-400">En retard</span>
              </div>
              <span className="text-xl sm:text-2xl font-semibold text-rose-400">{stats.delayed}</span>
            </div>

            {Object.entries(stats.byPhase).map(([phase, count]) => {
              const phaseKey = phase as keyof typeof PHASE_COLORS;
              const color = PHASE_COLORS[phaseKey] || 'bg-slate-500';
              return (
                <div key={phase} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-[11px] font-medium text-slate-400">
                      {PHASE_LABELS[phase as keyof typeof PHASE_LABELS] || phase}
                    </span>
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{count}</span>
                </div>
              );
            })}
          </div>

          {/* ── GRAPHIQUE COMPARATIF BESOINS THÉORIQUES VS RÉELLEMENT AFFECTÉS PAR RÉGION ── */}
          <div className="mt-4 overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.92))] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:mt-8 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/70">Capacité régionale</div>
              <h3 className="mt-2 text-lg sm:text-xl font-semibold text-white">
                Comparatif Capacités Régionales
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Lecture besoin vs affecté par région et par métier opérationnel.
              </p>
            </div>
            <div className="space-y-4 sm:space-y-8">
              {availableRegions.map(region => {
                const householdsInRegion = households.filter(h => h.region === region);
                const totalHouseholdsInRegion = householdsInRegion.length;

                // Recalculer les besoins théoriques pour cette région
                const regionalTheoreticalNeeds = computeTheoreticalNeeds({
                  households,
                  teams: activeTeams,
                  targetMonths,
                  selectedRegion: region || 'ALL',
                  productionRates: project?.config?.productionRates,
                  includeSaturday,
                });

                // Compter les équipes réellement affectées à cette région
                const regionalActualTeams: { [tradeKey: string]: number } = {
                  livraison: 0, macons: 0, reseau: 0, interieur_type1: 0, controle: 0,
                };
                activeTeams.filter((team) => teamMatchesPlanningRegion(team, region)).forEach(team => {
                  if (isLogisticsPlanningTeam(team) || isPreparationPlanningTeam(team)) {
                    regionalActualTeams.livraison += 1;
                  }
                  if (team.tradeKey) {
                    regionalActualTeams[team.tradeKey] = (regionalActualTeams[team.tradeKey] || 0) + 1;
                  }
                });

                if (!regionalTheoreticalNeeds && totalHouseholdsInRegion === 0) return null;

                return (
                  <div key={region} className="rounded-[24px] border border-white/6 bg-slate-950/34 p-4 shadow-[0_12px_32px_rgba(2,6,23,0.16)]">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Région active</div>
                        <h4 className="mt-1 text-sm font-semibold text-white">{region}</h4>
                        <p className="mt-1 text-xs text-slate-400">{totalHouseholdsInRegion} ménage(s) suivis</p>
                      </div>
                      {regionalTheoreticalNeeds && (
                        <span className="inline-flex w-fit items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-300">
                          Fenêtre cible: {targetMonths} mois / {regionalTheoreticalNeeds.workingDays} jours ouvrés
                          {includeSaturday ? ' (samedi inclus)' : ''}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 sm:gap-4">
                      {REGIONAL_CAPACITY_METRICS.map(({ actualKey, theoreticalKey, label }) => {
                        const theoreticalCount = regionalTheoreticalNeeds?.[theoreticalKey] || 0;
                        const actualCount = regionalActualTeams[actualKey] || 0;
                        const diff = actualCount - theoreticalCount;
                        const isOver = diff > 0;
                        if (theoreticalCount === 0 && actualCount === 0) return null;

                        return (
                          <div key={actualKey} className="rounded-[20px] border border-white/5 bg-white/[0.03] px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Métier</div>
                                <span className="mt-1 block text-sm font-medium text-slate-200">{label}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">Affectation</div>
                                <div className="mt-1 text-sm font-semibold text-white">{actualCount}/{theoreticalCount}</div>
                              </div>
                            </div>
                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className={`h-full rounded-full ${isOver ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    theoreticalCount > 0 ? (actualCount / theoreticalCount) * 100 : actualCount > 0 ? 100 : 0
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              <span>{theoreticalCount} besoin</span>
                              <span>•</span>
                              <span>{actualCount} affecté</span>
                              {diff !== 0 && (
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${isOver ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── VUE PRINCIPALE ── */}
          <AnimatePresence mode="wait">
            {viewMode === 'timeline' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.92))] shadow-[0_24px_80px_rgba(2,6,23,0.38)]"
              >
                <div className="border-b border-white/5 px-5 py-5 sm:px-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-300/70">Lecture séquencée</div>
                  <h3 className="mt-2 text-lg sm:text-xl font-semibold text-white">Chronologie métier</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Une ligne par corps métier avec dates de démarrage et de fin, de la formation jusqu'au reporting.
                  </p>
                </div>
                <div className="grid gap-3 p-4 sm:p-5 md:hidden">
                  {planningRows.map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-[24px] border p-4 shadow-[0_12px_32px_rgba(2,6,23,0.18)] ${row.atRisk ? 'border-rose-500/25 bg-rose-950/10' : 'border-white/6 bg-slate-950/34'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            {row.kind === 'formation' ? 'Démarrage' : 'Corps métier'}
                          </p>
                          <h4 className="text-sm font-semibold text-white">{row.teamName}</h4>
                          <p className="mt-1 text-xs text-slate-400">{row.label}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${row.chipClass}`}>
                          {row.phase ? PHASE_LABELS[row.phase] : row.label}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Début</div>
                          <div className="font-semibold text-white">{format(row.effectiveStart, 'dd MMM yyyy', { locale: fr })}</div>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Fin</div>
                          <div className="font-semibold text-white">{format(row.effectiveEnd, 'dd MMM yyyy', { locale: fr })}</div>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Capacité</div>
                          <div className="font-semibold text-white">{row.teamCount}/{row.requiredTeams} équipes</div>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Durée</div>
                          <div className="font-semibold text-white">{row.effectiveDurationDays} jour(s)</div>
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(row.progress, 100)}%`, backgroundColor: row.fillColor }} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>{row.siteCount} site(s)</span>
                        <span>•</span>
                        <span>{row.kind === 'formation' ? 'phase initiale' : row.teamLabel}</span>
                        <span>•</span>
                        <span>{planningMode === 'manual' && manualPlanningOverrides[row.id] ? 'réglage manuel actif' : 'mode automatique'}</span>
                      </div>
                      {row.dependencyLabels.length > 0 && (
                        <div className="mt-2 text-[11px] text-slate-500">
                          Dépend de: {row.dependencyLabels.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[980px]">
                    <thead className="bg-slate-950/46">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Corps métier</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Étape</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Début</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Fin</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Capacité</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Mode</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Avancement</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {planningRows.map((row) => (
                        <tr key={row.id} className={`transition-colors hover:bg-white/[0.04] ${row.atRisk ? 'bg-rose-900/10' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: row.fillColor }} />
                              <span className="text-xs font-bold text-white">{row.teamName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-300">{row.label}</td>
                          <td className="px-4 py-3 text-xs text-slate-300">{format(row.effectiveStart, 'dd/MM/yyyy', { locale: fr })}</td>
                          <td className="px-4 py-3 text-xs text-slate-300">{format(row.effectiveEnd, 'dd/MM/yyyy', { locale: fr })}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-white">{row.teamCount}/{row.requiredTeams}</td>
                          <td className="px-4 py-3 text-xs text-slate-300">
                            {planningMode === 'manual' && manualPlanningOverrides[row.id] ? 'Manuel' : 'Auto'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(row.progress, 100)}%`, backgroundColor: row.fillColor }} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">{row.progress}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold ${getPlanningRowStatusClass(row)}`}>
                              {getPlanningRowStatusLabel(row)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {viewMode === 'gantt' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.92))] shadow-[0_24px_80px_rgba(2,6,23,0.38)]"
              >
                <div className="flex flex-col gap-4 border-b border-white/5 px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/70">Fenêtre opérationnelle</div>
                      <h3 className="mt-2 text-lg sm:text-xl font-semibold text-white">Gantt métier des travaux</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Formation en premier, puis une ligne par corps métier avec des dates automatiques ou manuelles.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setCurrentDate(addDays(currentDate, -7))}
                        className="min-h-11 min-w-11 rounded-xl bg-slate-950/50 px-3 text-slate-300 transition-colors hover:bg-slate-800"
                        title="Période précédente"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-200">
                        {format(ganttWindowStart, 'dd MMM', { locale: fr })} → {format(ganttWindowEnd, 'dd MMM yyyy', { locale: fr })}
                      </div>
                      <button
                        onClick={() => setCurrentDate(addDays(currentDate, 7))}
                        className="min-h-11 min-w-11 rounded-xl bg-slate-950/50 px-3 text-slate-300 transition-colors hover:bg-slate-800"
                        title="Période suivante"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-[22px] border border-white/6 bg-slate-950/34 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Étapes visibles</div>
                      <div className="mt-2 text-xl font-semibold text-white">{ganttSummary.trades}</div>
                    </div>
                    <div className="rounded-[22px] border border-white/6 bg-slate-950/34 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Sites visibles</div>
                      <div className="mt-2 text-xl font-semibold text-white">{ganttSummary.sites}</div>
                    </div>
                    <div className="rounded-[22px] border border-white/6 bg-slate-950/34 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Équipes actives</div>
                      <div className="mt-2 text-xl font-semibold text-white">{ganttSummary.activeTeams}</div>
                    </div>
                    <div className="rounded-[22px] border border-rose-500/16 bg-rose-500/10 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300/80">Retards</div>
                      <div className="mt-2 text-xl font-semibold text-rose-200">{ganttSummary.delayed}</div>
                    </div>
                  </div>
                </div>

                {ganttTeamRows.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-white">Aucune ligne de planning disponible.</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Le planning sera affiché ici avec la formation puis tous les corps métier du projet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <div className="min-w-[1240px]">
                      <div className="flex border-b border-white/5 bg-slate-950/40">
                        <div className="w-[320px] shrink-0 border-r border-white/5 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Corps métier planifiés
                          </div>
                        </div>
                        <div
                          className="grid"
                          style={{
                            gridTemplateColumns: `repeat(${ganttDays.length}, minmax(44px, 44px))`,
                          }}
                        >
                          {ganttDays.map((day) => (
                            <div
                              key={day.toISOString()}
                              className={`border-r border-white/5 px-1 py-3 text-center ${isToday(day) ? 'bg-blue-500/10' : ''}`}
                            >
                              <div className="text-[10px] font-black uppercase tracking-tight text-slate-500">
                                {format(day, 'EEE', { locale: fr })}
                              </div>
                              <div className={`mt-1 text-xs font-semibold ${isToday(day) ? 'text-blue-300' : 'text-white'}`}>
                                {format(day, 'd')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {ganttTeamRows.map((row) => (
                        <div key={row.id} className="flex border-b border-white/5 last:border-b-0">
                          <div className="w-[320px] shrink-0 border-r border-white/5 px-4 py-4 bg-white/[0.015]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                  {row.kind === 'formation' ? 'Étape initiale' : 'Corps métier'}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-white">{row.teamName}</div>
                                <div className="mt-1 text-xs text-slate-400">{row.label}</div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                  <span>{format(row.effectiveStart, 'dd MMM', { locale: fr })}</span>
                                  <span>→</span>
                                  <span>{format(row.effectiveEnd, 'dd MMM', { locale: fr })}</span>
                                  <span>•</span>
                                  <span>{planningMode === 'manual' ? 'manuel' : 'auto'}</span>
                                </div>
                              </div>
                              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${row.chipClass}`}>
                                {row.phase ? PHASE_LABELS[row.phase] : row.label}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                              <span>{row.teamCount}/{row.requiredTeams} eq.</span>
                              <span className={getPlanningRowStatusClass(row)}>
                                {getPlanningRowStatusLabel(row)}
                              </span>
                            </div>
                          </div>
                          <div className="relative">
                            <div
                              className="grid"
                              style={{
                                gridTemplateColumns: `repeat(${ganttDays.length}, minmax(44px, 44px))`,
                              }}
                            >
                              {ganttDays.map((day, dayIndex) => {
                                const inSpan = row.isVisibleOnWindow && dayIndex >= row.firstActiveIndex && dayIndex <= row.lastActiveIndex;
                                return (
                                  <div
                                    key={`${row.id}-${day.toISOString()}`}
                                    className={`relative flex h-[74px] items-end justify-center border-r border-white/5 pb-2 ${isToday(day) ? 'bg-blue-500/5' : ''} ${inSpan ? 'bg-white/[0.02]' : ''}`}
                                  >
                                    {inSpan && (
                                      <div
                                        className="absolute inset-x-1 bottom-1 top-1 rounded-lg"
                                        style={{
                                          backgroundColor: row.fillColor,
                                          opacity: 0.1,
                                        }}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {row.isVisibleOnWindow && row.visibleSpanDays > 0 && (
                              <div
                                className="absolute left-0 top-1/2 flex h-10 -translate-y-1/2 items-center overflow-hidden rounded-xl border px-3 shadow-lg"
                                style={{
                                  left: `${row.firstActiveIndex * 44 + 4}px`,
                                  width: `${Math.max(row.visibleSpanDays * 44 - 8, 92)}px`,
                                  backgroundColor: `${row.fillColor}33`,
                                  borderColor: `${row.fillColor}66`,
                                }}
                              >
                                <div className="flex w-full items-center justify-between gap-2 text-white">
                                  <span className="truncate text-[11px] font-semibold">{row.teamName}</span>
                                  <span className="shrink-0 text-[10px] font-black">
                                    {format(row.effectiveStart, 'dd/MM', { locale: fr })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {viewMode === 'kanban' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
              >
                {planningRows.map((row) => (
                  <div key={row.id} className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.9))] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {row.kind === 'formation' ? 'Démarrage' : 'Corps métier'}
                        </div>
                        <h3 className="mt-1 text-lg font-semibold text-white">{row.teamName}</h3>
                        <p className="mt-1 text-xs text-slate-400">{row.label}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${row.chipClass}`}>
                        {row.phase ? PHASE_LABELS[row.phase] : row.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-[20px] border border-white/6 bg-white/[0.03] p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Début</div>
                        <div className="mt-1 font-semibold text-white">{format(row.effectiveStart, 'dd MMM yyyy', { locale: fr })}</div>
                      </div>
                      <div className="rounded-[20px] border border-white/6 bg-white/[0.03] p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Fin</div>
                        <div className="mt-1 font-semibold text-white">{format(row.effectiveEnd, 'dd MMM yyyy', { locale: fr })}</div>
                      </div>
                      <div className="rounded-[20px] border border-white/6 bg-white/[0.03] p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Durée</div>
                        <div className="mt-1 font-semibold text-white">{row.effectiveDurationDays} jour(s)</div>
                      </div>
                      <div className="rounded-[20px] border border-white/6 bg-white/[0.03] p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">Mode</div>
                        <div className="mt-1 font-semibold text-white">
                          {planningMode === 'manual' && manualPlanningOverrides[row.id] ? 'Manuel' : 'Automatique'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(row.progress, 100)}%`, backgroundColor: row.fillColor }} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>{row.progress}% progression</span>
                      <span>•</span>
                      <span>{row.projectedWorkingDays === null ? 'aucune capacité active' : `${row.projectedWorkingDays} j ouvrés`}</span>
                      <span>•</span>
                      <span>{row.siteCount} site(s)</span>
                    </div>
                    {row.dependencyLabels.length > 0 && (
                      <div className="mt-3 text-[11px] text-slate-500">
                        Dépendances: {row.dependencyLabels.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}

            {viewMode === 'calendar' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.08),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.92))] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:p-6"
              >
                <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-300/70">Semaine active</div>
                    <h3 className="mt-2 text-base sm:text-lg font-semibold text-white">
                      {format(currentDate, 'MMMM yyyy', { locale: fr })}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentDate(addDays(currentDate, -7))}
                      className="min-h-11 min-w-11 rounded-xl border border-white/6 bg-slate-950/36 p-2 transition-colors hover:bg-slate-800"
                      title="Semaine précédente"
                    >
                      <ChevronLeft size={20} className="text-slate-400" />
                    </button>
                    <button
                      onClick={() => setCurrentDate(addDays(currentDate, 7))}
                      className="min-h-11 min-w-11 rounded-xl border border-white/6 bg-slate-950/36 p-2 transition-colors hover:bg-slate-800"
                      title="Semaine suivante"
                    >
                      <ChevronRight size={20} className="text-slate-400" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                <div className="grid min-w-[420px] grid-cols-7 gap-1 sm:gap-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                    <div key={day} className="text-center text-[10px] font-medium text-slate-500 uppercase py-2">
                      {day}
                    </div>
                  ))}

                  {eachDayOfInterval({
                    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                    end: endOfWeek(currentDate, { weekStartsOn: 1 })
                  }).map(day => {
                    const dayStages = planningRows.filter(row =>
                      day >= row.effectiveStart && day <= row.effectiveEnd
                    );
                    const isCurrentDay = isToday(day);

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-24 sm:min-h-28 p-1.5 sm:p-2 rounded-[18px] border transition-all ${isCurrentDay
                          ? 'bg-blue-500/20 border-blue-500/40 shadow-lg shadow-blue-500/10'
                          : 'bg-slate-800/30 border-white/5'
                          }`}
                      >
                        <div className={`text-xs font-bold mb-1 ${isCurrentDay ? 'text-blue-400' : 'text-slate-500'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {dayStages.length} actif(s)
                        </div>
                        <div className="space-y-1">
                          {dayStages.slice(0, 3).map(row => (
                            <div
                              key={`${row.id}-${day.toISOString()}`}
                              className="text-[8px] font-bold px-1 py-0.5 rounded truncate text-white"
                              style={{ backgroundColor: row.fillColor }}
                            >
                              {row.teamName}
                            </div>
                          ))}
                          {dayStages.length > 3 && (
                            <div className="text-[8px] text-slate-500">+{dayStages.length - 3}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── GRAPHIQUE DE CHARGE PAR ÉQUIPE ── */}
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 sm:p-6 mt-4 sm:mt-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-sm sm:text-base font-semibold text-white">Charge des équipes</h3>
              <div className="rounded-xl border border-white/5 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300">
                Métier actif: <span className="text-white">{selectedTradeLabel}</span>
              </div>
            </div>

            {visibleTeamPlannings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-500">
                Aucune équipe ne correspond aux filtres actifs.
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {visibleTeamPlannings.map(tp => (
                  <div key={tp.team.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <Users size={16} className="text-blue-400" />
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-bold text-white">{tp.team.name}</span>
                            <span className="text-xs text-slate-400">Capacité: {tp.team.capacity ?? '—'}</span>
                          </div>
                        </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${tp.status === 'overloaded' ? 'bg-rose-500/30 text-rose-400 border border-rose-500/20' :
                        tp.status === 'busy' ? 'bg-amber-500/30 text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/30 text-emerald-400 border border-emerald-500/20'
                        }`}>
                        {tp.status === 'overloaded' ? 'Surchargé' : tp.status === 'busy' ? 'Occupé' : 'Disponible'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(tp.utilization, 100)}%`,
                            backgroundColor: tp.utilization > 100 ? '#ef4444' : (tp.utilization > 70 ? '#f59e0b' : '#10b981')
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white">{tp.utilization.toFixed(0)}%</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        <span>{tp.tasks.filter(t => t.phase === 'LIVRAISON').length} livr.</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{tp.tasks.filter(t => t.phase === 'MACONNERIE').length} maçon.</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>{tp.tasks.filter(t => t.phase === 'RESEAU').length} réseau</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        <span>{tp.tasks.filter(t => t.phase === 'INTERIEUR').length} install.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ContentArea>
        </ModulePageShell>
      )}

      <AnimatePresence>
        {showManualPlanner && (
          <div className="fixed inset-0 z-[95] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManualPlanner(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 210 }}
              className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-slate-900 p-4 shadow-2xl sm:p-6"
            >
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300/70">Pilotage manuel</div>
                  <h3 className="mt-2 text-lg font-semibold text-white">Réglages planning par corps métier</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Ajustez début, fin et durée pour chaque ligne. Les dépendances restent visibles pour garder le séquencement.
                  </p>
                </div>
                <button
                  onClick={() => setShowManualPlanner(false)}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5"
                  title="Fermer"
                  aria-label="Fermer le panneau manuel"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Lignes</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{manualPlannerRows.length}</div>
                </div>
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Overrides</div>
                  <div className="mt-2 text-2xl font-semibold text-amber-100">{manualOverrideCount}</div>
                </div>
                <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Mode</div>
                  <div className="mt-2 text-sm font-semibold text-white">Manuel actif</div>
                </div>
              </div>

              <div className="mb-5 flex flex-wrap items-center gap-2">
                <button
                  onClick={resetManualPlanning}
                  className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
                >
                  Revenir au planning auto
                </button>
                <button
                  onClick={() => setShowManualPlanner(false)}
                  className="rounded-xl border border-white/8 bg-slate-950/40 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
                >
                  Continuer la lecture
                </button>
              </div>

              <div className="space-y-4">
                {manualPlannerRows.map((row) => (
                  <div
                    key={`manual-${row.id}`}
                    className={`rounded-[24px] border p-4 shadow-[0_18px_44px_rgba(2,6,23,0.24)] ${
                      row.hasManualOverride ? 'border-amber-400/25 bg-amber-950/10' : 'border-white/6 bg-slate-950/34'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          {row.kind === 'formation' ? 'Étape initiale' : 'Corps métier'}
                        </div>
                        <h4 className="mt-1 text-base font-semibold text-white">{row.teamName}</h4>
                        <p className="mt-1 text-xs text-slate-400">{row.label}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${row.chipClass}`}>
                          {row.phase ? PHASE_LABELS[row.phase] : row.label}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                            row.hasManualOverride
                              ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                              : 'border-white/8 bg-white/[0.04] text-slate-300'
                          }`}
                        >
                          {row.hasManualOverride ? 'Manuel' : 'Auto'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
                      <div className="rounded-[20px] border border-white/6 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Dépend de</span>
                          {row.dependencyLabels.length === 0 && (
                            <span className="text-xs text-slate-500">Aucune dépendance bloquante</span>
                          )}
                        </div>
                        {row.dependencyLabels.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {row.dependencyLabels.map((dependency) => (
                              <span
                                key={`${row.id}-${dependency}`}
                                className="inline-flex items-center rounded-full border border-white/8 bg-slate-950/60 px-2.5 py-1 text-[11px] font-medium text-slate-300"
                              >
                                {dependency}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-3 py-2.5">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Démarre après</div>
                            <div className="mt-1 font-semibold text-white">
                              {row.dependencyEnd ? format(row.dependencyEnd, 'dd MMM yyyy', { locale: fr }) : 'Libre'}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-3 py-2.5">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Fenêtre auto</div>
                            <div className="mt-1 font-semibold text-white">
                              {format(row.autoStart, 'dd MMM', { locale: fr })} → {format(row.autoEnd, 'dd MMM', { locale: fr })}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-3 py-2.5">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Capacité</div>
                            <div className="mt-1 font-semibold text-white">{row.teamCount}/{row.requiredTeams} équipes</div>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-3 py-2.5">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Progression</div>
                            <div className="mt-1 font-semibold text-white">{row.progress}%</div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-white/6 bg-white/[0.03] p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Réglage actif</div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">Début</span>
                            <input
                              type="date"
                              value={manualPlanningOverrides[row.id]?.start || toDateInputValue(row.effectiveStart)}
                              onChange={(e) => handlePlanningDateChange(row.id, 'start', e.target.value)}
                              className="mt-1 w-full rounded-xl border border-white/8 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">Fin</span>
                            <input
                              type="date"
                              value={manualPlanningOverrides[row.id]?.end || toDateInputValue(row.effectiveEnd)}
                              onChange={(e) => handlePlanningDateChange(row.id, 'end', e.target.value)}
                              className="mt-1 w-full rounded-xl border border-white/8 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">Durée (jours)</span>
                            <input
                              type="number"
                              min={1}
                              value={manualPlanningOverrides[row.id]?.durationDays || row.effectiveDurationDays}
                              onChange={(e) => handlePlanningDurationChange(row.id, e.target.value)}
                              className="mt-1 w-full rounded-xl border border-white/8 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>
                          <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-3 py-2.5">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">Auto de base</div>
                            <div className="mt-1 font-semibold text-white">{row.autoDurationDays} jour(s)</div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span>{row.siteCount} site(s)</span>
                          <span>•</span>
                          <span>{row.projectedWorkingDays === null ? 'aucune capacité active' : `${row.projectedWorkingDays} j ouvrés`}</span>
                          <span>•</span>
                          <span>{row.kind === 'formation' ? 'séquence initiale' : row.teamLabel}</span>
                        </div>

                        {row.hasManualOverride && (
                          <button
                            onClick={() => clearManualPlanningRow(row.id)}
                            className="mt-4 rounded-xl border border-white/8 bg-slate-950/40 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
                          >
                            Revenir en auto pour cette ligne
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── PANNEAU D'HISTORIQUE LATÉRAL ── */}
      <AnimatePresence>
        {showAudit && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAudit(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-slate-900 h-full shadow-2xl border-l border-white/10 p-4 sm:p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-3 mb-5 sm:mb-8">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white">Journal d'audit</h3>
                  <p className="text-xs text-slate-400">Activités récentes du planning</p>
                </div>
                <button onClick={() => setShowAudit(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-colors" title="Fermer" aria-label="Fermer le journal d'audit">
                  <X size={24} />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Filtrer par utilisateur ou détail..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="w-full min-h-11 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  onClick={handleExportHistoryToExcel}
                  className="min-h-11 px-4 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-600/20 transition-all flex items-center justify-center gap-2"
                  title="Exporter en Excel"
                >
                  <Download size={16} />
                  <span className="text-sm font-medium">Exporter</span>
                </button>
              </div>

              <div className="space-y-4">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/5 py-12 text-slate-400">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-400" />
                    <span className="text-sm font-medium">Chargement de l'historique...</span>
                  </div>
                ) : historyLogs.length === 0 ? (
                  <div className="text-center py-20 text-slate-600">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium">Aucun mouvement récent</p>
                  </div>
                ) : filteredHistoryLogs.length === 0 ? (
                  <div className="text-center py-20 text-slate-600">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium">Aucun résultat pour ce filtre</p>
                  </div>
                ) : (
                  filteredHistoryLogs.map((log, idx: number) => (
                    <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-medium text-indigo-300">{log.action}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{format(new Date(log.timestamp), 'dd MMM, HH:mm', { locale: fr })}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                        {log.details}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-[8px] text-indigo-400 font-black">
                          {log.userName?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">{log.userName}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}
