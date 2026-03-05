import React, { useState, useMemo } from 'react';
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
    FileDown
} from 'lucide-react';
import { useTerrainData } from '../hooks/useTerrainData';
import { useAuth } from '../contexts/AuthContext';
import MapComponent from '../components/terrain/MapComponent';
import {
    UnifiedStatusWidget,
    WidgetBar
} from '../components/terrain/MapWidgets';
import { getHouseholdDerivedStatus } from '../utils/statusUtils';
import { MapToolbar } from '../components/terrain/MapToolbar';
import type { Household } from '../utils/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { DataHubModal } from '../components/terrain/DataHubModal';
import { useProject } from '../hooks/useProject';
import { useSync } from '../hooks/useSync';
import { useLogistique } from '../hooks/useLogistique';
import { appSecurity } from '../services/appSecurity';

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
        stats,
        updateHouseholdStatus,
        getHouseholdLogs
    } = useTerrainData();

    const { project, projects, setActiveProjectId, createProject, deleteProject } = useProject();
    const { sync } = useSync();
    const { grappesConfig } = useLogistique();

    const { user } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);

    const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const { isDarkMode } = useTheme();
    const [mapCenter, setMapCenter] = useState<[number, number]>([14.7167, -17.4677]);
    const [mapZoom, setMapZoom] = useState(12);

    const [selectedPhases, setSelectedPhases] = useState<string[]>(['Non débuté', 'Livraison (Terminé)', 'Murs (Terminé)', 'Réseau (Terminé)', 'Intérieur (Terminé)', 'Réception: Validée', 'Problème']);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [routingEnabled, setRoutingEnabled] = useState(false);
    const [showZones, setShowZones] = useState(false);
    const [isDataHubOpen, setIsDataHubOpen] = useState(false);
    const [selectedTeamFilters, setSelectedTeamFilters] = useState<string[]>(['livraison', 'maconnerie', 'reseau', 'installation', 'controle']);

    const [routingStart, setRoutingStart] = useState<[number, number] | null>(null);
    const [routingDest, setRoutingDest] = useState<[number, number] | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    // Auto-sync interval removed to prevent unexpected simulated data
    /*
    React.useEffect(() => {
        const interval = setInterval(() => {
            console.log('Auto-syncing data...');
            simulateKoboSync();
        }, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [simulateKoboSync]);
    */

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


    const handleCreateProject = async () => {
        const name = prompt("Nom du nouveau projet :");
        if (name) {
            await createProject(name);
        }
    };

    // ── Delete Project Modal ──
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const handleDeleteProject = async () => {
        const ok = await appSecurity.check('projectDeletePassword', deletePassword);
        if (!ok) {
            setDeleteError('Mot de passe incorrect');
            return;
        }
        if (!project?.id) return;
        await deleteProject(project.id);
        setShowDeleteModal(false);
        setDeletePassword('');
        setDeleteError('');
    };

    const [visibleWidgets, setVisibleWidgets] = useState({
        unified: true,
        tools: true,
        search: true,
        legend: true
    });

    const handleTogglePhase = (phase: string) => {
        if (phase === 'all') {
            const allPhases = ['Non débuté', 'Livraison (Terminé)', 'Murs (Terminé)', 'Réseau (Terminé)', 'Intérieur (Terminé)', 'Réception: Validée', 'Problème'];
            setSelectedPhases(selectedPhases.length === allPhases.length ? [] : allPhases);
            return;
        }
        setSelectedPhases(prev =>
            prev.includes(phase)
                ? prev.filter(p => p !== phase)
                : [...prev, phase]
        );
    };

    const handleToggleTeamFilter = (teamId: string) => {
        setSelectedTeamFilters(prev =>
            prev.includes(teamId)
                ? prev.filter(t => t !== teamId)
                : [...prev, teamId]
        );
    };

    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [dateRange, setDateRange] = useState<'all' | '7d' | '30d'>('all');

    const householdList = (households || []) as Household[];

    const filteredHouseholds = useMemo(() => {
        return householdList.filter(h => {
            // Phase Filter (Using derived status if available, fallback to status)
            const hStatus = getHouseholdDerivedStatus(h);
            const matchesPhase = selectedPhases.includes(hStatus) ||
                selectedPhases.some(p => hStatus.startsWith(p));
            if (!matchesPhase) return false;

            // Team Progress Logic (Markers hidable by team criteria)
            const fulfillsTeamCriteria =
                (!!h.koboSync?.livreurDate && selectedTeamFilters.includes('livraison')) ||
                (!!h.koboSync?.maconOk && selectedTeamFilters.includes('maconnerie')) ||
                (!!h.koboSync?.reseauOk && selectedTeamFilters.includes('reseau')) ||
                (!!h.koboSync?.interieurOk && selectedTeamFilters.includes('installation')) ||
                (!!h.koboSync?.controleOk && selectedTeamFilters.includes('controle'));

            const hasAnyKoboProgress = !!h.koboSync?.livreurDate || !!h.koboSync?.maconOk || !!h.koboSync?.reseauOk || !!h.koboSync?.interieurOk || !!h.koboSync?.controleOk;

            // If it has progress but the corresponding teams are unchecked, hide it.
            if (hasAnyKoboProgress && !fulfillsTeamCriteria) return false;

            // Old Team Filter (Assigned Teams)
            if (selectedTeam !== 'all') {
                const assignedTeams = Array.isArray(h.assignedTeams) ? h.assignedTeams : [];
                if (!assignedTeams.includes(selectedTeam)) return false;
            }

            // Date Filter
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

        // 1. Local Search
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

        // 2. Nominatim Search
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
        <div className={`flex flex-col h-screen overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-[#f8fafc] text-slate-900'}`}>
            {/* Header */}
            <div className={`flex flex-col px-8 py-4 border-b z-50 transition-colors ${isDarkMode ? 'bg-slate-900/50 border-slate-800/50' : 'bg-white border-slate-200'} backdrop-blur-xl`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <MapPin size={18} className="text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-lg lg:text-2xl font-black tracking-tighter uppercase italic truncate leading-none">Cartographie</h1>
                            <div className="hidden sm:flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Projet:</span>
                                <div className="flex items-center gap-1">
                                    <select
                                        value={project?.id || ''}
                                        onChange={(e) => setActiveProjectId(e.target.value)}
                                        title="Sélectionner un projet"
                                        className={`bg-transparent border-none text-[11px] font-black uppercase tracking-tight outline-none cursor-pointer p-0 pr-6 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
                                    >
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                        {projects.length === 0 && <option value="">Aucun Projet</option>}
                                    </select>
                                    <button
                                        onClick={handleCreateProject}
                                        title="Nouveau Projet"
                                        className={`p-1 rounded-md transition-colors flex items-center justify-center ${isDarkMode ? 'hover:bg-slate-800 text-slate-500 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}
                                    >
                                        <Plus size={14} />
                                    </button>
                                    {project && (
                                        <button
                                            onClick={() => { setDeletePassword(''); setDeleteError(''); setShowDeleteModal(true); }}
                                            title="Supprimer ce projet"
                                            className="p-1 rounded-md transition-colors flex items-center justify-center text-rose-500/50 hover:text-rose-500 hover:bg-rose-500/10"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            title="Lancer une synchronisation manuelle des données"
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-sm'}`}
                        >
                            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                            {isSyncing ? 'Sync...' : 'Synchroniser'}
                        </button>

                        {user?.role === 'ADMIN_PROQUELEC' && (
                            <button
                                onClick={() => setIsDataHubOpen(true)}
                                title="Ouvrir le centre de gestion des données"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20 hidden md:flex items-center gap-2"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Data Hub
                            </button>
                        )}

                        <button
                            onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
                            title="Basculer la vue"
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-sm'}`}
                        >
                            {viewMode === 'map' ? <LayoutList size={14} /> : <MapPin size={14} />}
                            <span className="hidden md:inline">{viewMode === 'map' ? 'Vue Liste' : 'Vue Carte'}</span>
                        </button>

                        <div className={`flex items-center flex-wrap gap-1 lg:gap-2 p-1 rounded-2xl border shadow-sm transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            {/* Team Filter */}
                            <select
                                value={selectedTeam}
                                onChange={(e) => setSelectedTeam(e.target.value)}
                                title="Filtrer par équipe"
                                className={`bg-transparent border-none text-[9px] lg:text-[10px] font-black uppercase tracking-widest outline-none px-2 lg:px-4 cursor-pointer ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                            >
                                <option value="all">Toutes Équipes</option>
                                <option value="Équipe A">Équipe A (Maçons)</option>
                                <option value="Équipe B">Équipe B (Réseau)</option>
                                <option value="Équipe C">Équipe C (Interieur)</option>
                            </select>

                            {/* Date Filter */}
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value as any)}
                                title="Filtrer par période"
                                className={`bg-transparent border-none text-[9px] lg:text-[10px] font-black uppercase tracking-widest outline-none px-2 lg:px-4 border-l cursor-pointer ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}
                            >
                                <option value="all">Toute période</option>
                                <option value="7d">7 derniers jours</option>
                                <option value="30d">30 derniers jours</option>
                            </select>

                            <div className={`flex items-center px-2 lg:px-4 border-l transition-colors ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{filteredHouseholds.length} / {householdList.length} pts</span>
                            </div>
                            <button
                                onClick={handleRecenter}
                                title="Recentrer la carte sur le Sénégal"
                                className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm'}`}
                            >
                                <Focus size={13} /> Recenter
                            </button>
                            <button
                                onClick={handleLocate}
                                title="Me géolocaliser sur la carte"
                                className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm'}`}
                            >
                                <Navigation size={13} /> Pos
                            </button>
                            <div className={`flex items-center gap-3 px-4 border-l transition-colors ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                <button
                                    onClick={() => setShowHeatmap(!showHeatmap)}
                                    title={showHeatmap ? "Désactiver la carte de chaleur" : "Activer la carte de chaleur"}
                                    className={`relative w-10 h-5 rounded-full transition-all duration-300 ${showHeatmap ? 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)]' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-200')}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${showHeatmap ? 'left-6' : 'left-1'}`} />
                                </button>
                                <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-widest ${isDarkMode ? (showHeatmap ? 'text-white' : 'text-slate-500') : (showHeatmap ? 'text-slate-900' : 'text-slate-400')}`}>Heat</span>
                            </div>
                            <div className={`flex items-center gap-3 px-4 border-l transition-colors ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                <button
                                    onClick={() => setShowZones(!showZones)}
                                    title={showZones ? "Masquer les zones" : "Afficher les zones (Grappes)"}
                                    className={`relative w-10 h-5 rounded-full transition-all duration-300 ${showZones ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-200')}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${showZones ? 'left-6' : 'left-1'}`} />
                                </button>
                                <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-widest ${isDarkMode ? (showZones ? 'text-white' : 'text-slate-500') : (showZones ? 'text-slate-900' : 'text-slate-400')}`}>Zones</span>
                            </div>
                            <button
                                onClick={() => document.documentElement.requestFullscreen()}
                                title="Passer en plein écran"
                                className="bg-indigo-600 text-white px-3 lg:px-5 py-1.5 lg:py-2 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 flex items-center gap-1 lg:gap-2 hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                <Maximize size={13} /> Full
                            </button>
                            <button
                                onClick={() => setRoutingEnabled(!routingEnabled)}
                                title="Tracer un itinéraire"
                                className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 text-[9px] lg:text-[10px] font-black uppercase tracking-widest border-l transition-all ${isDarkMode ? 'border-slate-700 hover:text-white' : 'border-slate-200 hover:text-slate-900'} ${routingEnabled ? 'bg-indigo-600 text-white border-none rounded-xl mx-2' : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}
                            >
                                <Undo2 size={13} className={routingEnabled ? 'rotate-90' : ''} /> Route
                            </button>

                            {/* Clear Filters Button */}
                            <button
                                onClick={() => {
                                    setSelectedPhases(['Non débuté', 'Livraison (Terminé)', 'Murs (Terminé)', 'Réseau (Terminé)', 'Intérieur (Terminé)', 'Réception: Validée', 'Problème']);
                                    setSelectedTeamFilters(['livraison', 'maconnerie', 'reseau', 'installation', 'controle']);
                                    setSelectedTeam('all');
                                    setDateRange('all');
                                }}
                                title="Réinitialiser tous les filtres"
                                className={`flex items-center gap-2 px-3 py-1.5 border-l transition-all ${isDarkMode ? 'border-slate-700 text-slate-500 hover:text-white hover:bg-slate-700' : 'border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-white'}`}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                </div>
                <p className={`text-[10px] font-bold italic tracking-wide transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Visualisation géospatiale des points de raccordement et suivi opérationnel temps réel.
                </p>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 relative p-4 lg:p-6 transition-all">
                    <AnimatePresence mode="wait">
                        {viewMode === 'map' ? (
                            <motion.div
                                key="map"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className={`h-full w-full map-container relative`}
                            >
                                <WidgetBar
                                    activeWidgets={visibleWidgets}
                                    onToggleWidget={(id) => setVisibleWidgets(prev => ({ ...prev, [id]: !prev[id as keyof typeof prev] }))}
                                />
                                {visibleWidgets.tools && <MapToolbar />}
                                {visibleWidgets.unified && (
                                    <UnifiedStatusWidget
                                        selectedPhases={selectedPhases}
                                        onTogglePhase={handleTogglePhase}
                                        selectedTeamFilters={selectedTeamFilters}
                                        onToggleTeamFilter={handleToggleTeamFilter}
                                        stats={stats}
                                    />
                                )}

                                {visibleWidgets.search && (
                                    <div className="absolute top-8 left-6 z-[1000] w-full max-w-[280px]">
                                        <div className={`flex items-center p-0.5 rounded-xl border shadow-2xl backdrop-blur-xl transition-all ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
                                            <div className="flex-1 flex items-center gap-2 px-3">
                                                {isSearching ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div> : <Search size={14} className="text-slate-400" />}
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => handleSearch(e.target.value)}
                                                    placeholder="Rechercher..."
                                                    title="Rechercher un ménage ou un lieu"
                                                    className={`w-full bg-transparent border-none outline-none text-[10px] font-bold ${isDarkMode ? 'text-white placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-400'}`}
                                                />
                                            </div>
                                            <button title="Rechercher" className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95">
                                                <Search size={14} />
                                            </button>
                                        </div>

                                        {/* Search Results Dropdown */}
                                        {searchResults.length > 0 && (
                                            <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden z-[1001] ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
                                                <div className="max-h-60 overflow-y-auto">
                                                    {searchResults.map((res, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => handleSelectResult(res)}
                                                            className={`w-full text-left px-4 py-2 text-[10px] font-bold border-b last:border-0 transition-colors ${isDarkMode ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-100 text-slate-700 hover:bg-slate-50'}`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-1 rounded ${res.type === 'household' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'} text-[8px] uppercase`}>
                                                                    {res.type === 'household' ? 'Ménage' : 'Lieu'}
                                                                </span>
                                                                {res.type === 'household' && (
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${res.data.status === 'Terminé' ? 'bg-emerald-500' : res.data.status === 'Problème' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                                )}
                                                                <span className="truncate">{res.label}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

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
                                />
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
                                    {filteredHouseholds.length > 100 && (
                                        <div className="p-4 text-center text-xs text-slate-500 italic">
                                            Seuls les 100 premiers résultats sont affichés. Utilisez les filtres ou la recherche.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Overlaid Detail Panel */}
                <AnimatePresence>
                    {selectedHousehold && (
                        <motion.div
                            initial={{ x: 450 }}
                            animate={{ x: 0 }}
                            exit={{ x: 450 }}
                            className={`fixed top-0 right-0 h-full w-[400px] z-[2000] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] p-8 border-l overflow-y-auto transition-colors ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-black italic uppercase tracking-tighter leading-none">Ménage {selectedHousehold.id}</h2>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(selectedHousehold.id);
                                            alert("ID copié !");
                                        }}
                                        className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1 hover:underline text-left"
                                    >
                                        Copier l'identifiant
                                    </button>
                                </div>
                                <button title="Fermer" onClick={() => setSelectedHousehold(null)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-900 text-slate-500 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-900'}`}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Photo Gallery Structure */}
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
                                                    <span className="text-[9px] font-bold uppercase">Aucune photo principale</span>
                                                </div>
                                            </div>
                                        )}
                                        {/* Placeholder or Compteur photo */}
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
                                                <span className="text-[9px] font-bold uppercase">En attente<br />(Compteur)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-600/10 text-indigo-500 rounded-2xl flex items-center justify-center border border-indigo-600/20">
                                            <MapPin size={24} />
                                        </div>
                                        <div>
                                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Propriétaire / Chef</p>
                                            <p className="text-indigo-600 font-black text-xs uppercase tracking-tight">{selectedHousehold.owner || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Région</p>
                                            <p className="text-[10px] font-bold">{selectedHousehold.region}</p>
                                        </div>
                                        <div>
                                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Statut Actuel</p>
                                            <p className={`text-[10px] font-black uppercase tracking-wider ${selectedHousehold.status === 'Réception: Validée' || selectedHousehold.status === 'Terminé' ? 'text-emerald-500' :
                                                selectedHousehold.status === 'Problème' ? 'text-rose-500' :
                                                    selectedHousehold.status === 'Non débuté' ? 'text-rose-600' : 'text-indigo-500'
                                                }`}>
                                                {selectedHousehold.status}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        <Calendar size={12} />
                                        Journal d'Audit & Historique
                                    </h4>
                                    <div className="space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                                        {auditLogs.length > 0 ? (
                                            auditLogs.slice(0, 5).map((log, i) => (
                                                <div key={i} className="pl-10 relative">
                                                    <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]`} />
                                                    <div className={`p-4 rounded-2xl border transition-all ${isDarkMode ? 'bg-indigo-600/5 border-slate-800' : 'bg-white border-slate-50'}`}>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{log.action}</p>
                                                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500`}>LOG</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-[9px] text-slate-500 italic">Auto Sync</p>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(log.timestamp).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="pl-10 relative">
                                                <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 bg-slate-400" />
                                                <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                                    <p className="text-[9px] text-slate-500 italic">Aucun log récent</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-6 flex flex-col gap-3">
                                    <button
                                        onClick={handleTraceItinerary}
                                        title="Calculer l'itinéraire vers ce ménage"
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Navigation size={16} />
                                        TRACER INTINÉRAIRE
                                    </button>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleStatusUpdate('Terminé')}
                                            title="Valider le raccordement de ce ménage"
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xs transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                        >
                                            VALIDER RACCORDEMENT
                                        </button>
                                        <button
                                            title="Signaler un report pour ce ménage"
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

            {/* Data Hub Modal */}
            <DataHubModal
                isOpen={isDataHubOpen}
                onClose={() => setIsDataHubOpen(false)}
            />

            {/* Delete Project Modal */}
            {
                showDeleteModal && (
                    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className={`w-full max-w-md rounded-3xl shadow-2xl border p-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                </div>
                                <div>
                                    <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Supprimer le Projet</h2>
                                    <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cette action est irréversible</p>
                                </div>
                            </div>

                            <div className={`p-4 rounded-2xl mb-6 ${isDarkMode ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-100'}`}>
                                <p className={`text-sm font-bold ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}>
                                    Vous allez supprimer le projet <span className="italic">"{project?.name}"</span> et tous ses ménages de la base locale.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className={`text-xs font-black uppercase tracking-widest block mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        Mot de passe administrateur
                                    </label>
                                    <input
                                        type="password"
                                        value={deletePassword}
                                        onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                                        placeholder="Entrez le mot de passe admin"
                                        title="Mot de passe administrateur"
                                        onKeyDown={(e) => e.key === 'Enter' && handleDeleteProject()}
                                        autoFocus
                                        className={`w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-all ${deleteError
                                            ? 'border-rose-500 bg-rose-500/5'
                                            : isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500'
                                            }`}
                                    />
                                    {deleteError && (
                                        <p className="text-rose-500 text-xs font-bold mt-2">{deleteError}</p>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        title="Annuler"
                                        className={`flex-1 py-3 rounded-xl border font-black text-sm transition-all ${isDarkMode ? 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                            }`}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleDeleteProject}
                                        title="Confirmer la suppression"
                                        className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm transition-all shadow-lg shadow-rose-600/20 active:scale-95"
                                    >
                                        Supprimer définitivement
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Terrain;
