/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, Suspense, useRef, useEffect, useCallback } from 'react';
import logger from '../utils/logger';
import toast from 'react-hot-toast';

import { useTerrainPhoto } from '../hooks/useTerrainPhoto';
import { useTerrainData } from '../hooks/useTerrainData';
import { QuickActions, OfflineIndicator, FloatingPhotoButton } from '../components/terrain/QuickActions';
import { TerrainMissionEditor } from '../components/terrain/TerrainMissionEditor';
import { createMission } from '../services/missionService';
import { uploadFile as uploadToServer } from '../services/uploadService';
import { useAuth } from '../contexts/AuthContext';
const MapComponent = React.lazy(() => import('../components/terrain/MapComponent'));
import type { Household } from '../utils/types';
import { motion, AnimatePresence } from 'framer-motion';
import { DataHubModal } from '../components/terrain/DataHubModal';
import { useProject } from '../contexts/ProjectContext';
import { useSync } from '../contexts/SyncContext';
import { useLogistique } from '../hooks/useLogistique';
import { useSyncListener } from '../hooks/useSyncListener';
import { usePermissions } from '../hooks/usePermissions';
import { useTerrainFeatures } from '../hooks/useTerrainFeatures';
import { MapRoutingPanel } from '../components/terrain/MapRoutingPanel';
import { GeofencingAlerts } from '../components/terrain/GeofencingAlerts';
import { PhotoLightbox } from '../components/terrain/PhotoLightbox';
import { MapDrawZonesPanel } from '../components/terrain/MapDrawZones';
import { GeoJsonOverlayPanel } from '../components/terrain/GeoJsonOverlay';
import { GrappeSelectorPanel } from '../components/terrain/GrappeSelectorPanel';
import { MapGrappeAllocationPanel } from '../components/terrain/MapGrappeAllocationPanel';
import { MapRegionDownload } from '../components/terrain/MapRegionDownload';
import { HouseholdDetailsPanel } from '../components/terrain/HouseholdDetailsPanel';
import { TerrainSyncIssuesPanel } from '../components/terrain/TerrainSyncIssuesPanel';
import { useFavorites } from '../hooks/useFavorites';
import { useTerrainUIStore } from '../store/terrainUIStore';
import { useSyncStore } from '../store/syncStore';
import {
  CONFORMING_HOUSEHOLD_LOCK_FIELDS,
  mergeManualOverrides,
  removeManualOverrides,
} from '../constants/householdLocks';
// useNavigate removed (not used in this page)

import { useGeolocation } from '../hooks/useGeolocation';
import {
  useMapFilters,
  hasValidCoordinates,
  type SearchResult,
  ALL_STATUSES,
} from '../hooks/useMapFilters';
import { getHouseholdDerivedStatus } from '../utils/statusUtils';
import { HouseholdListView } from '../components/terrain/HouseholdListView';

import { useGrappeClustering } from '../hooks/useGrappeClustering';
import { useAuditData } from '../hooks/useAuditData';
import { useRouting } from '../hooks/useRouting';

import TopBar from './Terrain/TopBar';
import BottomBar from './Terrain/BottomBar';
import { ErrorBoundary } from '../components/ErrorBoundary';

import '../components/terrain/MapWidgets.css';

import { ContentArea } from '../components';
import { MODULE_ACCENTS } from '../components/dashboards/DashboardComponents';

