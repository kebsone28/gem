/**
 * useGrappes — Source unique de vérité pour les grappes
 * Utilisé par Bordereau.tsx ET Logistique/GrappesTab.tsx
 * Stratégie : API fraîche → cache Dexie si offline
 */
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { db } from '../store/db';
import logger from '../utils/logger';

export interface GrappeData {
  id: string;
  name?: string;
  region?: string;
  sgId?: string;
  households?: any[];
  stats?: {
    total: number;
    done: number;
    inProgress: number;
    pending: number;
    deliveryRate: number;
  };
  [key: string]: unknown;
}

interface UseGrappesResult {
  grappes: GrappeData[];
  loading: boolean;
  error: string | null;
  lastSyncAt: Date | null;
  isOffline: boolean;
  refresh: () => void;
}

export function useGrappes(projectId: string | undefined): UseGrappesResult {
  const [grappes, setGrappes] = useState<GrappeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const loadGrappes = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      // Priorité 1 — API fraîche
      const response = await apiClient.get(`/projects/${projectId}/bordereau`);
      const data: GrappeData[] = response.data?.grappes ?? response.data ?? [];

      setGrappes(data);
      setLastSyncAt(new Date());
      setIsOffline(false);

      // Mise en cache Dexie pour usage offline
      if (data.length > 0) {
        try {
          await (db as any).grappes?.bulkPut?.(data);
        } catch {
          // Cache non critique — ignorer les erreurs Dexie schema
        }
      }
    } catch (apiErr) {
      logger.warn('[useGrappes] API indisponible, fallback cache local');
      setIsOffline(true);

      try {
        const local: GrappeData[] = await (db as any).grappes?.toArray?.() ?? [];
        if (local.length > 0) {
          setGrappes(local);
          setError('Données locales (mode hors-ligne)');
        } else {
          setError('Impossible de charger les grappes');
        }
      } catch (dexieErr) {
        logger.error('[useGrappes] Cache Dexie également indisponible', dexieErr);
        setError('Chargement impossible');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadGrappes();
  }, [loadGrappes]);

  return { grappes, loading, error, lastSyncAt, isOffline, refresh: loadGrappes };
}
