import React, { useState } from 'react';
import {
  Maximize2,
  Crosshair,
  Flame,
  Layers,
  Database,
  Navigation,
  Map as MapIcon,
  Truck,
  Sun,
  Moon,
  Satellite,
  Info,
  BarChart3,
  Ruler,
  MousePointer2,
  PenTool,
  Cloud,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
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
      aria-label={title}
      className={`toolbar-btn-lg group pointer-events-auto relative z-20 ${active ? 'active' : ''} ${danger && !active ? 'hover:bg-rose-500/10 hover:text-rose-400' : ''}`}
    >
      {React.cloneElement(icon as React.ReactElement<any>, {
        size: 14,
        strokeWidth: active ? 2.2 : 1.5,
      })}
      <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 px-3 py-1.5 text-[9px] font-black rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all z-[3000] uppercase tracking-widest translate-y-2 group-hover:translate-y-0 shadow-2xl bg-slate-900 text-white border border-white/5">
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
  const setMapCommand = useTerrainUIStore((s) => s.setMapCommand);
  const mapCommand = useTerrainUIStore((s) => s.mapCommand);
  const activePanel = useTerrainUIStore((s) => s.activePanel);
  const setPanel = useTerrainUIStore((s) => s.setPanel);

  const currentCenter = mapCommand?.center || [-14.65, 14.45];
  const currentZoom = mapCommand?.zoom ?? 7;

  const showHeatmap = useTerrainUIStore((s) => s.showHeatmap);
  const toggleHeatmap = useTerrainUIStore((s) => s.toggleHeatmap);

  const showZones = useTerrainUIStore((s) => s.showZones);
  const toggleZones = useTerrainUIStore((s) => s.toggleZones);

  const showDatabaseStats = useTerrainUIStore((s) => s.showDatabaseStats);
  const toggleDatabaseStats = useTerrainUIStore((s) => s.toggleDatabaseStats);
  const showLegend = useTerrainUIStore((s) => s.showLegend);
  const toggleLegend = useTerrainUIStore((s) => s.toggleLegend);
  const isMeasuring = useTerrainUIStore((s) => s.isMeasuring);
  const toggleMeasuring = useTerrainUIStore((s) => s.toggleMeasuring);
  const isSelecting = useTerrainUIStore((s) => s.isSelecting);
  const toggleSelecting = useTerrainUIStore((s) => s.toggleSelecting);
  const isDrawing = useTerrainUIStore((s) => s.isDrawing);
  const setIsDrawing = useTerrainUIStore((s) => s.setIsDrawing);

  const mapStyle = useTerrainUIStore((s) => s.mapStyle);
  const setMapStyle = (style: 'dark' | 'light' | 'satellite') => {
    // We use a custom action or the existing toggle if it only has 2 states,
    // but here we should probably update the store to support 3 styles.
    // For now, let's assume toggleMapStyle cycles or we use the specific style.
    useTerrainUIStore.setState({ mapStyle: style });
    localStorage.setItem('gem-map-style', style);
  };

  // Navigation Handlers
  const handleZoomIn = () => {
    setMapCommand({
      center: currentCenter,
      zoom: Math.min(currentZoom + 1, 22),
      timestamp: Date.now(),
    });
  };
  const handleZoomOut = () => {
    setMapCommand({
      center: currentCenter,
      zoom: Math.max(currentZoom - 1, 1),
      timestamp: Date.now(),
    });
  };
  const handleRecenter = () => {
    if (onRecenter) {
      onRecenter();
    } else {
      setMapCommand({ center: [-14.65, 14.45], zoom: 7, timestamp: Date.now() });
    }
  };
  const handleLocate = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Géolocalisation non supportée par ce navigateur.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapCommand({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 16,
          timestamp: Date.now(),
        });
      },
      (err) => {
        const message =
          err.code === 1
            ? 'Permission refusée pour la géolocalisation.'
            : err.code === 2
              ? 'Position introuvable.'
              : 'Impossible d’obtenir votre position.';
        toast.error(message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
                <button
                  onClick={() => {
                    setMapStyle('dark');
                    setShowStyleMenu(false);
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mapStyle === 'dark' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}
                >
                  <div className="flex items-center gap-3">
                    <Moon size={14} /> Nuit
                  </div>
                  {mapStyle === 'dark' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setMapStyle('light');
                    setShowStyleMenu(false);
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mapStyle === 'light' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}
                >
                  <div className="flex items-center gap-3">
                    <Sun size={14} /> Claire
                  </div>
                  {mapStyle === 'light' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setMapStyle('satellite');
                    setShowStyleMenu(false);
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mapStyle === 'satellite' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}
                >
                  <div className="flex items-center gap-3">
                    <Satellite size={14} /> Satellite
                  </div>
                  {mapStyle === 'satellite' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <ToolbarButton
          icon={<Flame />}
          title="Heatmap"
          onClick={toggleHeatmap}
          active={showHeatmap}
        />
        <ToolbarButton icon={<Layers />} title="Zones" onClick={toggleZones} active={showZones} />
      </div>

      <div className="toolbar-divider" />

      {/* EXPERT TOOLS GROUP */}
      <div className="toolbar-group">
        <ToolbarButton
          icon={<Truck />}
          title="Tournée Camion"
          onClick={() => setPanel('routing')}
          active={activePanel === 'routing'}
        />
        <ToolbarButton
          icon={<Database />}
          title="Liste des Grappes"
          onClick={() => setPanel('grappe')}
          active={activePanel === 'grappe'}
        />
        <ToolbarButton
          icon={<BarChart3 />}
          title="Stats Analytique"
          onClick={toggleDatabaseStats}
        />
      </div>

      <div className="toolbar-divider" />
      
      {/* GIS TOOLS GROUP */}
      <div className="toolbar-group">
        <ToolbarButton
          icon={<Ruler />}
          title="Mesurer Distance"
          onClick={toggleMeasuring}
          active={isMeasuring}
          danger={isMeasuring}
        />
        <ToolbarButton
          icon={<MousePointer2 />}
          title="Lasso de Sélection"
          onClick={toggleSelecting}
          active={isSelecting}
          danger={isSelecting}
        />
        <ToolbarButton
          icon={<PenTool />}
          title="Dessiner Zone"
          onClick={() => setPanel('draw')}
          active={activePanel === 'draw'}
          danger={activePanel === 'draw'}
        />
      </div>

      <div className="toolbar-divider" />
      
      {/* DATA & CLOUD */}
      <div className="toolbar-group">
        <ToolbarButton
          icon={<Cloud />}
          title="Data Hub (Kobo)"
          onClick={() => setPanel('datahub')}
          active={activePanel === 'datahub'}
        />
      </div>

      <div className="toolbar-divider" />

      {/* UTILS */}
      <div className="toolbar-group">
        <ToolbarButton
          icon={<Maximize2 />}
          title="Plein Écran"
          onClick={() => document.documentElement.requestFullscreen()}
        />
      </div>
    </div>
  );
};
