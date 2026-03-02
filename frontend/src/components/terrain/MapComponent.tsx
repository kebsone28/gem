import { useEffect } from 'react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Tooltip,
    Circle,
    useMap,
    LayersControl,
    ZoomControl
} from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { useLogistique } from '../../hooks/useLogistique';
import { GRAPPES_CONFIG } from '../../utils/config';

import type { Household } from '../../utils/types';
import { useTheme } from '../../context/ThemeContext';
import { MapRouting } from './MapRouting';

// Fix for default marker icons in Leaflet
/* @ts-ignore */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const REGION_COLORS: Record<string, string> = {
    'Dakar': '#3b82f6',
    'Kaffrine': '#f59e0b',
    'Tambacounda': '#10b981',
    'Kédougou': '#8b5cf6',
    'Fatick': '#ec4899',
    'Kaolack': '#06b6d4',
    'Thiès': '#84cc16',
    'Diourbel': '#a855f7',
    'Louga': '#f43f5e',
    'Saint-Louis': '#14b8a6',
    'Ziguinchor': '#eab308'
};

const getRegionColor = (region?: string) => {
    if (!region) return '#64748b';
    const match = Object.entries(REGION_COLORS).find(([k]) => region.toLowerCase().includes(k.toLowerCase()));
    return match ? match[1] : '#64748b';
};

