import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Team, Project, Household } from '../utils/types';

export interface DevisItem {
    id: string;
    label: string;
    region: string;
    qty: number;
    unit: number;
}

export const DEVIS_ITEMS: DevisItem[] = [
    { id: 'formation', label: 'Formation 5 équipes (19 électriciens)', region: 'Global', qty: 5, unit: 1500000 },
    { id: 'transport', label: 'Transport matériel', region: 'Global', qty: 3750, unit: 3667 },
    { id: 'controle', label: 'Contrôle conformité / reporting', region: 'Global', qty: 3750, unit: 4000 },
    { id: 'kaffrine-coffret', label: 'Coffret + potelet + raccordement réseau', region: 'Kaffrine', qty: 2350, unit: 6230 },
    { id: 'kaffrine-mur', label: 'Mur support coffret (cheminée)', region: 'Kaffrine', qty: 2000, unit: 35000 },
    { id: 'kaffrine-tranchee', label: 'Tranchées + grillage (30x50, 15m)', region: 'Kaffrine', qty: 10000, unit: 1000 },
    { id: 'kaffrine-coffret-int', label: 'Coffret modulaire + mise à la terre', region: 'Kaffrine', qty: 2350, unit: 23000 },
    { id: 'kaffrine-kit2', label: 'Kit secondaire', region: 'Kaffrine', qty: 1000, unit: 6230 },
    { id: 'tamba-coffret', label: 'Coffret + potelet + raccordement réseau', region: 'Tambacounda', qty: 1400, unit: 6230 },
    { id: 'tamba-mur', label: 'Mur support coffret (cheminée)', region: 'Tambacounda', qty: 1500, unit: 35000 },
    { id: 'tamba-tranchee', label: 'Tranchées + grillage (30x50, 15m)', region: 'Tambacounda', qty: 10000, unit: 1000 },
    { id: 'tamba-coffret-int', label: 'Coffret modulaire + mise à la terre', region: 'Tambacounda', qty: 1400, unit: 23000 },
    { id: 'tamba-kit2', label: 'Kit secondaire', region: 'Tambacounda', qty: 1000, unit: 6230 }
];

const DEVIS_PLAFOND = 300823750;

