import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Household } from '../utils/types';
import { useProject } from './useProject';
import logger from '../utils/logger';
import apiClient from '../api/client';

export function mapToApiPayload(household: Partial<Household>, overrides: any = {}) {
    return {
        // ⚠️ projectId does NOT exist on Household model in Prisma.
        // It links via zoneId → Zone → projectId.
        zoneId: household.zoneId,
        status: household.status || 'planned',
        owner: household.owner || {},
        location: household.location,
        koboData: household.koboData || {},
        koboSync: household.koboSync || {},
        assignedTeams: household.assignedTeams?.length ? household.assignedTeams : [],
        // Scalar fields
        name: household.name,
        phone: household.phone,
        region: household.region,
        departement: household.departement,
        village: household.village,
        ...overrides
    };
}

// 🔧 Fonction pour normaliser les coordonnées GPS (convertir virgules en points)
const normalizeCoordinates = (household: any): Household => {
    if (!household) return household;
    
    try {
        // Case 1: location.coordinates exists — normalize comma-separated strings
        if (household.location?.coordinates) {
            const coordinates = household.location.coordinates;
            if (Array.isArray(coordinates) && coordinates.length === 2) {
                const [lon, lat] = coordinates;
                
                let normalizedLon: number;
                let normalizedLat: number;
                
                if (typeof lon === 'string') {
                    normalizedLon = parseFloat((lon as string).replace(',', '.'));
                } else if (typeof lon === 'number') {
                    normalizedLon = lon;
                } else {
                    return household;
                }

                if (typeof lat === 'string') {
                    normalizedLat = parseFloat((lat as string).replace(',', '.'));
                } else if (typeof lat === 'number') {
                    normalizedLat = lat;
                } else {
                    return household;
                }

                if (isNaN(normalizedLon) || isNaN(normalizedLat)) return household;
                if (Math.abs(normalizedLon) > 180 || Math.abs(normalizedLat) > 90) {
                    logger.warn(`⚠️ Coordonnées hors limites pour ${household.id}: [${normalizedLon}, ${normalizedLat}]`);
                    return household;
                }

                return {
                    ...household,
                    location: {
                        ...household.location,
                        coordinates: [normalizedLon, normalizedLat] as [number, number]
                    }
                } as Household;
            }
        }

        // Case 2: No location.coordinates — try scalar latitude/longitude fields
        const rawLon = household.longitude ?? household.koboData?.longitude ?? household.koboSync?.longitude;
        const rawLat = household.latitude ?? household.koboData?.latitude ?? household.koboSync?.latitude;

        if (rawLon != null && rawLat != null) {
            const lon = typeof rawLon === 'string' ? parseFloat(rawLon.replace(',', '.')) : Number(rawLon);
            const lat = typeof rawLat === 'string' ? parseFloat(rawLat.replace(',', '.')) : Number(rawLat);

            if (!isNaN(lon) && !isNaN(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
                return {
                    ...household,
                    location: {
                        type: 'Point',
                        coordinates: [lon, lat] as [number, number]
                    }
                } as Household;
            }
        }

        return household;
    } catch (e) {
        logger.warn(`❌ Erreur normalisation coords for ${household?.id}:`, e);
        return household;
    }
};


export function useTerrainData() {
    const { activeProjectId } = useProject();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const households = useLiveQuery(async () => {
        if (!activeProjectId) return [];

        let all = await db.households.where('projectId').equals(activeProjectId).toArray();

        // Fallback
        if (all.length === 0) {
            const zones = await db.zones.where('projectId').equals(activeProjectId).toArray();
            const zoneIds = zones.map((z: any) => z.id);
            if (zoneIds.length > 0) {
                const byZone = await db.households.where('zoneId').anyOf(zoneIds).toArray();
                for (const h of byZone) {
                    if (!h.projectId) {
                        db.households.update(h.id, { projectId: activeProjectId }).catch(() => {});
                    }
                }
                all = byZone;
            }
        }

        const normalized = all.map(h => normalizeCoordinates(h as Household));

        return normalized.filter(h => {
            const matchesSearch = searchTerm === '' ||
                h.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (h as any).owner?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'all' || h.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [activeProjectId, searchTerm, statusFilter]);


    const stats = useMemo(() => {
        if (!households) return null;

        const total = households.length;
        let enAttente = 0;
        let enCours = 0;
        let termine = 0;
        let bloque = 0;
        const teamCounts = { livraison: 0, maconnerie: 0, reseau: 0, installation: 0, controle: 0 };

        households.forEach(h => {
            if (h.status === 'En attente' || h.status === 'Attente démarrage') enAttente++;
            else if (['En cours', 'Travaux', 'Attente Maçon', 'Attente Branchement', 'Attente électricien'].includes(h.status)) enCours++;
            else if (h.status === 'Terminé' || h.status === 'Conforme') termine++;
            else if (h.status === 'Inéligible' || h.status === 'Injoignable') bloque++;

            if (h.koboSync?.livreurDate) teamCounts.livraison++;
            if (h.koboSync?.maconOk) teamCounts.maconnerie++;
            if (h.koboSync?.reseauOk) teamCounts.reseau++;
            if (h.koboSync?.interieurOk) teamCounts.installation++;
            if (h.koboSync?.controleOk) teamCounts.controle++;
        });

        return {
            total,
            enAttente,
            enCours,
            termine,
            bloque,
            teamProgress: {
                livraison: total > 0 ? Math.round((teamCounts.livraison / total) * 100) : 0,
                maconnerie: total > 0 ? Math.round((teamCounts.maconnerie / total) * 100) : 0,
                reseau: total > 0 ? Math.round((teamCounts.reseau / total) * 100) : 0,
                installation: total > 0 ? Math.round((teamCounts.installation / total) * 100) : 0,
                controle: total > 0 ? Math.round((teamCounts.controle / total) * 100) : 0
            }
        };
    }, [households]);

    const pushToOutbox = async (endpoint: string, method: 'POST' | 'PATCH', payload: any) => {
        await db.syncOutbox.add({
            action: `Sync ${method} on ${endpoint}`,
            endpoint,
            method,
            payload,
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0
        });
    };

    const uploadHouseholdPhoto = useCallback(async (id: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const resp = await apiClient.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const { url, key } = resp.data;
            const household = await db.households.get(id);
            if (household) {
                const koboData = { ...(household.koboData || {}), photo_installation: key, photoUrl: url };
                await db.households.update(id, { koboData });
                const apiId = household.backendId || household.id;
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(apiId);
                try {
                    if (isUuid) {
                        await apiClient.patch(`households/${apiId}`, { koboData });
                        await db.households.update(id, { syncStatus: 'synced' });
                    } else {
                        await db.households.update(id, { syncStatus: 'pending' });
                        // Push full payload since it might not exist yet on server
                        const payload = mapToApiPayload(await db.households.get(id) || household);
                        await pushToOutbox(`households/${id}`, 'POST', payload);
                        logger.warn(`⏳ Household offline, photo link queued for creation: ${id}`);
                    }
                } catch (e) {
                    await db.households.update(id, { syncStatus: 'pending' });
                    await pushToOutbox(`households/${apiId}`, 'PATCH', { koboData });
                    logger.warn(`⏳ Failed to sync photo link for ${id}, added to offline queue`);
                }
                logger.log(`✅ Photo uploaded and linked to household ${id}`);
            }
            return url;
        } catch (e) {
            logger.error(`❌ Failed to upload photo for ${id}`, e);
            throw e;
        }
    }, []);

    const updateHouseholdStatus = useCallback(async (id: string, newStatus: string) => {
        const household = await db.households.get(id);
        if (!household) return;
        const oldStatus = household.status;
        await db.households.update(id, { status: newStatus });

        const apiId = household.backendId || household.id;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(apiId);

        try {
            if (isUuid) {
                await apiClient.patch(`households/${apiId}`, { status: newStatus });
            } else {
                await db.households.update(id, { syncStatus: 'pending' });
                // Envoi complet pour création différée (POST)
                const payload = mapToApiPayload(await db.households.get(id) || household);
                await pushToOutbox(`households/${id}`, 'POST', payload);
                logger.warn(`⏳ Household offline, status sync mis en attente: ${id}`);
            }
        } catch (e: any) {
            await db.households.update(id, { syncStatus: 'pending' });
            // Queue le PATCH pour plus tard
            await pushToOutbox(`households/${apiId}`, 'PATCH', { id: apiId, status: newStatus });
            logger.warn(`⏳ Failed to sync status for ${id}, added to offline queue`);
        }
        if (newStatus === 'Terminé' && oldStatus !== 'Terminé' && activeProjectId) {
            const kitItems = await (db as any).inventory.where('projectId').equals(activeProjectId).toArray();
            for (const item of kitItems) {
                if (item.stock > 0) {
                    await (db as any).inventory.update(item.id, { stock: item.stock - 1 });
                    await (db as any).expenses.add({
                        id: `exp_${Date.now()}_${item.id}`,
                        projectId: activeProjectId,
                        category: 'Materiel',
                        name: `Installation Kit - ${item.name}`,
                        amount: item.unitPrice || 0,
                        date: new Date().toISOString(),
                        householdId: id
                    });
                }
            }
        }
    }, [activeProjectId]);

    const updateHouseholdLocation = useCallback(async (id: string, lat: number, lng: number) => {
        const household = await db.households.get(id);
        if (!household) return;
        
        const newLocation = { ...household.location, type: 'Point', coordinates: [lng, lat] };

        // 1. Optimistic update in Dexie
        await db.households.update(id, { location: newLocation });

        // 2. Sync to Backend
        // ⚠️ For households imported from server, id IS already the backend UUID.
        // backendId is only set explicitly after a local POST creates the household.
        const apiId = household.backendId || household.id;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(apiId);

        try {
            if (isUuid) {
                // ✅ Household exists on server — PATCH
                await apiClient.patch(`households/${apiId}`, { location: newLocation });
                logger.log(`✅ Location synced for ${apiId}`);
            } else {
                // 🆕 Truly offline/local ID — try POST to create
                logger.warn(`⚠️ Household ${id} is offline-only → fallback POST`);
                const payload = mapToApiPayload(household, { location: newLocation });
                try {
                    const res = await apiClient.post('households', payload);
                    if (res.data?.id) {
                        logger.log(`✅ Household synced with backend ID: ${res.data.id}`);
                        await db.households.update(id, { 
                            backendId: res.data.id,
                            syncStatus: 'synced'
                        });
                    }
                } catch (postError) {
                    await db.households.update(id, { syncStatus: 'pending' });
                    await pushToOutbox(`households/${id}`, 'POST', payload);
                    logger.warn(`⏳ Creation failed, added generic POST to offline queue for ${id}`);
                }
            }
        } catch (e: any) {
            await db.households.update(id, { syncStatus: 'pending' });
            await pushToOutbox(`households/${apiId}`, 'PATCH', { id: apiId, location: newLocation });
            logger.warn('⏳ Failed to sync location to backend, added to offline queue');
        }
    }, []);

    const importHouseholds = useCallback(async (data: Household[]) => {
        const existingHouseholds = await db.households.toArray();
        const existingMap = new Map(existingHouseholds.map(h => [h.id, h]));
        const mergedData = data.map(newItem => {
            const existingItem = existingMap.get(newItem.id);
            if (existingItem) return { ...existingItem, ...newItem };
            return newItem;
        });
        await db.households.bulkPut(mergedData);
    }, []);

    const detectDuplicates = useCallback(async (data: Household[]) => {
        const existingHouseholds = await db.households.toArray();
        const existingMap = new Map(existingHouseholds.map(h => [h.id, h]));
        const stats = { totalNew: data.length, newItems: 0, duplicates: 0, updates: 0, duplicateIds: [] as string[] };
        data.forEach(newItem => {
            if (existingMap.has(newItem.id)) {
                stats.duplicates++;
                stats.duplicateIds.push(newItem.id);
                const existing = existingMap.get(newItem.id)!;
                if (JSON.stringify(existing) !== JSON.stringify(newItem)) stats.updates++;
            } else {
                stats.newItems++;
            }
        });
        return stats;
    }, []);

    const clearHouseholds = useCallback(async () => {
        await db.households.clear();
    }, []);

    const simulateKoboSync = useCallback(async () => {
        const all = await db.households.toArray();
        const updates = all.map(h => {
            const rand = Math.random();
            const isStarted = rand > 0.3;
            let koboData: any = {};
            let newStatus = h.status || 'Non débuté';
            if (isStarted) {
                const phases = ['Murs', 'Réseau', 'Intérieur', 'Terminé'];
                const phaseIndex = Math.floor(Math.random() * phases.length);
                koboData = {
                    preparateurKits: 1, livreurDate: new Date().toISOString(),
                    maconOk: phaseIndex >= 0, reseauOk: phaseIndex >= 1, interieurOk: phaseIndex >= 2, controleOk: phaseIndex >= 3
                };
                newStatus = phases[phaseIndex];
            }
            return { ...h, status: newStatus, koboData };
        });
        await db.households.bulkPut(updates);
    }, []);

    const getHouseholdLogs = async (id: string) => {
        return await db.sync_logs
            .filter(log => log.action.includes(id) || (log.details && JSON.stringify(log.details).includes(id)))
            .toArray();
    };

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
        importHouseholds,
        detectDuplicates,
        clearHouseholds,
        simulateKoboSync,
        getHouseholdLogs
    };
}
