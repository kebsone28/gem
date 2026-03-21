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
    CircleDashed,
    MousePointer2,
    Map as MapIcon,
    Truck,
    PenLine,
    Globe,
    Users,
    CloudDownload,
    Loader2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface ToolbarButtonProps {
    icon: React.ReactNode;
    title: string;
    onClick?: () => void;
    active?: boolean;
    danger?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, title, onClick, active, danger }) => {
    const { isDarkMode } = useTheme();
    return (
        <button
            onClick={onClick}
            title={title}
            className={`p-2 rounded-xl transition-all group relative border ${active
                ? 'bg-primary text-white shadow-lg shadow-primary/30 border-primary'
                : isDarkMode
                    ? 'text-slate-400 hover:text-white hover:bg-white/10 border-white/5'
                    : 'text-slate-500 hover:text-primary hover:bg-primary/10 border-slate-100'
                } ${danger && !active ? 'hover:text-rose-500 hover:bg-rose-500/10' : ''}`}
        >
            {React.cloneElement(icon as React.ReactElement<any>, { size: 14, strokeWidth: active ? 2.5 : 2 })}
            <div className={`absolute top-full mt-3 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all z-[2000] uppercase tracking-widest translate-y-2 group-hover:translate-y-0 shadow-2xl ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
                {title}
            </div>
        </button>
    );
};

interface MapToolbarProps {
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onRecenter?: () => void;
    onLocate?: () => void;
    onToggleHeatmap?: () => void;
    onToggleZones?: () => void;
    showHeatmap?: boolean;
    showZones?: boolean;
    isMeasuring?: boolean;
    onToggleMeasuring?: () => void;
    showDatabaseStats?: boolean;
    onToggleDatabaseStats?: () => void;
    mapStyle?: 'streets' | 'satellite';
    onToggleMapStyle?: () => void;
    isSelecting?: boolean;
    onToggleSelection?: () => void;
    showRoutingPanel?: boolean;
    onToggleRouting?: () => void;
    showDrawPanel?: boolean;
    onToggleDraw?: () => void;
    showLayersPanel?: boolean;
    onToggleLayers?: () => void;
    showTrackingPanel?: boolean;
    onToggleTracking?: () => void;
    showGrappePanel?: boolean;
    onToggleGrappe?: () => void;
    showRegionDownload?: boolean;
    onToggleRegionDownload?: () => void;
    isDownloadingOffline?: boolean;
}

export const MapToolbar: React.FC<MapToolbarProps> = ({
    onZoomIn,
    onZoomOut,
    onRecenter,
    onLocate,
    onToggleHeatmap,
    onToggleZones,
    showHeatmap,
    showZones,
    isMeasuring,
    onToggleMeasuring,
    showDatabaseStats,
    onToggleDatabaseStats,
    mapStyle,
    onToggleMapStyle,
    isSelecting,
    onToggleSelection,
    showRoutingPanel,
    onToggleRouting,
    showDrawPanel,
    onToggleDraw,
    showLayersPanel,
    onToggleLayers,
    showTrackingPanel,
    onToggleTracking,
    showGrappePanel,
    onToggleGrappe,
    showRegionDownload,
    onToggleRegionDownload,
    isDownloadingOffline
}) => {
    const { isDarkMode } = useTheme();
    const [showStyleMenu, setShowStyleMenu] = useState(false);

    const GroupDivider = () => <div className={`w-px h-4 my-auto mx-1 ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`} />;

    return (
        <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-[1000] flex flex-row gap-3 items-center whitespace-nowrap">
            {/* NAVIGATION GROUP */}
            <div className={`flex flex-row gap-1 p-1.5 rounded-2xl border shadow-2xl map-widget-glass transition-all ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <ToolbarButton icon={<Plus />} title="Zoom Avant" onClick={onZoomIn} />
                <ToolbarButton icon={<Minus />} title="Zoom Arrière" onClick={onZoomOut} />
                <GroupDivider />
                <ToolbarButton icon={<Crosshair />} title="Recentrer" onClick={onRecenter} />
                <ToolbarButton 
                    icon={<Navigation size={18} />} 
                    title="Ma Position" 
                    onClick={onLocate} 
                />
            </div>

            {/* VISUALIZATION GROUP */}
            <div className={`flex flex-row gap-1 p-1.5 rounded-2xl border shadow-2xl map-widget-glass transition-all ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="relative">
                    <ToolbarButton 
                        icon={<MapIcon />} 
                        title="Style de Carte" 
                        onClick={() => setShowStyleMenu(!showStyleMenu)} 
                        active={showStyleMenu}
                    />
                    <AnimatePresence>
                        {showStyleMenu && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className={`absolute top-full mt-3 left-1/2 -translate-x-1/2 p-2 rounded-xl border shadow-2xl map-widget-glass flex flex-col gap-1 min-w-[140px] ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}
                            >
                                <button onClick={() => { onToggleMapStyle?.(); setShowStyleMenu(false); }} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mapStyle === 'streets' ? 'bg-primary text-white' : 'hover:bg-primary/10 text-slate-400'}`}>
                                    <CircleDashed size={12} /> Rues
                                </button>
                                <button onClick={() => { onToggleMapStyle?.(); setShowStyleMenu(false); }} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mapStyle === 'satellite' ? 'bg-primary text-white' : 'hover:bg-primary/10 text-slate-400'}`}>
                                    <Database size={12} /> Satellite
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <ToolbarButton icon={<Flame />} title="Heatmap" onClick={onToggleHeatmap} active={showHeatmap} />
                <ToolbarButton icon={<Layers />} title="Zones" onClick={onToggleZones} active={showZones} />
            </div>

            {/* EXPERT TOOLS GROUP */}
            <div className={`flex flex-row gap-1 p-1.5 rounded-2xl border shadow-2xl map-widget-glass transition-all ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <ToolbarButton icon={<Ruler />} title="Mesurer" onClick={onToggleMeasuring} active={isMeasuring} />
                <ToolbarButton 
                    icon={<MousePointer2 />} 
                    title="Sélection Lasso" 
                    onClick={onToggleSelection} 
                    active={isSelecting} 
                />
                <ToolbarButton 
                    icon={<Truck />} 
                    title="Tournée Camion" 
                    onClick={onToggleRouting} 
                    active={showRoutingPanel} 
                />
                <ToolbarButton 
                    icon={<PenLine />} 
                    title="Dessiner Zones" 
                    onClick={onToggleDraw} 
                    active={showDrawPanel} 
                />
                <ToolbarButton 
                    icon={<Globe />} 
                    title="Import Calques" 
                    onClick={onToggleLayers} 
                    active={showLayersPanel} 
                />
                <ToolbarButton 
                    icon={<Users />} 
                    title="Suivi Équipes" 
                    onClick={onToggleTracking} 
                    active={showTrackingPanel} 
                />
                <ToolbarButton 
                    icon={<Layers />} 
                    title="Auto-Clustering" 
                    onClick={onToggleGrappe} 
                    active={showGrappePanel} 
                />
                <ToolbarButton icon={<Database />} title="Analytique" onClick={onToggleDatabaseStats} active={showDatabaseStats} />
            </div>

            {/* OFFLINE & UTILS */}
            <div className={`flex flex-row gap-1 p-1.5 rounded-2xl border shadow-2xl map-widget-glass transition-all ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <ToolbarButton 
                    icon={isDownloadingOffline ? <Loader2 className="animate-spin" /> : <CloudDownload />} 
                    title="Cartes Offline" 
                    onClick={onToggleRegionDownload} 
                    active={showRegionDownload} 
                />
                <GroupDivider />
                <ToolbarButton icon={<Maximize2 />} title="Plein Écran" onClick={() => document.documentElement.requestFullscreen()} />
            </div>
        </div>
    );
};
