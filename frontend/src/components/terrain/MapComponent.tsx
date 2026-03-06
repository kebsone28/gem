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
    userLocation?: [number, number] | null;
    readOnly?: boolean;
    isMeasuring?: boolean;
    showDatabaseStats?: boolean;
    mapStyle?: 'streets' | 'satellite';
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
    mapStyle = 'streets'
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
            />

            {showDatabaseStats && <MapStatsWidget stats={{
                visible: households.length,
                completed: households.filter(h => h.status === 'Terminé' || h.status === 'Réception: Validée').length,
                problems: households.filter(h => h.status === 'Problème').length,
                pending: households.filter(h => h.status === 'Non débuté').length
            }} />}

            {/* Légende en overlay DOM simple */}
            {showLegend && (
                <div className="absolute bottom-8 left-8 z-[100] p-6 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl">
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-70 text-slate-800 dark:text-white">Légende</h4>
                    <div className="flex flex-col gap-3">
                        {[
                            { label: 'Terminé', color: 'bg-emerald-500', status: 'Terminé' },
                            { label: 'Problème', color: 'bg-rose-500', status: 'Problème' },
                            { label: 'En cours', color: 'bg-indigo-500', status: 'En cours' },
                            { label: 'Non débuté', color: 'bg-slate-400', status: 'Non débuté' }
                        ].map((item) => (
                            <div
                                key={item.status}
                                onClick={() => onToggleStatus?.(item.status)}
                                className={`flex items-center gap-3 cursor-pointer transition-all hover:translate-x-1 ${selectedPhases.includes(item.status) ? 'opacity-100' : 'opacity-40 grayscale-[50%]'}`}
                            >
                                <div className={`w-3.5 h-3.5 rounded-full ${item.color} shadow-lg dark:shadow-none border border-black/10 dark:border-white/20`} />
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(MapComponent);
