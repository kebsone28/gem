// map_manager.js - Gestion de la carte interactive

// Helper pour normaliser différentes formes de payload provenant
// soit de la nouvelle architecture, soit du code legacy.
function normalizeIncoming(data) {
    if (!data) return {};
    // si payload direct
    const id = data.id || data.householdId || data.HouseholdId || data._id || null;
    const lat = data.lat ?? data.gps_lat ?? data.latitude ?? data.location?.lat ?? data.location?.latitude ?? null;
    const lon = data.lon ?? data.gps_lon ?? data.longitude ?? data.location?.lon ?? data.location?.longitude ?? null;
    const status = data.status ?? data.statut ?? data.statut_installation ?? null;
    const owner = data.owner ?? data.nom_prenom_chef ?? data.name ?? data.nom ?? null;
    const tooltip = data.tooltip ?? null;
    return { id, lat, lon, status, owner, tooltip };
}

class MapManager {
    constructor() {
        this.map = null;
        this.markers = null;
        this._eventQueue = [];
        this.heatLayer = null;
        this._markerClusterOptions = { chunkedLoading: true, maxClusterRadius: 60 };
        this.initMap();
        // Subscribe to EventBus (if available now or shortly). Some test environments
        // create the eventBus after MapManager construction, so poll for it.
        this._subscribeToEventBus = () => {
            try {
                if (!window.eventBus) return false;
                window.eventBus.on('household.created', (data) => {
                    const payload = normalizeIncoming(data);
                    if (!this.markers) { this._eventQueue.push({ type: 'created', data: payload }); return; }
                    this.addMarker(payload);
                });
                window.eventBus.on('household.updated', (data) => {
                    const payload = normalizeIncoming(data);
                    // payload.id may be null if data was just an id string
                    const id = payload.id || (typeof data === 'string' ? data : (data?.id || data?.householdId));
                    if (!this.markers) { this._eventQueue.push({ type: 'updated', id, data: payload }); return; }
                    if (id) this.updateMarker(id, payload);
                });
                window.eventBus.on('household.deleted', (data) => {
                    // Support both object payloads and direct id string
                    const id = (typeof data === 'string') ? data : (data?.id || data?.householdId || data?.household?.id);
                    if (!this.markers) { this._eventQueue.push({ type: 'deleted', id }); return; }
                    if (id) this.removeMarker(id);
                });
                return true;
            } catch (e) {
                console.warn('🗺️ [MapManager] Cannot subscribe to EventBus:', e);
                return false;
            }
        };

        // Try to subscribe now, otherwise poll until available (max attempts)
        if (!this._subscribeToEventBus()) {
            let attempts = 0;
            const maxAttempts = 20;
            const poll = setInterval(() => {
                attempts++;
                if (this._subscribeToEventBus()) {
                    clearInterval(poll);
                } else if (attempts >= maxAttempts) {
                    clearInterval(poll);
                }
            }, 250);
        }
    }

    initMap() {
        if (typeof L === 'undefined') {
            console.warn('🗺️ [MapManager] Leaflet non chargé');
            return;
        }

        // Vérifier que le conteneur existe et est visible
        const container = document.getElementById('householdMap');
        if (!container) {
            console.warn('🗺️ [MapManager] Conteneur householdMap introuvable');
            return;
        }

        // Attendre que le conteneur soit visible et ait des dimensions
        const waitForContainer = () => {
            return new Promise((resolve) => {
                const checkContainer = () => {
                    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
                        resolve();
                    } else {
                        requestAnimationFrame(checkContainer);
                    }
                };
                checkContainer();
            });
        };

