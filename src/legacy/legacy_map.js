/*
 * legacy_map.js
 * Legacy (pre-MapManager) map functions extracted out of main.js so they can be
 * loaded only when APP_CONFIG.mapImplementation === 'legacy'. This file mirrors
 * the previous initializeMap / renderHouseholdsOnMap / recreateClusterGroup / updateMapRendering
 * implementations but kept isolated so the new MapManager can be the default.
 */

(function () {
    'use strict';

    // Ensure we expose functions globally matching the legacy names
    window.initializeMapLegacy = function initializeMapLegacy() {
        try {
            if (typeof L === 'undefined') {
                console.warn('Leaflet (L) is not loaded yet — skipping legacy map initialization');
                return;
            }

            if (!window.__map) window.__map = null;
            if (!window.__markerClusterGroup) window.__markerClusterGroup = null;
            if (!window.__heatLayer) window.__heatLayer = null;

            const container = document.getElementById('householdMap');
            if (!container) return;

            // Prevent double initialization
            if (window.__map) return;

            try {
                if (container._leaflet_id) {
                    container.innerHTML = '';
                    try { delete container._leaflet_id; } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore cleanup errors */ }

            window.__map = L.map('householdMap').setView([0, 0], 2);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(window.__map);

            try {
                window.__markerClusterGroup = L.markerClusterGroup(window.__markerClusterOptions || { chunkedLoading: true, maxClusterRadius: 60 });
            } catch (e) {
                console.warn('leaflet.markercluster unavailable, creating fallback layerGroup', e);
                window.__markerClusterGroup = L.layerGroup();
            }
            window.__markerClusterGroup.addTo(window.__map);

            try {
                window.__heatLayer = L.heatLayer([], { radius: 25, blur: 15, maxZoom: 17 });
            } catch (e) {
                console.warn('leaflet.heat unavailable', e);
                window.__heatLayer = null;
            }

            // render existing households if any
            try { if (appState && appState.households && appState.households.length > 0 && typeof window.renderHouseholdsOnMapLegacy === 'function') window.renderHouseholdsOnMapLegacy(); } catch (e) { /* ignore */ }

        } catch (e) { console.error('Erreur initializeMapLegacy', e); }
    };

    // Backwards-compatible aliases: some legacy code expects `initializeMap`
    // and other short names. Create thin wrappers so tests and older modules
    // still find the expected globals.
    try {
        if (typeof window.initializeMap === 'undefined') {
            window.initializeMap = function () { return window.initializeMapLegacy && window.initializeMapLegacy.apply(null, arguments); };
        }
        if (typeof window.renderHouseholdsOnMap === 'undefined') {
            window.renderHouseholdsOnMap = function () { return window.renderHouseholdsOnMapLegacy && window.renderHouseholdsOnMapLegacy.apply(null, arguments); };
        }
        if (typeof window.recreateClusterGroup === 'undefined') {
            window.recreateClusterGroup = function () { return window.recreateClusterGroupLegacy && window.recreateClusterGroupLegacy.apply(null, arguments); };
        }
        if (typeof window.updateMapRendering === 'undefined') {
            window.updateMapRendering = function () { return window.updateMapRenderingLegacy && window.updateMapRenderingLegacy.apply(null, arguments); };
        }
    } catch (e) { /* ignore aliasing failures */ }

    window.renderHouseholdsOnMapLegacy = function renderHouseholdsOnMapLegacy() {
        try {
            if (!window.__map) return;
            const points = window.appState?.households || [];
            if (points.length === 0) {
                window.__markerClusterGroup && window.__markerClusterGroup.clearLayers();
                if (window.__heatLayer) try { window.__map.removeLayer(window.__heatLayer); } catch (e) { }
                return;
            }

            const useHeat = document.getElementById('heatmapToggle')?.checked;
            const latLngs = [];
            const heatPoints = [];

            points.forEach(p => {
                const lat = parseFloat(p.lat || p.properties?.lat || p.properties?.latitude || p.lat);
                const lon = parseFloat(p.lon || p.properties?.lon || p.properties?.longitude || p.lon);
                if (isFinite(lat) && isFinite(lon)) {
                    latLngs.push([lat, lon]);
                    heatPoints.push([lat, lon, 1]);
                }
            });

            if (useHeat && window.__heatLayer) {
                try { window.__map.removeLayer(window.__markerClusterGroup); } catch (e) { }
                window.__heatLayer.setLatLngs(heatPoints.map(h => [h[0], h[1], h[2]]));
                try { window.__heatLayer.addTo(window.__map); } catch (e) { }
                if (latLngs.length > 0) try { window.__map.fitBounds(latLngs, { maxZoom: 16, padding: [20, 20] }); } catch (e) { }
                return;
            }

            if (window.__heatLayer) try { window.__map.removeLayer(window.__heatLayer); } catch (e) { }
            window.__markerClusterGroup && window.__markerClusterGroup.clearLayers();
            points.forEach(p => {
                const lat = parseFloat(p.lat || p.properties?.lat || p.properties?.latitude || p.lat);
                const lon = parseFloat(p.lon || p.properties?.lon || p.properties?.longitude || p.lon);
                if (isFinite(lat) && isFinite(lon)) {
                    const marker = L.marker([lat, lon]);
                    const popup = `<div><strong>${p.id || p.properties?.id || 'Ménage'}</strong><br>${Object.entries(p.properties || {}).map(([k, v]) => `${k}: ${v}`).join('<br>')}</div>`;
                    marker.bindPopup(popup);
                    try { window.__markerClusterGroup.addLayer(marker); } catch (e) { /* ignore */ }
                }
            });
            if (latLngs.length > 0) try { window.__map.fitBounds(latLngs, { maxZoom: 16, padding: [20, 20] }); } catch (e) { }

        } catch (e) { console.error('renderHouseholdsOnMapLegacy error', e); }
    };

    window.recreateClusterGroupLegacy = function recreateClusterGroupLegacy() {
        try {
            if (!window.__map) return;
            try { window.__map.removeLayer(window.__markerClusterGroup); } catch (e) { }
            try {
                window.__markerClusterGroup = L.markerClusterGroup(window.__markerClusterOptions || { chunkedLoading: true, maxClusterRadius: 60 });
            } catch (e) {
                console.warn('marker cluster recreate failed', e);
                window.__markerClusterGroup = L.layerGroup();
            }
            window.__markerClusterGroup.addTo(window.__map);
            window.renderHouseholdsOnMapLegacy();
        } catch (e) { console.error('recreateClusterGroupLegacy error', e); }
    };

    window.updateMapRenderingLegacy = function updateMapRenderingLegacy() {
        try {
            window.renderHouseholdsOnMapLegacy();
        } catch (e) { console.error('updateMapRenderingLegacy error', e); }
    };

    console.log('legacy_map loaded');
})();
