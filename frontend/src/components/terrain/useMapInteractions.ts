import { useCallback, useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import toast from 'react-hot-toast';
import { generatePopupHTML } from './mapUtils';

import { useTerrainUIStore } from '../../store/terrainUIStore';

export const useMapInteractions = (
    readOnly: boolean,
    householdsRef: React.MutableRefObject<any[]>,
    onZoneClickRef: React.MutableRefObject<(coord: [number, number], zoom: number) => void>,
    onDropRef: React.MutableRefObject<(id: string, lat: number, lng: number) => void>
) => {
    const setSelectedHouseholdId = useTerrainUIStore(s => s.setSelectedHouseholdId);
    const dragStateRef = useRef({ isDragging: false, draggedFeatureId: null as string | null });

    const popupRef = useRef<maplibregl.Popup | null>(null);

    // ✅ Clean up popup on unmount
    useEffect(() => {
        return () => {
            if (popupRef.current) {
                popupRef.current.remove();
            }
        };
    }, []);

    const setupInteractions = useCallback((map: maplibregl.Map) => {
        // ✅ Initialize shared native popup
        if (!popupRef.current) {
            popupRef.current = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: true,
                className: 'premium-map-popup',
                maxWidth: '300px',
                offset: 15
            });
        }

        // ✅ Handle the 'Voir les détails' button click from inside the native HTML popup
        const handleSelectEvent = (e: any) => {
            const hId = e.detail;
            if (hId) {
                setSelectedHouseholdId(hId);
                popupRef.current?.remove();
            }
        };
        
        window.addEventListener('map:select-household', handleSelectEvent);

        // Cursor pointer on hover
        const setupInteraction = (layerId: string) => {
            map.on('mouseenter', layerId, () => {
                if (!readOnly || ['clusters', 'grappes-layer', 'auto-grappes-fill'].includes(layerId)) {
                    map.getCanvas().style.cursor = 'pointer';
                }
            });
            map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
        };

        ['households-server-layer', 'households-local-layer', 'grappes-layer', 'sous-grappes-layer', 'grappes-labels', 'auto-grappes-fill'].forEach(setupInteraction);

        // Auto-Grappes hover state
        let hoveredAutoGrappeId: string | number | null = null;
        map.on('mousemove', 'auto-grappes-fill', (e) => {
            if (e.features && e.features.length > 0) {
                if (hoveredAutoGrappeId !== null) {
                    map.setFeatureState(
                        { source: 'auto-grappes', id: hoveredAutoGrappeId },
                        { hover: false }
                    );
                }
                hoveredAutoGrappeId = e.features[0].id as string | number;
                map.setFeatureState(
                    { source: 'auto-grappes', id: hoveredAutoGrappeId },
                    { hover: true }
                );
            }
        });

        map.on('mouseleave', 'auto-grappes-fill', () => {
            if (hoveredAutoGrappeId !== null) {
                map.setFeatureState(
                    { source: 'auto-grappes', id: hoveredAutoGrappeId },
                    { hover: false }
                );
            }
            hoveredAutoGrappeId = null;
        });

        // ── DRAG & DROP (Mouse + Touch) ──
        const endDrag = (lngLat: maplibregl.LngLat | null) => {
            if (!dragStateRef.current.isDragging || !dragStateRef.current.draggedFeatureId) {
                if (!map.dragPan.isEnabled()) map.dragPan.enable();
                return;
            }

            const featureId = dragStateRef.current.draggedFeatureId;
            dragStateRef.current = { isDragging: false, draggedFeatureId: null };
            map.dragPan.enable();
            map.getCanvas().style.cursor = '';

            if (lngLat && onDropRef.current) {
                onDropRef.current(featureId, lngLat.lat, lngLat.lng);
                toast.success("Position mise à jour !");
            }

            const dragSource = map.getSource('drag-point') as maplibregl.GeoJSONSource;
            if (dragSource) {
                dragSource.setData({ type: 'FeatureCollection', features: [] } as any);
            }
        };

        // Mouse drag
        map.on('mousedown', 'households-local-layer', (e) => {
            if (readOnly) return;
            const feature = e.features?.[0];
            if (!feature) return;

            // Wait a few ms to distinguish between click (for popup) and drag
            // Simple threshold: if mouse stays down and moves, it's a drag
            map.dragPan.disable();
            dragStateRef.current = { isDragging: true, draggedFeatureId: feature.properties.household_id || feature.properties.id || String(feature.id) };
            map.getCanvas().style.cursor = 'grabbing';
        });

        // Touch drag
        map.on('touchstart', 'households-local-layer', (e) => {
            if (readOnly) return;
            const feature = e.features?.[0];
            if (!feature) return;

            map.dragPan.disable();
            dragStateRef.current = { isDragging: true, draggedFeatureId: feature.properties.household_id || feature.properties.id || String(feature.id) };
            map.getCanvas().style.cursor = 'grabbing';
        });

        // Move callback
        map.on('mousemove', (e) => {
            if (!dragStateRef.current.isDragging || !dragStateRef.current.draggedFeatureId) return;

            const dragSource = map.getSource('drag-point') as maplibregl.GeoJSONSource;
            if (dragSource) {
                dragSource.setData({
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
                        properties: { id: dragStateRef.current.draggedFeatureId }
                    }]
                } as any);
            }
        });

        // Mouse up
        map.on('mouseup', (e) => endDrag(e.lngLat));

        // Touch end
        map.on('touchend', (e) => {
            if (!dragStateRef.current.isDragging) return;
            endDrag(e.lngLat);
        });

        // Safety: mouseleave during drag
        map.on('mouseleave', 'households-local-layer', () => {
            if (dragStateRef.current.isDragging) endDrag(null);
        });

        // ── CLICK HANDLERS ──
        ['households-server-layer', 'households-local-layer'].forEach(layerId => {
            map.on('click', layerId, (e) => {
                const feature = e.features?.[0];
                if (feature && popupRef.current) {
                    // ✅ Show high-performance native popup
                    popupRef.current
                        .setLngLat((feature.geometry as any).coordinates)
                        .setHTML(generatePopupHTML(feature))
                        .addTo(map);
                }
            });
        });

        map.on('click', 'grappes-layer', (e) => {
            const feature = e.features?.[0];
            if (feature && onZoneClickRef.current) {
                const coords = (feature.geometry as any).coordinates;
                onZoneClickRef.current([coords[1], coords[0]], 14);
            }
        });

        map.on('click', 'auto-grappes-fill', (e) => {
            const feature = e.features?.[0];
            if (feature && onZoneClickRef.current) {
                const centroidX = feature.properties?.centroidX;
                const centroidY = feature.properties?.centroidY;
                if (centroidX != null && centroidY != null) {
                    onZoneClickRef.current([centroidX, centroidY], 12);
                }
                const id = feature.properties?.id;
                if (id) {
                    useTerrainUIStore.getState().setActiveGrappeId(id);
                    useTerrainUIStore.getState().setPanel('grappe_allocation');
                }
            }
        });

        return () => {
            window.removeEventListener('map:select-household', handleSelectEvent);
        };
    }, [readOnly, householdsRef, setSelectedHouseholdId, onZoneClickRef, onDropRef]);

    return { setupInteractions };
};
