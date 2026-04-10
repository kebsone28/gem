/**
 * MapComponent.tsx
 * 
 * Version simplifiée (SANS LEAFLET) pour éliminer les conflits de rendu.
 * Ne contient que le composant MapLibreVectorMap.
 */

import React, { useState } from 'react';
import type { Household } from '../../utils/types';
import { getHouseholdDerivedStatus } from '../../utils/statusUtils';
import MapLibreVectorMap from './MapLibreVectorMap';
import { MapStatsWidget } from './MapStatsWidget';
import './MapComponent.css';
import { useTerrainUIStore } from '../../store/terrainUIStore';

interface MapComponentProps {
    households: Household[];
    isFilteringActive?: boolean;
    showLegend?: boolean;
    onZoneClick?: (center: [number, number], zoom: number) => void;
    grappesConfig?: any;
    className?: string;
    onRouteFound?: (stats: { distance: number; duration: number; instructions?: any[] } | null) => void;
    userLocation?: [number, number] | null;
    readOnly?: boolean;
    grappeZonesData?: any;
    grappeCentroidsData?: any;
    onHouseholdDrop?: (id: string, lat: number, lng: number) => void;
    favorites?: any[];
    projectId?: string;
    onMove?: (center: [number, number], zoom: number) => void;
    onBoundsChange?: (bounds: [number, number, number, number]) => void;
    warehouses?: any[];
    onLassoSelection?: (ids: string[]) => void;
    onAddPoint?: (point: [number, number]) => void;
    selectedHouseholdId?: string | null;
    drawnZones?: any[];
}