const Terrain: React.FC = () => {
  const terrainAccent = MODULE_ACCENTS.terrain;
  // 1. Core Data & Contexts
  const { households, updateHouseholdStatus, updateHouseholdLocation, uploadHouseholdPhoto, updateHousehold, reloadHouseholds, repairSyncQueue } =
    useTerrainData();

  const { project } = useProject();
  const { forceSync } = useSync();
  const { grappesConfig, warehouseStats, teams } = useLogistique(households);
  const { user } = useAuth();
  const { peut, PERMISSIONS } = usePermissions();
  const terrainFeatures = useTerrainFeatures();

  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [showMissionEditor, setShowMissionEditor] = useState(false);
  const [showSyncIssues, setShowSyncIssues] = useState(false);
  const pendingSyncCount = useSyncStore((s) => s.pendingCount);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const lastSyncError = useSyncStore((s) => s.lastSyncError);
  const conflicts = useSyncStore((s) => s.conflicts);

  // Modals state (Removed unused ProjectModals)
  const [isGeolocationRequestInProgress, setIsGeolocationRequestInProgress] = useState(false);
  const [geolocationToastId, setGeolocationToastId] = useState<string | number | null>(null);

  // 3. Zustand Store
  const activePanel = useTerrainUIStore((s) => s.activePanel);
  const setPanel = useTerrainUIStore((s) => s.setPanel);
  const closePanel = useTerrainUIStore((s) => s.closePanel);
  const viewMode = useTerrainUIStore((s) => s.viewMode);
  const setViewMode = useTerrainUIStore((s) => s.setViewMode);
  const selectedHouseholdId = useTerrainUIStore((s) => s.selectedHouseholdId);
  const setSelectedHouseholdId = useTerrainUIStore((s) => s.setSelectedHouseholdId);
  const setMapCommand = useTerrainUIStore((s) => s.setMapCommand);
  const lightboxPhotos = useTerrainUIStore((s) => s.lightboxPhotos);
  const openLightbox = useTerrainUIStore((s) => s.openLightbox);
  const showWarehouses = useTerrainUIStore((s) => s.showWarehouses);
  const addPendingPoint = useTerrainUIStore((s) => s.addPendingPoint);
  const drawnZones = useTerrainUIStore((s) => s.drawnZones);
  const showLegend = useTerrainUIStore((s) => s.showLegend);
  const setIsDrawing = useTerrainUIStore((s) => s.setIsDrawing);
  const setPendingPoints = useTerrainUIStore((s) => s.setPendingPoints);
  const pendingPoints = useTerrainUIStore((s) => s.pendingPoints);
  const addZone = useTerrainUIStore((s) => s.addZone);
  const activeGrappeId = useTerrainUIStore((s) => s.activeGrappeId);

  // 4. Custom Hooks (Logic Orchestration)
  const {
    selectedPhases,
    setSelectedPhases,
    selectedTeam,
    setSelectedTeam,
    searchQuery,
    setSearchQuery,
    setSearchResults,
    searchResults,
    isSearching,
    debouncedSearch,
    filteredHouseholds,
  } = useMapFilters(households, mapBounds);

  const { userLocation, geolocationError, handleRequestGeolocation } = useGeolocation((loc) => {
    setMapCommand({ center: loc, zoom: 16, timestamp: Date.now() });
  });
  // Modal ref + focus management
  const missionModalRef = useRef<HTMLDivElement | null>(null);

  const {
    grappeClusters,
    grappeZonesData,
    grappeCentroidsData,
    isLoading: isClustersLoading,
    progress: grappeProgress,
  } = useGrappeClustering(households);
  const { auditResult } = useAuditData(households);
  const {
    setRoutingStart,
    setRoutingDest,
    setRouteStats,
    routeStats,
    turnByTurnInstructions,
    cancelRouting,
  } = useRouting();

  const { isFavorite, toggleFavorite, favorites: localFavorites } = useFavorites(project?.id);

  const householdSyncStats = useMemo(() => {
    const stats = { pending: 0, synced: 0, error: 0 };
    for (const household of households || []) {
      if (household.syncStatus === 'pending') stats.pending += 1;
      else if (household.syncStatus === 'error') stats.error += 1;
      else if (household.syncStatus === 'synced') stats.synced += 1;
    }
    return stats;
  }, [households]);

  const pendingHouseholds = useMemo(
    () => (households || []).filter((household) => household.syncStatus === 'pending'),
    [households]
  );

  const errorHouseholds = useMemo(
    () => (households || []).filter((household) => household.syncStatus === 'error'),
    [households]
  );

  const conformingHouseholds = useMemo(
    () =>
      (households || []).filter(
        (household) => getHouseholdDerivedStatus(household) === 'Contrôle conforme'
      ),
    [households]
  );

  const lockableConformingHouseholds = useMemo(
    () =>
      conformingHouseholds.filter((household) =>
        CONFORMING_HOUSEHOLD_LOCK_FIELDS.some(
          (field) => !(household.manualOverrides || []).includes(field)
        )
      ),
    [conformingHouseholds]
  );

  const unlockableConformingHouseholds = useMemo(
    () =>
      conformingHouseholds.filter((household) =>
        CONFORMING_HOUSEHOLD_LOCK_FIELDS.some((field) =>
          (household.manualOverrides || []).includes(field)
        )
      ),
    [conformingHouseholds]
  );

  // Terrain photo hook
  const { capturePhoto, selectFromGallery, isCapturing } = useTerrainPhoto({
    onUpload: async (file: File): Promise<string> => {
      if (!file) return "";
      logger.debug('📸 Photo capturée, début upload...', file.name);
      
      const toastId = toast.loading('Upload de la photo...');
      try {
        const result = await uploadToServer(file);
        if (result) {
          toast.success('Photo enregistrée au serveur', { id: toastId });
          // If editor is open, we could push it to a global state or store
          // For now, let's just log it. The editor has its own upload button now.
        } else {
          toast.error('Échec de l\'upload', { id: toastId });
        }
        return "ok";
      } catch (e) {
          logger.error(e);
          toast.error('Erreur upload', { id: toastId });
          return "";
        }
    },
  });

  // ✅ GUARD: Prevent double-initialization from StrictMode
  const autoCenterInitializedRef = useRef(false);

  // 5. Auto-Center
  useEffect(() => {
    // Guard: Only auto-center once on first household load
    if (autoCenterInitializedRef.current) return;

    if (households && households.length > 0 && !selectedHouseholdId) {
      const firstWithCoords = households.find(hasValidCoordinates);
      if (firstWithCoords) {
        autoCenterInitializedRef.current = true;
        const lng = Number(firstWithCoords.location?.coordinates?.[0] || firstWithCoords.longitude);
        const lat = Number(firstWithCoords.location?.coordinates?.[1] || firstWithCoords.latitude);
        logger.debug('📍 [Terrain] Auto-centering on first household:', firstWithCoords.id);
        setMapCommand({ center: [lng, lat], zoom: 14, timestamp: Date.now() });
      }
    }
  }, [households, selectedHouseholdId, setMapCommand]);
  useEffect(() => {
    const handleStatus = () => setIsOfflineMode(!navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  useEffect(() => {
    const blockedPanel =
      (activePanel === 'routing' && !terrainFeatures.routing) ||
      (activePanel === 'draw' && !terrainFeatures.drawZones) ||
      (activePanel === 'layers' && !terrainFeatures.geoJsonLayers) ||
      (activePanel === 'grappe' && !terrainFeatures.grappeTools) ||
      (activePanel === 'grappe_allocation' && !terrainFeatures.grappeTools) ||
      (activePanel === 'region' && !terrainFeatures.regionDownload) ||
      (activePanel === 'datahub' && !terrainFeatures.dataHub);

    if (blockedPanel) {
      closePanel();
    }
  }, [activePanel, closePanel, terrainFeatures]);

  // Handler: manuel sync (déclaré avant l'enregistrement du listener pour éviter TDZ)
  const handleManualSync = useCallback(async () => {
    try {
      await repairSyncQueue();
      await forceSync();
      toast.success('✅ Synchronisation terminée');
    } catch (e) {
      logger.error(e);
      toast.error('❌ Erreur lors de la synchronisation');
    }
  }, [forceSync, repairSyncQueue]);

  useSyncListener((source) => {
    logger.debug(`🔄 [TERRAIN] Sync triggered by: ${source}`);
    if (source === 'kobo' || source === 'import') {
      void reloadHouseholds();
      return;
    }

    // Otherwise, manually sync explicitly requested updates
    handleManualSync();
  });

  // 6. Handlers

  const handleRecenterOnUser = useCallback(() => {
    if (isGeolocationRequestInProgress) {
      return;
    }

    if (userLocation) {
      setMapCommand({ center: userLocation, zoom: 16, timestamp: Date.now() });
      return;
    }

    const toastId = toast.loading('En attente de votre position... ⏳', { duration: 15000 });
    setGeolocationToastId(toastId);
    setIsGeolocationRequestInProgress(true);
    handleRequestGeolocation();
  }, [userLocation, handleRequestGeolocation, setMapCommand, isGeolocationRequestInProgress]);

  // ✅ Safe coordinate validation function
  const isValidCoordinate = (lng: unknown, lat: unknown): boolean => {
    return (
      typeof lng === 'number' &&
      typeof lat === 'number' &&
      !isNaN(lng) &&
      !isNaN(lat) &&
      Math.abs(lng) <= 180 &&
      Math.abs(lat) <= 90
    );
  };

  useEffect(() => {
    if (geolocationToastId == null) return;
    if (userLocation || geolocationError) {
      if (typeof geolocationToastId === 'string' || typeof geolocationToastId === 'number') {
        const dismissId =
          typeof geolocationToastId === 'number'
            ? geolocationToastId.toString()
            : geolocationToastId;
        toast.dismiss(dismissId);
      }
      // Defer state updates to avoid synchronous setState-in-effect warnings
      const t = window.setTimeout(() => {
        setGeolocationToastId(null);
        setIsGeolocationRequestInProgress(false);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [userLocation, geolocationError, geolocationToastId]);

  // Focus trap: focus modal when opened and close on Escape
  useEffect(() => {
    if (!showMissionEditor) return;
    const el = missionModalRef.current;
    const prevActive = document.activeElement as HTMLElement | null;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMissionEditor(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prevActive?.focus?.();
    };
  }, [showMissionEditor]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      const setHighlightedLocation = useTerrainUIStore.getState().setHighlightedLocation;
      
      if (result.type === 'household') {
        setSelectedHouseholdId(result.data.id);
        const lng = Number(result.data.location?.coordinates?.[0] || result.data.longitude);
        const lat = Number(result.data.location?.coordinates?.[1] || result.data.latitude);

        if (isValidCoordinate(lng, lat)) {
          // Activer le pulse temporaire (1 min)
          setHighlightedLocation([lng, lat]);
          
          setMapCommand({
            center: [lng, lat],
            zoom: 20,
            timestamp: Date.now(),
          });
        }
      } else {
        if (isValidCoordinate(result.lon, result.lat)) {
          const center: [number, number] = [result.lon, result.lat];
          setMapCommand({ center, zoom: 20, timestamp: Date.now() });
        }
      }
      setSearchQuery('');
      setSearchResults([]);
    },
    [setSelectedHouseholdId, setMapCommand, setSearchQuery, setSearchResults]
  );

  const handleZoneClick = useCallback((center: [number, number], zoom?: number) => {
    setMapCommand({ center, zoom: zoom ?? 16, timestamp: Date.now() });
  }, [setMapCommand]);

  const handleTraceItinerary = useCallback(() => {
    const h = households?.find((hh) => hh.id === selectedHouseholdId);
    if (!h || !hasValidCoordinates(h)) return;
    
    const lng = Number(h.location?.coordinates?.[0] || h.longitude);
    const lat = Number(h.location?.coordinates?.[1] || h.latitude);
    const dest: [number, number] = [lng, lat];

    setRoutingDest(dest);
    setPanel('routing');
    setRouteStats(null);

    if (userLocation) {
      setRoutingStart(userLocation);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setRoutingStart([pos.coords.longitude, pos.coords.latitude]);
        },
        () => {
          toast.error('Géolocalisation impossible');
          setRoutingStart(null);
        }
      );
    }
  }, [
    households,
    selectedHouseholdId,
    userLocation,
    setRoutingDest,
    setRouteStats,
    setRoutingStart,
    setPanel,
  ]);

  const handleCancelItinerary = useCallback(() => {
    cancelRouting();
    toast.success('Itinéraire annulé');
  }, [cancelRouting]);

  const handleOpenSyncHousehold = useCallback(
    (householdId: string) => {
      const target = (households || []).find((household) => household.id === householdId);
      if (!target) return;

      setShowSyncIssues(false);
      setSelectedHouseholdId(target.id);

      if (hasValidCoordinates(target)) {
        setMapCommand({
          center: [target.location.coordinates[0], target.location.coordinates[1]],
          zoom: 18,
          timestamp: Date.now(),
        });
      }
    },
    [households, setMapCommand, setSelectedHouseholdId]
  );

  const handleRepairSyncIssues = useCallback(async () => {
    const repaired = await repairSyncQueue();
    toast.success(
      repaired > 0
        ? `${repaired} élément(s) de sync réparé(s)`
        : 'Aucun doublon ou échec à réparer'
    );
  }, [repairSyncQueue]);

  const handleLockConformingHouseholds = useCallback(async () => {
    if (lockableConformingHouseholds.length === 0) {
      toast.success('Tous les ménages conformes sont déjà verrouillés');
      return;
    }

    const toastId = toast.loading(
      `Verrouillage de ${lockableConformingHouseholds.length} ménage(s) conforme(s)...`
    );
    let updatedCount = 0;
    let failedCount = 0;

    try {
      const chunkSize = 20;
      for (let i = 0; i < lockableConformingHouseholds.length; i += chunkSize) {
        const chunk = lockableConformingHouseholds.slice(i, i + chunkSize);
        const results = await Promise.allSettled(
          chunk.map((household) =>
            updateHousehold(household.id, {
              manualOverrides: mergeManualOverrides(
                household.manualOverrides,
                CONFORMING_HOUSEHOLD_LOCK_FIELDS
              ),
            })
          )
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled') updatedCount += 1;
          else failedCount += 1;
        });
      }

      if (updatedCount > 0 && failedCount === 0) {
        toast.success(`${updatedCount} ménage(s) conforme(s) verrouillé(s)`, { id: toastId });
        return;
      }

      if (updatedCount > 0) {
        toast.success(
          `${updatedCount} ménage(s) verrouillé(s), ${failedCount} en échec`,
          { id: toastId }
        );
        return;
      }

      toast.error('Aucun ménage conforme n’a pu être verrouillé', { id: toastId });
    } catch (error) {
      logger.error('[Terrain] Bulk conforming household lock failed', error);
      toast.error('Erreur pendant le verrouillage des ménages conformes', { id: toastId });
    }
  }, [lockableConformingHouseholds, updateHousehold]);

  const handleUnlockConformingHouseholds = useCallback(async () => {
    if (unlockableConformingHouseholds.length === 0) {
      toast.success('Aucun ménage conforme à déverrouiller');
      return;
    }

    const toastId = toast.loading(
      `Déverrouillage de ${unlockableConformingHouseholds.length} ménage(s) conforme(s)...`
    );
    let updatedCount = 0;
    let failedCount = 0;

    try {
      const chunkSize = 20;
      for (let i = 0; i < unlockableConformingHouseholds.length; i += chunkSize) {
        const chunk = unlockableConformingHouseholds.slice(i, i + chunkSize);
        const results = await Promise.allSettled(
          chunk.map((household) =>
            updateHousehold(household.id, {
              manualOverrides: removeManualOverrides(
                household.manualOverrides,
                CONFORMING_HOUSEHOLD_LOCK_FIELDS
              ),
              unlockFields: CONFORMING_HOUSEHOLD_LOCK_FIELDS as unknown as string[],
            } as Partial<Household>)
          )
        );

        results.forEach((result) => {
          if (result.status === 'fulfilled') updatedCount += 1;
          else failedCount += 1;
        });
      }

      if (updatedCount > 0 && failedCount === 0) {
        toast.success(`${updatedCount} ménage(s) conforme(s) déverrouillé(s)`, { id: toastId });
        return;
      }

      if (updatedCount > 0) {
        toast.success(
          `${updatedCount} ménage(s) déverrouillé(s), ${failedCount} en échec`,
          { id: toastId }
        );
        return;
      }

      toast.error('Aucun ménage conforme n’a pu être déverrouillé', { id: toastId });
    } catch (error) {
      logger.error('[Terrain] Bulk conforming household unlock failed', error);
      toast.error('Erreur pendant le déverrouillage des ménages conformes', { id: toastId });
    }
  }, [unlockableConformingHouseholds, updateHousehold]);

  // Keyboard shortcuts removed
  
  // 7. Memoized Computed Values
  const selectedHousehold = useMemo(
    () => (households || []).find((h) => h.id === selectedHouseholdId) || null,
    [households, selectedHouseholdId]
  );

  const allAvailableTeams = useMemo(() => {
    const fromDB = (teams || []).map((t) => t.name);
    const fromHouseholds = (households || []).reduce((acc, h) => {
      if (Array.isArray(h.assignedTeams)) {
        h.assignedTeams.forEach((at: string) => acc.add(at));
      }
      return acc;
    }, new Set<string>());
    return Array.from(new Set([...fromDB, ...fromHouseholds])).sort();
  }, [teams, households]);

  const terrainStatusOptions = useMemo(
    () => [
      'Non encore installée',
      'Livraison effectuée',
      'Murs terminés',
      'Réseau terminé',
      'Intérieur terminé',
      'Contrôle conforme',
      'Non conforme',
      'Non éligible',
    ],
    []
  );

  const selectedStatusFilter = useMemo(() => {
    if (selectedPhases.length === ALL_STATUSES.length) return 'all';
    if (selectedPhases.length === 1) return selectedPhases[0];
    return 'custom';
  }, [selectedPhases]);

  const hasZoneOverlayData = useMemo(() => {
    const zoneCount = Array.isArray(grappeZonesData?.features) ? grappeZonesData.features.length : 0;
    const centroidCount = Array.isArray(grappeCentroidsData?.features)
      ? grappeCentroidsData.features.length
      : 0;
    return zoneCount > 0 || centroidCount > 0;
  }, [grappeCentroidsData, grappeZonesData]);

  const selectedHouseholdGrappeInfo = useMemo(() => {
    if (!selectedHousehold) return undefined;
    const gId = selectedHousehold.grappeId;
    const allGrappes = grappesConfig?.grappes || [];

    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    type GrappeDefinition = {
      id: string;
      nom?: string;
      name?: string;
      region?: string;
      centroide_lat?: number | null;
      centroide_lon?: number | null;
      nb_menages?: number;
    };

    if (gId) {
      const grappeDef = (grappesConfig?.grappes as any[])?.find((g: any) => g.id === gId) ||
                       (grappesConfig?.sous_grappes as any[])?.find((sg: any) => sg.id === gId);
      
      const grappeName =
        selectedHousehold.grappeName || 
        grappeDef?.nom || 
        grappeDef?.name || 
        grappeDef?.code || 
        (grappeDef?.grappe_numero ? `Grappe ${grappeDef.grappe_numero}` : null) ||
        (grappeDef?.numero ? `Grappe ${grappeDef.numero}` : null) ||
        (() => {
          // If it's an auto-generated grappe (UUID), try to find the most common village
          const siblings = (households || []).filter((h) => h.grappeId === gId);
          const villages = siblings.map(h => h.village || h.koboSync?.village).filter(Boolean);
          if (villages.length > 0) {
            const mostCommon = villages.reduce((acc, v) => {
              acc[v!] = (acc[v!] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            const bestVillage = Object.entries(mostCommon).sort((a, b) => b[1] - a[1])[0][0];
            return `Grappe ${bestVillage}`;
          }
          return `Grappe ${gId.slice(0, 8)}`;
        })();


        
      const grappeCount = (households || []).filter((h: Household) => h.grappeId === gId).length;
      return { id: gId, name: grappeName, count: grappeCount };
    }

    const coords = selectedHousehold.location?.coordinates;
    if (!coords || (allGrappes as any[]).length === 0) return undefined;
    const [lng, lat] = coords;

    const hRegion =
      selectedHousehold.region ||
      (selectedHousehold.koboData as any)?.region ||
      (selectedHousehold.koboSync as any)?.region;
    const pool = hRegion
      ? (allGrappes as any[]).filter(
          (g: any) =>
            (g.region && g.region.toLowerCase() === hRegion.toLowerCase()) || !g.region
        )
      : (allGrappes as any[]);

    let nearest: GrappeDefinition | null = null;
    let minDist = Infinity;
    for (const g of pool) {
      if (g.centroide_lat == null || g.centroide_lon == null) continue;
      const d = haversine(lat, lng, g.centroide_lat, g.centroide_lon);
      if (d < minDist) {
        minDist = d;
        nearest = g;
      }
    }

    if (!nearest || minDist > 150) return undefined;
    const count = (households || []).filter((h: Household) => h.grappeId === (nearest as any).id).length;
    return {
      id: nearest.id,
      name: nearest.nom || nearest.name || `Grappe ${nearest.id}`,
      count: count || nearest.nb_menages || 0,
    };
  }, [selectedHousehold, households, grappesConfig?.grappes, grappesConfig?.sous_grappes]);

  const peutVoirDataHub = peut(PERMISSIONS.GERER_UTILISATEURS) || user?.role === 'ADMIN_PROQUELEC';

  return (
    <div
      className={`relative isolate flex h-full min-h-[100dvh] w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#0b1f1a_0%,#07131a_38%,#030712_100%)] ${terrainAccent.surface}`}
    >
      {/* 🗺️ MAP / LIST LAYER */}
      <div className="absolute inset-0 z-0 pt-[214px] pb-[132px] sm:pt-[232px] md:pt-0 md:pb-0">
        <ContentArea
          padding="none"
          className="h-full w-full border-none rounded-none bg-transparent"
        >
          <AnimatePresence mode="wait">
            {viewMode === 'map' ? (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full relative"
              >
                <ErrorBoundary
                  fallback={
                    <div className="h-full w-full flex items-center justify-center bg-red-50/10 border border-red-500/20 rounded-lg">
                      <div className="text-center">
                        <div className="text-4xl mb-4">❌</div>
                        <h3 className="text-red-600 font-semibold mb-2">Erreur loading carte</h3>
                        <p className="text-red-500/70 text-sm mb-4">
                          Un problème est survenu en chargeant la carte
                        </p>
                        <button
                          onClick={() => window.location.reload()}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium text-sm transition-colors"
                        >
                          Recharger
                        </button>
                      </div>
                    </div>
                  }
                >
                  <Suspense
                    fallback={
                      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-950">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-blue-500/10 rounded-full" />
                          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 animate-pulse">
                          Initialisation Carte
                        </p>
                      </div>
                    }
                  >
                    <MapComponent
                      households={households || []}
                      isFilteringActive={
                        selectedTeam !== 'all' || selectedPhases.length !== ALL_STATUSES.length
                      }
                      showLegend={terrainFeatures.statusLegend && showLegend}
                      onZoneClick={handleZoneClick}
                      grappesConfig={grappesConfig}
                      readOnly={!peut(PERMISSIONS.MODIFIER_CARTE)}
                      userLocation={userLocation}
                      onHouseholdDrop={updateHouseholdLocation}
                      favorites={localFavorites}
                      onBoundsChange={setMapBounds}
                      warehouses={showWarehouses ? warehouseStats : []}
                      projectId={project?.id}
                      drawnZones={drawnZones}
                      onAddPoint={addPendingPoint}
                      grappeZonesData={grappeZonesData}
                      grappeCentroidsData={grappeCentroidsData}
                    />
                  </Suspense>
                </ErrorBoundary>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="relative z-[60] h-full w-full overflow-hidden bg-[#0D1E35] pt-0"
              >
                <HouseholdListView
                  households={filteredHouseholds}
                  isDarkMode
                  onSelectHousehold={(h: Household) => {
                    if (hasValidCoordinates(h)) {
                      setSelectedHouseholdId(h.id);
                      setMapCommand({
                        center: [h.location.coordinates[0], h.location.coordinates[1]],
                        zoom: 20,
                        timestamp: Date.now(),
                      });
                      setViewMode('map');
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </ContentArea>
      </div>

      {/* 🔍 TOP OVERLAY */}
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          debouncedSearch(value);
        }}
        searchResults={searchResults as any}
        isSearching={isSearching}
        onSelectResult={handleSelectResult}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
        allAvailableTeams={allAvailableTeams}
        selectedStatusFilter={selectedStatusFilter}
        onStatusFilterChange={(status) => {
          if (status === 'all') {
            setSelectedPhases(ALL_STATUSES);
            return;
          }
          setSelectedPhases([status]);
        }}
        statusOptions={terrainStatusOptions}
        project={project}
        onSync={handleManualSync}
        onOpenDataHub={() => setPanel('datahub')}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRecenter={handleRecenterOnUser}
        peutVoirDataHub={peutVoirDataHub}
        isSyncing={isSyncing}
        showSearch={terrainFeatures.search}
        showSync={terrainFeatures.sync}
        showDataHub={terrainFeatures.dataHub}
        showTeamFilter={terrainFeatures.teamFilter}
        showStatusFilter={terrainFeatures.statusFilter}
        showListToggle={terrainFeatures.listView}
        showRecenter={terrainFeatures.recenter}
        showAdvancedTools={
          terrainFeatures.mapStyle ||
          terrainFeatures.statusLegend ||
          terrainFeatures.zoneOverlay ||
          terrainFeatures.routing ||
          terrainFeatures.grappeTools ||
          terrainFeatures.analytics ||
          terrainFeatures.heatmap ||
          terrainFeatures.measure ||
          terrainFeatures.lasso ||
          terrainFeatures.drawZones ||
          terrainFeatures.dataHub
          || terrainFeatures.geoJsonLayers
          || terrainFeatures.regionDownload
        }
        mapToolbarFeatures={{
          mapStyle: terrainFeatures.mapStyle,
          statusLegend: terrainFeatures.statusLegend,
          zoneOverlay: terrainFeatures.zoneOverlay,
          zoneOverlayReady: hasZoneOverlayData,
          zoneOverlayLoading: isClustersLoading,
          routing: terrainFeatures.routing,
          grappeTools: terrainFeatures.grappeTools,
          analytics: terrainFeatures.analytics,
          heatmap: terrainFeatures.heatmap,
          measure: terrainFeatures.measure,
          lasso: terrainFeatures.lasso,
          drawZones: terrainFeatures.drawZones,
          geoJsonLayers: terrainFeatures.geoJsonLayers,
          regionDownload: terrainFeatures.regionDownload,
          dataHub: terrainFeatures.dataHub,
        }}
      />

      {/* 📊 BOTTOM OVERLAY */}
      <BottomBar
        filteredCount={(households?.filter(hasValidCoordinates) || []).length}
        totalCount={(households?.filter(hasValidCoordinates) || []).length}
        isOfflineMode={isOfflineMode}
        auditResult={auditResult}
        pendingSyncCount={pendingSyncCount}
        pendingHouseholdsCount={householdSyncStats.pending}
        errorHouseholdsCount={householdSyncStats.error}
        hasSyncError={!!lastSyncError}
        onFlyTo={(lng, lat) =>
          setMapCommand({ center: [lng, lat], zoom: 16, timestamp: Date.now() })
        }
      />

      {/* 🛠️ PANELS & MODALS */}
      {terrainFeatures.routing && activePanel === 'routing' && (
        <div className="z-[70] absolute inset-x-3 bottom-[132px] top-auto md:inset-x-auto md:bottom-auto md:top-16 md:right-4">
          <MapRoutingPanel
            onClose={closePanel}
            households={households || []}
            isDarkMode
            turnByTurnInstructions={turnByTurnInstructions as any}
            routeDistance={routeStats?.distance}
            routeDuration={routeStats?.duration}
          />
        </div>
      )}

      {terrainFeatures.geofencingAlerts && (
        <GeofencingAlerts households={filteredHouseholds} grappesConfig={grappesConfig} isDarkMode />
      )}

      {terrainFeatures.drawZones && activePanel === 'draw' && (
        <div className="z-[70] pointer-events-auto">
          <MapDrawZonesPanel
            onStartDraw={() => setIsDrawing(true)}
            onConfirmZone={(name, team, color) => {
              const newZone = {
                id: `zone-${Date.now()}`,
                name,
                team,
                color,
                coordinates: [...pendingPoints],
                createdAt: new Date().toISOString(),
              };
              addZone(newZone);
              setIsDrawing(false);
              setPendingPoints([]);
            }}
            onCancelDraw={() => {
              setIsDrawing(false);
              setPendingPoints([]);
            }}
          />
        </div>
      )}

      {terrainFeatures.geoJsonLayers && activePanel === 'layers' && (
        <div className="z-[60] pointer-events-auto">
          <GeoJsonOverlayPanel />
        </div>
      )}
      {terrainFeatures.grappeTools && activePanel === 'grappe' && (
        <div className="z-[60] pointer-events-auto">
          <GrappeSelectorPanel
            onClose={closePanel}
            clusters={grappeClusters}
            isLoading={isClustersLoading}
            progress={grappeProgress}
            onSelectGrappe={(_id, bbox) =>
              bbox && window.dispatchEvent(new CustomEvent('fit-bounds', { detail: bbox }))
            }
          />
        </div>
      )}
      {terrainFeatures.grappeTools && activePanel === 'grappe_allocation' && (
        <div className="z-[60] pointer-events-auto">
          <MapGrappeAllocationPanel
            onClose={closePanel}
            activeGrappeId={activeGrappeId || ''}
            households={households || []}
          />
        </div>
      )}
      {terrainFeatures.regionDownload && activePanel === 'region' && (
        <div className="z-[60] pointer-events-auto">
          <MapRegionDownload onClose={closePanel} />
        </div>
      )}
      {terrainFeatures.dataHub && (
        <DataHubModal isOpen={activePanel === 'datahub'} onClose={closePanel} />
      )}

      {selectedHousehold && (
        <HouseholdDetailsPanel
          household={selectedHousehold}
          onPhotoOpen={openLightbox}
          onStatusUpdate={(status) => updateHouseholdStatus(selectedHousehold.id, status)}
          onPhotoUpload={(file) => uploadHouseholdPhoto(selectedHousehold.id, file)}
          onUpdate={(id, patch) => updateHousehold(id, patch)}
          isFavorite={isFavorite(selectedHousehold.id)}
          toggleFavorite={() => toggleFavorite(selectedHousehold.id)}
          onTraceItinerary={handleTraceItinerary}
          onCancelItinerary={handleCancelItinerary}
          routeStats={routeStats || null}
          grappeInfo={selectedHouseholdGrappeInfo}
          isAdmin={terrainFeatures.householdAdminEdit}
          pendingSyncCount={pendingSyncCount}
        />
      )}

      <AnimatePresence>{lightboxPhotos.length > 0 && <PhotoLightbox />}</AnimatePresence>

      {/* 🆕 Terrain Mode Enhancements */}
      <OfflineIndicator
        isOffline={isOfflineMode}
        pendingCount={pendingSyncCount}
        onClick={terrainFeatures.syncIssues ? () => setShowSyncIssues(true) : undefined}
      />
      
      {viewMode === 'map' && (
        <QuickActions
          onPhoto={terrainFeatures.photoCapture ? () => capturePhoto() : undefined}
          onNavigate={terrainFeatures.recenter ? handleRecenterOnUser : undefined}
        />
      )}

      {terrainFeatures.photoCapture && viewMode === 'map' && (
        <FloatingPhotoButton
          onCapture={capturePhoto}
          onSelect={selectFromGallery}
          disabled={isCapturing}
        />
      )}

      {terrainFeatures.syncIssues && (
        <TerrainSyncIssuesPanel
          isOpen={showSyncIssues}
          onClose={() => setShowSyncIssues(false)}
          pendingSyncCount={pendingSyncCount}
          conformingHouseholdsCount={conformingHouseholds.length}
          lockableConformingHouseholdsCount={lockableConformingHouseholds.length}
          unlockableConformingHouseholdsCount={unlockableConformingHouseholds.length}
          pendingHouseholds={pendingHouseholds}
          errorHouseholds={errorHouseholds}
          conflicts={conflicts}
          lastSyncError={lastSyncError}
          isSyncing={isSyncing}
          onRepair={handleRepairSyncIssues}
          onSync={handleManualSync}
          onLockConforming={handleLockConformingHouseholds}
          onUnlockConforming={handleUnlockConformingHouseholds}
          onSelectHousehold={handleOpenSyncHousehold}
          showBulkConformingActions={terrainFeatures.bulkConformingLocks}
        />
      )}

      {/* Mission Editor Modal */}
      <AnimatePresence>
        {showMissionEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/50 flex items-end justify-center p-3 sm:p-4 md:items-center"
            onClick={() => setShowMissionEditor(false)}
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[2rem] md:rounded-none"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mission-editor-title"
              ref={missionModalRef}
              tabIndex={-1}
            >
              <TerrainMissionEditor
                context={{
                  teamId: selectedTeam !== 'all' ? selectedTeam : undefined,
                  regionName: selectedHousehold?.region,
                  householdCount: filteredHouseholds.length,
                }}
                isLoading={false}
                onSave={async (mission) => {
                  try {
                    logger.debug('💾 Sauvegarde brouillon mission sur serveur...', mission);
                    const result = await createMission({
                      ...mission,
                      status: 'draft',
                    });
                    if (result) {
                      toast.success('Mission sauvegardée comme brouillon');
                      setShowMissionEditor(false);
                    }
                  } catch (e) {
                    logger.error(e);
                    toast.error('Erreur lors de la sauvegarde');
                  }
                }}
                onSubmit={async (mission) => {
                  try {
                    logger.debug('📤 Soumission mission sur serveur...', mission);
                    const result = await createMission({
                      ...mission,
                      status: 'soumise',
                    });
                    if (result) {
                      toast.success('Mission soumise avec succès');
                      setShowMissionEditor(false);
                    }
                  } catch (e) {
                    logger.error(e);
                    toast.error('Erreur lors de la soumission');
                  }
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(Terrain);
