import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Household } from '../utils/types';

export function useTerrainData() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const households = useLiveQuery(async () => {
        let collection = db.households.toCollection();
        const all = await collection.toArray();

        return all.filter(h => {
            const matchesSearch = searchTerm === '' ||
                h.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (h as any).name?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'all' || h.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [searchTerm, statusFilter]);

    const stats = useMemo(() => {
        if (!households) return null;
        return {
            total: households.length,
            enAttente: households.filter(h => h.status === 'En attente' || h.status === 'Attente démarrage').length,
            enCours: households.filter(h => ['En cours', 'Travaux', 'Attente Maçon', 'Attente Branchement', 'Attente électricien'].includes(h.status)).length,
            termine: households.filter(h => h.status === 'Terminé' || h.status === 'Conforme').length,
            bloque: households.filter(h => h.status === 'Inéligible' || h.status === 'Injoignable').length
        };
    }, [households]);

    const updateHouseholdStatus = async (id: string, newStatus: string) => {
        await db.households.update(id, { status: newStatus });
    };

    const importHouseholds = async (data: Household[]) => {
        await db.households.bulkPut(data);
    };

    const clearHouseholds = async () => {
        await db.households.clear();
    };

    const simulateKoboSync = async () => {
        const all = await db.households.toArray();
        const updates = all.map(h => {
            // Simulate random Kobo progress
            const rand = Math.random();
            const isStarted = rand > 0.3; // 70% started
            let koboSync: any = {};
            let newStatus = h.status || 'Non débuté';

            if (isStarted) {
                const phases = ['Murs', 'Réseau', 'Intérieur', 'Terminé'];
                const phaseIndex = Math.floor(Math.random() * phases.length);
                const currentPhase = phases[phaseIndex];

                koboSync = {
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

            return { ...h, status: newStatus, koboSync };
        });

        await db.households.bulkPut(updates);
    };

    return {
        households,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        stats,
        updateHouseholdStatus,
        importHouseholds,
        clearHouseholds,
        simulateKoboSync
    };
}
