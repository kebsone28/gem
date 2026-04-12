/**
 * GeofencingAlerts.tsx
 *
 * Détecte les anomalies géospatiales : ménages avec un statut avancé
 * mais dont la position GPS est trop éloignée du centroïde de leur zone (grappe).
 * Affiche une barre d'alerte sur la carte.
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { Household } from '../../utils/types';

interface GeofencingAlertsProps {
  households: Household[];
  grappesConfig?: any;
  isDarkMode: boolean;
}

const GEOFENCE_THRESHOLD_KM = 2; // Alert if household is more than 2km from its zone centroid

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const GeofencingAlerts: React.FC<GeofencingAlertsProps> = ({
  households,
  grappesConfig,
  isDarkMode,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const anomalies = useMemo(() => {
    const grappes = grappesConfig?.grappes || [];
    const sousGrappes = grappesConfig?.sous_grappes || [];
    const allZones = [...grappes, ...sousGrappes];
    if (allZones.length === 0) return [];

    return households.filter((h) => {
      // Only check households with meaningful progress
      const hasProgress = h.koboSync?.livreurDate || h.koboSync?.maconOk || h.koboSync?.reseauOk;
      if (!hasProgress) return false;

      // Only check households with a known GPS position
      if (!h.location?.coordinates || h.location.coordinates.length < 2) return false;
      const [hhLon, hhLat] = h.location.coordinates;
      if (isNaN(hhLat) || isNaN(hhLon)) return false;

      // Check if this household is far from ALL known zone centroids
      const closestZone = allZones.reduce((best: any, z: any) => {
        const dist = haversineKm(hhLat, hhLon, Number(z.centroide_lat), Number(z.centroide_lon));
        return dist < (best?.dist ?? Infinity) ? { z, dist } : best;
      }, null);

      return closestZone && closestZone.dist > GEOFENCE_THRESHOLD_KM;
    });
  }, [households, grappesConfig]);

  if (anomalies.length === 0 || !isVisible) return null;

  return (
    <div
      className={`absolute top-4 right-4 z-[300] w-80 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all ${
        isDarkMode ? 'bg-rose-950/95 border-rose-800/60' : 'bg-rose-50/95 border-rose-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500 flex items-center justify-center animate-pulse">
            <AlertTriangle size={13} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {anomalies.length} Alerte{anomalies.length > 1 ? 's' : ''} GPS
            </p>
            <p className="text-xs text-rose-500/70 dark:text-rose-500/50">
              Positions hors zone (≥{GEOFENCE_THRESHOLD_KM}km)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded((e) => !e)}
            title={isExpanded ? 'Réduire' : 'Voir les alertes'}
            className="p-1 rounded-md text-rose-400 hover:text-rose-600 transition-colors"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            aria-label="Masquer les alertes"
            className="p-1 rounded-md text-rose-400 hover:text-rose-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expanded anomaly list */}
      {isExpanded && (
        <div className="border-t border-rose-200/50 dark:border-rose-800/40 max-h-52 overflow-auto">
          {anomalies.slice(0, 10).map((h) => {
            const [lon, lat] = h.location!.coordinates;
            const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
            return (
              <div
                key={h.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-rose-200/30 dark:border-rose-800/20 last:border-0"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300 truncate">
                    {h.id}
                  </p>
                  {h.owner && <p className="text-xs text-rose-500/70 truncate">{h.owner}</p>}
                </div>
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Voir sur Google Maps"
                  className="p-1.5 rounded-lg bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 transition-colors flex-shrink-0"
                >
                  <ExternalLink size={10} />
                </a>
              </div>
            );
          })}
          {anomalies.length > 10 && (
            <div className="px-4 py-2 text-center text-xs text-rose-500/60 dark:text-rose-500/40">
              + {anomalies.length - 10} autres anomalies
            </div>
          )}
        </div>
      )}
    </div>
  );
};
