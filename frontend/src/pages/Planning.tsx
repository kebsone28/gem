import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, Home, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, MapPin, Wrench, Hammer, Zap,
  Filter, RefreshCw, History, X, ShieldCheck, Download
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, differenceInCalendarDays } from 'date-fns';
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
import { useAuthStore } from '../store/authStore';
import { auditService } from '../services/auditService';
import { missionSageService } from '../services/ai/MissionSageService';
import type { AIResponse, AIState, RegionalSummary } from '../services/ai/MissionSageService';
import { useProject } from '../contexts/ProjectContext';
import apiClient from '../api/client';
import { usePlanningData } from '../hooks/usePlanningData';
import { usePlanningAuditHistory } from '../hooks/usePlanningAuditHistory';
import { usePlanningDelayAlerts } from '../hooks/usePlanningDelayAlerts';
import {
  ALLOCATION_SOURCE_LABELS,
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
  type TeamPlanning,
  type PlanningTask,
} from '../services/planningDomain';
import {
  isLogisticsPlanningTeam,
  isPreparationPlanningTeam,
  teamMatchesPlanningRegion,
} from '../services/planningAllocation';

type ViewMode = 'calendar' | 'timeline' | 'kanban' | 'gantt';

const GANTT_WINDOW_DAYS = 21;

const REGIONAL_CAPACITY_METRICS = [
  { actualKey: 'livraison', theoreticalKey: 'livraison', label: 'Livraison' },
  { actualKey: 'macons', theoreticalKey: 'macons', label: 'Maçons' },
  { actualKey: 'reseau', theoreticalKey: 'reseau', label: 'Réseau' },
  { actualKey: 'interieur_type1', theoreticalKey: 'interieur', label: 'Installation' },
  { actualKey: 'controle', theoreticalKey: 'controle', label: 'Contrôle' },
] as const;

const getPlanningTaskStatus = (task: PlanningTask) => {
  if (task.isDelayed) return `Retard ${task.delayDays}j`;
  if (task.phase === 'TERMINE') return 'Terminé';
  return 'En cours';
};

