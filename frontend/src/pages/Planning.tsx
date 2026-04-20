/* eslint-disable react/no-unknown-property */
import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Users, Home, CheckCircle2, Clock, AlertTriangle, 
  ChevronLeft, ChevronRight, MapPin, Wrench, Hammer, Zap,
  Filter, RefreshCw, Package
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

import { db } from '../store/db';
import { PageContainer, PageHeader, ContentArea } from '@components';
import { useAuthStore } from '../store/authStore';
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
const PHASE_ICONS: Record<string, React.ElementType> = {
  PREPARATION: Package,
  MACONNERIE: Hammer,
  RESEAU: Zap,
  INTERIEUR: Wrench,
  CONTROLE: CheckCircle2,
  TERMINE: CheckCircle2,
};

const PHASE_COLORS: Record<string, string> = {
  PREPARATION: 'bg-slate-500',
  MACONNERIE: 'bg-amber-500',
  RESEAU: 'bg-blue-500',
  INTERIEUR: 'bg-purple-500',
  CONTROLE: 'bg-emerald-500',
  TERMINE: 'bg-emerald-600',
};

export default function Planning() {
  useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('ALL');
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const { currentProjectId } = useProject();

  // Requête directe depuis le serveur API
  useEffect(() => {
    const fetchData = async () => {
      if (!currentProjectId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch ménages depuis le serveur
        const [householdsRes, teamsRes] = await Promise.all([
          apiClient.get('/households', { params: { projectId: currentProjectId, limit: 10000 } }),
          apiClient.get('/teams', { params: { projectId: currentProjectId } })
        ]);

        setHouseholds(householdsRes.data.households || []);
        setTeams(teamsRes.data.teams?.filter((t: Team) => t.status === 'active') || []);
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
  }, [currentProjectId]);

  // Transformer les données en tâches de planning
  const tasks = useMemo(() => {
    return households.map(household => {
      const { phase, progress } = getHouseholdPhase(household);
      const estimatedDuration = getEstimatedDuration(phase);
      
      // Calculer si en retard (estimation basée sur la date de création)
      const createdAt = household.createdAt ? new Date(household.createdAt) : new Date();
      const daysElapsed = differenceInDays(new Date(), createdAt);
      const expectedProgress = Math.min((daysElapsed / (estimatedDuration * 5)) * 100, 100);
      const isDelayed = progress < expectedProgress && phase !== 'TERMINE';
      const delayDays = isDelayed ? Math.floor(expectedProgress - progress) : 0;

      return {
        id: household.id,
        householdId: household.id,
        householdName: household.name || 'Inconnu',
        lotNumber: household.numeroordre || '-',
        village: household.village || '-',
        region: household.region || '-',
        phase: phase as PlanningTask['phase'],
        phaseProgress: progress,
        teamId: undefined, // À implémenter avec affectation
        teamName: undefined,
        startDate: createdAt,
        endDate: addDays(createdAt, estimatedDuration),
        plannedDuration: estimatedDuration,
        isDelayed,
        delayDays,
      };
    });
  }, [households]);

  // Grouper par équipe
  const teamPlannings = useMemo((): TeamPlanning[] => {
    const teamMap = new Map<string, TeamPlanning>();
    
    // Ajouter équipe "Non assigné"
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

  // Statistiques globales
  const stats = useMemo(() => {
    const total = tasks.length;
    const byPhase = tasks.reduce((acc, t) => {
      acc[t.phase] = (acc[t.phase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const delayed = tasks.filter(t => t.isDelayed).length;
    const completed = byPhase['TERMINE'] || 0;
    
    return { total, byPhase, delayed, completed };
  }, [tasks]);

  // Filtrer les tâches
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (phaseFilter !== 'ALL' && task.phase !== phaseFilter) return false;
      if (selectedTeam !== 'ALL' && task.teamId !== selectedTeam) return false;
      return true;
    });
  }, [tasks, phaseFilter, selectedTeam]);

  const handleRefresh = async () => {
    if (!currentProjectId) return;
    
    setIsRefreshing(true);
    setIsLoading(true);
    try {
      const [householdsRes, teamsRes] = await Promise.all([
        apiClient.get('/households', { params: { projectId: currentProjectId, limit: 10000 } }),
        apiClient.get('/teams', { params: { projectId: currentProjectId } })
      ]);
      setHouseholds(householdsRes.data.households || []);
      setTeams(teamsRes.data.teams?.filter((t: Team) => t.status === 'active') || []);
    } catch (err) {
      console.error('Erreur refresh:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader 
        title="Planning des Travaux" 
        subtitle="Suivi intelligent de l'avancement par équipe"
        icon={Calendar}
      />
      
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">Chargement des données...</span>
        </div>
      )}

      {!isLoading && (
        <ContentArea>
        {/* ── BARRE D'OUTILS ── */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Filtre Phase */}
            <div className="flex items-center gap-2 bg-slate-900/50 rounded-xl p-1">
              <Filter size={14} className="text-slate-500 ml-2" />
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value as PhaseFilter)}
                className="bg-transparent text-xs font-bold text-slate-400 outline-none py-1"
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
              className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 outline-none"
            >
              <option value="ALL">Toutes équipes</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode de vue */}
            <div className="flex bg-slate-900/50 rounded-xl p-1">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                Calendrier
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'kanban' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-white'}`}
              >
                Kanban
              </button>
            </div>

            <button
              onClick={handleRefresh}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-all"
              title="Actualiser"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── STATISTIQUES ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Home size={14} className="text-blue-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total</span>
            </div>
            <span className="text-2xl font-black text-white">{stats.total}</span>
          </div>
          
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">Terminés</span>
            </div>
            <span className="text-2xl font-black text-emerald-400">{stats.completed}</span>
          </div>

          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-rose-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">En retard</span>
            </div>
            <span className="text-2xl font-black text-rose-400">{stats.delayed}</span>
          </div>

          {Object.entries(stats.byPhase).map(([phase, count]) => {
            const Icon = PHASE_ICONS[phase] || Clock;
            const color = PHASE_COLORS[phase] || 'bg-slate-500';
            return (
              <div key={phase} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{phase}</span>
                </div>
                <span className="text-2xl font-black text-white">{count}</span>
              </div>
            );
          })}
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
                <table className="w-full">
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
                      const PhaseIcon = PHASE_ICONS[task.phase] || Clock;
                      return (
                        <tr key={task.id} className="hover:bg-white/5 transition-colors">
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
                                  style={{ width: `${task.phaseProgress}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">{task.phaseProgress}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-400">{task.teamName || '-'}</span>
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
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
            >
              {['PREPARATION', 'MACONNERIE', 'RESEAU', 'INTERIEUR', 'CONTROLE', 'TERMINE'].map(phase => {
                const phaseTasks = filteredTasks.filter(t => t.phase === phase);
                const Icon = PHASE_ICONS[phase] || Clock;
                return (
                  <div key={phase} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
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
              className="bg-slate-900/50 border border-white/5 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setCurrentDate(addDays(currentDate, -7))}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <ChevronLeft size={20} className="text-slate-400" />
                </button>
                <h3 className="text-lg font-black text-white">
                  {format(currentDate, 'MMMM yyyy', { locale: fr })}
                </h3>
                <button
                  onClick={() => setCurrentDate(addDays(currentDate, 7))}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <ChevronRight size={20} className="text-slate-400" />
                </button>
              </div>
              
              <div className="grid grid-cols-7 gap-2">
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
                      className={`min-h-24 p-2 rounded-lg border ${
                        isCurrentDay 
                          ? 'bg-blue-500/10 border-blue-500/30' 
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

        {/* ── ÉQUIPES ET CHARGE ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamPlannings.filter(tp => tp.team.id !== 'UNASSIGNED' || tp.tasks.length > 0).map(tp => (
            <div key={tp.team.id} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-400" />
                  <span className="text-sm font-bold text-white">{tp.team.name}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  tp.status === 'overloaded' ? 'bg-rose-500/20 text-rose-400' :
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
                      className={`h-full rounded-full transition-all ${
                        tp.utilization > 100 ? 'bg-rose-500' :
                        tp.utilization > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(tp.utilization, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-[10px]">
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
    </PageContainer>
  );
}