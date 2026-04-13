import React, { useState, useMemo, Suspense, useRef, useEffect, useCallback } from 'react';
import logger from '../utils/logger';
import toast from 'react-hot-toast';

import { useTerrainData } from '../hooks/useTerrainData';
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
import { MapRoutingPanel } from '../components/terrain/MapRoutingPanel';
import { GeofencingAlerts } from '../components/terrain/GeofencingAlerts';
import { PhotoLightbox } from '../components/terrain/PhotoLightbox';
import { MapDrawZonesPanel } from '../components/terrain/MapDrawZones';
import { GeoJsonOverlayPanel } from '../components/terrain/GeoJsonOverlay';
import { GrappeSelectorPanel } from '../components/terrain/GrappeSelectorPanel';
import { MapGrappeAllocationPanel } from '../components/terrain/MapGrappeAllocationPanel';
import { MapRegionDownload } from '../components/terrain/MapRegionDownload';
import { HouseholdDetailsPanel } from '../components/terrain/HouseholdDetailsPanel';
import { useFavorites } from '../hooks/useFavorites';
import { useTerrainUIStore } from '../store/terrainUIStore';
import { useNavigate } from 'react-router-dom';

import { useGeolocation } from '../hooks/useGeolocation';
import {
  useMapFilters,
  hasValidCoordinates,
  type SearchResult,
  ALL_STATUSES,
} from '../hooks/useMapFilters';
import { HouseholdListView } from '../components/terrain/HouseholdListView';

import { useGrappeClustering } from '../hooks/useGrappeClustering';
import { useAuditData } from '../hooks/useAuditData';
import { useRouting } from '../hooks/useRouting';

import TopBar from './Terrain/TopBar';
import BottomBar from './Terrain/BottomBar';
import ProjectModals from './Terrain/ProjectModals';
import { ErrorBoundary } from '../components/ErrorBoundary';

import '../components/terrain/MapWidgets.css';

import { ContentArea } from '../components';

