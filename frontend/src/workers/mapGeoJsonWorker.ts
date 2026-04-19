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
  media?: Record<string, string>;
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
  latitude?: number;
  longitude?: number;
  alerts?: AlertData[];
  constructionData?: ConstructionData;
  koboSync?: KoboSyncData;
  owner?: { name: string };
  name?: string;
}

// ── Constants (Synchronized with mapConfig.ts and statusRegistry.ts) ──
// IMPORTANT: icon names MUST match the keys registered by mapUtils.ts drawStatusIcon()
const STATUS_RENDER_CONFIG: Record<string, { color: string; icon: string }> = {
  'Contrôle conforme': { color: '#00FF9D', icon: 'check' },
  'Non conforme': { color: '#FF0055', icon: 'warning' },
  'Intérieur terminé': { color: '#6366F1', icon: 'interior' },
  'Réseau terminé': { color: '#00D2FF', icon: 'network' },
  'Murs terminés': { color: '#FFD60A', icon: 'walls' },
  'Livraison effectuée': { color: '#059669', icon: 'delivery' },
  'Non éligible': { color: '#64748B', icon: 'dot' },
  'Non encore installée': { color: '#6366F1', icon: 'dot' },
  'Désistement': { color: '#64748B', icon: 'warning' },
  'Refusé': { color: '#F43F5E', icon: 'warning' },
  'Eligible': { color: '#3B82F6', icon: 'dot' },
  'En attente': { color: '#64748B', icon: 'dot' },
  'default': { color: '#6366F1', icon: 'dot' },
};

// ── Helpers ──

// Canonical status keys — must match STATUS_CONFIG in mapConfig.ts exactly
const CANONICAL_STATUSES = new Set([
  'Contrôle conforme', 'Non conforme', 'Intérieur terminé', 'Réseau terminé',
  'Murs terminés', 'Livraison effectuée', 'Non éligible', 'Non encore installée',
  'Désistement', 'Refusé', 'Eligible', 'En attente',
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeStatus(status?: string): string {
  if (!status) return 'Non encore commencé';

  // Fast path: already a canonical key
  if (CANONICAL_STATUSES.has(status)) return status;

  const s = normalizeText(status);

  if (s.includes('non eligible') || s.includes('ineligi') || s.includes('ineligible')) return 'Non éligible';
  if (s.includes('desist')) return 'Désistement';
  if (s.includes('refus')) return 'Refusé';

  if (s.includes('non conforme')) return 'Non conforme';
  if (s.includes('conforme') || s.includes('termine') || s.includes('installe')) return 'Contrôle conforme';

  if (s.includes('eligible')) return 'Eligible';

  if (s.includes('interieur')) return 'Intérieur terminé';
  if (s.includes('reseau')) return 'Réseau terminé';
  if (s.includes('mur')) return 'Murs terminés';
  if (s.includes('livraison')) return 'Livraison effectuée';

  if (
    s.includes('non encore install') || 
    s.includes('pas encore install') ||
    s.includes('non install') ||
    s.includes('non debut') || 
    s.includes('non demarr') || 
    s.includes('non commenc') ||
    s.includes('pending') ||
    s.includes('a faire') ||
    s.includes('nouveau') ||
    s.includes('start') ||
    s.includes('non fait')
  )
    return 'Non encore installée';

  if (s.includes('attente') || s.includes('plan')) return 'En attente';

  return 'Non encore installée';
}

function getHouseholdDerivedStatus(h: Household): string {
  const normalized = normalizeStatus(h.status);
  if (['Non éligible', 'Désistement', 'Refusé'].includes(normalized)) return normalized;

  const alerts = Array.isArray(h.alerts) ? h.alerts : [];
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

  if (h.status && h.status !== 'Non encore installée' && h.status !== 'Pending' && h.status !== 'NON_DEMARRE') {
    const norm = normalizeStatus(h.status);
    if (norm !== 'Non encore installée') return norm;
  }
  return 'Non encore installée';
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
    console.log(`📡 [Worker] Processing ${households.length} households...`);

    const features = households
      .map((h: any) => {
        // ✅ SUPPORT MULTI-SOURCE COORDINATES (Nested GeoJSON OR Top-level Lat/Lon)
        // CRITICAL: use ?? instead of || to ensure 0 values are preserved
        let lng = Number(h.location?.coordinates?.[0] ?? h.longitude);
        let lat = Number(h.location?.coordinates?.[1] ?? h.latitude);

        // 🇸🇳 SMART AUTO-CORRECTION FOR SENEGAL (West Africa)
        // Correct issues BEFORE filtering to recover poorly formatted GPS data
        if (lng > 0 && lat < 0) {
          [lng, lat] = [lat, lng];
        }
        if (Math.abs(lng) > 11 && Math.abs(lng) < 18) {
          lng = -Math.abs(lng);
        }
        if (Math.abs(lat) > 11 && Math.abs(lat) < 17) {
          lat = Math.abs(lat);
        }

        // Apply spiral jitter for duplicates (using original coords for key)
        const key = `${lng.toFixed(5)}_${lat.toFixed(5)}`;
        const n = coordCount[key] ?? 0;
        coordCount[key] = n + 1;

        if (n > 0) {
          const angle = (n * 137.5 * Math.PI) / 180;
          const radius = JITTER_EPSILON * Math.sqrt(n);
          lng += radius * Math.cos(angle);
          lat += radius * Math.sin(angle);
        }

        const derivedStatus = getHouseholdDerivedStatus(h);
        const config = STATUS_RENDER_CONFIG[derivedStatus] || { color: '#94a3b8', icon: 'dot' };

        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: sanitizeValue({
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
            hasPhotos: h.constructionData?.media ? Object.values(h.constructionData.media).some(m => !!m && String(m).startsWith('http')) : false,
            name: h.owner?.name || h.name || 'N/A',
          }),
        };
      })
      .filter((f: any) => {
        // Validation AFTER correction: ignore points that are still invalid or exactly 0,0
        const [lng, lat] = f.geometry.coordinates;
        return Number.isFinite(lng) && Number.isFinite(lat) && (lng !== 0 || lat !== 0);
      });

    // ── Business Key Deduplication ── (Deduplicate by numeroordre, keep oldest)
    const seenNumeros = new Map<string, any>();
    features.forEach((feature: any) => {
      const identifier = feature.properties?.numeroordre || feature.properties?.id || feature.id;
      if (!identifier) return;
      if (!seenNumeros.has(identifier)) {
        seenNumeros.set(identifier, feature);
      }
    });

    const finalFeatures = Array.from(seenNumeros.values());

    console.log(`✅ [Worker] Output: ${finalFeatures.length} / ${households.length} features (Deduplicated)`);

    self.postMessage({
      type: 'GEOJSON_RESULT',
      data: {
        type: 'FeatureCollection',
        features: finalFeatures,
      },
    });
  } catch (error) {
    self.postMessage({ type: 'ERROR', message: error instanceof Error ? error.message : 'Unknown Error' });
  }
};
