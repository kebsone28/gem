/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useCallback, useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import toast from 'react-hot-toast';

import { useTerrainUIStore } from '../../store/terrainUIStore';

const safeRemovePopup = (popup: maplibregl.Popup | null) => {
  if (!popup) return;

  try {
    popup.remove();
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name !== 'NotFoundError') {
      throw error;
    }
  }
};

export const useMapInteractions = (
  readOnly: boolean,
  householdsRef: React.MutableRefObject<any[]>,
  onZoneClickRef: React.MutableRefObject<(coord: [number, number], zoom: number) => void>,
  onDropRef: React.MutableRefObject<(id: string, lat: number, lng: number) => void>
) => {
  const setSelectedHouseholdId = useTerrainUIStore((s) => s.setSelectedHouseholdId);
  const dragStateRef = useRef({ isDragging: false, draggedFeatureId: null as string | null });

  const popupRef = useRef<maplibregl.Popup | null>(null);
  const householdInteractiveLayers = [
    'households-local-layer',
    'households-glow-layer',
    'households-photo-badge',
  ] as const;

  // ✅ Clean up popup on unmount
  useEffect(() => {
    return () => {
      if (popupRef.current) {
        safeRemovePopup(popupRef.current);
      }
    };
  }, []);

  const setupInteractions = useCallback(
    (map: maplibregl.Map) => {
      const disposers: Array<() => void> = [];

      // ✅ Initialize shared native popup
      if (!popupRef.current) {
        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: true,
          className: 'premium-map-popup',
          maxWidth: '300px',
          offset: 15,
        });
      }

      // ✅ Handle the 'Voir les détails' button click from inside the native HTML popup
      const handleSelectEvent = (e: any) => {
        const hId = e.detail;
        if (hId) {
          setSelectedHouseholdId(hId);
          safeRemovePopup(popupRef.current);
        }
      };

      window.addEventListener('map:select-household', handleSelectEvent);

      // Cursor pointer on hover
      const setupInteraction = (layerId: string) => {
        const handleMouseEnter = () => {
          if (!readOnly || ['clusters', 'grappes-layer', 'auto-grappes-fill'].includes(layerId)) {
            map.getCanvas().style.cursor = 'pointer';
          }
        };
        const handleMouseLeave = () => {
          map.getCanvas().style.cursor = '';
        };

        map.on('mouseenter', layerId, handleMouseEnter);
        map.on('mouseleave', layerId, handleMouseLeave);
        disposers.push(() => map.off('mouseenter', layerId, handleMouseEnter));
        disposers.push(() => map.off('mouseleave', layerId, handleMouseLeave));
      };

      [
        ...householdInteractiveLayers,
        'grappes-layer',
        'sous-grappes-layer',
        'grappes-labels',
        'auto-grappes-fill',
      ].forEach(setupInteraction);

      // Auto-Grappes hover state
      let hoveredAutoGrappeId: string | number | null = null;
      const handleAutoGrappeMove = (e: any) => {
        if (e.features && e.features.length > 0) {
          if (hoveredAutoGrappeId !== null) {
            map.setFeatureState(
              { source: 'auto-grappes', id: hoveredAutoGrappeId },
              { hover: false }
            );
          }
          hoveredAutoGrappeId = e.features[0].id as string | number;
          map.setFeatureState({ source: 'auto-grappes', id: hoveredAutoGrappeId }, { hover: true });
        }
      };

      const handleAutoGrappeLeave = () => {
        if (hoveredAutoGrappeId !== null) {
          map.setFeatureState(
            { source: 'auto-grappes', id: hoveredAutoGrappeId },
            { hover: false }
          );
        }
        hoveredAutoGrappeId = null;
      };

      map.on('mousemove', 'auto-grappes-fill', handleAutoGrappeMove);
      map.on('mouseleave', 'auto-grappes-fill', handleAutoGrappeLeave);
      disposers.push(() => map.off('mousemove', 'auto-grappes-fill', handleAutoGrappeMove));
      disposers.push(() => map.off('mouseleave', 'auto-grappes-fill', handleAutoGrappeLeave));

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
          toast.success('Position mise à jour !');
        }

        const dragSource = map.getSource('drag-point') as maplibregl.GeoJSONSource;
        if (dragSource) {
          dragSource.setData({ type: 'FeatureCollection', features: [] } as any);
        }
      };

      // Mouse drag
      ['households-local-layer', 'households-glow-layer'].forEach((layerId) => {
        const handleMouseDown = (e: any) => {
          if (readOnly) return;
          const feature = e.features?.[0];
          if (!feature) return;

          map.dragPan.disable();
          dragStateRef.current = {
            isDragging: true,
            draggedFeatureId:
              feature.properties.household_id || feature.properties.id || String(feature.id),
          };
          map.getCanvas().style.cursor = 'grabbing';
        };

        map.on('mousedown', layerId, handleMouseDown);
        disposers.push(() => map.off('mousedown', layerId, handleMouseDown));
      });

      // Touch drag
      ['households-local-layer', 'households-glow-layer'].forEach((layerId) => {
        const handleTouchStart = (e: any) => {
          if (readOnly) return;
          const feature = e.features?.[0];
          if (!feature) return;

          map.dragPan.disable();
          dragStateRef.current = {
            isDragging: true,
            draggedFeatureId:
              feature.properties.household_id || feature.properties.id || String(feature.id),
          };
          map.getCanvas().style.cursor = 'grabbing';
        };

        map.on('touchstart', layerId, handleTouchStart);
        disposers.push(() => map.off('touchstart', layerId, handleTouchStart));
      });

      // Move callback
      const handleMouseMove = (e: any) => {
        if (!dragStateRef.current.isDragging || !dragStateRef.current.draggedFeatureId) return;

        const dragSource = map.getSource('drag-point') as maplibregl.GeoJSONSource;
        if (dragSource) {
          dragSource.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
                properties: { id: dragStateRef.current.draggedFeatureId },
              },
            ],
          } as any);
        }
      };
      map.on('mousemove', handleMouseMove);
      disposers.push(() => map.off('mousemove', handleMouseMove));

      // Mouse up
      const handleMouseUp = (e: any) => endDrag(e.lngLat);
      map.on('mouseup', handleMouseUp);
      disposers.push(() => map.off('mouseup', handleMouseUp));

      // Touch end
      const handleTouchEnd = (e: any) => {
        if (!dragStateRef.current.isDragging) return;
        endDrag(e.lngLat);
      };
      map.on('touchend', handleTouchEnd);
      disposers.push(() => map.off('touchend', handleTouchEnd));

      // Safety: mouseleave during drag
      householdInteractiveLayers.forEach((layerId) => {
        const handleLayerMouseLeave = () => {
          if (dragStateRef.current.isDragging) endDrag(null);
        };
        map.on('mouseleave', layerId, handleLayerMouseLeave);
        disposers.push(() => map.off('mouseleave', layerId, handleLayerMouseLeave));
      });

      // ── CLICK HANDLERS (ZONES & GRAPPES) ──
      const handleGrappeClick = (e: any) => {
        const feature = e.features?.[0];
        if (feature && onZoneClickRef.current) {
          const coords = (feature.geometry as any).coordinates;
          onZoneClickRef.current([coords[1], coords[0]], 14);
        }
      };
      map.on('click', 'grappes-layer', handleGrappeClick);
      disposers.push(() => map.off('click', 'grappes-layer', handleGrappeClick));

      const handleAutoGrappeClick = (e: any) => {
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
      };
      map.on('click', 'auto-grappes-fill', handleAutoGrappeClick);
      disposers.push(() => map.off('click', 'auto-grappes-fill', handleAutoGrappeClick));


      return () => {
        window.removeEventListener('map:select-household', handleSelectEvent);
        disposers.forEach((dispose) => dispose());
      };
    },
    [readOnly, householdsRef, setSelectedHouseholdId, onZoneClickRef, onDropRef]
  );

  return { setupInteractions };
};
