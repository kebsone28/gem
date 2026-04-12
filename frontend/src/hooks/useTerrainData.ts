import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Household } from '../utils/types';
import { useProject } from '../contexts/ProjectContext';
import apiClient from '../api/client';

export function mapToApiPayload(household: Partial<Household>, overrides: any = {}) {
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
      const [cLng, cLat] = h.location.coordinates.map((val: any) =>
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

  const households = useLiveQuery(async () => {
    if (!currentProjectId) return [];
    let all = await db.households.where('projectId').equals(currentProjectId).toArray();
    if (all.length === 0) {
      const zones = await db.zones.where('projectId').equals(currentProjectId).toArray();
      const zoneIds = zones.map((z: any) => z.id);
      if (zoneIds.length > 0) {
        all = await db.households.where('zoneId').anyOf(zoneIds).toArray();
      }
    }
    return all
      .map((h) => normalizeHousehold(h as Household))
      .filter((h) => {
        const matchesSearch =
          searchTerm === '' ||
          h.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (h as any).owner?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || h.status === statusFilter;
        return matchesSearch && matchesStatus;
      });
  }, [activeProjectId, searchTerm, statusFilter]);

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

  const updateHouseholdStatus = useCallback(async (id: string, newStatus: string) => {
    await db.households.update(id, { status: newStatus });
    const h = await db.households.get(id);
    if (h?.backendId) await apiClient.patch(`households/${h.backendId}`, { status: newStatus });
  }, []);

  const updateHouseholdLocation = useCallback(async (id: string, lat: number, lng: number) => {
    const loc = { type: 'Point', coordinates: [lng, lat] } as any;
    await db.households.update(id, { location: loc });
    const h = await db.households.get(id);
    if (h?.backendId) await apiClient.patch(`households/${h.backendId}`, { location: loc });
  }, []);

  const uploadHouseholdPhoto = useCallback(async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await apiClient.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const { url, key } = resp.data;
    const h = await db.households.get(id);
    if (h) {
      const koboData = { ...(h.koboData || {}), photo_installation: key, photoUrl: url };
      await db.households.update(id, { koboData });
      if (h.backendId) await apiClient.patch(`households/${h.backendId}`, { koboData });
    }
    return url;
  }, []);

  return {
    households,
    isLoading: households === undefined,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    stats,
    updateHouseholdStatus,
    updateHouseholdLocation,
    uploadHouseholdPhoto,
    importHouseholds: async (data: Household[]) => {
      await db.households.bulkPut(data);
    },
    repairSyncQueue: async () => 0,
    clearHouseholds: async () => {
      await db.households.clear();
    },
  };
}
