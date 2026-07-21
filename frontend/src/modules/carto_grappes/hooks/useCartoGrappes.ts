import { useState, useCallback, useEffect, useMemo } from 'react';
import { syncEventBus } from '../../../utils/syncEventBus';
import type {
  Village,
  Menage,
  GpsEntry,
  GpsData,
  LotKey,
  LotMode,
  StatusValue,
  MenageEntry,
  EntrepreneurData,
  EntrepreneurConfig,
  LotConfig,
  GrappeSummary,
  RegionSummary,
  TabKey,
  HistoryEntry,
  Prestataire,
} from '../types';
import { GRAPPE_COLORS, REGIONS, GRAPPE_COUNT } from '../constants';
import * as api from './carto_grappes.service';
import { kmeansCluster, projectCoordinatesToSVG } from '../engine/excelEngine';

// ── Server Configuration State ────────────────────────────────────────────

interface ServerConfig {
  regions: { id: string; name: string; code: string; active: boolean }[];
  grappes: {
    id: string;
    regionId: string;
    grappeNumber: number;
    grappeKey: string;
    menageCount: number;
    active: boolean;
    region?: any;
  }[];
  lots: {
    id: string;
    lotKey: string;
    title: string;
    description: string | null;
    active: boolean;
  }[];
  entrepreneurs?: {
    id: string;
    organizationId: string;
    lot: string;
    grappeKey: string | null;
    mode: string;
    entreprise: string;
    societe: string;
  }[];
}

interface DashboardStats {
  totalGrappes: number;
  totalRegions: number;
  totalLots: number;
  assignedGrappes: number;
  unassignedGrappes: number;
  globalAssignments: number;
  groupAssignments: number;
  individualAssignments: number;
  lotStats: Record<
    string,
    { total: number; assigned: number; global: number; group: number; individual: number }
  >;
  regionStats: Record<string, { total: number; assigned: number }>;
  prestataireUsage: Record<string, number>;
}

function villageKey(region: string, village: string) {
  return `${region}|${village}`;
}

function createDefaultEntry(): MenageEntry {
  return {
    A: { status: 'non_fait', justif: '', updatedAt: null },
    B: { status: 'non_fait', justif: '', updatedAt: null },
    C: { status: 'non_fait', justif: '', updatedAt: null },
    conforme: false,
    obs: '',
  };
}

function normEntrepreneur(o?: EntrepreneurData | null): EntrepreneurData {
  return {
    entreprise:
      (o && 'entreprise' in o ? (o as EntrepreneurData).entreprise : '') || '\u00C0 d\u00E9finir',
    societe: (o && 'societe' in o ? (o as EntrepreneurData).societe : '') || '',
    telephone: (o && 'telephone' in o ? (o as EntrepreneurData).telephone : '') || '',
    email: (o && 'email' in o ? (o as EntrepreneurData).email : '') || '',
    adresse: (o && 'adresse' in o ? (o as EntrepreneurData).adresse : '') || '',
  };
}

function getLotMode(lot: LotKey, modes: Record<LotKey, LotMode>): LotMode {
  return modes[lot] || 'individuel';
}

function entrepreneurOf(
  lot: LotKey,
  region: string,
  grappe: number,
  config: EntrepreneurConfig,
  modes: Record<LotKey, LotMode>
): EntrepreneurData {
  const key = `${region}_${grappe}`;
  const mode = getLotMode(lot, modes);
  const cfg = config[lot] || {};

  if (mode === 'global' && cfg.__global) return normEntrepreneur(cfg.__global);
  if (mode === 'groupe' && cfg.__groupes) {
    for (const g of cfg.__groupes) {
      if (g.grappes?.includes(key)) return normEntrepreneur(g);
    }
  }
  if (cfg[key]) return normEntrepreneur(cfg[key] as EntrepreneurData);
  if (cfg.__global) return normEntrepreneur(cfg.__global);
  return normEntrepreneur(null);
}

