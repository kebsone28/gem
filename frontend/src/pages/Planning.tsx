import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, Home, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, MapPin, Wrench, Hammer, Zap,
  Filter, RefreshCw, History, X, ShieldCheck, Download
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { db } from '../store/db';
import { PageContainer, PageHeader, ContentArea } from '@components';
import { useAuthStore } from '../store/authStore';
import { auditService } from '../services/auditService';
import alertsAPI from '../services/alertsAPI';
import { missionSageService } from '../services/ai/MissionSageService';
import type { AIResponse, AIState, RegionalSummary } from '../services/ai/MissionSageService';
import { useProject } from '../contexts/ProjectContext';
import apiClient from '../api/client';
import type { Household, Team } from '../utils/types';

// Types pour le planning
interface PlanningTask {
  id: string;
  householdId: string;
  householdName: string;
  lotNumber: string;
  village: string;
  region: string;
  phase: 'PREPARATION' | 'MACONNERIE' | 'RESEAU' | 'INTERIEUR' | 'CONTROLE' | 'TERMINE';
  phaseProgress: number; // 0-100
  teamId?: string;
  existingAlerts?: PlanningAlert[];
  teamName?: string;
  startDate?: Date;
  endDate?: Date;
  plannedDuration: number; // jours
  isDelayed: boolean;
  delayDays: number;
}

interface TeamPlanning {
  team: Team;
  tasks: PlanningTask[];
  utilization: number; // 0-100
  status: 'available' | 'busy' | 'overloaded';
}

type ViewMode = 'calendar' | 'timeline' | 'kanban';
type PhaseFilter = 'ALL' | 'PREPARATION' | 'MACONNERIE' | 'RESEAU' | 'INTERIEUR' | 'CONTROLE' | 'TERMINE';

interface PlanningAlert {
  type: string;
}

interface PlanningAuditLog {
  action: string;
  details: string;
  userName: string;
  timestamp: string;
  severity?: string;
}

type HouseholdWithPlanningMeta = Household & {
  assignedTeamId?: string | null;
  alerts?: PlanningAlert[];
  createdAt?: string;
};

interface HouseholdsResponse {
  households?: HouseholdWithPlanningMeta[];
}

interface TeamsResponse {
  teams?: Team[];
}

// Calculer la phase d'un ménage basé sur koboSync
function getHouseholdPhase(household: Household): { phase: string; progress: number } {
  const sync = household.koboSync;

  if (!sync) return { phase: 'PREPARATION', progress: 0 };

  // Ordre des phases: préparation → maçonnerie → réseau → intérieur → contrôle → terminé
  if (sync.controleOk) return { phase: 'TERMINE', progress: 100 };
  if (sync.interieurOk) return { phase: 'CONTROLE', progress: 80 };
  if (sync.reseauOk) return { phase: 'INTERIEUR', progress: 60 };
  if (sync.maconOk) return { phase: 'RESEAU', progress: 40 };

  return { phase: 'PREPARATION', progress: 20 };
}

// Estimer la durée restante basée sur la phase
function getEstimatedDuration(phase: string): number {
  switch (phase) {
    case 'PREPARATION': return 3;
    case 'MACONNERIE': return 5;
    case 'RESEAU': return 4;
    case 'INTERIEUR': return 3;
    case 'CONTROLE': return 2;
    case 'TERMINE': return 0;
    default: return 3;
  }
}

// Icônes par phase
const PHASE_COLORS: Record<string, string> = {
  PREPARATION: 'bg-slate-500',
  MACONNERIE: 'bg-amber-500',
  RESEAU: 'bg-blue-500',
  INTERIEUR: 'bg-purple-500',
  CONTROLE: 'bg-emerald-500',
  TERMINE: 'bg-emerald-600',
};

