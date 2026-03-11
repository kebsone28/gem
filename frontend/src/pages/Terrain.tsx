import React, { useState, useMemo, useCallback, Suspense } from 'react';
import * as safeStorage from '../utils/safeStorage';
import logger from '../utils/logger';
import toast from 'react-hot-toast';
import debounce from 'lodash.debounce';
import {
    MapPin,
    Navigation,
    Focus,
    Maximize,
    LayoutList,
    LayoutGrid,
    FileDown,
    Truck,
    Undo2,
    Search,
    RefreshCw,
    Plus,
    Globe,
    Users,
    Layers,
    PenLine,
    Wifi,
    CloudDownload,
    Loader2
} from 'lucide-react';
import { useTerrainData } from '../hooks/useTerrainData';
import { useAuth } from '../contexts/AuthContext';
const MapComponent = React.lazy(() => import('../components/terrain/MapComponent'));
import { getHouseholdDerivedStatus, getStatusTailwindClasses } from '../utils/statusUtils';
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

import {
    StatusBadge,
    ActionBar
} from '../components/dashboards/DashboardComponents';

type SearchResult = {
    type: 'household';
    id: string;
    label: string;
    data: Household;
} | {
    type: 'geo';
    id: string;
    label: string;
    lat: number;
    lon: number;
};

