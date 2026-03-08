/**
 * MapComponent.tsx
 * 
 * Version simplifiée (SANS LEAFLET) pour éliminer les conflits de rendu.
 * Ne contient que le composant MapLibreVectorMap.
 */

import React from 'react';
import type { Household } from '../../utils/types';
import MapLibreVectorMap from './MapLibreVectorMap';
import { MapStatsWidget } from './MapStatsWidget';
import './MapComponent.css';

interface MapComponentProps {
    households: Household[];
    onSelect: (household: Household) => void;
    center: [number, number];
    zoom: number;
    showHeatmap?: boolean;
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
    onRouteFound?: (stats: { distance: number; duration: number } | null) => void;
    userLocation?: [number, number] | null;
    readOnly?: boolean;
    isMeasuring?: boolean;
    showDatabaseStats?: boolean;
    mapStyle?: 'streets' | 'satellite';
    grappeZonesData?: any;
    grappeCentroidsData?: any;
    activeGrappeId?: string | null;
    onHouseholdDrop?: (id: string, lat: number, lng: number) => void;
    onMove?: (center: [number, number], zoom: number) => void;
    favorites?: any[];
}

const MapComponent: React.FC<MapComponentProps> = ({
    households,
    onSelect,
    center,
    zoom,
    showHeatmap = false,
    selectedPhases = [],
    onToggleStatus,
    showLegend = true,
    showZones = false,
    onZoneClick,
    grappesConfig,
    readOnly = false,
    isMeasuring = false,
    showDatabaseStats = false,
    mapStyle = 'streets',
    grappeZonesData,
    grappeCentroidsData,
    activeGrappeId,
    userLocation,
    onHouseholdDrop,
    onMove,
    routingEnabled,
    routingStart,
    routingDest,
    onRouteFound,
    favorites = []
}) => {
    return (
        <div className="h-full w-full relative bg-slate-100 dark:bg-slate-900 overflow-hidden">
            {/* Seul et unique layer de carte pour éviter les superpositions grises */}
            <MapLibreVectorMap
                households={households}
                center={center}
                zoom={zoom}
                onSelectHousehold={onSelect}
                showHeatmap={showHeatmap}
                showZones={showZones}
                onZoneClick={onZoneClick}
                grappesConfig={grappesConfig}
                className="w-full h-full"
                readOnly={readOnly}
                isMeasuring={isMeasuring}
                mapStyle={mapStyle}
                grappeZonesData={grappeZonesData}
                grappeCentroidsData={grappeCentroidsData}
                activeGrappeId={activeGrappeId}
                userLocation={userLocation}
                onHouseholdDrop={onHouseholdDrop}
                onMove={onMove}
                routingEnabled={routingEnabled}
                routingStart={routingStart}
                routingDest={routingDest}
                onRouteFound={onRouteFound}
                favorites={favorites}
            />

            {showDatabaseStats && <MapStatsWidget stats={{
                visible: households.length,
                completed: households.filter(h => h.status === 'Terminé' || h.status === 'Réception: Validée').length,
                problems: households.filter(h => h.status === 'Problème').length,
                pending: households.filter(h => h.status === 'Non débuté').length
            }} />}

            {/* Légende améliorée avec icônes */}
            {showLegend && (
                <div className="absolute bottom-8 left-4 z-[100] px-5 py-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xl">
                    <h4 className="text-[9px] font-black uppercase tracking-widest mb-3 text-slate-500 dark:text-slate-400">Légende</h4>
                    <div className="flex flex-col gap-2">
                        {[
                            { label: 'Terminé', tailwindClass: 'bg-[#10b981]', icon: '✓', status: 'Terminé' },
                            { label: 'Problème', tailwindClass: 'bg-[#f43f5e]', icon: '!', status: 'Problème' },
                            { label: 'En cours', tailwindClass: 'bg-[#06b6d4]', icon: '⚙', status: 'En cours' },
                            { label: 'Non débuté', tailwindClass: 'bg-[#6366f1]', icon: '·', status: 'Non débuté' }
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
