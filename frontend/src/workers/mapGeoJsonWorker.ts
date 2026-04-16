/**
 * mapGeoJsonWorker.ts
 *
 * Web Worker for high-performance GeoJSON processing.
 * Handles 50,000+ households:
 * - Sanitization & Validation
 * - Status derivation
 * - Spiral Jitter for duplicate coordinates
 * - GeoJSON Feature construction
 */

// ── Types ──
interface ConstructionData {
  interiorStatus?: string;
  networkStatus?: string;
  wallType?: string;
  audit?: {
    installation_conforme?: string;
    branchement_conforme?: string;
  };
  kit?: {
    status?: string;
  };
}

interface KoboSyncData {
  controleOk?: boolean | null;
  interieurOk?: boolean | null;
  reseauOk?: boolean | null;
  maconOk?: boolean | null;
  livreurDate?: string | null;
}

interface AlertData {
  severity?: string;
  type?: string;
}

interface Household {
  id: string;
  status: string;
  assignedTeams?: string[];
  location?: {
    coordinates: [number, number];
  };
  alerts?: AlertData[];
  constructionData?: ConstructionData;
  koboSync?: KoboSyncData;
  owner?: { name: string };
  name?: string;
}

// ── Constants (Replicated from statusUtils and mapConfig for worker self-sufficiency) ──
const STATUS_RENDER_CONFIG: Record<string, { color: string; icon: string }> = {
  'Contrôle conforme': { color: '#10b981', icon: 'check' },
  'Non conforme': { color: '#f43f5e', icon: 'alert' },
  'Non éligible': { color: '#64748b', icon: 'dot' },
  Désistement: { color: '#64748b', icon: 'dot' },
  Eligible: { color: '#3b82f6', icon: 'dot' },
  Installé: { color: '#10b981', icon: 'check' },
  Refusé: { color: '#f43f5e', icon: 'alert' },
  'Intérieur terminé': { color: '#818cf8', icon: 'wrench' },
  'Réseau terminé': { color: '#3b82f6', icon: 'wrench' },
  'Murs terminés': { color: '#f59e0b', icon: 'wrench' },
  'Livraison effectuée': { color: '#06b6d4', icon: 'truck' },
  'Non encore commencé': { color: '#94a3b8', icon: 'pin' },
  'Non débuté': { color: '#94a3b8', icon: 'pin' },
};

// ── Helpers ──

function normalizeStatus(status?: string): string {
  if (!status) return 'Inconnu';
  const s = status.toLowerCase().trim();
  if (s.includes('non') || s.includes('inéligible') || s.includes('ineligi')) return 'Non éligible';
  if (s.includes('eligible')) return 'Eligible';
  if (s.includes('désist') || s.includes('desist')) return 'Désistement';
  if (s.includes('install')) return 'Installé';
  if (s.includes('attente')) return 'En attente';
  if (s.includes('refus')) return 'Refusé';
  return 'Inconnu';
}

function getHouseholdDerivedStatus(h: Household): string {
  const normalized = normalizeStatus(h.status);
  if (['Non éligible', 'Désistement', 'Refusé'].includes(normalized)) return normalized;

  const alerts = h.alerts || [];
  if (alerts.some((a) => a.severity === 'HIGH' || a.type === 'CRITICAL')) return 'Non conforme';

  const cData = h.constructionData;
  if (cData) {
    if (
      cData.audit?.installation_conforme === 'conforme' ||
      cData.audit?.branchement_conforme === 'conforme' ||
      h.status === 'TERMINE'
    )
      return 'Contrôle conforme';
    if (
      cData.audit?.installation_conforme === 'non_conforme' ||
      cData.audit?.branchement_conforme === 'non-conforme' ||
      h.status === 'BLOQUE'
    )
      return 'Non conforme';
    if (cData.interiorStatus === 'COMPLETE' || h.status === 'Intérieur terminé')
      return 'Intérieur terminé';
    if (cData.networkStatus === 'COMPLETE' || h.status === 'Réseau terminé')
      return 'Réseau terminé';
    if (
      cData.wallType === 'STANDARD' ||
      cData.wallType === 'CHIMNEY' ||
      h.status === 'Murs terminés'
    )
      return 'Murs terminés';
    if (cData.kit?.status === 'COMPLETE' || h.status === 'Livraison effectuée')
      return 'Livraison effectuée';
  }

  if (h.koboSync?.controleOk === true) return 'Contrôle conforme';
  if (h.koboSync?.controleOk === false) return 'Non conforme';
  if (h.koboSync?.interieurOk) return 'Intérieur terminé';
  if (h.koboSync?.reseauOk) return 'Réseau terminé';
  if (h.koboSync?.maconOk) return 'Murs terminés';
  if (h.koboSync?.livreurDate) return 'Livraison effectuée';

  if (h.status && h.status !== 'Non débuté' && h.status !== 'Pending' && h.status !== 'NON_DEMARRE')
    return h.status;
  return 'Non encore commencé';
}

