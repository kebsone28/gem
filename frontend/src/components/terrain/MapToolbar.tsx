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
    CircleDashed
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

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
            <div className={`absolute left-full ml-4 px-3 py-1.5 text-[10px] font-black rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all z-[2000] uppercase tracking-widest translate-x-2 group-hover:translate-x-0 shadow-2xl ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
                {title}
            </div>
        </button>
    );
};

import React from 'react';

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
    onToggleMapStyle
}) => {
    const { isDarkMode } = useTheme();

    return (
        <div className={`absolute top-24 left-6 z-[1000] flex flex-col gap-1.5 p-1.5 rounded-2xl border shadow-2xl map-widget-glass transition-all ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <ToolbarButton icon={<Plus />} title="Zoom Avant" onClick={onZoomIn} />
            <ToolbarButton icon={<Minus />} title="Zoom Arrière" onClick={onZoomOut} />
            <div className={`h-px w-4 mx-auto my-0.5 ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
            <ToolbarButton icon={<Crosshair />} title="Recentrer" onClick={onRecenter} />
            <ToolbarButton icon={<Navigation size={18} />} title="Ma Position" onClick={onLocate} />
            <div className={`h-px w-4 mx-auto my-0.5 ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
            <ToolbarButton icon={<Flame />} title="Heatmap" onClick={onToggleHeatmap} active={showHeatmap} />
            <ToolbarButton icon={<Layers />} title="Zones" onClick={onToggleZones} active={showZones} />
            <ToolbarButton icon={<Ruler />} title="Mesurer la distance" onClick={onToggleMeasuring} active={isMeasuring} />
            <ToolbarButton icon={<Database />} title="Analytique Carte" onClick={onToggleDatabaseStats} active={showDatabaseStats} />
            <ToolbarButton icon={<CircleDashed />} title={mapStyle === 'streets' ? 'Vue Satellite' : 'Vue Rues'} onClick={onToggleMapStyle} active={mapStyle === 'satellite'} />
            <div className={`h-px w-4 mx-auto my-0.5 ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`} />
            <ToolbarButton icon={<Maximize2 />} title="Plein Écran" onClick={() => document.documentElement.requestFullscreen()} />
        </div>
    );
};
