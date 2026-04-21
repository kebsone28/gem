/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React, { useState, useMemo, Suspense, useRef, useEffect, useCallback } from 'react';
import logger from '../utils/logger';
import toast from 'react-hot-toast';

import { useTerrainPhoto } from '../hooks/useTerrainPhoto';
import { useTerrainData } from '../hooks/useTerrainData';
import { QuickActions, OfflineIndicator, FloatingPhotoButton } from '../components/terrain/QuickActions';
import { TerrainMissionEditor } from '../components/terrain/TerrainMissionEditor';
import { createMission, updateMission } from '../services/missionService';
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
import { isMasterAdmin } from '../utils/permissions';
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
import { ErrorBoundary } from '../components/ErrorBoundary';

import '../components/terrain/MapWidgets.css';

import { ContentArea } from '../components';

const Terrain: React.FC = () => {
  // 1. Core Data & Contexts
  const { households, updateHouseholdStatus, updateHouseholdLocation, uploadHouseholdPhoto, updateHousehold } =
    useTerrainData();

  const { project, createProject, deleteProject } = useProject();
  const { forceSync } = useSync();
  const { grappesConfig, warehouseStats, teams } = useLogistique();
  const { user } = useAuth();
  const { peut, PERMISSIONS } = usePermissions();

  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const [showMissionEditor, setShowMissionEditor] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

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

  // Terrain photo hook
  const { capturePhoto, selectFromGallery, isCapturing } = useTerrainPhoto({
    onPhotoCapture: async (file) => {
      if (!file) return;
      logger.log('📸 Photo capturée, début upload...', file.name);
      
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
      } catch (err) {
        toast.error('Erreur upload', { id: toastId });
      }
    },
  });

  // ✅ GUARD: Prevent double-initialization from StrictMode
  const syncInitializedRef = useRef(false);
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

  const handleRefresh = async () => {
    if (!project?.id) return;
    await forceSync();
  };

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
      setGeolocationToastId(null);
      setIsGeolocationRequestInProgress(false);
    }
  }, [userLocation, geolocationError, geolocationToastId]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      if (result.type === 'household') {
        setSelectedHouseholdId(result.data.id);
        const lng = Number(result.data.location?.coordinates?.[0] || result.data.longitude);
        const lat = Number(result.data.location?.coordinates?.[1] || result.data.latitude);

        if (isValidCoordinate(lng, lat)) {
          setMapCommand({
            center: [lng, lat],
            zoom: 18,
            timestamp: Date.now(),
          });
        } else {
          logger.warn('Invalid coordinates received for household:', result.data.id);
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
      const grappeDef = (allGrappes as any[]).find((g: any) => g.id === gId);
      const grappeName =
        selectedHousehold.grappeName || grappeDef?.nom || grappeDef?.name || `Grappe ${gId}`;
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
        searchResults={searchResults as any}
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
            turnByTurnInstructions={turnByTurnInstructions as any}
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
          onUpdate={(id, patch) => updateHousehold(id, patch)}
          isFavorite={isFavorite(selectedHousehold.id)}
          toggleFavorite={() => toggleFavorite(selectedHousehold.id)}
          onTraceItinerary={handleTraceItinerary}
          onCancelItinerary={handleCancelItinerary}
          routeStats={routeStats || null}
          grappeInfo={selectedHouseholdGrappeInfo}
          isAdmin={peut(PERMISSIONS.MODIFIER_CARTE)}
        />
      )}

      <AnimatePresence>{lightboxPhotos.length > 0 && <PhotoLightbox />}</AnimatePresence>

      {/* 🆕 Terrain Mode Enhancements */}
      <OfflineIndicator isOffline={isOfflineMode} pendingCount={pendingSyncCount} />
      
      <QuickActions
        onPhoto={() => capturePhoto()}
        onStatus={() => setShowMissionEditor(true)}
        onNote={() => setShowMissionEditor(true)}
        onNavigate={handleRecenterOnUser}
      />

      <FloatingPhotoButton
        onCapture={capturePhoto}
        onSelect={selectFromGallery}
        disabled={isCapturing}
      />

      {/* Mission Editor Modal */}
      <AnimatePresence>
        {showMissionEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowMissionEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
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
                    logger.log('💾 Sauvegarde brouillon mission sur serveur...', mission);
                    const result = await createMission({
                      ...mission,
                      status: 'draft',
                      organizationId: user?.organizationId
                    });
                    if (result) {
                      toast.success('Mission sauvegardée comme brouillon');
                      setShowMissionEditor(false);
                    }
                  } catch (err) {
                    toast.error('Erreur lors de la sauvegarde');
                  }
                }}
                onSubmit={async (mission) => {
                  try {
                    logger.log('📤 Soumission mission sur serveur...', mission);
                    const result = await createMission({
                      ...mission,
                      status: 'soumise',
                      organizationId: user?.organizationId
                    });
                    if (result) {
                      toast.success('Mission soumise avec succès');
                      setShowMissionEditor(false);
                    }
                  } catch (err) {
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
