/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * GeoJsonOverlay.tsx
 *
 * Outil d'import de fichiers GeoJSON / KML externes sur la carte.
 * Affiche also les limites administratives du Sénégal via GADM public.
 */
import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Globe, Trash2, Layers } from 'lucide-react';

export interface ExternalLayer {
  id: string;
  name: string;
  type: 'geojson' | 'admin';
  color: string;
  geojson: any;
  visible: boolean;
}

const LAYER_COLORS = ['#06b6d4', '#a855f7', '#f59e0b', '#10b981', '#f43f5e'];

import { useTerrainUIStore } from '../../store/terrainUIStore';

export function GeoJsonOverlayPanel({ isDarkMode = true }: { isDarkMode?: boolean }) {
  const layers = useTerrainUIStore((s) => s.externalLayers);
  const onLayersChange = useTerrainUIStore((s) => s.setExternalLayers);

  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bg = isDarkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200';
  const text = isDarkMode ? 'text-white' : 'text-slate-900';
  const sub = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const addLayer = (name: string, geojson: any, type: 'geojson' | 'admin' = 'geojson') => {
    const color = LAYER_COLORS[layers.length % LAYER_COLORS.length];
    const newLayer: ExternalLayer = {
      id: `layer_${Date.now()}`,
      name,
      type,
      color,
      geojson,
      visible: true,
    };
    onLayersChange([...layers, newLayer]);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const text = await file.text();
      let geojson: any;

      if (file.name.endsWith('.kml')) {
        // Parsing KML basique via DOMParser
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(text, 'text/xml');
        const placemarks = Array.from(kmlDoc.querySelectorAll('Placemark'));
        const features = placemarks
          .map((p) => {
            const coords = p.querySelector('coordinates')?.textContent?.trim();
            if (!coords) return null;
            const points = coords
              .split(/\s+/)
              .map((c) => {
                const [lon, lat] = c.split(',').map(Number);
                return [lon, lat] as [number, number];
              })
              .filter(([lon, lat]) => !isNaN(lon) && !isNaN(lat));
            const name = p.querySelector('name')?.textContent || 'Sans nom';
            if (points.length === 1)
              return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: points[0] },
                properties: { name },
              };
            return {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: points },
              properties: { name },
            };
          })
          .filter(Boolean);
        geojson = { type: 'FeatureCollection', features };
      } else {
        geojson = JSON.parse(text);
      }

      addLayer(file.name.replace(/\.(geojson|json|kml)$/i, ''), geojson);
    } catch (err) {
      setError('Fichier invalide. Utilisez un GeoJSON ou KML valide.');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const loadAdminBoundaries = async () => {
    setLoading(true);
    setError('');
    try {
      // Utilisation d'une couche GeoJSON légère Sénégal depuis ressource locale
      const res = await fetch('/data/senegal-regions.geojson');
      if (!res.ok) throw new Error('Indisponible');
      const geojson = await res.json();
      addLayer('Régions du Sénégal', geojson, 'admin');
    } catch {
      // Fallback: bounding box du Sénégal si l'URL externe échoue
      const fallback = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-17.53, 12.3],
                  [-11.36, 12.3],
                  [-11.36, 16.69],
                  [-17.53, 16.69],
                  [-17.53, 12.3],
                ],
              ],
            },
            properties: { name: 'Sénégal (Bounding Box)' },
          },
        ],
      };
      addLayer('Frontières Sénégal', fallback, 'admin');
    } finally {
      setLoading(false);
    }
  };

  const toggleLayer = (id: string) => {
    onLayersChange(layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };

  const deleteLayer = (id: string) => {
    onLayersChange(layers.filter((l) => l.id !== id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`absolute top-[144px] left-3 right-3 md:top-20 md:left-auto md:right-4 z-30 md:w-72 rounded-2xl border shadow-2xl backdrop-blur-sm overflow-hidden max-h-[calc(100vh-220px)] md:max-h-[unset] flex flex-col ${bg}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700/30 flex items-center gap-3">
        <div className="p-2 bg-cyan-500/10 rounded-xl">
          <Layers size={16} className="text-cyan-400" />
        </div>
        <div>
          <p className={`text-sm font-bold ${text}`}>Couches Externes</p>
          <p className={`text-xs ${sub}`}>
            {layers.length} couche{layers.length !== 1 ? 's' : ''} active
            {layers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        {/* Import fichier */}
        <input
          ref={fileRef}
          type="file"
          accept=".geojson,.json,.kml"
          className="hidden"
          title="Importer un fichier GeoJSON ou KML"
          aria-label="Sélectionner un fichier géographique"
          onChange={handleFileImport}
        />
        <button
          aria-label="Importer un fichier GeoJSON ou KML"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-xl py-2.5 transition-colors disabled:opacity-50"
        >
          <FolderOpen size={15} />
          {loading ? 'Chargement...' : 'Importer GeoJSON / KML'}
        </button>

        {/* Limites admin */}
        <button
          aria-label="Charger les régions du Sénégal"
          onClick={loadAdminBoundaries}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 text-sm font-bold rounded-xl py-2.5 transition-colors disabled:opacity-50 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
        >
          <Globe size={15} /> Régions Sénégal
        </button>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Liste couches */}
        {layers.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto pt-1">
            {(layers as any[]).map((layer: ExternalLayer) => (
              <div
                key={layer.id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <button
                  title={layer.visible ? 'Masquer la couche' : 'Afficher la couche'}
                  onClick={() => toggleLayer(layer.id)}
                  className="w-3 h-3 rounded-sm border-2 flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: layer.visible ? (layer as any).color : 'transparent',
                    borderColor: (layer as any).color,
                  } as React.CSSProperties}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${text}`}>{layer.name}</p>
                  <p className={`text-xs ${sub}`}>
                    {layer.type === 'admin' ? '🗺️ Admin' : '📂 Import'} ·{' '}
                    {layer.geojson?.features?.length ?? '?'} entité
                    {(layer.geojson?.features?.length ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  title={`Supprimer ${layer.name}`}
                  onClick={() => deleteLayer(layer.id)}
                  className="text-rose-400 hover:text-rose-300 transition-colors p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
