import apiClient from '../../../api/client';
import type {
  LotKey, LotMode, StatusValue,
} from '../types';

/* ── Types for API responses ── */

interface HouseholdEntryAPI {
  A: { status: StatusValue; justif: string; updatedAt: string | null };
  B: { status: StatusValue; justif: string; updatedAt: string | null };
  C: { status: StatusValue; justif: string; updatedAt: string | null };
  conforme: boolean;
  obs: string;
}

interface EntrepreneurAPI {
  id: string;
  lot: string;
  grappeKey: string | null;
  mode: string;
  groupId: string | null;
  entreprise: string;
  societe: string;
  telephone: string;
  email: string;
  adresse: string;
}

interface RegionAPI {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GrappeAPI {
  id: string;
  organizationId: string;
  regionId: string;
  grappeNumber: number;
  grappeKey: string;
  menageCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  region?: RegionAPI;
}

interface LotAPI {
  id: string;
  organizationId: string;
  lotKey: string;
  title: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ── Household Entries ── */

export async function fetchEntries(): Promise<Record<number, HouseholdEntryAPI>> {
  const { data } = await apiClient.get('/carto-grappes/entries');
  return data;
}

export async function saveEntry(
  householdOrdre: number,
  lot: LotKey,
  status: StatusValue,
  justif: string,
  meta?: { nom?: string; village?: string; region?: string; fromStatus?: string },
) {
  const { data } = await apiClient.post('/carto-grappes/entries', {
    householdOrdre, lot, status, justif, ...meta,
  });
  return data;
}

export async function saveConforme(householdOrdre: number, conforme: boolean) {
  const { data } = await apiClient.post('/carto-grappes/entries', {
    householdOrdre, conforme,
  });
  return data;
}

export async function saveObs(householdOrdre: number, obs: string) {
  const { data } = await apiClient.post('/carto-grappes/entries', {
    householdOrdre, obs,
  });
  return data;
}

/* ── Entrepreneurs ── */

export async function fetchEntrepreneurs(lot?: string): Promise<EntrepreneurAPI[]> {
  const params = lot ? { lot } : {};
  const { data } = await apiClient.get('/carto-grappes/entrepreneurs', { params });
  return data;
}

export async function saveEntrepreneur(payload: {
  lot: string; grappeKey?: string; mode?: string; groupId?: string;
  entreprise?: string; societe?: string; telephone?: string; email?: string; adresse?: string;
}) {
  const { data } = await apiClient.post('/carto-grappes/entrepreneurs', payload);
  return data;
}

export async function deleteEntrepreneur(id: string) {
  await apiClient.delete(`/carto-grappes/entrepreneurs/${id}`);
}

/* ── Village Overrides ── */

export async function fetchVillageOverrides(): Promise<Record<string, number>> {
  const { data } = await apiClient.get('/carto-grappes/overrides');
  return data;
}

export async function saveVillageOverride(villageKey: string, grappeNumber: number) {
  const { data } = await apiClient.post('/carto-grappes/overrides', { villageKey, grappeNumber });
  return data;
}

/* ── Settings (lot modes, etc.) ── */

export async function fetchSettings(): Promise<{
  lotModes?: Record<LotKey, LotMode>;
  bareme?: Record<string, unknown>;
  lotLabels?: Record<string, string>;
  featureToggles?: Record<string, boolean>;
}> {
  const { data } = await apiClient.get('/carto-grappes/settings');
  return data;
}

export async function saveSettings(settings: Record<string, unknown>) {
  const { data } = await apiClient.put('/carto-grappes/settings', settings);
  return data;
}

/* ── History ── */

export async function fetchHistory(limit = 500) {
  const { data } = await apiClient.get('/carto-grappes/history', { params: { limit } });
  return data;
}

export async function clearHistory() {
  await apiClient.delete('/carto-grappes/history');
}

/* ── Workflow ── */

export async function fetchWorkflowQueue() {
  const { data } = await apiClient.get('/carto-grappes/workflow');
  return data;
}

export async function submitWorkflow(payload: {
  householdOrdre: number; nom: string; village: string;
  region: string; grappe: string; statuts: Record<string, unknown>;
}) {
  const { data } = await apiClient.post('/carto-grappes/workflow', payload);
  return data;
}

export async function approveWorkflow(id: string) {
  const { data } = await apiClient.put(`/carto-grappes/workflow/${id}/approve`);
  return data;
}

/* ── Archives ── */

export async function fetchArchives() {
  const { data } = await apiClient.get('/carto-grappes/archives');
  return data;
}

export async function createArchive(payload: {
  grappeKey: string; region: string; grappe: string;
  totalMenages: number; totalConformes: number; snapshot: unknown[];
}) {
  const { data } = await apiClient.post('/carto-grappes/archives', payload);
  return data;
}

/* ── Stats ── */

export async function fetchStatsSnapshots() {
  const { data } = await apiClient.get('/carto-grappes/stats');
  return data;
}

export async function createStatsSnapshot(payload: {
  conforme: number; lotA: number; lotB: number; lotC: number; bloques: number;
}) {
  const { data } = await apiClient.post('/carto-grappes/stats/snapshot', payload);
  return data;
}

/* ── Planning Params ── */

export async function fetchPlanningParams(): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get('/carto-grappes/planning');
  return data;
}

export async function savePlanningParams(params: Record<string, unknown>) {
  const { data } = await apiClient.put('/carto-grappes/planning', { params });
  return data;
}

/* ── Gantt ── */

export async function fetchGantt(): Promise<Array<{
  id: string; grappeKey: string; phase: string;
  startDate: string | null; endDate: string | null; status: string;
  data: Record<string, unknown> | null;
}>> {
  const { data } = await apiClient.get('/carto-grappes/gantt');
  return data;
}

export async function saveGantt(entry: {
  grappeKey: string; phase: string; startDate?: string;
  endDate?: string; status?: string; data?: Record<string, unknown>;
}) {
  const { data } = await apiClient.post('/carto-grappes/gantt', entry);
  return data;
}

/* ── Photos ── */

export async function fetchPhoto(householdOrdre: number, lot: string) {
  try {
    const { data } = await apiClient.get('/carto-grappes/photos', {
      params: { householdOrdre, lot },
    });
    return data;
  } catch {
    return null;
  }
}

export async function savePhoto(householdOrdre: number, lot: string, data_: string) {
  const { data } = await apiClient.post('/carto-grappes/photos', {
    householdOrdre, lot, data: data_,
  });
  return data;
}

/* ── Fiches ── */

export async function fetchFiches(ficheKey?: string) {
  const params = ficheKey ? { ficheKey } : {};
  const { data } = await apiClient.get('/carto-grappes/fiches', { params });
  return data;
}

export async function addFicheEntry(ficheKey: string, data_: unknown) {
  const { data } = await apiClient.post('/carto-grappes/fiches', { ficheKey, data: data_ });
  return data;
}

export async function deleteFicheEntry(entryId: string) {
  const { data } = await apiClient.delete(`/carto-grappes/fiches/${entryId}`);
  return data;
}

/* ── Contract Templates ── */

export async function fetchContractTemplates(): Promise<Record<string, string>> {
  const { data } = await apiClient.get('/carto-grappes/templates');
  return data;
}

export async function saveContractTemplate(lot: string, htmlContent: string) {
  const { data } = await apiClient.post('/carto-grappes/templates', { lot, htmlContent });
  return data;
}

/* ── Alerts ── */

export async function fetchAlertsConfig() {
  const { data } = await apiClient.get('/carto-grappes/alerts');
  return data;
}

export async function saveAlertsConfig(config: {
  delayDays?: number; enabled?: boolean; dismissed?: boolean;
}) {
  const { data } = await apiClient.put('/carto-grappes/alerts', config);
  return data;
}

/* ── Regions, Grappes and Lots ── */

export async function fetchRegions(): Promise<RegionAPI[]> {
  const { data } = await apiClient.get('/carto-grappes/regions');
  return data;
}

export async function upsertRegion(region: Partial<RegionAPI>): Promise<RegionAPI> {
  const { data } = await apiClient.post('/carto-grappes/regions', region);
  return data;
}

export async function fetchGrappes(regionId?: string): Promise<GrappeAPI[]> {
  const url = regionId ? `/carto-grappes/grappes?regionId=${regionId}` : '/carto-grappes/grappes';
  const { data } = await apiClient.get(url);
  return data;
}

export async function upsertGrappe(grappe: Partial<GrappeAPI>): Promise<GrappeAPI> {
  const { data } = await apiClient.post('/carto-grappes/grappes', grappe);
  return data;
}

export async function fetchLots(): Promise<LotAPI[]> {
  const { data } = await apiClient.get('/carto-grappes/lots');
  return data;
}

export async function upsertLot(lot: Partial<LotAPI>): Promise<LotAPI> {
  const { data } = await apiClient.post('/carto-grappes/lots', lot);
  return data;
}

export async function initializeDefaultData() {
  const { data } = await apiClient.post('/carto-grappes/initialize');
  return data;
}

export async function fetchDashboardStats() {
  const { data } = await apiClient.get('/carto-grappes/dashboard-stats');
  return data;
}

/* ── Reference Data ── */

export async function fetchVillages() {
  const { data } = await apiClient.get('/carto-grappes/villages');
  return data;
}

export async function fetchMenages() {
  const { data } = await apiClient.get('/carto-grappes/menages');
  return data;
}

export async function fetchGps() {
  const { data } = await apiClient.get('/carto-grappes/gps');
  return data;
}

export async function fetchPrestataires() {
  const { data } = await apiClient.get('/carto-grappes/prestataires');
  return data;
}

export async function savePrestataires(prestataires: any[]) {
  const { data } = await apiClient.post('/carto-grappes/prestataires/bulk', { prestataires });
  return data;
}

export async function updatePrestataire(id: number, prestataire: any) {
  const { data } = await apiClient.put(`/carto-grappes/prestataires/${id}`, prestataire);
  return data;
}

export async function deletePrestataire(id: number) {
  await apiClient.delete(`/carto-grappes/prestataires/${id}`);
}
