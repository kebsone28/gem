/**
 * MapComponent.tsx
 * 
 * Version simplifiée (SANS LEAFLET) pour éliminer les conflits de rendu.
 * Ne contient que le composant MapLibreVectorMap.
 */

import React from 'react';
import type { Household } from '../../utils/types';
import { getHouseholdDerivedStatus } from '../../utils/statusUtils';
import MapLibreVectorMap from './MapLibreVectorMap';
import { MapStatsWidget } from './MapStatsWidget';
import './MapComponent.css';

interface MapComponentProps {
    households: Household[];
    onSelect: (household: Household) => void;
    mapCommand: { center: [number, number]; zoom: number; timestamp: number } | null;
    showHeatmap?: boolean;
    isFilteringActive?: boolean;
    activeHouseholdId?: string | null;
    selectedPhases?: string[];
    onToggleStatus?: (status: string) => void;
    showLegend?: boolean;
    showZones?: boolean;
    onZoneClick?: (center: [number, number], zoom: number) => void;
    grappesConfig?: any;
    className?: string;
    routingEnabled?: boolean;
    onRoutingClose?: () => void;
    routingStart?: [number, number] | null;
    routingDest?: [number, number] | null;
    onRouteFound?: (stats: { distance: number; duration: number; instructions?: any[] } | null) => void;
    userLocation?: [number, number] | null;
    readOnly?: boolean;
    isMeasuring?: boolean;
    isSelecting?: boolean;
    showDatabaseStats?: boolean;
    mapStyle?: 'streets' | 'satellite';
    grappeZonesData?: any;
    grappeCentroidsData?: any;
    activeGrappeId?: string | null;
    onHouseholdDrop?: (id: string, lat: number, lng: number) => void;
    favorites?: any[];
    projectId?: string;
    followUser?: boolean;
    onMove?: (center: [number, number], zoom: number) => void;
    visibleHouseholds?: Household[];
    onBoundsChange?: (bounds: [number, number, number, number]) => void;
    warehouses?: any[];
    onLassoSelection?: (ids: string[]) => void;
    isDrawing?: boolean;
    pendingPoints?: [number, number][];
    onAddPoint?: (point: [number, number]) => void;
    drawnZones?: any[];
}

const MapComponent: React.FC<MapComponentProps> = ({
    households,
    onSelect,
    mapCommand,
    showHeatmap = false,
    isFilteringActive = false,
    selectedPhases = [],
    onToggleStatus,
    showLegend = true,
    showZones = false,
    onZoneClick,
    grappesConfig,
    routingEnabled,
    routingStart,
    routingDest,
    onRouteFound,
    userLocation,
    readOnly = false,
    isMeasuring = false,
    isSelecting = false,
    showDatabaseStats = false,
    mapStyle = 'streets',
    grappeZonesData,
    grappeCentroidsData,
    activeGrappeId,
    onHouseholdDrop,
    favorites = [],
    projectId,
    followUser = false,
    onMove,
    visibleHouseholds = [],
    onBoundsChange,
    warehouses = [],
    onLassoSelection,
    isDrawing = false,
    pendingPoints = [],
    onAddPoint,
    drawnZones = []
}) => {
    return (
        <div className="h-full w-full relative bg-slate-100 dark:bg-slate-900 overflow-hidden">
            {/* Seul et unique layer de carte pour éviter les superpositions grises */}
            <MapLibreVectorMap
                households={households}
                mapCommand={mapCommand}
                onSelectHousehold={onSelect}
                showHeatmap={showHeatmap}
                isFilteringActive={isFilteringActive}
                showZones={showZones}
                onZoneClick={onZoneClick}
                grappesConfig={grappesConfig}
                className="w-full h-full"
                readOnly={readOnly}
                isMeasuring={isMeasuring}
                isSelecting={isSelecting}
                mapStyle={mapStyle}
                grappeZonesData={grappeZonesData}
                grappeCentroidsData={grappeCentroidsData}
                activeGrappeId={activeGrappeId}
                userLocation={userLocation}
                onHouseholdDrop={onHouseholdDrop}
                routingEnabled={routingEnabled}
                routingStart={routingStart}
                routingDest={routingDest}
                onRouteFound={onRouteFound}
                favorites={favorites}
                projectId={projectId}
                followUser={followUser}
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
                visible: visibleHouseholds.length,
                completed: visibleHouseholds.filter((h: Household) => getHouseholdDerivedStatus(h) === 'Contrôle conforme' || getHouseholdDerivedStatus(h) === 'Intérieur terminé').length,
                problems: visibleHouseholds.filter((h: Household) => getHouseholdDerivedStatus(h) === 'Non conforme').length,
                pending: visibleHouseholds.filter((h: Household) => getHouseholdDerivedStatus(h) === 'Non encore commencé').length
            }} />}

            {/* Légende améliorée avec icônes */}
            {showLegend && (
                <div className="absolute bottom-8 left-4 z-[100] px-5 py-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xl">
                    <h4 className="text-[9px] font-black uppercase tracking-widest mb-3 text-slate-500 dark:text-slate-400">Légende / Étapes</h4>
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
                                onClick={() => onToggleStatus?.(item.status)}
                                title={`Filtrer: ${item.label}`}
                                className={`flex items-center gap-2.5 cursor-pointer transition-all duration-200 hover:translate-x-1 select-none ${selectedPhases.includes(item.status) ? 'opacity-100' : 'opacity-30'}`}
                            >
                                <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md flex-shrink-0 ${item.tailwindClass}`}
                                >
                                    {item.icon}
                                </div>
                                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(MapComponent);
