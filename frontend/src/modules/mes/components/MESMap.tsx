import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Filter, MapPin, Layers } from 'lucide-react';
import MapLibreVectorMap, { MapContext, type MapContextValue } from '@components/map/MapLibreVectorMap';
import type { Map } from 'maplibre-gl';
import mesAPI, { type MESRecord } from '@services/mesAPI';
import { useProject } from '@contexts/ProjectContext';

interface MESMapProps {
  isOpen: boolean;
  onClose: () => void;
}

const MESMap: React.FC<MESMapProps> = ({ isOpen, onClose }) => {
  const { activeProjectId } = useProject();
  const [records, setRecords] = useState<MESRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [map, setMap] = useState<Map | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPrestataire, setFilterPrestataire] = useState<string>('ALL');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { records: recordsData } = await mesAPI.getRecords({
        status: filterStatus === 'ALL' ? undefined : filterStatus,
        prestataire: filterPrestataire === 'ALL' ? undefined : filterPrestataire,
      });
      setRecords(recordsData);
    } catch (error) {
      console.error('Error loading MES records:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPrestataire]);

  useEffect(() => {
    if (isOpen) {
      loadRecords();
    }
  }, [isOpen, loadRecords]);

  const handleMapReady = useCallback((mapInstance: Map) => {
    setMap(mapInstance);
  }, []);

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    // Remove existing source and layers if they exist
    if (map.getSource('mes-points')) {
      map.removeSource('mes-points');
    }
    if (map.getLayer('mes-points-layer')) {
      map.removeLayer('mes-points-layer');
    }

    // Filter records with GPS coordinates
    const recordsWithGPS = records.filter(r => r.gpsLat && r.gpsLng);

    if (recordsWithGPS.length === 0) return;

    // Create GeoJSON feature collection
    const features = recordsWithGPS.map(r => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [r.gpsLng!, r.gpsLat!],
      },
      properties: {
        id: r.id,
        avisNumber: r.avisNumber,
        meterNumber: r.meterNumber,
        zone: r.zone,
        type: r.type,
        nature: r.nature,
        status: r.status,
        prestataire: r.prestataire,
        agent: r.agent,
        date: r.date,
      },
    }));

    const geojson = {
      type: 'FeatureCollection' as const,
      features,
    };

    // Add source
    map.addSource('mes-points', {
      type: 'geojson',
      data: geojson,
    });

    // Add circle layer
    map.addLayer({
      id: 'mes-points-layer',
      type: 'circle',
      source: 'mes-points',
      paint: {
        'circle-radius': 8,
        'circle-color': [
          'match',
          ['get', 'status'],
          'RECU', '#3b82f6',
          'PROGRAMME', '#eab308',
          'EN_COURS', '#f97316',
          'REALISE', '#a855f7',
          'CONTROLE', '#06b6d4',
          'VALIDE', '#22c55e',
          'FACTURE', '#6366f1',
          'PAYE', '#10b981',
          '#64748b',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

    // Add click handler
    map.on('click', 'mes-points-layer', (e) => {
      if (e.features && e.features.length > 0) {
        const properties = e.features[0].properties as any;
        const coordinates = (e.features[0].geometry as any).coordinates as [number, number];

        // Create popup content
        const popup = new (window as any).maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
        })
          .setLngLat(coordinates)
          .setHTML(`
            <div class="p-3 min-w-[200px]">
              <h3 class="font-bold text-sm mb-2">${properties.avisNumber}</h3>
              <p class="text-xs text-slate-600">Compteur: ${properties.meterNumber}</p>
              <p class="text-xs text-slate-600">Zone: ${properties.zone}</p>
              <p class="text-xs text-slate-600">Type: ${properties.type}</p>
              <p class="text-xs text-slate-600">Statut: ${properties.status}</p>
              <p class="text-xs text-slate-600">Prestataire: ${properties.prestataire}</p>
            </div>
          `)
          .addTo(map);
      }
    });

    // Change cursor on hover
    map.on('mouseenter', 'mes-points-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'mes-points-layer', () => {
      map.getCanvas().style.cursor = '';
    });

    // Fit bounds to show all points
    if (recordsWithGPS.length > 0) {
      const bounds = recordsWithGPS.reduce(
        (bounds, r) => bounds.extend([r.gpsLng!, r.gpsLat!]),
        new (window as any).maplibregl.LngLatBounds(
          [recordsWithGPS[0].gpsLng!, recordsWithGPS[0].gpsLat!],
          [recordsWithGPS[0].gpsLng!, recordsWithGPS[0].gpsLat!]
        )
      );
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [map, records]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      RECU: 'bg-blue-500',
      PROGRAMME: 'bg-yellow-500',
      EN_COURS: 'bg-orange-500',
      REALISE: 'bg-purple-500',
      CONTROLE: 'bg-cyan-500',
      VALIDE: 'bg-green-500',
      FACTURE: 'bg-indigo-500',
      PAYE: 'bg-emerald-500',
    };
    return colors[status] || 'bg-slate-500';
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-900 border border-slate-700 rounded-2xl w-full h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <MapPin className="text-blue-400" size={20} />
              </div>
              <h2 className="text-xl font-bold text-white">Cartographie MES</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="text-slate-400" size={20} />
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 p-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="RECU">Reçu</option>
                <option value="PROGRAMME">Programmé</option>
                <option value="EN_COURS">En cours</option>
                <option value="REALISE">Réalisé</option>
                <option value="CONTROLE">Contrôlé</option>
                <option value="VALIDE">Validé</option>
                <option value="FACTURE">Facturé</option>
                <option value="PAYE">Payé</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterPrestataire}
                onChange={e => setFilterPrestataire(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tous les prestataires</option>
                <option value="PROQUELEC">PROQUELEC</option>
                <option value="UMSAT">UMSAT</option>
                <option value="AUTRE">AUTRE</option>
              </select>
            </div>

            <div className="ml-auto text-sm text-slate-400">
              {records.filter(r => r.gpsLat && r.gpsLng).length} points GPS affichés
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/50 border-b border-slate-700 overflow-x-auto">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-slate-400" />
              <span className="text-xs text-slate-400">Légende:</span>
            </div>
            {['RECU', 'PROGRAMME', 'EN_COURS', 'REALISE', 'CONTROLE', 'VALIDE', 'FACTURE', 'PAYE'].map(status => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                <span className="text-xs text-slate-300">{status}</span>
              </div>
            ))}
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <div className="text-slate-400">Chargement...</div>
              </div>
            ) : (
              <MapLibreVectorMap initialMode="dark" onMapReady={handleMapReady} />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default MESMap;
