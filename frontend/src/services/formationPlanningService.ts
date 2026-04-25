const API_BASE = '/api/formations';

export const AI_STRUCTURED_QUESTION_IDS = [
  'regional_volumes',
  'modules',
  'start_date',
  'delivery_mode',
] as const;

export const MAX_TIMELINE_DAYS_CLASS = 60;
export const MAX_TIMELINE_ROWS_CLASS = 40;

export const SENEGAL_REGIONS = [
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

export type RegionName = (typeof SENEGAL_REGIONS)[number];
export type PageTab = 'planner' | 'sessions' | 'modules';
export type PlannerExperienceMode = 'ai' | 'manual';
export type PlannerDeliveryMode = 'single' | 'multiple';

export interface FormationModule {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  order: number;
  isActive?: boolean;
}

export interface SessionModule {
  id: string;
  sessionId: string;
  moduleId: string;
  duration: number | null;
  orderIndex: number;
  notes: string | null;
  module: FormationModule;
}

export interface FormationParticipant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  attendance: boolean;
}

export interface FormationSession {
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

export interface RegionInput {
  region: RegionName;
  selected: boolean;
  participants: number;
  priority: number;
  preferredRoomId: string;
}

export interface TrainerResource {
  id: string;
  name: string;
  active: boolean;
  unavailableDates: string[];
}

export interface RoomResource {
  id: string;
  name: string;
  capacity: number;
  active: boolean;
  unavailableDates: string[];
}

export interface PlannerConfig {
  startDate: string;
  maxParticipantsPerSession: number;
  includeSaturday: boolean;
  daysBetweenSessions: number;
  blockedDatesText: string;
  holidaysText: string;
  equipmentPool: number;
  equipmentPerParticipant: number;
}

export interface PlannerPreviewRequest {
  plannerDeliveryMode: PlannerDeliveryMode | null;
  plannerConfig: PlannerConfig;
  regions: RegionInput[];
  trainers: TrainerResource[];
  rooms: RoomResource[];
  modules: Array<{ moduleId: string; name: string; duration: number }>;
}

export interface PreviewSession {
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

export interface PreviewPlan {
  sessions: PreviewSession[];
  alerts: string[];
  impossibleRegions: string[];
  generationSignature?: string;
}

export interface PlannerStatePayload {
  plannerMode?: PlannerExperienceMode;
  plannerDeliveryMode?: PlannerDeliveryMode | null;
  aiStepCursor?: number;
  plannerConfig?: PlannerConfig;
  regionInputs?: RegionInput[];
  trainers?: TrainerResource[];
  rooms?: RoomResource[];
  selectedModuleIds?: string[];
  moduleDurations?: Record<string, number>;
  previewPlan?: PreviewPlan | null;
}

export interface PlanningHistoryEntry {
  id: string;
  timestamp: string;
  type: 'preview_generated' | 'preview_updated' | 'preview_persisted' | 'session_updated' | 'session_deleted';
  title: string;
  details: string;
}

export interface PreviewSessionEditState {
  id: string;
  region: string;
  participants: number;
  startDate: string;
  trainerId: string;
  roomId: string;
}

export interface BackendSessionEditState {
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

export interface StatsResponse {
  totalSessions?: number;
  totalParticipants?: number;
  byRegion?: Array<{ region: string; count: number }>;
  byModule?: Array<{ module: string; count: number }>;
}

export interface ApiHistoryEntry {
  id: string;
  action?: string;
  title?: string;
  details?: string | null;
  timestamp?: string;
  createdAt?: string;
}

export interface TimelineDay {
  iso: string;
  label: string;
  shortLabel: string;
}

export interface PreviewSessionValidationRequest {
  sessionId: string;
  updates: Partial<
    Pick<PreviewSessionEditState, 'region' | 'participants' | 'startDate' | 'trainerId' | 'roomId'>
  >;
  plan: PreviewPlan;
  plannerConfig: PlannerConfig;
  trainers: TrainerResource[];
  rooms: RoomResource[];
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Erreur serveur (${response.status})`);
  }
  return response.json();
};

const downloadResponseBlob = async (response: Response, fallbackFileName: string) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Erreur serveur (${response.status})`);
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

export const formationApi = {
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
  deleteModule: (id: string) => fetch(`${API_BASE}/modules/${id}`, { method: 'DELETE' }).then(handleResponse),
  getSessions: (): Promise<FormationSession[]> => fetch(`${API_BASE}/sessions`).then(handleResponse),
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
  deleteSession: (id: string) => fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' }).then(handleResponse),
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
  clearHistory: () => fetch(`${API_BASE}/history`, { method: 'DELETE' }).then(handleResponse),
  planifyPreview: (data: PlannerPreviewRequest): Promise<PreviewPlan> =>
    fetch(`${API_BASE}/planify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  validatePreviewSession: (data: PreviewSessionValidationRequest): Promise<{ session: PreviewSession }> =>
    fetch(`${API_BASE}/planify/validate-preview-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
  commitPlan: (data: {
    plan: PreviewPlan;
    options: { workSaturday: boolean; workSunday: boolean };
  }) =>
    fetch(`${API_BASE}/planify/commit`, {
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
        trainerName?: string;
        durationDays?: number;
        modules: Array<{ moduleId: string; duration: number; moduleName?: string }>;
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
  getPlannerState: (): Promise<PlannerStatePayload | null> => fetch(`${API_BASE}/planner-state`).then(handleResponse),
  savePlannerState: (data: PlannerStatePayload) =>
    fetch(`${API_BASE}/planner-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(handleResponse),
};

export function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function diffDaysInclusive(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function parseDateList(text: string) {
  return text
    .split(/[,\n;]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function isWorkingDay(date: Date, includeSaturday: boolean, blockedDates: Set<string>) {
  const day = date.getDay();
  const iso = formatDate(date);
  if (blockedDates.has(iso)) return false;
  if (day === 0) return false;
  if (day === 6 && !includeSaturday) return false;
  return true;
}

export function computeSessionEndDate(
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

export function buildDateRange(startDate: string, endDate: string) {
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

export function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const defaultRegionInputs: RegionInput[] = SENEGAL_REGIONS.map((region) => ({
  region,
  selected: false,
  participants: 0,
  priority: 1,
  preferredRoomId: '',
}));

export function mergeRegionInputsWithDefaults(savedRegions?: RegionInput[]) {
  const savedMap = new Map((savedRegions || []).map((region) => [region.region, region]));
  return defaultRegionInputs.map((region) => ({
    ...region,
    ...(savedMap.get(region.region) || {}),
  }));
}

export function clampAiStepCursor(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), AI_STRUCTURED_QUESTION_IDS.length));
}

export function buildPlannerGenerationSignature(input: {
  plannerDeliveryMode: PlannerDeliveryMode | null;
  plannerConfig: PlannerConfig;
  selectedRegions: RegionInput[];
  selectedModules: Array<{ moduleId: string; name: string; duration: number }>;
  trainers: TrainerResource[];
  rooms: RoomResource[];
}) {
  return JSON.stringify({
    plannerDeliveryMode: input.plannerDeliveryMode,
    plannerConfig: {
      startDate: input.plannerConfig.startDate,
      maxParticipantsPerSession: input.plannerConfig.maxParticipantsPerSession,
      includeSaturday: input.plannerConfig.includeSaturday,
      daysBetweenSessions: input.plannerConfig.daysBetweenSessions,
      blockedDatesText: input.plannerConfig.blockedDatesText,
      holidaysText: input.plannerConfig.holidaysText,
      equipmentPool: input.plannerConfig.equipmentPool,
      equipmentPerParticipant: input.plannerConfig.equipmentPerParticipant,
    },
    selectedRegions: input.selectedRegions.map((region) => ({
      region: region.region,
      participants: region.participants,
      priority: region.priority,
      preferredRoomId: region.preferredRoomId,
    })),
    selectedModules: input.selectedModules.map((module) => ({
      moduleId: module.moduleId,
      name: module.name,
      duration: module.duration,
    })),
    trainers: input.trainers
      .filter((trainer) => trainer.active)
      .map((trainer) => ({
        id: trainer.id,
        unavailableDates: [...trainer.unavailableDates].sort(),
      })),
    rooms: input.rooms
      .filter((room) => room.active)
      .map((room) => ({
        id: room.id,
        capacity: room.capacity,
        unavailableDates: [...room.unavailableDates].sort(),
      })),
  });
}
