import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Household } from '../utils/types';
import { useProject } from './useProject';
import logger from '../utils/logger';
import apiClient from '../api/client';

export function mapToApiPayload(household: Partial<Household>, overrides: any = {}) {
    // CRITICAL: Ensure ID is always present for sync
    const id = household.backendId || household.id || crypto.randomUUID();
    
    return {
        // Critical Sync Fields ID/Keys
        id,
        projectId: household.projectId, // Requis par pushSchema
        zoneId: household.zoneId,
        organizationId: household.organizationId,

        // Data Fields
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

// 🔧 VERSION PRO : Normalisation GPS multi-source ultra-robuste
const getNormalizedCoords = (h: any): [number, number] | null => {
    try {
        let lat: any = null;
        let lng: any = null;

        // 1. Format standard GeoJSON (déjà présent ou partiel)
        if (h.location?.coordinates && Array.isArray(h.location.coordinates) && h.location.coordinates.length === 2) {
            const [cLng, cLat] = h.location.coordinates.map((val: any) => 
                typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val)
            );
            if (!isNaN(cLng) && !isNaN(cLat) && Math.abs(cLng) <= 180 && Math.abs(cLat) <= 90) {
                lng = cLng;
                lat = cLat;
            }
        }

        // 2. Kobo _geolocation (souvent un tableau [lat, lon]) fallback
        if (!lat || !lng) {
            const geo = h._geolocation || h.koboData?._geolocation;
            if (Array.isArray(geo) && geo.length >= 2) {
                lat = geo[0];
                lng = geo[1];
            }
        }

        // 3. Champs directs latitude/longitude (Kobo ou API fallback)
        if (!lat || !lng) {
            lat = h.latitude ?? h.koboData?.latitude ?? h.koboSync?.latitude;
            lng = h.longitude ?? h.koboData?.longitude ?? h.koboSync?.longitude;
        }

        // 4. Champs imbriqués TYPE_DE_VISITE
        if (!lat || !lng) {
            const tv = h.TYPE_DE_VISITE || h.koboData?.TYPE_DE_VISITE;
            if (tv) {
                lat = tv.latitude_key || tv.latitude;
                lng = tv.longitude_key || tv.longitude;
            }
        }

        // 5. KoboData raw fallbacks
        if (!lat || !lng && h.koboData) {
            lat = h.koboData['gps/latitude'] || h.koboData.Latitude;
            lng = h.koboData['gps/longitude'] || h.koboData.Longitude;
        }

        // Convert to strict numbers
        const numLat = typeof lat === 'string' ? parseFloat(lat.replace(',', '.')) : Number(lat);
        const numLng = typeof lng === 'string' ? parseFloat(lng.replace(',', '.')) : Number(lng);

        if (
            !isNaN(numLat) && !isNaN(numLng) && 
            numLat !== 0 && numLng !== 0 &&
            Math.abs(numLat) <= 90 && Math.abs(numLng) <= 180
        ) {
            return [numLng, numLat]; // MapLibre expects [lng, lat]
        }

        return null;
    } catch (err) {
        logger.warn('⚠️ Error normalizing coords for household:', h.id, err);
        return null;
    }
};

/**
 * ✅ Normalisation complète d'un ménage
 */
const normalizeHousehold = (h: Household): Household => {
    const coords = getNormalizedCoords(h);
    
    // Injection forcée du format GeoJSON standard pour la carte
    if (coords) {
        h.location = {
            type: 'Point',
            coordinates: coords
        };
        // Sync direct lat/lng fields for legacy components
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

        // Fallback
        if (all.length === 0) {
            const zones = await db.zones.where('projectId').equals(currentProjectId).toArray();
            const zoneIds = zones.map((z: any) => z.id);
            if (zoneIds.length > 0) {
                const byZone = await db.households.where('zoneId').anyOf(zoneIds).toArray();
                for (const h of byZone) {
                    if (!h.projectId) {
                        db.households.update(h.id, { projectId: currentProjectId }).catch(() => {});
                    }
                }
                all = byZone;
            }
        }

        const normalized = all.map(h => normalizeHousehold(h as Household));

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

        // 1. Bulk Put in Households table
        await db.households.bulkPut(mergedData);

        // 2. Queue for Sync (if they don't have a backendId yet)
        const toSync = mergedData.filter(h => {
            const existing = existingMap.get(h.id);
            // If it's a new household (no existing) or it was previously unsynced
            return !existing || !existing.backendId;
        });

        if (toSync.length > 0) {
            logger.log(`📥 [IMPORT] Queuing ${toSync.length} new/local households for sync...`);
            const outboxItems = toSync.map(h => ({
                action: `Sync POST on households/${h.id}`,
                endpoint: `households`,
                method: 'POST' as const,
                payload: mapToApiPayload(h),
                timestamp: Date.now(),
                status: 'pending' as const,
                retryCount: 0
            }));
            await db.syncOutbox.bulkAdd(outboxItems);
        }
    }, []);

    const repairSyncQueue = useCallback(async () => {
        const allHouseholds = await db.households.toArray();
        const outbox = await db.syncOutbox.toArray();
        
        // Find households that are NEITHER on server (backendId) NOR in outbox
        const outboxKeys = new Set(outbox.map(item => {
            if (item.endpoint.includes('households')) {
                const segments = item.endpoint.split('/');
                return segments[segments.length - 1] || item.payload.id;
            }
            return null;
        }).filter(Boolean));

        const orphans = allHouseholds.filter(h => !h.backendId && !outboxKeys.has(h.id));

        if (orphans.length > 0) {
            logger.log(`🔧 [REPAIR] Found ${orphans.length} orphan households. Adding to sync queue...`);
            const outboxItems = orphans.map(h => ({
                action: `Repair: Sync POST on households/${h.id}`,
                endpoint: `households`,
                method: 'POST' as const,
                payload: mapToApiPayload(h),
                timestamp: Date.now(),
                status: 'pending' as const,
                retryCount: 0
            }));
            await db.syncOutbox.bulkAdd(outboxItems);
            return orphans.length;
        }
        return 0;
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
        
        if (all.length === 0) {
            // S'il n'y a rien localement, simulons un import depuis Kobo (5 ménages)
            const mockData = Array.from({ length: 5 }).map((_, i) => ({
                id: `kobo_sim_${Date.now()}_${i}`,
                projectId: currentProjectId || 'default_project',
                zoneId: 'zone_sim',
                organizationId: 'org_sim',
                owner: `Client Kobo ${i + 1}`,
                location: {
                    type: 'Point' as const,
                    coordinates: [-17.44 + (Math.random() * 0.1), 14.71 + (Math.random() * 0.1)] as [number, number]
                },
                status: ['Murs', 'Réseau', 'Intérieur', 'Terminé'][Math.floor(Math.random() * 4)],
                version: 1,
                lastModified: Date.now(),
                source: 'kobo' as const
            }));
            await db.households.bulkPut(mockData as any[]);
            return;
        }

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
            return { ...h, status: newStatus, koboData, lastModified: Date.now(), source: 'kobo' as const };
        });
        await db.households.bulkPut(updates);
    }, [currentProjectId]);

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
        repairSyncQueue,
        detectDuplicates,
        clearHouseholds,
        simulateKoboSync,
        getHouseholdLogs
    };
}
