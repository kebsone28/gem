import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  GraduationCap,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageContainer, PageHeader } from '../components';
import { useAuth } from '../contexts/AuthContext';
import {
  evaluateFormationExpert,
  type FormationExpertActionId,
  type FormationExpertReplyOption,
} from '../services/formationExpertEngine';

const API_BASE = '/api/formations';

const SENEGAL_REGIONS = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kedougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sedhiou',
  'Tambacounda',
  'Thies',
  'Ziguinchor',
] as const;

type RegionName = typeof SENEGAL_REGIONS[number];
type PageTab = 'planner' | 'sessions' | 'modules';
type PlannerExperienceMode = 'ai' | 'manual';
type PlannerDeliveryMode = 'single' | 'multiple';

interface FormationModule {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  order: number;
  isActive?: boolean;
}

interface SessionModule {
  id: string;
  sessionId: string;
  moduleId: string;
  duration: number | null;
  orderIndex: number;
  notes: string | null;
  module: FormationModule;
}

interface FormationParticipant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  attendance: boolean;
}

interface FormationSession {
  id: string;
  region: string;
  salle: string;
  maxParticipants: number;
  startDate: string;
  endDate?: string;
  workSaturday: boolean;
  workSunday: boolean;
  status: string;
  notes?: string | null;
  sessionModules: SessionModule[];
  participants: FormationParticipant[];
}

interface RegionInput {
  region: RegionName;
  selected: boolean;
  participants: number;
  priority: number;
  preferredRoomId: string;
}

interface TrainerResource {
  id: string;
  name: string;
  active: boolean;
  unavailableDates: string[];
}

interface RoomResource {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
  unavailableDates: string[];
}

interface PlannerConfig {
  startDate: string;
  maxParticipantsPerSession: number;
  includeSaturday: boolean;
  daysBetweenSessions: number;
  blockedDatesText: string;
  holidaysText: string;
  equipmentPool: number;
  equipmentPerParticipant: number;
}

interface PreviewSession {
  id: string;
  region: string;
  priority: number;
  indexInRegion: number;
  participants: number;
  trainerId: string;
  trainerName: string;
  roomId: string;
  roomName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  fillRate: number;
  equipmentNeeded: number;
  modules: Array<{ moduleId: string; name: string; duration: number }>;
}

interface PreviewPlan {
  sessions: PreviewSession[];
  alerts: string[];
  impossibleRegions: string[];
}

interface PlanningHistoryEntry {
  id: string;
  timestamp: string;
  type: 'preview_generated' | 'preview_updated' | 'preview_persisted' | 'session_updated' | 'session_deleted';
  title: string;
  details: string;
}

interface PreviewSessionEditState {
  id: string;
  region: string;
  participants: number;
  startDate: string;
  trainerId: string;
  roomId: string;
}

interface BackendSessionEditState {
  id: string;
  region: string;
  salle: string;
  maxParticipants: number;
  startDate: string;
  workSaturday: boolean;
  workSunday: boolean;
  status: string;
  notes: string;
  cascadeRegion: boolean;
}

interface StatsResponse {
  totalSessions?: number;
  totalParticipants?: number;
  byRegion?: Array<{ region: string; count: number }>;
  byModule?: Array<{ module: string; count: number }>;
}

interface ApiHistoryEntry {
  id: string;
  action?: string;
  title?: string;
  details?: string | null;
  timestamp?: string;
  createdAt?: string;
}

interface TimelineDay {
  iso: string;
  label: string;
  shortLabel: string;
}