export default function Planning() {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedTrade, setSelectedTrade] = useState<string>('ALL');
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [targetMonths, setTargetMonths] = useState<number>(6);
  const [includeSaturday, setIncludeSaturday] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAudit, setShowAudit] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [aiRecommendation, setAiRecommendation] = useState<AIResponse | null>(null);

  const { project } = useProject();
  const currentProjectId = project?.id || null;
  const { households, teams, isLoading, isRefreshing, dataSource, refresh: refreshPlanningData } =
    usePlanningData(currentProjectId);
  const { historyLogs, isLoadingHistory } = usePlanningAuditHistory(showAudit);
  const planningAccent = MODULE_ACCENTS.planning;

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
        setTargetMonths(Math.max(1, Math.round(project.duration)));
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [project?.id, project?.duration]);

  // 1. Calculer les besoins théoriques en équipes
  const theoreticalNeeds = useMemo(() => {
    return computeTheoreticalNeeds({
      households,
      teams,
      targetMonths,
      selectedRegion,
      productionRates: project?.config?.productionRates,
      includeSaturday,
    });
  }, [households, teams, includeSaturday, targetMonths, project?.config?.productionRates, selectedRegion]);

  const workflowStages = useMemo(
    () =>
      buildWorkflowStages({
        households,
        teams,
        projectConfig: project?.config,
        targetMonths,
        selectedRegion,
        includeSaturday,
      }),
    [households, includeSaturday, project?.config, selectedRegion, targetMonths, teams]
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
      teams,
      projectConfig: project?.config,
    });
  }, [households, project?.config, teams]);

  // Transformer les données en tâches de planning
  const tasks = useMemo((): PlanningTask[] => {
    return buildPlanningTasks({
      households,
      allocationPlanByHousehold,
    });
  }, [allocationPlanByHousehold, households]);
  usePlanningDelayAlerts(currentProjectId, tasks);

  // 👥 Grouper par équipe
  const teamPlannings = useMemo((): TeamPlanning[] => {
    return buildTeamPlannings(tasks, teams);
  }, [tasks, teams]);

  // 📊 Statistiques globales (IGPP ready)
  const stats = useMemo(() => {
    return buildPlanningStats(tasks, selectedRegion);
  }, [tasks, selectedRegion]);

  // Analyse IA Proactive
  useEffect(() => {
    const getAiAdvice = async () => {
      if (households.length > 0 && !isLoading && teams.length > 0) {
        // Préparer un résumé régional pour l'IA
        const regionalSummaries: RegionalSummary[] = buildRegionalPlanningSummaries({
          availableRegions,
          households,
          tasks,
          teams,
        });
        const advice = await missionSageService.processQuery(
          "Analyse le planning actuel et suggère des réaffectations pour les tâches en retard.",
          { role: 'CHEF_PROJET', displayName: 'Coordinateur' },
          { stats: stats as unknown as AIState['stats'], auditLogs: historyLogs, households, teams, regionalSummaries }
        );
        setAiRecommendation(advice);
      }
    };
    getAiAdvice();
  }, [isLoading, stats, historyLogs, availableRegions, households, teams, tasks]);

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
    });
  }, [tasks, phaseFilter, selectedTeam, selectedRegion]);

  const visibleTeamPlannings = useMemo(() => {
    return filterVisibleTeamPlannings(teamPlannings, selectedTrade);
  }, [teamPlannings, selectedTrade]);

  const timelineTasks = useMemo(() => filteredTasks.slice(0, 50), [filteredTasks]);
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
  const ganttTasks = useMemo(
    () =>
      filteredTasks
        .filter((task) => {
          if (!task.startDate || !task.endDate) return false;
          return task.endDate >= ganttWindowStart && task.startDate <= ganttWindowEnd;
        })
        .sort((a, b) => {
          const startDiff = (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0);
          if (startDiff !== 0) return startDiff;
          return a.householdName.localeCompare(b.householdName, 'fr');
        })
        .slice(0, 40),
    [filteredTasks, ganttWindowEnd, ganttWindowStart]
  );
  const ganttGroupedTasks = useMemo(() => {
    const groups = new Map<string, PlanningTask[]>();

    for (const task of ganttTasks) {
      const groupKey = task.teamName || 'Sans équipe';
      const existing = groups.get(groupKey) || [];
      existing.push(task);
      groups.set(groupKey, existing);
    }

    return Array.from(groups.entries())
      .map(([teamName, tasks]) => ({
        teamName,
        tasks,
        delayed: tasks.filter((task) => task.isDelayed).length,
      }))
      .sort((a, b) => {
        if (a.teamName === 'Sans équipe') return 1;
        if (b.teamName === 'Sans équipe') return -1;
        return a.teamName.localeCompare(b.teamName, 'fr');
      });
  }, [ganttTasks]);
  const ganttSummary = useMemo(
    () => ({
      total: ganttTasks.length,
      delayed: ganttTasks.filter((task) => task.isDelayed).length,
      completed: ganttTasks.filter((task) => task.phase === 'TERMINE').length,
      teams: ganttGroupedTasks.length,
    }),
    [ganttGroupedTasks.length, ganttTasks]
  );

  const handleExportGanttToWord = useCallback(async () => {
    if (ganttTasks.length === 0) {
      toast.error('Aucune tâche visible à exporter.');
      return;
    }

    const rows = ganttTasks.map((task) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: task.lotNumber || '-' })],
          }),
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: task.householdName })],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: task.village || '-' })],
          }),
          new TableCell({
            width: { size: 13, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: PHASE_LABELS[task.phase] })],
          }),
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                text: task.startDate ? format(task.startDate, 'dd/MM/yyyy', { locale: fr }) : '-',
              }),
            ],
          }),
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                text: task.endDate ? format(task.endDate, 'dd/MM/yyyy', { locale: fr }) : '-',
              }),
            ],
          }),
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: task.teamName || 'Allocation canonique / sans équipe' })],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: getPlanningTaskStatus(task) })],
          }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'Planning Gantt des Travaux',
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
                  `Région ${selectedRegion === 'ALL' ? 'Toutes' : selectedRegion} · Phase ${phaseFilter} · Équipe ${selectedTeam === 'ALL' ? 'Toutes' : selectedTeam}`
                ),
              ],
            }),
            new Paragraph({
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({ text: 'Synthèse visible : ', bold: true }),
                new TextRun(
                  `${ganttSummary.total} tâches · ${ganttSummary.teams} groupes équipe · ${ganttSummary.delayed} en retard · ${ganttSummary.completed} terminées`
                ),
              ],
            }),
            ...ganttGroupedTasks.flatMap((group) => [
              new Paragraph({
                text: `${group.teamName} · ${group.tasks.length} tâche(s)${group.delayed > 0 ? ` · ${group.delayed} en retard` : ''}`,
                heading: HeadingLevel.HEADING_2,
              }),
            ]),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    'Lot',
                    'Ménage',
                    'Village',
                    'Phase',
                    'Début',
                    'Fin',
                    'Équipe',
                    'Statut',
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
    ganttTasks,
    ganttGroupedTasks,
    ganttSummary.completed,
    ganttSummary.delayed,
    ganttSummary.teams,
    ganttSummary.total,
    ganttWindowEnd,
    ganttWindowStart,
    phaseFilter,
    project?.name,
    selectedRegion,
    selectedTeam,
  ]);

  // ✍️ Gestion des affectations manuelles
  const handleRefresh = useCallback(async () => {
    await refreshPlanningData();
    toast.success('Planning actualisé');
  }, [refreshPlanningData]);

  const handleManualAssign = useCallback(async (householdId: string, teamId: string) => {
    try {
      const value = teamId === 'AUTO' ? null : teamId; // null pour revenir à l'allocation canonique
      await apiClient.patch(`/households/${householdId}`, { assignedTeamId: value }); // Enregistrement sur le serveur

      if (user) {
        const h = households.find(h => h.id === householdId);
        const t = teams.find(t => t.id === teamId);
        const teamLabel = teamId === 'AUTO' ? 'Allocation canonique' : (t?.name || teamId);
        await auditService.logAction(
          user,
          'Réaffectation Planning',
          'PLANNING',
          `Affectation forcée : Ménage "${h?.name || householdId}" (Lot: ${h?.numeroordre || '?'}) → Équipe: ${teamLabel}`,
          'info'
        );
      }

      toast.success('Affectation mise à jour'); // Feedback utilisateur
      handleRefresh();
    } catch {
      toast.error("Erreur lors de l'affectation manuelle");
    }
  }, [user, households, teams, handleRefresh]);

  const assignedTeamByHousehold = useMemo(() => {
    return new Map(
      households.map((household) => [household.id, household.assignedTeamId || null])
    );
  }, [households]);

  const allocationByHousehold = useMemo(() => {
    return new Map(
      tasks.map((task) => [
        task.householdId,
        {
          teamId: task.teamId || null,
          teamName: task.teamName || null,
          source: task.allocationSource || 'unassigned',
        },
      ])
    );
  }, [tasks]);

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
          <div className={`relative mb-4 overflow-hidden rounded-3xl border p-4 sm:mb-6 sm:p-5 ${planningAccent.surface}`}>
            <div className="absolute top-0 right-0 hidden sm:block p-6 opacity-5">
              <Zap size={88} className="text-indigo-400" />
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 relative z-10">
              <div className="space-y-1 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-white">Objectif de realisation</h3>
                <p className="text-xs text-indigo-200/70">Calcul dynamique des ressources necessaires par zone.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 w-full md:w-auto bg-slate-950/50 p-3 rounded-2xl border border-white/5 sm:grid-cols-[auto,1fr,auto,auto] sm:items-center sm:gap-4">
                <span className="text-[11px] font-semibold text-slate-400 sm:ml-3">Region</span>
                <select
                  value={selectedRegion} // selectedRegion est déjà 'ALL' par défaut
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="min-h-11 bg-indigo-500/15 border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                  title="Sélectionner la région pour le calcul"
                >
                  <option value="ALL">Toutes les régions</option>
                  {availableRegions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                <span className="text-[11px] font-semibold text-slate-400 sm:ml-3">Duree cible</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={targetMonths}
                    onChange={(e) => setTargetMonths(Math.max(1, Number(e.target.value)))} // Minimum 1 mois
                    title="Durée cible en mois"
                    className="w-16 min-h-11 bg-indigo-500/15 border border-indigo-500/20 rounded-xl px-3 py-2 text-white font-semibold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-indigo-300 sm:mr-3">mois</span>
                </div>
              </div>

              <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={includeSaturday}
                  onChange={(event) => setIncludeSaturday(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-indigo-500"
                />
                <span>Inclure le samedi dans le calcul</span>
              </label>
            </div>

            {theoreticalNeeds && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mt-5 sm:mt-8">
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
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
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
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              {/* Mode de vue */}
              <div className="grid grid-cols-4 bg-slate-900/60 rounded-xl p-1 w-full sm:w-auto">
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

              <div
                className={`min-h-11 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center ${
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
                className="min-h-11 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-all self-end sm:self-auto flex items-center justify-center gap-2"
                title="Actualiser"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                <span className="text-sm font-medium">Actualiser</span>
              </button>

              <button
                onClick={handleExportGanttToWord}
                className="min-h-11 px-4 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/20 rounded-xl text-blue-200 transition-all self-end sm:self-auto flex items-center justify-center gap-2"
                title="Exporter le Gantt visible en Word"
              >
                <Download size={16} />
                <span className="text-sm font-medium">Word</span>
              </button>
            </div>
          </div>
          </div>

          {/* ── CONSEILLER IA (MISSION SAGE) ── */}
          {aiRecommendation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-blue-500/15 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3 sm:gap-4"
            >
              <div className="p-2 bg-blue-500 rounded-xl text-white">
                <Zap size={18} />
              </div>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                  <h4 className="text-xs font-semibold text-blue-300">Conseil intelligent</h4>
                  <span className="text-[11px] text-blue-400/60 font-mono">MissionSage v8.0</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  "{aiRecommendation.message}"
                </p>
                {aiRecommendation.actionLabel && (
                  <button className="mt-2 text-xs font-medium text-blue-300 hover:underline">
                    {aiRecommendation.actionLabel} →
                  </button>
                )}
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
              const color = PHASE_COLORS[phase] || 'bg-slate-500';
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
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 sm:p-6 mt-4 sm:mt-8">
            <h3 className="text-sm sm:text-base font-semibold text-white mb-4 sm:mb-6">
              Comparatif Capacités Régionales (Besoin vs Affecté)
            </h3>
            <div className="space-y-4 sm:space-y-8">
              {availableRegions.map(region => {
                const householdsInRegion = households.filter(h => h.region === region);
                const totalHouseholdsInRegion = householdsInRegion.length;

                // Recalculer les besoins théoriques pour cette région
                const regionalTheoreticalNeeds = computeTheoreticalNeeds({
                  households,
                  teams,
                  targetMonths,
                  selectedRegion: region,
                  productionRates: project?.config?.productionRates,
                  includeSaturday,
                });

                // Compter les équipes réellement affectées à cette région
                const regionalActualTeams: { [tradeKey: string]: number } = {
                  livraison: 0, macons: 0, reseau: 0, interieur_type1: 0, controle: 0,
                };
                teams.filter((team) => teamMatchesPlanningRegion(team, region)).forEach(team => {
                  if (isLogisticsPlanningTeam(team) || isPreparationPlanningTeam(team)) {
                    regionalActualTeams.livraison += 1;
                  }
                  if (team.tradeKey) {
                    regionalActualTeams[team.tradeKey] = (regionalActualTeams[team.tradeKey] || 0) + 1;
                  }
                });

                if (!regionalTheoreticalNeeds && totalHouseholdsInRegion === 0) return null;

                return (
                  <div key={region} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-sm font-semibold text-white">{region} ({totalHouseholdsInRegion} ménages)</h4>
                      {regionalTheoreticalNeeds && (
                        <span className="inline-flex w-fit items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-300">
                          Fenêtre cible: {targetMonths} mois / {regionalTheoreticalNeeds.workingDays} jours ouvrés
                          {includeSaturday ? ' (samedi inclus)' : ''}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {REGIONAL_CAPACITY_METRICS.map(({ actualKey, theoreticalKey, label }) => {
                        const theoreticalCount = regionalTheoreticalNeeds?.[theoreticalKey] || 0;
                        const actualCount = regionalActualTeams[actualKey] || 0;
                        const diff = actualCount - theoreticalCount;
                        const isOver = diff > 0;
                        if (theoreticalCount === 0 && actualCount === 0) return null;

                        return (
                          <div key={actualKey} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                            <span className="text-sm font-medium text-slate-300">{label}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-white">{theoreticalCount}</span>
                              <span className="text-xs text-slate-500">besoin</span>
                              <span className="text-sm font-semibold text-white">/</span>
                              <span className="text-sm font-semibold text-white">{actualCount}</span>
                              <span className="text-xs text-slate-500">affecté</span>
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
                className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden"
              >
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-sm sm:text-base font-semibold text-white">Chronologie des travaux</h3>
                </div>
                <div className="grid gap-3 p-4 md:hidden">
                  {timelineTasks.map(task => {
                    const isCriticallyDelayed = task.isDelayed && task.delayDays > 5;
                    const assignedTeamId = assignedTeamByHousehold.get(task.householdId) || 'AUTO';
                    const allocationMeta = allocationByHousehold.get(task.householdId);
                    return (
                      <div
                        key={task.id}
                        className={`rounded-2xl border p-4 ${isCriticallyDelayed ? 'border-rose-500/30 bg-rose-950/15' : 'border-white/5 bg-slate-950/30'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-blue-300">{task.lotNumber}</p>
                            <h4 className="text-sm font-semibold text-white truncate">{task.householdName}</h4>
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                              <MapPin size={12} className="text-slate-500" />
                              <span className="truncate">{task.village}</span>
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium text-white/90 ${PHASE_COLORS[task.phase]}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                            {PHASE_LABELS[task.phase]}
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-slate-400">Avancement</span>
                              <span className="font-medium text-white">{task.phaseProgress}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${PHASE_COLORS[task.phase]}`}
                                data-progress={task.phaseProgress}
                                style={{ width: `${task.phaseProgress}%` }}
                              />
                            </div>
                          </div>

                          <label className="block">
                            <span className="mb-1 block text-xs text-slate-400">Equipe</span>
                            <select
                              value={assignedTeamId}
                              onChange={(e) => handleManualAssign(task.householdId, e.target.value)}
                              className={`min-h-11 w-full bg-slate-800 border rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors ${assignedTeamId !== 'AUTO' ? 'text-indigo-300 border-indigo-500/30' : 'text-slate-300 border-white/5'}`}
                              title="Affecter manuellement une équipe"
                            >
                              <option value="AUTO">Allocation canonique</option>
                              {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </label>
                          {assignedTeamId === 'AUTO' && (
                            <div className="rounded-xl border border-white/5 bg-slate-900/60 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                  Suggestion
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-tighter text-blue-400">
                                  {ALLOCATION_SOURCE_LABELS[(allocationMeta?.source as NonNullable<PlanningTask['allocationSource']>) || 'unassigned']}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-medium text-white">
                                {allocationMeta?.teamName || 'Aucune equipe eligible'}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-slate-400">Statut</span>
                            {task.isDelayed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300">
                                <AlertTriangle size={12} />
                                Retard {task.delayDays}j
                              </span>
                            ) : task.phase === 'TERMINE' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                                <CheckCircle2 size={12} />
                                Termine
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                                En cours
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[860px]">
                    <thead className="bg-slate-950/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Lot</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Ménage</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Village</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Phase</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Avancement</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Équipe</th>
                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {timelineTasks.map(task => {
                        const isCriticallyDelayed = task.isDelayed && task.delayDays > 5;
                        const assignedTeamId = assignedTeamByHousehold.get(task.householdId) || 'AUTO';
                        const allocationMeta = allocationByHousehold.get(task.householdId);
                        return (
                          <tr key={task.id} className={`hover:bg-white/5 transition-colors ${isCriticallyDelayed ? 'bg-rose-900/20 border-l-4 border-rose-500' : ''}`}>
                            <td className="px-4 py-3">
                              <span className="text-xs font-bold text-blue-400">{task.lotNumber}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-bold text-white">{task.householdName}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <MapPin size={10} className="text-slate-500" />
                                <span className="text-xs text-slate-400">{task.village}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${PHASE_COLORS[task.phase]}`} />
                                <span className="text-xs font-bold text-slate-300">{PHASE_LABELS[task.phase]}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${PHASE_COLORS[task.phase]}`}
                                    data-progress={task.phaseProgress}
                                    style={{ width: `${task.phaseProgress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{task.phaseProgress}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <select
                                  value={assignedTeamId}
                                  onChange={(e) => handleManualAssign(task.householdId, e.target.value)}
                                  className={`bg-slate-800 border border-white/5 rounded-lg px-2 py-1 text-[10px] font-bold outline-none transition-colors ${assignedTeamId !== 'AUTO' ? 'text-indigo-400 border-indigo-500/30' : 'text-slate-400'
                                    }`}
                                  title="Affecter manuellement une équipe"
                                >
                                  <option value="AUTO">Allocation canonique</option>
                                  {teams.map(t => (
                                    <option key={t.id} value={t.id}>👷 {t.name}</option>
                                  ))}
                                </select>
                                {assignedTeamId !== 'AUTO' ? (
                                  <span className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter">FORCÉ</span>
                                ) : (
                                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">
                                    {ALLOCATION_SOURCE_LABELS[(allocationMeta?.source as NonNullable<PlanningTask['allocationSource']>) || 'unassigned']}
                                  </span>
                                )}
                                {assignedTeamId === 'AUTO' && allocationMeta?.teamName && (
                                  <span className="text-[10px] font-medium text-slate-400">
                                    {allocationMeta.teamName}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {task.isDelayed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400">
                                  <AlertTriangle size={10} />
                                  {task.delayDays}j
                                </span>
                              ) : task.phase === 'TERMINE' ? (
                                <span className="text-[10px] font-bold text-emerald-400">Terminé</span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500">En cours</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredTasks.length > 50 && (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Affichage de 50 sur {filteredTasks.length} tâches
                  </div>
                )}
              </motion.div>
            )}

            {viewMode === 'gantt' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden"
              >
                <div className="flex flex-col gap-4 border-b border-white/5 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-white">Gantt des travaux</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Vue glissante sur {GANTT_WINDOW_DAYS} jours, centrée sur la fenêtre de planification active.
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
                    <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Tâches</div>
                      <div className="mt-2 text-xl font-semibold text-white">{ganttSummary.total}</div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Équipes</div>
                      <div className="mt-2 text-xl font-semibold text-white">{ganttSummary.teams}</div>
                    </div>
                    <div className="rounded-2xl border border-rose-500/10 bg-rose-500/10 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300/80">Retards</div>
                      <div className="mt-2 text-xl font-semibold text-rose-200">{ganttSummary.delayed}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/10 px-4 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300/80">Terminées</div>
                      <div className="mt-2 text-xl font-semibold text-emerald-200">{ganttSummary.completed}</div>
                    </div>
                  </div>
                </div>

                {ganttTasks.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm font-medium text-white">Aucune tâche visible sur cette fenêtre.</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Décale la période ou élargis les filtres pour afficher un planning exploitable.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <div className="min-w-[1240px]">
                      <div className="flex border-b border-white/5 bg-slate-950/40">
                        <div className="w-[320px] shrink-0 border-r border-white/5 px-4 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Lots visibles
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

                      {ganttGroupedTasks.map((group) => (
                        <div key={group.teamName}>
                          <div className="flex border-b border-white/5 bg-slate-950/60">
                            <div className="w-[320px] shrink-0 border-r border-white/5 px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                    Groupe équipe
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-white">{group.teamName}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-semibold text-slate-300">{group.tasks.length} tâche(s)</div>
                                  <div className={`text-[10px] ${group.delayed > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                    {group.delayed > 0 ? `${group.delayed} retard(s)` : 'Rythme nominal'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center px-4 text-[11px] text-slate-500">
                              Vision consolidée par équipe sur la fenêtre active
                            </div>
                          </div>

                          {group.tasks.map((task) => {
                            const taskStart = task.startDate || ganttWindowStart;
                            const taskEnd = task.endDate || taskStart;
                            const startOffset = Math.max(
                              0,
                              differenceInCalendarDays(taskStart, ganttWindowStart)
                            );
                            const endOffset = Math.min(
                              ganttDays.length - 1,
                              differenceInCalendarDays(taskEnd, ganttWindowStart)
                            );
                            const spanDays = Math.max(endOffset - startOffset + 1, 1);
                            const isDelayed = task.isDelayed;

                            return (
                              <div key={task.id} className="flex border-b border-white/5 last:border-b-0">
                                <div className="w-[320px] shrink-0 border-r border-white/5 px-4 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-[11px] font-black uppercase tracking-tight text-blue-400">
                                        {task.lotNumber}
                                      </div>
                                      <div className="truncate text-sm font-semibold text-white">
                                        {task.householdName}
                                      </div>
                                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                                        <MapPin size={11} className="text-slate-500" />
                                        <span className="truncate">{task.village}</span>
                                      </div>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold text-white/90 ${PHASE_COLORS[task.phase]}`}>
                                      {PHASE_LABELS[task.phase]}
                                    </span>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                                    <span className="text-slate-500">{task.teamName || 'Sans équipe'}</span>
                                    <span className={isDelayed ? 'font-semibold text-rose-400' : 'font-medium text-slate-400'}>
                                      {getPlanningTaskStatus(task)}
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
                                    {ganttDays.map((day) => {
                                      const active = day >= taskStart && day <= taskEnd;
                                      return (
                                        <div
                                          key={`${task.id}-${day.toISOString()}`}
                                          className={`h-[74px] border-r border-white/5 ${isToday(day) ? 'bg-blue-500/5' : ''} ${active ? 'bg-white/[0.02]' : ''}`}
                                        />
                                      );
                                    })}
                                  </div>
                                  <div
                                    className={`absolute left-0 top-1/2 flex h-9 -translate-y-1/2 items-center overflow-hidden rounded-xl border px-3 shadow-lg ${
                                      isDelayed
                                        ? 'border-rose-400/30 bg-rose-500/20 text-rose-50'
                                        : 'border-white/10 bg-slate-800/90 text-white'
                                    } ${PHASE_COLORS[task.phase]}`}
                                    style={{
                                      left: `${startOffset * 44 + 4}px`,
                                      width: `${Math.max(spanDays * 44 - 8, 40)}px`,
                                    }}
                                  >
                                    <div className="flex w-full items-center justify-between gap-2">
                                      <span className="truncate text-[11px] font-semibold">
                                        {task.teamName || PHASE_LABELS[task.phase]}
                                      </span>
                                      <span className="shrink-0 text-[10px] font-black">
                                        {task.phaseProgress}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4"
              >
                {['LIVRAISON', 'MACONNERIE', 'RESEAU', 'INTERIEUR', 'CONTROLE', 'TERMINE'].map(phase => {
                  const phaseTasks = filteredTasks.filter(t => t.phase === phase);
                  return (
                    <div key={phase} className="bg-slate-900/50 border border-white/5 rounded-2xl p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${PHASE_COLORS[phase]}`} />
                          <span className="text-sm font-medium text-slate-300">{PHASE_LABELS[phase as PlanningTask['phase']]}</span>
                        </div>
                        <span className="text-xs font-semibold text-white">{phaseTasks.length}</span>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {phaseTasks.slice(0, 10).map(task => (
                          <div key={task.id} className="p-2 bg-slate-800/50 rounded-lg">
                            <div className="text-sm font-medium text-white truncate">{task.householdName}</div>
                            <div className="text-[11px] text-slate-500">{task.lotNumber} • {task.village}</div>
                          </div>
                        ))}
                        {phaseTasks.length > 10 && (
                          <div className="text-[11px] text-slate-500 text-center">+{phaseTasks.length - 10} autres</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {viewMode === 'calendar' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 sm:p-6"
              >
                <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
                  <button
                    onClick={() => setCurrentDate(addDays(currentDate, -7))}
                    className="min-h-11 min-w-11 p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Semaine précédente"
                  >
                    <ChevronLeft size={20} className="text-slate-400" />
                  </button>
                  <h3 className="text-base sm:text-lg font-semibold text-white text-center flex-1">
                    {format(currentDate, 'MMMM yyyy', { locale: fr })}
                  </h3>
                  <button
                    onClick={() => setCurrentDate(addDays(currentDate, 7))}
                    className="min-h-11 min-w-11 p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Semaine suivante"
                  >
                    <ChevronRight size={20} className="text-slate-400" />
                  </button>
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
                    const dayTasks = filteredTasks.filter(t =>
                      t.startDate && isSameDay(t.startDate, day)
                    );
                    const isCurrentDay = isToday(day);

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-20 sm:min-h-24 p-1.5 sm:p-2 rounded-lg border transition-all ${isCurrentDay
                          ? 'bg-blue-500/20 border-blue-500/40 shadow-lg shadow-blue-500/10'
                          : 'bg-slate-800/30 border-white/5'
                          }`}
                      >
                        <div className={`text-xs font-bold mb-1 ${isCurrentDay ? 'text-blue-400' : 'text-slate-500'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {dayTasks.slice(0, 3).map(task => (
                            <div
                              key={task.id}
                              className={`text-[8px] font-bold px-1 py-0.5 rounded truncate ${PHASE_COLORS[task.phase]} text-white`}
                            >
                              {task.lotNumber}
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-[8px] text-slate-500">+{dayTasks.length - 3}</div>
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
              
              <div className="flex min-h-11 items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-1.5 border border-white/5">
                <Filter size={12} className="text-slate-500" />
                <select
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-300 outline-none cursor-pointer"
                  title="Filtrer par type de métier"
                >
                  <option value="ALL">Tous les métiers</option>
                  <option value="macons">👷 Maçonnerie</option>
                  <option value="reseau">⚡ Réseau</option>
                  <option value="interieur_type1">🏠 Installation</option>
                  <option value="controle">🛡️ Contrôle</option>
                </select>
              </div>
            </div>

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
                        className={`h-full rounded-full transition-all`}
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
          </div>

          {/* ── ÉQUIPES ET CHARGE ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {visibleTeamPlannings.map(tp => (
              <div key={tp.team.id} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-blue-400" />
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-white">{tp.team.name}</span>
                      <span className="text-xs text-slate-400">Capacité: {tp.team.capacity ?? '—'}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${tp.status === 'overloaded' ? 'bg-rose-500/20 text-rose-400' :
                    tp.status === 'busy' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                    {tp.status === 'overloaded' ? 'Surchargé' : tp.status === 'busy' ? 'Occupé' : 'Disponible'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-500">Charge</span>
                      <span className="text-white font-bold">{tp.utilization.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${tp.utilization > 100 ? 'bg-rose-500' :
                          tp.utilization > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        data-progress={Math.min(tp.utilization, 100)}
                        style={{ width: `${Math.min(tp.utilization, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px]">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                      <span className="text-slate-500">{tp.tasks.filter(t => t.phase === 'LIVRAISON').length} livr.</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-slate-500">{tp.tasks.filter(t => t.phase === 'MACONNERIE').length} maçon.</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span className="text-slate-500">{tp.tasks.filter(t => t.phase === 'RESEAU').length} réseau</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span className="text-slate-500">{tp.tasks.filter(t => t.phase === 'INTERIEUR').length} install.</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ContentArea>
        </ModulePageShell>
      )}

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
