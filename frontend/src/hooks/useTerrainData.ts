/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { db } from '../store/db';
import type { Household } from '../utils/types';
import { useProject } from '../contexts/ProjectContext';
import apiClient from '../api/client';
import logger from '../utils/logger';
import { cacheHouseholdsForOffline, getOfflineHouseholds } from '../services/offlineStorage';
import * as safeStorage from '../utils/safeStorage';
import { compressImage } from '../utils/imageUtils';

const HOUSEHOLDS_CACHE_TTL_MS = 5000;
const HOUSEHOLDS_PAGE_SIZE = 2000; // Progressive loading: 2000 per page
const householdsCache = new Map<string, { data: Household[]; timestamp: number }>();
const householdsInflight = new Map<string, Promise<Household[]>>();

const getStoredAccessToken = () => {
  const token = safeStorage.getItem('access_token');
  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }
  return token;
};

export function mapToApiPayload(
  household: Partial<Household>,
  overrides: Record<string, unknown> = {}
) {
  const id = household.backendId || household.id || crypto.randomUUID();
  return {
    id,
    projectId: household.projectId,
    zoneId: household.zoneId,
    organizationId: household.organizationId,
    status: household.status || 'planned',
    owner: household.owner || {},
    location: household.location,
    koboData: household.koboData || {},
    koboSync: household.koboSync || {},
    assignedTeams: household.assignedTeams?.length ? household.assignedTeams : [],
    name: household.name,
    phone: household.phone,
    region: household.region,
    departement: household.departement,
    village: household.village,
    ...overrides,
  };
}

const getNormalizedCoords = (h: any): [number, number] | null => {
  try {
    let lat: any = null;
    let lng: any = null;
    if (
      h.location?.coordinates &&
      Array.isArray(h.location.coordinates) &&
      h.location.coordinates.length === 2
    ) {
      const [cLng, cLat] = (h.location?.coordinates || []).map((val: unknown) =>
        typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val)
      );
      if (!isNaN(cLng) && !isNaN(cLat)) {
        lng = cLng;
        lat = cLat;
      }
    }
    if (!lat || !lng) {
      const geo = h._geolocation || h.koboData?._geolocation;
      if (Array.isArray(geo) && geo.length >= 2) {
        lat = geo[0];
        lng = geo[1];
      }
    }
    if (!lat || !lng) {
      lat = h.latitude ?? h.koboData?.latitude ?? h.koboSync?.latitude;
      lng = h.longitude ?? h.koboData?.longitude ?? h.koboSync?.longitude;
    }
    const numLat = typeof lat === 'string' ? parseFloat(lat.replace(',', '.')) : Number(lat);
    const numLng = typeof lng === 'string' ? parseFloat(lng.replace(',', '.')) : Number(lng);
    if (!isNaN(numLat) && !isNaN(numLng) && numLat !== 0 && numLng !== 0) return [numLng, numLat];
    return null;
  } catch (err) {
    return null;
  }
};

const normalizeHousehold = (h: Household): Household => {
  const coords = getNormalizedCoords(h);
  if (coords) {
    h.location = { type: 'Point', coordinates: coords };
    h.longitude = coords[0];
    h.latitude = coords[1];
  }
  return h;
};

type OfflineHouseholdRecord = Partial<Household> & Record<string, unknown>;

const toHousehold = (household: OfflineHouseholdRecord): Household => household as unknown as Household;

const updateProjectCache = (
  projectId: string | null | undefined,
  updater: (current: Household[]) => Household[]
) => {
  if (!projectId) return;
  const existing = householdsCache.get(projectId);
  const next = updater(existing?.data || []);
  householdsCache.set(projectId, { data: next, timestamp: Date.now() });
};

const persistHouseholdsLocally = async (projectId: string, households: Household[]) => {
  const normalized = households.map((household) => normalizeHousehold({ ...household }));
  const existingIds = new Set(
    normalized.map((household) => household.backendId || household.id).filter(Boolean)
  );

  const localProjectHouseholds = await db.households.where('projectId').equals(projectId).toArray();
  const staleIds = localProjectHouseholds
    .filter((household) => !existingIds.has(household.backendId || household.id))
    .map((household) => household.id);

  if (staleIds.length > 0) {
    await db.households.bulkDelete(staleIds);
  }

  await db.households.bulkPut(normalized);
  await cacheHouseholdsForOffline(normalized as unknown as Record<string, unknown>[]);
};

const loadHouseholdsFromLocalFallback = async (projectId: string) => {
  const dexieHouseholds = await db.households.where('projectId').equals(projectId).toArray();
  if (dexieHouseholds.length > 0) {
    return dexieHouseholds.map((household) => normalizeHousehold({ ...household }));
  }

  const offlineRecords = await getOfflineHouseholds();
  return offlineRecords
    .filter((household) => String(toHousehold(household as OfflineHouseholdRecord).projectId) === projectId)
    .map((household) => normalizeHousehold(toHousehold(household as OfflineHouseholdRecord)));
};

