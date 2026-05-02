/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  title,
  onClick,
  active,
  danger,
}) => {
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
  features?: {
    mapStyle?: boolean;
    statusLegend?: boolean;
    zoneOverlay?: boolean;
    zoneOverlayReady?: boolean;
    zoneOverlayLoading?: boolean;
    routing?: boolean;
    grappeTools?: boolean;
    analytics?: boolean;
    heatmap?: boolean;
    measure?: boolean;
    lasso?: boolean;
    drawZones?: boolean;
    geoJsonLayers?: boolean;
    regionDownload?: boolean;
    dataHub?: boolean;
  };
}

export const MapToolbar: React.FC<MapToolbarProps> = ({ onRecenter, features }) => {
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [styleMenuPosition, setStyleMenuPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const styleMenuTriggerRef = useRef<HTMLDivElement | null>(null);
  const styleMenuRef = useRef<HTMLDivElement | null>(null);

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
  const zoneOverlayReady = features?.zoneOverlayReady !== false;
  const zoneOverlayLoading = features?.zoneOverlayLoading === true;
  const setMapStyle = (style: 'dark' | 'light' | 'satellite') => {
    // We use a custom action or the existing toggle if it only has 2 states,
    // but here we should probably update the store to support 3 styles.
    // For now, let's assume toggleMapStyle cycles or we use the specific style.
    useTerrainUIStore.setState({ mapStyle: style });
    localStorage.setItem('gem-map-theme', style);
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

  useEffect(() => {
    if (!showStyleMenu) return;

    const updateStyleMenuPosition = () => {
      const trigger = styleMenuTriggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 176;
      const viewportPadding = 16;
      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding
      );

      setStyleMenuPosition({
        top: rect.bottom + 12,
        left,
      });
    };

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        (styleMenuTriggerRef.current && styleMenuTriggerRef.current.contains(target)) ||
        (styleMenuRef.current && styleMenuRef.current.contains(target))
      ) {
        return;
      }

      setShowStyleMenu(false);
    };

    updateStyleMenuPosition();
    window.addEventListener('resize', updateStyleMenuPosition);
    window.addEventListener('scroll', updateStyleMenuPosition, true);
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('resize', updateStyleMenuPosition);
      window.removeEventListener('scroll', updateStyleMenuPosition, true);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showStyleMenu]);

  return (
    <>
      <div className="map-toolbar-horizontal group">
      {/* NAVIGATION GROUP */}
      <div className="toolbar-group">
        <div className="toolbar-divider" />
        <ToolbarButton icon={<Crosshair />} title="Recentrer" onClick={handleRecenter} />
        <ToolbarButton icon={<Navigation />} title="Ma Position" onClick={handleLocate} />
      </div>

      <div className="toolbar-divider" />

      {/* VISUALIZATION & STYLE GROUP */}
      {(features?.mapStyle || features?.statusLegend || features?.zoneOverlay || features?.heatmap) && (
        <>
          <div className="toolbar-group">
            {features?.mapStyle && (
              <div ref={styleMenuTriggerRef} className="relative">
                <ToolbarButton
                  icon={<MapIcon />}
                  title="Style de Carte"
                  onClick={() => setShowStyleMenu(!showStyleMenu)}
                  active={showStyleMenu}
                />
              </div>
            )}
            {features?.statusLegend && (
              <ToolbarButton
                icon={<Info />}
                title={showLegend ? 'Masquer la légende' : 'Afficher la légende'}
                onClick={toggleLegend}
                active={showLegend}
              />
            )}
            {features?.heatmap && (
              <ToolbarButton
                icon={<Flame />}
                title="Heatmap"
                onClick={toggleHeatmap}
                active={showHeatmap}
              />
            )}
            {features?.zoneOverlay && (
              <ToolbarButton
                icon={<Layers />}
                title={
                  zoneOverlayReady
                    ? 'Zones'
                    : zoneOverlayLoading
                      ? 'Chargement des zones'
                      : 'Zones indisponibles'
                }
                onClick={() => {
                  if (zoneOverlayReady) {
                    toggleZones();
                    return;
                  }

                  if (zoneOverlayLoading) {
                    if (!showZones) toggleZones();
                    toast('Chargement des zones en cours. Elles s’afficheront automatiquement.', {
                      icon: '🗺️',
                    });
                    return;
                  }

                  toast.error('Aucune zone exploitable n’est disponible pour cette vue.');
                }}
                active={showZones && (zoneOverlayReady || zoneOverlayLoading)}
              />
            )}
          </div>
          <div className="toolbar-divider" />
        </>
      )}

      {/* EXPERT TOOLS GROUP */}
      {(features?.routing || features?.grappeTools || features?.analytics) && (
        <>
          <div className="toolbar-group">
            {features?.routing && (
              <ToolbarButton
                icon={<Truck />}
                title="Itinéraire"
                onClick={() => setPanel('routing')}
                active={activePanel === 'routing'}
              />
            )}
            {features?.grappeTools && (
              <ToolbarButton
                icon={<Database />}
                title="Liste des Grappes"
                onClick={() => setPanel('grappe')}
                active={activePanel === 'grappe'}
              />
            )}
            {features?.analytics && (
              <ToolbarButton
                icon={<BarChart3 />}
                title="Stats Analytique"
                onClick={toggleDatabaseStats}
                active={showDatabaseStats}
              />
            )}
          </div>
          <div className="toolbar-divider" />
        </>
      )}
      
      {/* GIS TOOLS GROUP */}
      {(features?.measure || features?.lasso || features?.drawZones || features?.regionDownload) && (
        <>
          <div className="toolbar-group">
            {features?.measure && (
              <ToolbarButton
                icon={<Ruler />}
                title="Mesurer Distance"
                onClick={toggleMeasuring}
                active={isMeasuring}
                danger={isMeasuring}
              />
            )}
            {features?.lasso && (
              <ToolbarButton
                icon={<MousePointer2 />}
                title="Lasso de Sélection"
                onClick={toggleSelecting}
                active={isSelecting}
                danger={isSelecting}
              />
            )}
            {features?.drawZones && (
              <ToolbarButton
                icon={<PenTool />}
                title="Dessiner Zone"
                onClick={() => setPanel('draw')}
                active={activePanel === 'draw'}
                danger={activePanel === 'draw'}
              />
            )}
          </div>
          <div className="toolbar-divider" />
        </>
      )}
      
      {/* DATA & CLOUD */}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showStyleMenu && styleMenuPosition && (
              <motion.div
                ref={styleMenuRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{
                  position: 'fixed',
                  top: styleMenuPosition.top,
                  left: styleMenuPosition.left,
                  width: 176,
                }}
                className="p-2 rounded-2xl bg-[#0D1E35] border border-white/10 shadow-2xl flex flex-col gap-2 z-[2600]"
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
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};
