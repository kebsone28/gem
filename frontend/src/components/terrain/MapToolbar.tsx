import React from 'react';
import {
    Layers,
    Flame,
    Download,
    Ruler,
    Edit2,
    Database,
    Zap,
    History,
    FileText,
    Camera,
    Bell,
    Map as MapIcon,
    Palette,
    Share2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ToolbarButtonProps {
    icon: React.ReactNode;
    title: string;
    onClick?: () => void;
    active?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, title, onClick, active }) => {
    const { isDarkMode } = useTheme();
    return (
        <button
            onClick={onClick}
            title={title}
            className={`p-1.5 rounded-lg transition-all group relative ${active
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : isDarkMode
                    ? 'text-slate-500 hover:text-white hover:bg-slate-800'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
        >
            {React.cloneElement(icon as React.ReactElement<any>, { size: 12 })}
            <div className={`absolute left-full ml-3 px-3 py-1.5 text-[9px] font-black rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all z-[2000] uppercase tracking-widest translate-x-1 group-hover:translate-x-0 shadow-2xl ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 border border-slate-100'}`}>
                {title}
            </div>
        </button>
    );
};

export const MapToolbar: React.FC = () => {
    const { isDarkMode } = useTheme();
    const tools = [
        { id: 'layers', icon: <Layers size={18} />, title: 'Couches' },
        { id: 'heatmap', icon: <Flame size={18} />, title: 'Zones de chaleur' },
        { id: 'export', icon: <Download size={18} />, title: 'Exporter PDF/Excel' },
        { id: 'camera', icon: <Camera size={18} />, title: 'Capture écran' },
        { id: 'calendar', icon: <FileText size={18} />, title: 'Planning' },
        { id: 'gallery', icon: <Palette size={18} />, title: 'Galerie' },
        { id: 'zones', icon: <Database size={18} />, title: 'Polygones' },
        { id: 'measure', icon: <Ruler size={18} />, title: 'Mesure' },
        { id: 'annotate', icon: <Edit2 size={18} />, title: 'Annoter' },
        { id: 'alerts', icon: <Bell size={18} />, title: 'Alertes' },
        { id: 'network', icon: <Zap size={18} />, title: 'Saisie Réseau' },
        { id: 'history', icon: <History size={18} />, title: 'Historique' },
        { id: 'share', icon: <Share2 size={18} />, title: 'Partager' },
        { id: 'pdf', icon: <MapIcon size={18} />, title: 'Rapport' },
    ];

    return (
        <div className={`absolute top-20 left-6 z-[1000] flex flex-col gap-0.5 p-1 rounded-xl border shadow-2xl backdrop-blur-xl transition-colors ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
            {tools.map((tool) => (
                <ToolbarButton
                    key={tool.id}
                    icon={tool.icon}
                    title={tool.title || ''}
                    onClick={() => console.log(`Tool ${tool.id} clicked`)}
                />
            ))}
        </div>
    );
};
