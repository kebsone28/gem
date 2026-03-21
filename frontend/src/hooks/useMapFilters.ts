import { useState, useMemo, useCallback } from 'react';
import debounce from 'lodash.debounce';
import logger from '../utils/logger';
import { getHouseholdDerivedStatus } from '../utils/statusUtils';
import type { Household } from '../utils/types';

export const ALL_STATUSES = [
    'Contrôle conforme',
    'Non conforme',
    'Intérieur terminé',
    'Réseau terminé',
    'Murs terminés',
    'Livraison effectuée',
    'Non encore commencé',
    'En attente',
    'Non débuté'
];

export type SearchResult = {
    type: 'household';
    id: string;
    label: string;
    data: Household;
} | {
    type: 'geo';
    id: string;
    label: string;
    lat: number;
    lon: number;
};

export const hasValidCoordinates = (h: Household): boolean => {
    return !!(h.location?.coordinates && 
              Array.isArray(h.location.coordinates) &&
              h.location.coordinates.length === 2 &&
              typeof h.location.coordinates[0] === 'number' &&
              typeof h.location.coordinates[1] === 'number' &&
              !isNaN(h.location.coordinates[0]) &&
              !isNaN(h.location.coordinates[1]) &&
              Math.abs(h.location.coordinates[0]) <= 180 &&
              Math.abs(h.location.coordinates[1]) <= 90);
};

export const useMapFilters = (households: Household[] = [], mapBounds: [number, number, number, number] | null) => {
    const [selectedPhases, setSelectedPhases] = useState<string[]>(ALL_STATUSES);
    const [selectedTeamFilters] = useState<string[]>(['livraison', 'maconnerie', 'reseau', 'installation', 'controle']);
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleTogglePhase = useCallback((phase: string) => {
        if (phase === 'all') {
            setSelectedPhases(prev => prev.length === ALL_STATUSES.length ? [] : ALL_STATUSES);
            return;
        }
        setSelectedPhases(prev =>
            prev.includes(phase)
                ? prev.filter(p => p !== phase)
                : [...prev, phase]
        );
    }, []);

    const filteredHouseholds = useMemo(() => {
        return households.filter(h => {
            if (!hasValidCoordinates(h)) return false;

            const hStatus = getHouseholdDerivedStatus(h);
            if (!selectedPhases.includes(hStatus)) return false;

            const fulfillsTeamCriteria =
                (!!h.koboSync?.livreurDate && selectedTeamFilters.includes('livraison')) ||
                (!!h.koboSync?.maconOk && selectedTeamFilters.includes('maconnerie')) ||
                (!!h.koboSync?.reseauOk && selectedTeamFilters.includes('reseau')) ||
                (!!h.koboSync?.interieurOk && selectedTeamFilters.includes('installation')) ||
                (!!h.koboSync?.controleOk && selectedTeamFilters.includes('controle'));

            const hasAnyKoboProgress = !!h.koboSync?.livreurDate || !!h.koboSync?.maconOk || !!h.koboSync?.reseauOk || !!h.koboSync?.interieurOk || !!h.koboSync?.controleOk;
            if (hasAnyKoboProgress && !fulfillsTeamCriteria) {
                return false;
            }

            if (selectedTeam !== 'all') {
                const assignedTeams = Array.isArray(h.assignedTeams) ? h.assignedTeams : [];
                if (!assignedTeams.includes(selectedTeam)) return false;
            }

            return true;
        });
    }, [households, selectedPhases, selectedTeamFilters, selectedTeam]);

    const visibleHouseholds = useMemo(() => {
        if (!mapBounds) return filteredHouseholds;
        const [west, south, east, north] = mapBounds;
        
        return filteredHouseholds.filter(h => {
             const lng = h.location!.coordinates[0] as number;
             const lat = h.location!.coordinates[1] as number;
             return (lng >= west && lng <= east && lat >= south && lat <= north);
        });
    }, [filteredHouseholds, mapBounds]);

    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        const results: SearchResult[] = [];
        const qLower = query.toLowerCase();
        
        households.forEach((h: Household) => {
            const ownerObj = h.owner;
            const ownerStr = String(typeof ownerObj === 'object' && ownerObj !== null ? ((ownerObj as any).nom || '') : (ownerObj || ''));
            if (h.id.toLowerCase().includes(qLower) || ownerStr.toLowerCase().includes(qLower)) {
                results.push({
                    type: 'household',
                    id: h.id,
                    label: h.id + (ownerStr ? ` — ${ownerStr}` : ''),
                    data: h
                });
            }
        });

        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`);
            const geoData = await resp.json();
            geoData.forEach((r: { place_id: string; display_name: string; lat: string; lon: string; }) => {
                results.push({
                    type: 'geo',
                    id: r.place_id,
                    label: r.display_name,
                    lat: parseFloat(r.lat),
                    lon: parseFloat(r.lon)
                });
            });
        } catch (e) {
            logger.error('Search error:', e);
        }

        setSearchResults(results);
        setIsSearching(false);
    }, [households]);

    const debouncedSearch = useMemo(() => debounce(performSearch, 300), [performSearch]);

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
        visibleHouseholds
    };
};