const MapComponent: React.FC<MapComponentProps> = ({
    households,
    selectedHouseholdId = null,
    isFilteringActive = false,
    showLegend = true,
    onZoneClick,
    grappesConfig,
    onRouteFound,
    userLocation,
    readOnly = false,
    grappeZonesData,
    grappeCentroidsData,
    onHouseholdDrop,
    favorites = [],
    projectId,
    onMove,
    onBoundsChange,
    warehouses = [],
    onLassoSelection,
    onAddPoint,
    drawnZones = []
}) => {

    // Zustand Selectors
    const mapCommand = useTerrainUIStore(s => s.mapCommand);
    const selectedPhases = useTerrainUIStore(s => s.selectedPhases);
    const togglePhase = useTerrainUIStore(s => s.togglePhase);
    
    const showDatabaseStats = useTerrainUIStore(s => s.showDatabaseStats);
    const routingStart = useTerrainUIStore(s => s.routingStart);
    const routingDest = useTerrainUIStore(s => s.routingDest);
    const isDrawing = useTerrainUIStore(s => s.isDrawing);
    const pendingPoints = useTerrainUIStore(s => s.pendingPoints);
    const activeGrappeId = useTerrainUIStore(s => s.activeGrappeId);
    const mapMode = useTerrainUIStore(s => s.mapMode);

    const safeHouseholds = React.useMemo(() => {
        // ✅ Use all households for complete map display (no viewport or filter restriction)
        const sourceHouseholds = households || [];
        
        return sourceHouseholds.filter(h => {
            const coords = h.location?.coordinates;
            return (
                Array.isArray(coords) &&
                coords.length === 2 &&
                typeof coords[0] === 'number' &&
                typeof coords[1] === 'number' &&
                !isNaN(coords[0]) &&
                !isNaN(coords[1])
            );
        });
    }, [households]);

    const [mapError] = React.useState<string | null>(null);
    const showNoDataOverlay = safeHouseholds.length === 0;

    if (mapError) {
        return (
            <div className="flex w-full h-full items-center justify-center bg-red-50 text-red-600 p-6 flex-col gap-4">
                <span className="text-4xl">⚠️</span>
                <span className="text-xl font-bold">Le rendu cartographique a échoué</span>
                <span className="text-sm bg-white p-2 rounded shadow">{mapError}</span>
            </div>
        );
    }

    return (
        <div className="h-full w-full relative bg-slate-100 dark:bg-slate-900 overflow-hidden">
            {showNoDataOverlay && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40 text-white p-6 text-center pointer-events-none">
                    <div className="max-w-md">
                        <div className="text-5xl mb-3">🗺️</div>
                        <div className="text-lg font-bold">Aucune donnée géographique valide à afficher dans cette vue</div>
                        <p className="mt-2 text-sm text-slate-200">La carte s’affiche, mais il n’existe aucun ménage avec des coordonnées GPS valides dans le périmètre actuel.</p>
                    </div>
                </div>
            )}
            {/* Seul et unique layer de carte pour éviter les superpositions grises */}
            <MapLibreVectorMap
                households={safeHouseholds}
                selectedHouseholdId={selectedHouseholdId}
                mapCommand={mapCommand}
                isFilteringActive={isFilteringActive}
                onZoneClick={onZoneClick}
                grappesConfig={grappesConfig}
                className="w-full h-full"
                readOnly={readOnly}
                grappeZonesData={grappeZonesData}
                grappeCentroidsData={grappeCentroidsData}
                activeGrappeId={activeGrappeId}
                userLocation={userLocation}
                onHouseholdDrop={onHouseholdDrop}
                routingStart={routingStart}
                routingDest={routingDest}
                onRouteFound={onRouteFound}
                favorites={favorites}
                projectId={projectId}
                onMove={onMove}
                onBoundsChange={onBoundsChange}
                warehouses={warehouses}
                onLassoSelection={onLassoSelection}
                isDrawing={isDrawing}
                pendingPoints={pendingPoints}
                onAddPoint={onAddPoint}
                drawnZones={drawnZones}
            />

            {showDatabaseStats && <MapStatsWidget stats={{
                visible: safeHouseholds.length,
                completed: safeHouseholds.filter((h: Household) => getHouseholdDerivedStatus(h) === 'Contrôle conforme' || getHouseholdDerivedStatus(h) === 'Intérieur terminé').length,
                problems: safeHouseholds.filter((h: Household) => getHouseholdDerivedStatus(h) === 'Non conforme').length,
                pending: safeHouseholds.filter((h: Household) => getHouseholdDerivedStatus(h) === 'Non encore commencé').length
            }} />}

            {/* Viewport Loading Indicator - REMOVED: misleading when only showing visible households */}

            {/* Légende améliorée avec icônes */}
            {showLegend && (
                <div className="absolute bottom-8 left-4 z-[100] px-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl">
                    <h4 className="text-xs font-black uppercase tracking-widest mb-3 text-slate-500 dark:text-slate-400">Légende / Étapes</h4>
                    <div className="flex flex-col gap-2">
                        {[
                            { label: 'Contrôle conforme', tailwindClass: 'bg-[#10b981]', icon: '✓', status: 'Contrôle conforme' },
                            { label: 'Non conforme', tailwindClass: 'bg-[#f43f5e]', icon: '!', status: 'Non conforme' },
                            { label: 'Intérieur terminé', tailwindClass: 'bg-[#818cf8]', icon: '🔧', status: 'Intérieur terminé' },
                            { label: 'Réseau terminé', tailwindClass: 'bg-[#3b82f6]', icon: '🔧', status: 'Réseau terminé' },
                            { label: 'Murs terminés', tailwindClass: 'bg-[#f59e0b]', icon: '🔧', status: 'Murs terminés' },
                            { label: 'Livraison effectuée', tailwindClass: 'bg-[#06b6d4]', icon: '🚚', status: 'Livraison effectuée' },
                            { label: 'Non débuté', tailwindClass: 'bg-[#94a3b8]', icon: '·', status: 'Non encore commencé' }
                        ].map((item) => (
                            <div
                                key={item.status}
                                onClick={() => togglePhase(item.status)}
                                title={`Filtrer: ${item.label}`}
                                className={`flex items-center gap-2.5 cursor-pointer transition-all duration-200 hover:translate-x-1 select-none ${selectedPhases.includes(item.status) ? 'opacity-100' : 'opacity-30'}`}
                            >
                                <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md flex-shrink-0 ${item.tailwindClass}`}
                                >
                                    {item.icon}
                                </div>
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(MapComponent);