interface UseTerrainDataOptions {
  enabled?: boolean;
}

export function useTerrainData(options: UseTerrainDataOptions = {}) {
  const { enabled = true } = options;
  const { activeProjectId, project } = useProject();
  // Keep using the persisted active project id while ProjectContext/Dexie
  // is still hydrating or when /projects sync temporarily fails.
  const currentProjectId = project?.id ?? activeProjectId ?? null;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ✅ SERVER-FIRST: React State instead of useLiveQuery (Dexie)
  const [householdsRaw, setHouseholdsRaw] = useState<Household[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadHouseholds = useCallback(async () => {
    if (!enabled) {
      setHouseholdsRaw([]);
      setIsLoading(false);
      setError(null);
      return [];
    }

    if (!currentProjectId) {
      setHouseholdsRaw([]);
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);
    setError(null);

    const cached = householdsCache.get(currentProjectId);
    if (cached && Date.now() - cached.timestamp < HOUSEHOLDS_CACHE_TTL_MS) {
      setHouseholdsRaw(cached.data);
      setIsLoading(false);
      return cached.data;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      const fallback = await loadHouseholdsFromLocalFallback(currentProjectId);
      if (fallback.length > 0) {
        logger.warn(
          `[TerrainData] Aucun token disponible, utilisation du cache local pour ${currentProjectId} (${fallback.length} ménages)`
        );
        householdsCache.set(currentProjectId, { data: fallback, timestamp: Date.now() });
        setHouseholdsRaw(fallback);
        setIsLoading(false);
        setError(null);
        return fallback;
      }

      setHouseholdsRaw([]);
      setIsLoading(false);
      setError('Session expirée. Réconnectez-vous pour charger les ménages.');
      return [];
    }

    const pending = householdsInflight.get(currentProjectId);
    if (pending) {
      try {
        const data = await pending;
        setHouseholdsRaw(data);
        return data;
      } catch (err: any) {
        setError(err.message || 'Failed to load households');
        return [];
      } finally {
        setIsLoading(false);
      }
    }

    const request = (async () => {
      logger.log(`📡 [Server-First] Fetching households for Project: ${currentProjectId} (paginated, ${HOUSEHOLDS_PAGE_SIZE}/page)`);
      try {
        let allHouseholds: Household[] = [];
        let currentPage = 1;
        let hasMore = true;

        while (hasMore) {
          const response = await apiClient.get('/households', {
            params: {
              projectId: currentProjectId,
              limit: HOUSEHOLDS_PAGE_SIZE,
              page: currentPage,
            },
          });

          const pageData: Household[] = (response.data.households || []).map(
            (h: Household) => normalizeHousehold(h)
          );
          allHouseholds = [...allHouseholds, ...pageData];
          hasMore = response.data.hasMore === true;

          // Progressive UI update: show results as they arrive
          if (currentPage === 1 || pageData.length > 0) {
            setHouseholdsRaw([...allHouseholds]);
          }

          logger.log(
            `📦 [Server-First] Page ${currentPage}: ${pageData.length} households (total: ${allHouseholds.length}, hasMore: ${hasMore})`
          );
          currentPage++;
        }

        logger.log(`✅ [Server-First] Retrieved ${allHouseholds.length} unique households from backend`);
        householdsCache.set(currentProjectId, { data: allHouseholds, timestamp: Date.now() });
        await persistHouseholdsLocally(currentProjectId, allHouseholds);

        return allHouseholds;
      } catch (err: any) {
        const fallback = await loadHouseholdsFromLocalFallback(currentProjectId);
        if (fallback.length > 0) {
          logger.warn(
            `[TerrainData] Fallback local activé pour ${currentProjectId} (${fallback.length} ménages)`,
            err?.message || err
          );
          householdsCache.set(currentProjectId, { data: fallback, timestamp: Date.now() });
          return fallback;
        }

        if (err?.response?.status === 401) {
          throw new Error('Session expirée. Réconnectez-vous pour charger les ménages.');
        }

        throw err;
      }
    })();

    householdsInflight.set(currentProjectId, request);

    try {
      const normalized = await request;
      setHouseholdsRaw(normalized);
      return normalized;
    } catch (err: any) {
      setError(
        err?.response?.status === 401
          ? 'Session expirée. Réconnectez-vous pour charger les ménages.'
          : err.message || 'Failed to load households'
      );
      return [];
    } finally {
      householdsInflight.delete(currentProjectId);
      setIsLoading(false);
    }
  }, [currentProjectId, enabled]);

  // 🔄 Fetch directly from API on mount or project change
  useEffect(() => {
    if (!enabled) return;
    void reloadHouseholds();
  }, [enabled, reloadHouseholds]);

  const fetchKoboStats = async () => {
    try {
      const response = await apiClient.get(`households/stats?projectId=${currentProjectId}`);
      return response.data;
    } catch (err: any) {
      logger.error('Failed to fetch kobo stats:', err);
      return null;
    }
  };

  // Derived filtered households
  const households = useMemo(() => {
    return householdsRaw.filter((h) => {
      const matchesSearch =
        searchTerm === '' ||
        h.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (h.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || h.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [householdsRaw, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    if (!households) return null;
    const total = households.length;
    let enAttente = 0,
      enCours = 0,
      termine = 0,
      bloque = 0;
    households.forEach((h) => {
      if (h.status === 'En attente') enAttente++;
      else if (['En cours', 'Travaux'].includes(h.status)) enCours++;
      else if (h.status === 'Terminé') termine++;
      else if (h.status === 'Inéligible') bloque++;
    });
    return { total, enAttente, enCours, termine, bloque };
  }, [households]);

  // Direct Server Mutations
  const updateHouseholdStatus = useCallback(async (id: string, newStatus: string) => {
    try {
      const response = await apiClient.patch(`households/${id}`, { status: newStatus });
      const serverHousehold = normalizeHousehold(response.data as Household);
      // Optimistic state update
      setHouseholdsRaw((prev) => {
        const next = prev.map((h) => (h.id === id ? serverHousehold : h));
        updateProjectCache(currentProjectId, () => next);
        return next;
      });

      await db.households.put({ ...serverHousehold, syncStatus: 'synced' });
    } catch (error: any) {
      logger.error('Failed to update status on server:', error);
      throw error;
    }
  }, [currentProjectId]);

  const updateHouseholdLocation = useCallback(async (id: string, lat: number, lng: number) => {
    try {
      const loc = { type: 'Point', coordinates: [lng, lat] };
      const response = await apiClient.patch(`households/${id}`, {
        location: loc,
        latitude: lat,
        longitude: lng,
      });
      const serverHousehold = normalizeHousehold(response.data as Household);
      setHouseholdsRaw((prev) => {
        const next = prev.map((h) => (h.id === id ? serverHousehold : h));
        updateProjectCache(currentProjectId, () => next);
        return next;
      });

      await db.households.put({ ...serverHousehold, syncStatus: 'synced' });
    } catch (err) {
      logger.error('Failed to update location on server:', err);
      throw err;
    }
  }, [currentProjectId]);

  const updateHousehold = useCallback(async (id: string, patch: Partial<Household>) => {
    try {
      const response = await apiClient.patch(`households/${id}`, patch);
      const updated = normalizeHousehold(response.data as Household);
      setHouseholdsRaw((prev) => {
        const next = prev.map((h) => (h.id === id ? updated : h));
        updateProjectCache(currentProjectId, () => next);
        return next;
      });

      await db.households.put({ ...updated, syncStatus: 'synced' });
    } catch (err) {
      logger.error('Failed to update household on server:', err);
      throw err;
    }
  }, [currentProjectId]);

  const uploadHouseholdPhoto = useCallback(
    async (id: string, file: File) => {
      // Compress before upload — saves ~80% bandwidth on mobile networks
      const compressedFile = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      const resp = await apiClient.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url, key } = resp.data;

      const patch: Partial<Household> = { koboData: { photo_installation: key, photoUrl: url } };
      await updateHousehold(id, patch);
      return url;
    },
    [updateHousehold]
  );

  return {
    households,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    stats,
    updateHouseholdStatus,
    updateHouseholdLocation,
    updateHousehold,
    uploadHouseholdPhoto,
    reloadHouseholds,
    importHouseholds: async (data: Household[]) => {
      if (!currentProjectId) throw new Error('Aucun projet actif pour importer les ménages.');
      const savedHouseholds: Household[] = [];

      for (const item of data) {
        const payload = mapToApiPayload({ ...item, projectId: item.projectId || currentProjectId });
        const response = await apiClient.post('households', payload);
        savedHouseholds.push(normalizeHousehold(response.data as Household));
      }

      await persistHouseholdsLocally(currentProjectId, savedHouseholds);
      setHouseholdsRaw((prev) => {
        const next = [...prev];
        savedHouseholds.forEach((newItem) => {
          const idx = next.findIndex((h) => h.id === newItem.id);
          if (idx > -1) next[idx] = newItem;
          else next.push(newItem);
        });
        updateProjectCache(currentProjectId, () => next);
        return next;
      });
    },
    repairSyncQueue: async () => {
      const legacyItems = await db.syncOutbox.toArray();
      if (legacyItems.length > 0) {
        await db.syncOutbox.clear();
      }
      logger.debug(`[TerrainData] Legacy local sync queue cleared: ${legacyItems.length}`);
      return legacyItems.length;
    },
    clearHouseholds: async () => {
      setHouseholdsRaw([]);
      if (currentProjectId) {
        householdsCache.delete(currentProjectId);
        const currentProjectHouseholds = await db.households
          .where('projectId')
          .equals(currentProjectId)
          .toArray();
        if (currentProjectHouseholds.length > 0) {
          await db.households.bulkDelete(currentProjectHouseholds.map((household) => household.id));
        }
      }
    },
  };
}
