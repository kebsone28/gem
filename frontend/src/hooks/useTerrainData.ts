import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Household } from '../utils/types';
import { useProject } from './useProject';

export function useTerrainData() {
    const { activeProjectId } = useProject();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const households = useLiveQuery(async () => {
        if (!activeProjectId) return [];

        let collection = db.households.where('projectId').equals(activeProjectId);
        const all = await collection.toArray();

        return all.filter(h => {
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
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5005';
            const token = localStorage.getItem('token');
            await fetch(`${apiUrl}/api/households/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    location: { type: 'Point', coordinates: [lng, lat] }
                })
            });
        } catch (e) {
            console.error('Failed to sync location to backend', e);
        }
    }, []);

    const importHouseholds = useCallback(async (data: Household[]) => {
        await db.households.bulkPut(data);
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
        clearHouseholds,
        simulateKoboSync,
        getHouseholdLogs
    };
}
