import React, { useState, useMemo, useCallback, Suspense, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import * as safeStorage from '../utils/safeStorage';
import logger from '../utils/logger';
import toast from 'react-hot-toast';

import {
    MapPin,
    LayoutList,
    Search,
    RefreshCw,
    Plus,
    Wifi,
    Trash2
} from 'lucide-react';
import { useTerrainData } from '../hooks/useTerrainData';
import { useAuth } from '../contexts/AuthContext';
const MapComponent = React.lazy(() => import('../components/terrain/MapComponent'));
import type { Household } from '../utils/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { DataHubModal } from '../components/terrain/DataHubModal';
import { useProject } from '../hooks/useProject';
import { useSync } from '../contexts/SyncContext';
import { useLogistique } from '../hooks/useLogistique';
import { usePermissions } from '../hooks/usePermissions';
import { MapRoutingPanel } from '../components/terrain/MapRoutingPanel';
import { GeofencingAlerts } from '../components/terrain/GeofencingAlerts';
import { PhotoLightbox } from '../components/terrain/PhotoLightbox';
import { MapDrawZonesPanel, useDrawnZones } from '../components/terrain/MapDrawZones';
import { GeoJsonOverlayPanel } from '../components/terrain/GeoJsonOverlay';
import type { ExternalLayer } from '../components/terrain/GeoJsonOverlay';
import { TeamTrackingPanel } from '../components/terrain/TeamTracking';
import { GrappeSelectorPanel } from '../components/terrain/GrappeSelectorPanel';
import { MapRegionDownload } from '../components/terrain/MapRegionDownload';
import { HouseholdDetailsPanel } from '../components/terrain/HouseholdDetailsPanel';
import { useFavorites } from '../hooks/useFavorites';
import { MapToolbar } from '../components/terrain/MapToolbar';

import {
    StatusBadge,
    ActionBar
} from '../components/dashboards/DashboardComponents';
import { useGeolocation } from '../hooks/useGeolocation';
import { useMapFilters, hasValidCoordinates, type SearchResult, ALL_STATUSES } from '../hooks/useMapFilters';
import { HouseholdListView } from '../components/terrain/HouseholdListView';

const Terrain: React.FC = () => {
    const renderCountRef = useRef(0);
    renderCountRef.current++;

    const {
        households,
        updateHouseholdStatus,
        updateHouseholdLocation,
        uploadHouseholdPhoto
    } = useTerrainData();

    const { project, projects, setActiveProjectId, createProject, deleteProject } = useProject();
    const { forceSync } = useSync();
    const isSyncing = false; // Sync is now background-only
    const { grappesConfig, warehouseStats, teams } = useLogistique();

    const { user } = useAuth();
    const { peut, PERMISSIONS } = usePermissions();

    const allAvailableTeams = useMemo(() => {
        const fromDB = (teams || []).map(t => t.name);
        const fromHouseholds = (households || []).reduce((acc, h) => {
            if (Array.isArray(h.assignedTeams)) {
                h.assignedTeams.forEach(at => acc.add(at));
            }
            return acc;
        }, new Set<string>());
        return Array.from(new Set([...fromDB, ...fromHouseholds])).sort();
    }, [teams, households]);
    const { isFavorite, toggleFavorite, favorites: localFavorites } = useFavorites(project?.id);

    const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const { isDarkMode } = useTheme();

    const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);

    // ✅ REFS for map position (Prevents re-renders during drag/zoom)
    const mapCenterRef = useRef<[number, number]>([-14.65, 14.45]);
    const mapZoomRef = useRef(7);

    // ✅ COMMAND STATE for programmatic movements (Search results, list clicks)
    const [mapCommand, setMapCommand] = useState<{ center: [number, number]; zoom: number; timestamp: number } | null>(null);

    const {
        selectedPhases,
        handleTogglePhase,
        selectedTeam,
        setSelectedTeam,
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        isSearching,
        debouncedSearch,
        filteredHouseholds,
        visibleHouseholds
    } = useMapFilters(households, mapBounds);

    const {
        userLocation,
        geolocationError,
        handleRequestGeolocation
    } = useGeolocation((loc) => {
        setMapCommand({ center: loc, zoom: 16, timestamp: Date.now() });
    });
    const [routingEnabled, setRoutingEnabled] = useState(false);
    const [showZones, setShowZones] = useState(false);
    const [showWarehouses] = useState(true);
    const [isDataHubOpen, setIsDataHubOpen] = useState(false);
    const [routingStart, setRoutingStart] = useState<[number, number] | null>(null);
    const [routingDest, setRoutingDest] = useState<[number, number] | null>(null);
    const [followUser, setFollowUser] = useState(false);
    const [routeStats, setRouteStats] = useState<{ distance: number; duration: number } | null>(null);
    const [turnByTurnInstructions, setTurnByTurnInstructions] = useState<any[]>([]);

    const [isMeasuring, setIsMeasuring] = useState(false);
    const [showDatabaseStats, setShowDatabaseStats] = useState(false);
    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
    const [isSelecting, setIsSelecting] = useState(false);
    const [showRoutingPanel, setShowRoutingPanel] = useState(false);
    const [showDrawPanel, setShowDrawPanel] = useState(false);
    const [showLayersPanel, setShowLayersPanel] = useState(false);
    const [showTrackingPanel, setShowTrackingPanel] = useState(false);
    const [showGrappePanel, setShowGrappePanel] = useState(false);
    const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; label: string }[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Drawing zones & layers
    const { zones: drawnZones, addZone, deleteZone } = useDrawnZones();
    const [isDrawing, setIsDrawing] = useState(false);

    const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);
    const [showRegionDownload, setShowRegionDownload] = useState(false);
    const [downloadedRegions, setDownloadedRegions] = useState<string[]>(JSON.parse(safeStorage.getItem('downloaded_regions') || '[]'));
    // const [requestingGeolocation, setRequestingGeolocation] = useState(false);

    // Initial geolocation check (not request)

