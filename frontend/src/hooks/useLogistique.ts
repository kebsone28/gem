import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { KIT_COMPOSITION, GRAPPES_CONFIG } from '../utils/config';
import type { Household, Team, Project, SubGrappe } from '../utils/types';

export function useLogistique() {
    const households = useLiveQuery(() => db.households.toArray()) as Household[] | undefined;
    const teams = useLiveQuery(() => db.teams.toArray()) as Team[] | undefined;
    // @ts-ignore - Assuming projects table exists or use a default
    const projects = useLiveQuery(() => db.projects.toArray()) as Project[] | undefined;
    const project = projects?.[0];

    const grappesConfig = project?.config?.grappesConfig || GRAPPES_CONFIG;

    // --- Stock Logic ---
    const kitsLoaded = project?.config?.logistics_workshop?.kitsLoaded || 0;
    const stockOverrides = project?.config?.stock_overrides || {};

    const stockData = KIT_COMPOSITION.map(item => {
        const calculated = item.qty * kitsLoaded;
        const hasOverride = stockOverrides[item.id] !== undefined;
        const current = hasOverride ? stockOverrides[item.id] : calculated;
        return { ...item, calculated, current, hasOverride };
    });

    // --- Deliveries Logic ---
    const deliveries = households?.filter(h => h.delivery?.agent || h.delivery?.date || h.koboSync)
        .sort((a, b) => (b.delivery?.date || '').localeCompare(a.delivery?.date || '')) || [];

    // --- Kobo Sync Stats ---
    const koboStats = {
        totalPreparateurKits: 0,
        cableInt25Total: 0,
        cableInt15Total: 0,
        tranchee4Total: 0,
        tranchee15Total: 0,
    };

    households?.forEach(h => {
        if (h.koboSync) {
            koboStats.totalPreparateurKits += (h.koboSync.preparateurKits || 0);
            koboStats.cableInt25Total += (h.koboSync.cableInt25 || 0);
            koboStats.cableInt15Total += (h.koboSync.cableInt15 || 0);
            koboStats.tranchee4Total += (h.koboSync.tranchee4 || 0);
            koboStats.tranchee15Total += (h.koboSync.tranchee15 || 0);
        }
    });

    // --- Agents & Performance Logic ---
    const agentStats: Record<string, { visits: number, totalMinutes: number, timeCount: number, lastDate: string }> = {};
    const teamActivity: Record<string, number> = {};

    households?.forEach(h => {
        const agent = h.delivery?.agent;
        if (agent) {
            if (!agentStats[agent]) agentStats[agent] = { visits: 0, totalMinutes: 0, timeCount: 0, lastDate: '' };
            agentStats[agent].visits++;
            if (h.workTime?.durationMinutes) {
                agentStats[agent].totalMinutes += h.workTime.durationMinutes;
                agentStats[agent].timeCount++;
            }
            if (h.delivery?.date && h.delivery.date > agentStats[agent].lastDate) {
                agentStats[agent].lastDate = h.delivery.date;
            }
        }

        // Team counting logic (simplifié)
        if (h.status === 'Conforme') {
            const teamName = "Équipe Standard"; // Placeholder logic
            teamActivity[teamName] = (teamActivity[teamName] || 0) + 1;
        }
    });

    const agents = Object.entries(agentStats).map(([name, stats]) => {
        const avgTime = stats.timeCount > 0 ? Math.round(stats.totalMinutes / stats.timeCount) : 0;
        const lastDate = stats.lastDate ? new Date(stats.lastDate) : null;
        const daysSince = lastDate ? Math.round((Date.now() - lastDate.getTime()) / 86400000) : 999;
        const status = daysSince <= 3 ? 'Actif' : daysSince <= 7 ? 'Ralenti' : 'Inactif';
        return { name, ...stats, avgTime, daysSince, status };
    }).sort((a, b) => b.visits - a.visits);

    // --- Grappes Logic (Assignments) ---
    const computeCompleteness = (assignments?: Record<string, string[]>) => {
        if (!assignments) return 0;
        if (!teams || teams.length === 0) return 0;
        const trades = Array.from(new Set(teams.map(t => t.type)));
        if (trades.length === 0) return 0;
        let count = 0;
        trades.forEach((t: any) => { if (assignments[t]?.length > 0) count++; });
        return Math.round((count / trades.length) * 100);
    };

    const computeRiskIndex = (sg: SubGrappe, assignments?: Record<string, string[]>) => {
        let score = 0;
        if (!assignments || !Object.values(assignments).some(arr => arr.length > 0)) score += 40;
        if (assignments && (assignments['macons']?.length || 0) > 0 && !assignments['controle']) score += 20;
        if ((sg.nb_menages || 0) > 200) score += 25;
        return Math.min(score, 100);
    };

    const updateAssignment = async (sgId: string, trade: string, teamIds: string[]) => {
        if (!project) return;
        const newConfig = { ...project.config };
        if (!newConfig.assignments) newConfig.assignments = {};
        if (!newConfig.assignments[sgId]) newConfig.assignments[sgId] = {};
        newConfig.assignments[sgId][trade] = teamIds;
        // @ts-ignore
        await db.projects.update(project.id, { config: newConfig });
    };

    const updateKitsLoaded = async (count: number) => {
        if (!project) return;
        const newConfig = { ...project.config };
        if (!newConfig.logistics_workshop) newConfig.logistics_workshop = {};
        newConfig.logistics_workshop.kitsLoaded = count;
        // @ts-ignore
        await db.projects.update(project.id, { config: newConfig });
    };

    return {
        households,
        teams,
        project,
        stockData,
        deliveries,
        agents,
        koboStats,
        computeCompleteness,
        computeRiskIndex,
        updateAssignment,
        updateKitsLoaded,
        grappesConfig,
        isLoading: !households || !teams || !projects
    };
}