const JITTER_EPSILON = 0.00008;

function sanitizeValue(val: unknown): unknown {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'object' && !Array.isArray(val)) {
    const sanitized: Record<string, unknown> = {};
    for (const k in val as Record<string, unknown>) {
      sanitized[k] = sanitizeValue((val as Record<string, unknown>)[k]);
    }
    return sanitized;
  }
  return val;
}

// ── Main Listener ──

self.onmessage = (event) => {
  const { households } = event.data;
  if (!households) return;

  try {
    const coordCount: Record<string, number> = {};

    const features = households
      .filter((h: Household) => {
        const coords = h.location?.coordinates;
        // Strict coordinate validation: MUST be valid numbers, NOT null, NOT NaN
        return (
          Array.isArray(coords) &&
          coords.length === 2 &&
          coords[0] !== null &&
          coords[1] !== null &&
          !isNaN(Number(coords[0])) &&
          !isNaN(Number(coords[1]))
        );
      })
      .map((h: Household) => {
        let [lng, lat] = h.location!.coordinates;

        // Auto-correction for Senegal
        if (lng > 0 && lat < 0) {
          [lng, lat] = [lat, lng];
        }

        const key = `${lng.toFixed(5)}_${lat.toFixed(5)}`;
        const n = coordCount[key] ?? 0;
        coordCount[key] = n + 1;

        // Apply spiral jitter for duplicates
        if (n > 0) {
          const angle = (n * 137.5 * Math.PI) / 180;
          const radius = JITTER_EPSILON * Math.sqrt(n);
          lng += radius * Math.cos(angle);
          lat += radius * Math.sin(angle);
        }

        const derivedStatus = getHouseholdDerivedStatus(h);
        const config = STATUS_RENDER_CONFIG[derivedStatus] || { color: '#94a3b8', icon: 'dot' };

        const rawProps = {
          id: h.id,
          household_id: h.id,
          status: derivedStatus,
          assignedTeams: Array.isArray(h.assignedTeams) ? h.assignedTeams : [],
          koboSync: {
            maconOk: h.koboSync?.maconOk ?? null,
            reseauOk: h.koboSync?.reseauOk ?? null,
            interieurOk: h.koboSync?.interieurOk ?? null,
            controleOk: h.koboSync?.controleOk ?? null,
            livreurDate: h.koboSync?.livreurDate ?? null,
          },
          color: config.color,
          iconId: `icon-${derivedStatus}`,
          longitude: lng,
          latitude: lat,
          name: h.owner?.name || h.name || 'N/A',
        };

        const sanitizedProps = sanitizeValue(rawProps);

        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: sanitizedProps,
        };
      });

    self.postMessage({
      type: 'GEOJSON_RESULT',
      data: {
        type: 'FeatureCollection',
        features,
      },
    });
  } catch (error) {
    self.postMessage({ type: 'ERROR', message: error instanceof Error ? error.message : 'Unknown Error' });
  }
};