interface ExpertConversationMessage {
  id: string;
  role: 'assistant' | 'system' | 'user';
  title: string;
  body: string;
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erreur serveur (${response.status})`);
  }
  return response.json();
};

const downloadResponseBlob = async (response: Response, fallbackFileName: string) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Erreur serveur (${response.status})`);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || fallbackFileName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const formationApi = {
  getModules: (): Promise<FormationModule[]> => fetch(`${API_BASE}/modules`).then(handleResponse),
  createModule: (data: Partial<FormationModule>) =>
    fetch(`${API_BASE}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  updateModule: (id: string, data: Partial<FormationModule>) =>
    fetch(`${API_BASE}/modules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  deleteModule: (id: string) =>
    fetch(`${API_BASE}/modules/${id}`, { method: 'DELETE' }).then(handleResponse),
  getSessions: (): Promise<FormationSession[]> =>
    fetch(`${API_BASE}/sessions`).then(handleResponse),
  createSession: (data: {
    region: string;
    salle: string;
    maxParticipants: number;
    startDate: string;
    workSaturday: boolean;
    workSunday: boolean;
    notes?: string;
    modules: { moduleId: string; duration?: number; notes?: string; orderIndex?: number }[];
  }) =>
    fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  updateSession: (
    id: string,
    data: {
      region?: string;
      salle?: string;
      maxParticipants?: number;
      startDate?: string;
      workSaturday?: boolean;
      workSunday?: boolean;
      notes?: string;
      status?: string;
      modules?: { moduleId: string; duration?: number; notes?: string; orderIndex?: number }[];
    }
  ) =>
    fetch(`${API_BASE}/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  cascadeSession: (
    id: string,
    data: { startDate: string; region?: string; workSaturday?: boolean; workSunday?: boolean }
  ) =>
    fetch(`${API_BASE}/sessions/${id}/recalculate-cascade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  deleteSession: (id: string) =>
    fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' }).then(handleResponse),
  getHistory: (): Promise<ApiHistoryEntry[]> => fetch(`${API_BASE}/history`).then(handleResponse),
  createHistory: (data: {
    action: string;
    title: string;
    details?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }) =>
    fetch(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  exportPlan: async (data: {
    plan: {
      sessions: Array<{
        region: string;
        groupIndex: number;
        maxParticipants: number;
        startDate: string;
        endDate: string;
        workSaturday: boolean;
        workSunday: boolean;
        salle?: string;
        modules: Array<{ moduleId: string; duration: number }>;
      }>;
    };
    format: 'pdf' | 'docx';
  }) => {
    const response = await fetch(`${API_BASE}/planify/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return downloadResponseBlob(
      response,
      data.format === 'pdf' ? 'plan_formation.pdf' : 'plan_formation.docx'
    );
  },
  getStats: (): Promise<StatsResponse> => fetch(`${API_BASE}/stats`).then(handleResponse),
};

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function parseDateList(text: string) {
  return text
    .split(/[,\n;]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isWorkingDay(date: Date, includeSaturday: boolean, blockedDates: Set<string>) {
  const day = date.getDay();
  const iso = formatDate(date);
  if (blockedDates.has(iso)) return false;
  if (day === 0) return false;
  if (day === 6 && !includeSaturday) return false;
  return true;
}

function computeSessionEndDate(
  startDate: string,
  workUnits: number,
  includeSaturday: boolean,
  blockedDates: Set<string>
) {
  const start = parseDate(startDate);
  if (!start) return startDate;
  let consumed = 0;
  let cursor = new Date(start);

  while (consumed < workUnits) {
    if (isWorkingDay(cursor, includeSaturday, blockedDates)) {
      consumed += 1;
    }
    if (consumed < workUnits) {
      cursor = addDays(cursor, 1);
    }
  }

  return formatDate(cursor);
}

function buildDateRange(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const result: string[] = [];
  if (!start || !end) return result;

  let cursor = new Date(start);
  while (cursor <= end) {
    result.push(formatDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return result;
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const defaultRegionInputs: RegionInput[] = SENEGAL_REGIONS.map((region) => ({
  region,
  selected: false,
  participants: 0,
  priority: 1,
  preferredRoomId: '',
}));

export default function PlanningFormation() {
  useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<PageTab>('planner');
  const [plannerMode, setPlannerMode] = useState<PlannerExperienceMode>('ai');
  const [plannerDeliveryMode, setPlannerDeliveryMode] = useState<PlannerDeliveryMode | null>(null);
  const [aiMobilePhasesOpen, setAiMobilePhasesOpen] = useState(false);

  const [modules, setModules] = useState<FormationModule[]>([]);
  const [sessions, setSessions] = useState<FormationSession[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [previewPlan, setPreviewPlan] = useState<PreviewPlan | null>(null);
  const [historyEntries, setHistoryEntries] = useState<PlanningHistoryEntry[]>([]);

  const [regionInputs, setRegionInputs] = useState<RegionInput[]>(defaultRegionInputs);
  const [plannerConfig, setPlannerConfig] = useState<PlannerConfig>({
    startDate: '',
    maxParticipantsPerSession: 20,
    includeSaturday: false,
    daysBetweenSessions: 1,
    blockedDatesText: '',
    holidaysText: '',
    equipmentPool: 40,
    equipmentPerParticipant: 1,
  });

  const [trainers, setTrainers] = useState<TrainerResource[]>([
    { id: 'TR-1', name: 'Formateur A', active: true, unavailableDates: [] },
    { id: 'TR-2', name: 'Formateur B', active: true, unavailableDates: [] },
    { id: 'TR-3', name: 'Formateur C', active: true, unavailableDates: [] },
  ]);
  const [rooms, setRooms] = useState<RoomResource[]>([
    { id: 'RM-1', name: 'Salle Dakar A', capacity: 20, active: true, unavailableDates: [] },
    { id: 'RM-2', name: 'Salle Thiès B', capacity: 30, active: true, unavailableDates: [] },
    { id: 'RM-3', name: 'Salle Kaolack C', capacity: 50, active: true, unavailableDates: [] },
  ]);

  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [moduleDurations, setModuleDurations] = useState<Record<string, number>>({});

  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingPreviewSession, setEditingPreviewSession] = useState<PreviewSessionEditState | null>(null);
  const [editingBackendSession, setEditingBackendSession] = useState<BackendSessionEditState | null>(null);
  const [draggedPreviewSessionId, setDraggedPreviewSessionId] = useState<string | null>(null);
  const [timelineWindowDays, setTimelineWindowDays] = useState(21);
  const [, setExpertConversation] = useState<ExpertConversationMessage[]>([]);
  const [lastHandledReplyId, setLastHandledReplyId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({
    name: '',
    description: '',
    duration: 1,
    order: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [moduleData, sessionData, statsData, historyData] = await Promise.all([
          formationApi.getModules(),
          formationApi.getSessions(),
          formationApi.getStats(),
          formationApi.getHistory(),
        ]);
        setModules(Array.isArray(moduleData) ? moduleData : []);
        setSessions(Array.isArray(sessionData) ? sessionData : []);
        setStats(statsData ?? null);
        setHistoryEntries(Array.isArray(historyData) ? historyData.map(mapHistoryEntryFromApi) : []);
      } catch (error) {
        console.error(error);
        toast.error('Chargement incomplet des données de formation');
        setModules([]);
        setSessions([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (modules.length === 0) return;
    const activeModules = modules.filter((module) => module.isActive !== false);

    setSelectedModuleIds((current) => {
      if (current.length > 0) return current.filter((id) => activeModules.some((module) => module.id === id));
      return [];
    });

    setModuleDurations((current) => {
      const next = { ...current };
      activeModules.forEach((module) => {
        if (!next[module.id]) next[module.id] = module.duration;
      });
      return next;
    });
  }, [modules]);

  const activeModules = useMemo(
    () => modules.filter((module) => module.isActive !== false).sort((a, b) => a.order - b.order),
    [modules]
  );

  const blockedDates = useMemo(() => {
    return new Set([
      ...parseDateList(plannerConfig.blockedDatesText),
      ...parseDateList(plannerConfig.holidaysText),
    ]);
  }, [plannerConfig.blockedDatesText, plannerConfig.holidaysText]);

  const selectedModules = useMemo(() => {
    return selectedModuleIds
      .map((moduleId) => activeModules.find((module) => module.id === moduleId))
      .filter((module): module is FormationModule => Boolean(module))
      .map((module) => ({
        moduleId: module.id,
        name: module.name,
        duration: Math.max(1, Number(moduleDurations[module.id] || module.duration || 1)),
      }));
  }, [activeModules, moduleDurations, selectedModuleIds]);

  const totalModuleDays = useMemo(
    () => selectedModules.reduce((sum, module) => sum + module.duration, 0),
    [selectedModules]
  );

  const selectedRegions = useMemo(
    () => regionInputs.filter((region) => region.selected && region.participants > 0),
    [regionInputs]
  );

  const plannerSummary = useMemo(() => {
    const totalParticipants = selectedRegions.reduce((sum, region) => sum + region.participants, 0);
    const totalSessions = selectedRegions.reduce(
      (sum, region) => sum + Math.ceil(region.participants / Math.max(1, plannerConfig.maxParticipantsPerSession)),
      0
    );

    return {
      totalParticipants,
      totalSessions,
      totalRegions: selectedRegions.length,
    };
  }, [plannerConfig.maxParticipantsPerSession, selectedRegions]);

  const generatedIndicators = useMemo(() => {
    const sessionsCount = previewPlan?.sessions.length || 0;
    const participantsCount = previewPlan?.sessions.reduce((sum, session) => sum + session.participants, 0) || 0;
    const averageFillRate = sessionsCount
      ? Math.round(
          (previewPlan?.sessions.reduce((sum, session) => sum + session.fillRate, 0) || 0) / sessionsCount
        )
      : 0;

    return {
      sessionsCount,
      participantsCount,
      averageFillRate,
      alertCount: previewPlan?.alerts.length || 0,
    };
  }, [previewPlan]);

  const filteredBackendSessions = useMemo(() => {
    return [...sessions].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [sessions]);

  const timelineDays = useMemo((): TimelineDay[] => {
    if (!previewPlan || previewPlan.sessions.length === 0) return [];

    const sortedSessions = [...previewPlan.sessions].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const minDate = parseDate(sortedSessions[0].startDate);
    if (!minDate) return [];

    const days = Array.from({ length: Math.max(7, timelineWindowDays) }, (_, index) => {
      const date = addDays(minDate, index);
      return {
        iso: formatDate(date),
        label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        shortLabel: date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
      };
    });

    return days;
  }, [previewPlan, timelineWindowDays]);

  const timelineRegions = useMemo(() => {
    if (!previewPlan) return [];
    return Array.from(new Set(previewPlan.sessions.map((session) => session.region)));
  }, [previewPlan]);

  const participantsPlanned = useMemo(() => selectedRegions.reduce((sum, region) => sum + region.participants, 0), [selectedRegions]);
  const prioritizedRegionsCount = useMemo(() => selectedRegions.filter((region) => region.priority > 1).length, [selectedRegions]);
  const activeTrainerCount = useMemo(() => trainers.filter((trainer) => trainer.active).length, [trainers]);
  const activeRoomCount = useMemo(() => rooms.filter((room) => room.active).length, [rooms]);
  const roomCapacityMax = useMemo(() => rooms.filter((room) => room.active).reduce((max, room) => Math.max(max, room.capacity), 0), [rooms]);

  const expertEvaluation = useMemo(() => {
    return evaluateFormationExpert({
      startDate: plannerConfig.startDate,
      maxParticipantsPerSession: plannerConfig.maxParticipantsPerSession,
      includeSaturday: plannerConfig.includeSaturday,
      equipmentPool: plannerConfig.equipmentPool,
      deliveryModeConfigured: plannerDeliveryMode !== null,
      deliveryMode: plannerDeliveryMode,
      selectedRegionsCount: selectedRegions.length,
      participantsPlanned,
      prioritizedRegionsCount,
      selectedModuleCount: selectedModules.length,
      totalModuleDays,
      activeTrainerCount,
      activeRoomCount,
      roomCapacityMax,
      blockedDatesCount: blockedDates.size,
      previewSessionCount: previewPlan?.sessions.length || 0,
      previewAlertCount: previewPlan?.alerts.length || 0,
    });
  }, [
    blockedDates.size,
    plannerConfig.equipmentPool,
    plannerConfig.includeSaturday,
    plannerConfig.maxParticipantsPerSession,
    plannerConfig.startDate,
    plannerDeliveryMode,
    previewPlan?.sessions?.length,
    previewPlan?.alerts?.length,
    selectedModules.length,
    selectedRegions.length,
    participantsPlanned,
    prioritizedRegionsCount,
    totalModuleDays,
    activeTrainerCount,
    activeRoomCount,
    roomCapacityMax,
  ]);

  const addHistoryEntry = (
    type: PlanningHistoryEntry['type'],
    title: string,
    details: string
  ) => {
    setHistoryEntries((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        type,
        title,
        details,
      },
      ...current,
    ].slice(0, 20));
  };

  const persistHistoryEntry = async (
    action: string,
    title: string,
    details: string,
    sessionId?: string,
    metadata?: Record<string, unknown>
  ) => {
    try {
      const entry = await formationApi.createHistory({ action, title, details, sessionId, metadata });
      if (entry) {
        setHistoryEntries((current) => [mapHistoryEntryFromApi(entry), ...current].slice(0, 20));
      }
    } catch (error) {
      console.error('Erreur persistence historique formation', error);
    }
  };

  const applyPreviewSessionUpdate = (
    sessionId: string,
    updates: Partial<
      Pick<PreviewSessionEditState, 'region' | 'participants' | 'startDate' | 'trainerId' | 'roomId'>
    >
  ) => {
    if (!previewPlan) return { ok: false as const, reason: 'Planning indisponible' };

    const source = previewPlan.sessions.find((session) => session.id === sessionId);
    if (!source) return { ok: false as const, reason: 'Session introuvable' };

    const room = rooms.find((item) => item.id === (updates.roomId ?? source.roomId));
    const trainer = trainers.find((item) => item.id === (updates.trainerId ?? source.trainerId));
    if (!room || !trainer) {
      return { ok: false as const, reason: 'Ressources invalides' };
    }

    const nextStartDate = updates.startDate ?? source.startDate;
    const nextParticipants = updates.participants ?? source.participants;
    const endDate = computeSessionEndDate(
      nextStartDate,
      totalModuleDays,
      plannerConfig.includeSaturday,
      blockedDates
    );

    const updatedSession: PreviewSession = {
      ...source,
      region: updates.region ?? source.region,
      participants: nextParticipants,
      startDate: nextStartDate,
      endDate,
      trainerId: trainer.id,
      trainerName: trainer.name,
      roomId: room.id,
      roomName: room.name,
      durationDays: diffDaysInclusive(nextStartDate, endDate),
      fillRate: Math.round((nextParticipants / plannerConfig.maxParticipantsPerSession) * 100),
      equipmentNeeded: nextParticipants * Math.max(1, plannerConfig.equipmentPerParticipant),
    };

    const validationError = validatePreviewSessionChange(updatedSession, previewPlan.sessions);
    if (validationError) {
      return { ok: false as const, reason: validationError };
    }

    const updatedSessions = previewPlan.sessions
      .map((session) => (session.id === updatedSession.id ? updatedSession : session))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    const updatedAlerts = previewPlan.alerts.filter(
      (alert) => !alert.includes(source.region) || !alert.includes(`session ${source.indexInRegion}`)
    );

    setPreviewPlan({
      sessions: updatedSessions,
      alerts: updatedAlerts,
      impossibleRegions: previewPlan.impossibleRegions.filter((region) => region !== source.region),
    });
    addHistoryEntry(
      'preview_updated',
      'Session reprogrammée',
      `${source.region} session ${source.indexInRegion}: ${source.startDate} -> ${updatedSession.startDate}, ${source.trainerName} -> ${updatedSession.trainerName}.`
    );
    void persistHistoryEntry(
      'preview_updated',
      'Session reprogrammée',
      `${source.region} session ${source.indexInRegion}: ${source.startDate} -> ${updatedSession.startDate}, ${source.trainerName} -> ${updatedSession.trainerName}.`,
      undefined,
      { region: source.region, sessionIndex: source.indexInRegion }
    );

    return { ok: true as const, session: updatedSession };
  };

  const movePreviewSessionToDate = (sessionId: string, nextStartDate: string) => {
    if (!previewPlan) return;
    const targetSession = previewPlan.sessions.find((session) => session.id === sessionId);
    if (!targetSession) return;

    const result = applyPreviewSessionUpdate(sessionId, { startDate: nextStartDate });
    if (result.ok) {
      toast.success(`Session déplacée au ${nextStartDate}`);
      return;
    }

    setEditingPreviewSession({
      id: targetSession.id,
      region: targetSession.region,
      participants: targetSession.participants,
      startDate: nextStartDate,
      trainerId: targetSession.trainerId,
      roomId: targetSession.roomId,
    });
    toast.error(result.reason);
  };

  const handleRegionChange = (region: RegionName, patch: Partial<RegionInput>) => {
    setRegionInputs((current) =>
      current.map((item) => (item.region === region ? { ...item, ...patch } : item))
    );
  };

  const handleTrainerChange = (id: string, patch: Partial<TrainerResource>) => {
    setTrainers((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleRoomChange = (id: string, patch: Partial<RoomResource>) => {
    setRooms((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const applyPlannerDeliveryMode = (mode: PlannerDeliveryMode) => {
    setPlannerDeliveryMode(mode);

    if (mode === 'single') {
      setTrainers((current) =>
        current.length === 0
          ? [{ id: 'TR-AUTO-SINGLE', name: 'Formateur principal', active: true, unavailableDates: [] }]
          : current.map((trainer, index) => ({
              ...trainer,
              active: index === 0,
            }))
      );

      setRooms((current) =>
        current.length === 0
          ? [{ id: 'RM-AUTO-SINGLE', name: 'Salle principale', capacity: 20, active: true, unavailableDates: [] }]
          : current.map((room, index) => ({
              ...room,
              active: index === 0,
            }))
      );

      pushExpertMessage(
        'system',
        'Mode pédagogique appliqué',
        'Le planning sera construit avec un seul formateur et une seule salle active. Les sessions seront donc enchaînées de manière séquentielle.'
      );
      return;
    }

    setTrainers((current) => {
      const next = current.length === 0
        ? [{ id: 'TR-AUTO-1', name: 'Formateur 1', active: true, unavailableDates: [] }]
        : [...current];

      if (next.length < 2) {
        next.push({ id: 'TR-AUTO-2', name: 'Formateur 2', active: true, unavailableDates: [] });
      }

      return next.map((trainer, index) => ({
        ...trainer,
        active: index < 2 || trainer.active,
      }));
    });

    setRooms((current) => {
      const next = current.length === 0
        ? [{ id: 'RM-AUTO-1', name: 'Salle A', capacity: 20, active: true, unavailableDates: [] }]
        : [...current];

      if (next.length < 2) {
        next.push({ id: 'RM-AUTO-2', name: 'Salle B', capacity: 20, active: true, unavailableDates: [] });
      }

      return next.map((room, index) => ({
        ...room,
        active: index < 2 || room.active,
      }));
    });

    pushExpertMessage(
      'system',
      'Mode pédagogique appliqué',
      'Le planning sera construit avec plusieurs formateurs et plusieurs salles actives. Le moteur pourra donc produire des sessions en parallèle lorsque c’est pertinent.'
    );
  };

  const applyExpertRecommendation = (actionId: FormationExpertActionId) => {
    switch (actionId) {
      case 'set_start_date_today':
        setPlannerConfig((current) => ({ ...current, startDate: formatDate(new Date()) }));
        setExpertConversation((current) => [
          {
            id: `${Date.now()}-assistant-start-date`,
            role: 'system',
            title: 'Correction appliquée',
            body: "La date de démarrage a été définie à aujourd'hui.",
          },
          ...current,
        ].slice(0, 8));
        toast.success("Date de démarrage définie à aujourd'hui");
        return;
      case 'select_seed_regions':
        setRegionInputs((current) =>
          current.map((region, index) => ({
            ...region,
            selected: index < 3,
            priority: index === 0 ? 3 : index === 1 ? 2 : 1,
          }))
        );
        setExpertConversation((current) => [
          {
            id: `${Date.now()}-assistant-regions`,
            role: 'system',
            title: 'Correction appliquée',
            body: 'Trois régions prioritaires ont été préremplies pour démarrer rapidement.',
          },
          ...current,
        ].slice(0, 8));
        toast.success('3 régions prioritaires préremplies');
        return;
      case 'seed_region_participants':
        setRegionInputs((current) =>
          current.map((region, index) =>
            index === 0
              ? { ...region, selected: true, participants: region.participants || 24, priority: 3 }
              : index === 1
                ? { ...region, selected: true, participants: region.participants || 18, priority: 2 }
                : index === 2
                  ? { ...region, selected: true, participants: region.participants || 30, priority: 1 }
                  : region
          )
        );
        setExpertConversation((current) => [
          {
            id: `${Date.now()}-assistant-participants`,
            role: 'system',
            title: 'Correction appliquée',
            body: "Des effectifs d'exemple ont été injectés dans les régions prioritaires.",
          },
          ...current,
        ].slice(0, 8));
        toast.success("Effectifs d'exemple injectés");
        return;
      case 'select_default_modules':
        setSelectedModuleIds(activeModules.slice(0, Math.min(3, activeModules.length)).map((module) => module.id));
        setExpertConversation((current) => [
          {
            id: `${Date.now()}-assistant-modules`,
            role: 'system',
            title: 'Correction appliquée',
            body: 'Les modules de base ont été sélectionnés pour constituer une session standard.',
          },
          ...current,
        ].slice(0, 8));
        toast.success('Modules par défaut sélectionnés');
        return;
      case 'seed_trainers':
        setTrainers((current) =>
          current.some((trainer) => trainer.active)
            ? current
            : [
                { id: 'TR-AUTO-1', name: 'Formateur Expert 1', active: true, unavailableDates: [] },
                { id: 'TR-AUTO-2', name: 'Formateur Expert 2', active: true, unavailableDates: [] },
              ]
        );
        setExpertConversation((current) => [
          {
            id: `${Date.now()}-assistant-trainers`,
            role: 'system',
            title: 'Correction appliquée',
            body: 'Deux formateurs de base ont été ajoutés pour sécuriser la génération.',
          },
          ...current,
        ].slice(0, 8));
        toast.success('Formateurs de base ajoutés');
        return;
      case 'seed_rooms':
        setRooms((current) =>
          current.some((room) => room.active)
            ? current
            : [
                { id: 'RM-AUTO-1', name: 'Salle Expert A', capacity: 20, active: true, unavailableDates: [] },
                { id: 'RM-AUTO-2', name: 'Salle Expert B', capacity: 30, active: true, unavailableDates: [] },
              ]
        );
        setExpertConversation((current) => [
          {
            id: `${Date.now()}-assistant-rooms`,
            role: 'system',
            title: 'Correction appliquée',
            body: 'Deux salles de base ont été ajoutées avec des capacités cohérentes.',
          },
          ...current,
        ].slice(0, 8));
        toast.success('Salles de base ajoutées');
        return;
      case 'set_equipment_default':
        setPlannerConfig((current) => ({
          ...current,
          equipmentPool: current.equipmentPool > 0 ? current.equipmentPool : 40,
        }));
        setExpertConversation((current) => [
          {
            id: `${Date.now()}-assistant-equipment`,
            role: 'system',
            title: 'Correction appliquée',
            body: "Le stock d'équipements a été initialisé à une valeur de base.",
          },
          ...current,
        ].slice(0, 8));
        toast.success("Stock d'équipements initialisé");
        return;
      case 'generate_plan':
        generatePlan();
        setExpertConversation((current) => [
          {
            id: `${Date.now()}-assistant-generate`,
            role: 'system',
            title: 'Action lancée',
            body: 'Le moteur a lancé une génération automatique du planning.',
          },
          ...current,
        ].slice(0, 8));
        return;
      default:
        return;
    }
  };

  const pushExpertMessage = (
    role: ExpertConversationMessage['role'],
    title: string,
    body: string
  ) => {
    setExpertConversation((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        title,
        body,
      },
      ...current,
    ].slice(0, 8));
  };

  const handleExpertReply = (option: FormationExpertReplyOption) => {
    pushExpertMessage('user', option.responseTitle, option.responseBody);
    setLastHandledReplyId(option.id);

    if (option.actionId) {
      applyExpertRecommendation(option.actionId);
      return;
    }

    if (option.id.endsWith('_manual') || option.id === 'generate_review') {
      setPlannerMode('manual');
      pushExpertMessage(
        'system',
        'Passage en mode manuel',
        `Bascule vers le mode manuel pour corriger la zone "${expertEvaluation.nextQuestion?.targetSection}". L’assistant reprendra ensuite automatiquement avec la prochaine question utile.`
      );
      return;
    }

    if (option.id === 'alerts_fix') {
      pushExpertMessage(
        'system',
        'Traitement recommandé',
        expertEvaluation.alerts.length > 0
          ? expertEvaluation.alerts.join('\n')
          : 'Aucune alerte détaillée n’est disponible pour le moment.'
      );
      return;
    }

    if (option.id === 'alerts_review') {
      pushExpertMessage(
        'system',
        'Pourquoi corriger ?',
        `${expertEvaluation.nextQuestion?.why}\n\nAlertes détectées:\n${
          expertEvaluation.alerts.length > 0
            ? expertEvaluation.alerts.join('\n')
            : 'Aucune alerte détaillée n’est disponible.'
        }`
      );
      return;
    }

    pushExpertMessage(
      'system',
      'Décision enregistrée',
      `Votre choix a bien été pris en compte. Cette étape reste en attente dans "${expertEvaluation.nextQuestion?.targetSection}". Tant que ce point n’est pas traité, le planning ne pourra pas avancer complètement vers sa finalisation.`
    );
  };

  const handleStructuredAiQuestionSubmit = () => {
    switch (expertEvaluation.nextQuestion?.id) {
      case 'regional_volumes': {
        const validRegions = regionInputs.filter((region) => region.selected && region.participants > 0);
        if (validRegions.length === 0) {
          toast.error('Sélectionnez au moins une région et indiquez un nombre de stagiaires');
          return;
        }

        pushExpertMessage(
          'user',
          'Réponse utilisateur',
          `Régions retenues: ${validRegions.map((region) => `${region.region} (${region.participants})`).join(', ')}.`
        );
        pushExpertMessage(
          'system',
          'Étape validée',
          'Les régions et les effectifs sont enregistrés. Le moteur peut maintenant calculer les volumes de sessions attendus.'
        );
        return;
      }
      case 'modules': {
        if (selectedModuleIds.length === 0) {
          toast.error('Sélectionnez au moins un module');
          return;
        }

        pushExpertMessage(
          'user',
          'Réponse utilisateur',
          `Modules retenus: ${selectedModules.map((module) => module.name).join(', ')}.`
        );
        pushExpertMessage(
          'system',
          'Étape validée',
          `Le contenu pédagogique est défini pour ${totalModuleDays} jour(s) de formation.`
        );
        return;
      }
      case 'start_date': {
        if (!plannerConfig.startDate) {
          toast.error('Renseignez une date de démarrage');
          return;
        }

        pushExpertMessage(
          'user',
          'Réponse utilisateur',
          `Date de démarrage choisie: ${plannerConfig.startDate}.`
        );
        pushExpertMessage(
          'system',
          'Étape validée',
          'La date de démarrage est enregistrée. Le moteur peut maintenant positionner les sessions dans le calendrier.'
        );
        return;
      }
      case 'delivery_mode': {
        if (!plannerDeliveryMode) {
          toast.error('Choisissez un mode avec un formateur ou plusieurs formateurs');
          return;
        }

        pushExpertMessage(
          'user',
          'Réponse utilisateur',
          plannerDeliveryMode === 'multiple'
            ? 'La formation sera animée par plusieurs formateurs en parallèle.'
            : 'La formation sera animée par un seul formateur.'
        );
        applyPlannerDeliveryMode(plannerDeliveryMode);
        return;
      }
      default:
        return;
    }
  };

  useEffect(() => {
    if (!expertEvaluation.nextQuestion) return;

    setExpertConversation((current) => {
      const first = current[0];
      const nextId = `assistant-${expertEvaluation.nextQuestion?.id}-${expertEvaluation.status}`;
      if (first?.id === nextId) return current;

      const nextMessage: ExpertConversationMessage = {
        id: nextId,
        role: 'assistant',
        title: `Question à traiter: ${expertEvaluation.nextQuestion.prompt}`,
        body: `${expertEvaluation.nextQuestion.answer}\n\nZone concernée: ${expertEvaluation.nextQuestion.targetSection}`,
      };

      return [nextMessage, ...current].slice(0, 8);
    });
  }, [expertEvaluation.nextQuestion, expertEvaluation.status]);

  useEffect(() => {
    if (!expertEvaluation.nextQuestion) {
      setLastHandledReplyId(null);
      return;
    }

    const availableReplyIds = expertEvaluation.nextQuestion.replyOptions.map((option) => option.id);
    if (lastHandledReplyId && !availableReplyIds.includes(lastHandledReplyId)) {
      setLastHandledReplyId(null);
    }
  }, [expertEvaluation.nextQuestion, lastHandledReplyId]);

  const openModuleModal = (module?: FormationModule) => {
    if (module) {
      setEditingModuleId(module.id);
      setModuleForm({
        name: module.name,
        description: module.description || '',
        duration: module.duration,
        order: module.order,
      });
    } else {
      setEditingModuleId(null);
      setModuleForm({ name: '', description: '', duration: 1, order: modules.length + 1 });
    }
    setModuleModalOpen(true);
  };

  const handleSaveModule = async () => {
    if (!moduleForm.name.trim()) {
      toast.error('Le nom du module est requis');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: moduleForm.name.trim(),
        description: moduleForm.description.trim() || undefined,
        duration: Math.max(1, moduleForm.duration),
        order: Math.max(0, moduleForm.order),
      };

      if (editingModuleId) {
        await formationApi.updateModule(editingModuleId, payload);
        toast.success('Module mis à jour');
      } else {
        await formationApi.createModule(payload);
        toast.success('Module créé');
      }

      const refreshed = await formationApi.getModules();
      setModules(Array.isArray(refreshed) ? refreshed : []);
      setModuleModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Impossible d'enregistrer le module");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteModule = async (id: string) => {
    if (!window.confirm('Supprimer ce module ?')) return;

    setSubmitting(true);
    try {
      await formationApi.deleteModule(id);
      const refreshed = await formationApi.getModules();
      setModules(Array.isArray(refreshed) ? refreshed : []);
      setSelectedModuleIds((current) => current.filter((moduleId) => moduleId !== id));
      toast.success('Module supprimé');
    } catch (error) {
      console.error(error);
      toast.error('Suppression impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!window.confirm('Supprimer cette session ?')) return;

    setSubmitting(true);
    try {
      await formationApi.deleteSession(id);
      const refreshed = await formationApi.getSessions();
      setSessions(Array.isArray(refreshed) ? refreshed : []);
      addHistoryEntry('session_deleted', 'Session supprimée', `Suppression de la session ${id}.`);
      void persistHistoryEntry('session_deleted', 'Session supprimée', `Suppression de la session ${id}.`, id);
      toast.success('Session supprimée');
    } catch (error) {
      console.error(error);
      toast.error('Suppression impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const generatePlan = () => {
    if (selectedRegions.length === 0) {
      toast.error('Sélectionnez au moins une région avec des stagiaires');
      return;
    }
    if (!plannerConfig.startDate) {
      toast.error('La date de démarrage est requise');
      return;
    }
    if (selectedModules.length === 0) {
      toast.error('Sélectionnez au moins un module');
      return;
    }

    const activeTrainers = trainers.filter((trainer) => trainer.active);
    const activeRooms = rooms.filter((room) => room.active);

    if (activeTrainers.length === 0 || activeRooms.length === 0) {
      toast.error('Ajoutez au moins un formateur actif et une salle active');
      return;
    }

    const trainerOccupation = new Map<string, Set<string>>();
    const roomOccupation = new Map<string, Set<string>>();

    activeTrainers.forEach((trainer) => {
      trainerOccupation.set(
        trainer.id,
        new Set(trainer.unavailableDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))
      );
    });

    activeRooms.forEach((room) => {
      roomOccupation.set(
        room.id,
        new Set(room.unavailableDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))
      );
    });

    const alerts: string[] = [];
    const impossibleRegions: string[] = [];
    const generatedSessions: PreviewSession[] = [];
    const sessionDuration = Math.max(1, totalModuleDays);
    const orderedRegions = [...selectedRegions].sort(
      (a, b) => b.priority - a.priority || b.participants - a.participants
    );
    const baseDate = parseDate(plannerConfig.startDate);

    if (!baseDate) {
      toast.error('Date de démarrage invalide');
      return;
    }

    for (const region of orderedRegions) {
      const sessionCount = Math.ceil(region.participants / Math.max(1, plannerConfig.maxParticipantsPerSession));
      let regionScheduled = 0;

      for (let index = 0; index < sessionCount; index += 1) {
        const participants = Math.min(
          plannerConfig.maxParticipantsPerSession,
          region.participants - index * plannerConfig.maxParticipantsPerSession
        );
        const equipmentNeeded = participants * Math.max(1, plannerConfig.equipmentPerParticipant);

        if (equipmentNeeded > plannerConfig.equipmentPool) {
          alerts.push(
            `${region.region} session ${index + 1}: ${equipmentNeeded} équipements requis pour un stock de ${plannerConfig.equipmentPool}.`
          );
          impossibleRegions.push(region.region);
          continue;
        }

        let cursor = addDays(baseDate, regionScheduled * plannerConfig.daysBetweenSessions);
        let booked = false;
        let tries = 0;

        while (!booked && tries < 365) {
          tries += 1;
          const startDate = formatDate(cursor);
          const endDate = computeSessionEndDate(
            startDate,
            sessionDuration,
            plannerConfig.includeSaturday,
            blockedDates
          );
          const coveredDates = buildDateRange(startDate, endDate).filter((dateValue) =>
            isWorkingDay(parseDate(dateValue) || new Date(), plannerConfig.includeSaturday, blockedDates)
          );

          const preferredRoom =
            activeRooms.find((room) => room.id === region.preferredRoomId && room.capacity >= participants) || null;

          const candidateRooms = preferredRoom
            ? [preferredRoom, ...activeRooms.filter((room) => room.id !== preferredRoom.id && room.capacity >= participants)]
            : activeRooms.filter((room) => room.capacity >= participants);

          const room = candidateRooms.find((candidateRoom) =>
            coveredDates.every((dateValue) => !roomOccupation.get(candidateRoom.id)?.has(dateValue))
          );

          const trainer = activeTrainers.find((candidateTrainer) =>
            coveredDates.every((dateValue) => !trainerOccupation.get(candidateTrainer.id)?.has(dateValue))
          );

          if (room && trainer) {
            coveredDates.forEach((dateValue) => {
              trainerOccupation.get(trainer.id)?.add(dateValue);
              roomOccupation.get(room.id)?.add(dateValue);
            });

            generatedSessions.push({
              id: `preview-${region.region}-${index + 1}`,
              region: region.region,
              priority: region.priority,
              indexInRegion: index + 1,
              participants,
              trainerId: trainer.id,
              trainerName: trainer.name,
              roomId: room.id,
              roomName: room.name,
              startDate,
              endDate,
              durationDays: diffDaysInclusive(startDate, endDate),
              fillRate: Math.round((participants / plannerConfig.maxParticipantsPerSession) * 100),
              equipmentNeeded,
              modules: selectedModules,
            });

            regionScheduled += 1;
            booked = true;
          } else {
            cursor = addDays(cursor, 1);
          }
        }

        if (!booked) {
          alerts.push(`${region.region} session ${index + 1}: aucune combinaison salle/formateur disponible.`);
          impossibleRegions.push(region.region);
        }
      }
    }

    const normalizedImpossibleRegions = Array.from(new Set(impossibleRegions));
    setPreviewPlan({
      sessions: generatedSessions.sort((a, b) => a.startDate.localeCompare(b.startDate)),
      alerts,
      impossibleRegions: normalizedImpossibleRegions,
    });
    addHistoryEntry(
      'preview_generated',
      'Planning généré',
      `${generatedSessions.length} session(s) générée(s), ${alerts.length} alerte(s).`
    );
    void persistHistoryEntry(
      'preview_generated',
      'Planning généré',
      `${generatedSessions.length} session(s) générée(s), ${alerts.length} alerte(s).`,
      undefined,
      { sessions: generatedSessions.length, alerts: alerts.length }
    );

    if (alerts.length > 0) {
      toast.error(`${alerts.length} contrainte(s) détectée(s)`);
    } else {
      toast.success('Planning généré');
    }
  };

  const persistPreviewPlan = async () => {
    if (!previewPlan || previewPlan.sessions.length === 0) {
      toast.error("Aucun planning généré à enregistrer");
      return;
    }

    setSubmitting(true);
    try {
      for (const session of previewPlan.sessions) {
        await formationApi.createSession({
          region: session.region,
          salle: session.roomName,
          maxParticipants: session.participants,
          startDate: session.startDate,
          workSaturday: plannerConfig.includeSaturday,
          workSunday: false,
          notes: `Planning généré automatiquement • Formateur: ${session.trainerName} • Priorité région: ${session.priority}`,
          modules: session.modules.map((module, index) => ({
            moduleId: module.moduleId,
            duration: module.duration,
            orderIndex: index,
          })),
        });
      }

      const [sessionData, statsData] = await Promise.all([
        formationApi.getSessions(),
        formationApi.getStats(),
      ]);
      setSessions(Array.isArray(sessionData) ? sessionData : []);
      setStats(statsData ?? null);
      addHistoryEntry(
        'preview_persisted',
        'Planning enregistré',
        `${previewPlan.sessions.length} session(s) enregistrée(s) en base.`
      );
      void persistHistoryEntry(
        'preview_persisted',
        'Planning enregistré',
        `${previewPlan.sessions.length} session(s) enregistrée(s) en base.`,
        undefined,
        { sessions: previewPlan.sessions.length }
      );
      pushExpertMessage(
        'system',
        'Planning finalisé',
        `${previewPlan.sessions.length} session(s) ont été enregistrées dans les sessions. Vous pouvez maintenant consulter les sessions enregistrées ou exporter le résultat.`
      );
      toast.success('Planning enregistré dans les sessions');
    } catch (error) {
      console.error(error);
      toast.error("L'enregistrement du planning a échoué");
    } finally {
      setSubmitting(false);
    }
  };

  const chatFinalAction =
    expertEvaluation.status === 'ready_to_generate'
      ? {
          title: 'Action finale disponible',
          body: 'Le cadrage minimal est maintenant complet. Vous pouvez demander à l’assistant de générer immédiatement un premier planning automatique.',
          label: 'Générer le planning maintenant',
          onClick: () => applyExpertRecommendation('generate_plan'),
        }
      : previewPlan && previewPlan.sessions.length > 0 && previewPlan.alerts.length === 0
        ? {
            title: 'Action finale disponible',
            body: 'Le planning généré ne contient plus d’alerte bloquante. Vous pouvez le valider et l’enregistrer définitivement dans les sessions.',
            label: 'Valider et enregistrer le planning',
            onClick: () => persistPreviewPlan(),
          }
        : previewPlan && previewPlan.sessions.length > 0 && previewPlan.alerts.length > 0
          ? {
              title: 'Validation en attente',
              body: `Le planning a bien été généré, mais ${previewPlan.alerts.length} alerte(s) doivent encore être arbitrées avant une finalisation propre.`,
              label: 'Passer en mode manuel',
              onClick: () => setPlannerMode('manual'),
            }
          : null;

  const isStructuredAiQuestion = ['regional_volumes', 'modules', 'start_date', 'delivery_mode'].includes(
    expertEvaluation.nextQuestion?.id || ''
  );
  const currentStepIndex = Math.max(
    0,
    expertEvaluation.guidedFlow.findIndex((step) => step.status === 'active')
  );
  const totalStepCount = expertEvaluation.guidedFlow.length;

  const exportPreviewCsv = () => {
    if (!previewPlan || previewPlan.sessions.length === 0) {
      toast.error("Aucun planning à exporter");
      return;
    }

    const header = [
      'Region',
      'Session',
      'Priorite',
      'Participants',
      'Debut',
      'Fin',
      'DureeJours',
      'Formateur',
      'Salle',
      'TauxRemplissage',
      'Equipements',
      'Modules',
    ];

    const rows = previewPlan.sessions.map((session) => [
      session.region,
      session.indexInRegion,
      session.priority,
      session.participants,
      session.startDate,
      session.endDate,
      session.durationDays,
      session.trainerName,
      session.roomName,
      `${session.fillRate}%`,
      session.equipmentNeeded,
      session.modules.map((module) => `${module.name} (${module.duration}j)`).join(' | '),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadTextFile(csv, `planning-formation-${plannerConfig.startDate}.csv`, 'text/csv;charset=utf-8;');
    toast.success('Export CSV généré');
  };

  const exportPreviewPrint = () => {
    if (!previewPlan || previewPlan.sessions.length === 0) {
      toast.error("Aucun planning à imprimer");
      return;
    }

    const html = `
      <html>
        <head>
          <title>Planning formation</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 8px; }
            p { color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; }
            th { background: #eff6ff; }
          </style>
        </head>
        <body>
          <h1>Planning de formation</h1>
          <p>Démarrage: ${plannerConfig.startDate} • Sessions: ${previewPlan.sessions.length}</p>
          <table>
            <thead>
              <tr>
                <th>Région</th>
                <th>Session</th>
                <th>Participants</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Formateur</th>
                <th>Salle</th>
                <th>Modules</th>
              </tr>
            </thead>
            <tbody>
              ${previewPlan.sessions
                .map(
                  (session) => `
                    <tr>
                      <td>${session.region}</td>
                      <td>${session.indexInRegion}</td>
                      <td>${session.participants}</td>
                      <td>${session.startDate}</td>
                      <td>${session.endDate}</td>
                      <td>${session.trainerName}</td>
                      <td>${session.roomName}</td>
                      <td>${session.modules.map((module) => `${module.name} (${module.duration}j)`).join(', ')}</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Fenêtre d'impression bloquée");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const exportPreviewViaBackend = async (format: 'pdf' | 'docx') => {
    if (!previewPlan || previewPlan.sessions.length === 0) {
      toast.error("Aucun planning à exporter");
      return;
    }

    try {
      await formationApi.exportPlan({
        format,
        plan: {
          sessions: previewPlan.sessions.map((session) => ({
            region: session.region,
            groupIndex: session.indexInRegion,
            maxParticipants: session.participants,
            startDate: session.startDate,
            endDate: session.endDate,
            workSaturday: plannerConfig.includeSaturday,
            workSunday: false,
            salle: session.roomName,
            modules: session.modules.map((module) => ({
              moduleId: module.moduleId,
              duration: module.duration,
            })),
          })),
        },
      });
      toast.success(`Export ${format.toUpperCase()} généré`);
    } catch (error) {
      console.error(error);
      toast.error(`Export ${format.toUpperCase()} impossible`);
    }
  };

  const validatePreviewSessionChange = (
    editedSession: PreviewSession,
    sessionsToCheck: PreviewSession[]
  ) => {
    const targetRoom = rooms.find((room) => room.id === editedSession.roomId);
    const targetTrainer = trainers.find((trainer) => trainer.id === editedSession.trainerId);

    if (!targetRoom || !targetRoom.active) {
      return 'Salle invalide ou inactive';
    }
    if (!targetTrainer || !targetTrainer.active) {
      return 'Formateur invalide ou inactif';
    }
    if (targetRoom.capacity < editedSession.participants) {
      return `Capacité de salle insuffisante (${targetRoom.capacity})`;
    }
    if (
      editedSession.participants * Math.max(1, plannerConfig.equipmentPerParticipant) >
      plannerConfig.equipmentPool
    ) {
      return "Stock d'équipements insuffisant pour cette session";
    }

    const coveredDates = buildDateRange(editedSession.startDate, editedSession.endDate).filter((dateValue) =>
      isWorkingDay(parseDate(dateValue) || new Date(), plannerConfig.includeSaturday, blockedDates)
    );

    const trainerUnavailable = new Set(targetTrainer.unavailableDates);
    const roomUnavailable = new Set(targetRoom.unavailableDates);

    if (coveredDates.some((dateValue) => trainerUnavailable.has(dateValue))) {
      return 'Le formateur est indisponible sur la période choisie';
    }
    if (coveredDates.some((dateValue) => roomUnavailable.has(dateValue))) {
      return 'La salle est indisponible sur la période choisie';
    }

    const conflicts = sessionsToCheck.find((session) => {
      if (session.id === editedSession.id) return false;
      const otherDates = new Set(buildDateRange(session.startDate, session.endDate));
      const overlap = coveredDates.some((dateValue) => otherDates.has(dateValue));
      if (!overlap) return false;
      return session.roomId === editedSession.roomId || session.trainerId === editedSession.trainerId;
    });

    if (conflicts) {
      return `Conflit avec ${conflicts.region} session ${conflicts.indexInRegion}`;
    }

    return null;
  };

  const savePreviewSessionEdit = () => {
    if (!editingPreviewSession) return;

    const result = applyPreviewSessionUpdate(editingPreviewSession.id, {
      region: editingPreviewSession.region,
      participants: editingPreviewSession.participants,
      startDate: editingPreviewSession.startDate,
      trainerId: editingPreviewSession.trainerId,
      roomId: editingPreviewSession.roomId,
    });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    setEditingPreviewSession(null);
    toast.success('Session prévisionnelle mise à jour');
  };

  const saveBackendSessionEdit = async () => {
    if (!editingBackendSession) return;

    const currentSession = sessions.find((session) => session.id === editingBackendSession.id);
    if (!currentSession) return;

    setSubmitting(true);
    try {
      const sessionPayload = {
        region: editingBackendSession.region,
        salle: editingBackendSession.salle,
        maxParticipants: editingBackendSession.maxParticipants,
        startDate: editingBackendSession.startDate,
        workSaturday: editingBackendSession.workSaturday,
        workSunday: editingBackendSession.workSunday,
        status: editingBackendSession.status,
        notes: editingBackendSession.notes,
        modules: currentSession.sessionModules.map((module, index) => ({
          moduleId: module.moduleId,
          duration: module.duration || module.module?.duration || 1,
          notes: module.notes || undefined,
          orderIndex: index,
        })),
      };

      if (editingBackendSession.cascadeRegion) {
        await formationApi.updateSession(editingBackendSession.id, {
          ...sessionPayload,
          startDate: undefined,
        });
        await formationApi.cascadeSession(editingBackendSession.id, {
          startDate: editingBackendSession.startDate,
          region: editingBackendSession.region,
          workSaturday: editingBackendSession.workSaturday,
          workSunday: editingBackendSession.workSunday,
        });
      } else {
        await formationApi.updateSession(editingBackendSession.id, sessionPayload);
      }

      const [sessionData, statsData, historyData] = await Promise.all([
        formationApi.getSessions(),
        formationApi.getStats(),
        formationApi.getHistory(),
      ]);
      setSessions(Array.isArray(sessionData) ? sessionData : []);
      setStats(statsData ?? null);
      setHistoryEntries(Array.isArray(historyData) ? historyData.map(mapHistoryEntryFromApi) : []);
      addHistoryEntry(
        'session_updated',
        'Session enregistrée mise à jour',
        `${editingBackendSession.region} démarrage ${editingBackendSession.startDate}, statut ${editingBackendSession.status}.`
      );
      if (!editingBackendSession.cascadeRegion) {
        void persistHistoryEntry(
          'session_updated',
          'Session enregistrée mise à jour',
          `${editingBackendSession.region} démarrage ${editingBackendSession.startDate}, statut ${editingBackendSession.status}.`,
          editingBackendSession.id,
          { cascade: false }
        );
      }
      setEditingBackendSession(null);
      toast.success('Session enregistrée mise à jour');
    } catch (error) {
      console.error(error);
      toast.error("Impossible de reprogrammer la session");
    } finally {
      setSubmitting(false);
    }
  };

  const plannerStats = [
    {
      label: 'Régions ciblées',
      value: plannerSummary.totalRegions,
      icon: <MapPin className="h-5 w-5" />,
    },
    {
      label: 'Stagiaires à planifier',
      value: plannerSummary.totalParticipants,
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: 'Sessions théoriques',
      value: plannerSummary.totalSessions,
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      label: 'Durée pédagogique',
      value: `${totalModuleDays} j`,
      icon: <Clock className="h-5 w-5" />,
    },
  ];

  const globalActions = (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <button
        onClick={generatePlan}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
      >
        <RefreshCw className="h-4 w-4" />
        Générer le planning
      </button>
      <button
        onClick={persistPreviewPlan}
        disabled={submitting || !previewPlan || previewPlan.sessions.length === 0}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)] disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        Enregistrer
      </button>
    </div>
  );

  if (loading) {
    return (
      <PageContainer>
        <div className="rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
          Chargement du planning de formation...
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Planning Formation"
        subtitle={
          activeTab === 'planner' && plannerMode === 'ai'
            ? 'Assistant mobile de planification'
            : 'Planification multi-régions plus logique, plus pilotable et plus robuste'
        }
        icon={GraduationCap}
        className="mb-4 sm:mb-6"
        actions={activeTab === 'planner' && plannerMode === 'ai' ? undefined : globalActions}
      />

      {activeTab === 'planner' && plannerMode === 'ai' && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:hidden">
          <div className="rounded-[24px] border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
              Progression
            </div>
            <div className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
              {Math.min(currentStepIndex + 1, totalStepCount)}/{totalStepCount}
            </div>
          </div>
          <div className="rounded-[24px] border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
              Préparation
            </div>
            <div className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
              {expertEvaluation.readinessScore}%
            </div>
          </div>
          <div className="rounded-[24px] border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
              Régions
            </div>
            <div className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
              {plannerSummary.totalRegions}
            </div>
          </div>
          <div className="rounded-[24px] border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
              Sessions
            </div>
            <div className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
              {previewPlan?.sessions.length || plannerSummary.totalSessions}
            </div>
          </div>
        </div>
      )}

      <div
        className={`mb-4 grid grid-cols-2 gap-2 sm:mb-5 sm:gap-3 xl:grid-cols-4 ${
          activeTab === 'planner' && plannerMode === 'ai' ? 'hidden sm:grid' : ''
        }`}
      >
        {plannerStats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-[28px] border p-3 shadow-sm sm:rounded-3xl sm:p-5 ${
              activeTab === 'planner' && plannerMode === 'ai'
                ? 'border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/10'
                : activeTab === 'planner' && plannerMode === 'manual'
                  ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10'
                  : 'border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]'
            }`}
          >
            <div
              className={`mb-2 flex h-9 w-9 items-center justify-center rounded-2xl sm:mb-3 sm:h-11 sm:w-11 ${
                activeTab === 'planner' && plannerMode === 'ai'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                  : activeTab === 'planner' && plannerMode === 'manual'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-[var(--gradient-primary-subtle)] text-[var(--color-primary)]'
              }`}
            >
              {stat.icon}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] sm:text-xs sm:tracking-[0.18em]">
              {stat.label}
            </div>
            <div className="mt-1 text-xl font-bold tracking-tight text-[var(--color-text-primary)] sm:mt-2 sm:text-3xl">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 sm:mb-5 sm:flex-wrap sm:gap-3 sm:overflow-visible">
        {[
          { id: 'planner', label: 'Planificateur intelligent' },
          { id: 'sessions', label: 'Sessions enregistrées' },
          { id: 'modules', label: 'Référentiel modules' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as PageTab)}
            className={`min-w-max whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id && tab.id === 'planner' && plannerMode === 'ai'
                ? 'bg-blue-600 text-white'
                : activeTab === tab.id && tab.id === 'planner' && plannerMode === 'manual'
                  ? 'bg-amber-600 text-white'
                  : activeTab === tab.id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]'
            }`}
          >
            <span className="sm:hidden">
              {tab.id === 'planner' ? 'Planner' : tab.id === 'sessions' ? 'Sessions' : 'Modules'}
            </span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'planner' && (
        <div className="space-y-4 sm:space-y-6">
          <div
            className={`rounded-[28px] border p-3 shadow-sm sm:rounded-3xl ${
              plannerMode === 'ai'
                ? 'border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/20'
                : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20'
            } ${plannerMode === 'ai' ? 'hidden sm:block' : ''}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <div
                  className={`text-xs font-bold uppercase tracking-[0.16em] ${
                    plannerMode === 'ai'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  Mode de travail
                </div>
                <div className="mt-1 hidden text-sm text-[var(--color-text-secondary)] sm:block">
                  `AI` pilote le planning par conversation guidée. `Manuel` affiche les formulaires complets.
                </div>
              </div>
              <div
                className={`grid w-full grid-cols-2 rounded-2xl p-1 sm:inline-flex sm:w-auto ${
                  plannerMode === 'ai'
                    ? 'bg-blue-100 dark:bg-blue-950/30'
                    : 'bg-amber-100 dark:bg-amber-950/30'
                }`}
              >
                <button
                  onClick={() => setPlannerMode('ai')}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    plannerMode === 'ai'
                      ? 'bg-blue-600 text-white'
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  Mode AI
                </button>
                <button
                  onClick={() => setPlannerMode('manual')}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    plannerMode === 'manual'
                      ? 'bg-amber-600 text-white'
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  Mode Manuel
                </button>
              </div>
            </div>
          </div>

          {plannerMode === 'ai' && (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <SectionCard
                title="Chat de planification"
                subtitle="Une seule question à la fois."
                icon={<CheckCircle2 className="h-5 w-5" />}
                action={
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPlannerMode('manual')}
                      className="rounded-2xl border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                    >
                      Ouvrir le manuel
                    </button>
                  </div>
                }
              >
                <div className="rounded-[28px] border border-blue-200 bg-blue-50/60 p-3 sm:p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
                  <div className="mb-3 flex items-center justify-between gap-2 sm:hidden">
                    <div className="rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      Mode AI
                    </div>
                    <button
                      onClick={() => setPlannerMode('manual')}
                      className="rounded-full border border-blue-200 bg-white/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:border-blue-900/60 dark:bg-slate-950/40 dark:text-blue-300"
                    >
                      Manuel
                    </button>
                  </div>

                  <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                        Question en cours
                      </div>
                      <div className="mt-1 hidden text-sm text-[var(--color-text-secondary)] sm:block">
                        Répondez uniquement à cette étape. L’assistant enchaînera automatiquement sur la suivante.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-slate-950/40 dark:text-blue-300">
                        Étape {Math.min(currentStepIndex + 1, totalStepCount)}/{totalStepCount}
                      </div>
                      <div className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-slate-950/40 dark:text-blue-300">
                        {expertEvaluation.readinessScore}% prêt
                      </div>
                    </div>
                  </div>

                  {expertEvaluation.nextQuestion ? (
                    <div className="space-y-3 rounded-[28px] border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-3 sm:space-y-4 sm:rounded-3xl sm:p-5">
                      <div>
                        <div className="text-[1.05rem] font-semibold leading-tight text-[var(--color-text-primary)] sm:text-lg">
                          {expertEvaluation.nextQuestion.prompt}
                        </div>
                        <div className="mt-1.5 text-sm text-[var(--color-text-secondary)] sm:mt-2">
                          {expertEvaluation.nextQuestion.answer}
                        </div>
                      </div>

                      {expertEvaluation.nextQuestion.id === 'regional_volumes' && (
                        <div className="space-y-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] sm:text-xs">
                            Sélectionnez les régions et saisissez le volume
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {regionInputs.map((region) => (
                              <div
                                key={region.region}
                                className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-3"
                              >
                                <label className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={region.selected}
                                      onChange={(event) =>
                                        handleRegionChange(region.region, { selected: event.target.checked })
                                      }
                                    />
                                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                      {region.region}
                                    </span>
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={region.participants}
                                    onChange={(event) =>
                                      handleRegionChange(region.region, {
                                        participants: Math.max(0, Number(event.target.value || 0)),
                                        selected:
                                          Number(event.target.value || 0) > 0 ? true : region.selected,
                                      })
                                    }
                                    className="h-[40px] w-[96px] rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)]"
                                    placeholder="0"
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                          <div className="sticky bottom-0 flex flex-col gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                              Étape {Math.min(currentStepIndex + 1, totalStepCount)}/{totalStepCount}
                            </div>
                            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <button
                              onClick={handleStructuredAiQuestionSubmit}
                              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
                            >
                              Valider et continuer
                            </button>
                            <button
                              onClick={() => setPlannerMode('manual')}
                              className="rounded-2xl border border-[var(--color-border-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)]"
                            >
                              Passer en mode manuel
                            </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {expertEvaluation.nextQuestion.id === 'modules' && (
                        <div className="space-y-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] sm:text-xs">
                            Choisissez les modules de la formation
                          </div>
                          <div className="grid gap-2">
                            {activeModules.map((module) => {
                              const checked = selectedModuleIds.includes(module.id);
                              return (
                                <label
                                  key={module.id}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-3"
                                >
                                  <span className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(event) =>
                                        setSelectedModuleIds((current) =>
                                          event.target.checked
                                            ? [...current, module.id]
                                            : current.filter((id) => id !== module.id)
                                        )
                                      }
                                    />
                                    <span>
                                      <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                                        {module.name}
                                      </span>
                                      <span className="block text-xs text-[var(--color-text-secondary)]">
                                        {module.description || 'Sans description'}
                                      </span>
                                    </span>
                                  </span>
                                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                                    {moduleDurations[module.id] || module.duration} j
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          <div className="sticky bottom-0 flex flex-col gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                              Étape {Math.min(currentStepIndex + 1, totalStepCount)}/{totalStepCount}
                            </div>
                            <button
                              onClick={handleStructuredAiQuestionSubmit}
                              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                            >
                              Valider et continuer
                            </button>
                          </div>
                        </div>
                      )}

                      {expertEvaluation.nextQuestion.id === 'start_date' && (
                        <div className="space-y-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] sm:text-xs">
                            Choisissez la date de démarrage
                          </div>
                          <input
                            type="date"
                            value={plannerConfig.startDate}
                            onChange={(event) =>
                              setPlannerConfig((current) => ({ ...current, startDate: event.target.value }))
                            }
                            className={inputClassName}
                          />
                          <div className="sticky bottom-0 flex flex-col gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                              Étape {Math.min(currentStepIndex + 1, totalStepCount)}/{totalStepCount}
                            </div>
                            <button
                              onClick={handleStructuredAiQuestionSubmit}
                              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                            >
                              Valider et continuer
                            </button>
                          </div>
                        </div>
                      )}

                      {expertEvaluation.nextQuestion.id === 'delivery_mode' && (
                        <div className="space-y-4">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] sm:text-xs">
                            Choisissez le mode d’organisation
                          </div>
                          <label className="flex items-start gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4">
                            <input
                              type="radio"
                              name="planner-delivery-mode"
                              checked={plannerDeliveryMode === 'single'}
                              onChange={() => setPlannerDeliveryMode('single')}
                            />
                            <span>
                              <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                                Un seul formateur
                              </span>
                              <span className="block text-xs text-[var(--color-text-secondary)]">
                                Les sessions seront planifiées de manière séquentielle sur une seule salle active.
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4">
                            <input
                              type="radio"
                              name="planner-delivery-mode"
                              checked={plannerDeliveryMode === 'multiple'}
                              onChange={() => setPlannerDeliveryMode('multiple')}
                            />
                            <span>
                              <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                                Plusieurs formateurs
                              </span>
                              <span className="block text-xs text-[var(--color-text-secondary)]">
                                Le moteur pourra répartir des sessions en parallèle sur plusieurs salles.
                              </span>
                            </span>
                          </label>
                          <div className="sticky bottom-0 flex flex-col gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                              Étape {Math.min(currentStepIndex + 1, totalStepCount)}/{totalStepCount}
                            </div>
                            <button
                              onClick={handleStructuredAiQuestionSubmit}
                              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                            >
                              Valider et continuer
                            </button>
                          </div>
                        </div>
                      )}

                      {!isStructuredAiQuestion && (
                        <div className="space-y-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] sm:text-xs">
                            Choisissez une réponse
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {expertEvaluation.nextQuestion.replyOptions.map((option) => (
                              <button
                                key={option.id}
                                onClick={() => handleExpertReply(option)}
                                disabled={lastHandledReplyId === option.id}
                                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                  option.tone === 'primary'
                                    ? 'bg-[var(--color-primary)] text-white disabled:opacity-60'
                                    : option.tone === 'secondary'
                                      ? 'border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)] disabled:opacity-60'
                                      : 'border border-dashed border-[var(--color-border-primary)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] disabled:opacity-60'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <div className="sticky bottom-0 flex flex-col gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                              Étape {Math.min(currentStepIndex + 1, totalStepCount)}/{totalStepCount}
                            </div>
                            <button
                              onClick={() => setPlannerMode('manual')}
                              className="w-full rounded-2xl border border-[var(--color-border-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] sm:w-auto"
                            >
                              Passer en mode manuel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-[28px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 sm:mt-4 sm:rounded-3xl dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                      Le workflow guidé n’a plus de question ouverte. Le planning est maintenant soit prêt à être généré, soit prêt à être validé et enregistré, selon son état actuel.
                    </div>
                  )}

                  {chatFinalAction && (
                    <div className="mt-3 rounded-[28px] border border-emerald-200 bg-emerald-50 p-4 sm:mt-4 sm:rounded-3xl dark:border-emerald-900/60 dark:bg-emerald-950/20">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                        {chatFinalAction.title}
                      </div>
                      <div className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
                        {chatFinalAction.body}
                      </div>
                      <button
                        onClick={chatFinalAction.onClick}
                        disabled={submitting}
                        className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                      >
                        {chatFinalAction.label}
                      </button>
                    </div>
                  )}
                </div>
              </SectionCard>

              <div className="space-y-6">
                <div className="sm:hidden">
                  <button
                    onClick={() => setAiMobilePhasesOpen((current) => !current)}
                    className="flex w-full items-center justify-between rounded-[28px] border border-blue-200 bg-blue-50/70 px-4 py-3 text-left dark:border-blue-900/60 dark:bg-blue-950/20"
                  >
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
                        Phases
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                        {Math.min(currentStepIndex + 1, totalStepCount)}/{totalStepCount} en cours
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      {aiMobilePhasesOpen ? 'Masquer' : 'Afficher'}
                    </div>
                  </button>

                  {aiMobilePhasesOpen && (
                    <div className="mt-3 space-y-3">
                      {expertEvaluation.guidedFlow.map((step, index) => (
                        <div
                          key={step.id}
                          className={`rounded-2xl border p-4 ${
                            step.status === 'done'
                              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                              : step.status === 'active'
                                ? 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/20'
                                : 'border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                step.status === 'done'
                                  ? 'bg-emerald-600 text-white'
                                  : step.status === 'active'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]'
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {step.title}
                              </div>
                              <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                {step.status === 'done' ? 'Validée' : step.status === 'active' ? 'En cours' : 'Restante'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <SectionCard
                  title="Phases"
                  subtitle="Progression du workflow."
                  icon={<Settings2 className="h-5 w-5" />}
                  className="hidden sm:block"
                >
                  <div className="space-y-3">
                    {expertEvaluation.guidedFlow.map((step, index) => (
                      <div
                        key={step.id}
                        className={`rounded-2xl border p-4 ${
                          step.status === 'done'
                            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                            : step.status === 'active'
                              ? 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/20'
                              : 'border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              step.status === 'done'
                                ? 'bg-emerald-600 text-white'
                                : step.status === 'active'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {step.title}
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                                {step.status === 'done' ? 'Validée' : step.status === 'active' ? 'En cours' : 'Restante'}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                              {step.description}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Mode"
                  subtitle="Le mode manuel reste disponible si vous voulez éditer tous les paramètres."
                  icon={<RefreshCw className="h-5 w-5" />}
                  className="hidden sm:block"
                >
                  <button
                    onClick={() => setPlannerMode('manual')}
                    className="w-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:border-amber-400 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300 sm:w-auto"
                  >
                    Passer en mode manuel
                  </button>
                </SectionCard>
              </div>
            </div>
          )}

          {plannerMode === 'manual' && (
            <>
              <SectionCard
                title="Mode Manuel"
                subtitle="Tous les paramètres détaillés du planning sont modifiables ici. Tu peux revenir au chat AI à tout moment."
                icon={<Settings2 className="h-5 w-5" />}
                action={
                  <button
                    onClick={() => setPlannerMode('ai')}
                    className="rounded-2xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:border-blue-400 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300"
                  >
                    Revenir au chat AI
                  </button>
                }
              >
                <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                    Mode manuel actif
                  </div>
                  <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    Vous êtes dans l’interface complète de paramétrage. Ici, toutes les sections du planning restent éditables librement.
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <QuickAnswerCard question="Question active" answer={expertEvaluation.nextQuestion?.prompt || 'Aucune question bloquante.'} />
                  <QuickAnswerCard question="Zone à corriger" answer={expertEvaluation.nextQuestion?.targetSection || 'Aucune correction prioritaire.'} />
                  <QuickAnswerCard question="Statut" answer={expertEvaluation.summary} />
                </div>
              </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <SectionCard
              title="1. Cadrage du planning"
              subtitle="Définir le démarrage, les paramètres de session et les jours à exclure."
              icon={<Settings2 className="h-5 w-5" />}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Date de démarrage globale">
                  <input
                    type="date"
                    value={plannerConfig.startDate}
                    onChange={(event) =>
                      setPlannerConfig((current) => ({ ...current, startDate: event.target.value }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Capacité max / session">
                  <input
                    type="number"
                    min="1"
                    value={plannerConfig.maxParticipantsPerSession}
                    onChange={(event) =>
                      setPlannerConfig((current) => ({
                        ...current,
                        maxParticipantsPerSession: Math.max(1, Number(event.target.value || 1)),
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Délai entre sessions">
                  <input
                    type="number"
                    min="0"
                    value={plannerConfig.daysBetweenSessions}
                    onChange={(event) =>
                      setPlannerConfig((current) => ({
                        ...current,
                        daysBetweenSessions: Math.max(0, Number(event.target.value || 0)),
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Samedi travaillé">
                  <label className="flex h-[46px] items-center gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 text-sm text-[var(--color-text-primary)]">
                    <input
                      type="checkbox"
                      checked={plannerConfig.includeSaturday}
                      onChange={(event) =>
                        setPlannerConfig((current) => ({
                          ...current,
                          includeSaturday: event.target.checked,
                        }))
                      }
                    />
                    Inclure le samedi dans le calcul
                  </label>
                </Field>
                <Field label="Dates bloquées">
                  <textarea
                    value={plannerConfig.blockedDatesText}
                    onChange={(event) =>
                      setPlannerConfig((current) => ({
                        ...current,
                        blockedDatesText: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="2026-05-01, 2026-05-02"
                    className={textareaClassName}
                  />
                </Field>
                <Field label="Jours fériés">
                  <textarea
                    value={plannerConfig.holidaysText}
                    onChange={(event) =>
                      setPlannerConfig((current) => ({
                        ...current,
                        holidaysText: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="2026-04-24, 2026-06-17"
                    className={textareaClassName}
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="2. Modules et équipements"
              subtitle="Le moteur calcule la durée de session à partir des modules retenus."
              icon={<GraduationCap className="h-5 w-5" />}
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-dashed border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4">
                  <div className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
                    Modules actifs
                  </div>
                  <div className="space-y-3">
                    {activeModules.length === 0 && (
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Aucun module actif. Créez d'abord votre référentiel.
                      </p>
                    )}
                    {activeModules.map((module) => {
                      const checked = selectedModuleIds.includes(module.id);
                      return (
                        <div
                          key={module.id}
                          className="grid gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-3 md:grid-cols-[1fr_110px]"
                        >
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setSelectedModuleIds((current) =>
                                  event.target.checked
                                    ? [...current, module.id]
                                    : current.filter((id) => id !== module.id)
                                )
                              }
                              className="mt-1"
                            />
                            <span>
                              <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                                {module.name}
                              </span>
                              <span className="block text-xs text-[var(--color-text-secondary)]">
                                {module.description || 'Sans description'}
                              </span>
                            </span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={moduleDurations[module.id] || module.duration}
                            onChange={(event) =>
                              setModuleDurations((current) => ({
                                ...current,
                                [module.id]: Math.max(1, Number(event.target.value || 1)),
                              }))
                            }
                            className={inputClassName}
                            disabled={!checked}
                            title={`Durée du module ${module.name}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Stock total d'équipements">
                    <input
                      type="number"
                      min="1"
                      value={plannerConfig.equipmentPool}
                      onChange={(event) =>
                        setPlannerConfig((current) => ({
                          ...current,
                          equipmentPool: Math.max(1, Number(event.target.value || 1)),
                        }))
                      }
                      className={inputClassName}
                    />
                  </Field>
                  <Field label="Équipements / stagiaire">
                    <input
                      type="number"
                      min="1"
                      value={plannerConfig.equipmentPerParticipant}
                      onChange={(event) =>
                        setPlannerConfig((current) => ({
                          ...current,
                          equipmentPerParticipant: Math.max(1, Number(event.target.value || 1)),
                        }))
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="3. Ciblage des régions"
            subtitle="Sélection partielle des 14 régions, effectifs et priorités métier."
            icon={<MapPin className="h-5 w-5" />}
          >
            <div className="grid gap-3 md:hidden">
              {regionInputs.map((region) => (
                <div
                  key={region.region}
                  className="rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-[var(--color-text-primary)]">{region.region}</div>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={region.selected}
                        onChange={(event) =>
                          handleRegionChange(region.region, { selected: event.target.checked })
                        }
                      />
                      Active
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <Field label="Stagiaires">
                      <input
                        type="number"
                        min="0"
                        value={region.participants}
                        onChange={(event) =>
                          handleRegionChange(region.region, {
                            participants: Math.max(0, Number(event.target.value || 0)),
                          })
                        }
                        className={inputClassName}
                      />
                    </Field>
                    <Field label="Priorité">
                      <select
                        value={region.priority}
                        onChange={(event) =>
                          handleRegionChange(region.region, { priority: Number(event.target.value) })
                        }
                        className={inputClassName}
                        title={`Priorité ${region.region}`}
                      >
                        <option value={3}>Haute</option>
                        <option value={2}>Moyenne</option>
                        <option value={1}>Normale</option>
                      </select>
                    </Field>
                    <Field label="Salle prioritaire">
                      <select
                        value={region.preferredRoomId}
                        onChange={(event) =>
                          handleRegionChange(region.region, { preferredRoomId: event.target.value })
                        }
                        className={inputClassName}
                        title={`Salle prioritaire ${region.region}`}
                      >
                        <option value="">Aucune</option>
                        {rooms
                          .filter((room) => room.active)
                          .map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name} ({room.capacity})
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>

                  <div className="mt-4 rounded-2xl bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    Sessions estimées :
                    <span className="ml-2 font-semibold text-[var(--color-text-primary)]">
                      {region.selected && region.participants > 0
                        ? Math.ceil(region.participants / plannerConfig.maxParticipantsPerSession)
                        : 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-primary)] text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    <th className="pb-3">Actif</th>
                    <th className="pb-3">Région</th>
                    <th className="pb-3">Stagiaires</th>
                    <th className="pb-3">Priorité</th>
                    <th className="pb-3">Salle prioritaire</th>
                    <th className="pb-3">Sessions estimées</th>
                  </tr>
                </thead>
                <tbody>
                  {regionInputs.map((region) => (
                    <tr key={region.region} className="border-b border-[var(--color-border-primary)]/70">
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={region.selected}
                          onChange={(event) =>
                            handleRegionChange(region.region, { selected: event.target.checked })
                          }
                        />
                      </td>
                      <td className="py-3 font-semibold text-[var(--color-text-primary)]">{region.region}</td>
                      <td className="py-3">
                        <input
                          type="number"
                          min="0"
                          value={region.participants}
                          onChange={(event) =>
                            handleRegionChange(region.region, {
                              participants: Math.max(0, Number(event.target.value || 0)),
                            })
                          }
                          className={`${inputClassName} max-w-[130px]`}
                        />
                      </td>
                      <td className="py-3">
                        <select
                          value={region.priority}
                          onChange={(event) =>
                            handleRegionChange(region.region, { priority: Number(event.target.value) })
                          }
                          className={`${inputClassName} max-w-[130px]`}
                          title={`Priorité ${region.region}`}
                        >
                          <option value={3}>Haute</option>
                          <option value={2}>Moyenne</option>
                          <option value={1}>Normale</option>
                        </select>
                      </td>
                      <td className="py-3">
                        <select
                          value={region.preferredRoomId}
                          onChange={(event) =>
                            handleRegionChange(region.region, { preferredRoomId: event.target.value })
                          }
                          className={`${inputClassName} min-w-[180px]`}
                          title={`Salle prioritaire ${region.region}`}
                        >
                          <option value="">Aucune</option>
                          {rooms
                            .filter((room) => room.active)
                            .map((room) => (
                              <option key={room.id} value={room.id}>
                                {room.name} ({room.capacity})
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="py-3 text-[var(--color-text-secondary)]">
                        {region.selected && region.participants > 0
                          ? Math.ceil(region.participants / plannerConfig.maxParticipantsPerSession)
                          : 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              title="4. Ressources formateurs"
              subtitle="Les indisponibilités évitent les conflits au moment de la génération."
              icon={<Users className="h-5 w-5" />}
            >
              <div className="space-y-4">
                {trainers.map((trainer) => (
                  <div
                    key={trainer.id}
                    className="grid gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 md:grid-cols-[1.1fr_1fr_auto]"
                  >
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={trainer.name}
                        onChange={(event) => handleTrainerChange(trainer.id, { name: event.target.value })}
                        className={inputClassName}
                      />
                      <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                        <input
                          type="checkbox"
                          checked={trainer.active}
                          onChange={(event) =>
                            handleTrainerChange(trainer.id, { active: event.target.checked })
                          }
                        />
                        Formateur actif
                      </label>
                    </div>
                    <textarea
                      rows={3}
                      value={trainer.unavailableDates.join(', ')}
                      onChange={(event) =>
                        handleTrainerChange(trainer.id, {
                          unavailableDates: parseDateList(event.target.value),
                        })
                      }
                      className={textareaClassName}
                      placeholder="2026-05-09, 2026-05-10"
                    />
                    <button
                      onClick={() =>
                        setTrainers((current) => current.filter((item) => item.id !== trainer.id))
                      }
                      className="h-11 w-full rounded-2xl border border-rose-200 px-3 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30 md:w-auto"
                      title="Supprimer formateur"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setTrainers((current) => [
                      ...current,
                      {
                        id: `TR-${Date.now()}`,
                        name: `Formateur ${current.length + 1}`,
                        active: true,
                        unavailableDates: [],
                      },
                    ])
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un formateur
                </button>
              </div>
            </SectionCard>

            <SectionCard
              title="5. Ressources salles"
              subtitle="La capacité et les dates bloquées sont contrôlées avant affectation."
              icon={<Calendar className="h-5 w-5" />}
            >
              <div className="space-y-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="grid gap-3 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 md:grid-cols-[1fr_110px_1fr_auto]"
                  >
                    <input
                      type="text"
                      value={room.name}
                      onChange={(event) => handleRoomChange(room.id, { name: event.target.value })}
                      className={inputClassName}
                    />
                    <input
                      type="number"
                      min="1"
                      value={room.capacity}
                      onChange={(event) =>
                        handleRoomChange(room.id, {
                          capacity: Math.max(1, Number(event.target.value || 1)),
                        })
                      }
                      className={inputClassName}
                    />
                    <textarea
                      rows={3}
                      value={room.unavailableDates.join(', ')}
                      onChange={(event) =>
                        handleRoomChange(room.id, {
                          unavailableDates: parseDateList(event.target.value),
                        })
                      }
                      className={textareaClassName}
                      placeholder="2026-05-15, 2026-05-16"
                    />
                    <div className="flex flex-col items-stretch gap-2 md:items-center">
                      <label className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                        <input
                          type="checkbox"
                          checked={room.active}
                          onChange={(event) => handleRoomChange(room.id, { active: event.target.checked })}
                        />
                        Active
                      </label>
                      <button
                        onClick={() => setRooms((current) => current.filter((item) => item.id !== room.id))}
                        className="rounded-2xl border border-rose-200 px-3 py-2 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                        title="Supprimer salle"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setRooms((current) => [
                      ...current,
                      {
                        id: `RM-${Date.now()}`,
                        name: `Salle ${current.length + 1}`,
                        capacity: plannerConfig.maxParticipantsPerSession,
                        active: true,
                        unavailableDates: [],
                      },
                    ])
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] sm:w-auto"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une salle
                </button>
              </div>
            </SectionCard>
          </div>

          {previewPlan && (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ResultCard
                  label="Sessions générées"
                  value={generatedIndicators.sessionsCount}
                  tone="blue"
                  icon={<Calendar className="h-5 w-5" />}
                />
                <ResultCard
                  label="Stagiaires couverts"
                  value={generatedIndicators.participantsCount}
                  tone="green"
                  icon={<Users className="h-5 w-5" />}
                />
                <ResultCard
                  label="Taux moyen de remplissage"
                  value={`${generatedIndicators.averageFillRate}%`}
                  tone="amber"
                  icon={<CheckCircle2 className="h-5 w-5" />}
                />
                <ResultCard
                  label="Alertes"
                  value={generatedIndicators.alertCount}
                  tone={generatedIndicators.alertCount > 0 ? 'rose' : 'green'}
                  icon={
                    generatedIndicators.alertCount > 0 ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )
                  }
                />
              </div>

              <SectionCard
                title="6. Timeline visuelle"
                subtitle="Vue Gantt légère par région. Glissez une session sur une autre date pour reprogrammer rapidement."
                icon={<Calendar className="h-5 w-5" />}
                action={
                  <div className="hidden items-center gap-2 md:flex">
                    <button
                      onClick={() => setTimelineWindowDays((current) => Math.max(14, current - 7))}
                      className="rounded-xl border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)]"
                    >
                      - 7 j
                    </button>
                    <div className="rounded-xl bg-[var(--color-bg-secondary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                      {timelineWindowDays} jours
                    </div>
                    <button
                      onClick={() => setTimelineWindowDays((current) => current + 7)}
                      className="rounded-xl border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)]"
                    >
                      + 7 j
                    </button>
                  </div>
                }
              >
                <div className="space-y-4 md:hidden">
                  <div className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
                    La timeline complète est disponible sur écran large. Sur mobile, utilisez la liste simplifiée ci-dessous pour relire et reprogrammer les sessions.
                  </div>
                  <div className="space-y-3">
                    {previewPlan.sessions.map((session) => (
                      <div
                        key={session.id}
                        className="rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {session.region} • Session {session.indexInRegion}
                            </div>
                            <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                              {session.startDate} au {session.endDate} • {session.durationDays} j
                            </div>
                          </div>
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                            {session.participants} pers
                          </span>
                        </div>
                        <div className="mt-3 text-sm text-[var(--color-text-secondary)]">
                          {session.trainerName} • {session.roomName}
                        </div>
                        <button
                          onClick={() =>
                            setEditingPreviewSession({
                              id: session.id,
                              region: session.region,
                              participants: session.participants,
                              startDate: session.startDate,
                              trainerId: session.trainerId,
                              roomId: session.roomId,
                            })
                          }
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Reprogrammer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <div
                    className="grid min-w-[1080px] gap-3"
                    style={{
                      gridTemplateColumns: `180px repeat(${Math.max(1, timelineDays.length)}, minmax(56px, 1fr))`,
                    }}
                  >
                    <div className="sticky left-0 z-10 rounded-2xl bg-[var(--color-bg-primary)] p-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                      Régions
                    </div>
                    {timelineDays.map((day) => (
                      <div
                        key={day.iso}
                        className="rounded-2xl bg-[var(--color-bg-secondary)] p-2 text-center"
                      >
                        <div className="text-[11px] font-bold text-[var(--color-text-primary)]">{day.label}</div>
                        <div className="text-[10px] uppercase text-[var(--color-text-muted)]">{day.shortLabel}</div>
                      </div>
                    ))}

                    {timelineRegions.map((region) => {
                      const regionSessions = previewPlan.sessions
                        .filter((session) => session.region === region)
                        .sort((a, b) => a.startDate.localeCompare(b.startDate));

                      return (
                        <React.Fragment key={region}>
                          <div className="sticky left-0 z-10 flex min-h-[90px] items-center rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] px-4 text-sm font-semibold text-[var(--color-text-primary)]">
                            {region}
                          </div>
                          <div
                            className="relative col-span-full grid min-h-[90px] gap-1 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-2"
                            style={{
                              gridColumn: `2 / span ${Math.max(1, timelineDays.length)}`,
                              gridTemplateColumns: `repeat(${Math.max(1, timelineDays.length)}, minmax(56px, 1fr))`,
                            }}
                          >
                            {timelineDays.map((day) => (
                              <div
                                key={`${region}-${day.iso}`}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  if (draggedPreviewSessionId) {
                                    movePreviewSessionToDate(draggedPreviewSessionId, day.iso);
                                    setDraggedPreviewSessionId(null);
                                  }
                                }}
                                className="rounded-xl border border-dashed border-[var(--color-border-primary)]/40"
                              />
                            ))}

                            {regionSessions.map((session, index) => {
                              const startIndex = timelineDays.findIndex((day) => day.iso === session.startDate);
                              if (startIndex === -1) return null;

                              return (
                                <button
                                  key={session.id}
                                  draggable
                                  onDragStart={() => setDraggedPreviewSessionId(session.id)}
                                  onDragEnd={() => setDraggedPreviewSessionId(null)}
                                  onClick={() =>
                                    setEditingPreviewSession({
                                      id: session.id,
                                      region: session.region,
                                      participants: session.participants,
                                      startDate: session.startDate,
                                      trainerId: session.trainerId,
                                      roomId: session.roomId,
                                    })
                                  }
                                  className="group relative flex h-[72px] flex-col justify-between rounded-2xl border border-blue-200 bg-blue-50 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-blue-900/50 dark:bg-blue-950/30"
                                  style={{
                                    gridColumn: `${startIndex + 1} / span ${Math.max(1, Math.min(session.durationDays, timelineDays.length - startIndex))}`,
                                    gridRow: `${index + 1}`,
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
                                      S{session.indexInRegion}
                                    </span>
                                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                      {session.participants} pers
                                    </span>
                                  </div>
                                  <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                                    {session.trainerName}
                                  </div>
                                  <div className="truncate text-[11px] text-[var(--color-text-secondary)]">
                                    {session.roomName}
                                  </div>
                                  <div className="pointer-events-none absolute inset-0 hidden items-center justify-center rounded-2xl bg-blue-600/10 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700 group-hover:flex dark:text-blue-200">
                                    Glisser ou éditer
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
                <SectionCard
                  title="7. Alertes et validation"
                  subtitle="Les anomalies majeures apparaissent avant tout enregistrement."
                  icon={
                    previewPlan.alerts.length > 0 ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )
                  }
                >
                  <div className="space-y-4">
                    {previewPlan.alerts.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                        Planning cohérent: aucun conflit salle, formateur ou équipement détecté.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {previewPlan.alerts.map((alert) => (
                          <div
                            key={alert}
                            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                          >
                            {alert}
                          </div>
                        ))}
                      </div>
                    )}

                    {previewPlan.impossibleRegions.length > 0 && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                        Régions non totalement planifiables: {previewPlan.impossibleRegions.join(', ')}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={exportPreviewCsv}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                      >
                        <Download className="h-4 w-4" />
                        Export CSV
                      </button>
                      <button
                        onClick={exportPreviewPrint}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                      >
                        <Download className="h-4 w-4" />
                        Export PDF / impression
                      </button>
                      <button
                        onClick={() => exportPreviewViaBackend('pdf')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                      >
                        <Download className="h-4 w-4" />
                        Export PDF backend
                      </button>
                      <button
                        onClick={() => exportPreviewViaBackend('docx')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                      >
                        <Download className="h-4 w-4" />
                        Export DOCX backend
                      </button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="8. Vue détaillée des sessions"
                  subtitle="Ordonnancement généré par priorité régionale puis par disponibilité réelle."
                  icon={<Calendar className="h-5 w-5" />}
                >
                  <div className="space-y-3 md:hidden">
                    {previewPlan.sessions.map((session) => (
                      <div
                        key={session.id}
                        className="rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-[var(--color-text-primary)]">{session.region}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">
                              Session #{session.indexInRegion} • Priorité {session.priority}
                            </div>
                          </div>
                          <span className="rounded-full bg-[var(--color-bg-primary)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                            {session.participants} pers
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                              Période
                            </div>
                            <div className="mt-1 text-[var(--color-text-primary)]">
                              {session.startDate} au {session.endDate}
                            </div>
                            <div className="text-xs text-[var(--color-text-secondary)]">{session.durationDays} jour(s)</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                              Ressources
                            </div>
                            <div className="mt-1 text-[var(--color-text-primary)]">
                              {session.trainerName} • {session.roomName}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                              Charge
                            </div>
                            <div className="mt-1 text-[var(--color-text-primary)]">
                              {session.fillRate}% • {session.equipmentNeeded} équipements
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                              Modules
                            </div>
                            <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                              {session.modules.map((module) => `${module.name} (${module.duration}j)`).join(', ')}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            setEditingPreviewSession({
                              id: session.id,
                              region: session.region,
                              participants: session.participants,
                              startDate: session.startDate,
                              trainerId: session.trainerId,
                              roomId: session.roomId,
                            })
                          }
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Reprogrammer
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border-primary)] text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                          <th className="pb-3">Région</th>
                          <th className="pb-3">Session</th>
                          <th className="pb-3">Période</th>
                          <th className="pb-3">Ressources</th>
                          <th className="pb-3">Charge</th>
                          <th className="pb-3">Modules</th>
                          <th className="pb-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewPlan.sessions.map((session) => (
                          <tr key={session.id} className="border-b border-[var(--color-border-primary)]/70 align-top">
                            <td className="py-3">
                              <div className="font-semibold text-[var(--color-text-primary)]">{session.region}</div>
                              <div className="text-xs text-[var(--color-text-secondary)]">Priorité {session.priority}</div>
                            </td>
                            <td className="py-3 text-[var(--color-text-primary)]">#{session.indexInRegion}</td>
                            <td className="py-3">
                              <div className="font-medium text-[var(--color-text-primary)]">{session.startDate}</div>
                              <div className="text-xs text-[var(--color-text-secondary)]">
                                au {session.endDate} • {session.durationDays} j
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="text-[var(--color-text-primary)]">{session.trainerName}</div>
                              <div className="text-xs text-[var(--color-text-secondary)]">{session.roomName}</div>
                            </td>
                            <td className="py-3">
                              <div className="font-semibold text-[var(--color-text-primary)]">
                                {session.participants} stagiaires
                              </div>
                              <div className="text-xs text-[var(--color-text-secondary)]">
                                {session.fillRate}% • {session.equipmentNeeded} équipements
                              </div>
                            </td>
                            <td className="py-3 text-xs text-[var(--color-text-secondary)]">
                              {session.modules.map((module) => `${module.name} (${module.duration}j)`).join(', ')}
                            </td>
                            <td className="py-3">
                              <button
                                onClick={() =>
                                  setEditingPreviewSession({
                                    id: session.id,
                                    region: session.region,
                                    participants: session.participants,
                                    startDate: session.startDate,
                                    trainerId: session.trainerId,
                                    roomId: session.roomId,
                                  })
                                }
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                              >
                                <RefreshCw className="h-4 w-4" />
                                Reprogrammer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            </>
          )}
            </>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <SectionCard
          title="Sessions enregistrées"
          subtitle="Base existante, utilisable comme référence d'historique ou de suivi terrain."
          icon={<Calendar className="h-5 w-5" />}
        >
          <div className="mb-4 grid gap-4 md:grid-cols-4">
            <ResultCard
              label="Sessions en base"
              value={stats?.totalSessions ?? filteredBackendSessions.length}
              tone="blue"
              icon={<Calendar className="h-5 w-5" />}
            />
            <ResultCard
              label="Participants"
              value={stats?.totalParticipants ?? filteredBackendSessions.reduce((sum, session) => sum + (session.participants?.length || 0), 0)}
              tone="green"
              icon={<Users className="h-5 w-5" />}
            />
            <ResultCard
              label="Régions couvertes"
              value={stats?.byRegion?.length ?? 0}
              tone="amber"
              icon={<MapPin className="h-5 w-5" />}
            />
            <ResultCard
              label="Modules suivis"
              value={stats?.byModule?.length ?? 0}
              tone="blue"
              icon={<GraduationCap className="h-5 w-5" />}
            />
          </div>

          <div className="space-y-3 md:hidden">
            {filteredBackendSessions.length === 0 && (
              <div className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
                Aucune session enregistrée.
              </div>
            )}
            {filteredBackendSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--color-text-primary)]">{session.region}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{session.salle}</div>
                  </div>
                  <span className="rounded-full bg-[var(--color-info-light)] px-3 py-1 text-[10px] font-semibold text-[var(--color-info)]">
                    {session.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                      Période
                    </div>
                    <div className="mt-1 text-[var(--color-text-primary)]">
                      {session.startDate} au {session.endDate || 'non calculée'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                      Modules
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {session.sessionModules?.length
                        ? session.sessionModules
                            .sort((a, b) => a.orderIndex - b.orderIndex)
                            .map((item) => `${item.module?.name || 'Module'} (${item.duration || item.module?.duration || 0}j)`)
                            .join(', ')
                        : 'Aucun module'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() =>
                      setEditingBackendSession({
                        id: session.id,
                        region: session.region,
                        salle: session.salle,
                        maxParticipants: session.maxParticipants,
                        startDate: session.startDate,
                        workSaturday: session.workSaturday,
                        workSunday: session.workSunday,
                        status: session.status,
                        notes: session.notes || '',
                        cascadeRegion: true,
                      })
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-primary)] text-left text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  <th className="pb-3">Région</th>
                  <th className="pb-3">Salle</th>
                  <th className="pb-3">Période</th>
                  <th className="pb-3">Modules</th>
                  <th className="pb-3">Statut</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBackendSessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[var(--color-text-secondary)]">
                      Aucune session enregistrée.
                    </td>
                  </tr>
                )}
                {filteredBackendSessions.map((session) => (
                  <tr key={session.id} className="border-b border-[var(--color-border-primary)]/70 align-top">
                    <td className="py-3 font-semibold text-[var(--color-text-primary)]">{session.region}</td>
                    <td className="py-3 text-[var(--color-text-secondary)]">{session.salle}</td>
                    <td className="py-3">
                      <div className="text-[var(--color-text-primary)]">{session.startDate}</div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        au {session.endDate || 'non calculée'}
                      </div>
                    </td>
                    <td className="py-3 text-xs text-[var(--color-text-secondary)]">
                      {session.sessionModules?.length
                        ? session.sessionModules
                            .sort((a, b) => a.orderIndex - b.orderIndex)
                            .map((item) => `${item.module?.name || 'Module'} (${item.duration || item.module?.duration || 0}j)`)
                            .join(', ')
                        : 'Aucun module'}
                    </td>
                    <td className="py-3">
                      <span className="rounded-full bg-[var(--color-info-light)] px-3 py-1 text-xs font-semibold text-[var(--color-info)]">
                        {session.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            setEditingBackendSession({
                              id: session.id,
                              region: session.region,
                              salle: session.salle,
                              maxParticipants: session.maxParticipants,
                              startDate: session.startDate,
                              workSaturday: session.workSaturday,
                              workSunday: session.workSunday,
                              status: session.status,
                              notes: session.notes || '',
                              cascadeRegion: true,
                            })
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {activeTab === 'modules' && (
        <SectionCard
          title="Référentiel modules"
          subtitle="Base de modules réutilisable pour toutes les planifications."
          icon={<GraduationCap className="h-5 w-5" />}
          action={
            <button
              onClick={() => openModuleModal()}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Nouveau module
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.length === 0 && (
              <div className="col-span-full rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
                Aucun module disponible.
              </div>
            )}
            {modules.map((module) => (
              <div
                key={module.id}
                className="rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">{module.name}</div>
                    <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {module.description || 'Sans description'}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      module.isActive === false
                        ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        : 'bg-[var(--color-info-light)] text-[var(--color-info)]'
                    }`}
                  >
                    {module.isActive === false ? 'Désactivé' : 'Actif'}
                  </span>
                </div>
                <div className="mb-4 text-sm text-[var(--color-text-primary)]">
                  {module.duration} jour{module.duration > 1 ? 's' : ''} • Ordre {module.order}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => openModuleModal(module)}
                    className="rounded-xl border border-[var(--color-border-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)]"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDeleteModule(module.id)}
                    className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Historique des modifications"
        subtitle="Journal local des reprogrammations et validations réalisées sur cette page."
        icon={<Clock className="h-5 w-5" />}
      >
        <div className="space-y-3">
          {historyEntries.length === 0 && (
            <div className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
              Aucun changement enregistré pour le moment.
            </div>
          )}
          {historyEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4"
            >
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{entry.title}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {new Date(entry.timestamp).toLocaleString('fr-FR')}
                </div>
              </div>
              <div className="mt-2 text-sm text-[var(--color-text-secondary)]">{entry.details}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {moduleModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-[var(--color-text-primary)]">
                  {editingModuleId ? 'Modifier le module' : 'Créer un module'}
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Définir un module réutilisable dans le moteur de planning.
                </div>
              </div>
              <button
                onClick={() => setModuleModalOpen(false)}
                className="rounded-2xl p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
                title="Fermer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4">
              <Field label="Nom du module">
                <input
                  type="text"
                  value={moduleForm.name}
                  onChange={(event) => setModuleForm((current) => ({ ...current, name: event.target.value }))}
                  className={inputClassName}
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={3}
                  value={moduleForm.description}
                  onChange={(event) =>
                    setModuleForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className={textareaClassName}
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Durée par défaut (jours)">
                  <input
                    type="number"
                    min="1"
                    value={moduleForm.duration}
                    onChange={(event) =>
                      setModuleForm((current) => ({
                        ...current,
                        duration: Math.max(1, Number(event.target.value || 1)),
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Ordre d'affichage">
                  <input
                    type="number"
                    min="0"
                    value={moduleForm.order}
                    onChange={(event) =>
                      setModuleForm((current) => ({
                        ...current,
                        order: Math.max(0, Number(event.target.value || 0)),
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setModuleModalOpen(false)}
                className="rounded-xl border border-[var(--color-border-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)]"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveModule}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPreviewSession && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-[var(--color-text-primary)]">
                  Reprogrammer une session générée
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Modification locale avec revalidation immédiate des conflits.
                </div>
              </div>
              <button
                onClick={() => setEditingPreviewSession(null)}
                className="rounded-2xl p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Région">
                <select
                  value={editingPreviewSession.region}
                  onChange={(event) =>
                    setEditingPreviewSession((current) =>
                      current ? { ...current, region: event.target.value } : current
                    )
                  }
                  className={inputClassName}
                  title="Région"
                >
                  {SENEGAL_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Participants">
                <input
                  type="number"
                  min="1"
                  value={editingPreviewSession.participants}
                  onChange={(event) =>
                    setEditingPreviewSession((current) =>
                      current
                        ? {
                            ...current,
                            participants: Math.max(1, Number(event.target.value || 1)),
                          }
                        : current
                    )
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Date de démarrage">
                <input
                  type="date"
                  value={editingPreviewSession.startDate}
                  onChange={(event) =>
                    setEditingPreviewSession((current) =>
                      current ? { ...current, startDate: event.target.value } : current
                    )
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Formateur">
                <select
                  value={editingPreviewSession.trainerId}
                  onChange={(event) =>
                    setEditingPreviewSession((current) =>
                      current ? { ...current, trainerId: event.target.value } : current
                    )
                  }
                  className={inputClassName}
                  title="Formateur"
                >
                  {trainers
                    .filter((trainer) => trainer.active)
                    .map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Salle">
                <select
                  value={editingPreviewSession.roomId}
                  onChange={(event) =>
                    setEditingPreviewSession((current) =>
                      current ? { ...current, roomId: event.target.value } : current
                    )
                  }
                  className={inputClassName}
                  title="Salle"
                >
                  {rooms
                    .filter((room) => room.active)
                    .map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name} ({room.capacity})
                      </option>
                    ))}
                </select>
              </Field>
              <div className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
                Fin recalculée automatiquement selon les modules sélectionnés:{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {computeSessionEndDate(
                    editingPreviewSession.startDate,
                    totalModuleDays,
                    plannerConfig.includeSaturday,
                    blockedDates
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingPreviewSession(null)}
                className="rounded-xl border border-[var(--color-border-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)]"
              >
                Annuler
              </button>
              <button
                onClick={savePreviewSessionEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                <Save className="h-4 w-4" />
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBackendSession && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-[var(--color-text-primary)]">
                  Modifier une session enregistrée
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  La date de fin sera recalculée par l'API en fonction des modules déjà liés.
                </div>
              </div>
              <button
                onClick={() => setEditingBackendSession(null)}
                className="rounded-2xl p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Région">
                <select
                  value={editingBackendSession.region}
                  onChange={(event) =>
                    setEditingBackendSession((current) =>
                      current ? { ...current, region: event.target.value } : current
                    )
                  }
                  className={inputClassName}
                  title="Région"
                >
                  {SENEGAL_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Salle">
                <input
                  type="text"
                  value={editingBackendSession.salle}
                  onChange={(event) =>
                    setEditingBackendSession((current) =>
                      current ? { ...current, salle: event.target.value } : current
                    )
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Date de démarrage">
                <input
                  type="date"
                  value={editingBackendSession.startDate}
                  onChange={(event) =>
                    setEditingBackendSession((current) =>
                      current ? { ...current, startDate: event.target.value } : current
                    )
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Capacité">
                <input
                  type="number"
                  min="1"
                  value={editingBackendSession.maxParticipants}
                  onChange={(event) =>
                    setEditingBackendSession((current) =>
                      current
                        ? {
                            ...current,
                            maxParticipants: Math.max(1, Number(event.target.value || 1)),
                          }
                        : current
                    )
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Statut">
                <select
                  value={editingBackendSession.status}
                  onChange={(event) =>
                    setEditingBackendSession((current) =>
                      current ? { ...current, status: event.target.value } : current
                    )
                  }
                  className={inputClassName}
                  title="Statut"
                >
                  <option value="PLANIFIEE">PLANIFIEE</option>
                  <option value="EN_COURS">EN_COURS</option>
                  <option value="TERMINEE">TERMINEE</option>
                  <option value="ANNULEE">ANNULEE</option>
                </select>
              </Field>
              <Field label="Calendrier">
                <div className="grid gap-2 rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-secondary)]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingBackendSession.workSaturday}
                      onChange={(event) =>
                        setEditingBackendSession((current) =>
                          current ? { ...current, workSaturday: event.target.checked } : current
                        )
                      }
                    />
                    Samedi travaillé
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingBackendSession.workSunday}
                      onChange={(event) =>
                        setEditingBackendSession((current) =>
                          current ? { ...current, workSunday: event.target.checked } : current
                        )
                      }
                    />
                    Dimanche travaillé
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingBackendSession.cascadeRegion}
                      onChange={(event) =>
                        setEditingBackendSession((current) =>
                          current ? { ...current, cascadeRegion: event.target.checked } : current
                        )
                      }
                    />
                    Recalculer les sessions suivantes de la région
                  </label>
                </div>
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes">
                  <textarea
                    rows={3}
                    value={editingBackendSession.notes}
                    onChange={(event) =>
                      setEditingBackendSession((current) =>
                        current ? { ...current, notes: event.target.value } : current
                      )
                    }
                    className={textareaClassName}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingBackendSession(null)}
                className="rounded-xl border border-[var(--color-border-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)]"
              >
                Annuler
              </button>
              <button
                onClick={saveBackendSessionEdit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Mettre à jour
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function SectionCard({
  title,
  subtitle,
  icon,
  action,
  className,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-4 shadow-sm sm:p-6 ${className || ''}`}>
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--gradient-primary-subtle)] text-[var(--color-primary)] sm:h-11 sm:w-11">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)] sm:text-lg">{title}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">{label}</div>
      {children}
    </label>
  );
}

function ResultCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'amber' | 'rose';
}) {
  const toneMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300',
  };

  return (
    <div className="rounded-3xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-3 shadow-sm sm:p-5">
      <div className={`mb-2 inline-flex rounded-2xl p-2.5 sm:mb-3 sm:p-3 ${toneMap[tone]}`}>{icon}</div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tracking-tight text-[var(--color-text-primary)] sm:mt-2 sm:text-3xl">{value}</div>
    </div>
  );
}

function QuickAnswerCard({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] p-4">
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {question}
      </div>
      <div className="mt-2 text-sm text-[var(--color-text-secondary)]">{answer}</div>
    </div>
  );
}

const inputClassName =
  'h-[46px] w-full rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)]';

const textareaClassName =
  'w-full rounded-2xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-primary)]';

function mapHistoryEntryFromApi(entry: ApiHistoryEntry): PlanningHistoryEntry {
  const typeMap: Record<string, PlanningHistoryEntry['type']> = {
    preview_generated: 'preview_generated',
    preview_updated: 'preview_updated',
    preview_persisted: 'preview_persisted',
    session_updated: 'session_updated',
    session_deleted: 'session_deleted',
    session_created: 'session_updated',
    session_cascade_replanned: 'session_updated',
  };

  return {
    id: String(entry.id),
    timestamp: entry.createdAt || entry.timestamp || new Date().toISOString(),
    type: typeMap[entry.action] || 'session_updated',
    title: entry.title || entry.action || 'Historique',
    details: entry.details || '',
  };
}