export function useCartoGrappes() {
  const [villages, setVillages] = useState<Village[]>([]);
  const [menages, setMenages] = useState<Menage[]>([]);
  const [gps, setGps] = useState<GpsEntry>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('map');
  const [selectedRegion, setSelectedRegion] = useState<string>('__ALL__');
  const [selectedGrappe, setSelectedGrappe] = useState<string | null>(null);
  const [selectedLot, setSelectedLot] = useState<LotKey>('B');
  const [searchQuery, setSearchQuery] = useState('');

  const [entries, setEntries] = useState<Record<number, MenageEntry>>({});
  const [entrepreneurConfig, setEntrepreneurConfig] = useState<EntrepreneurConfig>({
    A: {},
    B: {},
    C: {},
  } as EntrepreneurConfig);
  const [lotModes, setLotModes] = useState<Record<LotKey, LotMode>>({
    A: 'individuel',
    B: 'individuel',
    C: 'individuel',
  });
  const [villageOverrides, setVillageOverrides] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);

  // Server configuration state
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    regions: [],
    grappes: [],
    lots: [],
  });

  // Dashboard stats from server
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  /* ── Load everything from API on mount ── */
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        // Fetch all reference data from API in parallel
        const [
          apiVillages,
          apiMenages,
          apiGps,
          apiPrestataires,
          apiRegions,
          apiGrappes,
          apiLots,
          apiEntries,
          apiOverrides,
          apiEntConfig,
          apiSettings,
          apiDashboardStats,
        ] = await Promise.allSettled([
          api.fetchVillages(),
          api.fetchMenages(),
          api.fetchGps(),
          api.fetchPrestataires(),
          api.fetchRegions(),
          api.fetchGrappes(),
          api.fetchLots(),
          api.fetchEntries(),
          api.fetchVillageOverrides(),
          api.fetchEntrepreneurs(),
          api.fetchSettings(),
          api.fetchDashboardStats(),
        ]);

        if (cancelled) return;

        // Villages
        if (apiVillages.status === 'fulfilled' && apiVillages.value.length > 0) {
          setVillages(apiVillages.value);
        } else {
          // API returned no villages - this shouldn't happen with unified DB
          setVillages([]);
        }

        // Ménages
        if (apiMenages.status === 'fulfilled' && apiMenages.value.length > 0) {
          setMenages(apiMenages.value);
        } else {
          setMenages([]);
        }

        // GPS
        if (apiGps.status === 'fulfilled' && Object.keys(apiGps.value).length > 0) {
          const gpsObj: GpsEntry = {};
          for (const g of apiGps.value as GpsData[]) {
            gpsObj[g.ordre] = [g.lat, g.lon, g.accuracy];
          }
          setGps(gpsObj);
        } else {
          setGps({});
        }

        // Prestataires
        if (apiPrestataires.status === 'fulfilled' && apiPrestataires.value.length > 0) {
          const transformed = apiPrestataires.value.map((p: any) => ({
            id: p.id || `api-${p.lot}-${p.nom}`,
            nom: p.nom || '',
            entreprise: p.entreprise || p.nom || '',
            societe: p.societe || '',
            telephone: p.telephone || '',
            email: p.email || '',
            adresse: p.adresse || '',
            lot: p.lot || '',
            region: p.region || '',
          }));
          setPrestataires(transformed);
        } else {
          setPrestataires([]);
        }

        // Server config
        setServerConfig({
          regions: apiRegions.status === 'fulfilled' ? apiRegions.value : [],
          grappes: (apiGrappes.status === 'fulfilled' ? apiGrappes.value : []).map(
            (grappe: any) => {
              const regionsArr = apiRegions.status === 'fulfilled' ? apiRegions.value : [];
              const region = regionsArr.find((r: any) => r.id === grappe.regionId);
              return { ...grappe, region };
            }
          ),
          lots: apiLots.status === 'fulfilled' ? apiLots.value : [],
          entrepreneurs: apiEntConfig.status === 'fulfilled' ? apiEntConfig.value : [],
        });

        // Dashboard stats
        if (apiDashboardStats.status === 'fulfilled') {
          setDashboardStats(apiDashboardStats.value);
        }

        // Entries
        if (apiEntries.status === 'fulfilled') {
          const apiMap: Record<number, MenageEntry> = {};
          for (const [ordreStr, raw] of Object.entries(apiEntries.value)) {
            const ordre = Number(ordreStr);
            apiMap[ordre] = {
              A: {
                status: raw.A?.status || 'non_fait',
                justif: raw.A?.justif || '',
                updatedAt: raw.A?.updatedAt || null,
              },
              B: {
                status: raw.B?.status || 'non_fait',
                justif: raw.B?.justif || '',
                updatedAt: raw.B?.updatedAt || null,
              },
              C: {
                status: raw.C?.status || 'non_fait',
                justif: raw.C?.justif || '',
                updatedAt: raw.C?.updatedAt || null,
              },
              conforme: raw.conforme || false,
              obs: raw.obs || '',
            };
          }
          setEntries(apiMap);
        }

        // Overrides
        if (apiOverrides.status === 'fulfilled') {
          setVillageOverrides(apiOverrides.value);
        }

        // Entrepreneur config
        if (apiEntConfig.status === 'fulfilled' && apiEntConfig.value.length > 0) {
          const config: EntrepreneurConfig = { A: {}, B: {}, C: {} } as EntrepreneurConfig;
          for (const e of apiEntConfig.value) {
            const lot = e.lot as LotKey;
            const data: EntrepreneurData = {
              entreprise: e.entreprise,
              societe: e.societe,
              telephone: e.telephone,
              email: e.email,
              adresse: e.adresse,
            };
            if (e.mode === 'global') {
              config[lot].__global = data;
            } else if (e.mode === 'groupe' && e.groupId) {
              if (!config[lot].__groupes) config[lot].__groupes = [];
              const existing = config[lot].__groupes!.find((gr) => gr.id === e.groupId);
              if (existing) {
                existing.grappes = existing.grappes || [];
                if (e.grappeKey && !existing.grappes.includes(e.grappeKey))
                  existing.grappes.push(e.grappeKey);
                Object.assign(existing, data);
              } else {
                config[lot].__groupes!.push({
                  ...data,
                  id: e.groupId,
                  grappes: e.grappeKey ? [e.grappeKey] : [],
                });
              }
            } else if (e.grappeKey) {
              config[lot][e.grappeKey] = data;
            }
          }
          setEntrepreneurConfig(config);
        }

        // Lot modes
        if (apiSettings.status === 'fulfilled' && apiSettings.value.lotModes) {
          setLotModes(apiSettings.value.lotModes as Record<LotKey, LotMode>);
        }
      } catch (e) {
        console.error('Failed to load carto data:', e);
        setVillages([]);
        setMenages([]);
        setGps({});
        setPrestataires([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── WebSocket real-time updates ── */
  useEffect(() => {
    const unsubEntries = syncEventBus.subscribe('carto:entries:updated', () => {
      api
        .fetchEntries()
        .then((apiEntries) => {
          const apiMap: Record<number, MenageEntry> = {};
          for (const [ordreStr, raw] of Object.entries(apiEntries)) {
            const ordre = Number(ordreStr);
            apiMap[ordre] = {
              A: {
                status: raw.A?.status || 'non_fait',
                justif: raw.A?.justif || '',
                updatedAt: raw.A?.updatedAt || null,
              },
              B: {
                status: raw.B?.status || 'non_fait',
                justif: raw.B?.justif || '',
                updatedAt: raw.B?.updatedAt || null,
              },
              C: {
                status: raw.C?.status || 'non_fait',
                justif: raw.C?.justif || '',
                updatedAt: raw.C?.updatedAt || null,
              },
              conforme: raw.conforme || false,
              obs: raw.obs || '',
            };
          }
          setEntries(apiMap);
        })
        .catch(() => {});
    });

    const unsubConfig = syncEventBus.subscribe('carto:config:updated', () => {
      Promise.allSettled([
        api.fetchEntrepreneurs(),
        api.fetchSettings(),
        api.fetchVillageOverrides(),
      ]).then(([entResult, settingsResult, overridesResult]) => {
        if (entResult.status === 'fulfilled' && entResult.value.length > 0) {
          const config: Record<string, any> = { A: {}, B: {}, C: {} };
          for (const e of entResult.value) {
            const lot = e.lot;
            const data = {
              entreprise: e.entreprise,
              societe: e.societe,
              telephone: e.telephone,
              email: e.email,
              adresse: e.adresse,
            };
            if (e.mode === 'global') {
              config[lot].__global = data;
            } else if (e.grappeKey) {
              config[lot][e.grappeKey] = data;
            }
          }
          setEntrepreneurConfig(config as any);
        }
        if (settingsResult.status === 'fulfilled' && settingsResult.value?.lotModes) {
          setLotModes(settingsResult.value.lotModes as any);
        }
        if (overridesResult.status === 'fulfilled') {
          setVillageOverrides(overridesResult.value);
        }
      });
    });

    const unsubRefresh = syncEventBus.subscribe('carto:refresh', () => {
      window.location.reload();
    });

    return () => {
      unsubEntries();
      unsubConfig();
      unsubRefresh();
    };
  }, []);

  /* ── Grappe assignment ── */
  const grappeOf = useCallback(
    (region: string, villageName: string): number => {
      const k = villageKey(region, villageName);
      if (villageOverrides[k] !== undefined) return villageOverrides[k];
      const v = villages.find((x) => x.region === region && x.village === villageName);
      return v ? v.defaultGrappe : 1;
    },
    [villages, villageOverrides]
  );

  // Assigner des grappes basées sur une distribution équilibrée par région
  const assignGrappesToMenages = useCallback(
    (menagesList: Menage[]): Menage[] => {
      const regionGrappes: Record<string, number[]> = {};

      // Initialiser les compteurs de grappes pour chaque région
      REGIONS.forEach((region) => {
        const targetGrappes = GRAPPE_COUNT[region] || 3;
        regionGrappes[region] = Array.from({ length: targetGrappes }, (_, i) => 0);
      });

      // Assigner les grappes en utilisant villageGrappeMap ou defaultGrappe
      return menagesList.map((m) => {
        const v = villages.find((x) => x.region === m.region && x.village === m.village);
        const defaultGrappe = v?.defaultGrappe || 1;
        const grappe = defaultGrappe;

        // Incrémenter le compteur
        if (regionGrappes[m.region]) {
          regionGrappes[m.region][grappe - 1] = (regionGrappes[m.region][grappe - 1] || 0) + 1;
        }

        return { ...m, grappe };
      });
    },
    [villages, GRAPPE_COUNT]
  );

  const menagesWithGrappe = useMemo(() => {
    const newMenages = assignGrappesToMenages(menages);
    return newMenages;
  }, [menages, assignGrappesToMenages]);

  /* ── Entry CRUD ── */
  const getEntry = useCallback(
    (ordre: number): MenageEntry => {
      if (!entries[ordre]) return createDefaultEntry();
      return entries[ordre];
    },
    [entries]
  );

  const updateEntry = useCallback(
    async (ordre: number, lot: LotKey, status: StatusValue, justif: string) => {
      const existing = entries[ordre] || createDefaultEntry();
      const fromStatus = existing[lot].status;
      setEntries((prev) => ({
        ...prev,
        [ordre]: { ...existing, [lot]: { status, justif, updatedAt: new Date().toISOString() } },
      }));
      const m = menagesWithGrappe.find((x) => x.ordre === ordre);
      try {
        await api.saveEntry(ordre, lot, status, justif, {
          nom: m?.nom,
          village: m?.village,
          region: m?.region,
          fromStatus,
        });
      } catch (err) {
        console.warn('API save failed:', err);
      }
    },
    [menagesWithGrappe, entries]
  );

  const updateConforme = useCallback(
    async (ordre: number, conforme: boolean) => {
      const existing = entries[ordre] || createDefaultEntry();
      setEntries((prev) => ({
        ...prev,
        [ordre]: { ...existing, conforme },
      }));
      try {
        await api.saveConforme(ordre, conforme);
      } catch (err) {
        console.warn('API save conforme failed:', err);
      }
    },
    [entries]
  );

  const updateObs = useCallback(
    async (ordre: number, obs: string) => {
      const existing = entries[ordre] || createDefaultEntry();
      setEntries((prev) => ({
        ...prev,
        [ordre]: { ...existing, obs },
      }));
      try {
        await api.saveObs(ordre, obs);
      } catch (err) {
        console.warn('API save obs failed:', err);
      }
    },
    [entries]
  );

  /* ── Entrepreneur CRUD ── */
  const updateEntrepreneurConfig = useCallback((config: EntrepreneurConfig) => {
    setEntrepreneurConfig(config);
  }, []);

  const syncEntrepreneursToAPI = useCallback(
    async (config?: EntrepreneurConfig) => {
      const cfg = config || entrepreneurConfig;
      const promises: Promise<unknown>[] = [];
      for (const lot of ['A', 'B', 'C'] as LotKey[]) {
        const lotCfg = cfg[lot] || {};
        if (lotCfg.__global) {
          promises.push(api.saveEntrepreneur({ lot, mode: 'global', ...lotCfg.__global }));
        }
        if (lotCfg.__groupes) {
          for (const g of lotCfg.__groupes) {
            promises.push(api.saveEntrepreneur({ lot, mode: 'groupe', groupId: g.id, ...g }));
          }
        }
        for (const [grappeKey, data] of Object.entries(lotCfg)) {
          if (!grappeKey.startsWith('__')) {
            promises.push(api.saveEntrepreneur({ lot, grappeKey, mode: 'individuel', ...data }));
          }
        }
      }
      await Promise.allSettled(promises);
      // Trigger config refresh
      syncEventBus.publish('carto:config:updated', {});
    },
    [entrepreneurConfig]
  );

  /* ── Settings ── */
  const updateLotMode = useCallback(
    async (lot: LotKey, mode: LotMode) => {
      setLotModes((prev) => ({ ...prev, [lot]: mode }));
      try {
        await api.saveSettings({ lotModes: { ...lotModes, [lot]: mode } });
      } catch (err) {
        console.warn('API save lotModes failed:', err);
      }
    },
    [lotModes]
  );

  /* ── Search & filters ── */
  const filteredMenages = useMemo(() => {
    let result = menagesWithGrappe;
    if (selectedRegion !== '__ALL__') {
      result = result.filter((m) => m.region === selectedRegion);
    }
    if (selectedGrappe) {
      result = result.filter((m) => m.grappe === Number(selectedGrappe));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.nom?.toLowerCase().includes(q) ||
          m.tel?.includes(q) ||
          m.village?.toLowerCase().includes(q) ||
          String(m.ordre).includes(q)
      );
    }
    return result;
  }, [menagesWithGrappe, selectedRegion, selectedGrappe, searchQuery]);

  const getEntrepreneur = useCallback(
    (lot: LotKey, region: string, grappe: number): EntrepreneurData => {
      return entrepreneurOf(lot, region, grappe, entrepreneurConfig, lotModes);
    },
    [entrepreneurConfig, lotModes]
  );

  /* ── Region summaries ── */
  const regionSummaries = useMemo((): RegionSummary[] => {
    return REGIONS.map((region) => {
      const regionMenages = menagesWithGrappe.filter((m) => m.region === region);
      const regionGrappes = serverConfig.grappes.filter((g) => g.region?.name === region);
      const grappes: GrappeSummary[] = regionGrappes.map((g) => {
        const grappeMenages = regionMenages.filter((m) => m.grappe === g.grappeNumber);
        const total = grappeMenages.length;
        let fait = 0,
          enCours = 0,
          bloque = 0,
          nonFait = 0,
          conforme = 0;
        for (const m of grappeMenages) {
          const e = entries[m.ordre];
          if (
            !e ||
            (e.A.status === 'non_fait' && e.B.status === 'non_fait' && e.C.status === 'non_fait')
          ) {
            nonFait++;
          } else if (e.conforme) {
            conforme++;
            fait++;
          } else {
            const statuses = [e.A.status, e.B.status, e.C.status];
            if (statuses.some((s) => s.startsWith('bloque_'))) {
              bloque++;
            } else if (statuses.some((s) => s === 'en_cours')) {
              enCours++;
            } else {
              fait++;
            }
          }
        }
        return {
          region,
          grappe: g.grappeNumber,
          key: g.grappeKey,
          total,
          fait,
          enCours,
          bloque,
          nonFait,
          conforme,
          pct: total > 0 ? Math.round((conforme / total) * 100) : 0,
        };
      });
      const total = regionMenages.length;
      const fait = regionMenages.filter((m) => {
        const e = entries[m.ordre];
        return (
          e?.conforme ||
          (e?.A.status !== 'non_fait' && e?.B.status !== 'non_fait' && e?.C.status !== 'non_fait')
        );
      }).length;
      const enCours = regionMenages.filter((m) => {
        const e = entries[m.ordre];
        return e && [e.A.status, e.B.status, e.C.status].some((s) => s === 'en_cours');
      }).length;
      const bloque = regionMenages.filter((m) => {
        const e = entries[m.ordre];
        return e && [e.A.status, e.B.status, e.C.status].some((s) => s?.startsWith('bloque_'));
      }).length;
      const nonFait = regionMenages.filter((m) => {
        const e = entries[m.ordre];
        return (
          !e ||
          (e.A.status === 'non_fait' && e.B.status === 'non_fait' && e.C.status === 'non_fait')
        );
      }).length;
      const conforme = regionMenages.filter((m) => entries[m.ordre]?.conforme).length;
      return {
        region,
        total,
        fait,
        enCours,
        bloque,
        nonFait,
        pct: total > 0 ? Math.round((conforme / total) * 100) : 0,
        grappes,
      };
    });
  }, [menagesWithGrappe, entries, serverConfig.grappes]);

  const globalSummary = useMemo(() => {
    const total = menagesWithGrappe.length;
    const conforme = menagesWithGrappe.filter((m) => entries[m.ordre]?.conforme).length;
    return { total, conforme, pourcentage: total > 0 ? Math.round((conforme / total) * 100) : 0 };
  }, [menagesWithGrappe, entries]);

  /* ── Import / Reset ── */
  const importExcelData = useCallback(async (file: File) => {
    // Implementation would parse Excel and call API
    console.warn('Import Excel not yet implemented for unified API');
  }, []);

  const resetAllData = useCallback(async () => {
    try {
      // Call API to reset all data
      await api.saveSettings({ reset: true });
      window.location.reload();
    } catch (err) {
      console.error('Reset failed:', err);
    }
  }, []);

  /* ── Prestataire CRUD ── */
  const updatePrestataires = useCallback((prestas: Prestataire[]) => {
    setPrestataires(prestas);
  }, []);

  const importPrestatairesExcel = useCallback(async (file: File) => {
    console.warn('Import prestataires Excel not yet implemented for unified API');
  }, []);

  const createPrestataire = useCallback(async (p: Omit<Prestataire, 'id'>) => {
    try {
      const result = await api.savePrestataires([p]);
      setPrestataires((prev) => [...prev, result]);
    } catch (err) {
      console.error('Create prestataire failed:', err);
    }
  }, []);

  const updatePrestataire = useCallback(async (id: string, p: Partial<Prestataire>) => {
    try {
      await api.updatePrestataire(parseInt(id), p);
      setPrestataires((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));
    } catch (err) {
      console.error('Update prestataire failed:', err);
    }
  }, []);

  const deletePrestataire = useCallback(async (id: string) => {
    try {
      await api.deletePrestataire(parseInt(id));
      setPrestataires((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error('Delete prestataire failed:', err);
    }
  }, []);

  /* ── Global backup / sync ── */
  const importGlobalBackup = useCallback(async (json: string) => {
    console.warn('Import backup not yet implemented for unified API');
  }, []);

  const initializeServerData = useCallback(async () => {
    try {
      await api.initializeDefaultData();
      syncEventBus.publish('carto:refresh', {});
    } catch (err) {
      console.error('Initialize server data failed:', err);
    }
  }, []);

  const refreshDashboardStats = useCallback(async () => {
    try {
      const stats = await api.fetchDashboardStats();
      setDashboardStats(stats);
    } catch (err) {
      console.warn('Refresh dashboard stats failed:', err);
    }
  }, []);

  return {
    loading,
    activeTab,
    setActiveTab,
    villages,
    menages: menagesWithGrappe,
    gps,
    entries,
    getEntry,
    updateEntry,
    updateConforme,
    updateObs,
    entrepreneurConfig,
    updateEntrepreneurConfig,
    syncEntrepreneursToAPI,
    lotModes,
    updateLotMode,
    selectedRegion,
    setSelectedRegion,
    selectedGrappe,
    setSelectedGrappe,
    selectedLot,
    setSelectedLot,
    searchQuery,
    setSearchQuery,
    regionSummaries,
    globalSummary,
    filteredMenages,
    getEntrepreneur,
    history,
    loadHistory: () => {},
    prestataires,
    updatePrestataires,
    importPrestatairesExcel,
    createPrestataire,
    updatePrestataire,
    deletePrestataire,
    importGlobalBackup,
    importExcelData,
    resetAllData,
    dashboardStats,
    refreshDashboardStats,
    initializeServerData,
    serverConfig,
  };
}
