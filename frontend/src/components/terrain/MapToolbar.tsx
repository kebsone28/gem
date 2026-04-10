import React, { useState } from 'react';
import {
    Plus,
    Minus,
    Maximize2,
    Crosshair,
    Flame,
    Layers,
    Ruler,
    Database,
    Navigation,
    MousePointer2,
    Map as MapIcon,
    Truck,
    PenLine,
    Users,
    CloudDownload,
    Loader2,
    Sun,
    Moon,
    Satellite,
    Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTerrainUIStore } from '../../store/terrainUIStore';

interface ToolbarButtonProps {
    icon: React.ReactNode;
    title: string;
    onClick?: () => void;
    active?: boolean;
    danger?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, title, onClick, active, danger }) => {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`toolbar-btn-lg group ${active ? 'active' : ''} ${danger && !active ? 'hover:bg-rose-500/10 hover:text-rose-400' : ''}`}
        >
            {React.cloneElement(icon as React.ReactElement<any>, { size: 14, strokeWidth: active ? 2.2 : 1.5 })}
            <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[9px] font-black rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all z-[2000] uppercase tracking-widest translate-y-2 group-hover:translate-y-0 shadow-2xl bg-slate-900 text-white border border-white/5">
                {title}
            </div>
        </button>
    );
};

interface MapToolbarProps {
    onRecenter?: () => void;
}

export const MapToolbar: React.FC<MapToolbarProps> = ({ onRecenter }) => {
    const [showStyleMenu, setShowStyleMenu] = useState(false);

    // Zustand Selectors
    const setMapCommand = useTerrainUIStore(s => s.setMapCommand);
    const activePanel = useTerrainUIStore(s => s.activePanel);
    const setPanel = useTerrainUIStore(s => s.setPanel);

    const showHeatmap = useTerrainUIStore(s => s.showHeatmap);
    const toggleHeatmap = useTerrainUIStore(s => s.toggleHeatmap);

    const showZones = useTerrainUIStore(s => s.showZones);
    const toggleZones = useTerrainUIStore(s => s.toggleZones);

    const isMeasuring = useTerrainUIStore(s => s.isMeasuring);
    const toggleMeasuring = useTerrainUIStore(s => s.toggleMeasuring);

    const isSelecting = useTerrainUIStore(s => s.isSelecting);
    const toggleSelecting = useTerrainUIStore(s => s.toggleSelecting);

    const showDatabaseStats = useTerrainUIStore(s => s.showDatabaseStats);
    const toggleDatabaseStats = useTerrainUIStore(s => s.toggleDatabaseStats);
    const showLegend = useTerrainUIStore(s => s.showLegend);
    const toggleLegend = useTerrainUIStore(s => s.toggleLegend);

    const mapStyle = useTerrainUIStore(s => s.mapStyle);
    const setMapStyle = (style: 'dark' | 'light' | 'satellite') => {
        // We use a custom action or the existing toggle if it only has 2 states, 
        // but here we should probably update the store to support 3 styles.
        // For now, let's assume toggleMapStyle cycles or we use the specific style.
        useTerrainUIStore.setState({ mapStyle: style });
        localStorage.setItem('gem-map-style', style);
    };

    const isDownloadingOffline = useTerrainUIStore(s => s.isDownloadingOffline);

    // Navigation Handlers
    const handleZoomIn = () => {
        setMapCommand({ center: [0, 0], zoom: -1, timestamp: Date.now() });
    };
    const handleZoomOut = () => {
        setMapCommand({ center: [0, 0], zoom: -2, timestamp: Date.now() });
    };
    const handleRecenter = () => {
        if (onRecenter) {
            onRecenter();
        } else {
            setMapCommand({ center: [-14.65, 14.45], zoom: 7, timestamp: Date.now() });
        }
    };
    const handleLocate = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setMapCommand({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16, timestamp: Date.now() });
            });
        }
    };

    return (
        <div className="map-toolbar-horizontal group">
            {/* NAVIGATION GROUP */}
            <div className="toolbar-group">
                <div className="toolbar-divider" />
                <ToolbarButton icon={<Crosshair />} title="Recentrer" onClick={handleRecenter} />
                <ToolbarButton icon={<Navigation />} title="Ma Position" onClick={handleLocate} />
            </div>

            <div className="toolbar-divider" />

            {/* VISUALIZATION & STYLE GROUP */}
            <div className="toolbar-group">
                <div className="relative">
                    <ToolbarButton
                        icon={<MapIcon />}
                        title="Style de Carte"
                        onClick={() => setShowStyleMenu(!showStyleMenu)}
                        active={showStyleMenu}
                    />
                    <ToolbarButton
                        icon={<Info />}
                        title={showLegend ? 'Masquer la légende' : 'Afficher la légende'}
                        onClick={toggleLegend}
                        active={showLegend}
                    />
                    <AnimatePresence>
                        {showStyleMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute top-full mt-3 right-0 p-2 rounded-2xl bg-[#0D1E35] border border-white/10 shadow-2xl flex flex-col gap-2 min-w-[160px] z-[2000]"
                            >
                                <button onClick={() => { setMapStyle('dark'); setShowStyleMenu(false); }} className={`flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mapStyle === 'dark' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                                    <div className="flex items-center gap-3"><Moon size={14} /> Nuit</div>
                                    {mapStyle === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />}
                                </button>
                                <button onClick={() => { setMapStyle('light'); setShowStyleMenu(false); }} className={`flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mapStyle === 'light' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                                    <div className="flex items-center gap-3"><Sun size={14} /> Claire</div>
                                    {mapStyle === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />}
                                </button>
                                <button onClick={() => { setMapStyle('satellite'); setShowStyleMenu(false); }} className={`flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mapStyle === 'satellite' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                                    <div className="flex items-center gap-3"><Satellite size={14} /> Satellite</div>
                                    {mapStyle === 'satellite' && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <ToolbarButton icon={<Flame />} title="Heatmap" onClick={toggleHeatmap} active={showHeatmap} />
                <ToolbarButton icon={<Layers />} title="Zones" onClick={toggleZones} active={showZones} />
            </div>

            <div className="toolbar-divider" />

            {/* EXPERT TOOLS GROUP */}
            <div className="toolbar-group">
                <ToolbarButton icon={<Ruler />} title="Mesurer" onClick={toggleMeasuring} active={isMeasuring} />
                <ToolbarButton icon={<MousePointer2 />} title="Sélection Lasso" onClick={toggleSelecting} active={isSelecting} />
                <ToolbarButton icon={<Truck />} title="Tournée Camion" onClick={() => setPanel('routing')} active={activePanel === 'routing'} />
                <ToolbarButton icon={<PenLine />} title="Dessiner Zones" onClick={() => setPanel('draw')} active={activePanel === 'draw'} />
                <ToolbarButton icon={<Users />} title="Suivi Équipes" onClick={() => setPanel('tracking')} active={activePanel === 'tracking'} />
                <ToolbarButton icon={<Database />} title="Analytique" onClick={toggleDatabaseStats} active={showDatabaseStats} />
            </div>

            <div className="toolbar-divider" />

            {/* UTILS */}
            <div className="toolbar-group">
                <ToolbarButton
                    icon={isDownloadingOffline ? <Loader2 className="animate-spin" /> : <CloudDownload />}
                    title="Cartes Offline"
                    onClick={() => setPanel('region')}
                    active={activePanel === 'region'}
                />
                <ToolbarButton icon={<Maximize2 />} title="Plein Écran" onClick={() => document.documentElement.requestFullscreen()} />
            </div>
        </div>
    );
};
