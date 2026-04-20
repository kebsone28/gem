/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * dataAuditWorker.ts
 *
 * Web Worker for high-performance GIS data auditing.
 * Scans 50,000+ households to identify:
 * - Duplicate Coordinates (Critical integrity issue)
 * - Out of Bounds points (Geographic anomaly)
 * - Missing Crucial Metadata (Incomplete status, name, etc.)
 */

interface OwnerField {
  name?: string;
  nom?: string;
  fullname?: string;
}

interface Household {
  id: string;
  location?: { coordinates: [number, number] };
  status?: string;
  owner?: OwnerField | string;
  name?: string;
  phone?: string;
  village?: string;
}

interface AuditAnomaly {
  id: string;
  type: 'DUPLICATE_COORDS' | 'OUT_OF_BOUNDS' | 'MISSING_DATA' | 'REGIONAL_MISMATCH';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  householdId: string;
  lng?: number;
  lat?: number;
}

interface AuditResult {
  healthScore: number;
  stats: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  anomalies: AuditAnomaly[];
}

// Senegal Bounding Box (Approximate)
const SENEGAL_BBOX = {
  minLng: -18,
  maxLng: -11,
  minLat: 12,
  maxLat: 17,
};

export const normalizeOwnerName = (owner?: OwnerField | string, fallbackName?: string) => {
  if (!owner && !fallbackName) return '';

  if (typeof owner === 'string') {
    const normalized = owner.trim();
    return normalized && normalized !== 'N/A' ? normalized : '';
  }

  const candidates = [owner?.name, owner?.nom, owner?.fullname, fallbackName];
  const valid = candidates
    .filter(Boolean)
    .map((value) => String(value).trim())
    .find((value) => value && value !== 'N/A');

  return valid || '';
};

const workerSelf: {
  onmessage: (event: { data: { households?: Household[] } }) => void;
  postMessage: (msg: unknown) => void;
} =
  typeof self !== 'undefined'
    ? self
    : (globalThis as unknown as {
        onmessage: (event: { data: { households?: Household[] } }) => void;
        postMessage: (msg: unknown) => void;
      });

workerSelf.onmessage = (event: {
  data: {
    households?: Household[];
  };
}) => {
  const { households } = event.data;
  if (!households || !Array.isArray(households)) return;

  try {
    const anomalies: AuditAnomaly[] = [];
    const coordMap: Map<string, string[]> = new Map();
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    households.forEach((h: Household) => {
      const coords = h.location?.coordinates;
      const hasCoords =
        Array.isArray(coords) && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);

      // 1. Coordinate Integrity
      if (hasCoords) {
        let [lng, lat] = coords;

        // Detection for SWAPPED coords (Lat/Lng)
        if (lng > 0 && lat < 0) {
          [lng, lat] = [lat, lng];
        }

        const key = `${lng.toFixed(6)}_${lat.toFixed(6)}`;
        if (coordMap.has(key)) {
          const existingIds = coordMap.get(key)!;
          existingIds.push(h.id);
          coordMap.set(key, existingIds);
        } else {
          coordMap.set(key, [h.id]);
        }

        // Out of Bounds check
        if (
          lng < SENEGAL_BBOX.minLng ||
          lng > SENEGAL_BBOX.maxLng ||
          lat < SENEGAL_BBOX.minLat ||
          lat > SENEGAL_BBOX.maxLat
        ) {
          anomalies.push({
            id: `out_of_bounds_${h.id}`,
            type: 'OUT_OF_BOUNDS',
            severity: 'CRITICAL',
            message: `Point en dehors du Sénégal (${lng.toFixed(2)}, ${lat.toFixed(2)})`,
            householdId: h.id,
            lng,
            lat,
          });
          criticalCount++;
        }
      }

      // 2. Metadata integrity
      const ownerName = normalizeOwnerName(h.owner, h.name);
      if (!ownerName) {
        anomalies.push({
          id: `missing_name_${h.id}`,
          type: 'MISSING_DATA',
          severity: 'WARNING',
          message: `Nom du propriétaire manquant`,
          householdId: h.id,
        });
        warningCount++;
      }

      if (!h.status || h.status === 'Inconnu') {
        anomalies.push({
          id: `missing_status_${h.id}`,
          type: 'MISSING_DATA',
          severity: 'WARNING',
          message: `Statut non défini`,
          householdId: h.id,
        });
        warningCount++;
      }

      if (!h.village) {
        anomalies.push({
          id: `missing_village_${h.id}`,
          type: 'MISSING_DATA',
          severity: 'INFO',
          message: `Village non renseigné`,
          householdId: h.id,
        });
        infoCount++;
      }
    });

    // 3. Post-process Duplicates
    coordMap.forEach((ids, key) => {
      if (ids.length > 1) {
        const [lng, lat] = key.split('_').map(Number);
        ids.forEach((id) => {
          anomalies.push({
            id: `dup_coords_${id}`,
            type: 'DUPLICATE_COORDS',
            severity: 'CRITICAL',
            message: `Coordonnées en doublon (${ids.length} ménages au même point)`,
            householdId: id,
            lng,
            lat,
          });
          criticalCount++;
        });
      }
    });

    // 4. Calculate Health Score
    const totalPoints = households.length;
    const totalIssues = criticalCount * 2 + warningCount;
    const healthScore = Math.max(0, Math.min(100, 100 - (totalIssues / (totalPoints || 1)) * 100));

    const result: AuditResult = {
      healthScore: Math.round(healthScore * 10) / 10,
      stats: {
        total: totalPoints,
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
      },
      anomalies: anomalies.slice(0, 100), // Limit return to 100 most important anomalies
    };

    self.postMessage({ type: 'AUDIT_RESULT', result });
  } catch (error: unknown) {
    const err = error as { message?: string };
    self.postMessage({ type: 'ERROR', message: err.message ?? 'Unknown error' });
  }
};