// ✅ Automatic geolocation now handled by useGeolocation

    const handleRecenterOnUser = () => {
        if (userLocation) {
            setMapCommand({ center: userLocation, zoom: 16, timestamp: Date.now() });
        } else if (geolocationError) {
            // If permission denied, try to request again
            handleRequestGeolocation();
        } else {
            toast.loading('En attente de votre position... ⏳', { duration: 3000 });
        }
    };

    // handleRequestGeolocation now handled by useGeolocation
    const [pendingPoints, setPendingPoints] = useState<[number, number][]>([]);
    const [externalLayers, setExternalLayers] = useState<ExternalLayer[]>([]);
    const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

    // Grappe Clustering State
    const [activeGrappeId, setActiveGrappeId] = useState<string | null>(null);
    const [grappeClusters, setGrappeClusters] = useState<any[]>([]);
    const [grappeZonesData, setGrappeZonesData] = useState<any>(null);
    const [grappeCentroidsData, setGrappeCentroidsData] = useState<any>(null);
    const [isClustersLoading, setIsClustersLoading] = useState<boolean>(true);



    React.useEffect(() => {
        const handleStatus = () => setIsOfflineMode(!navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);
        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, []);

    // ✅ Auto-sync now managed by SyncProvider globally
    // No need to manually sync on mount here




    // Init Web Worker (doit utiliser type: module pour les imports ESM dans le worker)
    const clusterWorker = useMemo(() => new Worker(new URL('../workers/clusterWorker.ts', import.meta.url), { type: 'module' }), []);

    React.useEffect(() => {
        if (!households || households.length === 0) return;
        setIsClustersLoading(true);

        clusterWorker.onmessage = (e) => {
            if (e.data.success) {
                setGrappeClusters(e.data.panelData);
                setGrappeZonesData(e.data.zones);
                setGrappeCentroidsData(e.data.centroids);
                setIsClustersLoading(false);
            }
        };

        // Format the households slightly if needed or just pass as is
        // We ensure lat/lon are numbers
        const workerData = households
            .filter((h: any) => h.location?.coordinates && !isNaN(Number(h.location.coordinates[0])) && !isNaN(Number(h.location.coordinates[1])))
            .map((h: any) => ({
                id: h.id,
                lat: Number(h.location.coordinates[1]),
                lon: Number(h.location.coordinates[0])
            }));

        clusterWorker.postMessage({ households: workerData, maxPerCluster: 80 });
    }, [households, clusterWorker]);




    const handleManualSync = async () => {
        try {
            await forceSync();
            toast.success('✅ Synchronisation demandée');
        } catch (e) {
            logger.error(e);
            toast.error('❌ Erreur lors de la synchronisation');
        }
    };

    const peutModifierCarte = peut(PERMISSIONS.MODIFIER_CARTE);
    const peutGererProjets = peut(PERMISSIONS.CREER_PROJET);
    const peutSupprimerProjet = peut(PERMISSIONS.SUPPRIMER_PROJET);
    const peutVoirDataHub = peut(PERMISSIONS.GERER_UTILISATEURS) || user?.role === 'ADMIN_PROQUELEC';

    const handleCreateProject = async () => {
        if (!peutGererProjets) return;
        const name = prompt("Nom du nouveau projet :");
        if (name) {
            await createProject(name);
        }
    };

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');

    const handleDeleteProject = async () => {
        if (!peutSupprimerProjet || !project?.id) return;
        if (!deletePassword) {
            setDeleteError('Veuillez entrer votre mot de passe de connexion.');
            return;
        }
        const result = await deleteProject(project.id, deletePassword);
        if (!result.success) {
            setDeleteError(result.error || 'Mot de passe incorrect.');
            return;
        }
        setShowDeleteModal(false);
        setDeletePassword('');
        setDeleteError('');
    };

    const handleDownloadRegion = async (region: any) => {
        setIsDownloadingOffline(true);
        try {
            const martinUrl = import.meta.env.VITE_MARTIN_URL || 'http://localhost:3000';
            const cache = await caches.open('households-mvt-cache');

            // Fetch a few sample tiles to populate cache
            const samples = [
                `${martinUrl}/public.Household/12/2048/2048`,
                `${martinUrl}/public.Household/12/2049/2048`
            ];

            await Promise.all(samples.map(url => cache.add(url).catch(() => { })));
            await new Promise(r => setTimeout(r, 1000));

            const newRegions = [...downloadedRegions, region.id];
            setDownloadedRegions(newRegions);
            safeStorage.setItem('downloaded_regions', JSON.stringify(newRegions));
            toast.success(`Région ${region.name} téléchargée !`);
        } catch (e) {
            toast.error("Erreur lors du téléchargement");
        } finally {
            setIsDownloadingOffline(false);
        }
    };

    const handleRemoveRegion = (id: string) => {
        const newRegions = downloadedRegions.filter(r => r !== id);
        setDownloadedRegions(newRegions);
        safeStorage.setItem('downloaded_regions', JSON.stringify(newRegions));
        toast.success("Région supprimée du cache");
    };



    const handleConfirmZone = (name: string, team: string, color: string) => {
        if (pendingPoints.length < 3) return;
        
        const newZone: any = {
            id: `zone_${Date.now()}`,
            name,
            team,
            color,
            coordinates: pendingPoints,
            createdAt: new Date().toISOString()
        };
        
        addZone(newZone);
        setIsDrawing(false);
        setPendingPoints([]);
        toast.success(`Zone "${name}" enregistrée !`);
    };

    const [visibleWidgets] = useState({
        legend: true
    });

    // handleTogglePhase and selectedTeam now managed by useMapFilters
    // const [dateRange, setDateRange] = useState<'all' | '7d' | '30d'>('all');


    const householdList = (households || []) as Household[];

    // hasValidCoordinates, filteredHouseholds, visibleHouseholds now managed by useMapFilters

    // Update stats AFTER filtering (using useEffect to avoid infinite render loop)
    React.useEffect(() => {
        const totalHouseholds = householdList.length;
        const withoutCoords = householdList.filter(h => !hasValidCoordinates(h)).length;
        const withCoords = totalHouseholds - withoutCoords;
        const afterFilters = filteredHouseholds.length;
        
        // Debug logs
        console.log('🔍 [TERRAIN DEBUG] Total ménages:', totalHouseholds);
        if (totalHouseholds > 0) {
            console.log('🏠 [TERRAIN DEBUG] Premier ménage:', householdList[0]);
            console.log('🏠 [TERRAIN DEBUG] Location du premier:', householdList[0]?.location);
            console.log('🏠 [TERRAIN DEBUG] Coordinates du premier:', householdList[0]?.location?.coordinates);
        }
        
        // Afficher les 5 premiers et leurs coords
        householdList.slice(0, 5).forEach((h, i) => {
            console.log(`  👤 H${i}:`, {
                id: h.id,
                coords: h.location?.coordinates,
                isValid: hasValidCoordinates(h),
                locationExists: !!h.location,
                coordsIsArray: Array.isArray(h.location?.coordinates),
                coordsLength: h.location?.coordinates?.length
            });
        });
        

        
        if (totalHouseholds > 0) {
            logger.log(`📊 MÉNAGES: Total=${totalHouseholds}, Valid coords=${withCoords} (${((withCoords/totalHouseholds)*100).toFixed(1)}%), Sans coords=${withoutCoords} (${((withoutCoords/totalHouseholds)*100).toFixed(1)}%), Après filtres=${afterFilters}`);
        }
    }, [filteredHouseholds, householdList]);

    // performSearch and debouncedSearch handled by useMapFilters

    const handleSelectResult = (result: SearchResult) => {
        if (result.type === 'household') {
            setSelectedHousehold(result.data);
            if (result.data.location?.coordinates) {
                // ✅ Use [lng, lat] directly from GeoJSON
                setMapCommand({ 
                    center: [result.data.location.coordinates[0], result.data.location.coordinates[1]], 
                    zoom: 18, 
                    timestamp: Date.now() 
                });
            }
        } else {
            // ✅ Nominatim returns [lat, lon], swap to [lng, lat] for MapLibre consistency
            setMapCommand({ center: [result.lon, result.lat], zoom: 16, timestamp: Date.now() });
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleZoneClick = (center: [number, number], zoom: number) => {
        setMapCommand({ center, zoom, timestamp: Date.now() });
    };



    // handleRecenter is now handled inline in MapToolbar
    // const handleRecenter = () => { ... }

    const handleLassoSelection = useCallback((ids: string[]) => {
        if (ids.length > 0) {
            toast.success(`${ids.length} ménages sélectionnés !`, {
                icon: '🎯',
                style: {
                    borderRadius: '16px',
                    background: isDarkMode ? '#1e293b' : '#fff',
                    color: isDarkMode ? '#f8fafc' : '#1e293b',
                    border: '1px solid rgba(79, 70, 229, 0.2)',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    letterSpacing: '0.05em'
                }
            });
        }
    }, [isDarkMode]);

    const handleMapMove = (center: [number, number], zoom: number) => {
        mapCenterRef.current = center;
        mapZoomRef.current = zoom;
    };



    const handleTraceItinerary = () => {
        if (!selectedHousehold || !selectedHousehold.location?.coordinates) return;
        // ✅ Keep as [lng, lat] - consistent with map standard
        const dest: [number, number] = [selectedHousehold.location.coordinates[0], selectedHousehold.location.coordinates[1]];

        setRoutingDest(dest);
        setRoutingEnabled(true);
        setRouteStats(null); // Reset stats when starting new route

        if (userLocation) {
            setRoutingStart(userLocation);
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                // ✅ Set as [lng, lat]
                setRoutingStart([pos.coords.longitude, pos.coords.latitude]);
            }, () => {
                toast.error("Géolocalisation impossible");
                setRoutingStart(null);
            });
        }
    };

    const handleRouteFound = (stats: { distance: number; duration: number; instructions?: any[]; geometry?: any } | null) => {
        setRouteStats(stats ? { distance: stats.distance, duration: stats.duration } : null);
        setTurnByTurnInstructions(stats?.instructions || []);
        
        // ✅ Auto-fit bounds if we have geometry
        if (stats?.geometry && stats.geometry.coordinates?.length > 0) {
            const coords = stats.geometry.coordinates;
            const bounds = coords.reduce(
                (b: maplibregl.LngLatBounds, coord: [number, number]) => b.extend(coord),
                new maplibregl.LngLatBounds(coords[0], coords[0])
            );
            
            // Dispatch custom event to trigger fitBounds in MapLibreVectorMap
            window.dispatchEvent(new CustomEvent('fit-bounds', { detail: [bounds.getSouthWest().toArray(), bounds.getNorthEast().toArray()] }));
        }
    };

    const handleCancelItinerary = () => {
        setRoutingEnabled(false);
        setRoutingDest(null);
        setRouteStats(null);
        setTurnByTurnInstructions([]);
        setFollowUser(false);
        toast.success("Itinéraire annulé");
    };

    return (
        <>
            <div className={`flex flex-col h-full overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-[#F8FAFC] text-slate-900'}`}>

                {/* ── CONSOLIDATED HEADER (Google Maps Style) ── */}
                <div className={`z-50 border-b shadow-sm transition-colors ${isDarkMode ? 'bg-slate-900/90 border-white/5' : 'bg-white border-gray-100'} backdrop-blur-2xl`}>
                    <div className="px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 shrink-0">
                            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <MapPin size={18} className="text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-black tracking-tight uppercase italic leading-none">Map Explorer</h1>
                                    <StatusBadge status="success" label="Live" />
                                </div>
                            </div>
                        </div>

                        {/* Integrated Tools in Top Bar */}
                        <div className="flex flex-1 items-center justify-center max-w-2xl px-4">
                            <div className={`w-full max-w-[400px] flex items-center p-0.5 rounded-xl border transition-all ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex-1 flex items-center gap-2 px-3">
                                    {isSearching ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div> : <Search size={14} className="text-slate-400" />}
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); debouncedSearch(e.target.value); }}
                                        title="Rechercher"
                                        placeholder="Rechercher une borne, un village ou un client..."
                                        className={`w-full bg-transparent border-none outline-none text-[11px] font-bold py-2 ${isDarkMode ? 'text-white placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-400'}`}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <div className="hidden lg:flex items-center gap-1 bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-100 dark:border-white/5">
                                <select
                                    value={project?.id || ''}
                                    onChange={(e) => setActiveProjectId(e.target.value)}
                                    title="Sélectionner un projet"
                                    className="bg-transparent border-none text-[11px] font-bold uppercase tracking-tight outline-none cursor-pointer px-3 py-1 text-blue-600"
                                >
                                    {(projects || []).map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                {peutGererProjets && (
                                    <button onClick={handleCreateProject} title="Créer un projet" className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-blue-600 transition-all object-contain">
                                        <Plus size={14} />
                                    </button>
                                )}
                                {peutSupprimerProjet && project?.id && (
                                    <button onClick={() => setShowDeleteModal(true)} title="Supprimer ce projet" className="p-1.5 hover:bg-white dark:hover:bg-rose-500/10 rounded-lg text-gray-400 hover:text-rose-500 transition-all object-contain">
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>

                            <ActionBar>
                                <button
                                    onClick={handleManualSync}
                                    disabled={isSyncing}
                                    className="p-2 bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all disabled:opacity-50"
                                    title="Synchroniser"
                                >
                                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                                </button>

                                {peutVoirDataHub && (
                                    <button
                                        onClick={() => setIsDataHubOpen(true)}
                                        className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10"
                                    >
                                        Données
                                    </button>
                                )}

                                <button
                                    onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
                                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-indigo-600 transition-all shadow-sm"
                                >
                                    {viewMode === 'map' ? <LayoutList size={14} /> : <MapPin size={14} />}
                                    <span className="hidden md:inline">{viewMode === 'map' ? 'Liste' : 'Carte'}</span>
                                </button>
                            </ActionBar>
                        </div>
                    </div>

                    {/* Sub-Header: Status Controls & Point Count */}
                    <div className="px-6 py-2 border-t border-gray-50 dark:border-white/5 flex items-center justify-between overflow-x-auto scrollbar-none gap-8">


                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-4 border-l dark:border-white/5 pl-6">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Équipe:</span>
                                <select
                                    value={selectedTeam}
                                    onChange={(e) => setSelectedTeam(e.target.value)}
                                    title="Filtrer par équipe"
                                    className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-[9px] font-black uppercase tracking-widest rounded-lg px-3 py-1.5 outline-none cursor-pointer text-slate-900 dark:text-white"
                                >
                                    <option value="all">Toutes les équipes</option>
                                    {allAvailableTeams.map(teamName => (
                                        <option key={teamName} value={teamName}>{teamName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <span className={`text-[9px] font-black px-2 py-1 rounded-md ${filteredHouseholds.length > 5000 ? 'text-red-600 bg-red-50 dark:bg-red-500/10' : 'text-blue-600 bg-blue-50 dark:bg-blue-500/10'}`}>
                                {filteredHouseholds.length} POINTS VISIBLES
                            </span>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isOfflineMode ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-emerald-500/10 border-emerald-500 text-emerald-500'}`}>
                                <Wifi size={12} className={isOfflineMode ? 'text-red-500' : 'text-emerald-500'} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">{isOfflineMode ? 'Offline' : 'Online'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <MapToolbar 
                    onZoomIn={() => setMapCommand({ center: mapCenterRef.current, zoom: Math.min(mapZoomRef.current + 1, 20), timestamp: Date.now() })}
                    onZoomOut={() => setMapCommand({ center: mapCenterRef.current, zoom: Math.max(mapZoomRef.current - 1, 1), timestamp: Date.now() })}
                    onRecenter={() => setMapCommand({ center: [-14.65, 14.45], zoom: 7, timestamp: Date.now() })}
                    onLocate={handleRecenterOnUser}
                    onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
                    onToggleZones={() => setShowZones(!showZones)}
                    showHeatmap={showHeatmap}
                    showZones={showZones}
                    isMeasuring={isMeasuring}
                    onToggleMeasuring={() => setIsMeasuring(!isMeasuring)}
                    showDatabaseStats={showDatabaseStats}
                    onToggleDatabaseStats={() => setShowDatabaseStats(!showDatabaseStats)}
                    mapStyle={mapStyle}
                    onToggleMapStyle={() => setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')}
                    isSelecting={isSelecting}
                    onToggleSelection={() => setIsSelecting(!isSelecting)}
                    showRoutingPanel={showRoutingPanel}
                    onToggleRouting={() => setShowRoutingPanel(!showRoutingPanel)}
                    showDrawPanel={showDrawPanel}
                    onToggleDraw={() => setShowDrawPanel(!showDrawPanel)}
                    showLayersPanel={showLayersPanel}
                    onToggleLayers={() => setShowLayersPanel(!showLayersPanel)}
                    showTrackingPanel={showTrackingPanel}
                    onToggleTracking={() => setShowTrackingPanel(!showTrackingPanel)}
                    showGrappePanel={showGrappePanel}
                    onToggleGrappe={() => setShowGrappePanel(!showGrappePanel)}
                    showRegionDownload={showRegionDownload}
                    onToggleRegionDownload={() => setShowRegionDownload(!showRegionDownload)}
                    isDownloadingOffline={isDownloadingOffline}
                />

                {/* Main Area */}
                <div className="flex-1 flex overflow-hidden relative">
                    <div className="flex-1 relative p-0 transition-all">
                        <AnimatePresence mode="wait">
                            {viewMode === 'map' ? (
                                <motion.div
                                    key="map"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`h-full w-full map-container relative`}
                                >
                                    <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Chargement cartographique...</div>}>
                                        <MapComponent
                                            households={filteredHouseholds}
                                            isFilteringActive={selectedTeam !== 'all' || selectedPhases.length !== ALL_STATUSES.length || searchQuery.trim().length > 0}
                                            onSelect={setSelectedHousehold}
                                            mapCommand={mapCommand}
                                            showHeatmap={showHeatmap}
                                            routingEnabled={routingEnabled}
                                            onRoutingClose={() => setRoutingEnabled(false)}
                                            showZones={showZones}
                                            showLegend={visibleWidgets.legend}
                                            activeHouseholdId={selectedHousehold?.id}
                                            routingStart={routingStart}
                                            routingDest={routingDest}
                                            onToggleStatus={handleTogglePhase}
                                            onZoneClick={handleZoneClick}
                                            selectedPhases={selectedPhases}
                                            grappesConfig={grappesConfig}
                                            readOnly={!peutModifierCarte}
                                            isMeasuring={isMeasuring}
                                            isSelecting={isSelecting}
                                            showDatabaseStats={showDatabaseStats}
                                            mapStyle={mapStyle}
                                            grappeZonesData={grappeZonesData}
                                            grappeCentroidsData={grappeCentroidsData}
                                            activeGrappeId={activeGrappeId}
                                            userLocation={userLocation}
                                            followUser={followUser}
                                            onHouseholdDrop={updateHouseholdLocation}
                                            onRouteFound={handleRouteFound}
                                            favorites={localFavorites}
                                            onMove={handleMapMove}
                                            onBoundsChange={setMapBounds}
                                            onLassoSelection={handleLassoSelection}
                                            isDrawing={isDrawing}
                                            pendingPoints={pendingPoints}
                                            onAddPoint={(pt: [number, number]) => setPendingPoints(prev => [...prev, pt])}
                                            drawnZones={drawnZones}
                                            visibleHouseholds={visibleHouseholds}
                                            warehouses={showWarehouses ? warehouseStats : []}
                                            projectId={project?.id}
                                        />
                                    </Suspense>
                                    {/* Routing Panel Overlay */}
                                    {showRoutingPanel && (
                                        <MapRoutingPanel
                                            households={filteredHouseholds}
                                            isDarkMode={isDarkMode}
                                            onClose={() => setShowRoutingPanel(false)}
                                            turnByTurnInstructions={turnByTurnInstructions}
                                            routeDistance={routeStats?.distance}
                                            routeDuration={routeStats?.duration}
                                        />
                                    )}
                                    {/* Geofencing Alert Overlay */}
                                    <GeofencingAlerts
                                        households={filteredHouseholds}
                                        grappesConfig={grappesConfig}
                                        isDarkMode={isDarkMode}
                                    />
                                    {/* Draw Zones Panel */}
                                    {showDrawPanel && (
                                        <MapDrawZonesPanel
                                            isDrawing={isDrawing}
                                            onStartDraw={() => setIsDrawing(true)}
                                            pendingPoints={pendingPoints}
                                            onConfirmZone={handleConfirmZone}
                                            onCancelDraw={() => { setIsDrawing(false); setPendingPoints([]); }}
                                            zones={drawnZones}
                                            onDeleteZone={deleteZone}
                                            isDarkMode={isDarkMode}
                                        />
                                    )}
                                    {/* External Layers Panel */}
                                    {showLayersPanel && (
                                        <GeoJsonOverlayPanel
                                            layers={externalLayers}
                                            onLayersChange={setExternalLayers}
                                            isDarkMode={isDarkMode}
                                        />
                                    )}
                                    {/* Team Tracking Panel */}
                                    {showTrackingPanel && (
                                        <TeamTrackingPanel
                                            isDarkMode={isDarkMode}
                                        />
                                    )}
                                    {/* Grappe Selector Panel */}
                                    {showGrappePanel && (
                                        <GrappeSelectorPanel
                                            isDarkMode={isDarkMode}
                                            onClose={() => setShowGrappePanel(false)}
                                            clusters={grappeClusters}
                                            activeGrappeId={activeGrappeId}
                                            isLoading={isClustersLoading}
                                            onSelectGrappe={(id, bbox) => {
                                                setActiveGrappeId(id);
                                                if (bbox) {
                                                    // On utilise un événement custom ou MapComponent s'occupera du fitBounds si on lui passe le bbox.
                                                    // Pour le moment on laisse MapComponent gérer le recadrage si on veut, ou on peut lancer un event window.
                                                    window.dispatchEvent(new CustomEvent('fit-bounds', { detail: bbox }));
                                                }
                                            }}
                                        />
                                    )}
                                    {/* Region Download Panel */}
                                    {showRegionDownload && (
                                        <MapRegionDownload
                                            onClose={() => setShowRegionDownload(false)}
                                            onDownload={handleDownloadRegion}
                                            downloadedRegions={downloadedRegions}
                                            onRemove={handleRemoveRegion}
                                        />
                                    )}
                                    {searchResults.length > 0 && searchQuery && (
                                        <div className={`absolute top-4 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] md:w-full max-w-md mx-auto rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden z-[4000] ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
                                            <div className="max-h-60 overflow-y-auto">
                                                {searchResults.map((res, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleSelectResult(res)}
                                                        className={`w-full text-left px-4 py-3 text-[10px] font-black border-b last:border-0 transition-colors uppercase tracking-widest ${isDarkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-100 text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black italic ${res.type === 'household' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                                {res.type === 'household' ? 'MÉNERGE' : 'LIEU'}
                                                            </span>
                                                            <span className="truncate">{res.label}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <HouseholdListView
                                    households={filteredHouseholds}
                                    isDarkMode={isDarkMode}
                                    onSelectHousehold={setSelectedHousehold}
                                />
                            )}
                        </AnimatePresence>
                    </div>

                    <AnimatePresence>
                        {selectedHousehold && (
                            <HouseholdDetailsPanel
                                household={selectedHousehold}
                                isDarkMode={isDarkMode}
                                onClose={() => { 
                                    setSelectedHousehold(null); 
                                    setRouteStats(null); 
                                    setRoutingEnabled(false); 
                                }}
                                onPhotoOpen={(photos, index) => {
                                    setLightboxPhotos(photos);
                                    setLightboxIndex(index);
                                }}
                                onStatusUpdate={async (status) => {
                                    await updateHouseholdStatus(selectedHousehold.id, status);
                                }}
                                onPhotoUpload={async (file) => {
                                    return await uploadHouseholdPhoto(selectedHousehold.id, file);
                                }}
                                isFavorite={isFavorite}
                                toggleFavorite={toggleFavorite}
                                onTraceItinerary={handleTraceItinerary}
                                onCancelItinerary={handleCancelItinerary}
                                routingEnabled={routingEnabled}
                                followUser={followUser}
                                setFollowUser={setFollowUser}
                                routeStats={routeStats || null}
                                grappeInfo={(() => {
                                    const gId = selectedHousehold.grappeId;
                                    const allGrappes: any[] = grappesConfig?.grappes || [];

                                    // Helper: Haversine distance in km
                                    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                                        const R = 6371;
                                        const dLat = (lat2 - lat1) * Math.PI / 180;
                                        const dLon = (lon2 - lon1) * Math.PI / 180;
                                        const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
                                        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                    };

                                    if (gId) {
                                        // Direct lookup in grappesConfig (uses `nom` field, not `name`)
                                        const grappeDef = allGrappes.find((g: any) => g.id === gId);
                                        const grappeName = selectedHousehold.grappeName
                                            || grappeDef?.nom
                                            || grappeDef?.name
                                            || `Grappe ${gId}`;
                                        const grappeCount = (households || []).filter((h: Household) => h.grappeId === gId).length;
                                        return { id: gId, name: grappeName, count: grappeCount };
                                    }

                                    // Spatial fallback: find nearest grappe centroid (filtered by household region)
                                    const coords = selectedHousehold.location?.coordinates;
                                    if (!coords || allGrappes.length === 0) return undefined;
                                    const [lng, lat] = coords;
                                    
                                    // Robust region extraction (from top-level, koboData or koboSync)
                                    const hRegion = selectedHousehold.region 
                                        || (selectedHousehold.koboData as any)?.region 
                                        || (selectedHousehold.koboSync as any)?.region;

                                    // Prefer same region, else any grappe (case-insensitive matching)
                                    const candidates = hRegion
                                        ? allGrappes.filter((g: any) => 
                                            (g.region && g.region.toLowerCase() === hRegion.toLowerCase()) || !g.region
                                          )
                                        : allGrappes;
                                    const pool = candidates.length > 0 ? candidates : allGrappes;

                                    let nearest: any = null;
                                    let minDist = Infinity;
                                    for (const g of pool) {
                                        if (g.centroide_lat == null || g.centroide_lon == null) continue;
                                        const d = haversine(lat, lng, g.centroide_lat, g.centroide_lon);
                                        if (d < minDist) { minDist = d; nearest = g; }
                                    }

                                    if (!nearest || minDist > 150) return undefined; // >150 km = no match
                                    const grappeName = nearest.nom || nearest.name || `Grappe ${nearest.id}`;
                                    
                                    // Calculate how many households are in this same nearest grappe (using same region as proxy if ID not assigned)
                                    const grappeCount = (households || []).filter((h: Household) => {
                                        if (h.grappeId === nearest.id) return true;
                                        const hReg = h.region || (h.koboData as any)?.region || (h.koboSync as any)?.region;
                                        if (!hReg || !nearest.region) return false;
                                        return hReg.toLowerCase() === nearest.region.toLowerCase();
                                    }).length;

                                    return { 
                                        id: nearest.id, 
                                        name: grappeName, 
                                        count: grappeCount || nearest.nb_menages || 0 
                                    };
                                })()}
                            />
                        )}
                    </AnimatePresence>
                </div>

                <DataHubModal isOpen={isDataHubOpen} onClose={() => setIsDataHubOpen(false)} />



                {showDeleteModal && (
                    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className={`w-full max-w-md rounded-3xl shadow-2xl border p-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Supprimer le Projet</h2>
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                className="w-full px-4 py-3 mt-4 rounded-xl border"
                                placeholder="Mot de passe admin"
                            />
                            {deleteError && <p className="text-rose-500 text-xs mt-2">{deleteError}</p>}
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 rounded-xl border">Annuler</button>
                                <button onClick={handleDeleteProject} className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-black">Supprimer</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {lightboxPhotos.length > 0 && (
                    <PhotoLightbox
                        photos={lightboxPhotos}
                        initialIndex={lightboxIndex}
                        onClose={() => setLightboxPhotos([])}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default React.memo(Terrain);
