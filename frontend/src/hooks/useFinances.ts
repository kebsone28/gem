/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Team, Household } from '../utils/types';
import * as safeStorage from '../utils/safeStorage';
import { useProject } from '../contexts/ProjectContext';
import logger from '../utils/logger';

export interface DevisItem {
  id: string;
  label: string;
  region: string;
  qty: number;
  unit: number;
}

export const DEVIS_ITEMS: DevisItem[] = [
  {
    id: 'formation',
    label: 'Formation 5 équipes (19 électriciens)',
    region: 'Global',
    qty: 5,
    unit: 1500000,
  },
  {
    id: 'transport',
    label: 'préparation et Transport matériel',
    region: 'Global',
    qty: 3750,
    unit: 3667,
  },
  {
    id: 'controle',
    label: 'Contrôle conformité / reporting',
    region: 'Global',
    qty: 3750,
    unit: 4000,
  },
  {
    id: 'kaffrine-coffret',
    label: 'Coffret + potelet + raccordement réseau',
    region: 'Kaffrine',
    qty: 2350,
    unit: 6230,
  },
  {
    id: 'kaffrine-mur',
    label: 'Mur support coffret (cheminée)',
    region: 'Kaffrine',
    qty: 2000,
    unit: 35000,
  },
  {
    id: 'kaffrine-tranchee',
    label: 'Tranchées + grillage (30x50, 15m)',
    region: 'Kaffrine',
    qty: 10000,
    unit: 1000,
  },
  {
    id: 'kaffrine-coffret-int',
    label: 'Coffret modulaire + mise à la terre',
    region: 'Kaffrine',
    qty: 2350,
    unit: 23000,
  },
  { id: 'kaffrine-kit2', label: 'Kit secondaire', region: 'Kaffrine', qty: 1000, unit: 6230 },
  {
    id: 'tamba-coffret',
    label: 'Coffret + potelet + raccordement réseau',
    region: 'Tambacounda',
    qty: 1400,
    unit: 6230,
  },
  {
    id: 'tamba-mur',
    label: 'Mur support coffret (cheminée)',
    region: 'Tambacounda',
    qty: 1500,
    unit: 35000,
  },
  {
    id: 'tamba-tranchee',
    label: 'Tranchées + grillage (30x50, 15m)',
    region: 'Tambacounda',
    qty: 10000,
    unit: 1000,
  },
  {
    id: 'tamba-coffret-int',
    label: 'Coffret modulaire + mise à la terre',
    region: 'Tambacounda',
    qty: 1400,
    unit: 23000,
  },
  { id: 'tamba-kit2', label: 'Kit secondaire', region: 'Tambacounda', qty: 1000, unit: 6230 },
];

const DEVIS_PLAFOND = 300823750;

