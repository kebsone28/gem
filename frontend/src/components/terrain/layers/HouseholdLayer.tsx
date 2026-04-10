import React from 'react';
import maplibregl from 'maplibre-gl';
import { useTerrainUIStore } from '../../../store/terrainUIStore';
import {
    useStyleLifecycle,
    useHouseholdSources,
    useHouseholdLayers,
    useHouseholdDataSync,
    useSelectedHouseholdSync,
    useHouseholdVisibility,
    useHeatmapVisibility,
    useHouseholdFilters,
} from '../hooks';

interface HouseholdLayerProps {
    map: maplibregl.Map | null;
    householdGeoJSON: any;
    households?: any[];
    projectId?: string;
    selectedHouseholdCoords?: [number, number] | null;
    showHeatmap?: boolean;
    styleIsReady: boolean;
}

/**
 * MODULARIZED HouseholdLayer (v2.0)
 * 
 * Uses separate hooks for each lifecycle phase:
 * - useStyleLifecycle: Monitor style changes
 * - useHouseholdSources: Create sources once
 * - useHouseholdLayers: Create layers after sources
 * - useHouseholdDataSync: Sync GeoJSON with lightweight hash
 * - useHouseholdVisibility: Zoom-based visibility
 * - useHeatmapVisibility: Heatmap prop control
 * - useHouseholdFilters: Phase/team filters
 * 
 * Architecture: Event-driven, zero polling, fully testable
 */
const HouseholdLayer: React.FC<HouseholdLayerProps> = ({
    map,
    householdGeoJSON,
    households = [],
    projectId,
    selectedHouseholdCoords = null,
    showHeatmap = false,
    styleIsReady,
}) => {
    const selectedPhases = useTerrainUIStore((s) => s.selectedPhases);
    const selectedTeam = useTerrainUIStore((s) => s.selectedTeam);

    // ══════════════════════════════════════════════════════════════
    // PHASE 1: STYLE LIFECYCLE
    // ══════════════════════════════════════════════════════════════
    useStyleLifecycle(map, () => {
        console.log('✅ [HouseholdLayer] Style ready for source setup');
    });

    // ══════════════════════════════════════════════════════════════
    // PHASE 2: CREATE SOURCES (one-time)
    // ══════════════════════════════════════════════════════════════
    const setupCompleteRef = useHouseholdSources(map, styleIsReady, projectId);

    // ══════════════════════════════════════════════════════════════
    // PHASE 3: CREATE LAYERS (after sources ready)
    // ══════════════════════════════════════════════════════════════
    useHouseholdLayers(map, styleIsReady, setupCompleteRef);

    // ══════════════════════════════════════════════════════════════
    // PHASE 4: DATA SYNC (lightweight, hash-based)
    // ══════════════════════════════════════════════════════════════
    useHouseholdDataSync(map, householdGeoJSON, households);
    useSelectedHouseholdSync(map, selectedHouseholdCoords);

    // ══════════════════════════════════════════════════════════════
    // PHASE 5: VISIBILITY & FILTERS (reactive)
    // ══════════════════════════════════════════════════════════════
    useHouseholdVisibility(map);
    useHeatmapVisibility(map, showHeatmap);
    useHouseholdFilters(map, selectedPhases, selectedTeam);

    return null;
};

export default React.memo(HouseholdLayer);
