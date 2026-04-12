import { useMemo, useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { KIT_COMPOSITION, GRAPPES_CONFIG } from '../utils/config';
import type { Household, Project, SubGrappe, Team } from '../utils/types';
import apiClient from '../api/client';
import * as safeStorage from '../utils/safeStorage';
import logger from '../utils/logger';

export function useLogistique() {
  const activeProjectId = safeStorage.getItem('active_project_id');
  const households = useLiveQuery(async () => {
    if (!activeProjectId) return [];
    return await db.households.where('projectId').equals(activeProjectId).toArray();
  }, [activeProjectId]) as Household[] | undefined;
  const projects = useLiveQuery(() => db.projects.toArray()) as Project[] | undefined;

  const project = useLiveQuery(async () => {
    if (activeProjectId) return await db.projects.get(activeProjectId);
    return (await db.projects.toArray())[0] ?? null;
  }, [activeProjectId]) as Project | null | undefined;

  const [dbTeams, setDbTeams] = useState<Team[]>([]);

  const refreshTeams = useCallback(async () => {
    if (!project?.id) return;
    try {
      const response = await apiClient.get(`/teams?projectId=${project.id}`);
      const mappedTeams = (response.data.teams || [])
        .filter((t: any) => !t.status || t.status === 'active')
        .map((t: any) => ({
          ...t,
          regionId: t.region?.name ? t.region.name.toLowerCase().replace(/\s+/g, '_') : t.regionId,
        }));
      setDbTeams(mappedTeams);
    } catch (err) {
      logger.error('Failed to fetch teams in useLogistique', err);
    }
  }, [project?.id]);

  useEffect(() => {
    if (!project?.id) return;
    refreshTeams();
  }, [project?.id, refreshTeams]);

  const legacyTeams = project?.config?.teams || [];
  const teams = dbTeams.length > 0 ? dbTeams : legacyTeams;
  const preparatorTeams = useMemo(() => teams.filter((t) => t.role === 'PREPARATION'), [teams]);

  const grappesConfig = project?.config?.grappesConfig || GRAPPES_CONFIG;

  // --- Warehouse Multi-Region Logic ---
  const warehouses: any[] = useMemo(() => {
    const configured = project?.config?.warehouses;

    // If warehouses are explicitly defined in config (even if empty), use them
    if (configured !== undefined) {
      return configured.filter((w: any) => !w.deletedAt);
    }

    // Auto-generate one warehouse per region ONLY if no configuration exists at all
    const allGrappes = grappesConfig?.grappes || [];
    const regions = Array.from(
      new Set(allGrappes.map((g: any) => g.region).filter(Boolean))
    ) as string[];
    return regions.map((region) => {
      const regionGrappes = allGrappes.filter((g: any) => g.region === region);
      const avgLat =
        regionGrappes.reduce((s: number, g: any) => s + (g.centroide_lat || 0), 0) /
        (regionGrappes.length || 1);
      const avgLng =
        regionGrappes.reduce((s: number, g: any) => s + (g.centroide_lon || 0), 0) /
        (regionGrappes.length || 1);
      return {
        id: `wh_${region.toLowerCase().replace(/\s+/g, '_')}`,
        name: `Magasin ${region}`,
        region,
        regionId: region.toLowerCase().replace(/\s+/g, '_'),
        latitude: avgLat,
        longitude: avgLng,
        address: '',
        preparatorTeams: [],
        stockOverrides: {},
      };
    });
  }, [project?.config?.warehouses, grappesConfig]);

  // --- Per-warehouse, real-time stock stats ---
  const warehouseStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const kitComposition = project?.config?.kitComposition || KIT_COMPOSITION;

    return warehouses.map((wh) => {
      const kitsLoadedToday = (wh.preparatorTeams || []).reduce((sum: number, team: any) => {
        const todayLoading = (team.loadings || []).find((l: any) => l.date === today);
        return sum + (todayLoading?.kitsLoaded || 0);
      }, 0);

      const regionHouseholds =
        households?.filter((h) => {
          const grappe = grappesConfig?.grappes?.find(
            (g: any) => g.id === h.grappeId || g.region === wh.region
          );
          const isConsumed = ['Conforme', 'Contrôle conforme', 'Terminé'].includes(h.status);
          return isConsumed && grappe;
        }) || [];
      const kitsConsumed = regionHouseholds.length;

      const stockRealtime = kitComposition.map((item: any) => ({
        ...item,
        initial: item.qty * kitsLoadedToday,
        consumed: item.qty * kitsConsumed,
        remaining: Math.max(0, item.qty * kitsLoadedToday - item.qty * kitsConsumed),
      }));

      const recentConforming =
        households?.filter((h) => {
          const grappe = grappesConfig?.grappes?.find((g: any) => g.region === wh.region);
          const isConsumed = ['Conforme', 'Contrôle conforme', 'Terminé'].includes(h.status);
          return isConsumed && grappe && (h.updatedAt || h.delivery?.date || '') >= sevenDaysAgo;
        }) || [];
      const teamVelocity = recentConforming.length / 7;

      const alerts = stockRealtime.filter(
        (item: any) => teamVelocity > 0 && item.remaining < item.qty * teamVelocity * 3
      );

      const kitsLoadedAllTime = (wh.preparatorTeams || []).reduce(
        (sum: number, team: any) =>
          sum + (team.loadings || []).reduce((s: number, l: any) => s + (l.kitsLoaded || 0), 0),
        0
      );

      return {
        ...wh,
        kitsLoadedToday,
        kitsConsumed,
        stockRealtime,
        teamVelocity: Math.round(teamVelocity * 10) / 10,
        alerts,
        hasAlert: alerts.length > 0,
        kitsLoadedAllTime,
        daysBeforeBreakout:
          teamVelocity > 0 ? Math.round(kitsLoadedToday / teamVelocity) : Infinity,
      };
    });
  }, [warehouses, households, grappesConfig, project?.config?.kitComposition]);

  // --- National Vision (Global Stats) ---
  const globalStats = useMemo(() => {
    const stats = {
      totalLoaded: warehouseStats.reduce((s, w) => s + w.kitsLoadedAllTime, 0),
      totalConsumed: warehouseStats.reduce((s, w) => s + w.kitsConsumed, 0),
      todayLoaded: warehouseStats.reduce((s, w) => s + w.kitsLoadedToday, 0),
      inTransit: 0, // Placeholder for future logic
      reserved: 0, // Placeholder for future logic
    };
    return {
      ...stats,
      totalAvailable: Math.max(0, stats.totalLoaded - stats.totalConsumed),
    };
  }, [warehouseStats]);

  const movementHistory = useMemo(() => project?.config?.logistique?.history || [], [project]);

  const logMovement = async (type: 'ENTRY' | 'EXIT' | 'TRANSFER', details: any) => {
    if (!project) return;
    const newConfig = { ...project.config };
    const logistique = newConfig.logistique || { history: [] };

    const newHistory = [
      {
        id: `mov_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type,
        ...details,
      },
      ...(logistique.history || []),
    ];

    // Keep only last 200 moves to avoid bloat
    newConfig.logistique = {
      ...logistique,
      history: newHistory.slice(0, 200),
    };

    await db.projects.update(project.id, { config: newConfig });
    try {
      await apiClient.patch(`/projects/${project.id}`, { config: newConfig });
    } catch (e) {}
  };

  // --- Legacy global stock (for StockTab backward compat) ---
  const kitsLoaded = project?.config?.logistics_workshop?.kitsLoaded || 0;
  const stockOverrides = project?.config?.stock_overrides || {};

  const kitComposition = project?.config?.kitComposition || KIT_COMPOSITION;
  const stockData = kitComposition.map((item: any) => {
    const calculated = item.qty * kitsLoaded;
    const hasOverride = stockOverrides[item.id] !== undefined;
    const current = hasOverride ? stockOverrides[item.id] : calculated;
    return { ...item, calculated, current, hasOverride };
  });

  // Global consumed count (all conforming households)
  const globalConsumed = useMemo(
    () =>
      households?.filter((h) => ['Conforme', 'Contrôle conforme', 'Terminé'].includes(h.status))
        .length || 0,
    [households]
  );
  const globalVelocity = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const recent =
      households?.filter(
        (h) =>
          ['Conforme', 'Contrôle conforme', 'Terminé'].includes(h.status) &&
          (h.updatedAt || h.delivery?.date || '') >= sevenDaysAgo
      ) || [];
    return Math.round((recent.length / 7) * 10) / 10;
  }, [households]);

  // --- Deliveries Logic ---
  const deliveries = useMemo(
    () =>
      households
        ?.filter((h) => h.delivery?.agent || h.delivery?.date || h.koboSync)
        .sort((a, b) => (b.delivery?.date || '').localeCompare(a.delivery?.date || '')) || [],
    [households]
  );

  // --- Kobo Sync Stats ---
  const koboStats = useMemo(() => {
    const stats = {
      totalPreparateurKits: 0,
      cableInt25Total: 0,
      cableInt15Total: 0,
      tranchee4Total: 0,
      tranchee15Total: 0,
    };

    households?.forEach((h) => {
      if (h.koboSync) {
        stats.totalPreparateurKits += h.koboSync.preparateurKits || 0;
        stats.cableInt25Total += h.koboSync.cableInt25 || 0;
        stats.cableInt15Total += h.koboSync.cableInt15 || 0;
        stats.tranchee4Total += h.koboSync.tranchee4 || 0;
        stats.tranchee15Total += h.koboSync.tranchee15 || 0;
      }
    });
    return stats;
  }, [households]);

  // --- Agents & Performance Logic ---
  const agents = useMemo(() => {
    const agentStats: Record<
      string,
      { visits: number; totalMinutes: number; timeCount: number; lastDate: string }
    > = {};
    const teamActivity: Record<string, number> = {};

    households?.forEach((h) => {
      const agent = h.delivery?.agent;
      if (agent) {
        if (!agentStats[agent])
          agentStats[agent] = { visits: 0, totalMinutes: 0, timeCount: 0, lastDate: '' };
        agentStats[agent].visits++;
        if (h.workTime?.durationMinutes) {
          agentStats[agent].totalMinutes += h.workTime.durationMinutes;
          agentStats[agent].timeCount++;
        }
        if (h.delivery?.date && h.delivery.date > agentStats[agent].lastDate) {
          agentStats[agent].lastDate = h.delivery.date;
        }
      }

      if (h.status === 'Conforme') {
        const teamName = 'Équipe Standard';
        teamActivity[teamName] = (teamActivity[teamName] || 0) + 1;
      }
    });

    return Object.entries(agentStats)
      .map(([name, stats]) => {
        const avgTime = stats.timeCount > 0 ? Math.round(stats.totalMinutes / stats.timeCount) : 0;
        const lastDate = stats.lastDate ? new Date(stats.lastDate) : null;
        const daysSince = lastDate ? Math.round((Date.now() - lastDate.getTime()) / 86400000) : 999;
        const status = daysSince <= 3 ? 'Actif' : daysSince <= 7 ? 'Ralenti' : 'Inactif';
        return { name, ...stats, avgTime, daysSince, status };
      })
      .sort((a, b) => b.visits - a.visits);
  }, [households]);

  // --- Grappes Logic (Assignments) ---
  const computeCompleteness = (assignments?: Record<string, string[]>) => {
    if (!assignments) return 0;
    if (!teams || teams.length === 0) return 0;
    const trades = Array.from(
      new Set(teams.map((t) => (t as any).type || t.tradeKey).filter(Boolean))
    );
    if (trades.length === 0) return 0;
    let count = 0;
    trades.forEach((t: any) => {
      if (assignments[t]?.length > 0) count++;
    });
    return Math.round((count / trades.length) * 100);
  };

  const computeRiskIndex = (sg: SubGrappe, assignments?: Record<string, string[]>) => {
    let score = 0;
    if (!assignments || !Object.values(assignments).some((arr) => arr.length > 0)) score += 40;
    if (assignments && (assignments['macons']?.length || 0) > 0 && !assignments['controle'])
      score += 20;
    if ((sg.nb_menages || 0) > 200) score += 25;
    return Math.min(score, 100);
  };

  const updateAssignment = async (sgId: string, trade: string, teamIds: string[]) => {
    if (!project) return;
    const newConfig = { ...project.config };
    if (!newConfig.assignments) newConfig.assignments = {};
    if (!newConfig.assignments[sgId]) newConfig.assignments[sgId] = {};
    newConfig.assignments[sgId][trade] = teamIds;
    await db.projects.update(project.id, { config: newConfig });

    try {
      await apiClient.patch(`/projects/${project.id}`, { config: newConfig });
    } catch (err) {
      console.warn('Backend sync failed, changes queued for offline sync.', err);
    }
  };

  const updateKitsLoaded = async (count: number) => {
    if (!project) return;
    const newConfig = { ...project.config };
    if (!newConfig.logistics_workshop) newConfig.logistics_workshop = {};
    newConfig.logistics_workshop.kitsLoaded = count;
    await db.projects.update(project.id, { config: newConfig });

    try {
      await apiClient.patch(`/projects/${project.id}`, { config: newConfig });
    } catch (err) {
      console.warn('Backend sync failed, changes queued for offline sync.', err);
    }
  };

  // --- Warehouse Mutation Functions ---
  const _saveWarehouseConfig = async (updatedWarehouses: any[]) => {
    if (!project) return;
    const newConfig = { ...project.config, warehouses: updatedWarehouses };
    await db.projects.update(project.id, { config: newConfig });
    try {
      await apiClient.patch(`/projects/${project.id}`, { config: newConfig });
    } catch (err) {
      console.warn('Backend sync failed, changes queued for offline sync.', err);
    }
  };

  const addWarehouse = async (name: string, region: string) => {
    const newWh = {
      id: `wh_${Date.now()}`,
      name,
      region,
      latitude: undefined,
      longitude: undefined,
      address: '',
      preparatorTeams: [],
      stockOverrides: {},
    };
    await _saveWarehouseConfig([...warehouses, newWh]);
  };

  const addPreparatorLoading = async (
    warehouseId: string,
    teamId: string,
    teamName: string,
    kitsLoaded: number,
    variantId: string = 'standard'
  ) => {
    const whStatus = warehouseStats.find((w) => w.id === warehouseId);
    if (whStatus && whStatus.kitsLoadedToday + kitsLoaded > whStatus.kitsLoadedToday + 500) {
      // arbitrary logical cap or real stock check
      // Real check: if total kits loaded (stock) < kits requested
    }

    const today = new Date().toISOString().split('T')[0];
    const updated = warehouses.map((wh) => {
      if (wh.id !== warehouseId) return wh;

      const teams = [...(wh.preparatorTeams || [])];
      const teamIdx = teams.findIndex((t: any) => t.teamId === teamId);
      const loading = { date: today, kitsLoaded, variantId };

      if (teamIdx >= 0) {
        const loadings = [
          ...(teams[teamIdx].loadings || []).filter((l: any) => l.date !== today),
          loading,
        ];
        teams[teamIdx] = { ...teams[teamIdx], loadings };
      } else {
        teams.push({ teamId, teamName, loadings: [loading] });
      }
      return { ...wh, preparatorTeams: teams };
    });

    await _saveWarehouseConfig(updated);
    await logMovement('EXIT', {
      warehouseId,
      teamName,
      quantity: kitsLoaded,
      variantId,
      label: `Chargement Équipe: ${teamName}`,
    });
  };

  const receiveStock = async (warehouseId: string, kitsCount: number, source: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = warehouses.map((wh) => {
      if (wh.id !== warehouseId) return wh;
      const teams = [...(wh.preparatorTeams || [])];
      const sysIdx = teams.findIndex((t: any) => t.teamId === 'supply_system');
      const loading = { date: today, kitsLoaded: kitsCount, isEntry: true };

      if (sysIdx >= 0) {
        teams[sysIdx] = {
          ...teams[sysIdx],
          loadings: [...(teams[sysIdx].loadings || []), loading],
        };
      } else {
        teams.push({ teamId: 'supply_system', teamName: 'Approvisionnement', loadings: [loading] });
      }
      return { ...wh, preparatorTeams: teams };
    });
    await _saveWarehouseConfig(updated);
    await logMovement('ENTRY', {
      warehouseId,
      source,
      quantity: kitsCount,
      label: `Réception Matériel: ${source}`,
    });
  };

  const updateWarehouseCoords = async (
    warehouseId: string,
    latitude: number,
    longitude: number,
    address: string
  ) => {
    const updated = warehouses.map((wh) =>
      wh.id === warehouseId ? { ...wh, latitude, longitude, address } : wh
    );
    await _saveWarehouseConfig(updated);
  };

  const deleteWarehouse = async (warehouseId: string) => {
    const configured = project?.config?.warehouses;
    // If config is empty, we use the auto-generated list as our base to persist the deletion
    const baseList = configured && configured.length > 0 ? configured : warehouses;

    const updated = baseList.map((wh) =>
      wh.id === warehouseId ? { ...wh, deletedAt: new Date().toISOString() } : wh
    );
    await _saveWarehouseConfig(updated);
  };

  const transferStock = async (fromId: string, toId: string, kitsCount: number) => {
    if (!kitsCount || kitsCount <= 0) return;
    const configured = project?.config?.warehouses || [];

    const fromWh = warehouseStats.find((w) => w.id === fromId);
    const toWh = warehouseStats.find((w) => w.id === toId);

    const updated = configured.map((wh) => {
      if (wh.id === fromId) {
        const loading = {
          date: new Date().toISOString().split('T')[0],
          kitsLoaded: -kitsCount,
          isTransfer: true,
        };
        const teams = [...(wh.preparatorTeams || [])];
        const teamIdx = teams.findIndex((t: any) => t.teamId === 'transfer_system');
        if (teamIdx >= 0) {
          teams[teamIdx] = {
            ...teams[teamIdx],
            loadings: [...(teams[teamIdx].loadings || []), loading],
          };
        } else {
          teams.push({
            teamId: 'transfer_system',
            teamName: 'Système (Transfert)',
            loadings: [loading],
          });
        }
        return { ...wh, preparatorTeams: teams };
      }
      if (wh.id === toId) {
        const loading = {
          date: new Date().toISOString().split('T')[0],
          kitsLoaded: kitsCount,
          isTransfer: true,
        };
        const teams = [...(wh.preparatorTeams || [])];
        const teamIdx = teams.findIndex((t: any) => t.teamId === 'transfer_system');
        if (teamIdx >= 0) {
          teams[teamIdx] = {
            ...teams[teamIdx],
            loadings: [...(teams[teamIdx].loadings || []), loading],
          };
        } else {
          teams.push({
            teamId: 'transfer_system',
            teamName: 'Système (Transfert)',
            loadings: [loading],
          });
        }
        return { ...wh, preparatorTeams: teams };
      }
      return wh;
    });
    await _saveWarehouseConfig(updated);
    await logMovement('TRANSFER', {
      fromId,
      toId,
      fromWh: fromWh?.name,
      toWh: toWh?.name,
      quantity: kitsCount,
      label: `Transfert: ${fromWh?.name} -> ${toWh?.name}`,
    });
  };

  return {
    households,
    teams,
    preparatorTeams,
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
    refreshTeams,
    // Warehouse
    warehouses,
    warehouseStats,
    globalStats,
    globalConsumed,
    globalVelocity,
    movementHistory,
    addWarehouse,
    deleteWarehouse,
    transferStock,
    addPreparatorLoading,
    receiveStock,
    updateWarehouseCoords,
    isLoading: !households || project === undefined || !projects,
  };
}
