import React, { useState } from 'react';
import { Download, X, Check, Trash2, Info } from 'lucide-react';

interface Region {
  id: string;
  name: string;
  bbox: [[number, number], [number, number]]; // [sw, ne]
  sizeEstimate: string;
}

const SENEGAL_REGIONS: Region[] = [
  {
    id: 'dakar',
    name: 'Dakar',
    bbox: [
      [-17.55, 14.6],
      [-17.2, 14.85],
    ],
    sizeEstimate: '1.2 MB',
  },
  {
    id: 'thies',
    name: 'Thiès',
    bbox: [
      [-17.2, 14.25],
      [-16.3, 15.3],
    ],
    sizeEstimate: '2.5 MB',
  },
  {
    id: 'saint-louis',
    name: 'Saint-Louis',
    bbox: [
      [-16.65, 15.75],
      [-14.45, 16.75],
    ],
    sizeEstimate: '4.1 MB',
  },
  {
    id: 'tamba',
    name: 'Tambacounda',
    bbox: [
      [-14.6, 12.35],
      [-11.45, 15.2],
    ],
    sizeEstimate: '8.4 MB',
  },
  {
    id: 'casamance',
    name: 'Casamance',
    bbox: [
      [-17.1, 12.3],
      [-13.9, 13.5],
    ],
    sizeEstimate: '5.2 MB',
  },
];

import { useTerrainUIStore } from '../../store/terrainUIStore';
import * as safeStorage from '../../utils/safeStorage';
import toast from 'react-hot-toast';

interface MapRegionDownloadProps {
  onClose: () => void;
}

export const MapRegionDownload: React.FC<MapRegionDownloadProps> = ({ onClose }) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Zustand Store logic
  const setIsDownloadingOffline = useTerrainUIStore((s) => s.setIsDownloadingOffline);
  const [downloadedRegions, setDownloadedRegions] = useState<string[]>(
    JSON.parse(safeStorage.getItem('downloaded_regions') || '[]')
  );

  const handleDownload = async (region: Region) => {
    setDownloadingId(region.id);
    setIsDownloadingOffline(true);
    try {
      const martinUrl = import.meta.env.VITE_MARTIN_URL || window.location.origin;
      const cache = await caches.open('households-mvt-cache');
      const [[swLng, swLat], [neLng, neLat]] = region.bbox;

      // Échelles Z=10 à Z=14 pour une couverture offline complète
      const tilesToFetch: string[] = [];
      for (let z = 10; z <= 14; z++) {
        const latMin = Math.min(swLat, neLat);
        const latMax = Math.max(swLat, neLat);
        const lngMin = Math.min(swLng, neLng);
        const lngMax = Math.max(swLng, neLng);

        const xMin = Math.floor(((lngMin + 180) / 360) * Math.pow(2, z));
        const xMax = Math.floor(((lngMax + 180) / 360) * Math.pow(2, z));
        const yMin = Math.floor(
          ((1 -
            Math.log(Math.tan((latMax * Math.PI) / 180) + 1 / Math.cos((latMax * Math.PI) / 180)) /
              Math.PI) /
            2) *
            Math.pow(2, z)
        );
        const yMax = Math.floor(
          ((1 -
            Math.log(Math.tan((latMin * Math.PI) / 180) + 1 / Math.cos((latMin * Math.PI) / 180)) /
              Math.PI) /
            2) *
            Math.pow(2, z)
        );

        for (let x = xMin; x <= xMax; x++) {
          for (let y = yMin; y <= yMax; y++) {
            tilesToFetch.push(`${martinUrl}/api/geo/mvt/households/${z}/${x}/${y}`);
          }
        }
      }

      // Téléchargement par lots de 10 tuiles
      for (let i = 0; i < tilesToFetch.length; i += 10) {
        const batch = tilesToFetch.slice(i, i + 10);
        await Promise.all(batch.map((url) => cache.add(url).catch(() => {})));
      }

      const newRegions = [...downloadedRegions, region.id];
      setDownloadedRegions(newRegions);
      safeStorage.setItem('downloaded_regions', JSON.stringify(newRegions));
      toast.success(`Région ${region.name} téléchargée (${tilesToFetch.length} tuiles) !`);
    } catch (e) {
      toast.error('Erreur lors du téléchargement — Vérifiez la connexion.');
    } finally {
      setDownloadingId(null);
      setIsDownloadingOffline(false);
    }
  };

  const handleRemove = (id: string) => {
    const newRegions = downloadedRegions.filter((r) => r !== id);
    setDownloadedRegions(newRegions);
    safeStorage.setItem('downloaded_regions', JSON.stringify(newRegions));
    toast.success('Région supprimée du cache');
  };

  return (
    <div className="absolute top-20 left-4 right-4 md:right-4 md:left-auto max-w-[calc(100vw-2rem)] md:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-[1000] animate-in slide-in-from-right-4 duration-300">
      <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-white/5">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-blue-600" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
            Cartes Offline
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-all"
          aria-label="Fermer"
        >
          <X size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="p-2 max-h-[400px] overflow-y-auto">
        <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl mb-2 flex gap-3">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
            Téléchargez des régions entières pour accéder aux points d'intérêt et à la navigation
            sans connexion internet.
          </p>
        </div>

        {SENEGAL_REGIONS.map((region) => {
          const isDownloaded = downloadedRegions.includes(region.id);
          const isDownloading = downloadingId === region.id;

          return (
            <div
              key={region.id}
              className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all flex items-center justify-between group"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {region.name}
                </h4>
                <span className="text-xs text-slate-400 font-black uppercase tracking-widest">
                  {region.sizeEstimate}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {isDownloaded ? (
                  <>
                    <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">
                      <Check size={12} className="text-emerald-500" />
                      <span className="text-xs font-black text-emerald-600 uppercase">Prêt</span>
                    </div>
                    <button
                      onClick={() => handleRemove(region.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDownload(region)}
                    disabled={isDownloading || downloadingId !== null}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all
                      ${isDownloading ? 'bg-slate-100 text-slate-400 animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20'}
                      disabled:opacity-50`}
                  >
                    {isDownloading ? 'En cours...' : 'Télécharger'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5">
        <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
          <span>Espace utilisé</span>
          <span>{downloadedRegions.length * 4} MB / 500 MB</span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full bg-blue-600 transition-all duration-500 ${
              {
                0: 'w-0',
                1: 'w-[10%]',
                2: 'w-[20%]',
                3: 'w-[30%]',
                4: 'w-[40%]',
                5: 'w-[50%]',
              }[downloadedRegions.length] || 'w-full'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