        // Initialiser la carte une fois le conteneur prêt
        waitForContainer().then(() => {
            // Si le conteneur a déjà une carte, la supprimer d'abord
            if (this.map) {
                console.log('🗺️ [MapManager] Suppression de l\'ancienne instance de carte via remove()');
                this.map.remove();
                this.map = null;
            } else if (container._leaflet_id) {
                // Fallback si this.map est perdu mais le DOM a encore des traces
                console.log('🗺️ [MapManager] Nettoyage manuel du conteneur Leaflet');
                container._leaflet_id = undefined;
                container.innerHTML = '';
            }

            try {
                // Initialisation Leaflet (Centré sur Dakar, Sénégal)
                this.map = L.map('householdMap').setView([14.7167, -17.4677], 12);

                // Style de carte épuré (CartoDB Positron) - montre mieux les routes et bâtiments
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap contributors © CARTO',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(this.map);

                // Cluster Group
                this.markers = L.markerClusterGroup(this._markerClusterOptions);
                this.map.addLayer(this.markers);

                // Inject highlight CSS once
                try {
                    if (!document.getElementById('map-manager-styles')) {
                        const s = document.createElement('style');
                        s.id = 'map-manager-styles';
                        s.textContent = `
                            .map-marker-highlight { transform: scale(1.25); transition: transform 200ms ease; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25)); z-index: 9999 !important; }
                        `;
                        document.head.appendChild(s);
                    }
                } catch (e) { /* ignore */ }

                // Charger les données
                this.loadData();

                // Drain any queued events that occurred before markers were ready
                try { this._drainEventQueue(); } catch (e) { /* ignore */ }

                // Écouteurs
                // Toggle control ids in terrain.html (support both legacy and new ids)
                const heatToggleIds = ['toggleHeatmap', 'heatmapToggle'];
                heatToggleIds.forEach(id => {
                    try {
                        const el = document.getElementById(id);
                        if (el) el.addEventListener('change', (e) => { this.toggleHeatmap(e.target.checked); });
                    } catch (e) { /* ignore */ }
                });

                document.getElementById('clusterRadiusInput')?.addEventListener('input', (e) => {
                    const radius = parseInt(e.target.value);
                    document.getElementById('clusterRadiusValue').textContent = radius;
                });

                console.log('🗺️ [MapManager] Carte initialisée avec succès');
            } catch (error) {
                console.error('🗺️ [MapManager] Erreur lors de l\'initialisation:', error);
            }
        });
    }

    /** Recreate cluster group with new options (e.g. maxClusterRadius) */
    recreateClusterGroup(maxClusterRadius) {
        try {
            if (!this.map || !this.markers) return;
            if (typeof maxClusterRadius === 'number') this._markerClusterOptions.maxClusterRadius = maxClusterRadius;
            const existingLayers = this.markers.getLayers() || [];
            try { this.map.removeLayer(this.markers); } catch (e) { /* ignore */ }
            try {
                this.markers = L.markerClusterGroup(this._markerClusterOptions);
            } catch (e) {
                console.warn('marker cluster recreate failed', e);
                this.markers = L.layerGroup();
            }
            // Re-add existing layers
            if (existingLayers.length > 0) this.markers.addLayers(existingLayers);
            this.map.addLayer(this.markers);
            // update UI counter
            try { const el = document.getElementById('mapPointsCount'); if (el) el.textContent = `${this.getMarkerCount().toLocaleString()} points affichés`; } catch (e) { }
        } catch (e) { console.error('MapManager.recreateClusterGroup error', e); }
    }

    async loadData() {
        if (!this.map || !this.markers) {
            // Silencieux : chargement différé normal
            return;
        }

        // Forcer le redimensionnement pour éviter les problèmes d'affichage
        try {
            const container = document.getElementById('householdMap');
            if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
                this.map.invalidateSize();
            }
        } catch (e) {
            console.warn('🗺️ [MapManager] invalidateSize failed:', e);
        }

        try {
            // Chargez les deux schémas possibles : legacy menages et nouvelle table households
            // Chargez UNIQUEMENT depuis la nouvelle table households
            let menages = [];

            try {
                if (db.households) {
                    let newHouseholds = [];
                    try {
                        if (typeof db.households.toArray === 'function') {
                            newHouseholds = (await db.households.toArray()) || [];
                        }
                    } catch (e) {
                        console.warn('🗺️ [MapManager] Error reading households via Dexie:', e);
                    }

                    // If households table empty, try legacy `menages` table (compatibility)
                    if ((!newHouseholds || newHouseholds.length === 0) && db.menages && typeof db.menages.toArray === 'function') {
                        try {
                            const men = (await db.menages.toArray()) || [];
                            if (men && men.length > 0) {
                                // Convert menages shape to household-like objects
                                newHouseholds = men.map(m => ({
                                    id: m.id || m._id,
                                    owner: { name: m.nom_prenom_chef || m.nom || '' },
                                    status: m.statut || m.Statut_Installation || 'Attente démarrage',
                                    location: m.location || (m.gps_lat && m.gps_lon ? { coordinates: { latitude: parseFloat(m.gps_lat), longitude: parseFloat(m.gps_lon) } } : null),
                                    // keep original raw fields for debugging
                                    _legacy: m
                                }));
                            }
                        } catch (e) {
                            console.warn('🗺️ [MapManager] Error reading menages via Dexie:', e);
                        }
                    }

                    // Fallback to in-memory mirrored data when Dexie returns empty
                    if ((!newHouseholds || newHouseholds.length === 0) && window.__inMemoryData && Array.isArray(window.__inMemoryData.households) && window.__inMemoryData.households.length > 0) {
                        try { newHouseholds = window.__inMemoryData.households.slice(); } catch (e) { /* ignore */ }
                    }

                    // Convertir au format map point
                    menages = newHouseholds.map(h => {
                        let lat = null, lon = null;

                        // Support robuste des coordonnées nested
                        if (h.location?.coordinates) {
                            const coords = h.location.coordinates;
                            if (typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
                                lat = coords.latitude;
                                lon = coords.longitude;
                            } else if (Array.isArray(coords) && coords.length >= 2) {
                                lon = coords[0];
                                lat = coords[1];
                            }
                        }

                        // Si pas trouvé dans location, vérifier à la racine (cas hybrides)
                        if (lat === null) lat = h.latitude || h.gps_lat || h.lat;
                        if (lon === null) lon = h.longitude || h.gps_lon || h.lon;

                        return {
                            id: h.id,
                            gps_lat: parseFloat(lat),
                            gps_lon: parseFloat(lon),
                            nom_prenom_chef: h.owner?.name ?? h.nom_prenom_chef ?? '',
                            Statut_Installation: h.status ?? h.Statut_Installation ?? 'Attente démarrage',
                            // Garder l'objet original pour le clic
                            original: h
                        };
                    }).filter(m => !isNaN(m.gps_lat) && !isNaN(m.gps_lon) && m.gps_lat !== 0 && m.gps_lon !== 0);

                } else {
                    console.warn('🗺️ [MapManager] Table households introuvable !');
                }
            } catch (e) {
                console.warn('🗺️ [MapManager] Erreur lecture households', e);
            }
            console.log(`🗺️ [MapManager] Chargement de ${menages.length} ménages depuis la DB`);

            if (menages.length > 0) {
                console.log('🗺️ [MapManager] Exemple de ménage:', menages[0]);
                console.log(`🗺️ [MapManager] Coordonnées exemple: Lat=${menages[0].gps_lat}, Lon=${menages[0].gps_lon}`);
            }

            this.markers.clearLayers();
            const points = [];
            let validPointsCount = 0;

            const markersList = []; // Batch container

            menages.forEach(m => {
                // Vérification stricte des coordonnées
                // Normaliser différents noms de champs
                const rawLat = m.gps_lat ?? m.gpsLat ?? m.lat ?? m.latitude ?? (m.properties && (m.properties.lat ?? m.properties.latitude));
                const rawLon = m.gps_lon ?? m.gpsLon ?? m.lon ?? m.longitude ?? (m.properties && (m.properties.lon ?? m.properties.longitude));
                const lat = parseFloat(rawLat);
                const lon = parseFloat(rawLon);

                if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
                    // Créer une icône de drapeau colorée selon le statut
                    // IMPORTANT: Utiliser Statut_Installation en priorité (nom colonne Excel)
                    const statut = m.Statut_Installation || m.statut_installation || m.status || m.statut || '';
                    const color = this.getColor(statut);
                    const icon = L.divIcon({
                        className: 'custom-flag-marker',
                        html: `
                            <div style="position: relative;">
                                <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
                                    <!-- Mât -->
                                    <line x1="5" y1="0" x2="5" y2="40" stroke="#333" stroke-width="2"/>
                                    <!-- Drapeau -->
                                    <path d="M 5 2 L 25 2 L 25 18 L 15 14 L 5 18 Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
                                </svg>
                            </div>
                        `,
                        iconSize: [30, 40],
                        iconAnchor: [5, 40],
                        popupAnchor: [10, -35]
                    });

                    const marker = L.marker([lat, lon], { icon: icon, _customId: (m.id !== undefined && m.id !== null) ? m.id : undefined });

                    // Interaction : Clic pour sélectionner
                    marker.on('click', () => {
                        try {
                            if (window.selectHousehold) {
                                window.selectHousehold(m.id);
                            }
                        } catch (e) {
                            console.error("Erreur lors du clic sur le marqueur:", e);
                        }
                    });

                    // Tooltip léger au survol
                    marker.bindTooltip(`${m.id} - ${m.nom_prenom_chef}`, {
                        direction: 'top',
                        offset: [0, -5]
                    });

                    markersList.push(marker); // Add to batch list
                    points.push([lat, lon]);
                    validPointsCount++;
                } else {
                    console.warn(`🗺️ [MapManager] Ménage ${m.id} ignoré : coordonnées invalides (${m.gps_lat}, ${m.gps_lon})`);
                }
            });

            // Batch add to cluster group
            if (markersList.length > 0) {
                this.markers.addLayers(markersList);
            }

            console.log(`🗺️ [MapManager] ${validPointsCount} points valides ajoutés à la carte`);

            // Update UI counter and emit event
            try {
                const el = document.getElementById('mapPointsCount');
                if (el) el.textContent = `${validPointsCount.toLocaleString()} points affichés`;
            } catch (e) { /* ignore DOM update errors */ }

            try { window.eventBus?.emit?.('map.markers.updated', { count: validPointsCount }); } catch (e) { /* ignore */ }

            // Ajuster la vue
            if (points.length > 0) {
                const bounds = L.latLngBounds(points);
                this.map.fitBounds(bounds, { padding: [50, 50] });
                console.log('🗺️ [MapManager] Vue ajustée aux limites:', bounds);
            } else {
                console.log('🗺️ [MapManager] Aucun point à afficher pour le moment');
            }

            // Préparer heatmap
            if (typeof L.heatLayer !== 'undefined') {
                this.heatLayer = L.heatLayer(points, { radius: 25 });
            }

        } catch (error) {
            console.error('Erreur chargement carte:', error);
        }
    }

    fitDataBounds() {
        if (!this.markers) {
            console.warn('🗺️ [MapManager] Markers non initialisés');
            return;
        }

        try {
            const bounds = this.markers.getBounds();
            if (bounds && bounds.isValid()) {
                this.map.fitBounds(bounds, { padding: [50, 50] });
                console.log('🗺️ [MapManager] Recentrage manuel sur les données');
            } else {
                console.warn('🗺️ [MapManager] Aucune donnée géolocalisée à afficher');
                alert('Aucune donnée géolocalisée à afficher.');
            }
        } catch (error) {
            console.error('🗺️ [MapManager] Erreur fitDataBounds:', error);
            alert('Impossible de recentrer : aucune donnée disponible.');
        }
    }

    toggleHeatmap(show) {
        if (!this.heatLayer) return;

        if (show) {
            this.map.removeLayer(this.markers);
            this.map.addLayer(this.heatLayer);
        } else {
            this.map.removeLayer(this.heatLayer);
            this.map.addLayer(this.markers);
        }
    }

    /**
     * Ajoute un unique marqueur (utilisé par terrain-adapter lors d'un import / création)
     * payload: { id, lat, lon, status, owner }
     */
    addMarker(payload) {
        try {
            if (!this.map || !this.markers) return;
            const { id, lat, lon, status, owner } = payload || {};
            const parsedLat = parseFloat(lat);
            const parsedLon = parseFloat(lon);
            if (!isFinite(parsedLat) || !isFinite(parsedLon)) return;

            // Eviter doublons (par id si présent)
            const existing = this.markers.getLayers().find(l => l?.options?._customId === id);
            if (existing) return;

            const color = this.getColor(status);
            const icon = L.divIcon({
                className: 'custom-flag-marker',
                html: `
                    <div style="position: relative;">
                        <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
                            <line x1="5" y1="0" x2="5" y2="40" stroke="#333" stroke-width="2"/>
                            <path d="M 5 2 L 25 2 L 25 18 L 15 14 L 5 18 Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
                        </svg>
                    </div>
                `,
                iconSize: [30, 40],
                iconAnchor: [5, 40],
                popupAnchor: [10, -35]
            });

            const marker = L.marker([parsedLat, parsedLon], { icon, _customId: id });
            if (owner) marker.bindTooltip(`${id} - ${owner}`, { direction: 'top', offset: [0, -5] });
            marker.on('click', () => { if (window.selectHousehold) window.selectHousehold(id); });
            this.markers.addLayer(marker);

            // update map count after adding
            try {
                const el = document.getElementById('mapPointsCount');
                if (el) el.textContent = `${this.getMarkerCount().toLocaleString()} points affichés`;
            } catch (e) { /* ignore */ }

            try { window.eventBus?.emit?.('map.markers.updated', { count: this.getMarkerCount() }); } catch (e) { /* ignore */ }
            // Recentrer si nécessaire
            try {
                const bounds = this.markers.getBounds();
                if (bounds && bounds.isValid()) this.map.fitBounds(bounds, { padding: [50, 50] });
            } catch (e) { /* ignore fit errors */ }
        } catch (e) {
            console.error('MapManager.addMarker erreur:', e);
        }
    }

    /**
     * Met à jour (ou ajoute si inexistant) un marker
     * payload peut contenir id, lat, lon, status, owner, tooltip, popup
     */
    updateMarker(id, payload) {
        // update UI count in case id was new or changed
        try { const el = document.getElementById('mapPointsCount'); if (el) el.textContent = `${this.getMarkerCount().toLocaleString()} points affichés`; } catch (e) { }
        try {
            if (!this.map || !this.markers || !id) return;
            // Chercher par _customId (robuste via helper)
            const found = this.getLayerById(id);
            if (found) {
                // position
                const lat = parseFloat(payload.lat ?? payload.gps_lat ?? payload.latitude);
                const lon = parseFloat(payload.lon ?? payload.gps_lon ?? payload.longitude);
                if (isFinite(lat) && isFinite(lon)) {
                    try { found.setLatLng([lat, lon]); } catch (e) { /* ignore */ }
                }
                // icon/status
                if (payload.status) {
                    const color = this.getColor(payload.status);
                    const newIcon = L.divIcon({
                        className: 'custom-flag-marker',
                        html: `
                            <div style="position: relative;">
                                <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
                                    <line x1="5" y1="0" x2="5" y2="40" stroke="#333" stroke-width="2"/>
                                    <path d="M 5 2 L 25 2 L 25 18 L 15 14 L 5 18 Z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
                                </svg>
                            </div>
                        `,
                        iconSize: [30, 40],
                        iconAnchor: [5, 40],
                        popupAnchor: [10, -35]
                    });
                    try { found.setIcon(newIcon); } catch (e) { /* ignore */ }
                }

                // tooltip/popup
                if (payload.owner || payload.tooltip) {
                    try { found.bindTooltip(payload.tooltip || `${id} - ${payload.owner}`, { direction: 'top', offset: [0, -5] }); } catch (e) { /* ignore */ }
                }

            } else {
                // pas trouvé → ajouter
                this.addMarker({ id, lat: payload.lat || payload.gps_lat || payload.latitude, lon: payload.lon || payload.gps_lon || payload.longitude, status: payload.status, owner: payload.owner });
            }
        } catch (e) {
            console.error('MapManager.updateMarker erreur:', e);
        }
    }

    /**
     * Retourne la couche/marker correspondant à un id donné en testant
     * plusieurs chemins possibles (_customId, options._customId, layer._customId)
     */
    getLayerById(id) {
        try {
            if (!this.markers || !id) return null;
            const layers = this.markers.getLayers();
            const strId = String(id);
            return layers.find(l => {
                try {
                    const optId = l?.options?._customId ?? l?._customId ?? l?.feature?.properties?._customId ?? null;
                    if (optId === undefined || optId === null) return false;
                    return String(optId) === strId;
                } catch (e) { return false; }
            }) || null;
        } catch (e) { return null; }
    }

    /** Process queued EventBus events that arrived before markers were initialized */
    _drainEventQueue() {
        try {
            if (!this._eventQueue || this._eventQueue.length === 0) return;
            const q = this._eventQueue.splice(0, this._eventQueue.length);
            q.forEach(item => {
                try {
                    if (item.type === 'created') {
                        this.addMarker(item.data);
                    } else if (item.type === 'updated') {
                        const id = item.id || item.data?.id;
                        if (id) this.updateMarker(id, item.data);
                    } else if (item.type === 'deleted') {
                        if (item.id) this.removeMarker(item.id);
                    }
                } catch (e) { /* continue */ }
            });
        } catch (e) { /* ignore */ }
    }

    /**
     * Supprime un marker par id
     */
    removeMarker(id) {
        try {
            if (!this.markers || !id) return;
            const layer = this.getLayerById(id);
            if (layer) {
                this.markers.removeLayer(layer);
                try {
                    const el = document.getElementById('mapPointsCount');
                    if (el) el.textContent = `${this.getMarkerCount().toLocaleString()} points affichés`;
                } catch (e) { /* ignore */ }
                try { window.eventBus?.emit?.('map.markers.updated', { count: this.getMarkerCount() }); } catch (e) { /* ignore */ }
            }
        } catch (e) {
            console.error('MapManager.removeMarker erreur:', e);
        }
    }

    /**
     * Zoom to a marker by id
     */
    zoomToMarker(id, zoomLevel = 16) {
        try {
            if (!this.map || !this.markers || !id) return;
            const layer = this.getLayerById(id);
            if (layer) {
                this.map.setView(layer.getLatLng(), zoomLevel);
            }
        } catch (e) { console.error('MapManager.zoomToMarker', e); }
    }

    /**
     * Highlight a marker (temporary visual effect)
     */
    highlightMarker(id, ms = 1200) {
        try {
            if (!this.map || !this.markers || !id) return;
            const layer = this.getLayerById(id);
            if (!layer || !layer._icon) return;

            layer._icon.classList.add('map-marker-highlight');
            setTimeout(() => { try { layer._icon.classList.remove('map-marker-highlight'); } catch (e) { } }, ms);
        } catch (e) { console.error('MapManager.highlightMarker', e); }
    }

    /**
     * Vide tous les markers
     */
    clear() {
        try {
            if (!this.markers) return;
            this.markers.clearLayers();
            try { const el = document.getElementById('mapPointsCount'); if (el) el.textContent = `0 points affichés`; } catch (e) { }
            try { window.eventBus?.emit?.('map.markers.updated', { count: 0 }); } catch (e) { /* ignore */ }
        } catch (e) { console.error('MapManager.clear erreur:', e); }
    }

    /**
     * Retourne le nombre de markers actuels
     */
    getMarkerCount() {
        try {
            if (!this.markers) return 0;
            return this.markers.getLayers().length;
        } catch (e) { return 0; }
    }

    /**
     * Recentre la carte pour englober tous les markers
     */
    fitBoundsToMarkers() {
        try {
            if (!this.map || !this.markers || this.getMarkerCount() === 0) return;
            const bounds = this.markers.getBounds();
            if (bounds.isValid()) {
                this.map.fitBounds(bounds, { padding: [50, 50] });
            }
        } catch (e) {
            console.error('MapManager.fitBoundsToMarkers erreur:', e);
        }
    }

    /** Retourne un objet diagnostique simple */
    diagnostics() {
        try {
            return {
                mapInitialized: !!this.map,
                markers: this.getMarkerCount(),
                heatLayer: !!this.heatLayer
            };
        } catch (e) {
            return { mapInitialized: !!this.map, markers: 0, heatLayer: !!this.heatLayer };
        }
    }

    /**
     * Met à jour la couleur d'un marker existant (par id)
     */
    updateMarkerColor(householdId, newStatus) {
        try {
            if (!this.markers) return;
            const layers = this.markers.getLayers();
            layers.forEach(layer => {
                try {
                    if (layer?.options?._customId === householdId) {
                        const newColor = this.getColor(newStatus);
                        const newIcon = L.divIcon({
                            className: 'custom-flag-marker',
                            html: `
                                <div style="position: relative;">
                                    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
                                        <line x1="5" y1="0" x2="5" y2="40" stroke="#333" stroke-width="2"/>
                                        <path d="M 5 2 L 25 2 L 25 18 L 15 14 L 5 18 Z" fill="${newColor}" stroke="#fff" stroke-width="1.5"/>
                                    </svg>
                                </div>
                            `,
                            iconSize: [30, 40],
                            iconAnchor: [5, 40],
                            popupAnchor: [10, -35]
                        });
                        layer.setIcon(newIcon);
                    }
                } catch (inner) { /* skip marker */ }
            });
        } catch (e) {
            console.error('MapManager.updateMarkerColor erreur:', e);
        }
    }

    getStatusColorClass(status) {
        if (!status) return 'text-gray-500';
        const s = status.toLowerCase();
        if (s.includes('terminé') || s.includes('conforme') || s.includes('ok')) return 'text-green-600 font-bold';
        if (s.includes('cours')) return 'text-orange-600 font-bold';
        if (s.includes('problème') || s.includes('non')) return 'text-red-600 font-bold';
        return 'text-gray-600';
    }

    /**
     * Retourne la couleur hex d'un statut en utilisant StatusMapColors
     * Compatible avec les 9 statuts réels + fallback pour anciens statuts
     */
    getColor(statut) {
        // Utiliser StatusMapColors si disponible (système 9 statuts)
        if (window.StatusMapColors && statut) {
            const color = window.StatusMapColors[statut];
            if (color) {
                return color;
            }
        }

        // Fallback : anciens statuts pour compatibilité
        switch (statut) {
            case 'Terminé':
            case 'Conforme':
                return '#22c55e'; // green-500
            case 'En cours':
            case 'Attente démarrage':
                return '#eab308'; // yellow-500
            case 'Attente Maçon':
                return '#f97316'; // orange-500
            case 'Attente Branchement':
                return '#f59e0b'; // amber-500
            case 'Attente électricien':
                return '#3b82f6'; // blue-500
            case 'Attente Controleur':
                return '#a855f7'; // purple-500
            case 'Attente électricien(X)':
                return '#ec4899'; // pink-500
            case 'Injoignable':
                return '#9ca3af'; // gray-400
            case 'Inéligible':
            case 'Problème':
                return '#ef4444'; // red-500
            default:
                return '#6b7280'; // gray-500 (inconnu)
        }
    }
}

// La classe est exposée globalement
window.MapManager = MapManager;