export function useFinances() {
    const projects = useLiveQuery(() => db.projects.toArray()) as Project[] | undefined;
    const project = projects?.[0];
    const teams = useLiveQuery(() => db.teams.toArray()) as Team[] | undefined;
    const households = useLiveQuery(() => db.households.toArray()) as Household[] | undefined;

    const householdsCount = households?.length || 80000;
    const duration = project?.duration || 180;
    const staffConfig = project?.config?.staffConfig || {};
    const legacyCosts = (project?.config as any)?.costs || {};
    const realCostsOverrides = project?.config?.financials?.realCosts || {};
    const plannedCostsOverrides = project?.config?.financials?.plannedCosts || {};

    // --- Core Calculations ---
    const getStaffCost = (roleId: string, count: number, dur: number) => {
        const config = staffConfig[roleId];
        if (!config) return (legacyCosts[roleId] || 100000) * dur * count;
        const { amount, mode } = config;
        if (mode === 'monthly') return Math.round((amount / 22) * dur) * count;
        if (mode === 'task') return (householdsCount * amount) / (count || 1);
        return amount * dur * count;
    };

    // 1. Teams (Tech)
    const techTeamsCount: Record<string, number> = {
        'Maçon': 0, 'Réseau': 0, 'Intérieur': 0
    };
    teams?.forEach(t => {
        if (t.type === 'macons') techTeamsCount['Maçon']++;
        if (t.type === 'reseau') techTeamsCount['Réseau']++;
        if (t.type === 'interieur_type1') techTeamsCount['Intérieur']++;
    });

    const teamsCost = Object.entries(techTeamsCount).reduce((sum, [type, count]) => {
        const mapToKey: any = { 'Maçon': 'perMasonTeam', 'Réseau': 'perNetworkTeam', 'Intérieur': 'perInteriorTeam' };
        const costKey = mapToKey[type] || `per${type}Team`;
        return sum + getStaffCost(costKey, count, duration);
    }, 0);

    // 2. Logistics
    const vehicleRental = project?.config?.costs?.vehicleRental || { delivery_rent_per_day: 50000, pm_rent_per_day: 75000 };
    const logisticsCost = ((1 * (vehicleRental.delivery_rent_per_day || 50000)) + (1 * (vehicleRental.pm_rent_per_day || 75000))) * duration;

    // 3. Materials
    const matCosts = project?.config?.materialUnitCosts || { potelet: 15000, cable16mm: 5000, coffret: 30000, kitInterieur: 180000 };
    const materialsCost = householdsCount * (
        (matCosts.potelet || 15000) +
        (16 * (matCosts.cable16mm || 5000)) +
        (matCosts.coffret || 30000) +
        (matCosts.kitInterieur || 180000)
    );

    // 4. Supervision & Support
    const supervisionCost = getStaffCost('perSupervisor', Math.ceil((teams?.length || 0) / 10), duration) +
        getStaffCost('perProjectManager', 1, duration);

    const totalEstimated = teamsCost + logisticsCost + materialsCost + supervisionCost;

    // --- Devis vs Réel Logic ---
    const devisReport = DEVIS_ITEMS.map(item => {
        const pOverride = plannedCostsOverrides[item.id] || {};
        const pq = pOverride.qty !== undefined ? Number(pOverride.qty) : item.qty;
        const pu = pOverride.unit !== undefined ? Number(pOverride.unit) : item.unit;

        const override = realCostsOverrides[item.id] || {};
        const rq = override.qty !== undefined ? Number(override.qty) : pq;
        const ru = override.unit !== undefined ? Number(override.unit) : pu;

        const planned = pq * pu;
        const realTotal = rq * ru;
        const margin = planned - realTotal;
        return { ...item, qty: pq, unit: pu, rq, ru, planned, realTotal, margin };
    });

    const totalPlanned = devisReport.reduce((sum, item) => sum + item.planned, 0);
    const totalReal = devisReport.reduce((sum, item) => sum + item.realTotal, 0);
    const globalMargin = totalPlanned - totalReal;
    const marginPct = totalPlanned ? (globalMargin / totalPlanned) * 100 : 0;

    const updateRealCost = async (itemId: string, field: 'qty' | 'unit', value: number) => {
        if (!project) return;
        const newProject = { ...project };
        if (!newProject.config) newProject.config = {};
        if (!newProject.config.financials) newProject.config.financials = {};
        if (!newProject.config.financials.realCosts) newProject.config.financials.realCosts = {};
        if (!newProject.config.financials.realCosts[itemId]) newProject.config.financials.realCosts[itemId] = {};

        newProject.config.financials.realCosts[itemId][field] = value;
        // @ts-ignore
        await db.projects.update(project.id, { config: newProject.config });
    };

    const updatePlannedCost = async (itemId: string, field: 'qty' | 'unit', value: number) => {
        if (!project) return;
        const newProject = { ...project };
        if (!newProject.config) newProject.config = {};
        if (!newProject.config.financials) newProject.config.financials = {};
        if (!newProject.config.financials.plannedCosts) newProject.config.financials.plannedCosts = {};
        if (!newProject.config.financials.plannedCosts[itemId]) newProject.config.financials.plannedCosts[itemId] = {};

        newProject.config.financials.plannedCosts[itemId][field] = value;
        // @ts-ignore
        await db.projects.update(project.id, { config: newProject.config });
    };

    return {
        project,
        teams,
        householdsCount,
        duration,
        stats: {
            teams: teamsCost,
            logistics: logisticsCost,
            materials: materialsCost,
            supervision: supervisionCost,
            total: totalEstimated
        },
        devis: {
            report: devisReport,
            totalPlanned,
            totalReal,
            globalMargin,
            marginPct,
            ceiling: DEVIS_PLAFOND
        },
        updateRealCost,
        updatePlannedCost,
        isLoading: !projects || !teams || !households
    };
}
