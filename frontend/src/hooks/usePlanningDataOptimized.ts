import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import apiClient from '../api/client';
import { db } from '../store/db';
import logger from '../utils/logger';
import type { Team } from '../utils/types';
import type { PlanningHousehold } from '../services/planningDomain';

interface HouseholdsResponse {
  households?: PlanningHousehold[];
}

interface TeamsResponse {
  teams?: Team[];
}

type PlanningDataSource = 'server' | 'local' | 'cached' | 'none';

interface UsePlanningDataResult {
  households: PlanningHousehold[];
  teams: Team[];
  isLoading: boolean;
  isRefreshing: boolean;
  dataSource: PlanningDataSource;
  refresh: () => Promise<void>;
  lastUpdate: Date | null;
}

// Cache pour éviter les requêtes répétées
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const dataCache = new Map<string, { data: any; timestamp: number }>();

// Optimisation : Memoization des données filtrées
const createFilteredDataCache = () => {
  const cache = new Map<string, any>();
  
  return {
    get: (key: string, filterFn: () => any) => {
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = filterFn();
      cache.set(key, result);
      return result;
    },
    clear: () => cache.clear(),
    size: () => cache.size
  };
};

const filteredDataCache = createFilteredDataCache();

export function usePlanningDataOptimized(projectId: string | null): UsePlanningDataResult {
  const [households, setHouseholds] = useState<PlanningHousehold[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<PlanningDataSource>('none');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Optimisation : Utilisation de useMemo pour les données dérivées
  const activeHouseholds = useMemo(() => 
    households.filter(household => household.status !== 'DELETED'),
    [households]
  );

  const activeTeams = useMemo(() => 
    teams.filter(team => !team.deletedAt),
    [teams]
  );

  // Optimisation : Cache des requêtes API
  const getCachedData = useCallback((key: string) => {
    const cached = dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }, []);

  const setCachedData = useCallback((key: string, data: any) => {
    dataCache.set(key, { data, timestamp: Date.now() });
  }, []);

  // Optimisation : Annulation des requêtes précédentes
  const cancelPreviousRequests = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
  }, []);

  const loadProjectData = useCallback(
    async (refreshMode = false) => {
      if (!projectId) {
        setHouseholds([]);
        setTeams([]);
        setDataSource('none');
        setIsLoading(false);
        setIsRefreshing(false);
        setLastUpdate(null);
        return;
      }

      // Optimisation : Vérification du cache
      const cacheKey = `planning-${projectId}`;
      if (!refreshMode) {
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          setHouseholds(cachedData.households);
          setTeams(cachedData.teams);
          setDataSource('cached');
          setIsLoading(false);
          return;
        }
      }

      if (refreshMode) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      cancelPreviousRequests();

      try {
        const [householdsRes, teamsRes] = await Promise.all([
          apiClient.get('/households', { 
            params: { projectId, limit: 10000 },
            signal: abortControllerRef.current?.signal
          }),
          apiClient.get('/teams', { 
            params: { projectId },
            signal: abortControllerRef.current?.signal
          }),
        ]);

        const householdsData = ((householdsRes.data as HouseholdsResponse).households || []) as PlanningHousehold[];
        const teamsData = ((teamsRes.data as TeamsResponse).teams || []).filter((team: Team) => !team.deletedAt);

        setHouseholds(householdsData);
        setTeams(teamsData);
        setDataSource('server');
        setLastUpdate(new Date());
        
        // Mise en cache
        setCachedData(cacheKey, { households: householdsData, teams: teamsData });
        
        // Nettoyage du cache de données filtrées
        filteredDataCache.clear();
        
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.info('[PlanningDataOptimized] Request cancelled');
          return;
        }
        
        logger.warn('[PlanningDataOptimized] Server fetch unavailable, falling back to local data', error);

        try {
          const [localHouseholds, localTeams] = await Promise.all([
            db.households
              .where('projectId')
              .equals(projectId)
              .and((household) => household.status !== 'DELETED')
              .limit(5000) // Optimisation : Limiter les résultats
              .toArray(),
            db.teams
              .where('projectId')
              .equals(projectId)
              .and((team) => !team.deletedAt)
              .limit(1000) // Optimisation : Limiter les résultats
              .toArray(),
          ]);

          setHouseholds(localHouseholds as PlanningHousehold[]);
          setTeams(localTeams);
          setDataSource(localHouseholds.length > 0 || localTeams.length > 0 ? 'local' : 'none');
          setLastUpdate(new Date());
          
          // Mise en cache des données locales
          setCachedData(`${cacheKey}-local`, { households: localHouseholds, teams: localTeams });
          
        } catch (localError) {
          logger.error('[PlanningDataOptimized] Local data fetch failed', localError);
          setDataSource('none');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [projectId, getCachedData, setCachedData, cancelPreviousRequests]
  );

  useEffect(() => {
    void loadProjectData(false);
    
    // Nettoyage à la destruction
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadProjectData]);

  const refresh = useCallback(async () => {
    // Invalidation du cache
    dataCache.delete(`planning-${projectId}`);
    dataCache.delete(`planning-${projectId}-local`);
    filteredDataCache.clear();
    
    await loadProjectData(true);
  }, [projectId, loadProjectData]);

  // Optimisation : Nettoyage périodique du cache
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of dataCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
          dataCache.delete(key);
        }
      }
    }, CACHE_DURATION);

    return () => clearInterval(cleanup);
  }, []);

  return {
    households: activeHouseholds,
    teams: activeTeams,
    isLoading,
    isRefreshing,
    dataSource,
    refresh,
    lastUpdate,
  };
}

// Export des utilitaires pour les autres hooks
export { filteredDataCache };
