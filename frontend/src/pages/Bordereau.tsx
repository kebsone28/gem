import { useState, useEffect, useDeferredValue, useRef, useCallback, memo } from 'react';
import type { CSSProperties } from 'react';
import {
  Printer,
  FileSpreadsheet,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  MapPin,
  Users,
  Zap,
  CheckCircle2,
  Search,
  Package,
  TrendingUp,
  Eye,
  X,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { generateGrappePDF, generateGrappeExcel } from '../services/bordereauGenerator';
import { useProject } from '../contexts/ProjectContext';
import { db } from '../store/db';
import { useSyncListener } from '../hooks/useSyncListener';
import { fmtNum } from '../utils/format';
import logger from '../utils/logger';
import type { Household } from '../utils/types';
import { HouseholdListView } from '../components/terrain/HouseholdListView';
import { useTerrainUIStore } from '../store/terrainUIStore';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';

// Import centralized design system
import { PageContainer, PageHeader, ContentArea, ActionBar } from '../components';
import {
  DASHBOARD_ACCENT_SURFACE,
  DASHBOARD_INPUT,
  DASHBOARD_MINI_STAT_CARD,
  DASHBOARD_PRIMARY_BUTTON,
  DASHBOARD_SECTION_SURFACE,
} from '../components/dashboards/DashboardComponents';

const Bordereau = () => {
  const navigate = useNavigate();
  const { project } = useProject();
  const setSelectedHouseholdId = useTerrainUIStore((s) => s.setSelectedHouseholdId);
  const projectId = project?.id || null;

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState({ grappes: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});
  const [detailGrappe, setDetailGrappe] = useState<any | null>(null);
  const [detailHouseholds, setDetailHouseholds] = useState<Household[]>([]);
  const [detailSearchQuery, setDetailSearchQuery] = useState('');
  const deferredDetailSearchQuery = useDeferredValue(detailSearchQuery);

  const [detailLoading, setDetailLoading] = useState(false);

  // Worker States
  const [workerData, setWorkerData] = useState<{
    groupedData: Record<string, any[]>;
    filteredRegions: string[];
    stats: any;
  }>({
    groupedData: {},
    filteredRegions: [],
    stats: { total: 0, delivered: 0, pending: 0, pct: 0, critical: 0 }
  });
  const [filteredDetailHouseholds, setFilteredDetailHouseholds] = useState<Household[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Worker Instance
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Worker
    workerRef.current = new Worker(new URL('../services/bordereauWorker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e) => {
      const { action, result } = e.data;

      switch (action) {
        case 'GROUP_AND_FILTER_GRAPPES_RESULT':
          setWorkerData(prev => ({
            ...prev,
            groupedData: result.groupedData,
            filteredRegions: result.filteredRegions
          }));
          setIsProcessing(false);
          break;

        case 'CALCULATE_STATS_RESULT':
          setWorkerData(prev => ({ ...prev, stats: result }));
          break;

        case 'FILTER_HOUSEHOLDS_RESULT':
          setFilteredDetailHouseholds(result);
          setIsProcessing(false);
          break;
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!projectId) {
      setData({ grappes: [] });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (forceRefresh && db) {
        try {
          if (db.grappes && typeof db.grappes.clear === 'function') {
            await db.grappes.clear();
          }
          if (db.households && typeof db.households.clear === 'function') {
            await db.households.clear();
          }
          logger.debug('[BORDEREAU] Cache cleared');
        } catch (err) {
          logger.warn('[BORDEREAU] Could not clear cache:', err);
        }
      }

      const response = await api.get(`/projects/${projectId}/bordereau?_t=${Date.now()}`);
      const grappes = response.data.grappes || [];
      setData(response.data);

      // Trigger Worker for Stats and Initial Grouping
      workerRef.current?.postMessage({ action: 'CALCULATE_STATS', data: grappes });
      workerRef.current?.postMessage({
        action: 'GROUP_AND_FILTER_GRAPPES',
        data: grappes,
        params: { query: '' }
      });

      const regions = Array.from(
        new Set(grappes.map((g: any) => g.region || 'Sans Région'))
      );
      const initialExpanded: any = {};
      regions.forEach((r: any) => {
        initialExpanded[r] = true;
      });
      setExpandedRegions(initialExpanded);
    } catch (error) {
      logger.error('Error fetching bordereau:', error);
      toast.error('Erreur lors du chargement du bordereau');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId, fetchData]);

  // Offload heavy filtering to worker when query changes
  useEffect(() => {
    if (data.grappes.length > 0) {
      setIsProcessing(true);
      workerRef.current?.postMessage({
        action: 'GROUP_AND_FILTER_GRAPPES',
        data: data.grappes,
        params: { query: deferredSearchQuery }
      });
    }
  }, [deferredSearchQuery, data.grappes]);

  // Offload detail filtering to worker
  useEffect(() => {
    if (detailHouseholds.length > 0) {
      setIsProcessing(true);
      workerRef.current?.postMessage({
        action: 'FILTER_HOUSEHOLDS',
        data: detailHouseholds,
        params: { query: deferredDetailSearchQuery }
      });
    } else {
      setFilteredDetailHouseholds([]);
    }
  }, [deferredDetailSearchQuery, detailHouseholds]);

  useEffect(() => {
    if (!detailGrappe) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseGrappeDetails();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [detailGrappe]);

  useSyncListener((source) => {
    logger.debug(`[BORDEREAU] Data changed by ${source} - refreshing...`);
    if (source === 'kobo' || source === 'import') {
      fetchData(false);
      return;
    }
    fetchData(true);
  });

  const handleRecalculate = async () => {
    if (!projectId) {
      toast.error('Aucun projet actif valide sélectionné');
      return;
    }

    try {
      setSyncing(true);
      await api.post(`/projects/${projectId}/recalculate-grappes`);
      toast.success('Recalculation des grappes terminée !');
      await fetchData();
    } catch (error) {
      logger.error('Sync error:', error);
      toast.error('Erreur lors de la synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  const toggleRegion = (region: string) => {
    setExpandedRegions((prev: any) => ({
      ...prev,
      [region]: !prev[region],
    }));
  };

  const buildFallbackTeams = (households: any[]) => {
    const labels = new Set<string>();

    households.forEach((household: any) => {
      if (Array.isArray(household.assignedTeams)) {
        household.assignedTeams.forEach((entry: unknown) => {
          if (typeof entry === 'string' && entry.trim()) {
            labels.add(entry.trim());
          }
        });
      }
    });

    return Array.from(labels).map((label) => ({
      id: `fallback-${label}`,
      name: label,
      type: 'Affectation terrain',
    }));
  };

  const fetchHouseholdsForGrappe = async (grappe: any) => {
    const isUnclassified = String(grappe.id).startsWith('unclassified_');
    const response = await api.get('/households', {
      params: {
        projectId,
        grappeId: isUnclassified ? '__unclassified__' : grappe.id,
        limit: 10000,
      },
    });

    let households = response.data?.households || [];

    if (isUnclassified) {
      households = households.filter(
        (household: any) =>
          !household.grappeId &&
          (household.region || 'Sans Région') === (grappe.region || 'Sans Région')
      );
    }

    return households as Household[];
  };

  const handleOpenGrappeDetails = (grappe: any) => {
    const runOpen = async () => {
      try {
        setDetailLoading(true);
        setDetailSearchQuery('');
        setDetailGrappe(grappe);
        const households = await fetchHouseholdsForGrappe(grappe);
        setDetailHouseholds(households);
        // Worker will pick up detailHouseholds change
      } catch (err) {
        logger.error('Detail load error:', err);
        toast.error('Erreur lors du chargement des ménages');
        setDetailGrappe(null);
        setDetailHouseholds([]);
      } finally {
        setDetailLoading(false);
      }
    };

    void runOpen();
  };

  const handleCloseGrappeDetails = () => {
    setDetailGrappe(null);
    setDetailHouseholds([]);
    setDetailSearchQuery('');
    setDetailLoading(false);
  };

  const handleSelectHousehold = (household: Household) => {
    setSelectedHouseholdId(household.id);
    navigate('/terrain');
  };

  const handleExportGrappe = (grappe: any, format: string) => {
    const runExport = async () => {
      try {
        const households = await fetchHouseholdsForGrappe(grappe);

        const exportPayload = {
          ...grappe,
          teams:
            Array.isArray(grappe.teams) && grappe.teams.length > 0
              ? grappe.teams
              : buildFallbackTeams(households),
          households,
          householdCount: households.length || grappe.householdCount || 0,
        };

        if (format === 'pdf') {
          generateGrappePDF(exportPayload, project?.name || 'Projet GEM');
          toast.success(`Export PDF généré pour ${grappe.name}`);
          return;
        }

        if (format === 'excel') {
          generateGrappeExcel(exportPayload);
          toast.success(`Export Excel généré pour ${grappe.name}`);
          return;
        }
      } catch (err) {
        logger.error('Export error:', err);
        toast.error("Erreur lors de la génération de l'export");
      }
    };

    void runExport();
  };

  const GrappeCard = memo(({
    grappe,
    onOpenDetails,
    onExport,
    getSafeProgress,
    getGrappeStatus
  }: {
    grappe: any;
    onOpenDetails: (g: any) => void;
    onExport: (g: any, fmt: string) => void;
    getSafeProgress: (g: any) => number;
    getGrappeStatus: (g: any) => any;
  }) => {
    const progress = getSafeProgress(grappe);
    const status = getGrappeStatus(grappe);

    return (
      <div className="group flex flex-col justify-between rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-6 transition-all hover:border-primary/40 hover:bg-white/[0.05] h-[210px]">
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate uppercase tracking-tight flex items-center gap-3">
                {grappe.name}
                {String(grappe.id).startsWith('unclassified') && (
                  <span className="text-[8px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                    À CLASSER
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded border tracking-widest uppercase ${status.color}`}>
                  {status.label}
                </span>
                <span className="text-[10px] font-bold text-blue-300/30 flex items-center gap-1.5 uppercase">
                  <Zap size={12} className="text-primary" /> {grappe.householdCount} ménages
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-white italic">{progress}%</div>
              <div className="text-[8px] font-black text-blue-300/20 uppercase tracking-widest mt-1">Avancement</div>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ '--progress': '0%' } as any}
              animate={{ '--progress': `${progress}%` } as any}
              className={`h-full rounded-full ${progress >= 70 ? 'bg-emerald-500' : 'bg-primary'}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex gap-2">
            <button
              title="Voir la liste des ménages"
              onClick={() => onOpenDetails(grappe)}
              className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 border border-emerald-500/20 transition-all"
            >
              <Eye size={16} />
            </button>
            <button
              title="Exporter en PDF"
              onClick={() => onExport(grappe, 'pdf')}
              className="p-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5 transition-all"
            >
              <Printer size={16} />
            </button>
            <button
              title="Exporter en Excel"
              onClick={() => onExport(grappe, 'excel')}
              className="p-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5 transition-all"
            >
              <FileSpreadsheet size={16} />
            </button>
          </div>
          <div className="text-[9px] font-black text-blue-300/20 uppercase tracking-widest">
            {grappe.electrified} / {grappe.householdCount} terminés
          </div>
        </div>
      </div>
    );
  });

  GrappeCard.displayName = 'GrappeCard';

  const getGrappeStatus = (g: any) => {
    if (!g.householdCount || g.householdCount === 0)
      return { label: 'VIDE', color: 'bg-white/5 text-white/20 border-white/5' };
    if (g.electrified === 0)
      return { label: 'NON DÉMARRÉ', color: 'bg-red-500/10 text-red-500 border-red-500/20' };
    if (g.electrified < g.householdCount)
      return { label: 'EN COURS', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    return { label: 'TERMINÉ', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
  };

  const getSafeProgress = (grappe: any) => {
    const householdCount = Number(grappe.householdCount) || 0;
    const electrified = Number(grappe.electrified) || 0;
    if (householdCount <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((electrified / householdCount) * 100)));
  };

  if (loading && !syncing) {
    return (
      <PageContainer className="min-h-screen py-8 bg-surface">
        <PageHeader
          title="Bordereau de Livraison"
          subtitle="Initialisation des données..."
          icon={<FileSpreadsheet size={24} />}
        />
        <ContentArea>
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-300 animate-pulse">
              Chargement en cours
            </p>
          </div>
        </ContentArea>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="min-h-screen py-8 bg-surface">
      <PageHeader
        title="Bordereau de Livraison"
        subtitle="Gestion et suivi des expéditions par zone"
        icon={<FileSpreadsheet size={24} />}
        accent="bordereau"
        actions={
          <ActionBar>
            <button
              onClick={() => fetchData(true)}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-white/[0.08]"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
            </button>
            <button
              onClick={handleRecalculate}
              disabled={syncing}
              className={`${DASHBOARD_PRIMARY_BUTTON} h-auto px-4 py-2.5 text-[10px] tracking-[0.14em]`}
            >
              {syncing || isProcessing ? (
                <Activity size={14} className="animate-pulse text-blue-400" />
              ) : (
                <RefreshCw size={14} />
              )}
              {syncing ? 'Calcul...' : 'Recalculer'}
            </button>
          </ActionBar>
        }
      />

      <ContentArea padding="none" className="bg-transparent border-transparent shadow-none">
        <div className="p-4 md:p-8 space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
                { label: 'Total Ménages', value: fmtNum(workerData.stats.total), icon: Users, sub: 'éligibles' },
                { label: 'En Cours', value: fmtNum(workerData.stats.pending), icon: Package, sub: 'à livrer' },
                {
                  label: 'Livrés',
                  value: fmtNum(workerData.stats.delivered),
                  icon: CheckCircle2,
                  sub: 'confirmés',
                },
                {
                  label: 'Taux Livraison',
                  value: `${workerData.stats.pct}%`,
                  icon: TrendingUp,
                  sub: 'objectif',
                },
              ].map((kpi, i) => (
              <div
                key={i}
                className={`${DASHBOARD_MINI_STAT_CARD} group p-8 hover:bg-white/[0.06] ${
                  i === 0
                    ? DASHBOARD_ACCENT_SURFACE.blue
                    : i === 1
                      ? DASHBOARD_ACCENT_SURFACE.amber
                      : i === 2
                        ? DASHBOARD_ACCENT_SURFACE.emerald
                        : DASHBOARD_ACCENT_SURFACE.emerald
                }`}
              >
                <div className="flex items-center justify-between mb-6">
                  <kpi.icon
                    size={18}
                    className={`group-hover:scale-110 transition-transform ${
                      i === 0
                        ? 'text-blue-300'
                        : i === 1
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                    }`}
                  />
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                    i === 0
                      ? 'text-blue-200/45'
                      : i === 1
                        ? 'text-amber-200/45'
                        : 'text-emerald-200/45'
                  }`}>
                    {kpi.label}
                  </span>
                </div>
                <div className="text-4xl font-black text-white italic tracking-tighter mb-1">
                  {kpi.value}
                </div>
                <div className={`text-[10px] font-black uppercase tracking-widest ${
                  i === 0
                    ? 'text-blue-200/45'
                    : i === 1
                      ? 'text-amber-200/45'
                      : 'text-emerald-200/45'
                }`}>
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <div className={`relative group rounded-3xl ${DASHBOARD_SECTION_SURFACE} ${DASHBOARD_ACCENT_SURFACE.emerald} p-2`}>
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-300/55 group-focus-within:text-emerald-300 transition-colors" />
            <input
              type="text"
              placeholder="RECHERCHER UNE RÉGION OU UNE GRAPPE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${DASHBOARD_INPUT} rounded-[1.4rem] py-5 pl-16 pr-6 text-xs font-semibold uppercase tracking-[0.14em] placeholder:text-emerald-200/25 focus:border-emerald-400/35 focus:ring-2 focus:ring-emerald-500/15`}
            />
          </div>

          {/* Main Content - Virtualized for performance */}
          <div className="h-[calc(100vh-420px)] min-h-[500px]">
            {workerData.filteredRegions.length === 0 ? (
              <div className={`${DASHBOARD_SECTION_SURFACE} flex flex-col items-center justify-center space-y-4 py-24 text-center opacity-40 h-full`}>
                {isProcessing ? (
                   <Activity size={48} className="text-blue-500 animate-spin" />
                ) : (
                   <MapPin size={48} className="text-blue-300" />
                )}
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-300">
                  {isProcessing ? 'Calcul en cours...' : 'Aucune donnée correspondante'}
                </h3>
              </div>
            ) : (
              <AutoSizer
                renderProp={({ height = 500, width = 800 }) => {
                  // Build flat list for virtualization
                  const items: any[] = [];
                  workerData.filteredRegions.forEach(region => {
                    items.push({ type: 'region', region });
                    if (expandedRegions[region]) {
                      const grappes = workerData.groupedData[region];
                      // Group grappes in pairs for the grid layout
                      for (let i = 0; i < grappes.length; i += 2) {
                        items.push({
                          type: 'grappe-row',
                          grappes: [grappes[i], grappes[i+1]].filter(Boolean)
                        });
                      }
                    }
                  });

                  return (
                    <List<{ items: any[] }>
                      style={{ height, width }}
                      rowCount={items.length}
                      rowHeight={(index: number) => {
                        const item = items[index];
                        if (item.type === 'region') return 100;
                        return 240; // Grappe row height + gap
                      }}
                      rowProps={{ items }}
                      className="custom-scrollbar"
                      rowComponent={({ index, style }: { index: number; style: CSSProperties; items: any[] }) => {
                        const item = items[index];
                        if (item.type === 'region') {
                          const region = item.region;
                          const regionGrappes = workerData.groupedData[region];
                          const totalMénages = regionGrappes.reduce((acc: number, g: any) => acc + (g.householdCount || 0), 0);

                          return (
                            <div style={style} className="px-1">
                              <div className={`${DASHBOARD_SECTION_SURFACE} overflow-hidden mb-4`}>
                                <button
                                  onClick={() => toggleRegion(region)}
                                  className="group flex w-full items-center justify-between px-8 py-6 transition-colors hover:bg-white/[0.04]"
                                >
                                  <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-800 group-hover:text-primary transition-colors">
                                      <MapPin size={22} />
                                    </div>
                                    <div className="text-left">
                                      <h2 className="text-xl font-black text-white italic tracking-tight">
                                        {region}
                                      </h2>
                                      <div className="flex items-center gap-4 mt-1.5">
                                        <span className="text-[9px] font-black text-blue-300/30 uppercase tracking-[0.2em]">
                                          {regionGrappes.length} GRAPPES
                                        </span>
                                        <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-2 py-0.5 rounded">
                                          {totalMénages} MÉNAGES
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {expandedRegions[region] ? (
                                    <ChevronDown size={22} className="text-white/20" />
                                  ) : (
                                    <ChevronRight size={22} className="text-white/20" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div style={style} className="px-1">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                              {item.grappes.map((grappe: any) => (
                                <GrappeCard
                                  key={grappe.id}
                                  grappe={grappe}
                                  onOpenDetails={handleOpenGrappeDetails}
                                  onExport={handleExportGrappe}
                                  getSafeProgress={getSafeProgress}
                                  getGrappeStatus={getGrappeStatus}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      }}
                    />
                  );
                }}
              />
            )}
          </div>
        </div>
      </ContentArea>

      <AnimatePresence>
        {detailGrappe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm"
            onClick={handleCloseGrappeDetails}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300/60">
                    Détail de grappe
                  </p>
                  <h2 className="mt-2 truncate text-xl font-black uppercase tracking-tight text-white">
                    {detailGrappe.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-blue-200/75">
                      {detailGrappe.region || 'Sans région'}
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                      {fmtNum(filteredDetailHouseholds.length)} ménages affichés
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/55">
                      {fmtNum(detailHouseholds.length)} total
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCloseGrappeDetails}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/70 transition-all hover:bg-white/10 hover:text-white"
                  title="Fermer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="border-b border-white/10 px-6 py-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    type="text"
                    value={detailSearchQuery}
                    onChange={(e) => setDetailSearchQuery(e.target.value)}
                    placeholder="Rechercher un ménage, propriétaire, village..."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm font-medium text-white outline-none transition-all placeholder:text-white/25 focus:border-emerald-400/35 focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 p-4">
                {detailLoading ? (
                  <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500/15 border-t-emerald-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300/60">
                      Chargement des ménages
                    </p>
                  </div>
                ) : (
                  <HouseholdListView
                    households={filteredDetailHouseholds}
                    isDarkMode={true}
                    onSelectHousehold={handleSelectHousehold}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
};

export default Bordereau;