export default function Planning() {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedTrade, setSelectedTrade] = useState<string>('ALL');
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [targetMonths, setTargetMonths] = useState<number>(6);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAudit, setShowAudit] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [historyLogs, setHistoryLogs] = useState<PlanningAuditLog[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState<AIResponse | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const { activeProjectId, project } = useProject();

  // Requête directe depuis le serveur API
  useEffect(() => {
    const fetchData = async () => {
      if (!activeProjectId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch ménages depuis le serveur
        const [householdsRes, teamsRes] = await Promise.all([
          apiClient.get('/households', { params: { projectId: activeProjectId, limit: 10000 } }),
          apiClient.get('/teams', { params: { projectId: activeProjectId } })
        ]);

        setHouseholds(((householdsRes.data as HouseholdsResponse).households || []));
        setTeams(((teamsRes.data as TeamsResponse).teams || []).filter((t: Team) => t.status === 'active'));
      } catch (err) {
        console.error('Erreur fetch planning:', err);
        // Fallback: utiliser données locales
        const [h, t] = await Promise.all([
          db.households.filter(household => household.status !== 'DELETED').toArray(),
          db.teams.filter(team => team.status === 'active').toArray()
        ]);
        setHouseholds(h);
        setTeams(t);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeProjectId]);

  // 🔄 Synchronisation de l'historique
  // Récupérer l'historique des changements (Audit Trail)
  const fetchHistory = useCallback(async () => {
    try {
      const res = await apiClient.get('/audit-logs', { params: { module: 'PLANNING', limit: 20 } });
      setHistoryLogs(res.data.logs || []);
    } catch (err) {
      console.error('Erreur fetch history:', err);
    }
  }, []);

  useEffect(() => {
    if (showAudit) fetchHistory();
  }, [showAudit, fetchHistory]);

  // WebSocket - Mise à jour en temps réel (Simulation)
  useEffect(() => {
    if (!activeProjectId) return;

    // Ici on simulerait l'écoute d'un canal socket.io : socket.on('planning_update', ...)
    const interval = setInterval(() => {
      console.log('[Planning] Vérification silencieuse des mises à jour...');
      // On pourrait déclencher un fetch partiel ici
    }, 60000); // Toutes les minutes

    return () => clearInterval(interval);
  }, [activeProjectId]);

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
    return Array.from(new Set(households.map(h => h.region).filter(Boolean))).sort();
  }, [households]);

  // 1. Calculer les besoins théoriques en équipes
  const theoreticalNeeds = useMemo(() => {
    const total = selectedRegion === 'ALL'
      ? households.length
      : households.filter(h => h.region === selectedRegion).length;

    if (total === 0 || targetMonths <= 0) return null;

    const workingDays = targetMonths * 22; // Moyenne de 22 jours ouvrés par mois
    const productionRates = project?.config?.productionRates || {
      macons: 5,
      reseau: 8,
      interieur_type1: 6,
      controle: 15,
    };

    return {
      macons: Math.ceil(total / (workingDays * productionRates.macons)),
      reseau: Math.ceil(total / (workingDays * productionRates.reseau)),
      interieur: Math.ceil(total / (workingDays * productionRates.interieur_type1)),
      controle: Math.ceil(total / (workingDays * productionRates.controle)),
      workingDays,
    };
  }, [households, targetMonths, project?.config?.productionRates, selectedRegion]);

  // Transformer les données en tâches de planning
  const tasks = useMemo((): PlanningTask[] => {
    // Groupement par village pour l'affectation dynamique
    const villages = Array.from(new Set(households.map(h => h.village || 'Sans Village')));

    return households.map(household => {
      const { phase, progress } = getHouseholdPhase(household);
      const estimatedDuration = getEstimatedDuration(phase);

      // Calculer si en retard (estimation basée sur la date de création)
      const createdAt = household.createdAt ? new Date(household.createdAt) : new Date();
      const daysElapsed = differenceInDays(new Date(), createdAt);
      const expectedProgress = Math.min((daysElapsed / (estimatedDuration * 5)) * 100, 100);
      const isDelayed = progress < expectedProgress && phase !== 'TERMINE';
      const delayDays = isDelayed ? Math.floor(expectedProgress - progress) : 0;

      // Affectation dynamique par village (grappe)
      // PRIORITÉ 1: Affectation manuelle forcée (si présente en base)
      // PRIORITÉ 2: Calcul automatique par index de village
      const manualTeamId = (household as HouseholdWithPlanningMeta).assignedTeamId;
      const villageIndex = villages.indexOf(household.village || 'Sans Village');
      const tradeTeams = teams.filter(t => t.tradeKey === 'interieur_type1');

      const assignedTeam = manualTeamId
        ? teams.find(t => t.id === manualTeamId)
        : tradeTeams.length > 0
          ? tradeTeams[villageIndex % tradeTeams.length]
          : undefined;

      return {
        id: household.id,
        householdId: household.id,
        householdName: household.name || 'Inconnu',
        lotNumber: household.numeroordre || '-',
        village: household.village || '-',
        region: household.region || '-',
        phase: phase as PlanningTask['phase'],
        phaseProgress: progress,
        teamId: assignedTeam?.id,
        existingAlerts: household.alerts || [],
        teamName: assignedTeam?.name,
        startDate: createdAt,
        endDate: addDays(createdAt, estimatedDuration),
        plannedDuration: estimatedDuration,
        isDelayed,
        delayDays,
      };
    });
  }, [households, teams]);

  // Synchronisation des alertes de retard avec le backend
  useEffect(() => {
    const syncAlerts = async () => {
      const delayedTasks = tasks.filter(t => t.isDelayed && t.phase !== 'TERMINE');
      if (delayedTasks.length === 0 || !activeProjectId) return;

      try {
        // On ne crée des alertes que pour les retards importants (> 3 jours)
        // et si aucune alerte de ce type (PVRET) n'existe déjà pour ce ménage.
        // Utilisation de `t.existingAlerts` qui est maintenant dans PlanningTask
        // pour éviter de spammer les alertes.
        // Le `household.alerts` est récupéré lors du fetch initial et passé dans `PlanningTask`.

        const criticalDelays = delayedTasks.filter(t =>
          t.delayDays > 3 &&
          !t.existingAlerts?.some(a => a.type === 'PVRET')
        );

        for (const task of criticalDelays) {
          await alertsAPI.createAlert({
            projectId: activeProjectId,
            householdId: task.id,
            type: 'PVRET',
            severity: 'HIGH',
            title: `Retard critique : ${task.householdName}`,
            description: `Le ménage est bloqué en phase ${task.phase} depuis ${task.delayDays} jours.`,
          });
        }
      } catch (err) {
        console.error('Erreur sync alertes planning:', err);
      }
    };
    syncAlerts();
  }, [tasks, activeProjectId]);

  // 👥 Grouper par équipe
  const teamPlannings = useMemo((): TeamPlanning[] => {
    const teamMap = new Map<string, TeamPlanning>();

    // Ajouter l'équipe "Non assigné"
    teamMap.set('UNASSIGNED', {
      team: { id: 'UNASSIGNED', name: 'Non assignés', projectId: '', organizationId: '', level: 0, role: 'INSTALLATION', capacity: 0, status: 'active' } as unknown as Team,
      tasks: [],
      utilization: 0,
      status: 'available',
    });

    // Ajouter chaque équipe
    teams.forEach(team => {
      teamMap.set(team.id, {
        team,
        tasks: [],
        utilization: 0,
        status: 'available',
      });
    });

    // Assigner les tâches aux équipes
    tasks.forEach(task => {
      if (task.teamId && teamMap.has(task.teamId)) {
        const tp = teamMap.get(task.teamId)!;
        tp.tasks.push(task);
      } else {
        // Non assigné
        const unassigned = teamMap.get('UNASSIGNED')!;
        unassigned.tasks.push(task);
      }
    });

    // Calculer l'utilization
    teamMap.forEach((tp, teamId) => {
      if (teamId === 'UNASSIGNED') return;
      const activeTasks = tp.tasks.filter(t => t.phase !== 'TERMINE').length;
      const utilization = Math.min((activeTasks / (tp.team.capacity || 1)) * 100, 150);
      tp.utilization = utilization;
      tp.status = utilization > 100 ? 'overloaded' : utilization > 70 ? 'busy' : 'available';
    });

    return Array.from(teamMap.values()).filter(tp => tp.tasks.length > 0 || tp.team.id === 'UNASSIGNED');
  }, [tasks, teams]);

  // 📊 Statistiques globales (IGPP ready)
  const stats = useMemo(() => {
    const relevantTasks = tasks.filter(t => selectedRegion === 'ALL' || t.region === selectedRegion);
    const total = relevantTasks.length;
    const byPhase = relevantTasks.reduce((acc, t) => { // Correction: utiliser relevantTasks
      acc[t.phase] = (acc[t.phase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const delayed = relevantTasks.filter(t => t.isDelayed).length;
    const completed = byPhase['TERMINE'] || 0;

    return { total, byPhase, delayed, completed };
  }, [tasks, selectedRegion]);

  // Analyse IA Proactive
  useEffect(() => {
    const getAiAdvice = async () => {
      if (households.length > 0 && !isLoading && teams.length > 0) {
        // Préparer un résumé régional pour l'IA
        const regionalSummaries: RegionalSummary[] = availableRegions.map(region => {
          const householdsInRegion = households.filter(h => region === 'ALL' || h.region === region);
          const tasksInRegion = tasks.filter(t => region === 'ALL' || t.region === region);
          const delayedHouseholds = tasksInRegion.filter(t => t.isDelayed).length;
          const teamsAssigned: { [tradeKey: string]: number } = {};
          teams.forEach(team => {
            if (team.regionId === region) { // Assumer que team.regionId existe
              teamsAssigned[team.tradeKey || 'unknown'] = (teamsAssigned[team.tradeKey || 'unknown'] || 0) + 1;
            }
          });
          return {
            region,
            totalHouseholds: householdsInRegion.length,
            delayedHouseholds,
            teamsAssigned,
          };
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
    return tasks.filter(task => {
      if (selectedRegion !== 'ALL' && task.region !== selectedRegion) return false;
      if (phaseFilter !== 'ALL' && task.phase !== phaseFilter) return false;
      if (selectedTeam !== 'ALL' && task.teamId !== selectedTeam) return false;
      return true;
    });
  }, [tasks, phaseFilter, selectedTeam, selectedRegion]);

  // ✍️ Gestion des affectations manuelles
  const handleRefresh = useCallback(async () => {
    if (!activeProjectId) return;

    setIsRefreshing(true);
    setIsLoading(true);
    try {
      const [householdsRes, teamsRes] = await Promise.all([
        apiClient.get('/households', { params: { projectId: activeProjectId, limit: 10000 } }),
        apiClient.get('/teams', { params: { projectId: activeProjectId } })
      ]);
      setHouseholds(((householdsRes.data as HouseholdsResponse).households || []));
      setTeams(((teamsRes.data as TeamsResponse).teams || []).filter((t: Team) => t.status === 'active'));
    } catch (err) {
      console.error('Erreur refresh:', err);
      // Fallback : utiliser les données locales en cas d'échec critique du serveur (500)
      const [h, t] = await Promise.all([
        db.households.filter(household => household.status !== 'DELETED').toArray(),
        db.teams.filter(team => team.status === 'active').toArray()
      ]);
      setHouseholds(h);
      setTeams(t);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      toast.success('Planning actualisé'); // Feedback utilisateur
    }
  }, [activeProjectId]);

  const handleManualAssign = useCallback(async (householdId: string, teamId: string) => {
    try {
      const value = teamId === 'AUTO' ? null : teamId; // null pour revenir à la logique de grappe
      await apiClient.patch(`/households/${householdId}`, { assignedTeamId: value }); // Enregistrement sur le serveur

      if (user) {
        const h = households.find(h => h.id === householdId);
        const t = teams.find(t => t.id === teamId);
        const teamLabel = teamId === 'AUTO' ? 'Automatique (Village)' : (t?.name || teamId);
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
      households.map((household) => [
        household.id,
        (household as HouseholdWithPlanningMeta).assignedTeamId || null,
      ])
    );
  }, [households]);

  return (
    <PageContainer>
      <PageHeader
        title="Planning des Travaux"
        subtitle="Suivi intelligent de l'avancement par équipe"
        icon={Calendar}
        actions={
          <button
            onClick={() => setShowAudit(true)}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-[0.14em] sm:tracking-widest transition-all border border-white/5 active:scale-95 shadow-lg"
          >
            <History size={16} /> Historique
          </button>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">Chargement des données...</span>
        </div>
      )}

      {!isLoading && (
        <ContentArea>
          {/* ── MOTEUR D'ORCHESTRATION DYNAMIQUE ── */}
          <div className="mb-4 sm:mb-8 p-4 sm:p-6 bg-indigo-600/20 border border-indigo-500/30 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Zap size={120} className="text-indigo-400" />
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 relative z-10">
              <div className="space-y-1 flex-1">
                <h3 className="text-base sm:text-lg font-black text-white uppercase italic tracking-tighter">Objectif de Réalisation</h3>
                <p className="text-[10px] sm:text-xs text-indigo-300/70 font-bold uppercase tracking-[0.14em] sm:tracking-widest">Calcul dynamique des ressources nécessaires</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr,auto,auto] items-center gap-3 sm:gap-4 w-full md:w-auto bg-slate-950/50 p-3 sm:p-2 rounded-2xl border border-white/5">
                <span className="text-[10px] font-black text-slate-500 uppercase sm:ml-4">Région :</span>
                <select
                  value={selectedRegion} // selectedRegion est déjà 'ALL' par défaut
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl px-3 py-2 text-white font-bold text-[11px] sm:text-[10px] outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                  title="Sélectionner la région pour le calcul"
                >
                  <option value="ALL">Toutes les régions</option>
                  {availableRegions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                <span className="text-[10px] font-black text-slate-500 uppercase sm:ml-4">Durée Cible :</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={targetMonths}
                    onChange={(e) => setTargetMonths(Math.max(1, Number(e.target.value)))} // Minimum 1 mois
                    title="Durée cible en mois"
                    className="w-16 bg-indigo-500/20 border border-indigo-500/30 rounded-xl px-3 py-2 text-white font-black text-center outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] sm:text-xs font-bold text-indigo-400 sm:mr-4">MOIS</span>
                </div>
              </div>
            </div>

            {theoreticalNeeds && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-5 sm:mt-8">
                {[
                  { label: 'Équipes Maçons', value: theoreticalNeeds.macons, icon: Hammer, color: 'text-amber-500' },
                  { label: 'Équipes Réseau', value: theoreticalNeeds.reseau, icon: Zap, color: 'text-blue-500' },
                  { label: 'Électriciens', value: theoreticalNeeds.interieur, icon: Wrench, color: 'text-purple-500' },
                  { label: 'Contrôleurs', value: theoreticalNeeds.controle, icon: ShieldCheck, color: 'text-emerald-500' } // Icône ShieldCheck
                ].map((need, idx) => (
                  <div key={idx} className="bg-slate-950/40 p-3 sm:p-4 rounded-2xl border border-white/5 flex items-center gap-3 sm:gap-4">
                    <div className={`p-2 rounded-lg bg-white/5 ${need.color}`}><need.icon size={16} /></div>
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-tight">{need.label}</p>
                      <p className="text-lg sm:text-xl font-black text-white leading-none">{need.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── BARRE D'OUTILS ── */}
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-stretch lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Filtre Phase */}
              <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-2 sm:p-1">
                <Filter size={14} className="text-slate-500 ml-2" />
                <select
                  value={phaseFilter}
                  onChange={(e) => setPhaseFilter(e.target.value as PhaseFilter)}
                  className="bg-transparent text-[11px] sm:text-xs font-bold text-slate-400 outline-none py-1 min-w-0"
                  title="Filtrer par phase"
                >
                  <option value="ALL">Toutes phases</option>
                  <option value="PREPARATION">Préparation</option>
                  <option value="MACONNERIE">Maçonnerie</option>
                  <option value="RESEAU">Réseau</option>
                  <option value="INTERIEUR">Intérieur</option>
                  <option value="CONTROLE">Contrôle</option>
                  <option value="TERMINE">Terminé</option>
                </select>
              </div>

              {/* Filtre Équipe */}
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-400 outline-none w-full sm:w-auto"
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
              <div className="grid grid-cols-3 bg-slate-900/50 rounded-xl p-1 w-full sm:w-auto">
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  Chronologie
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  Calendrier
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${viewMode === 'kanban' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  Tableau de Flux
                </button>
              </div>

              <button
                onClick={handleRefresh}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-all self-end sm:self-auto"
                title="Actualiser"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* ── CONSEILLER IA (MISSION SAGE) ── */}
          {aiRecommendation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-blue-500/20 border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3 sm:gap-4"
            >
              <div className="p-2 bg-blue-500 rounded-xl text-white">
                <Zap size={20} />
              </div>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                  <h4 className="text-[11px] sm:text-xs font-black text-blue-400 uppercase tracking-[0.14em] sm:tracking-widest">Conseil Intelligent</h4>
                  <span className="text-[10px] text-blue-500/60 font-mono">MissionSage v8.0</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed italic">
                  "{aiRecommendation.message}"
                </p>
                {aiRecommendation.actionLabel && (
                  <button className="mt-2 text-[10px] font-bold text-blue-400 hover:underline uppercase">
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
                <span className="text-[10px] font-bold text-slate-500 uppercase">Total</span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-white">{stats.total}</span>
            </div>

            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Terminés</span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">{stats.completed}</span>
            </div>

            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-rose-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">En retard</span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-rose-400">{stats.delayed}</span>
            </div>

            {Object.entries(stats.byPhase).map(([phase, count]) => {
              const color = PHASE_COLORS[phase] || 'bg-slate-500';
              return (
                <div key={phase} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{phase}</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-white">{count}</span>
                </div>
              );
            })}
          </div>

          {/* ── GRAPHIQUE COMPARATIF BESOINS THÉORIQUES VS RÉELLEMENT AFFECTÉS PAR RÉGION ── */}
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 sm:p-6 mt-4 sm:mt-8">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 sm:mb-6">
              Comparatif Capacités Régionales (Théorique vs Réel)
            </h3>
            <div className="space-y-4 sm:space-y-8">
              {availableRegions.map(region => {
                const householdsInRegion = households.filter(h => h.region === region);
                const totalHouseholdsInRegion = householdsInRegion.length;

                // Recalculer les besoins théoriques pour cette région
                const regionalTheoreticalNeeds = (() => {
                  if (totalHouseholdsInRegion === 0 || targetMonths <= 0) return null;
                  const workingDays = targetMonths * 22;
                  const productionRates = project?.config?.productionRates || {
                    macons: 5, reseau: 8, interieur_type1: 6, controle: 15,
                  };
                  return {
                    macons: Math.ceil(totalHouseholdsInRegion / (workingDays * productionRates.macons)),
                    reseau: Math.ceil(totalHouseholdsInRegion / (workingDays * productionRates.reseau)),
                    interieur: Math.ceil(totalHouseholdsInRegion / (workingDays * productionRates.interieur_type1)),
                    controle: Math.ceil(totalHouseholdsInRegion / (workingDays * productionRates.controle)),
                  };
                })();

                // Compter les équipes réellement affectées à cette région
                const regionalActualTeams: { [tradeKey: string]: number } = {
                  macons: 0, reseau: 0, interieur_type1: 0, controle: 0,
                };
                teams.filter(t => t.regionId === region).forEach(team => {
                  if (team.tradeKey) {
                    regionalActualTeams[team.tradeKey] = (regionalActualTeams[team.tradeKey] || 0) + 1;
                  }
                });

                if (!regionalTheoreticalNeeds && totalHouseholdsInRegion === 0) return null;

                return (
                  <div key={region} className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                    <h4 className="text-sm font-black text-white mb-4">{region} ({totalHouseholdsInRegion} ménages)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {Object.entries(regionalTheoreticalNeeds || {}).map(([trade, theoreticalCount]) => {
                        const actualCount = regionalActualTeams[trade] || 0;
                        const diff = actualCount - (theoreticalCount as number);
                        const isOver = diff > 0;
                        return (
                          <div key={trade} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                            <span className="text-xs font-bold text-slate-400 uppercase">{trade.replace('_type1', '')}</span>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black text-white">{theoreticalCount}</span>
                              <span className="text-xs text-slate-500">théorique</span>
                              <span className="text-sm font-black text-white">/</span>
                              <span className="text-sm font-black text-white">{actualCount}</span>
                              <span className="text-xs text-slate-500">réel</span>
                              {diff !== 0 && (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isOver ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
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
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Timeline des travaux</h3>
                </div>
                <div className="overflow-x-auto">
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
                      {filteredTasks.slice(0, 50).map(task => {
                        const isCriticallyDelayed = task.isDelayed && task.delayDays > 5;
                        const assignedTeamId = assignedTeamByHousehold.get(task.householdId) || 'AUTO';
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
                                <span className="text-xs font-bold text-slate-300">{task.phase}</span>
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
                                  <option value="AUTO">🤖 Auto (Grappe)</option>
                                  {teams.map(t => (
                                    <option key={t.id} value={t.id}>👷 {t.name}</option>
                                  ))}
                                </select>
                                {assignedTeamId !== 'AUTO' && <span className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter">FORCÉ</span>}
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

            {viewMode === 'kanban' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4"
              >
                {['PREPARATION', 'MACONNERIE', 'RESEAU', 'INTERIEUR', 'CONTROLE', 'TERMINE'].map(phase => {
                  const phaseTasks = filteredTasks.filter(t => t.phase === phase);
                  return (
                    <div key={phase} className="bg-slate-900/50 border border-white/5 rounded-2xl p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${PHASE_COLORS[phase]}`} />
                          <span className="text-xs font-bold text-slate-400">{phase}</span>
                        </div>
                        <span className="text-xs font-black text-white">{phaseTasks.length}</span>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {phaseTasks.slice(0, 10).map(task => (
                          <div key={task.id} className="p-2 bg-slate-800/50 rounded-lg">
                            <div className="text-[10px] font-bold text-white truncate">{task.householdName}</div>
                            <div className="text-[8px] text-slate-500">{task.lotNumber} • {task.village}</div>
                          </div>
                        ))}
                        {phaseTasks.length > 10 && (
                          <div className="text-[8px] text-slate-500 text-center">+{phaseTasks.length - 10} autres</div>
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
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Semaine précédente"
                  >
                    <ChevronLeft size={20} className="text-slate-400" />
                  </button>
                  <h3 className="text-base sm:text-lg font-black text-white text-center flex-1">
                    {format(currentDate, 'MMMM yyyy', { locale: fr })}
                  </h3>
                  <button
                    onClick={() => setCurrentDate(addDays(currentDate, 7))}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Semaine suivante"
                  >
                    <ChevronRight size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-slate-500 uppercase py-2">
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── GRAPHIQUE DE CHARGE PAR ÉQUIPE ── */}
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 sm:p-6 mt-4 sm:mt-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Charge des Équipes</h3>
              
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-1.5 border border-white/5">
                <Filter size={12} className="text-slate-500" />
                <select
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="bg-transparent text-[10px] font-black uppercase text-slate-400 outline-none cursor-pointer"
                  title="Filtrer par type de métier"
                >
                  <option value="ALL">Tous les métiers</option>
                  <option value="macons">👷 Maçonnerie</option>
                  <option value="reseau">⚡ Réseau</option>
                  <option value="interieur_type1">🏠 Intérieur</option>
                  <option value="controle">🛡️ Contrôle</option>
                </select>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {teamPlannings.filter(tp => {
                if (tp.team.id === 'UNASSIGNED') return tp.tasks.length > 0 && selectedTrade === 'ALL';
                if (selectedTrade !== 'ALL' && tp.team.tradeKey !== selectedTrade) return false;
                return true;
              }).map(tp => (
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
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>{tp.tasks.filter(t => t.phase === 'MACONNERIE').length} maçon.</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span>{tp.tasks.filter(t => t.phase === 'RESEAU').length} réseau</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span>{tp.tasks.filter(t => t.phase === 'INTERIEUR').length} int.</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ÉQUIPES ET CHARGE ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {teamPlannings.filter(tp => {
              if (tp.team.id === 'UNASSIGNED') return tp.tasks.length > 0 && selectedTrade === 'ALL';
              if (selectedTrade !== 'ALL' && tp.team.tradeKey !== selectedTrade) return false;
              return true;
            }).map(tp => (
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
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-slate-500">{tp.tasks.filter(t => t.phase === 'MACONNERIE').length} maçon.</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span className="text-slate-500">{tp.tasks.filter(t => t.phase === 'RESEAU').length} réseau</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span className="text-slate-500">{tp.tasks.filter(t => t.phase === 'INTERIEUR').length} int.</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ContentArea>
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
              className="relative w-full max-w-md bg-slate-900 h-full shadow-2xl border-l border-white/10 p-4 sm:p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-3 mb-5 sm:mb-8">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white uppercase italic tracking-tighter">Journal d'Audit</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.14em] sm:tracking-widest">Activités récentes du planning</p>
                </div>
                <button onClick={() => setShowAudit(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-colors" title="Fermer" aria-label="Fermer le journal d'audit">
                  <X size={24} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Filtrer par utilisateur ou détail..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  onClick={handleExportHistoryToExcel}
                  className="p-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-600/20 transition-all"
                  title="Exporter en Excel"
                >
                  <Download size={16} /> {/* Correction: Utilisation de l'icône Download */}
                </button>
                <button onClick={() => setShowAudit(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-colors" title="Fermer" aria-label="Fermer le journal d'audit">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {historyLogs.length === 0 ? (
                  <div className="text-center py-20 text-slate-600">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">Aucun mouvement récent</p>
                  </div>
                ) : (
                  filteredHistoryLogs.map((log, idx: number) => (
                    <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{log.action}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{format(new Date(log.timestamp), 'dd MMM, HH:mm', { locale: fr })}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                        {log.details}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center text-[8px] text-indigo-400 font-black">
                          {log.userName?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase italic">{log.userName}</span>
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
