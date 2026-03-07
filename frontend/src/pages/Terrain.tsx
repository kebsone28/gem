import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
    MapPin,
    X,
    Calendar,
    Navigation,
    Focus,
    Maximize,
    Undo2,
    Search,
    RefreshCw,
    Plus,
    LayoutList,
    LayoutGrid,
    FileDown,
    Truck
} from 'lucide-react';
import { useTerrainData } from '../hooks/useTerrainData';
import { useAuth } from '../contexts/AuthContext';
import MapComponent from '../components/terrain/MapComponent';
import { getHouseholdDerivedStatus } from '../utils/statusUtils';
import type { Household } from '../utils/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { DataHubModal } from '../components/terrain/DataHubModal';
import { useProject } from '../hooks/useProject';
import { useSync } from '../hooks/useSync';
import { useLogistique } from '../hooks/useLogistique';
import { usePermissions } from '../hooks/usePermissions';
import { MapRoutingPanel } from '../components/terrain/MapRoutingPanel';

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
        getHouseholdLogs
    } = useTerrainData();

    const { project, projects, setActiveProjectId, createProject, deleteProject } = useProject();
    const { sync, syncStatus } = useSync();
    const { grappesConfig } = useLogistique();

    const { user } = useAuth();
    const { peut, PERMISSIONS } = usePermissions();
    const [isSyncing, setIsSyncing] = useState(false);

    const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const { isDarkMode } = useTheme();
    const [mapCenter, setMapCenter] = useState<[number, number]>([14.7167, -17.4677]);
    const [mapZoom, setMapZoom] = useState(12);

    const [selectedPhases, setSelectedPhases] = useState<string[]>(['Non débuté', 'En cours', 'Terminé', 'Problème']);
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

    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isMeasuring, setIsMeasuring] = useState(false);
    const [showDatabaseStats, setShowDatabaseStats] = useState(false);
    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
    const [showRoutingPanel, setShowRoutingPanel] = useState(false);

    React.useEffect(() => {
        const fetchLogs = async () => {
            if (selectedHousehold) {
                const logs = await getHouseholdLogs(selectedHousehold.id);
                setAuditLogs(logs);
            }
        };
        fetchLogs();
    }, [selectedHousehold, getHouseholdLogs]);

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            await sync();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
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

    const filteredHouseholds = useMemo(() => {
        return householdList.filter(h => {
            const hStatus = getHouseholdDerivedStatus(h);
            const mappedStatus = (hStatus === 'Réception: Validée' || h.status === 'Terminé') ? 'Terminé' :
                hStatus === 'Problème' ? 'Problème' :
                    (hStatus === 'Non débuté' || hStatus === 'Non Raccordable') ? 'Non débuté' :
                        'En cours';
            const matchesPhase = selectedPhases.includes(mappedStatus);
            if (!matchesPhase) return false;

            const fulfillsTeamCriteria =
                (!!h.koboSync?.livreurDate && selectedTeamFilters.includes('livraison')) ||
                (!!h.koboSync?.maconOk && selectedTeamFilters.includes('maconnerie')) ||
                (!!h.koboSync?.reseauOk && selectedTeamFilters.includes('reseau')) ||
                (!!h.koboSync?.interieurOk && selectedTeamFilters.includes('installation')) ||
                (!!h.koboSync?.controleOk && selectedTeamFilters.includes('controle'));

            const hasAnyKoboProgress = !!h.koboSync?.livreurDate || !!h.koboSync?.maconOk || !!h.koboSync?.reseauOk || !!h.koboSync?.interieurOk || !!h.koboSync?.controleOk;
            if (hasAnyKoboProgress && !fulfillsTeamCriteria) return false;

            if (selectedTeam !== 'all') {
                const assignedTeams = Array.isArray(h.assignedTeams) ? h.assignedTeams : [];
                if (!assignedTeams.includes(selectedTeam)) return false;
            }

            if (dateRange !== 'all') {
                const now = new Date();
                const householdDate = h.delivery?.date ? new Date(h.delivery.date) : new Date();
                const diffDays = (now.getTime() - householdDate.getTime()) / (1000 * 3600 * 24);
                if (dateRange === '7d' && diffDays > 7) return false;
                if (dateRange === '30d' && diffDays > 30) return false;
            }

            return true;
        });
    }, [householdList, selectedPhases, selectedTeamFilters, selectedTeam, dateRange]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        const results: SearchResult[] = [];
        const qLower = query.toLowerCase();
        householdList.forEach(h => {
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
            console.error('Search error:', e);
        }

        setSearchResults(results);
        setIsSearching(false);
    };

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
        setMapCenter([14.7167, -17.4677]);
        setMapZoom(12);
    };

    const handleLocate = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                setUserLocation(loc);
                setMapCenter(loc);
                setMapZoom(16);
            });
        }
    };

    const handleTraceItinerary = () => {
        if (!selectedHousehold || !selectedHousehold.location?.coordinates) return;
        const dest: [number, number] = [selectedHousehold.location.coordinates[1], selectedHousehold.location.coordinates[0]];

        setRoutingDest(dest);
        setRoutingEnabled(true);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setRoutingStart([pos.coords.latitude, pos.coords.longitude]);
            }, () => {
                setRoutingStart(null);
            });
        } else {
            setRoutingStart(null);
        }
    };

    return (
        <div className={`flex flex-col h-screen overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-[#F8FAFC] text-slate-900'}`}>

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
                                    onChange={(e) => handleSearch(e.target.value)}
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
                                className="bg-transparent border-none text-[11px] font-bold uppercase tracking-tight outline-none cursor-pointer px-3 py-1 text-blue-600"
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            {peutGererProjets && (
                                <button onClick={handleCreateProject} className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-blue-600 transition-all">
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
                                <button onClick={handleRecenter} className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-slate-500 hover:text-blue-600 transition-all" title="Recentrer"><Focus size={14} /></button>
                                <button onClick={handleLocate} className="p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-slate-500 hover:text-blue-600 transition-all" title="Ma position"><Navigation size={14} /></button>
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
                            </div>
                        </div>

                        <div className="flex items-center gap-4 border-l dark:border-white/5 pl-6">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Filtres:</span>
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={selectedTeam}
                                    onChange={(e) => setSelectedTeam(e.target.value)}
                                    className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-[9px] font-black uppercase tracking-widest rounded-lg px-3 py-1.5 outline-none cursor-pointer text-gray-700 dark:text-gray-200"
                                >
                                    <option value="all">Équipes: Toutes</option>
                                    <option value="Équipe A">Équipe A</option>
                                    <option value="Équipe B">Équipe B</option>
                                    <option value="Équipe C">Équipe C</option>
                                </select>
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value as any)}
                                    className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-[9px] font-black uppercase tracking-widest rounded-lg px-3 py-1.5 outline-none cursor-pointer text-gray-700 dark:text-gray-200"
                                >
                                    <option value="all">Période: Max</option>
                                    <option value="7d">7 derniers jours</option>
                                    <option value="30d">30 derniers jours</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-md">
                            {filteredHouseholds.length} POINTS VISIBLES
                        </span>
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
                                <MapComponent
                                    households={filteredHouseholds}
                                    onSelect={setSelectedHousehold}
                                    center={mapCenter}
                                    zoom={mapZoom}
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
                                    grappesConfig={grappesConfig}
                                    readOnly={!peutModifierCarte}
                                    isMeasuring={isMeasuring}
                                    showDatabaseStats={showDatabaseStats}
                                    mapStyle={mapStyle}
                                />
                                {/* Routing Panel Overlay */}
                                {showRoutingPanel && (
                                    <MapRoutingPanel
                                        households={filteredHouseholds}
                                        isDarkMode={isDarkMode}
                                        onClose={() => setShowRoutingPanel(false)}
                                    />
                                )}
                                {searchResults.length > 0 && searchQuery && (
                                    <div className={`absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-md mx-auto rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden z-[4000] ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
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
                                                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${h.status === 'Terminé' || h.status === 'Réception: Validée' ? 'bg-emerald-500/10 text-emerald-500' :
                                                            h.status === 'Problème' ? 'bg-rose-500/10 text-rose-500' :
                                                                h.status === 'Non débuté' ? 'bg-slate-500/10 text-slate-500' :
                                                                    'bg-indigo-500/10 text-indigo-500'
                                                            }`}>
                                                            {h.status || 'Inconnu'}
                                                        </span>
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
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            className={`fixed bottom-0 md:top-0 md:right-0 h-[85vh] md:h-full w-full md:w-[450px] z-[2000] shadow-[-20px_0_50px_rgba(0,0,0,0.2)] p-6 md:p-8 border-t md:border-l rounded-t-[2.5rem] md:rounded-none overflow-y-auto transition-colors ${isDarkMode ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                        >
                            <div className="md:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-800 rounded-full mx-auto mb-6" />
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none">Ménage {selectedHousehold.id.slice(-6)}</h2>
                                    <button
                                        onClick={() => {
                                            if (selectedHousehold) {
                                                navigator.clipboard.writeText(selectedHousehold.id);
                                                toast.success("ID copié !");
                                            }
                                        }}
                                        className="text-[9px] font-black text-primary uppercase tracking-widest mt-1 hover:underline text-left"
                                    >
                                        Copier l'identifiant complet
                                    </button>
                                </div>
                                <button onClick={() => setSelectedHousehold(null)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-900'}`}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <h4 className={`text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        <Maximize size={12} /> Galerie de Photos
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedHousehold.photo ? (
                                            <a
                                                href={selectedHousehold.photo}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`aspect-square sm:aspect-video rounded-2xl overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
                                            >
                                                <img
                                                    src={selectedHousehold.photo}
                                                    alt={`Ménage ${selectedHousehold.id}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </a>
                                        ) : (
                                            <div className={`aspect-square sm:aspect-video rounded-2xl overflow-hidden border flex items-center justify-center p-4 text-center ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                                <div className="flex flex-col items-center gap-2">
                                                    <MapPin size={16} />
                                                    <span className="text-[9px] font-bold uppercase">Aucune photo</span>
                                                </div>
                                            </div>
                                        )}
                                        {selectedHousehold.compteurPhoto ? (
                                            <a
                                                href={selectedHousehold.compteurPhoto}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`aspect-square sm:aspect-video rounded-2xl overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
                                            >
                                                <img
                                                    src={selectedHousehold.compteurPhoto}
                                                    alt={`Compteur ${selectedHousehold.id}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </a>
                                        ) : (
                                            <div className={`aspect-square sm:aspect-video rounded-2xl overflow-hidden border border-dashed flex items-center justify-center p-4 text-center ${isDarkMode ? 'bg-slate-900/50 border-slate-800 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
                                                <span className="text-[9px] font-bold uppercase">Compteur<br />En attente</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20">
                                            <MapPin size={24} />
                                        </div>
                                        <div>
                                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Propriétaire / Chef</p>
                                            <p className="text-primary font-black text-xs uppercase tracking-tight">{selectedHousehold.owner || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Région</p>
                                            <p className="text-[10px] font-bold">{selectedHousehold.region}</p>
                                        </div>
                                        <div>
                                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Statut Actuel</p>
                                            <p className={`text-[10px] font-black uppercase tracking-wider ${selectedHousehold.status === 'Réception: Validée' || selectedHousehold.status === 'Terminé' ? 'text-emerald-500' :
                                                selectedHousehold.status === 'Problème' ? 'text-rose-500' :
                                                    selectedHousehold.status === 'Non débuté' ? 'text-rose-600' : 'text-primary'
                                                }`}>
                                                {selectedHousehold.status}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        <Calendar size={12} />
                                        Journal d'Audit
                                    </h4>
                                    <div className="space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                                        {auditLogs.length > 0 ? (
                                            auditLogs.slice(0, 5).map((log, i) => (
                                                <div key={i} className="pl-10 relative">
                                                    <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 bg-primary" />
                                                    <div className={`p-4 rounded-2xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-50'}`}>
                                                        <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{log.action}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(log.timestamp).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-[10px] text-slate-500 italic pl-10">Aucun log récent</p>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-6 flex flex-col gap-3">
                                    <button
                                        onClick={handleTraceItinerary}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Navigation size={16} />
                                        TRACER INTINÉRAIRE
                                    </button>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleStatusUpdate('Terminé')}
                                            className="flex-1 bg-primary hover:brightness-110 text-white py-4 rounded-2xl font-black text-xs transition-all shadow-lg shadow-primary/20 active:scale-95"
                                        >
                                            VALIDER RACCORDEMENT
                                        </button>
                                        <button
                                            className={`flex-1 py-4 rounded-2xl border font-black text-xs transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-900'}`}
                                        >
                                            REPORTÉ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
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
    );
};

export default Terrain;