export function useFinances() {
  const { project: activeProject, projects, activeProjectId, updateProject } = useProject();

  // Source unique : ProjectContext. Cela évite qu'un ancien active_project_id local
  // produise des indicateurs financiers différents selon le compte ou le navigateur.
  const project =
    activeProject ||
    projects.find((p) => p.id === activeProjectId) ||
    projects[0];

  const teams = useLiveQuery(() => db.teams.toArray()) as Team[] | undefined;
  const allHouseholds = useLiveQuery(() => db.households.toArray()) as Household[] | undefined;
  const inventory = useLiveQuery(
    () =>
      project?.id
        ? (db as any).inventory.where('projectId').equals(project.id).toArray()
        : Promise.resolve([]),
    [project?.id]
  );

  const householdsTotalCount = useLiveQuery(() => db.households.count()) || 0;

  const [householdsServerCount, setHouseholdsServerCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchServerHouseholdCount = async () => {
      try {
        const token = safeStorage.getItem('access_token');
        if (!token) return;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/households/count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHouseholdsServerCount(data.count);
        }
      } catch (err) {
        logger.warn(
          'Failed to fetch absolute household count from server, falling back to local DB.',
          err
        );
      }
    };
    fetchServerHouseholdCount();
  }, []);

  // Filtrer les ménages. Si les ménages de Kobo n'ont pas de projectId, on les inclut quand même
  // ou si on a un seul projet actif on prend tout pour la compatibilité avec la V1
  const households =
    allHouseholds?.filter((h) => !project?.id || !h.projectId || h.projectId === project.id) || [];
  const householdsCount =
    householdsServerCount !== null ? householdsServerCount : householdsTotalCount; // PostgreSQL server truth, or local Dexie as fallback
  const duration = project?.duration || 180;
  const staffConfig = project?.config?.staffConfig || {};
  const legacyCosts = (project?.config as any)?.costs || {};
  const materialCatalog = (project?.config?.materialCatalog || []) as any[];
  const subTeamAllocations = (project?.config?.subTeamAllocations || {}) as Record<string, any[]>;
  const realCostsOverrides = project?.config?.financials?.realCosts || {};
  const plannedCostsOverrides = project?.config?.financials?.plannedCosts || {};

  const getStaffCost = (roleId: string, count: number, dur: number) => {
    const config = staffConfig[roleId];
    if (!config) return (legacyCosts[roleId] || 100000) * dur * count;
    const { amount, mode } = config;
    if (mode === 'monthly') return Math.round((amount / 22) * dur) * count;
    if (mode === 'task') return (householdsCount * amount) / (count || 1);
    return amount * dur * count;
  };

  // 1. Teams (Tech)
  const techTeamsCount: Record<string, number> = { Maçon: 0, Réseau: 0, Intérieur: 0 };
  teams?.forEach((t) => {
    if (t.tradeKey === 'macons') techTeamsCount['Maçon']++;
    if (t.tradeKey === 'reseau') techTeamsCount['Réseau']++;
    if (t.tradeKey === 'interieur_type1') techTeamsCount['Intérieur']++;
  });

  const teamsCost = Object.entries(techTeamsCount).reduce((sum, [type, count]) => {
    const mapToKey: any = {
      Maçon: 'perMasonTeam',
      Réseau: 'perNetworkTeam',
      Intérieur: 'perInteriorTeam',
    };
    return sum + getStaffCost(mapToKey[type] || `per${type}Team`, count, duration);
  }, 0);

  // 2. Logistics
  const vehicleRental = project?.config?.costs?.vehicleRental || {
    delivery_rent_per_day: 50000,
    pm_rent_per_day: 75000,
  };
  const logisticsCost =
    (1 * (vehicleRental.delivery_rent_per_day || 50000) +
      1 * (vehicleRental.pm_rent_per_day || 75000)) *
    duration;

  // 3. Materials
  const includeSupply = !!project?.config?.includeSupply;
  const supplyCost = (inventory || [])
    .filter((item: any) => item.isActive !== false)
    .reduce(
      (sum: number, item: any) => sum + Number(item.stock || 0) * Number(item.unitPrice || 0),
      0
    );
  const materialsCost = includeSupply ? supplyCost : 0;

  const supervisionCost =
    getStaffCost('perSupervisor', Math.ceil((teams?.length || 0) / 10), duration) +
    getStaffCost('perProjectManager', 1, duration);

  const dotationDetails = Object.entries(subTeamAllocations).flatMap(([subTeamId, allocations]) => {
    const team = teams?.find((t) => t.id === subTeamId);
    return (allocations || []).map((allocation: any) => {
      const catalogItem = materialCatalog.find((item: any) => item.id === allocation.itemId);
      const quantity = Number(allocation.quantity || 0);
      const acquisitionType = allocation.acquisitionType === 'location' ? 'location' : 'achat';
      const unitPrice =
        acquisitionType === 'location'
          ? Number(catalogItem?.rentalPrice || 0)
          : Number(catalogItem?.purchasePrice || 0);
      const total = quantity * unitPrice;

      return {
        id: allocation.id || `${subTeamId}_${allocation.itemId}`,
        subTeamId,
        teamName: team?.name || 'Equipe non rattachee',
        itemId: allocation.itemId,
        itemName: catalogItem?.name || 'Materiel supprime du catalogue',
        acquisitionType,
        quantity,
        unitPrice,
        total,
      };
    });
  });

  const dotationsCost = dotationDetails.reduce((sum, item) => sum + item.total, 0);

  const totalEstimated =
    teamsCost + logisticsCost + materialsCost + supervisionCost + dotationsCost;

  const currentDevisItems =
    ((project?.config?.financials as any)?.devisItems as DevisItem[]) ?? DEVIS_ITEMS;

  const devisReport = currentDevisItems.map((item) => {
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
    if (!project?.id) return;
    const newConfig = { ...(project.config || {}) };
    if (!newConfig.financials) newConfig.financials = {};
    if (!newConfig.financials.realCosts) newConfig.financials.realCosts = {};
    if (!newConfig.financials.realCosts[itemId]) newConfig.financials.realCosts[itemId] = {};
    newConfig.financials.realCosts[itemId][field] = value;
    await updateProject({ config: newConfig }, project.id);
  };

  const updatePlannedCost = async (itemId: string, field: 'qty' | 'unit', value: number) => {
    if (!project?.id) return;
    const newConfig = { ...(project.config || {}) };
    if (!newConfig.financials) newConfig.financials = {};
    if (!newConfig.financials.plannedCosts) newConfig.financials.plannedCosts = {};
    if (!newConfig.financials.plannedCosts[itemId]) newConfig.financials.plannedCosts[itemId] = {};
    newConfig.financials.plannedCosts[itemId][field] = value;
    await updateProject({ config: newConfig }, project.id);
  };

  const deleteDevisItem = async (itemId: string) => {
    if (!project?.id) return;
    const newConfig = { ...(project.config || {}) };
    if (!newConfig.financials) newConfig.financials = {};
    const sourceItems = (newConfig.financials as any).devisItems ?? DEVIS_ITEMS;
    (newConfig.financials as any).devisItems = sourceItems.filter((i: any) => i.id !== itemId);
    await updateProject({ config: newConfig }, project.id);
  };

  const addDevisItem = async (item: {
    label: string;
    region: string;
    qty: number;
    unit: number;
  }) => {
    if (!project?.id) return;
    const newConfig = { ...(project.config || {}) };
    if (!newConfig.financials) newConfig.financials = {};
    const sourceItems = (newConfig.financials as any).devisItems ?? DEVIS_ITEMS;
    const newItem = { ...item, id: 'item_' + Date.now() };
    (newConfig.financials as any).devisItems = [...sourceItems, newItem];
    await updateProject({ config: newConfig }, project.id);
  };

  const resetToDefault = async () => {
    if (!project?.id) return;
    const newConfig = { ...(project.config || {}) };
    if (!newConfig.financials) newConfig.financials = {};
    (newConfig.financials as any).devisItems = [...DEVIS_ITEMS];
    (newConfig.financials as any).plannedCosts = {};
    (newConfig.financials as any).realCosts = {};
    DEVIS_ITEMS.forEach((d) => {
      (newConfig.financials as any).plannedCosts[d.id] = { qty: d.qty, unit: d.unit };
      (newConfig.financials as any).realCosts[d.id] = { qty: d.qty, unit: d.unit };
    });
    await updateProject({ config: newConfig }, project.id);
  };

  const parseSafeNum = (val: any, defaultVal: number) => {
    if (val === undefined || val === null || val === '') return defaultVal;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).replace(/\s/g, '').replace(/,/g, '.');
    const num = Number(cleanStr);
    return isNaN(num) ? defaultVal : num;
  };

  const importDevisList = async (list: any[]) => {
    if (!project?.id) return;
    const newConfig = { ...(project.config || {}) };
    if (!newConfig.financials) newConfig.financials = {};
    if (!newConfig.financials.plannedCosts) newConfig.financials.plannedCosts = {};
    if (!newConfig.financials.realCosts) newConfig.financials.realCosts = {};

    const sourceItems = [...((newConfig.financials as any).devisItems ?? DEVIS_ITEMS)];

    list.forEach((rawRow, index) => {
      // Case-insensitive / whitespace-insensitive header mapping
      const row: any = {};
      for (const key in rawRow) {
        row[key.trim().toLowerCase()] = rawRow[key];
      }

      const rowId = row['id'] || row['id_poste'] || `import_${Date.now()}_${index}`;
      const existingIndex = sourceItems.findIndex((i) => i.id === rowId);

      const newItem = {
        id: rowId,
        label: row['poste_de_depense'] || row['label'] || row['poste'] || 'Sans nom',
        region: row['region'] || 'Global',
        qty: parseSafeNum(row['prevision_qte'] ?? row['quantite_prevue'] ?? row['qty'], 1),
        unit: parseSafeNum(row['prevision_pu'] ?? row['prix_unitaire'] ?? row['unit'], 0),
        rq: parseSafeNum(row['reel_qte'] ?? row['reelle_qte'], 0),
        ru: parseSafeNum(row['reel_pu'] ?? row['reelle_pu'], 0),
      };

      if (existingIndex >= 0) {
        // Update baseline item
        sourceItems[existingIndex] = {
          ...sourceItems[existingIndex],
          label: newItem.label,
          region: newItem.region,
        };
      } else {
        sourceItems.push(newItem);
      }

      // Update planned costs
      if (!(newConfig.financials as any).plannedCosts[rowId]) {
        (newConfig.financials as any).plannedCosts[rowId] = {};
      }
      (newConfig.financials as any).plannedCosts[rowId].qty = newItem.qty;
      (newConfig.financials as any).plannedCosts[rowId].unit = newItem.unit;

      // Import real costs
      if (row['reel_qte'] !== undefined || row['reel_pu'] !== undefined) {
        if (!(newConfig.financials as any).realCosts) (newConfig.financials as any).realCosts = {};
        if (!(newConfig.financials as any).realCosts[rowId])
          (newConfig.financials as any).realCosts[rowId] = {};
        if (row['reel_qte'] !== undefined)
          (newConfig.financials as any).realCosts[rowId].qty = newItem.rq;
        if (row['reel_pu'] !== undefined)
          (newConfig.financials as any).realCosts[rowId].unit = newItem.ru;
      }
    });

    (newConfig.financials as any).devisItems = sourceItems;
    await updateProject({ config: newConfig }, project.id);
  };

  const toggleClientProvidesMaterials = async () => {
    if (!project?.id) return;
    const current = !!project.config?.clientProvidesMaterials;
    await updateProject({ config: { ...project.config, clientProvidesMaterials: !current } }, project.id);
  };

  const toggleIncludeSupply = async () => {
    if (!project?.id) return;
    const current = !!project.config?.includeSupply;
    await updateProject({ config: { ...project.config, includeSupply: !current } }, project.id);
  };

  const updateInventoryItem = async (itemId: string, updates: any) => {
    await (db as any).inventory.update(itemId, updates);
  };

  const deleteInventoryItem = async (itemId: string) => {
    await (db as any).inventory.delete(itemId);
  };

  const addInventoryItem = async (item: any) => {
    if (!project?.id) return;
    const uniqueId = `mat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    await (db as any).inventory.put({
      ...item,
      projectId: project.id,
      id: uniqueId,
    });
  };

  return {
    project,
    teams,
    householdsCount,
    inventory: inventory || [],
    duration,
    stats: {
      teams: teamsCost,
      logistics: logisticsCost,
      materials: materialsCost,
      dotations: dotationsCost,
      dotationDetails,
      supervision: supervisionCost,
      total: totalEstimated,
      supplyCost,
    },
    devis: {
      report: devisReport,
      totalPlanned,
      totalReal,
      globalMargin,
      marginPct,
      ceiling: DEVIS_PLAFOND,
      isClientProvidedMode: !!project?.config?.clientProvidesMaterials,
      includeSupplyMode: includeSupply,
    },
    updateRealCost,
    updatePlannedCost,
    toggleClientProvidesMaterials,
    toggleIncludeSupply,
    updateInventoryItem,
    deleteInventoryItem,
    addInventoryItem,
    addDevisItem,
    deleteDevisItem,
    importDevisList,
    resetToDefault,
    isLoading: !teams || !households,
  };
}
