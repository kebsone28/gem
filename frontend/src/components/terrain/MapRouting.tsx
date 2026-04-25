/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import { useMap, Polyline } from 'react-leaflet';
import logger from '../../utils/logger';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Navigation, Info, Car, Footprints } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface MapRoutingProps {
  enabled: boolean;
  onClose: () => void;
  startPoint?: [number, number] | null;
  endPoint?: [number, number] | null;
}

export const MapRouting: React.FC<MapRoutingProps> = ({
  enabled,
  onClose,
  startPoint,
  endPoint,
}) => {
  const map = useMap();
  const { isDarkMode } = useTheme();
  const [points, setPoints] = useState<[number, number][]>([]);
  const [route, setRoute] = useState<any>(null);
  const [mode, setMode] = useState<'driving' | 'walking'>('driving');

  // Sync external props to internal points state
  useEffect(() => {
    if (!enabled) {
      setPoints([]);
      setRoute(null);
      return;
    }

    if (startPoint && endPoint) {
      setPoints([startPoint, endPoint]);
    } else if (endPoint && !startPoint) {
      setPoints((prev) => {
        // If we already have a custom start point, keep it, just ensure endPoint is there
        if (prev.length > 0 && prev[0] !== endPoint) {
          return [prev[0], endPoint];
        }
        return [endPoint];
      });
    }
  }, [enabled, startPoint, endPoint]);

  const fetchRoute = React.useCallback(async () => {
    const osrmMode = mode === 'driving' ? 'driving' : 'foot';
    const coords = points.map((p) => `${p[1]},${p[0]}`).join(';');
    try {
      const resp = await fetch(
        `https://router.project-osrm.org/route/v1/${osrmMode}/${coords}?overview=full&geometries=geojson&steps=true`
      );
      const data = await resp.json();
      if (data.routes && data.routes.length > 0) {
        setRoute(data.routes[0]);
        // Fit bounds if needed
        const polyline = L.polyline(
          data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]])
        );
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }
    } catch (e) {
      logger.error('Routing error:', e);
    }
  }, [points, mode, map]);

  useEffect(() => {
    if (points.length === 2) {
      fetchRoute();
    }
  }, [points, mode, fetchRoute]);

  if (!enabled) return null;

  return (
    <div className="z-[1001] pointer-events-none absolute inset-0">
      {/* Markers for start/end */}
      {points.map((_, i) => (
        <div key={i} className="hidden" />
      ))}

      {route && (
        <Polyline
          pathOptions={{
            color: mode === 'driving' ? '#4f46e5' : '#10b981',
            weight: 6,
            opacity: 0.8,
            lineJoin: 'round',
          }}
          positions={[
            points[0],
            ...route.geometry.coordinates.map((c: any) => [c[1], c[0]]),
            points[points.length - 1],
          ]}
        />
      )}

      {/* Instruction Panel */}
      <AnimatePresence>
        <div className="absolute top-8 right-8 w-64 pointer-events-auto">
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className={`rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl transition-colors ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}
          >
            <div className="p-4 bg-indigo-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation size={16} className="text-white" />
                <span className="text-xs font-black text-white italic uppercase tracking-widest">
                  Itinéraire
                </span>
              </div>
              <button
                aria-label="Fermer"
                onClick={onClose}
                className="text-white/50 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                <button
                  aria-label="Mode Voiture"
                  onClick={() => setMode('driving')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'driving' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
                >
                  <Car size={12} /> Auto
                </button>
                <button
                  aria-label="Mode Piéton"
                  onClick={() => setMode('walking')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'walking' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500'}`}
                >
                  <Footprints size={12} /> Pied
                </button>
              </div>

              {!route ? (
                <div className="text-center py-6">
                  <Info size={24} className="mx-auto text-slate-400 mb-2 opacity-20" />
                  <p
                    className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                  >
                    {points.length === 0
                      ? 'Cliquez sur la carte pour définir le départ'
                      : points.length === 1
                        ? 'Cliquez pour définir la destination ou le départ'
                        : 'Calcul en cours...'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-black uppercase text-slate-500">Détails</span>
                    <div className="flex gap-3 text-xs font-black text-indigo-600">
                      <span>{(route.distance / 1000).toFixed(1)} km</span>
                      <span>{Math.round(route.duration / 60)} min</span>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {route.legs[0].steps.map((step: any, i: number) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}
                      >
                        <p
                          className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                        >
                          {step.maneuver.instruction}
                        </p>
                        <p className="text-xs text-slate-500 font-black uppercase mt-1">
                          {step.distance < 1000
                            ? `${Math.round(step.distance)} m`
                            : `${(step.distance / 1000).toFixed(1)} km`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    </div>
  );
};