const Terrain: React.FC = () => {
  // 1. Core Data & Contexts
  const { households, updateHouseholdStatus, updateHouseholdLocation, uploadHouseholdPhoto } =
    useTerrainData();

  const { project, createProject, deleteProject } = useProject();
  const { forceSync } = useSync();
  const { grappesConfig, warehouseStats, teams } = useLogistique();
  const { user } = useAuth();
  const { peut, PERMISSIONS } = usePermissions();

  // 2. Local State & Refs
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

  // Modals state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteAttempts, setDeleteAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isGeolocationRequestInProgress, setIsGeolocationRequestInProgress] = useState(false);
  const [geolocationToastId, setGeolocationToastId] = useState<string | number | null>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

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
  const navigate = useNavigate();

  const {
    grappeClusters,
    grappeZonesData,
    grappeCentroidsData,
    isLoading: isClustersLoading,
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

  // ✅ GUARD: Prevent double-initialization from StrictMode
  const syncInitializedRef = useRef(false);
  const autoCenterInitializedRef = useRef(false);

  // 5. Initial Sync, Auto-Center & Smart Background Sync
  useEffect(() => {
    // Guard against StrictMode double-mount
    if (syncInitializedRef.current) {
      logger.debug('⏭️ [Terrain] Sync already initialized, skipping (double-mount guard)');
      return;
    }
    syncInitializedRef.current = true;
    logger.log('🔄 [Terrain] Mounting - Initializing safe sync engine...');

    let isSyncing = false;

    const safeSync = async () => {
      if (!navigator.onLine) {
        logger.log('📡 [Terrain] Offline, skipping background sync.');
        return;
      }
      if (document.hidden) {
        logger.log('👁️ [Terrain] App hidden, skipping background sync.');
        return;
      }
      if (isSyncing) return;

      isSyncing = true;
      try {
        // Here we call the manual sync wrapper to trigger UI updates and background events
        // Fallback to forceSync if handleManualSync isn't available contextually
        forceSync();
      } catch (err) {
        logger.error('Erreur durant SafeSync', err);
      } finally {
        isSyncing = false;
      }
    };

    // Lancement initial
    safeSync();

    // Reprise automatique à la connexion internet
    window.addEventListener('online', safeSync);

    // Boucle 10 minutes
    const SYNC_INTERVAL = 10 * 60 * 1000;
    const intervalId = setInterval(safeSync, SYNC_INTERVAL);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('online', safeSync);
    };
  }, [forceSync]);

  useEffect(() => {
    // Guard: Only auto-center once on first household load
    if (autoCenterInitializedRef.current) return;

    if (households && households.length > 0 && !selectedHouseholdId) {
      const firstWithCoords = households.find(
        (h) =>
          h.location?.coordinates &&
          h.location.coordinates[0] !== 0 &&
          h.location.coordinates[1] !== 0
      );
      if (firstWithCoords) {
        autoCenterInitializedRef.current = true;
        const [lng, lat] = firstWithCoords.location!.coordinates;
        logger.log('📍 [Terrain] Auto-centering on first household:', firstWithCoords.id);
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

  useSyncListener((source) => {
    logger.log(`🔄 [TERRAIN] Sync triggered by: ${source}`);
    if (source === 'kobo' || source === 'import') {
      // Data is already synced locally in IndexedDB by the caller. UI re-renders automatically via useLiveQuery.
      return;
    }

    // Otherwise, manually sync explicitly requested updates
    handleManualSync();
  });

  // 6. Handlers
  const handleManualSync = useCallback(async () => {
    try {
      await forceSync();
      toast.success('✅ Synchronisation terminée');
    } catch (e) {
      logger.error(e);
      toast.error('❌ Erreur lors de la synchronisation');
    }
  }, [forceSync]);

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
        const dismissId = typeof geolocationToastId === 'number' ? geolocationToastId.toString() : geolocationToastId;
        toast.dismiss(dismissId);
      }
      setGeolocationToastId(null);
      setIsGeolocationRequestInProgress(false);
    }
  }, [userLocation, geolocationError, geolocationToastId]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      if (result.type === 'household') {
        setSelectedHouseholdId(result.data.id);
        // ✅ Safe coordinate access with full validation
        const coords = result.data.location?.coordinates;
        if (coords && Array.isArray(coords) && coords.length === 2) {
          const [lng, lat] = coords;
          if (isValidCoordinate(lng, lat)) {
            setMapCommand({
              center: [lng, lat],
              zoom: 18,
              timestamp: Date.now(),
            });
          } else {
            logger.warn('Invalid coordinates received:', coords);
          }
        }
      } else {
        if (isValidCoordinate(result.lon, result.lat)) {
          const center: [number, number] = [result.lon, result.lat];
          setMapCommand({ center, zoom: 16, timestamp: Date.now() });
        } else {
          logger.warn('Invalid result coordinates:', { lon: result.lon, lat: result.lat });
        }
      }
      setSearchQuery('');
      setSearchResults([]);
    },
    [setSelectedHouseholdId, setMapCommand, setSearchQuery, setSearchResults]
  );

  const handleTraceItinerary = useCallback(() => {
    const h = households?.find((hh) => hh.id === selectedHouseholdId);
    if (!h || !hasValidCoordinates(h)) return;
    const [lng, lat] = h.location.coordinates;
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

  const confirmCreateProject = useCallback(async () => {
    if (newProjectName.trim()) {
      await createProject(newProjectName.trim());
      setShowCreateProjectModal(false);
      setNewProjectName('');
    }
  }, [newProjectName, createProject]);

  const handleDeleteProject = useCallback(async () => {
    if (!project?.id) return;

    // ✅ SECURITY: Check ratelimit
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remainingSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setDeleteError(`Trop de tentatives. Réessayez dans ${remainingSeconds}s.`);
      return;
    }

    if (!deletePassword) {
      setDeleteError('Veuillez entrer votre mot de passe.');
      return;
    }

    const result = await deleteProject(project.id, deletePassword);
    if (!result.success) {
      // ✅ SECURITY: Increment attempts and lock out after 3 tries
      const newAttempts = deleteAttempts + 1;
      setDeleteAttempts(newAttempts);
      if (newAttempts >= 3) {
        const lockoutTime = Date.now() + 5 * 60 * 1000; // 5 minutes lockout
        setLockoutUntil(lockoutTime);
        setDeleteError('Trop de tentatives. Veuillez réessayer dans 5 minutes.');
      } else {
        setDeleteError(result.error || 'Mot de passe incorrect.');
      }
      // ✅ Clear password for security
      setDeletePassword('');
      return;
    }

    // ✅ Success: Reset all state
    setShowDeleteModal(false);
    setDeletePassword('');
    setDeleteError('');
    setDeleteAttempts(0);
    setLockoutUntil(null);
    toast.success('Projet supprimé avec succès');
    navigate('/dashboard');
  }, [project, deletePassword, deleteProject, deleteAttempts, lockoutUntil, navigate]);

  // Keyboard shortcuts for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showDeleteModal || showCreateProjectModal) {
        e.preventDefault();
        setShowDeleteModal(false);
        setShowCreateProjectModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteModal, showCreateProjectModal]);

  useEffect(() => {
    if (showCreateProjectModal || showDeleteModal) {
      setTimeout(() => modalInputRef.current?.focus(), 50);
    }
  }, [showCreateProjectModal, showDeleteModal]);

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
      const grappeDef = allGrappes.find((g: GrappeDefinition) => g.id === gId);
      const grappeName =
        selectedHousehold.grappeName || grappeDef?.nom || grappeDef?.name || `Grappe ${gId}`;
      const grappeCount = (households || []).filter((h: Household) => h.grappeId === gId).length;
      return { id: gId, name: grappeName, count: grappeCount };
    }

    const coords = selectedHousehold.location?.coordinates;
    if (!coords || allGrappes.length === 0) return undefined;
    const [lng, lat] = coords;

    const hRegion =
      selectedHousehold.region ||
      selectedHousehold.koboData?.region ||
      selectedHousehold.koboSync?.region;
    const pool = hRegion
      ? allGrappes.filter(
          (g: GrappeDefinition) => (g.region && g.region.toLowerCase() === hRegion.toLowerCase()) || !g.region
        )
      : allGrappes;

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
    const count = (households || []).filter((h: Household) => h.grappeId === nearest.id).length;
    return {
      id: nearest.id,
      name: nearest.nom || nearest.name || `Grappe ${nearest.id}`,
      count: count || nearest.nb_menages || 0,
    };
  }, [selectedHousehold, households, grappesConfig?.grappes]);

  const peutVoirDataHub = peut(PERMISSIONS.GERER_UTILISATEURS) || user?.role === 'ADMIN_PROQUELEC';

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-950">
      {/* 🗺️ MAP / LIST LAYER */}
      <div className="absolute inset-0 z-0 pt-[110px] md:pt-0">
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
                      onZoneClick={(center, zoom) =>
                        setMapCommand({ center, zoom, timestamp: Date.now() })
                      }
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
                      showLegend={showLegend}
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
                className="h-full w-full overflow-hidden bg-[#0D1E35] z-[60] relative pt-24"
              >
                <HouseholdListView
                  households={filteredHouseholds}
                  isDarkMode
                  onSelectHousehold={(h: Household) => {
                    if (hasValidCoordinates(h)) {
                      setSelectedHouseholdId(h.id);
                      setMapCommand({
                        center: [h.location.coordinates[0], h.location.coordinates[1]],
                        zoom: 18,
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
        searchResults={searchResults}
        isSearching={isSearching}
        onSelectResult={handleSelectResult}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
        allAvailableTeams={allAvailableTeams}
        project={project}
        onSync={handleManualSync}
        onOpenDataHub={() => setPanel('datahub')}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRecenter={handleRecenterOnUser}
        peutVoirDataHub={peutVoirDataHub}
        isSyncing={false}
      />

      {/* 📊 BOTTOM OVERLAY */}
      <BottomBar
        filteredCount={(households?.filter(hasValidCoordinates) || []).length}
        totalCount={(households?.filter(hasValidCoordinates) || []).length}
        isOfflineMode={isOfflineMode}
        auditResult={auditResult}
        onFlyTo={(lng, lat) =>
          setMapCommand({ center: [lng, lat], zoom: 16, timestamp: Date.now() })
        }
      />

      {/* 🛠️ PANELS & MODALS */}
      {activePanel === 'routing' && (
        <div className="z-[70] absolute top-16 right-4">
          <MapRoutingPanel
            onClose={closePanel}
            households={households || []}
            isDarkMode
            turnByTurnInstructions={turnByTurnInstructions}
            routeDistance={routeStats?.distance}
            routeDuration={routeStats?.duration}
          />
        </div>
      )}

      <GeofencingAlerts households={filteredHouseholds} grappesConfig={grappesConfig} isDarkMode />

      {activePanel === 'draw' && (
        <div className="z-[70]">
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

      {activePanel === 'layers' && (
        <div className="z-[60]">
          <GeoJsonOverlayPanel />
        </div>
      )}
      {activePanel === 'grappe' && (
        <div className="z-[60]">
          <GrappeSelectorPanel
            onClose={closePanel}
            clusters={grappeClusters}
            isLoading={isClustersLoading}
            onSelectGrappe={(_id, bbox) =>
              bbox && window.dispatchEvent(new CustomEvent('fit-bounds', { detail: bbox }))
            }
          />
        </div>
      )}
      {activePanel === 'grappe_allocation' && (
        <div className="z-[60]">
          <MapGrappeAllocationPanel
            onClose={closePanel}
            activeGrappeId={activeGrappeId || ''}
            households={households || []}
          />
        </div>
      )}
      {activePanel === 'region' && (
        <div className="z-[60]">
          <MapRegionDownload onClose={closePanel} />
        </div>
      )}
      <DataHubModal isOpen={activePanel === 'datahub'} onClose={closePanel} />

      {selectedHousehold && (
        <HouseholdDetailsPanel
          household={selectedHousehold}
          onPhotoOpen={openLightbox}
          onStatusUpdate={(status) => updateHouseholdStatus(selectedHousehold.id, status)}
          onPhotoUpload={(file) => uploadHouseholdPhoto(selectedHousehold.id, file)}
          isFavorite={isFavorite}
          toggleFavorite={toggleFavorite}
          onTraceItinerary={handleTraceItinerary}
          onCancelItinerary={handleCancelItinerary}
          routeStats={routeStats || null}
          grappeInfo={selectedHouseholdGrappeInfo}
        />
      )}

      <AnimatePresence>{lightboxPhotos.length > 0 && <PhotoLightbox />}</AnimatePresence>

      <ProjectModals
        showCreate={showCreateProjectModal}
        showDelete={showDeleteModal}
        newProjectName={newProjectName}
        onNewProjectNameChange={setNewProjectName}
        deletePassword={deletePassword}
        onDeletePasswordChange={setDeletePassword}
        deleteError={deleteError}
        onCreateConfirm={confirmCreateProject}
        onDeleteConfirm={handleDeleteProject}
        onCloseCreate={() => setShowCreateProjectModal(false)}
        onCloseDelete={() => setShowDeleteModal(false)}
        modalInputRef={modalInputRef}
      />
    </div>
  );
};

export default React.memo(Terrain);
