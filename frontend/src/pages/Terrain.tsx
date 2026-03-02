import React, { useState } from 'react';
import {
    MapPin,
    X,
    CheckCircle2,
    Calendar,
    Navigation,
    Focus,
    Maximize,
    Undo2,
    Search
} from 'lucide-react';
import { useTerrainData } from '../hooks/useTerrainData';
import MapComponent from '../components/terrain/MapComponent';
import {
    PipelineWidget,
    KpiWidget,
    WidgetBar
} from '../components/terrain/MapWidgets';
import { MapToolbar } from '../components/terrain/MapToolbar';
import type { Household } from '../utils/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { DataHubModal } from '../components/terrain/DataHubModal';

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
        updateHouseholdStatus
    } = useTerrainData();

    const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
    const [viewMode] = useState<'map' | 'list'>('map');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const { isDarkMode } = useTheme();
    const [mapCenter, setMapCenter] = useState<[number, number]>([14.7167, -17.4677]);
    const [mapZoom, setMapZoom] = useState(12);

    const [selectedPhases, setSelectedPhases] = useState<string[]>(['Non débuté', 'Murs', 'Réseau', 'Intérieur', 'Terminé', 'Problème']);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [routingEnabled, setRoutingEnabled] = useState(false);
    const [showZones, setShowZones] = useState(false);
    const [isDataHubOpen, setIsDataHubOpen] = useState(false);

    const [routingStart, setRoutingStart] = useState<[number, number] | null>(null);
    const [routingDest, setRoutingDest] = useState<[number, number] | null>(null);

    const [visibleWidgets, setVisibleWidgets] = useState({
        pipeline: true,
        kpi: true,
        tools: true,
        search: true
    });

    const handleTogglePhase = (phase: string) => {
        if (phase === 'all') {
            const allPhases = ['Non débuté', 'Murs', 'Réseau', 'Intérieur', 'Terminé', 'Problème'];
            setSelectedPhases(selectedPhases.length === allPhases.length ? [] : allPhases);
            return;
        }
        setSelectedPhases(prev =>
            prev.includes(phase)
                ? prev.filter(p => p !== phase)
                : [...prev, phase]
        );
    };

    const householdList = (households || []) as Household[];

    const filteredHouseholds = householdList.filter(h => {
        if (h.status && selectedPhases.includes(h.status)) return true;
        // Handle sub-status matching (e.g., "Murs: En cours" matches "Murs")
        if (h.status && selectedPhases.some(p => h.status!.startsWith(p))) return true;
        return false;
    });

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
                setMapCenter([pos.coords.latitude, pos.coords.longitude]);
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
                        <h1 className="text-lg lg:text-2xl font-black tracking-tighter uppercase italic truncate">Cartographie</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsDataHubOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20 hidden md:flex items-center gap-2"
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            Data Hub
                        </button>

                        <div className={`flex items-center flex-wrap gap-1 lg:gap-2 p-1 rounded-2xl border shadow-sm transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`flex items-center px-2 lg:px-4 border-r transition-colors ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{filteredHouseholds.length} / {householdList.length} pts</span>
                            </div>
                            <button onClick={handleRecenter} className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm'}`}>
                                <Focus size={13} /> Recenter
                            </button>
                            <button onClick={handleLocate} className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm'}`}>
                                <Navigation size={13} /> Pos
                            </button>
                            <div className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 border-l transition-colors ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                <input type="checkbox" title="Heatmap" checked={showHeatmap} onChange={() => setShowHeatmap(!showHeatmap)} className="w-3 h-3 rounded text-indigo-600 focus:ring-0 cursor-pointer" />
                                <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Heat</span>
                            </div>
                            <div className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 border-l transition-colors ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                <input type="checkbox" title="Zones" checked={showZones} onChange={() => setShowZones(!showZones)} className="w-3 h-3 rounded text-emerald-600 focus:ring-0 cursor-pointer" />
                                <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Zones</span>
                            </div>
                            <button onClick={() => document.documentElement.requestFullscreen()} className="bg-indigo-600 text-white px-3 lg:px-5 py-1.5 lg:py-2 rounded-xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 flex items-center gap-1 lg:gap-2 hover:bg-indigo-700 transition-all active:scale-95">
                                <Maximize size={13} /> Full
                            </button>
                            <button
                                onClick={() => setRoutingEnabled(!routingEnabled)}
                                className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-1.5 lg:py-2 text-[9px] lg:text-[10px] font-black uppercase tracking-widest border-l transition-all ${isDarkMode ? 'border-slate-700 hover:text-white' : 'border-slate-200 hover:text-slate-900'} ${routingEnabled ? 'bg-indigo-600 text-white border-none rounded-xl mx-2' : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}
                            >
                                <Undo2 size={13} className={routingEnabled ? 'rotate-90' : ''} /> Route
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
                                className={`h-full w-full rounded-[2.5rem] overflow-hidden relative shadow-2xl border transition-colors ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
                            >
                                <WidgetBar
                                    activeWidgets={visibleWidgets}
                                    onToggleWidget={(id) => setVisibleWidgets(prev => ({ ...prev, [id]: !prev[id as keyof typeof prev] }))}
                                />
                                {visibleWidgets.tools && <MapToolbar />}
                                {visibleWidgets.pipeline && <PipelineWidget selectedPhases={selectedPhases} onTogglePhase={handleTogglePhase} />}
                                {visibleWidgets.kpi && <KpiWidget statsData={stats} />}

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
                                    activeHouseholdId={selectedHousehold?.id}
                                    routingStart={routingStart}
                                    routingDest={routingDest}
                                />
                            </motion.div>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center">
                                <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Vue Liste en maintenance</p>
                            </div>
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
                                <h2 className="text-xl font-black italic uppercase tracking-tighter">Ménage {selectedHousehold.id}</h2>
                                <button title="Fermer" onClick={() => setSelectedHousehold(null)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-900 text-slate-500 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-900'}`}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {selectedHousehold.photo && (
                                    <div className={`w-full h-48 rounded-3xl overflow-hidden border shadow-inner ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                        <img
                                            src={selectedHousehold.photo}
                                            alt={`Photo du ménage ${selectedHousehold.id}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}

                                <div className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-600/10 text-indigo-500 rounded-2xl flex items-center justify-center border border-indigo-600/20">
                                            <MapPin size={24} />
                                        </div>
                                        <div>
                                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Statut Installation</p>
                                            <p className="text-indigo-600 font-black text-xs uppercase tracking-tight">{selectedHousehold.status}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        <Calendar size={12} />
                                        Historique Opérations
                                    </h4>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Réception Technique', icon: <CheckCircle2 size={14} />, color: 'emerald' },
                                            { label: 'Raccordement Réseau', icon: <Navigation size={14} />, color: 'amber' }
                                        ].map((act, i) => (
                                            <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-50'}`}>
                                                <div className={`p-2 rounded-lg ${act.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{act.icon}</div>
                                                <div className="flex-1">
                                                    <p className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{act.label}</p>
                                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Il y a 2h</p>
                                                </div>
                                            </div>
                                        ))}
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
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xs transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                                        >
                                            VALIDER RACCORDEMENT
                                        </button>
                                        <button className={`flex-1 py-4 rounded-2xl border font-black text-xs transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-900'}`}>
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
        </div>
    );
};

export default Terrain;