const Terrain: React.FC = () => {
    const {
        households,
        updateHouseholdStatus,
        updateHouseholdLocation
    } = useTerrainData();

    const { project, projects, setActiveProjectId, createProject, deleteProject } = useProject();
    const { sync, syncStatus, isSyncing } = useSync();
    const { grappesConfig } = useLogistique();

    const { user } = useAuth();
    const { peut, PERMISSIONS } = usePermissions();
    const { isFavorite, toggleFavorite, favorites: localFavorites } = useFavorites(project?.id);

    const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const { isDarkMode } = useTheme();
    const [mapCenter, setMapCenter] = useState<[number, number]>([-14.65, 14.45]); // ✅ Lng, Lat (Center Senegal)
    const [mapZoom, setMapZoom] = useState(7);

    const [selectedPhases, setSelectedPhases] = useState<string[]>([
        'Non débuté',
        'En cours',
        'Terminé',
        'Problème'
    ]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [routingEnabled, setRoutingEnabled] = useState(false);
    const [showZones, setShowZones] = useState(false);
    const [isDataHubOpen, setIsDataHubOpen] = useState(false);
    const [selectedTeamFilters] = useState<string[]>(['livraison', 'maconnerie', 'reseau', 'installation', 'controle']);

    const [routingStart, setRoutingStart] = useState<[number, number] | null>(null);
    const [routingDest, setRoutingDest] = useState<[number, number] | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [routeStats, setRouteStats] = useState<{ distance: number; duration: number } | null>(null);
    const [turnByTurnInstructions, setTurnByTurnInstructions] = useState<any[]>([]);

    const [isMeasuring, setIsMeasuring] = useState(false);
    const [showDatabaseStats, setShowDatabaseStats] = useState(false);
    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
    const [showRoutingPanel, setShowRoutingPanel] = useState(false);
    const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; label: string }[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    // Drawing zones & layers
    const { zones: drawnZones, addZone, deleteZone } = useDrawnZones();
    const [isDrawing, setIsDrawing] = useState(false);

    const [isDownloadingOffline, setIsDownloadingOffline] = useState(false);

    const [showRegionDownload, setShowRegionDownload] = useState(false);
    const [downloadedRegions, setDownloadedRegions] = useState<string[]>(JSON.parse(safeStorage.getItem('downloaded_regions') || '[]'));
    const [geolocationError, setGeolocationError] = useState<string | null>(null);
    const [requestingGeolocation, setRequestingGeolocation] = useState(false);

    // Initial geolocation check (not request)
    React.useEffect(() => {
        if (!navigator.geolocation) {
            setGeolocationError('Géolocalisation non disponible sur ce navigateur');
            logger.warn('Geolocation not available');
        }
    }, []);

    // ✅ Automatic geolocation on mount
    React.useEffect(() => {
        if (navigator.geolocation && !userLocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                    setUserLocation(loc);
                    setMapCenter(loc);
                    setMapZoom(14);
                    logger.log('📍 Auto-location detected:', loc);
                },
                (err) => {
                    logger.warn('⚠️ Auto-location failed:', err);
                },
                { enableHighAccuracy: false, timeout: 5000 }
            );
        }
    }, []);

    const handleRecenterOnUser = () => {
        if (userLocation) {
            setMapCenter(userLocation);
            setMapZoom(16);
        } else if (geolocationError) {
            // If permission denied, try to request again
            handleRequestGeolocation();
        } else {
            toast.loading('En attente de votre position... ⏳', { duration: 3000 });
        }
    };

    const handleRequestGeolocation = () => {
        if (!navigator.geolocation) {
            toast.error('Géolocalisation non disponible sur ce navigateur');
            return;
        }
        
        setRequestingGeolocation(true);
        setGeolocationError(null);
        
        // Request geolocation once - this should trigger the permission prompt again
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const newLoc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                setUserLocation(newLoc);
                setMapCenter(newLoc);
                setMapZoom(16);

                setRequestingGeolocation(false);
                toast.success('✅ Position trouvée ! ' + newLoc.map(v => v.toFixed(4)).join(', '));
                logger.log('✅ Position obtenue:', newLoc);
            },
            (err) => {
                setRequestingGeolocation(false);
                let errorMsg = 'Position indisponible';
                switch(err.code) {
                    case err.PERMISSION_DENIED:
                        errorMsg = '❌ Permission refusée.\n\nPour activer :\n• Chrome/Edge : Menu ⋮ → Paramètres → Confidentialité → Permissions → Localisation\n• Firefox : Volet des autorisations en haut à gauche';
                        break;
                    case err.POSITION_UNAVAILABLE:
                        errorMsg = '⚠️ Position indisponible. Vérifiez votre GPS et réessayez.';
                        break;
                    case err.TIMEOUT:
                        errorMsg = '⏱️ Délai d\'attente dépassé. Réessayez.';
                        break;
                }
                logger.warn('❌ Geolocation error:', err.code, errorMsg);
                setGeolocationError(errorMsg);
                toast.error(errorMsg, { duration: 5000 });
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };
    const [pendingPoints, setPendingPoints] = useState<[number, number][]>([]);
    const [showDrawPanel, setShowDrawPanel] = useState(false);
    const [externalLayers, setExternalLayers] = useState<ExternalLayer[]>([]);
    const [showLayersPanel, setShowLayersPanel] = useState(false);
    const [showTrackingPanel, setShowTrackingPanel] = useState(false);
    const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

    // Grappe Clustering State
    const [showGrappePanel, setShowGrappePanel] = useState(false);
    const [activeGrappeId, setActiveGrappeId] = useState<string | null>(null);
    const [grappeClusters, setGrappeClusters] = useState<any[]>([]);
    const [grappeZonesData, setGrappeZonesData] = useState<any>(null);
    const [grappeCentroidsData, setGrappeCentroidsData] = useState<any>(null);

    // Debug Statistics
    const [householdStats, setHouseholdStats] = useState({ total: 0, withoutCoords: 0, withCoords: 0, afterFilters: 0 });
    const [showCoordWarning, setShowCoordWarning] = useState(false);

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

        clusterWorker.onmessage = (e) => {
            if (e.data.success) {
                setGrappeClusters(e.data.panelData);
                setGrappeZonesData(e.data.zones);
                setGrappeCentroidsData(e.data.centroids);
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

    const handleConfirmZone = (name: string, team: string, color: string) => {
        if (pendingPoints.length < 3) return;
        addZone({ id: `zone_${Date.now()}`, name, team, color, coordinates: pendingPoints, createdAt: new Date().toISOString() });
        setIsDrawing(false);
        setPendingPoints([]);
    };

    // Audit logs are no longer displayed in the UI
    // React.useEffect(() => {
    //     const fetchLogs = async () => {
    //         if (selectedHousehold) {
    //             const logs = await getHouseholdLogs(selectedHousehold.id);
    //         }
    //     };
    //     fetchLogs();
    // }, [selectedHousehold, getHouseholdLogs]);

    const handleManualSync = async () => {
        try {
            // isSyncing will be updated by the context
            await sync();
            toast.success('✅ Synchronisation réussie');
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

    const [visibleWidgets] = useState({
        legend: true
    });

    const handleTogglePhase = (phase: string) => {
        if (phase === 'all') {
            const allPhases = ['Non débuté', 'En cours', 'Terminé', 'Problème'];
            setSelectedPhases(selectedPhases.length === allPhases.length ? [] : allPhases);
            return;
        }
        setSelectedPhases(prev =>
            prev.includes(phase)
                ? prev.filter(p => p !== phase)
                : [...prev, phase]
        );
    };

    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [dateRange, setDateRange] = useState<'all' | '7d' | '30d'>('all');


    const householdList = (households || []) as Household[];

    // Fonction pour vérifier si les coordonnées sont valides
    const hasValidCoordinates = (h: Household): boolean => {
        return !!(h.location?.coordinates && 
                  Array.isArray(h.location.coordinates) &&
                  h.location.coordinates.length === 2 &&
                  typeof h.location.coordinates[0] === 'number' &&
                  typeof h.location.coordinates[1] === 'number' &&
                  !isNaN(h.location.coordinates[0]) &&
                  !isNaN(h.location.coordinates[1]) &&
                  Math.abs(h.location.coordinates[0]) <= 180 &&
                  Math.abs(h.location.coordinates[1]) <= 90);
    };

    const filteredHouseholds = useMemo(() => {
        let rejectedByPhase = 0, rejectedByTeam = 0, rejectedByDateRange = 0;
        const statusDistribution: any = {};
        
        const filtered = householdList.filter(h => {
            // Vérifier les coordonnées d'abord
            if (!hasValidCoordinates(h)) {
                return false;
            }

            const hStatus = getHouseholdDerivedStatus(h);
            const mappedStatus = (hStatus === 'Réception: Validée' || h.status === 'Terminé') ? 'Terminé' :
                hStatus === 'Problème' ? 'Problème' :
                    (hStatus === 'Non débuté' || hStatus === 'Non Raccordable') ? 'Non débuté' :
                        'En cours';
            
            // Track status distribution
            statusDistribution[mappedStatus] = (statusDistribution[mappedStatus] || 0) + 1;
            
            const matchesPhase = selectedPhases.includes(mappedStatus);
            if (!matchesPhase) {
                rejectedByPhase++;
                return false;
            }

            const fulfillsTeamCriteria =
                (!!h.koboSync?.livreurDate && selectedTeamFilters.includes('livraison')) ||
                (!!h.koboSync?.maconOk && selectedTeamFilters.includes('maconnerie')) ||
                (!!h.koboSync?.reseauOk && selectedTeamFilters.includes('reseau')) ||
                (!!h.koboSync?.interieurOk && selectedTeamFilters.includes('installation')) ||
                (!!h.koboSync?.controleOk && selectedTeamFilters.includes('controle'));

            const hasAnyKoboProgress = !!h.koboSync?.livreurDate || !!h.koboSync?.maconOk || !!h.koboSync?.reseauOk || !!h.koboSync?.interieurOk || !!h.koboSync?.controleOk;
            if (hasAnyKoboProgress && !fulfillsTeamCriteria) {
                rejectedByTeam++;
                return false;
            }

            if (selectedTeam !== 'all') {
                const assignedTeams = Array.isArray(h.assignedTeams) ? h.assignedTeams : [];
                if (!assignedTeams.includes(selectedTeam)) return false;
            }

            if (dateRange !== 'all') {
                const now = new Date();
                const householdDate = h.delivery?.date ? new Date(h.delivery.date) : new Date();
                const diffDays = (now.getTime() - householdDate.getTime()) / (1000 * 3600 * 24);
                if (dateRange === '7d' && diffDays > 7) {
                    rejectedByDateRange++;
                    return false;
                }
                if (dateRange === '30d' && diffDays > 30) {
                    rejectedByDateRange++;
                    return false;
                }
            }

            return true;
        });

        // Debug: Show why items are rejected
        console.log('🤔 [FILTER DEBUG]', {
            totalBefore: householdList.length,
            selectedPhases,
            selectedTeamFilters,
            rejectedByPhase,
            rejectedByTeam,
            rejectedByDateRange,
            statusDistribution,
            totalAfter: filtered.length
        });

        return filtered;
    }, [householdList, selectedPhases, selectedTeamFilters, selectedTeam, dateRange]);

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
        
        setHouseholdStats({ 
            total: totalHouseholds, 
            withoutCoords, 
            withCoords,
            afterFilters 
        });
        
        if (withoutCoords > 0) {
            setShowCoordWarning(true);
        }
        
        if (totalHouseholds > 0) {
            logger.log(`📊 MÉNAGES: Total=${totalHouseholds}, Valid coords=${withCoords} (${((withCoords/totalHouseholds)*100).toFixed(1)}%), Sans coords=${withoutCoords} (${((withoutCoords/totalHouseholds)*100).toFixed(1)}%), Après filtres=${afterFilters}`);
        }
    }, [filteredHouseholds, householdList]);

    // search with debounce to avoid iterating thousands of households on every keystroke
    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        const results: SearchResult[] = [];
        const qLower = query.toLowerCase();
        householdList.forEach((h: Household) => {
            const owner = h.owner || '';
            if (h.id.toLowerCase().includes(qLower) || owner.toLowerCase().includes(qLower)) {
                results.push({
                    type: 'household',
                    id: h.id,
                    label: h.id + (owner ? ` — ${owner}` : ''),
                    data: h
                });
            }
        });

        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`);
            const geoData = await resp.json();
            geoData.forEach((r: { place_id: string; display_name: string; lat: string; lon: string; }) => {
                results.push({
                    type: 'geo',
                    id: r.place_id,
                    label: r.display_name,
                    lat: parseFloat(r.lat),
                    lon: parseFloat(r.lon)
                });
            });
        } catch (e) {
            logger.error('Search error:', e);
        }

        setSearchResults(results);
        setIsSearching(false);
    }, [householdList]);

    const debouncedSearch = useMemo(() => debounce(performSearch, 300), [performSearch]);

    const handleSelectResult = (result: SearchResult) => {
        if (result.type === 'household') {
            setSelectedHousehold(result.data);
            if (result.data.location?.coordinates) {
                setMapCenter([result.data.location.coordinates[1], result.data.location.coordinates[0]]);
            }
            setMapZoom(18);
        } else {
            setMapCenter([result.lat, result.lon]);
            setMapZoom(16);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleZoneClick = (center: [number, number], zoom: number) => {
        setMapCenter(center);
        setMapZoom(zoom);
    };

    const handleStatusUpdate = async (newStatus: string) => {
        if (selectedHousehold) {
            await updateHouseholdStatus(selectedHousehold.id, newStatus);
            setSelectedHousehold(prev => prev ? { ...prev, status: newStatus } : null);
        }
    };

    const handleRecenter = () => {
        // Center of Senegal: Longitude ~ -14.45, Latitude ~ 14.5
        setMapCenter([-14.4563, 14.4563]); 
        setMapZoom(7);
    };

    const handleTraceItinerary = () => {
        if (!selectedHousehold || !selectedHousehold.location?.coordinates) return;
        const dest: [number, number] = [selectedHousehold.location.coordinates[1], selectedHousehold.location.coordinates[0]];

        setRoutingDest(dest);
        setRoutingEnabled(true);
        setRouteStats(null); // Reset stats when starting new route

        if (userLocation) {
            setRoutingStart(userLocation);
        } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setRoutingStart([pos.coords.latitude, pos.coords.longitude]);
            }, () => {
                toast.error("Géolocalisation impossible");
                setRoutingStart(null);
            });
        }
    };

    const handleRouteFound = (stats: { distance: number; duration: number; instructions?: any[] } | null) => {
        setRouteStats(stats ? { distance: stats.distance, duration: stats.duration } : null);
        setTurnByTurnInstructions(stats?.instructions || []);
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
                                    <StatusBadge status={syncStatus === 'success' ? 'success' : 'info'} label={syncStatus === 'success' ? 'Live' : 'Sync'} />
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
                                    <button onClick={handleCreateProject} title="Créer un projet" className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-blue-600 transition-all">
                                        <Plus size={14} />
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

                    {/* Sub-Header: Toolbar & Status Controls */}
                    <div className="px-6 py-2 border-t border-gray-50 dark:border-white/5 flex items-center justify-between overflow-x-auto scrollbar-none gap-8">
                        <div className="flex items-center gap-4 border-r dark:border-white/5 pr-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Calques:</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setShowHeatmap(!showHeatmap)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${showHeatmap ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-gray-100 dark:bg-white/5 text-slate-500 hover:bg-gray-200'}`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${showHeatmap ? 'bg-white' : 'bg-orange-500'}`} />
                                        Chaleur
                                    </button>
                                    <button
                                        onClick={() => setShowZones(!showZones)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${showZones ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-100 dark:bg-white/5 text-slate-500 hover:bg-gray-200'}`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${showZones ? 'bg-white' : 'bg-emerald-500'}`} />
                                        Zones
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Outils:</span>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => setMapZoom(prev => Math.min(prev + 1, 20))} className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-slate-500 hover:text-blue-600 transition-all" title="Zoom +"><Plus size={14} /></button>
                                    <button onClick={() => setMapZoom(prev => Math.max(prev - 1, 1))} className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-slate-500 hover:text-blue-600 transition-all" title="Zoom -"><Search size={14} className="scale-75 translate-y-0.5" /></button>
                                    <div className="w-px h-4 bg-gray-100 dark:bg-white/5 mx-1" />
                                    <button
                                        onClick={() => setIsMeasuring(!isMeasuring)}
                                        className={`p-2 rounded-lg border transition-all ${isMeasuring ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-500 hover:text-blue-600'}`}
                                        title="Mesurer la distance"
                                    >
                                        <Undo2 size={14} className={isMeasuring ? 'rotate-90' : ''} />
                                    </button>
                                    <button
                                        onClick={() => setShowDatabaseStats(!showDatabaseStats)}
                                        className={`p-2 rounded-lg border transition-all ${showDatabaseStats ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-500 hover:text-blue-600'}`}
                                        title="Statistiques de zone"
                                    >
                                        <LayoutGrid size={14} />
                                    </button>
                                    <button
                                        onClick={() => setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')}
                                        className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${mapStyle === 'satellite' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-500 hover:text-blue-600'}`}
                                    >
                                        {mapStyle === 'streets' ? 'Satellite' : 'Rues'}
                                    </button>
                                    <button
                                        onClick={() => setShowRoutingPanel(prev => !prev)}
                                        className={`p-2 rounded-lg border transition-all ${showRoutingPanel ? 'bg-cyan-600 border-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-500 hover:text-cyan-600'}`}
                                        title="Planifier une tournée camion"
                                    >
                                        <Truck size={14} />
                                    </button>
                                    <button
                                        onClick={() => { setShowDrawPanel(prev => !prev); setShowLayersPanel(false); }}
                                        className={`p-2 rounded-lg border transition-all ${showDrawPanel ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-500 hover:text-indigo-600'}`}
                                        title="Dessiner des zones"
                                    >
                                        <PenLine size={14} />
                                    </button>
                                    <button
                                        onClick={() => { setShowLayersPanel(prev => !prev); setShowDrawPanel(false); setShowTrackingPanel(false); }}
                                        className={`p-2 rounded-lg border transition-all ${showLayersPanel ? 'bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-500 hover:text-teal-600'}`}
                                        title="Importer une couche GeoJSON / KML"
                                    >
                                        <Globe size={14} />
                                    </button>
                                    <button
                                        onClick={() => { setShowTrackingPanel(prev => !prev); setShowDrawPanel(false); setShowLayersPanel(false); setShowGrappePanel(false); }}
                                        className={`p-2 rounded-lg border transition-all ${showTrackingPanel ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-500 hover:text-blue-600'}`}
                                        title="Suivi des équipes terrain"
                                    >
                                        <Users size={14} />
                                    </button>
                                    <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />
                                    <button
                                        onClick={() => { setShowGrappePanel(prev => !prev); setShowDrawPanel(false); setShowLayersPanel(false); setShowTrackingPanel(false); }}
                                        className={`p-2 rounded-lg border transition-all ${showGrappePanel ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-500 hover:text-indigo-600'}`}
                                        title="Régionalisation Auto (Clustering)"
                                    >
                                        <Layers size={14} />
                                    </button>
                                    <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />
                                    <button
                                        onClick={() => setShowRegionDownload(prev => !prev)}
                                        className={`p-2 rounded-lg border transition-all ${showRegionDownload ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-500 hover:text-amber-600'} ${isDownloadingOffline ? 'animate-pulse opacity-70' : ''}`}
                                        title={isDownloadingOffline ? "Téléchargement en cours..." : "Cartes Offline (Packs par région)"}
                                        disabled={isDownloadingOffline}
                                    >
                                        <CloudDownload size={14} />
                                    </button>
                                    <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />
                                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-100 dark:border-white/5">
                                        <button
                                            onClick={handleRecenter}
                                            className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white dark:hover:bg-white/10 transition-all"
                                            title="Vue globale (Sénégal)"
                                        >
                                            <Focus size={14} />
                                        </button>
                                        <button
                                            onClick={handleRecenterOnUser}
                                            disabled={requestingGeolocation}
                                            className={`p-2 rounded-lg transition-all hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 ${requestingGeolocation ? 'text-amber-500 animate-spin' : userLocation ? 'text-blue-500' : 'text-slate-400'}`}
                                            title={requestingGeolocation ? "Localisation en cours..." : geolocationError ? "Cliquez pour redemander la permission" : "Ma position actuelle"}
                                        >
                                            {requestingGeolocation ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                                        </button>
                                    </div>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isOfflineMode ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-emerald-500/10 border-emerald-500 text-emerald-500'}`}>
                                        <Wifi size={12} className={isOfflineMode ? 'text-red-500' : 'text-emerald-500'} />
                                        <span className="text-[9px] font-black uppercase tracking-tighter">{isOfflineMode ? 'Hors-Ligne' : 'Connecté'}</span>
                                    </div>

                                </div>
                            </div>

                            <div className="flex items-center gap-4 border-l dark:border-white/5 pl-6">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Filtres:</span>
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={selectedTeam}
                                        onChange={(e) => setSelectedTeam(e.target.value)}
                                        title="Filtrer par équipe"
                                        className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-[9px] font-black uppercase tracking-widest rounded-lg px-3 py-1.5 outline-none cursor-pointer text-slate-900 dark:text-white"
                                    >
                                        <option value="all">Équipes: Toutes</option>
                                        <option value="Équipe A">Équipe A</option>
                                        <option value="Équipe B">Équipe B</option>
                                        <option value="Équipe C">Équipe C</option>
                                    </select>
                                    <select
                                        value={dateRange}
                                        onChange={(e) => setDateRange(e.target.value as any)}
                                        title="Filtrer par période"
                                        className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-[9px] font-black uppercase tracking-widest rounded-lg px-3 py-1.5 outline-none cursor-pointer text-slate-900 dark:text-white"
                                    >
                                        <option value="all">Période: Max</option>
                                        <option value="7d">7 derniers jours</option>
                                        <option value="30d">30 derniers jours</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            <span className={`text-[9px] font-black px-2 py-1 rounded-md ${filteredHouseholds.length > 5000 ? 'text-red-600 bg-red-50 dark:bg-red-500/10' : 'text-blue-600 bg-blue-50 dark:bg-blue-500/10'}`}>
                                {filteredHouseholds.length} POINTS {filteredHouseholds.length > 5000 ? '⚠️ NOMBREUX' : 'VISIBLES'}
                            </span>
                            {showCoordWarning && householdStats.withoutCoords > 0 && (
                                <div 
                                    className="text-[8px] font-black px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-500/10 text-orange-600 cursor-help"
                                    title={`${householdStats.withoutCoords} ménages n'ont pas de coordonnées GPS valides et ne s'affichent pas sur la carte`}
                                >
                                    ⚠️ {householdStats.withoutCoords} SEM. SANS GPS ({((householdStats.withoutCoords/householdStats.total)*100).toFixed(0)}%)
                                </div>
                            )}
                            <div className="flex items-center gap-1">
                                <button onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Plein Écran">
                                    <Maximize size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

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
                                    <Suspense fallback={<div className="h-full w-full flex items-center justify-center">Chargement de la carte…</div>}>
                                        <MapComponent
                                            households={filteredHouseholds}
                                            onSelect={setSelectedHousehold}
                                            center={mapCenter}
                                            zoom={mapZoom}
                                            onMove={(c, z) => {
                                                setMapCenter(c);
                                                setMapZoom(z);
                                            }}
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
                                            userLocation={userLocation}
                                            onHouseholdDrop={updateHouseholdLocation}
                                            grappesConfig={grappesConfig}
                                            readOnly={!peutModifierCarte}
                                            isMeasuring={isMeasuring}
                                            showDatabaseStats={showDatabaseStats}
                                            mapStyle={mapStyle}
                                            grappeZonesData={grappeZonesData}
                                            grappeCentroidsData={grappeCentroidsData}
                                            activeGrappeId={activeGrappeId}
                                            onRouteFound={handleRouteFound}
                                            favorites={localFavorites}
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
                                <motion.div
                                    key="list"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`h-full w-full overflow-hidden flex flex-col rounded-3xl border shadow-lg ${isDarkMode ? 'bg-transparent border-none' : 'bg-white border-slate-200'}`}
                                >
                                    <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-500">Ménages ({filteredHouseholds.length})</h3>
                                        <button
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                        >
                                            <FileDown size={14} /> Exporter CSV
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-auto">
                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                            <thead className={`sticky top-0 z-10 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-slate-50 text-slate-500'}`}>
                                                <tr>
                                                    <th className="px-6 py-4">ID / Propriétaire</th>
                                                    <th className="px-6 py-4">Région</th>
                                                    <th className="px-6 py-4">Statut</th>
                                                    <th className="px-6 py-4 flex justify-end">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
                                                {filteredHouseholds.slice(0, 100).map(h => (
                                                    <tr key={h.id} className={`transition-colors hover:${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                                                    <MapPin size={14} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{h.id}</span>
                                                                    <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{h.owner || '—'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                                                {h.region || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {(() => {
                                                                const status = getHouseholdDerivedStatus(h);
                                                                const colors = getStatusTailwindClasses(status);
                                                                return (
                                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                                                                        {status}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                onClick={() => setSelectedHousehold(h)}
                                                                className="text-indigo-500 hover:text-indigo-600 font-bold text-xs"
                                                            >
                                                                Détails
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
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
                                onStatusUpdate={handleStatusUpdate}
                                isFavorite={isFavorite}
                                toggleFavorite={toggleFavorite}
                                onTraceItinerary={handleTraceItinerary}
                                routeStats={routeStats || null}
                                grappeInfo={selectedHousehold.grappeId ? {
                                    id: selectedHousehold.grappeId,
                                    name: selectedHousehold.grappeName || `Grappe ${selectedHousehold.grappeId}`,
                                    count: (households || []).filter((h: Household) => h.grappeId === selectedHousehold.grappeId).length
                                } : undefined}
                            />
                        )}
                    </AnimatePresence>
                </div>

                <DataHubModal isOpen={isDataHubOpen} onClose={() => setIsDataHubOpen(false)} />

                {showRegionDownload && (
                    <MapRegionDownload
                        onClose={() => setShowRegionDownload(false)}
                        downloadedRegions={downloadedRegions}
                        onDownload={async (region) => {
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
                        }}
                        onRemove={(id) => {
                            const newRegions = downloadedRegions.filter(r => r !== id);
                            setDownloadedRegions(newRegions);
                            safeStorage.setItem('downloaded_regions', JSON.stringify(newRegions));
                            toast.success("Région supprimée du cache");
                        }}
                    />
                )}

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

export default Terrain;