// Helper for status icons (Google Map style)
const getMarkerIcon = (regionStr?: string, statusStr?: string) => {
    const regionColor = getRegionColor(regionStr);

    // Status inner dot color
    const statusColor = statusStr === 'Terminé' ? '#22c55e' :
        statusStr === 'Problème' ? '#ef4444' :
            statusStr === 'Intérieur' ? '#6366f1' :
                statusStr === 'Réseau' ? '#3b82f6' :
                    statusStr === 'Murs' ? '#f59e0b' : '#ffffff';

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.4));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${regionColor}" stroke="white" stroke-width="1.5"/>
            <circle cx="12" cy="9" r="4" fill="${statusColor}" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
        </svg>
    `;

    return L.divIcon({
        className: 'custom-google-pin bg-transparent border-0',
        html: svg,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });
};

const createClusterCustomIcon = function (cluster: any) {
    const count = cluster.getChildCount();
    let size = 40;
    // Color shifts from indigo (large cluster = grappe) to teal (small = sous-grappe)
    const isGrande = count > 50;
    const isMoyenne = count > 10;
    const bg = isGrande ? 'rgba(67,56,202,0.92)' : isMoyenne ? 'rgba(6,182,212,0.90)' : 'rgba(245,158,11,0.90)';
    const shadow = isGrande ? 'rgba(67,56,202,0.4)' : isMoyenne ? 'rgba(6,182,212,0.4)' : 'rgba(245,158,11,0.4)';
    const border = isGrande ? '3px solid rgba(255,255,255,0.9)' : '2px dashed rgba(255,255,255,0.7)';
    if (count > 100) size = 60;
    else if (count > 50) size = 52;
    else if (count > 10) size = 44;

    return L.divIcon({
        html: `<div style="width:${size}px; height:${size}px; background:${bg}; backdrop-filter:blur(4px); color:white; border-radius:50%; border:${border}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:${Math.round(size / 3)}px; box-shadow:0 4px 14px ${shadow}, 0 0 0 4px ${shadow}; letter-spacing:-0.5px;">${count}</div>`,
        className: 'custom-cluster-icon bg-transparent border-0',
        iconSize: L.point(size, size, true),
    });
};

const ChangeView = ({ center, zoom }: { center: [number, number], zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
};

const HeatmapLayer = ({ households }: { households: Household[] }) => {
    const map = useMap();

    useEffect(() => {
        if (!map || !(window as any).L?.heatLayer) return;

        const points: any[] = households
            .map(h => {
                const coords = h.location?.coordinates;
                return coords ? [coords[1], coords[0], 0.5] : null;
            })
            .filter(p => p !== null);

        const heatLayer = (window as any).L.heatLayer(points, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
        }).addTo(map);

        return () => {
            if (heatLayer) map.removeLayer(heatLayer);
        };
    }, [map, households]);

    return null;
};

interface MapComponentProps {
    households: Household[];
    onSelect: (household: Household) => void;
    center: [number, number];
    zoom: number;
    showHeatmap?: boolean;
    showZones?: boolean;
    routingEnabled?: boolean;
    onRoutingClose?: () => void;
    activeHouseholdId?: string | null;
    routingStart?: [number, number] | null;
    routingDest?: [number, number] | null;
}

const MapComponent: React.FC<MapComponentProps> = ({
    households,
    onSelect,
    center,
    zoom,
    showHeatmap = false,
    showZones = false,
    routingEnabled = false,
    onRoutingClose = () => { },
    activeHouseholdId = null,
    routingStart = null,
    routingDest = null
}) => {
    const { isDarkMode } = useTheme();
    const { grappesConfig } = useLogistique();
    const grappes = grappesConfig || GRAPPES_CONFIG;
    const activeHousehold = households.find(h => h.id === activeHouseholdId);
    return (
        <MapContainer
            center={center}
            zoom={zoom}
            className="h-full w-full z-0 bg-slate-100 dark:bg-slate-900"
            zoomControl={false}
            scrollWheelZoom={true}
            maxZoom={19}
        >
            <ChangeView center={center} zoom={zoom} />

            <LayersControl position="topright">
                <LayersControl.BaseLayer checked={!isDarkMode} name="Clair">
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        maxZoom={19}
                        maxNativeZoom={19}
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer checked={isDarkMode} name="Sombre">
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        maxZoom={19}
                        maxNativeZoom={19}
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite">
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution='Tiles &copy; Esri'
                        maxZoom={19}
                        maxNativeZoom={18}
                    />
                </LayersControl.BaseLayer>
            </LayersControl>

            <ZoomControl position="bottomright" />{
                showHeatmap ? (
                    <HeatmapLayer households={households} />
                ) : (
                    <MarkerClusterGroup
                        chunkedLoading
                        maxClusterRadius={50}
                        spiderfyOnMaxZoom={true}
                        iconCreateFunction={createClusterCustomIcon}
                    >
                        {households.map((h) => {
                            const coords = h.location?.coordinates;
                            if (!coords) return null;

                            return (
                                <Marker
                                    key={h.id}
                                    position={[coords[1], coords[0]]}
                                    icon={getMarkerIcon(h.region, h.status)}
                                    eventHandlers={{
                                        click: () => onSelect?.(h),
                                    }}
                                >
                                    <Popup className="custom-popup">
                                        <div className={`p-4 min-w-[240px] rounded-2xl transition-colors ${isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800'}`}>
                                            <div className="flex justify-between items-start mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                                                <div>
                                                    <h3 className="font-black text-xs uppercase tracking-tighter italic">Ménage {h.id}</h3>
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase">{h.region || 'Région inconnue'}</p>
                                                </div>
                                                <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${h.status === 'Terminé' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                                    {h.status}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {h.owner && (
                                                    <div>
                                                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Chef de ménage</p>
                                                        <p className="text-[11px] font-bold">{h.owner}</p>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-4 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                                                    <div className="flex-1">
                                                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Dernière MAJ</p>
                                                        <p className="text-[10px] font-bold">28/02 14:30</p>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Affectation</p>
                                                        <p className="text-[10px] font-bold text-indigo-600">Équipe A</p>
                                                    </div>
                                                </div>

                                                <div className="pt-2 flex gap-2">
                                                    <button
                                                        onClick={() => onSelect?.(h)}
                                                        className="flex-1 bg-indigo-600 text-white text-[10px] font-black py-2.5 rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                                                    >
                                                        OUVRIR FICHE
                                                    </button>
                                                    <button
                                                        title="Ouvrir dans Google Maps"
                                                        onClick={() => window.open(`https://www.google.com/maps?q=${coords[1]},${coords[0]}`, '_blank')}
                                                        className="px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-all"
                                                    >
                                                        GPS
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </Popup>
                                    <Tooltip direction="top" offset={[0, -10]}>
                                        ID: {h.id} - {h.status}
                                    </Tooltip>
                                </Marker>
                            );
                        })}
                    </MarkerClusterGroup>
                )
            }

            {
                showZones && (
                    <>
                        {/* GRAPPES — Large  zones, bleu indigo, bordure pleine */}
                        {grappes.grappes.map((grappe: any) => {
                            return (
                                <Circle
                                    key={grappe.id}
                                    center={[grappe.centroide_lat, grappe.centroide_lon]}
                                    pathOptions={{
                                        fillColor: '#4338ca',   // indigo-700
                                        color: '#4338ca',
                                        fillOpacity: 0.07,
                                        weight: 2.5,
                                        dashArray: undefined    // ligne continue
                                    }}
                                    radius={(grappe.rayon_moyen_km || 5) * 1000}
                                >
                                    <Tooltip
                                        direction="center"
                                        permanent
                                        className="bg-transparent border-none text-indigo-700 dark:text-indigo-300 font-black text-sm drop-shadow-md"
                                    >
                                        🔵 {grappe.nom}
                                    </Tooltip>
                                </Circle>
                            );
                        })}
                        {/* SOUS-GRAPPES — Zones plus petites, orange ambré, bordure pointillée */}
                        {grappes.sous_grappes.map((sg: any) => {
                            return (
                                <Circle
                                    key={sg.id}
                                    center={[sg.centroide_lat, sg.centroide_lon]}
                                    pathOptions={{
                                        fillColor: '#d97706',   // amber-600
                                        color: '#f59e0b',       // amber-400 border
                                        fillOpacity: 0.12,
                                        weight: 1.5,
                                        dashArray: '6, 4'       // pointillé pour distinguer
                                    }}
                                    radius={1500}
                                >
                                    <Popup>
                                        <div className="min-w-[160px]">
                                            <p className="font-black text-xs text-amber-800">🟠 {sg.nom}</p>
                                            <p className="text-[11px] text-slate-500 mt-1">Code : <b>{sg.code}</b></p>
                                            <p className="text-[11px] text-slate-500">{sg.nb_menages} ménages</p>
                                        </div>
                                    </Popup>
                                    <Tooltip direction="center" className="bg-transparent border-none font-bold text-xs text-amber-700 dark:text-amber-300 drop-shadow">
                                        {sg.code}
                                    </Tooltip>
                                </Circle>
                            );
                        })}
                    </>
                )
            }

            {/* Radar / Ping effect for active household */}
            {
                activeHousehold && activeHousehold.location?.coordinates && (
                    <Marker
                        position={[activeHousehold.location.coordinates[1], activeHousehold.location.coordinates[0]]}
                        icon={L.divIcon({
                            className: 'bg-transparent border-0 pointer-events-none',
                            html: `<div class="w-20 h-20 bg-indigo-500/20 rounded-full animate-ping border-2 border-indigo-400"></div>`,
                            iconSize: [80, 80],
                            iconAnchor: [40, 40]
                        })}
                        zIndexOffset={-10}
                    />
                )
            }

            <MapRouting enabled={routingEnabled} onClose={onRoutingClose} startPoint={routingStart} endPoint={routingDest} />
        </MapContainer >
    );
};

export default MapComponent;
