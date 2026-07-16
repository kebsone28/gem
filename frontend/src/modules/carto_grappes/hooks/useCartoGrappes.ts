import { useState, useCallback, useEffect, useMemo } from 'react';
import { syncEventBus } from '../../../utils/syncEventBus';
import type {
  Village, Menage, GpsEntry, GpsData, LotKey, LotMode, StatusValue,
  MenageEntry, EntrepreneurData, EntrepreneurConfig, LotConfig,
  GrappeSummary, RegionSummary, TabKey, HistoryEntry, Prestataire,
} from '../types';
import { GRAPPE_COLORS, REGIONS, GRAPPE_COUNT } from '../constants';
import * as api from './carto_grappes.service';
import { kmeansCluster, projectCoordinatesToSVG } from '../engine/excelEngine';

// ── Server Configuration State ────────────────────────────────────────────

interface ServerConfig {
  regions: { id: string; name: string; code: string; active: boolean }[];
  grappes: { id: string; regionId: string; grappeNumber: number; grappeKey: string; menageCount: number; active: boolean; region?: any }[];
  lots: { id: string; lotKey: string; title: string; description: string | null; active: boolean }[];
  entrepreneurs?: { id: string; organizationId: string; lot: string; grappeKey: string | null; mode: string; entreprise: string; societe: string }[];
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
  lotStats: Record<string, { total: number; assigned: number; global: number; group: number; individual: number }>;
  regionStats: Record<string, { total: number; assigned: number }>;
  prestataireUsage: Record<string, number>;
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
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
    entreprise: (o && 'entreprise' in o ? (o as EntrepreneurData).entreprise : '') || 'À définir',
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
  lot: LotKey, region: string, grappe: number,
  config: EntrepreneurConfig, modes: Record<LotKey, LotMode>,
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
  const [entrepreneurConfig, setEntrepreneurConfig] = useState<EntrepreneurConfig>(
    { A: {}, B: {}, C: {} } as EntrepreneurConfig,
  );
  const [lotModes, setLotModes] = useState<Record<LotKey, LotMode>>({
    A: 'individuel', B: 'individuel', C: 'individuel',
  });
  const [villageOverrides, setVillageOverrides] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  
  // Server configuration state
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    regions: [],
    grappes: [],
    lots: []
  });

  // Dashboard stats from server
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  /* ── Load everything from API on mount ── */
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        // Load reference data from API first, fallback to localStorage/json
        let localV = loadJSON<Village[]>('proquelec_villages', []);
        let localM = loadJSON<Menage[]>('proquelec_menages', []);
        let localGps = loadJSON<GpsEntry>('proquelec_gps', {});
        let localP = loadJSON<Prestataire[]>('proquelec_prestataires', []);

        // Try to fetch from API
        const [apiVillages, apiMenages, apiGps, apiPrestataires, apiRegions, apiGrappes, apiLots] = await Promise.allSettled([
          api.fetchVillages(),
          api.fetchMenages(),
          api.fetchGps(),
          api.fetchPrestataires(),
          api.fetchRegions(),
          api.fetchGrappes(),
          api.fetchLots(),
        ]);

        if (apiVillages.status === 'fulfilled' && apiVillages.value.length > 0) {
          localV = apiVillages.value;
          saveJSON('proquelec_villages', localV);
        } else if (localV.length === 0) {
          localV = await fetch('/archive/Liste/villages.json').then(r => r.json()) as Promise<Village[]>;
          saveJSON('proquelec_villages', localV);
        }

        if (apiMenages.status === 'fulfilled' && apiMenages.value.length > 0) {
          localM = apiMenages.value;
          saveJSON('proquelec_menages', localM);
        } else if (localM.length === 0) {
          localM = await fetch('/archive/Liste/menages.json').then(r => r.json()) as Promise<Menage[]>;
          saveJSON('proquelec_menages', localM);
        }

        if (apiGps.status === 'fulfilled' && Object.keys(apiGps.value).length > 0) {
          // Convert array to object format expected by frontend
          const gpsObj: GpsEntry = {};
          for (const g of apiGps.value as GpsData[]) {
            gpsObj[g.ordre] = [g.lat, g.lon, g.accuracy];
          }
          localGps = gpsObj;
          saveJSON('proquelec_gps', localGps);
        } else if (Object.keys(localGps).length === 0) {
          localGps = await fetch('/archive/Liste/gps.json').then(r => r.json()) as Promise<GpsEntry>;
          saveJSON('proquelec_gps', localGps);
        }

        if (apiPrestataires.status === 'fulfilled' && apiPrestataires.value.length > 0) {
          // Transform API data to match PrestatairesDB structure
          localP = apiPrestataires.value.map((p: any) => ({
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
          saveJSON('proquelec_prestataires', localP);
        } else if (localP.length === 0) {
          // No prestataires - start with empty list (no hardcoded data)
          localP = [];
          saveJSON('proquelec_prestataires', localP);
        }

        if (cancelled) return;
        setVillages(localV);
        setMenages(localM);
        setGps(localGps);
        setPrestataires(localP);
        
        // Fetch dashboard stats from server
        try {
          const stats = await api.fetchDashboardStats();
          setDashboardStats(stats);
        } catch (err) {
          console.warn('Failed to fetch dashboard stats from server:', err);
        }

        const [apiEntries, apiOverrides, apiEntConfig, apiSettings] = await Promise.allSettled([
          api.fetchEntries(),
          api.fetchVillageOverrides(),
          api.fetchEntrepreneurs(),
          api.fetchSettings(),
        ]);

        if (cancelled) return;

        // Set server configuration (including entrepreneurs for assignment table)
        setServerConfig({
          regions: apiRegions.status === 'fulfilled' ? apiRegions.value : [],
          grappes: (apiGrappes.status === 'fulfilled' ? apiGrappes.value : []).map((grappe: any) => {
            const regionsArr = apiRegions.status === 'fulfilled' ? apiRegions.value : [];
            const region = regionsArr.find((r: any) => r.id === grappe.regionId);
            return { ...grappe, region };
          }),
          lots: apiLots.status === 'fulfilled' ? apiLots.value : [],
          entrepreneurs: apiEntConfig.status === 'fulfilled' ? apiEntConfig.value : [],
        });

        if (apiEntries.status === 'fulfilled') {
          const apiMap: Record<number, MenageEntry> = {};
          for (const [ordreStr, raw] of Object.entries(apiEntries.value)) {
            const ordre = Number(ordreStr);
            apiMap[ordre] = {
              A: { status: raw.A?.status || 'non_fait', justif: raw.A?.justif || '', updatedAt: raw.A?.updatedAt || null },
              B: { status: raw.B?.status || 'non_fait', justif: raw.B?.justif || '', updatedAt: raw.B?.updatedAt || null },
              C: { status: raw.C?.status || 'non_fait', justif: raw.C?.justif || '', updatedAt: raw.C?.updatedAt || null },
              conforme: raw.conforme || false,
              obs: raw.obs || '',
            };
          }
          setEntries(apiMap);
        }

        if (apiOverrides.status === 'fulfilled') {
          setVillageOverrides(apiOverrides.value);
        }

        if (apiEntConfig.status === 'fulfilled' && apiEntConfig.value.length > 0) {
          const config: EntrepreneurConfig = { A: {}, B: {}, C: {} } as EntrepreneurConfig;
          for (const e of apiEntConfig.value) {
            const lot = e.lot as LotKey;
            const data: EntrepreneurData = {
              entreprise: e.entreprise, societe: e.societe,
              telephone: e.telephone, email: e.email, adresse: e.adresse,
            };
            if (e.mode === 'global') {
              config[lot].__global = data;
            } else if (e.mode === 'groupe' && e.groupId) {
              if (!config[lot].__groupes) config[lot].__groupes = [];
              const existing = config[lot].__groupes!.find(gr => gr.id === e.groupId);
              if (existing) {
                existing.grappes = existing.grappes || [];
                if (e.grappeKey && !existing.grappes.includes(e.grappeKey)) existing.grappes.push(e.grappeKey);
                Object.assign(existing, data);
              } else {
                config[lot].__groupes!.push({ ...data, id: e.groupId, grappes: e.grappeKey ? [e.grappeKey] : [] });
              }
            } else if (e.grappeKey) {
              config[lot][e.grappeKey] = data;
            }
          }
          setEntrepreneurConfig(config);
        }

        if (apiSettings.status === 'fulfilled' && apiSettings.value.lotModes) {
          setLotModes(apiSettings.value.lotModes as Record<LotKey, LotMode>);
        }
      } catch (e) {
        console.error('Failed to load carto data:', e);
        // Fallback to localStorage for offline
        const lsEntries = loadJSON<Record<number, MenageEntry>>('proquelec_suivi_v2', {});
        if (Object.keys(lsEntries).length > 0) setEntries(lsEntries);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  /* ── WebSocket real-time updates ── */
  useEffect(() => {
    const unsubEntries = syncEventBus.subscribe('carto:entries:updated', () => {
      api.fetchEntries().then((apiEntries) => {
        const apiMap: Record<number, MenageEntry> = {};
        for (const [ordreStr, raw] of Object.entries(apiEntries)) {
          const ordre = Number(ordreStr);
          apiMap[ordre] = {
            A: { status: raw.A?.status || 'non_fait', justif: raw.A?.justif || '', updatedAt: raw.A?.updatedAt || null },
            B: { status: raw.B?.status || 'non_fait', justif: raw.B?.justif || '', updatedAt: raw.B?.updatedAt || null },
            C: { status: raw.C?.status || 'non_fait', justif: raw.C?.justif || '', updatedAt: raw.C?.updatedAt || null },
            conforme: raw.conforme || false,
            obs: raw.obs || '',
          };
        }
        setEntries(apiMap);
      }).catch(() => {});
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
            const data = { entreprise: e.entreprise, societe: e.societe, telephone: e.telephone, email: e.email, adresse: e.adresse };
            if (e.mode === 'global') { config[lot].__global = data; }
            else if (e.grappeKey) { config[lot][e.grappeKey] = data; }
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
  const grappeOf = useCallback((region: string, villageName: string): number => {
    const k = villageKey(region, villageName);
    if (villageOverrides[k] !== undefined) return villageOverrides[k];
    const v = villages.find(x => x.region === region && x.village === villageName);
    return v ? v.defaultGrappe : 1;
  }, [villages, villageOverrides]);

  // Assigner des grappes basées sur une distribution équilibrée par région
  const assignGrappesToMenages = useCallback((menagesList: Menage[]): Menage[] => {
    const regionGrappes: Record<string, number[]> = {};
    
    // Initialiser les compteurs de grappes pour chaque région
    REGIONS.forEach(region => {
      const targetGrappes = GRAPPE_COUNT[region] || 3;
      regionGrappes[region] = Array.from({ length: targetGrappes }, (_, i) => 0);
    });
    
    // Assigner les grappes en utilisant villageGrappeMap ou defaultGrappe
    return menagesList.map(m => {
      const v = villages.find(x => x.region === m.region && x.village === m.village);
      const defaultGrappe = v?.defaultGrappe || 1;
      const grappe = defaultGrappe;
      
      // Incrémenter le compteur
      if (regionGrappes[m.region]) {
        regionGrappes[m.region][grappe - 1] = (regionGrappes[m.region][grappe - 1] || 0) + 1;
      }
      
      return { ...m, grappe };
    });
  }, [villages, GRAPPE_COUNT]);

  const menagesWithGrappe = useMemo(() => {
    const newMenages = assignGrappesToMenages(menages);
    return newMenages;
  }, [menages, assignGrappesToMenages]);

  /* ── Entry CRUD ── */
  const getEntry = useCallback((ordre: number): MenageEntry => {
    if (!entries[ordre]) return createDefaultEntry();
    return entries[ordre];
  }, [entries]);

  const updateEntry = useCallback(async (ordre: number, lot: LotKey, status: StatusValue, justif: string) => {
    const existing = entries[ordre] || createDefaultEntry();
    const fromStatus = existing[lot].status;
    setEntries(prev => ({
      ...prev,
      [ordre]: { ...existing, [lot]: { status, justif, updatedAt: new Date().toISOString() } },
    }));
    const m = menagesWithGrappe.find(x => x.ordre === ordre);
    try {
      await api.saveEntry(ordre, lot, status, justif, {
        nom: m?.nom, village: m?.village, region: m?.region, fromStatus,
      });
    } catch (err) {
      console.warn('API save failed:', err);
    }
  }, [menagesWithGrappe, entries]);

  const updateConforme = useCallback(async (ordre: number, conforme: boolean) => {
    const existing = entries[ordre] || createDefaultEntry();
    setEntries(prev => ({
      ...prev,
      [ordre]: { ...existing, conforme },
    }));
    try {
      await api.saveConforme(ordre, conforme);
    } catch (err) {
      console.warn('API save conforme failed:', err);
    }
  }, [entries]);

  const updateObs = useCallback(async (ordre: number, obs: string) => {
    const existing = entries[ordre] || createDefaultEntry();
    setEntries(prev => ({
      ...prev,
      [ordre]: { ...existing, obs },
    }));
    try {
      await api.saveObs(ordre, obs);
    } catch (err) {
      console.warn('API save obs failed:', err);
    }
  }, [entries]);

  /* ── Entrepreneur CRUD ── */
  const updateEntrepreneurConfig = useCallback((config: EntrepreneurConfig) => {
    setEntrepreneurConfig(config);
  }, []);

  const syncEntrepreneursToAPI = useCallback(async (config?: EntrepreneurConfig) => {
    const cfg = config || entrepreneurConfig;
    const promises: Promise<unknown>[] = [];
    for (const lot of ['A', 'B', 'C'] as LotKey[]) {
      const lotCfg = cfg[lot];
      if (lotCfg.__global) {
        promises.push(api.saveEntrepreneur({
          lot, grappeKey: '__global', mode: 'global',
          entreprise: lotCfg.__global.entreprise,
          societe: lotCfg.__global.societe,
          telephone: lotCfg.__global.telephone,
          email: lotCfg.__global.email,
          adresse: lotCfg.__global.adresse,
        }));
      }
      if (lotCfg.__groupes) {
        for (const grp of lotCfg.__groupes) {
          for (const gk of grp.grappes || []) {
            promises.push(api.saveEntrepreneur({
              lot, grappeKey: gk, mode: 'groupe', groupId: grp.id,
              entreprise: grp.entreprise, societe: grp.societe,
              telephone: grp.telephone, email: grp.email, adresse: grp.adresse,
            }));
          }
        }
      }
      for (const [key, data] of Object.entries(lotCfg)) {
        if (key.startsWith('__')) continue;
        const d = data as EntrepreneurData;
        if (d?.entreprise) {
          promises.push(api.saveEntrepreneur({
            lot, grappeKey: key, mode: 'individuel',
            entreprise: d.entreprise, societe: d.societe,
            telephone: d.telephone, email: d.email, adresse: d.adresse,
          }));
        }
      }
    }
    await Promise.allSettled(promises);
  }, [entrepreneurConfig]);

  /* ── Lot mode ── */
  const updateLotMode = useCallback(async (lot: LotKey, mode: LotMode) => {
    const next = { ...lotModes, [lot]: mode };
    setLotModes(next);
    try {
      await api.saveSettings({ lotModes: next });
    } catch (err) {
      console.warn('API save lotModes failed:', err);
    }
  }, [lotModes]);

  /* ── Village overrides ── */
  const setVillageOverride = useCallback(async (vKey: string, grappeNumber: number) => {
    setVillageOverrides(prev => ({ ...prev, [vKey]: grappeNumber }));
    try {
      await api.saveVillageOverride(vKey, grappeNumber);
    } catch (err) {
      console.warn('API save override failed:', err);
    }
  }, []);

  /* ── History ── */
  const loadHistory = useCallback(async () => {
    try {
      const h = await api.fetchHistory(500);
      setHistory(Array.isArray(h) ? h : []);
    } catch { /* ignore */ }
  }, []);

  /* ── Computed summaries ── */
  const regionSummaries = useMemo<RegionSummary[]>(() => {
    return REGIONS.map(region => {
      const regionMenages = menagesWithGrappe.filter(m => m.region === region);
      const grappes: GrappeSummary[] = [];
      
      // Pour chaque grappe (1 à N selon la région)
      const targetGrappes = GRAPPE_COUNT[region] || 3;
      for (let g = 1; g <= targetGrappes; g++) {
        const grappeMenages = regionMenages.filter(m => m.grappe === g);
        let fait = 0, enCours = 0, bloque = 0, nonFait = 0, conforme = 0;

        for (const m of grappeMenages) {
          const entry = getEntry(m.ordre);
          const lots: LotKey[] = ['A', 'B', 'C'];
          let allFait = true;
          let anyBlocked = false;
          let anyEnCours = false;
          let anyNonFait = false;

          for (const lot of lots) {
            const s = entry[lot].status;
            if (s === 'fait') { /* ok */ }
            else if (s === 'en_cours') { anyEnCours = true; allFait = false; }
            else if (s.startsWith('bloque_')) { anyBlocked = true; allFait = false; }
            else { anyNonFait = true; allFait = false; }
          }

          if (allFait) fait++;
          else if (anyBlocked) bloque++;
          else if (anyEnCours) enCours++;
          else nonFait++;
          if (entry.conforme) conforme++;
        }

        const total = grappeMenages.length;
        grappes.push({
          region, grappe: g, key: `${region}_${g}`,
          total, fait, enCours, bloque, nonFait, conforme,
          pct: total > 0 ? Math.round((fait / total) * 100) : 0,
        });
      }

      const totalMenages = regionMenages.length;
      const fait = grappes.reduce((s, g) => s + g.fait, 0);
      const enCours = grappes.reduce((s, g) => s + g.enCours, 0);
      const bloque = grappes.reduce((s, g) => s + g.bloque, 0);
      const nonFait = grappes.reduce((s, g) => s + g.nonFait, 0);

      return {
        region, total: totalMenages, fait, enCours, bloque, nonFait,
        pct: totalMenages > 0 ? Math.round((fait / totalMenages) * 100) : 0,
        grappes,
      };
    });
  }, [menagesWithGrappe, getEntry, GRAPPE_COUNT]);

  const globalSummary = useMemo(() => {
    const total = regionSummaries.reduce((s, r) => s + r.total, 0);
    const fait = regionSummaries.reduce((s, r) => s + r.fait, 0);
    const enCours = regionSummaries.reduce((s, r) => s + r.enCours, 0);
    const bloque = regionSummaries.reduce((s, r) => s + r.bloque, 0);
    const nonFait = regionSummaries.reduce((s, r) => s + r.nonFait, 0);
    return { total, fait, enCours, bloque, nonFait, pct: total > 0 ? Math.round((fait / total) * 100) : 0 };
  }, [regionSummaries]);

  const filteredMenages = useMemo(() => {
    let result = menagesWithGrappe;
    if (selectedRegion !== '__ALL__') {
      result = result.filter(m => m.region === selectedRegion);
    }
    if (selectedGrappe) {
      const [reg, grp] = selectedGrappe.split('_');
      result = result.filter(m => m.region === reg && m.grappe === Number(grp));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.nom.toLowerCase().includes(q) ||
        m.tel.includes(q) ||
        String(m.ordre).includes(q) ||
        m.village.toLowerCase().includes(q),
      );
    }
    return result;
  }, [menagesWithGrappe, selectedRegion, selectedGrappe, searchQuery]);

  const getEntrepreneur = useCallback((lot: LotKey, region: string, grappe: number) => {
    return entrepreneurOf(lot, region, grappe, entrepreneurConfig, lotModes);
  }, [entrepreneurConfig, lotModes]);

  const importExcelData = useCallback(async (sheetRows: any[][]) => {
    if (sheetRows.length < 2) return { added: 0, updated: 0 };
    const headers = sheetRows[0].map(h => String(h || '').trim());
    const dataRows = sheetRows.slice(1);

    // Map headers dynamically
    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = h.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/[ée]/g, 'e');
      colMap[key] = i;
    });

    const getVal = (row: any[], keys: string[]): string => {
      for (const k of keys) {
        if (colMap[k] !== undefined) return String(row[colMap[k]] || '').trim();
      }
      return '';
    };

    const updatedMenages = [...menages];
    const updatedGps = { ...gps };
    const updatedVillages = [...villages];

    let addedCount = 0;
    let updatedCount = 0;

    dataRows.forEach(row => {
      const region = getVal(row, ['region', 'reg']);
      const village = getVal(row, ['village', 'vill']);
      if (!region || !village) return;

      const orderStr = getVal(row, ['numeroordre', 'numero_ordre', 'nordre', 'numero', 'ordre']);
      let order = Number(orderStr);
      if (isNaN(order) || !orderStr) {
        order = Math.max(...updatedMenages.map(m => m.ordre), 0) + 1;
      }

      const nom = getVal(row, ['prenometnom', 'nom', 'nomprenom', 'name']) || `Ménage ${order}`;
      const tel = getVal(row, ['telephone', 'telephon', 'tel']);
      const commune = getVal(row, ['commune', 'comm']);

      // Lat / Lon
      const latStr = getVal(row, ['latitude', 'lat']);
      const lonStr = getVal(row, ['longitude', 'lon', 'lng', 'long']);
      const lat = parseFloat(latStr.replace(',', '.'));
      const lon = parseFloat(lonStr.replace(',', '.'));

      let existingIndex = updatedMenages.findIndex(m => m.ordre === order);
      if (existingIndex === -1) {
        existingIndex = updatedMenages.findIndex(m => m.village === village && m.region === region && m.nom === nom);
      }

      const defaultGrappe = Number(getVal(row, ['grappe', 'defaultgrappe'])) || 1;

      if (existingIndex > -1) {
        updatedMenages[existingIndex] = {
          ...updatedMenages[existingIndex],
          nom,
          tel,
          village,
          commune,
          region,
        };
        updatedCount++;
      } else {
        updatedMenages.push({
          ordre: order,
          nom,
          tel,
          village,
          commune,
          region,
        });
        addedCount++;
      }

      if (!isNaN(lat) && !isNaN(lon)) {
        updatedGps[order.toString()] = [lat, lon, 0];
      }

      // Check if village already exists
      const vIndex = updatedVillages.findIndex(v => v.village === village && v.region === region);
      if (vIndex === -1) {
        updatedVillages.push({
          region,
          village,
          n: 1,
          lat: !isNaN(lat) ? lat : 14.0,
          lon: !isNaN(lon) ? lon : -15.0,
          defaultGrappe,
          x: 0,
          y: 0,
          r: 5,
        });
      } else {
        const v = updatedVillages[vIndex];
        v.n = updatedMenages.filter(m => m.village === village && m.region === region).length;
        if (!isNaN(lat) && !isNaN(lon)) {
          v.lat = lat;
          v.lon = lon;
        }
      }
    });

    // Recalculate default grappes / counts
    updatedVillages.forEach(v => {
      v.n = updatedMenages.filter(m => m.village === v.village && m.region === v.region).length;
      v.r = Math.max(5, Math.min(26, 5 + v.n * 0.2));
    });

    // Re-project village coordinates to SVG
    const regions = Array.from(new Set(updatedVillages.map(v => v.region)));
    regions.forEach(reg => {
      const regVillages = updatedVillages.filter(v => v.region === reg);
      const projected = projectCoordinatesToSVG(regVillages, 600, 600);
      regVillages.forEach((v, idx) => {
        v.x = projected[idx].x;
        v.y = projected[idx].y;
      });
    });

    setMenages(updatedMenages);
    setVillages(updatedVillages);
    setGps(updatedGps);

    saveJSON('proquelec_menages', updatedMenages);
    saveJSON('proquelec_villages', updatedVillages);
    saveJSON('proquelec_gps', updatedGps);

    return { added: addedCount, updated: updatedCount };
  }, [menages, villages, gps]);

  const resetAllData = useCallback(async () => {
    localStorage.removeItem('proquelec_villages');
    localStorage.removeItem('proquelec_menages');
    localStorage.removeItem('proquelec_gps');

    const [v, m, g] = await Promise.all([
      fetch('/archive/Liste/villages.json').then(r => r.json()) as Promise<Village[]>,
      fetch('/archive/Liste/menages.json').then(r => r.json()) as Promise<Menage[]>,
      fetch('/archive/Liste/gps.json').then(r => r.json()) as Promise<GpsEntry>,
    ]);

    setVillages(v);
    setMenages(m);
    setGps(g);

    saveJSON('proquelec_villages', v);
    saveJSON('proquelec_menages', m);
    saveJSON('proquelec_gps', g);
  }, []);

  const importGlobalBackup = useCallback((backup: any) => {
    if (!backup || typeof backup !== 'object') return false;

    if (backup.villages) {
      setVillages(backup.villages);
      saveJSON('proquelec_villages', backup.villages);
    }
    if (backup.menages) {
      setMenages(backup.menages);
      saveJSON('proquelec_menages', backup.menages);
    }
    if (backup.gps) {
      setGps(backup.gps);
      saveJSON('proquelec_gps', backup.gps);
    }
    if (backup.entrepreneurConfig) {
      setEntrepreneurConfig(backup.entrepreneurConfig);
      syncEntrepreneursToAPI(backup.entrepreneurConfig);
    }
    if (backup.lotModes) {
      setLotModes(backup.lotModes);
      api.saveSettings({ lotModes: backup.lotModes });
    }
    if (backup.villageOverrides) {
      setVillageOverrides(backup.villageOverrides);
      Object.entries(backup.villageOverrides).forEach(([k, g]) => {
        api.saveVillageOverride(k, Number(g));
      });
    }
    return true;
  }, [syncEntrepreneursToAPI]);

  const updatePrestataires = useCallback(async (list: Prestataire[], skipApiSync = false) => {
    setPrestataires(list);
    saveJSON('proquelec_prestataires', list);
    if (!skipApiSync) {
      try {
        await api.savePrestataires(list.map(p => ({
          id: p.id,
          nom: p.nom || p.entreprise || '',
          entreprise: p.entreprise || p.nom || '',
          societe: p.societe || '',
          telephone: p.telephone || '',
          email: p.email || '',
          adresse: p.adresse || '',
          lot: p.lot || '',
          region: p.region || '',
        })));
      } catch (err) {
        console.error('[updatePrestataires] API save failed:', err);
      }
    }
  }, []);

  const createPrestataire = useCallback(async (prestataire: Prestataire) => {
    const newList = [...prestataires, { ...prestataire, id: Date.now() }];
    await updatePrestataires(newList);
    return prestataire;
  }, [prestataires, updatePrestataires]);

  const updatePrestataire = useCallback(async (id: string | number, updated: Prestataire) => {
    const newList = prestataires.map(p => 
      p.id === id ? { ...updated, id } : p
    );
    await updatePrestataires(newList);
  }, [prestataires, updatePrestataires]);

  const deletePrestataire = useCallback(async (id: string | number) => {
    const newList = prestataires.filter(p => p.id !== id);
    await updatePrestataires(newList);
  }, [prestataires, updatePrestataires]);

  const importPrestatairesExcel = useCallback(async (rows: any[][]) => {
    try {
      if (!rows || !Array.isArray(rows) || rows.length < 2) {
        return { added: 0 };
      }

      // Validate first row has at least one non-empty cell (header)
      const firstRow = rows[0];
      if (!Array.isArray(firstRow) || firstRow.length === 0) {
        console.warn('[importPrestataires] First row is empty or invalid');
        return { added: 0 };
      }

      const header = firstRow
        .map((h: any) => (h != null ? String(h).trim().toLowerCase() : ''))
        .filter(Boolean);

      const idxCompany = header.findIndex(
        (h: string) => h.includes('entreprise') || h.includes('nom') || h.includes('company') || h.includes('prestataire'),
      );
      const idxSociete = header.findIndex(
        (h: string) => h.includes('société') || h.includes('societe') || h.includes('responsable'),
      );
      const idxPhone = header.findIndex(
        (h: string) => h.includes('téléphone') || h.includes('tel') || h.includes('phone'),
      );
      const idxEmail = header.findIndex(
        (h: string) => h.includes('mail') || h.includes('email'),
      );
      const idxAddr = header.findIndex(
        (h: string) => h.includes('adresse') || h.includes('address'),
      );

      if (idxCompany === -1) {
        console.warn('[importPrestataires] Column "Nom Entreprise" not found in header:', header);
        return { added: 0 };
      }

      const newPrestas: Prestataire[] = [];
      let added = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const cellValue = (idx: number): string =>
          idx !== -1 && idx < row.length ? String(row[idx] ?? '').trim() : '';

        const entreprise = cellValue(idxCompany);
        if (!entreprise) continue;

        newPrestas.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          entreprise,
          societe: cellValue(idxSociete),
          telephone: cellValue(idxPhone),
          email: cellValue(idxEmail),
          adresse: cellValue(idxAddr),
        });
        added++;
      }

      if (newPrestas.length > 0) {
        const merged = [...prestataires];
        for (const np of newPrestas) {
          const dupIdx = merged.findIndex(
            p => (p.entreprise ?? '').toLowerCase() === np.entreprise.toLowerCase(),
          );
          if (dupIdx !== -1) {
            merged[dupIdx] = { ...merged[dupIdx], ...np, id: merged[dupIdx].id };
          } else {
            merged.push(np);
          }
        }
        setPrestataires(merged);
        saveJSON('proquelec_prestataires', merged);
        try {
          await api.savePrestataires(merged.map(p => ({
            id: p.id,
            nom: p.nom || p.entreprise || '',
            entreprise: p.entreprise || p.nom || '',
            societe: p.societe || '',
            telephone: p.telephone || '',
            email: p.email || '',
            adresse: p.adresse || '',
            lot: p.lot || '',
            region: p.region || '',
          })));
        } catch (err) {
          console.error('[importPrestataires] API save failed:', err);
        }
      }
      return { added };
    } catch (err) {
      console.error('[importPrestataires] Unexpected error:', err);
      throw err;
    }
  }, []);

  /* ── Initialize Server Data ── */
  const initializeServerData = useCallback(async () => {
    try {
      await api.initializeDefaultData();
      // Refresh server config after initialization
      const [regions, grappes, lots, entrepreneurs] = await Promise.all([
        api.fetchRegions(),
        api.fetchGrappes(),
        api.fetchLots(),
        api.fetchEntrepreneurs().catch(() => []), // Utiliser la fonction existante
      ]);
      
      // Enrichir les grappes avec les informations de région
      const grappesWithRegion = grappes.map(grappe => {
        const region = regions.find(r => r.id === grappe.regionId);
        return { ...grappe, region };
      });
      
      setServerConfig({
        regions,
        grappes: grappesWithRegion,
        lots,
        entrepreneurs
      });
      // Refresh dashboard stats
      const stats = await api.fetchDashboardStats();
      setDashboardStats(stats);
    } catch (err) {
      console.error('Failed to initialize server data:', err);
    }
  }, []);

  /* ── Refresh Dashboard Stats ── */
  const refreshDashboardStats = useCallback(async () => {
    try {
      const stats = await api.fetchDashboardStats();
      setDashboardStats(stats);
    } catch (err) {
      console.error('Failed to refresh dashboard stats:', err);
    }
  }, []);

  return {
    loading,
    activeTab, setActiveTab,
    villages, menages: menagesWithGrappe, gps,
    entries, getEntry, updateEntry, updateConforme, updateObs,
    entrepreneurConfig, updateEntrepreneurConfig, syncEntrepreneursToAPI,
    lotModes, updateLotMode,
    villageOverrides, setVillageOverride,
    selectedRegion, setSelectedRegion,
    selectedGrappe, setSelectedGrappe,
    selectedLot, setSelectedLot,
    searchQuery, setSearchQuery,
    regionSummaries, globalSummary,
    filteredMenages,
    getEntrepreneur,
    history, loadHistory,
    importExcelData, resetAllData, importGlobalBackup,
    prestataires, updatePrestataires, importPrestatairesExcel,
    createPrestataire, updatePrestataire, deletePrestataire,
    serverConfig, initializeServerData,
    dashboardStats, refreshDashboardStats,
  };
}
