import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Household } from '../utils/types';
import { useProject } from './useProject';
import logger from '../utils/logger';
import apiClient from '../api/client';

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
        // This covers households imported from Excel/Kobo with individual lat/lng columns
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
        // Si une erreur survient, retourner l'original sans modifier
        logger.warn(`❌ Erreur normalisation coords pour ${household?.id}:`, e);
        return household;
    }
};


export function useTerrainData() {
    const { activeProjectId } = useProject();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const households = useLiveQuery(async () => {
        if (!activeProjectId) return [];

        // Primary query: households with direct projectId (fast indexed lookup)
        let all = await db.households.where('projectId').equals(activeProjectId).toArray();

        // Fallback: if no results, look up by zoneId for households imported without projectId
        if (all.length === 0) {
            const zones = await db.zones.where('projectId').equals(activeProjectId).toArray();
            const zoneIds = zones.map((z: any) => z.id);
            if (zoneIds.length > 0) {
                const byZone = await db.households.where('zoneId').anyOf(zoneIds).toArray();
                // Backfill projectId in Dexie for future queries (silent background update)
                for (const h of byZone) {
                    if (!h.projectId) {
                        db.households.update(h.id, { projectId: activeProjectId }).catch(() => {});
                    }
                }
                all = byZone;
            }
        }

        // 🔧 Normaliser les coordonnées de tous les ménages
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
            // Status counts
            if (h.status === 'En attente' || h.status === 'Attente démarrage') enAttente++;
            else if (['En cours', 'Travaux', 'Attente Maçon', 'Attente Branchement', 'Attente électricien'].includes(h.status)) enCours++;
            else if (h.status === 'Terminé' || h.status === 'Conforme') termine++;
            else if (h.status === 'Inéligible' || h.status === 'Injoignable') bloque++;

            // Team counts
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

    const updateHouseholdStatus = useCallback(async (id: string, newStatus: string) => {
        const household = await db.households.get(id);
        if (!household) return;

        const oldStatus = household.status;
        await db.households.update(id, { status: newStatus });

        // 🔄 Sync to backend so MVT layer reflects the change after refresh
        try {
            await apiClient.patch(`households/${id}`, { status: newStatus });
            logger.log(`✅ Status synced to backend for ${id}: ${newStatus}`);
        } catch (e) {
            logger.error(`❌ Failed to sync status to backend for ${id}`, e);
            // The offline interceptor will catch this if it's a network error
        }

        // Logic: Deduction from stock if finished
        if (newStatus === 'Terminé' && oldStatus !== 'Terminé' && activeProjectId) {
            // Find kit items
            const kitItems = await (db as any).inventory
                .where('projectId').equals(activeProjectId)
                .toArray();

            for (const item of kitItems) {
                // Deduct 1 unit for key items
                if (item.stock > 0) {
                    await (db as any).inventory.update(item.id, {
                        stock: item.stock - 1
                    });

                    // Log an expense
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

        // Update local Dexie DB so the frontend recalculates instantly
        await db.households.update(id, {
            location: {
                ...household.location,
                type: 'Point',
                coordinates: [lng, lat]
            }
        });

        // Trigger an API call to update the backend PostGIS layer
        try {
            await apiClient.patch(`households/${id}`, {
                location: { type: 'Point', coordinates: [lng, lat] }
            });
        } catch (e) {
            logger.error('Failed to sync location to backend', e);
        }
    }, []);

    const importHouseholds = useCallback(async (data: Household[]) => {
        // Fetch existing households to merge data safely (preserve location, etc.)
        const existingHouseholds = await db.households.toArray();
        const existingMap = new Map(existingHouseholds.map(h => [h.id, h]));

        const mergedData = data.map(newItem => {
            const existingItem = existingMap.get(newItem.id);
            if (existingItem) {
                return { ...existingItem, ...newItem };
            }
            return newItem;
        });

        await db.households.bulkPut(mergedData);
    }, []);

    // 🔍 Détecte les doublons AVANT import avec rapport détaillé
    const detectDuplicates = useCallback(async (data: Household[]) => {
        const existingHouseholds = await db.households.toArray();
        const existingMap = new Map(existingHouseholds.map(h => [h.id, h]));

        const stats = {
            totalNew: data.length,
            newItems: 0,
            duplicates: 0,
            updates: 0,
            duplicateIds: [] as string[]
        };

        data.forEach(newItem => {
            if (existingMap.has(newItem.id)) {
                stats.duplicates++;
                stats.duplicateIds.push(newItem.id);
                // Check if there are actual changes
                const existing = existingMap.get(newItem.id)!;
                if (JSON.stringify(existing) !== JSON.stringify(newItem)) {
                    stats.updates++;
                }
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
            // Simulate random Kobo progress
            const rand = Math.random();
            const isStarted = rand > 0.3; // 70% started
            let koboData: any = {};
            let newStatus = h.status || 'Non débuté';

            if (isStarted) {
                const phases = ['Murs', 'Réseau', 'Intérieur', 'Terminé'];
                const phaseIndex = Math.floor(Math.random() * phases.length);
                const currentPhase = phases[phaseIndex];

                koboData = {
                    preparateurKits: 1,
                    livreurDate: new Date().toISOString(),
                    maconOk: phaseIndex >= 0,
                    reseauOk: phaseIndex >= 1,
                    interieurOk: phaseIndex >= 2,
                    controleOk: phaseIndex >= 3,
                    cableInt25: phaseIndex >= 2 ? Math.floor(Math.random() * 20) + 10 : 0,
                    tranchee4: phaseIndex >= 1 ? Math.floor(Math.random() * 50) + 20 : 0
                };
                newStatus = currentPhase;

                // Simulate some problems
                if (Math.random() > 0.9) newStatus = 'Problème';
            }

            return { ...h, status: newStatus, koboData };
        });

        await db.households.bulkPut(updates);
    }, []);

    const getHouseholdLogs = async (id: string) => {
        return await db.sync_logs
            .filter(log =>
                log.action.includes(id) ||
                (log.details && JSON.stringify(log.details).includes(id))
            )
            .toArray();
    };

    return {
        households,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        stats,
        updateHouseholdStatus,
        updateHouseholdLocation,
        importHouseholds,
        detectDuplicates,
        clearHouseholds,
        simulateKoboSync,
        getHouseholdLogs
    };
}
