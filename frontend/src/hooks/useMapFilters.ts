/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useMemo, useCallback, useEffect } from 'react';
import debounce from 'lodash.debounce';
import logger from '../utils/logger';
import { getHouseholdDerivedStatus } from '../utils/statusUtils';
import type { Household } from '../utils/types';
import { useTerrainUIStore } from '../store/terrainUIStore';

export type SearchResult =
  | {
      type: 'household';
      id: string;
      label: string;
      data: Household;
    }
  | {
      type: 'geo';
      id: string;
      label: string;
      lat: number;
      lon: number;
    };

export const ALL_STATUSES = [
  'Contrôle conforme',
  'Non conforme',
  'Intérieur terminé',
  'Réseau terminé',
  'Murs terminés',
  'Livraison effectuée',
  'Eligible',
  'Non encore installée',
  'Non débuté',
  'Non commencé',
  'En attente',
  'Refusé',
  'Non éligible',
  'Désistement',
];


export const hasValidCoordinates = (h: Household): boolean => {
  // Support either Nested GeoJSON coordinates OR Top-level latitude/longitude
  // Use ?? instead of || to ensure 0 values are preserved
  const lng = Number(h.location?.coordinates?.[0] ?? h.longitude);
  const lat = Number(h.location?.coordinates?.[1] ?? h.latitude);

  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    (lng !== 0 || lat !== 0) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
  );
};

export const useMapFilters = (
  households: Household[] = [],
  mapBounds: [number, number, number, number] | null
) => {
  const selectedPhases = useTerrainUIStore((s) => s.selectedPhases);
  const selectedTeam = useTerrainUIStore((s) => s.selectedTeam);
  const togglePhase = useTerrainUIStore((s) => s.togglePhase);
  const setSelectedTeam = useTerrainUIStore((s) => s.setSelectedTeam);

  const searchQuery = useTerrainUIStore((s) => s.searchQuery);
  const searchResults = useTerrainUIStore((s) => s.searchResults);
  const isSearching = useTerrainUIStore((s) => s.isSearching);
  const setSearchQuery = useTerrainUIStore((s) => s.setSearchQuery);
  const setSearchResults = useTerrainUIStore((s) => s.setSearchResults);
  const setIsSearching = useTerrainUIStore((s) => s.setIsSearching);

  // ✅ Background Indexing initialization & updates
  const searchWorker = useMemo(
    () => new Worker(new URL('../workers/searchWorker.ts', import.meta.url), { type: 'module' }),
    []
  );

  useMemo(() => {
    if (households && households.length > 0) {
      searchWorker.postMessage({ type: 'INDEX', payload: { households } });
    }
  }, [households, searchWorker]);

  // Cleanup worker
  useMemo(
    () => () => {
      searchWorker.postMessage({ type: 'TERMINATE' });
    },
    [searchWorker]
  );

  const selectedTeamFilters = useMemo(
    () => ['livraison', 'maconnerie', 'reseau', 'installation', 'controle'],
    []
  );

  const handleTogglePhase = useCallback(
    (phase: string) => {
      togglePhase(phase);
    },
    [togglePhase]
  );

  const filteredHouseholds = useMemo(() => {
    return (households || []).filter((h) => {
      const passes = (() => {
        if (!hasValidCoordinates(h)) return false;

        const hStatus = getHouseholdDerivedStatus(h);
        if (!selectedPhases.includes(hStatus)) return false;

        const fulfillsTeamCriteria =
          (!!h.koboSync?.livreurDate && selectedTeamFilters.includes('livraison')) ||
          (!!h.koboSync?.maconOk && selectedTeamFilters.includes('maconnerie')) ||
          (!!h.koboSync?.reseauOk && selectedTeamFilters.includes('reseau')) ||
          (!!h.koboSync?.interieurOk && selectedTeamFilters.includes('installation')) ||
          (!!h.koboSync?.controleOk && selectedTeamFilters.includes('controle'));

        const hasAnyKoboProgress =
          !!h.koboSync?.livreurDate ||
          !!h.koboSync?.maconOk ||
          !!h.koboSync?.reseauOk ||
          !!h.koboSync?.interieurOk ||
          !!h.koboSync?.controleOk;
        if (hasAnyKoboProgress && !fulfillsTeamCriteria) {
          return false;
        }

        if (selectedTeam !== 'all') {
          const assignedTeams = Array.isArray(h.assignedTeams) ? h.assignedTeams : [];
          if (!assignedTeams.includes(selectedTeam)) return false;
        }

        return true;
      })();

      return passes;
    });
  }, [households, selectedPhases, selectedTeamFilters, selectedTeam]);

  const visibleHouseholds = useMemo(() => {
    if (!mapBounds) return filteredHouseholds;
    const [west, south, east, north] = mapBounds;
    return filteredHouseholds.filter((h) => {
      // Use ?? instead of || to ensure 0 values are preserved
      let lng = Number(h.location?.coordinates?.[0] ?? h.longitude);
      let lat = Number(h.location?.coordinates?.[1] ?? h.latitude);

      // 🇸🇳 SMART AUTO-CORRECTION FOR SENEGAL (West Africa)
      if (lng > 0 && lat < 0) {
        [lng, lat] = [lat, lng];
      }
      if (Math.abs(lng) > 11 && Math.abs(lng) < 18) {
        lng = -Math.abs(lng);
      }
      if (Math.abs(lat) > 11 && Math.abs(lat) < 17) {
        lat = Math.abs(lat);
      }

      return lng >= west && lng <= east && lat >= south && lat <= north;
    });
  }, [filteredHouseholds, mapBounds]);

  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      // 1. Worker Search (Fuzzy & Multi-field)
      searchWorker.onmessage = async (e) => {
        if (e.data.type === 'SEARCH_RESULTS' && e.data.query === query) {
          const householdResults = e.data.results;

          // 2. Nominatim Search (Geographical) - Continue to merge with household results
          const geoResults: SearchResult[] = [];
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(query)}`
            );
            const geoData = await resp.json();
            geoData.forEach(
              (r: { place_id: string; display_name: string; lat: string; lon: string }) => {
                geoResults.push({
                  type: 'geo',
                  id: r.place_id,
                  label: r.display_name,
                  lat: parseFloat(r.lat),
                  lon: parseFloat(r.lon),
                });
              }
            );
          } catch (e) {
            logger.error('Nominatim error:', e);
          }

          setSearchResults([...householdResults, ...geoResults]);
          setIsSearching(false);
        }
      };

      searchWorker.postMessage({ type: 'SEARCH', payload: { query } });
    },
    [households, searchWorker, setSearchResults, setIsSearching]
  );

  const debouncedSearch = useMemo(() => debounce(performSearch, 300), [performSearch]);

  // ✅ Cleanup debounce on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return {
    selectedPhases,
    handleTogglePhase,
    selectedTeam,
    setSelectedTeam,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    debouncedSearch,
    filteredHouseholds,
    visibleHouseholds,
  };
};
