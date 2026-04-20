/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { db } from '../store/db';
import type { Household } from '../utils/types';
import { useProject } from '../contexts/ProjectContext';
import apiClient from '../api/client';
import logger from '../utils/logger';

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

const getNormalizedCoords = (h: Record<string, unknown>): [number, number] | null => {
  try {
    let lat: number | null = null;
    let lng: number | null = null;
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

export function useTerrainData() {
  const { activeProjectId, project } = useProject();
  const currentProjectId = project?.id || activeProjectId;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ✅ SERVER-FIRST: React State instead of useLiveQuery (Dexie)
  const [householdsRaw, setHouseholdsRaw] = useState<Household[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔄 Fetch directly from API on mount or project change
  useEffect(() => {
    if (!currentProjectId) {
      setHouseholdsRaw([]);
      setIsLoading(false);
      return;
    }

    const fetchHouseholds = async () => {
      setIsLoading(true);
      setError(null);
      try {
        logger.log(`📡 [Server-First] Fetching households for Project: ${currentProjectId}`);
        // API ensures consistency (handles merges, deletions, etc. on server side)
        const response = await apiClient.get('/households', {
          params: { projectId: currentProjectId, limit: 10000 },
        });

        const data = response.data.households || [];
        const normalized = data.map((h: Household) => normalizeHousehold(h));

        logger.log(
          `✅ [Server-First] Retrieved ${normalized.length} unique households from backend`
        );
        setHouseholdsRaw(normalized);

        // 🧹 ONE-TIME CLEANUP: Purge local Dexie households to avoid stale ghosts
        const localCount = await db.households.count();
        if (localCount > 0) {
          logger.warn(
            `🧹 [Server-First] Purging ${localCount} stale households from local Dexie database...`
          );
          await db.households.clear();
        }
      } catch (err: unknown) {
        logger.error('❌ Failed to fetch server-direct households:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHouseholds();
  }, [currentProjectId]);

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
      await apiClient.patch(`households/${id}`, { status: newStatus });
      // Optimistic state update
      setHouseholdsRaw((prev) => prev.map((h) => (h.id === id ? { ...h, status: newStatus } : h)));
    } catch (err) {
      logger.error('Failed to update status on server:', err);
      throw err;
    }
  }, []);

  const updateHouseholdLocation = useCallback(async (id: string, lat: number, lng: number) => {
    try {
      const loc = { type: 'Point', coordinates: [lng, lat] };
      await apiClient.patch(`households/${id}`, { location: loc, latitude: lat, longitude: lng });
      setHouseholdsRaw((prev) =>
        prev.map((h) =>
          h.id === id
            ? { ...h, location: loc as Record<string, unknown>, latitude: lat, longitude: lng }
            : h
        )
      );
    } catch (err) {
      logger.error('Failed to update location on server:', err);
      throw err;
    }
  }, []);

  const updateHousehold = useCallback(async (id: string, patch: Partial<Household>) => {
    try {
      const response = await apiClient.patch(`households/${id}`, patch);
      const updated = normalizeHousehold(response.data);
      setHouseholdsRaw((prev) => prev.map((h) => (h.id === id ? updated : h)));
    } catch (err) {
      logger.error('Failed to update household on server:', err);
      throw err;
    }
  }, []);

  const uploadHouseholdPhoto = useCallback(
    async (id: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await apiClient.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url, key } = resp.data;

      const patch = { koboData: { photo_installation: key, photoUrl: url } };
      await updateHousehold(id, patch as Record<string, unknown>);
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
    // Methods removed as they are Dexie-specific and no longer needed for Server-First
    importHouseholds: async (data: Household[]) => {
      await db.households.bulkPut(data);
      setHouseholdsRaw((prev) => {
        const next = [...prev];
        data.forEach((newItem) => {
          const idx = next.findIndex((h) => h.id === newItem.id);
          if (idx > -1) next[idx] = newItem;
          else next.push(newItem);
        });
        return next;
      });
    },
    repairSyncQueue: async () => 0,
    clearHouseholds: async () => {
      // Optional: could trigger a re-fetch
      setHouseholdsRaw([]);
    },
  };
}
