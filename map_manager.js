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
        this.routeBtn = null;
        this.routeState = { active: false, points: [], layer: null };
        this._routeClickHandlerBound = false;
        this._eventQueue = [];
        this.heatLayer = null;
        this._visibleStatuses = null; // null = all visible
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

    /** Crée une icône drapeau SVG colorée — méthode unique (évite duplication) */
    _createFlagIcon(color) {
        return L.divIcon({
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
                this.map = L.map('householdMap', { zoomControl: false }).setView([14.7167, -17.4677], 12);

                // Fonds de carte : clair, satellite, sombre
                const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap contributors © CARTO',
                    subdomains: 'abcd',
                    maxZoom: 20
                });
                const satellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                    attribution: '© Google',
                    maxNativeZoom: 20,
                    maxZoom: 22
                });
                const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap contributors © CARTO',
                    subdomains: 'abcd',
                    maxZoom: 20
                });
                light.addTo(this.map);
                L.control.layers({ '☀️ Clair': light, '🛰️ Satellite': satellite, '🌙 Sombre': dark }).addTo(this.map);

                L.control.zoom({ position: 'topright' }).addTo(this.map);
                L.control.scale({ position: 'bottomright', imperial: false }).addTo(this.map);
                if (L.control && L.control.locate) {
                    L.control.locate({
                        position: 'topright',
                        flyTo: true,
                        keepCurrentZoomLevel: true,
                        strings: { title: "Ma position" }
                    }).addTo(this.map);
                }

                // Barre de recherche geocoding (Nominatim)
                this._initGeocoderControl();

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

                // Légende interactive des statuts
                this._initStatusLegend();

                // Dashboard KPI overlay
                this._initKpiDashboard();

                // Barre de gestion des widgets (toggle on/off)
                this._initWidgetManager();

                // Barre d'outils avancée (zones, heatmap, export)
                this._initAdvancedToolbar();

                // Couche des positions d'équipes (inactive par défaut)
                this._initTeamTracker();

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

                // Routing toggle
                const routeBtn = document.getElementById('routeModeBtn');
                if (routeBtn) {
                    this.routeBtn = routeBtn;
                    routeBtn.addEventListener('click', () => {
                        this.routeState.active = !this.routeState.active;
                        this.routeState.points = [];
                        if (this.routeState.layer) {
                            this._clearRouteLayer();
                        }
                        routeBtn.classList.toggle('bg-emerald-600', this.routeState.active);
                        routeBtn.classList.toggle('text-white', this.routeState.active);
                        routeBtn.innerHTML = this.routeState.active ? '<i class="fas fa-route mr-1"></i>Tracer (2 points)'
                            : '<i class="fas fa-route mr-1"></i>Itinéraire';
                        this._notifyRoute(this.routeState.active ? 'Mode itinéraire activé : cliquez deux points ou deux ménages.' : 'Mode itinéraire désactivé.');
                    });
                    if (!this._routeClickHandlerBound) {
                        this.map.on('click', (e) => {
                            if (this.routeState.active) this._handleRouteClick([e.latlng.lat, e.latlng.lng], routeBtn);
                        });
                        this._routeClickHandlerBound = true;
                    }
                }

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

        let project = null;
        try {
            if (window.ProjectRepository) {
                project = await window.ProjectRepository.getCurrent();
            }
        } catch (e) {
            console.warn('🗺️ [MapManager] Failed to get current project:', e);
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
                                    sub_grappe_id: m.sous_grappe || m.sub_grappe_id,
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
                            sub_grappe_id: h.sub_grappe_id ?? h.sous_grappe ?? h._legacy?.sous_grappe ?? null,
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
                    const statut = m.Statut_Installation || m.statut_installation || m.status || m.statut || '';
                    const color = this.getColor(statut);
                    const icon = this._createFlagIcon(color);

                    const marker = L.marker([lat, lon], { icon: icon, _customId: (m.id !== undefined && m.id !== null) ? m.id : undefined, _status: statut, _ownerName: m.nom_prenom_chef || '' });

                    // Interaction : Clic pour sélectionner
                    marker.on('click', (e) => {
                        try {
                            if (this.routeState?.active) {
                                this._handleRouteClick([lat, lon]);
                                L.DomEvent.stopPropagation(e);
                                return;
                            }
                            // Le popup s'ouvre naturellement via bindPopup
                            // Le bouton "Détails" dans le popup gère selectHousehold
                        } catch (e) {
                            console.error("Erreur lors du clic sur le marqueur:", e);
                        }
                    });

                    // Tooltip léger au survol
                    marker.bindTooltip(`${m.id} - ${m.nom_prenom_chef}`, {
                        direction: 'top',
                        offset: [0, -5]
                    });

                    // Popup détaillé au clic (enrichi avec actions)
                    const popupHtml = this._buildPopupHtml({ id: m.id, owner: m.nom_prenom_chef, status: statut, lat, lon, color, sub_grappe_id: m.sub_grappe_id, project });
                    marker.bindPopup(popupHtml, { maxWidth: 320 });

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
            // Rafraîchir dashboard KPI
            try { this._updateKpiDashboard(); } catch (e) { /* ignore */ }

            // Ajuster la vue
            if (points.length > 0) {
                const bounds = L.latLngBounds(points);
                this.map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });
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
                this.map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });
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

    /** Rend un panneau déplaçable par son header + sauvegarde position (localStorage) */
    _makeDraggable(panel, handle) {
        if (!panel || !handle) return;
        handle.style.cursor = 'grab';
        let isDragging = false, startX, startY, startLeft, startTop;

        // Restaurer position sauvegardée
        const panelId = panel.id || panel.dataset.widgetId || '';
        if (panelId) {
            try {
                const saved = localStorage.getItem('widget_pos_' + panelId);
                if (saved) {
                    const pos = JSON.parse(saved);
                    panel.style.left = pos.left + 'px';
                    panel.style.top = pos.top + 'px';
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                    panel.style.transform = 'none';
                }
            } catch (e) { /* ignore */ }
        }

        const onStart = (e) => {
            if (e.target.closest('button, input, select, a, label')) return;
            isDragging = true;
            handle.style.cursor = 'grabbing';
            const ev = e.touches ? e.touches[0] : e;
            startX = ev.clientX;
            startY = ev.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.transition = 'none';
            e.preventDefault();
        };

        const onMove = (e) => {
            if (!isDragging) return;
            const ev = e.touches ? e.touches[0] : e;
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            panel.style.left = (startLeft + dx) + 'px';
            panel.style.top = (startTop + dy) + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.transform = 'none';
        };

        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            handle.style.cursor = 'grab';
            panel.style.transition = '';
            // Sauvegarder la position
            if (panelId) {
                try {
                    const rect = panel.getBoundingClientRect();
                    const containerRect = panel.parentElement ? panel.parentElement.getBoundingClientRect() : { left: 0, top: 0 };
                    localStorage.setItem('widget_pos_' + panelId, JSON.stringify({
                        left: rect.left - containerRect.left,
                        top: rect.top - containerRect.top
                    }));
                } catch (e) { /* ignore */ }
            }
        };

        handle.addEventListener('mousedown', onStart);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        handle.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    }

    _clearRouteLayer() {
        if (this.routeState.layer && this.map) {
            try { this.map.removeControl(this.routeState.layer); } catch (e) { /* ignore */ }
            try { this.map.removeLayer(this.routeState.layer); } catch (e) { /* ignore */ }
        }
        this.routeState.layer = null;
        // Nettoyer le panneau d'instructions
        try { const p = document.getElementById('routeInstructionsPanel'); if (p) p.remove(); } catch (e) { /* ignore */ }
    }

    async _handleRouteClick(latlngArr, routeBtn) {
        if (!this.routeState.active) return;
        this.routeState.points.push(latlngArr);
        this._notifyRoute(`Point ${this.routeState.points.length} enregistré`);
        if (this.routeState.points.length < 2) return;

        const [a, b] = this.routeState.points;
        this.routeState.points = [];
        this.routeState.active = false;
        const btn = routeBtn || this.routeBtn;
        if (btn) {
            btn.classList.remove('bg-emerald-600', 'text-white');
            btn.innerHTML = '<i class="fas fa-route mr-1"></i>Itinéraire';
        }

        await this._drawRoute(a, b);
    }

    async _drawRoute(a, b, profile) {
        this._clearRouteLayer();
        if (!L.Routing || !L.Routing.control) {
            this._notifyRoute('Routing indisponible (lib manquante)');
            return;
        }

        // Stocker pour recalcul avec un autre mode
        this._lastRouteEndpoints = { a, b };
        const routeProfile = profile || this._routeProfile || 'driving';
        this._routeProfile = routeProfile;
        const osrmProfile = routeProfile === 'foot' ? 'foot' : 'car';
        const profileLabel = routeProfile === 'foot' ? '🚶 À pied' : '🚗 En voiture';

        try {
            // Fermer le popup pour libérer la vue
            this.map.closePopup();

            // Configurer le routeur OSRM en français avec le bon profil
            const router = L.Routing.osrmv1
                ? new L.Routing.osrmv1({
                    language: 'fr',
                    profile: osrmProfile,
                    serviceUrl: 'https://router.project-osrm.org/route/v1'
                })
                : undefined;

            const routeOptions = {
                waypoints: [
                    L.latLng(a[0], a[1]),
                    L.latLng(b[0], b[1])
                ],
                routeWhileDragging: false,
                showAlternatives: false,
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: true,
                show: false,
                collapsible: true,
                language: 'fr',
                lineOptions: {
                    styles: [
                        { color: routeProfile === 'foot' ? '#7c3aed' : '#1e40af', weight: 8, opacity: 0.3 },
                        { color: routeProfile === 'foot' ? '#a78bfa' : '#3b82f6', weight: 5, opacity: 0.9 }
                    ]
                },
                createMarker: (i, wp, nWps) => {
                    const isStart = (i === 0);
                    return L.marker(wp.latLng, {
                        icon: L.divIcon({
                            className: 'route-endpoint',
                            html: `<div style="background:${isStart ? '#22c55e' : '#ef4444'};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;">${isStart ? '🟢' : '🏁'}</div>`,
                            iconSize: [28, 28],
                            iconAnchor: [14, 14]
                        })
                    });
                }
            };
            if (router) routeOptions.router = router;

            this.routeState.layer = L.Routing.control(routeOptions).addTo(this.map);

            // Écouter les résultats pour afficher les instructions
            this.routeState.layer.on('routesfound', (e) => {
                const route = e.routes[0];
                // Traduire les instructions si encore en anglais
                if (route.instructions) {
                    route.instructions = route.instructions.map(inst => ({
                        ...inst,
                        text: this._translateInstruction(inst.text || '')
                    }));
                }
                this._showRouteInstructions(route, profileLabel);
                this._notifyRoute('Itinéraire calculé');
            });

            this.routeState.layer.on('routingerror', (e) => {
                console.error('Routing error:', e);
                this._notifyRoute('Erreur calcul itinéraire');
            });

        } catch (e) {
            console.error('Routing error:', e);
            this._notifyRoute('Erreur calcul itinéraire');
        }
    }

    /** Affiche les instructions de route dans un panneau latéral */
    _showRouteInstructions(route, modeLabel) {
        // Supprimer ancien panneau
        const existing = document.getElementById('routeInstructionsPanel');
        if (existing) existing.remove();

        const totalDistKm = route.summary.totalDistance / 1000;
        const totalDist = totalDistKm.toFixed(1);
        const currentMode = this._routeProfile || 'driving';
        const isFootActive = currentMode === 'foot';

        // OSRM public ne supporte que le profil voiture → recalculer le temps pour piéton
        // Vitesse moyenne : voiture ~50 km/h (OSRM natif), piéton ~5 km/h
        let totalTime;
        if (isFootActive) {
            totalTime = Math.round((totalDistKm / 5) * 60); // 5 km/h à pied
        } else {
            totalTime = Math.round(route.summary.totalTime / 60); // temps OSRM
        }
        const timeLabel = totalTime >= 60 ? `${Math.floor(totalTime / 60)}h${String(totalTime % 60).padStart(2, '0')}` : `${totalTime} min`;

        const stepsHtml = route.instructions ? route.instructions.map((inst, i) => {
            const dist = inst.distance > 0 ? `<span style="color:#94a3b8;margin-left:auto;white-space:nowrap;">${inst.distance >= 1000 ? (inst.distance / 1000).toFixed(1) + ' km' : Math.round(inst.distance) + ' m'}</span>` : '';
            const icon = this._getRouteIcon(inst.type);
            return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <span style="width:24px;height:24px;border-radius:50%;background:#eff6ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:#3b82f6;">${icon}</span>
                <span style="flex:1;font-size:12px;color:#334155;">${inst.text || inst.road || 'Continuer'}</span>
                ${dist}
            </div>`;
        }).join('') : '<div style="padding:8px;color:#94a3b8;font-size:12px;">Pas d\'instructions détaillées disponibles</div>';

        const panel = document.createElement('div');
        panel.id = 'routeInstructionsPanel';
        panel.style.cssText = 'position:absolute;top:10px;right:10px;width:320px;max-height:calc(100% - 20px);background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);font-family:Inter,sans-serif;z-index:1000;display:flex;flex-direction:column;overflow:hidden;';

        panel.innerHTML = `
            <div style="padding:14px 16px;background:linear-gradient(135deg,${isFootActive ? '#7c3aed,#5b21b6' : '#3b82f6,#1d4ed8'});color:#fff;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:700;font-size:14px;">${modeLabel || '🗺️ Itinéraire'}</span>
                    <button id="closeRoutePanel" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">✕</button>
                </div>
                <div style="display:flex;gap:16px;margin-top:8px;font-size:13px;">
                    <span>📏 ${totalDist} km</span>
                    <span>⏱️ ${timeLabel}</span>
                </div>
                <div style="display:flex;gap:6px;margin-top:10px;">
                    <button id="routeModeCar" style="flex:1;padding:5px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;${!isFootActive ? 'background:#fff;color:#1d4ed8;' : 'background:rgba(255,255,255,0.2);color:#fff;'}">🚗 Voiture</button>
                    <button id="routeModeFoot" style="flex:1;padding:5px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;${isFootActive ? 'background:#fff;color:#5b21b6;' : 'background:rgba(255,255,255,0.2);color:#fff;'}">🚶 À pied</button>
                </div>
            </div>
            <div style="overflow-y:auto;flex:1;padding:8px 14px;">
                ${stepsHtml}
            </div>
            <div style="padding:10px 14px;border-top:1px solid #e5e7eb;">
                <button id="clearRouteBtn" style="width:100%;padding:8px;border-radius:8px;background:#fee2e2;color:#dc2626;font-weight:600;font-size:12px;border:none;cursor:pointer;">✕ Fermer l'itinéraire</button>
            </div>
        `;

        // Insérer dans le conteneur de la carte
        const mapContainer = this.map.getContainer();
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(panel);
        this._makeDraggable(panel, panel.querySelector('div'));

        // Événements — fermeture
        document.getElementById('closeRoutePanel').addEventListener('click', () => {
            this._clearRouteLayer();
            panel.remove();
        });
        document.getElementById('clearRouteBtn').addEventListener('click', () => {
            this._clearRouteLayer();
            panel.remove();
        });

        // Événements — changement de mode
        document.getElementById('routeModeCar').addEventListener('click', () => {
            if (this._lastRouteEndpoints) {
                this._drawRoute(this._lastRouteEndpoints.a, this._lastRouteEndpoints.b, 'driving');
            }
        });
        document.getElementById('routeModeFoot').addEventListener('click', () => {
            if (this._lastRouteEndpoints) {
                this._drawRoute(this._lastRouteEndpoints.a, this._lastRouteEndpoints.b, 'foot');
            }
        });
    }

    /** Retourne l'icône appropriée pour un type d'instruction de route */
    _getRouteIcon(type) {
        const icons = {
            'Left': '<i class="fas fa-arrow-left"></i>',
            'Right': '<i class="fas fa-arrow-right"></i>',
            'SlightLeft': '<i class="fas fa-arrow-left" style="transform:rotate(30deg);"></i>',
            'SlightRight': '<i class="fas fa-arrow-right" style="transform:rotate(-30deg);"></i>',
            'SharpLeft': '<i class="fas fa-arrow-left" style="transform:rotate(-30deg);"></i>',
            'SharpRight': '<i class="fas fa-arrow-right" style="transform:rotate(30deg);"></i>',
            'Straight': '<i class="fas fa-arrow-up"></i>',
            'WaypointReached': '<i class="fas fa-map-pin"></i>',
            'DestinationReached': '<i class="fas fa-flag-checkered"></i>',
            'Head': '<i class="fas fa-play"></i>',
            'Roundabout': '<i class="fas fa-sync-alt"></i>'
        };
        return icons[type] || '<i class="fas fa-arrow-up"></i>';
    }

    /** Traduit une instruction de route OSRM de l'anglais vers le français */
    _translateInstruction(text) {
        if (!text) return 'Continuer';
        // Si déjà en français (contient des mots FR typiques)
        if (/Tournez|Continuez|Dirigez|Arrivée|rond-point/i.test(text)) return text;

        let t = text;
        // Directions de base
        t = t.replace(/\bHead\b/gi, 'Dirigez-vous');
        t = t.replace(/\bGo straight\b/gi, 'Continuez tout droit');
        t = t.replace(/\bContinue straight\b/gi, 'Continuez tout droit');
        t = t.replace(/\bContinue\b/gi, 'Continuez');
        t = t.replace(/\bTurn right onto\b/gi, 'Tournez à droite sur');
        t = t.replace(/\bTurn left onto\b/gi, 'Tournez à gauche sur');
        t = t.replace(/\bTurn right\b/gi, 'Tournez à droite');
        t = t.replace(/\bTurn left\b/gi, 'Tournez à gauche');
        t = t.replace(/\bMake a slight right\b/gi, 'Légèrement à droite');
        t = t.replace(/\bMake a slight left\b/gi, 'Légèrement à gauche');
        t = t.replace(/\bMake a sharp right\b/gi, 'Virage serré à droite');
        t = t.replace(/\bMake a sharp left\b/gi, 'Virage serré à gauche');
        t = t.replace(/\bKeep right\b/gi, 'Serrez à droite');
        t = t.replace(/\bKeep left\b/gi, 'Serrez à gauche');
        t = t.replace(/\bMerge\b/gi, 'Rejoindre');
        t = t.replace(/\bEnter the roundabout\b/gi, 'Entrez dans le rond-point');
        t = t.replace(/\bAt the roundabout\b/gi, 'Au rond-point');
        t = t.replace(/\btake the (\d+)\w+ exit\b/gi, 'prenez la $1ᵉ sortie');
        t = t.replace(/\bYou have arrived at your destination\b/gi, 'Vous êtes arrivé à destination');
        t = t.replace(/\bArrived\b/gi, 'Arrivée');
        t = t.replace(/\bDestination reached\b/gi, 'Destination atteinte');
        // Points cardinaux
        t = t.replace(/\bnorth\b/gi, 'le nord');
        t = t.replace(/\bsouth\b/gi, 'le sud');
        t = t.replace(/\beast\b/gi, "l'est");
        t = t.replace(/\bwest\b/gi, "l'ouest");
        t = t.replace(/\bnortheast\b/gi, 'le nord-est');
        t = t.replace(/\bnorthwest\b/gi, 'le nord-ouest');
        t = t.replace(/\bsoutheast\b/gi, 'le sud-est');
        t = t.replace(/\bsouthwest\b/gi, 'le sud-ouest');
        // Prépositions
        t = t.replace(/\bonto\b/gi, 'sur');
        t = t.replace(/\bon\b/gi, 'sur');
        t = t.replace(/\btoward\b/gi, 'vers');
        t = t.replace(/\btowards\b/gi, 'vers');
        return t;
    }

    _notifyRoute(msg) {
        if (window.Swal) {
            Swal.fire({ toast: true, position: 'top-end', timer: 2500, showConfirmButton: false, icon: 'info', title: msg });
        } else {
            console.log('[Route]', msg);
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
            const icon = this._createFlagIcon(color);

            const marker = L.marker([parsedLat, parsedLon], { icon, _customId: id, _status: status || '', _ownerName: '' });
            if (owner) marker.bindTooltip(`${id} - ${owner}`, { direction: 'top', offset: [0, -5] });

            // Popup détaillé (enrichi avec actions)
            const popupHtml = this._buildPopupHtml({ id, owner, status, lat: parsedLat, lon: parsedLon, color });
            marker.bindPopup(popupHtml, { maxWidth: 320 });
            marker.on('click', (e) => {
                if (this.routeState?.active) {
                    this._handleRouteClick([parsedLat, parsedLon]);
                    L.DomEvent.stopPropagation(e);
                    return;
                }
                // Le popup s'ouvre naturellement via bindPopup
            });
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
                if (bounds && bounds.isValid()) this.map.flyToBounds(bounds, { padding: [50, 50] });
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
                    const newIcon = this._createFlagIcon(color);
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
            // update UI count after processing
            try { const el = document.getElementById('mapPointsCount'); if (el) el.textContent = `${this.getMarkerCount().toLocaleString()} points affichés`; } catch (e) { }
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
                this.map.flyTo(layer.getLatLng(), zoomLevel, { duration: 1 });
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
                this.map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });
            }
        } catch (e) {
            console.error('MapManager.fitBoundsToMarkers erreur:', e);
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
                        const newIcon = this._createFlagIcon(newColor);
                        layer.setIcon(newIcon);
                        // Mettre à jour le statut interne pour le KPI/Pipeline
                        layer.options._status = newStatus;
                    }
                } catch (inner) { /* skip marker */ }
            });
            // Synchroniser le KPI dashboard
            this._updateKpiDashboard();
        } catch (e) {
            console.error('MapManager.updateMarkerColor erreur:', e);
        }
    }

    /** Barre de recherche geocoding personnalisée (Nominatim/OSM) */
    _initGeocoderControl() {
        if (!this.map) return;
        const self = this;
        const GeocoderControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-geocoder-control');
                container.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;padding:0;overflow:visible;position:relative;';
                const input = L.DomUtil.create('input', '', container);
                input.type = 'text';
                input.placeholder = 'N° ordre, nom ou lieu...';
                input.style.cssText = 'border:none;outline:none;padding:8px 12px;font-size:13px;width:220px;font-family:Inter,sans-serif;border-radius:8px 0 0 8px;';
                const btn = L.DomUtil.create('button', '', container);
                btn.innerHTML = '<i class="fas fa-search"></i>';
                btn.style.cssText = 'border:none;background:#667eea;color:#fff;padding:8px 12px;cursor:pointer;font-size:13px;border-radius:0 8px 8px 0;';
                btn.title = 'Rechercher';

                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);

                const resultsList = L.DomUtil.create('div', '', container);
                resultsList.style.cssText = 'position:absolute;top:100%;left:0;width:100%;background:#fff;border-radius:0 0 8px 8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-height:300px;overflow-y:auto;display:none;z-index:10000;';

                const doSearch = async () => {
                    const q = input.value.trim();
                    if (!q) return;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    resultsList.innerHTML = '';

                    // 1) Recherche locale dans les ménages (par ID ou nom)
                    const qLower = q.toLowerCase();
                    const allMarkers = self._allMarkersCache || [];
                    const localResults = [];
                    const markersPool = allMarkers.length ? allMarkers : (self.markers ? (() => { const arr = []; self.markers.eachLayer(l => arr.push(l)); return arr; })() : []);
                    markersPool.forEach(layer => {
                        const id = String(layer?.options?._customId || '').toLowerCase();
                        const name = String(layer?.options?._ownerName || '').toLowerCase();
                        if (id.includes(qLower) || name.includes(qLower)) {
                            localResults.push(layer);
                        }
                    });

                    if (localResults.length > 0) {
                        const header = document.createElement('div');
                        header.style.cssText = 'padding:4px 12px;font-size:10px;font-weight:700;color:#6366f1;background:#f5f3ff;text-transform:uppercase;letter-spacing:.5px;';
                        header.textContent = '\u{1F4CD} M\u00e9nages (' + localResults.length + ')';
                        resultsList.appendChild(header);

                        localResults.slice(0, 10).forEach(layer => {
                            const ll = layer.getLatLng();
                            const id = layer?.options?._customId || '?';
                            const name = layer?.options?._ownerName || '';
                            const status = layer?.options?._status || '';
                            const color = self.getColor(status);
                            const item = document.createElement('div');
                            item.style.cssText = 'padding:6px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid #f1f5f9;color:#334155;display:flex;align-items:center;gap:6px;';
                            item.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0;"></span><span><strong>' + id + '</strong>' + (name ? ' \u2014 ' + name : '') + '</span>';
                            item.addEventListener('mouseenter', () => { item.style.background = '#f5f3ff'; });
                            item.addEventListener('mouseleave', () => { item.style.background = '#fff'; });
                            item.addEventListener('click', () => {
                                // S'assurer que le marker est dans le cluster group
                                if (self.markers && !self.markers.hasLayer(layer)) {
                                    self.markers.addLayer(layer);
                                }
                                // zoomToShowLayer dégroupe le cluster, centre et ouvre le popup
                                if (self.markers && typeof self.markers.zoomToShowLayer === 'function') {
                                    self.markers.zoomToShowLayer(layer, () => {
                                        setTimeout(() => { try { layer.openPopup(); } catch { } }, 200);
                                    });
                                } else {
                                    self.map.flyTo(ll, 18, { duration: 1 });
                                    setTimeout(() => { try { layer.openPopup(); } catch { } }, 1200);
                                }
                                resultsList.style.display = 'none';
                                input.value = id + (name ? ' \u2014 ' + name : '');
                            });
                            resultsList.appendChild(item);
                        });
                    }

                    // 2) Recherche Nominatim (géo)
                    try {
                        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`);
                        const results = await resp.json();
                        if (results.length > 0) {
                            const geoHeader = document.createElement('div');
                            geoHeader.style.cssText = 'padding:4px 12px;font-size:10px;font-weight:700;color:#3b82f6;background:#eff6ff;text-transform:uppercase;letter-spacing:.5px;';
                            geoHeader.textContent = '\u{1F30D} Lieux';
                            resultsList.appendChild(geoHeader);

                            results.forEach(r => {
                                const item = document.createElement('div');
                                item.style.cssText = 'padding:6px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid #f1f5f9;color:#334155;';
                                item.textContent = r.display_name.substring(0, 80);
                                item.addEventListener('mouseenter', () => { item.style.background = '#eff6ff'; });
                                item.addEventListener('mouseleave', () => { item.style.background = '#fff'; });
                                item.addEventListener('click', () => {
                                    self.map.flyTo([parseFloat(r.lat), parseFloat(r.lon)], 17, { duration: 1.2 });
                                    resultsList.style.display = 'none';
                                    input.value = r.display_name.substring(0, 40);
                                });
                                resultsList.appendChild(item);
                            });
                        }
                    } catch (e) {
                        console.error('Geocoder error:', e);
                    }

                    if (resultsList.children.length === 0) {
                        resultsList.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:#94a3b8;">Aucun r\u00e9sultat</div>';
                    }
                    resultsList.style.display = 'block';
                    btn.innerHTML = '<i class="fas fa-search"></i>';
                };

                btn.addEventListener('click', doSearch);
                input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
                document.addEventListener('click', (e) => {
                    if (!container.contains(e.target)) resultsList.style.display = 'none';
                });

                return container;
            }
        });
        new GeocoderControl().addTo(this.map);
    }

    /** Constantes de couleur du pipeline métier */
    static get PIPELINE_STATUS_DEFS() {
        return [
            { value: 'Non débuté', label: 'Non débuté', color: '#94a3b8', icon: '⚪' },
            { value: 'Murs: En cours', label: 'Murs: En cours', color: '#eab308', icon: '🟡' },
            { value: 'Murs: Terminé', label: 'Murs: Terminé', color: '#f59e0b', icon: '🟠' },
            { value: 'Réseau: En cours', label: 'Réseau: En cours', color: '#3b82f6', icon: '🔵' },
            { value: 'Réseau: Terminé', label: 'Réseau: Terminé', color: '#2563eb', icon: '🔵' },
            { value: 'Intérieur: En cours', label: 'Intérieur: En cours', color: '#8b5cf6', icon: '🟣' },
            { value: 'Intérieur: Terminé', label: 'Intérieur: Terminé', color: '#7c3aed', icon: '🟣' },
            { value: 'Réception: Validée', label: 'Réception: Validée', color: '#22c55e', icon: '🟢' },
            { value: 'Problème', label: 'Problème', color: '#ef4444', icon: '🔴' },
            { value: 'Inéligible', label: 'Inéligible', color: '#1e293b', icon: '⚫' }
        ];
    }

    /** Légende interactive des statuts — draggable + minimisable */
    _initStatusLegend() {
        if (!this.map) return;
        const self = this;
        const normalize = window.normalizeStatus || (s => s);

        // Use a simplified set of status definitions for the legend
        const legendStatusDefs = [
            {
                id: 'all',
                label: 'Toutes',
                color: '#6366f1',
                checked: true
            },
            {
                id: normalize('Non débuté'),
                label: 'Non débuté',
                color: '#94a3b8',
                checked: true
            },
            {
                id: normalize('Murs: En cours'),
                label: 'Murs',
                color: '#fbbf24',
                checked: true
            },
            {
                id: normalize('Réseau: En cours'),
                label: 'Réseau',
                color: '#3b82f6',
                checked: true
            },
            {
                id: normalize('Intérieur: En cours'),
                label: 'Intérieur',
                color: '#8b5cf6',
                checked: true
            },
            {
                id: normalize('Réception: Validée'),
                label: 'Terminé',
                color: '#10b981',
                checked: true
            },
            {
                id: normalize('Problème'),
                label: 'Alertes/Bloqué',
                color: '#ef4444',
                checked: true
            }
        ];

        const mapC = this.map.getContainer();

        const panel = document.createElement('div');
        panel.id = 'widgetLegend';
        panel.className = 'map-widget';
        panel.style.cssText = 'position:absolute;bottom:20px;left:10px;background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.12);font-family:Inter,sans-serif;font-size:11px;max-width:220px;z-index:800;overflow:hidden;';

        // Header drag handle
        const hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;cursor:grab;user-select:none;';
        hdr.innerHTML = '<span style="font-weight:700;font-size:11px;">🔧 Pipeline Travaux</span>';
        const minBtn = document.createElement('button');
        minBtn.textContent = '−';
        minBtn.style.cssText = 'background:rgba(255,255,255,0.25);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;';
        hdr.appendChild(minBtn);
        panel.appendChild(hdr);

        // Body
        const body = document.createElement('div');
        body.style.cssText = 'padding:8px 12px;';

        const toggleAll = document.createElement('button');
        toggleAll.textContent = 'Tout';
        toggleAll.style.cssText = 'font-size:10px;padding:2px 6px;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;background:#f8fafc;color:#475569;margin-bottom:4px;';
        body.appendChild(toggleAll);

        let allChecked = true;
        const checkboxes = [];

        legendStatusDefs.forEach(sd => {
            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:5px;cursor:pointer;padding:2px 0;color:#475569;';
            const cb = document.createElement('input');
            cb.type = 'checkbox'; cb.checked = sd.checked; cb.dataset.statusValue = sd.id;
            cb.style.cssText = `accent-color:${sd.color};width:13px;height:13px;flex-shrink:0;`;
            checkboxes.push(cb);
            row.appendChild(cb);
            const dot = document.createElement('span');
            dot.style.cssText = `display:inline-block;width:9px;height:9px;border-radius:50%;background:${sd.color};flex-shrink:0;`;
            row.appendChild(dot);
            row.appendChild(document.createTextNode(' ' + sd.label));
            body.appendChild(row);

            cb.addEventListener('change', () => {
                if (sd.id === 'all') {
                    allChecked = cb.checked;
                    checkboxes.filter(c => c.dataset.statusValue !== 'all').forEach(c => { c.checked = allChecked; });
                } else {
                    const allCheckbox = checkboxes.find(c => c.dataset.statusValue === 'all');
                    if (!cb.checked) {
                        allChecked = false;
                        if (allCheckbox) allCheckbox.checked = false;
                    } else {
                        const allOthersChecked = checkboxes.filter(c => c.dataset.statusValue !== 'all').every(c => c.checked);
                        if (allOthersChecked) {
                            allChecked = true;
                            if (allCheckbox) allCheckbox.checked = true;
                        }
                    }
                }
                const checkedStatuses = checkboxes.filter(c => c.checked && c.dataset.statusValue !== 'all').map(c => c.dataset.statusValue);
                self._visibleStatuses = allChecked ? null : new Set(checkedStatuses);
                self.filterByStatuses();
                self._updateKpiDashboard();
                toggleAll.textContent = allChecked ? 'Aucun' : 'Tout';
            });
        });

        toggleAll.addEventListener('click', () => {
            allChecked = !allChecked;
            checkboxes.forEach(cb => { cb.checked = allChecked; });
            self._visibleStatuses = allChecked ? null : new Set();
            self.filterByStatuses();
            self._updateKpiDashboard();
            toggleAll.textContent = allChecked ? 'Aucun' : 'Tout';
        });

        panel.appendChild(body);
        mapC.appendChild(panel);
        this._makeDraggable(panel, hdr);
        this._widgetLegend = panel;

        let mini = false;
        minBtn.addEventListener('click', (e) => { e.stopPropagation(); mini = !mini; body.style.display = mini ? 'none' : ''; minBtn.textContent = mini ? '+' : '−'; });

        // Stop map click propagation
        panel.addEventListener('mousedown', (e) => e.stopPropagation());
        panel.addEventListener('dblclick', (e) => e.stopPropagation());
    }

    /** Applique le filtre de statut aux markers affichés (compatible clusters) */
    filterByStatuses() {
        if (!this.markers) return;
        const normalize = window.normalizeStatus || (s => s);
        try {
            // Cache tous les marqueurs la première fois
            if (!this._allMarkersCache) {
                this._allMarkersCache = [];
                this.markers.eachLayer(l => this._allMarkersCache.push(l));
            }

            // Pas de filtre → tout afficher
            if (!this._visibleStatuses) {
                this.markers.clearLayers();
                this._allMarkersCache.forEach(l => this.markers.addLayer(l));
                return;
            }

            // Séparer visible / caché
            const toShow = [];
            const toHide = [];
            this._allMarkersCache.forEach(layer => {
                const rawStatus = layer?.options?._status || '';
                const ns = normalize(rawStatus);
                if (this._visibleStatuses.has(ns)) {
                    toShow.push(layer);
                } else {
                    toHide.push(layer);
                }
            });

            // Retirer les cachés, ajouter les visibles
            this.markers.clearLayers();
            toShow.forEach(l => this.markers.addLayer(l));
        } catch (e) { console.error('filterByStatuses error:', e); }
    }

    /** Sauvegarde un changement de statut dans l'historique (localStorage) */
    _saveStatusHistory(id, oldStatus, newStatus) {
        try {
            const key = 'status_history_' + id;
            const history = JSON.parse(localStorage.getItem(key) || '[]');
            history.push({ from: oldStatus, to: newStatus, date: new Date().toISOString() });
            // Garder les 20 derniers
            if (history.length > 20) history.splice(0, history.length - 20);
            localStorage.setItem(key, JSON.stringify(history));
        } catch (e) { /* ignore */ }
    }

    /** Génère le HTML de l'historique des statuts pour le popup */
    _getStatusHistoryHtml(id) {
        try {
            const history = JSON.parse(localStorage.getItem('status_history_' + id) || '[]');
            if (!history.length) return '';
            const rows = history.slice().reverse().slice(0, 5).map(h => {
                const d = new Date(h.date);
                const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                return `<div style="display:flex;align-items:flex-start;gap:6px;padding:2px 0;">
                    <div style="width:6px;height:6px;border-radius:50%;background:#4f46e5;margin-top:4px;flex-shrink:0;"></div>
                    <div style="font-size:10px;"><span style="color:#64748b;">${dateStr}</span><br/><span style="text-decoration:line-through;color:#94a3b8;">${h.from}</span> → <strong>${h.to}</strong></div>
                </div>`;
            }).join('');
            return `<details style="margin-top:6px;">
                <summary style="font-size:10px;color:#6366f1;cursor:pointer;font-weight:600;">📜 Historique (${history.length})</summary>
                <div style="margin-top:4px;border-left:2px solid #e0e7ff;padding-left:8px;">${rows}</div>
            </details>`;
        } catch { return ''; }
    }

    /** Construit le HTML enrichi d'un popup de marqueur */
    _buildPopupHtml({ id, owner, status, lat, lon, color, sub_grappe_id, project }) {
        const safeName = (typeof DOMPurify !== 'undefined' && DOMPurify) ? DOMPurify.sanitize(owner || '') : (owner || '');
        const normalize = window.normalizeStatus || (s => s);
        const normalizedStatus = normalize(status);

        // Fetch assignments from project index
        let assignmentsHtml = '';
        if (project && project.index && project.index.bySubGrappe && sub_grappe_id) {
            const assignments = project.index.bySubGrappe[sub_grappe_id];
            if (assignments && assignments.length > 0) {
                // Determine team types from window.TeamRegistry if available
                const registry = window.TeamRegistry || {
                    getType: (t) => ({ label: t, icon: '👷' })
                };

                const teamsHtml = assignments.map(a => {
                    const t = registry.getType(a.team_type);
                    return `<div style="display:inline-flex;align-items:center;background:#f8fafc;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-size:10px;margin-right:4px;margin-bottom:4px;color:#475569;">
                        <span style="margin-right:4px;">${t.icon}</span>
                        <span>${t.label}: <strong>${a.team_name}</strong></span>
                    </div>`;
                }).join('');

                assignmentsHtml = `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0;">
                    <div style="font-size:10px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;">Équipes Assignées (${sub_grappe_id})</div>
                    <div style="display:flex;flex-wrap:wrap;">${teamsHtml}</div>
                </div>`;
            } else {
                assignmentsHtml = `<div style="margin-top:8px;font-size:10px;color:#94a3b8;font-style:italic;">Aucune équipe (Zone: ${sub_grappe_id})</div>`;
            }
        }

        // Transitions valides pour ce statut
        let transitionOptions = '';
        if (window.VALID_STATUS_TRANSITIONS && window.VALID_STATUS_TRANSITIONS[normalizedStatus]) {
            const validNext = window.VALID_STATUS_TRANSITIONS[normalizedStatus];
            if (validNext.length > 0) {
                transitionOptions = validNext.map(s => {
                    const sColor = this.getColor(s);
                    return `<option value="${s}" style="color:${sColor};">${s}</option>`;
                }).join('');
            }
        }

        const changeStatusHtml = transitionOptions
            ? `<div style="margin-top:8px;">
                 <select onchange="if(this.value && window.eventBus){var old=this.closest('.leaflet-popup-content').querySelector('.mm-badge').textContent;window.eventBus.emit('household.status.changed',{householdId:'${id}',newStatus:this.value});this.closest('.leaflet-popup-content').querySelector('.mm-badge').textContent=this.value;var mgr=window.__mapManagerInstance||window.mapManager;if(mgr){mgr.updateMarkerColor('${id}',this.value);mgr._saveStatusHistory('${id}',old,this.value);}this.value='';}" style="width:100%;padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;color:#475569;cursor:pointer;">
                   <option value="">📝 Changer statut…</option>
                   ${transitionOptions}
                 </select>
               </div>`
            : '';

        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
        const historyHtml = this._getStatusHistoryHtml(id);

        return `
            <div style="min-width:220px;font-family:Inter,sans-serif;">
                <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#1e293b;">${safeName || 'Sans nom'}</div>
                <div style="font-size:11px;color:#64748b;margin-bottom:6px;">ID: ${id || '—'}</div>
                <div class="mm-badge" style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;color:#fff;background:${color};">${normalizedStatus || 'Inconnu'}</div>
                <div style="margin-top:8px;font-size:11px;color:#64748b;"><i class='fas fa-map-pin' style='margin-right:4px;'></i>${parseFloat(lat).toFixed(5)}, ${parseFloat(lon).toFixed(5)}</div>
                ${assignmentsHtml}
                ${changeStatusHtml}
                ${historyHtml}
                <div style="display:flex;gap:5px;margin-top:8px;">
                    <button onclick="(function(b){b.textContent='⏳';if(!navigator.geolocation){alert('Géolocalisation non disponible');b.textContent='🗺️ Itinéraire';return;}navigator.geolocation.getCurrentPosition(function(pos){var mgr=window.__mapManagerInstance||window.mapManager;if(mgr&&mgr._drawRoute){mgr._drawRoute([pos.coords.latitude,pos.coords.longitude],[${lat},${lon}]);}b.textContent='🗺️ Itinéraire';},function(){alert('Position non disponible');b.textContent='🗺️ Itinéraire';},{enableHighAccuracy:true,timeout:8000});})(this)" style="flex:1;display:flex;align-items:center;justify-content:center;gap:3px;padding:5px 0;border-radius:6px;background:#3b82f6;color:#fff;font-size:10px;font-weight:600;border:none;cursor:pointer;" title="Tracer l'itinéraire sur la carte">🗺️ Itinéraire</button>
                    <a href="${navUrl}" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:3px;padding:5px 0;border-radius:6px;background:#22c55e;color:#fff;font-size:10px;font-weight:600;text-decoration:none;" title="Ouvrir dans Google Maps (navigation GPS vocale)">🧭 GPS</a>
                    <button onclick="if(window.selectHousehold) window.selectHousehold('${id}');" style="flex:1;display:flex;align-items:center;justify-content:center;gap:3px;padding:5px 0;border-radius:6px;background:#f1f5f9;color:#475569;font-size:10px;font-weight:600;border:1px solid #e2e8f0;cursor:pointer;">ℹ️ Détails</button>
                </div>
                ${this._getPhotoHtml(id)}
            </div>
        `;
    }

    /** Initialise le dashboard KPI — draggable + minimisable */
    _initKpiDashboard() {
        if (!this.map) return;
        const self = this;
        const mapC = this.map.getContainer();

        const panel = document.createElement('div');
        panel.id = 'widgetKpi';
        panel.className = 'map-widget';
        panel.style.cssText = 'position:absolute;bottom:20px;right:10px;background:rgba(255,255,255,0.95);backdrop-filter:blur(8px);border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);font-family:Inter,sans-serif;font-size:11px;min-width:180px;z-index:800;overflow:hidden;';

        // Header drag handle
        const hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;cursor:grab;user-select:none;';
        hdr.innerHTML = '<span style="font-weight:700;font-size:11px;">📊 Tableau de bord</span>';
        const minBtn = document.createElement('button');
        minBtn.textContent = '−';
        minBtn.style.cssText = 'background:rgba(255,255,255,0.25);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:13px;line-height:1;';
        hdr.appendChild(minBtn);
        panel.appendChild(hdr);

        // Body
        const body = document.createElement('div');
        body.style.cssText = 'padding:8px 12px;';
        body.id = 'kpiContent';
        body.textContent = 'Chargement…';
        panel.appendChild(body);

        mapC.appendChild(panel);
        this._makeDraggable(panel, hdr);
        this._widgetKpi = panel;

        let mini = false;
        minBtn.addEventListener('click', (e) => { e.stopPropagation(); mini = !mini; body.style.display = mini ? 'none' : ''; minBtn.textContent = mini ? '+' : '−'; });

        panel.addEventListener('mousedown', (e) => e.stopPropagation());
        panel.addEventListener('dblclick', (e) => e.stopPropagation());

        setTimeout(() => self._updateKpiDashboard(), 1500);
    }

    /** Barre de gestion des widgets — toggle on/off + dark mode */
    _initWidgetManager() {
        if (!this.map) return;
        const self = this;
        const mapC = this.map.getContainer();

        const bar = document.createElement('div');
        bar.id = 'widgetManagerBar';
        bar.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:4px;flex-wrap:wrap;justify-content:center;align-items:center;background:rgba(255,255,255,0.92);backdrop-filter:blur(8px);border-radius:10px;padding:5px 8px;box-shadow:0 2px 12px rgba(0,0,0,0.12);z-index:900;font-family:Inter,sans-serif;max-width:calc(100% - 80px);';

        bar.addEventListener('mousedown', (e) => e.stopPropagation());
        bar.addEventListener('dblclick', (e) => e.stopPropagation());

        const widgets = [
            { id: 'widgetLegend', icon: '🔧', label: 'Pipeline', on: true },
            { id: 'widgetKpi', icon: '📊', label: 'KPI', on: true },
            { id: null, cls: '.map-toolbar', icon: '🧰', label: 'Outils', on: true },
            { id: null, cls: '.map-geocoder-control', icon: '🔍', label: 'Recherche', on: true },
        ];

        // Restore saved visibility
        const savedVis = (() => { try { return JSON.parse(localStorage.getItem('widget_visibility') || '{}'); } catch { return {}; } })();

        widgets.forEach(w => {
            const key = w.id || w.cls;
            const pill = document.createElement('button');
            pill.dataset.widgetKey = key;
            pill.style.cssText = 'display:flex;align-items:center;gap:3px;padding:4px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;';
            pill.innerHTML = `${w.icon} ${w.label}`;
            pill.title = `Afficher/masquer ${w.label}`;

            const setActive = (active) => {
                let el = w.id ? document.getElementById(w.id) : (mapC.querySelector(w.cls) || document.querySelector(w.cls));
                if (el) {
                    // Pour les L.Control Leaflet, toggler le parent .leaflet-control aussi
                    const ctrl = el.closest('.leaflet-control');
                    if (ctrl) { ctrl.style.display = active ? '' : 'none'; }
                    else { el.style.display = active ? '' : 'none'; }
                }
                pill.style.background = active ? '#4f46e5' : '#f8fafc';
                pill.style.color = active ? '#fff' : '#64748b';
                pill.style.borderColor = active ? '#4f46e5' : '#e2e8f0';
                pill.dataset.active = active ? '1' : '0';
                // Save
                try { const vis = JSON.parse(localStorage.getItem('widget_visibility') || '{}'); vis[key] = active; localStorage.setItem('widget_visibility', JSON.stringify(vis)); } catch { }
            };
            const defaultOn = savedVis.hasOwnProperty(key) ? savedVis[key] : w.on;
            // Delayed set to ensure elements exist
            setTimeout(() => setActive(defaultOn), 200);

            pill.addEventListener('click', () => setActive(pill.dataset.active !== '1'));
            bar.appendChild(pill);
        });

        // Séparateur
        const sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:18px;background:#d1d5db;margin:0 2px;';
        bar.appendChild(sep);

        // Dark Mode toggle
        const darkBtn = document.createElement('button');
        darkBtn.id = 'darkModeToggle';
        darkBtn.style.cssText = 'display:flex;align-items:center;gap:3px;padding:4px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;background:#f8fafc;color:#64748b;';
        darkBtn.innerHTML = '🌙 Sombre';
        darkBtn.title = 'Activer/désactiver le thème sombre';
        let darkMode = localStorage.getItem('map_dark_mode') === '1';

        const applyDark = (on) => {
            darkMode = on;
            localStorage.setItem('map_dark_mode', on ? '1' : '0');
            darkBtn.style.background = on ? '#1e293b' : '#f8fafc';
            darkBtn.style.color = on ? '#f1f5f9' : '#64748b';
            darkBtn.style.borderColor = on ? '#475569' : '#e2e8f0';
            darkBtn.innerHTML = on ? '☀️ Clair' : '🌙 Sombre';

            // Apply to bar
            bar.style.background = on ? 'rgba(30,41,59,0.92)' : 'rgba(255,255,255,0.92)';

            // Apply to widgets
            document.querySelectorAll('.map-widget').forEach(w => {
                w.style.background = on ? 'rgba(30,41,59,0.95)' : '';
                w.style.color = on ? '#e2e8f0' : '';
                // Body children
                w.querySelectorAll('div:not([style*="gradient"])').forEach(d => {
                    if (!d.style.background?.includes('gradient')) {
                        d.style.color = on ? '#e2e8f0' : '';
                    }
                });
                w.querySelectorAll('label').forEach(l => l.style.color = on ? '#94a3b8' : '');
                w.querySelectorAll('span:not([style*="border-radius:50%"])').forEach(s => {
                    if (!s.style.background) s.style.color = on ? '#cbd5e1' : '';
                });
            });

            // Map tile filter
            const tiles = mapC.querySelector('.leaflet-tile-pane');
            if (tiles) tiles.style.filter = on ? 'brightness(0.75) contrast(1.1) saturate(0.8)' : '';
        };
        applyDark(darkMode);
        darkBtn.addEventListener('click', () => applyDark(!darkMode));
        bar.appendChild(darkBtn);

        // Reset positions
        const resetBtn = document.createElement('button');
        resetBtn.style.cssText = 'display:flex;align-items:center;padding:4px 6px;border-radius:8px;border:1px solid #e2e8f0;font-size:10px;cursor:pointer;background:#f8fafc;color:#64748b;';
        resetBtn.innerHTML = '🔄';
        resetBtn.title = 'Réinitialiser les positions des widgets';
        resetBtn.addEventListener('click', () => {
            Object.keys(localStorage).forEach(k => { if (k.startsWith('widget_pos_')) localStorage.removeItem(k); });
            localStorage.removeItem('widget_visibility');
            self._notifyRoute('Positions réinitialisées — rechargez la page');
        });
        bar.appendChild(resetBtn);

        mapC.appendChild(bar);
        this._widgetBar = bar;
    }

    /** Met à jour les chiffres du dashboard KPI */
    _updateKpiDashboard() {
        const el = document.getElementById('kpiContent');
        if (!el || !this.markers) return;

        const normalize = window.normalizeStatus || (s => s);
        const counts = {};
        let total = 0;
        let visible = 0;

        MapManager.PIPELINE_STATUS_DEFS.forEach(sd => { counts[normalize(sd.value)] = 0; }); // Use normalized values for counts

        this.markers.eachLayer(layer => {
            total++;
            const raw = layer?.options?._status || '';
            const ns = normalize(raw);
            if (counts.hasOwnProperty(ns)) counts[ns]++;
            else counts[normalize('Non débuté')]++; // Fallback to normalized 'Non débuté'

            const isVisible = !this._visibleStatuses || this._visibleStatuses.has(ns);
            if (isVisible) visible++;
        });

        const done = counts[normalize('Réception: Validée')] || 0;
        const problems = (counts[normalize('Problème')] || 0) + (counts[normalize('Inéligible')] || 0);
        const inProgress = total - done - problems - (counts[normalize('Non débuté')] || 0);
        const pct = total > 0 ? ((done / total) * 100).toFixed(1) : 0;

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
                <div><span style="color:#64748b;">Total</span></div><div style="font-weight:600;text-align:right;">${total.toLocaleString()}</div>
                <div><span style="color:#22c55e;">✅ Conformes</span></div><div style="font-weight:600;text-align:right;">${done.toLocaleString()}</div>
                <div><span style="color:#3b82f6;">🔧 En cours</span></div><div style="font-weight:600;text-align:right;">${inProgress.toLocaleString()}</div>
                <div><span style="color:#ef4444;">⚠️ Problèmes</span></div><div style="font-weight:600;text-align:right;">${problems.toLocaleString()}</div>
            </div>
            <div style="margin-top:8px;background:#e5e7eb;border-radius:6px;height:8px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:6px;transition:width 0.5s;"></div>
            </div>
            <div style="text-align:center;margin-top:4px;font-size:10px;color:#64748b;font-weight:600;">${pct}% complété — ${visible.toLocaleString()} visibles</div>
        `;
    }

    getStatusColorClass(status) {
        if (!status) return 'text-gray-500';
        const normalized = (window.normalizeStatus) ? window.normalizeStatus(status) : status;
        const s = normalized.toLowerCase();
        if (s.includes('réception') || s.includes('validée')) return 'text-green-600 font-bold';
        if (s.includes('problème') || s.includes('inéligible')) return 'text-red-600 font-bold';
        if (s.includes('non début')) return 'text-gray-600 font-bold';
        if (s.includes('cours') || s.includes('terminé')) return 'text-orange-600 font-bold';
        return 'text-gray-600';
    }

    /**
     * Retourne la couleur hex d'un statut — utilise le pipeline métier
     */
    getColor(statut) {
        const normalize = (window.normalizeStatus) ? window.normalizeStatus : (s => s);
        const normalized = normalize(statut);

        // 1. Pipeline status map (source of truth)
        const pipelineMatch = MapManager.PIPELINE_STATUS_DEFS.find(d => d.value === normalized);
        if (pipelineMatch) return pipelineMatch.color;

        // 2. StatusMapColors (user-defined overrides)
        if (window.StatusMapColors && normalized) {
            const color = window.StatusMapColors[normalized];
            if (color) return color;
        }

        // 3. Fallback heuristique pour anciens statuts
        const lower = (normalized || '').toLowerCase();
        if (lower.includes('réception') || lower.includes('validée') || lower.includes('conforme') || lower.includes('terminé')) return '#22c55e';
        if (lower.includes('problème') || lower.includes('inéligible')) return '#ef4444';
        if (lower.includes('réseau')) return '#3b82f6';
        if (lower.includes('intérieur')) return '#8b5cf6';
        if (lower.includes('murs') || lower.includes('cours')) return '#eab308';
        return '#94a3b8';
    }

    /* ════════════════════════════════════════════════════════════════
     *  FEATURE 4 — Zone Polygons (convex hull + progress coloring)
     * ════════════════════════════════════════════════════════════════ */

    /** Dessine des polygones autour des marqueurs regroupés par zone */
    _initZonePolygons() {
        if (!this.map) return;
        this._zoneLayer = L.layerGroup().addTo(this.map);
    }

    /** Affiche / rafraîchit les polygones de zone (appeler après loadData) */
    _renderZonePolygons(householdsByZone) {
        if (!this._zoneLayer) return;
        this._zoneLayer.clearLayers();

        // householdsByZone = { zoneName: [{ lat, lon, status }] }
        const normalize = window.normalizeStatus || (s => s);
        const HS = window.HouseholdStatus || {};

        Object.entries(householdsByZone).forEach(([zoneName, points]) => {
            if (!points || points.length < 3) return;

            // Calculer progression
            const total = points.length;
            const done = points.filter(p => normalize(p.status) === (HS.RECEPTION_VALIDEE || 'Réception: Validée')).length;
            const pct = total > 0 ? done / total : 0;

            // Couleur dégradée: rouge(0%) → jaune(50%) → vert(100%)
            const r = Math.round(255 * (1 - pct));
            const g = Math.round(200 * pct);
            const color = `rgb(${r}, ${g}, 60)`;

            // Convex hull simplifié
            const coords = points.map(p => [p.lat, p.lon]);
            const hull = this._convexHull(coords);
            if (hull.length < 3) return;

            const polygon = L.polygon(hull, {
                color: color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.15,
                dashArray: '4 4'
            });

            polygon.bindTooltip(`<b>${zoneName}</b><br>${done}/${total} (${(pct * 100).toFixed(0)}%)`, {
                sticky: true,
                className: 'zone-tooltip'
            });

            polygon.on('click', () => {
                this.map.flyToBounds(polygon.getBounds(), { padding: [40, 40], duration: 0.8 });
            });

            this._zoneLayer.addLayer(polygon);
        });
    }

    /** Algorithme Convex Hull (Gift Wrapping) pour les polygones de zone */
    _convexHull(points) {
        if (points.length < 3) return points;
        const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const cross = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
        const lower = [];
        for (const p of sorted) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
            lower.push(p);
        }
        const upper = [];
        for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
            upper.push(p);
        }
        upper.pop();
        lower.pop();
        return lower.concat(upper);
    }

    /* ════════════════════════════════════════════════════════════════
     *  FEATURE 5 — Team Position Tracker
     * ════════════════════════════════════════════════════════════════ */

    /** Initialise la couche des équipes */
    _initTeamTracker() {
        if (!this.map) return;
        this._teamLayer = L.layerGroup();
        // Pas ajouté par défaut, l'utilisateur l'active via le toolbar
    }

    /** Affiche les positions des équipes sur la carte */
    showTeamPositions(teams) {
        if (!this._teamLayer) return;
        this._teamLayer.clearLayers();

        const teamIcons = {
            'macons': { icon: '🔨', color: '#eab308' },
            'reseau': { icon: '⚡', color: '#3b82f6' },
            'interieur_type1': { icon: '🔌', color: '#8b5cf6' },
            'interieur_type2': { icon: '🔌', color: '#7c3aed' },
            'controle': { icon: '✅', color: '#22c55e' },
            'preparateurs': { icon: '📋', color: '#64748b' },
            'livraison': { icon: '🚛', color: '#f97316' }
        };

        teams.forEach(team => {
            if (!team.lastLat || !team.lastLon) return;
            const def = teamIcons[team.type] || { icon: '👷', color: '#94a3b8' };

            const teamIcon = L.divIcon({
                className: 'team-marker',
                html: `<div style="background:${def.color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;">${def.icon}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([team.lastLat, team.lastLon], { icon: teamIcon });
            marker.bindTooltip(`Équipe ${team.name || team.type}`, { direction: 'top', offset: [0, -18] });
            marker.bindPopup(`
                <div style="font-family:Inter,sans-serif;font-size:12px;">
                    <b>${def.icon} ${team.name || team.type}</b><br>
                    <span style="color:#64748b;">Membres: ${team.members?.length || '?'}</span><br>
                    <span style="color:#64748b;">Zone: ${team.zone || '—'}</span>
                </div>
            `);
            this._teamLayer.addLayer(marker);
        });

        if (!this.map.hasLayer(this._teamLayer)) {
            this._teamLayer.addTo(this.map);
        }
    }

    /* ════════════════════════════════════════════════════════════════
     *  FEATURE 6 — Team Route Planner (multi-stop itinerary)
     * ════════════════════════════════════════════════════════════════ */

    /** Calcule et affiche l'itinéraire multi-points pour une équipe */
    planTeamRoute(waypoints) {
        if (!this.map || !waypoints || waypoints.length < 2) return;
        if (!L.Routing || !L.Routing.control) {
            console.warn('🗺️ Routing lib manquante pour feuille de route');
            return;
        }

        // Supprimer ancien itinéraire d'équipe
        if (this._teamRoutingControl) {
            this.map.removeControl(this._teamRoutingControl);
        }

        const waypointLatLngs = waypoints.map((wp, i) => {
            const w = L.Routing.waypoint(
                L.latLng(wp.lat, wp.lon),
                `${i + 1}. ${wp.label || 'Stop'}`
            );
            return w;
        });

        this._teamRoutingControl = L.Routing.control({
            waypoints: waypointLatLngs,
            routeWhileDragging: false,
            showAlternatives: false,
            lineOptions: { styles: [{ color: '#8b5cf6', weight: 4, opacity: 0.8 }] },
            createMarker: (i, wp) => {
                return L.marker(wp.latLng, {
                    icon: L.divIcon({
                        className: 'route-stop-marker',
                        html: `<div style="background:#8b5cf6;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${i + 1}</div>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    })
                }).bindTooltip(wp.name || `Stop ${i + 1}`);
            }
        }).addTo(this.map);
    }

    /** Efface l'itinéraire d'équipe */
    clearTeamRoute() {
        if (this._teamRoutingControl) {
            this.map.removeControl(this._teamRoutingControl);
            this._teamRoutingControl = null;
        }
    }

    /* ════════════════════════════════════════════════════════════════
     *  FEATURE 7 — Thematic Heatmap (problems & productivity)
     * ════════════════════════════════════════════════════════════════ */

    /** Active la heatmap des problèmes uniquement */
    showProblemsHeatmap() {
        if (!this.map || !this.markers) return;
        if (!window.L?.heatLayer) { console.warn('leaflet-heat non chargé'); return; }

        const normalize = window.normalizeStatus || (s => s);
        const HS = window.HouseholdStatus || {};
        const problemPoints = [];

        this.markers.eachLayer(layer => {
            const raw = layer?.options?._status || '';
            const ns = normalize(raw);
            if (ns === (HS.PROBLEME || 'Problème') || ns === (HS.INELIGIBLE || 'Inéligible')) {
                const ll = layer.getLatLng();
                if (ll) problemPoints.push([ll.lat, ll.lng, 1.0]);
            }
        });

        // Supprimer ancienne heatmap problème
        if (this._problemHeatLayer) {
            this.map.removeLayer(this._problemHeatLayer);
        }

        if (problemPoints.length > 0) {
            this._problemHeatLayer = L.heatLayer(problemPoints, {
                radius: 30,
                blur: 20,
                maxZoom: 17,
                gradient: { 0.2: '#fde68a', 0.5: '#f97316', 0.8: '#ef4444', 1: '#991b1b' }
            }).addTo(this.map);
        }
    }

    /** Masque la heatmap des problèmes */
    hideProblemsHeatmap() {
        if (this._problemHeatLayer) {
            this.map.removeLayer(this._problemHeatLayer);
            this._problemHeatLayer = null;
        }
    }

    /* ════════════════════════════════════════════════════════════════
     *  FEATURE 8 — Map Export (CSV + Screenshot)
     * ════════════════════════════════════════════════════════════════ */

    /** Exporte les marqueurs visibles en CSV */
    exportVisibleMarkersCSV() {
        if (!this.markers) return;
        const normalize = window.normalizeStatus || (s => s);
        const rows = [['ID', 'Nom', 'Statut', 'Latitude', 'Longitude']];

        this.markers.eachLayer(layer => {
            // Vérifier la visibilité
            if (layer._icon && layer._icon.style.display === 'none') return;
            const ll = layer.getLatLng();
            const id = layer?.options?._customId || '';
            const status = normalize(layer?.options?._status || '');
            const tooltip = layer.getTooltip();
            const name = tooltip ? tooltip.getContent().split(' - ').slice(1).join(' - ') : '';
            rows.push([id, name, status, ll.lat.toFixed(6), ll.lng.toFixed(6)]);
        });

        const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_carte_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /** Capture la carte en image (utilise html2canvas si disponible) */
    async exportMapScreenshot() {
        const mapContainer = this.map?.getContainer();
        if (!mapContainer) return;

        if (typeof html2canvas === 'function') {
            try {
                const canvas = await html2canvas(mapContainer, { useCORS: true, logging: false });
                const link = document.createElement('a');
                link.download = `carte_${new Date().toISOString().slice(0, 10)}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } catch (e) {
                console.error('Screenshot error:', e);
                alert('Erreur lors de la capture. Essayez avec un zoom plus petit.');
            }
        } else {
            // Fallback: guide l'utilisateur
            alert('Pour capturer la carte, utilisez la touche Impr. Écran ou un outil de capture.');
        }
    }

    /* ════════════════════════════════════════════════════════════════
     *  TOOLBAR — Barre d'outils avancée
     * ════════════════════════════════════════════════════════════════ */

    /** Crée une barre d'outils flottante avec les fonctionnalités avancées */
    _initAdvancedToolbar() {
        if (!this.map) return;
        const self = this;

        const ToolbarControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-toolbar');
                container.style.cssText = 'display:flex;flex-direction:column;gap:2px;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.12);padding:4px;';
                L.DomEvent.disableClickPropagation(container);

                const buttons = [
                    { icon: 'fa-layer-group', title: 'Zones', id: 'btnZones', action: () => self._toggleZonePolygons() },
                    { icon: 'fa-fire', title: 'Heatmap Problèmes', id: 'btnHeatProblems', action: () => self._toggleProblemsHeatmap() },
                    { icon: 'fa-download', title: 'Exporter CSV', id: 'btnExportCSV', action: () => self.exportVisibleMarkersCSV() },
                    { icon: 'fa-camera', title: 'Capture écran', id: 'btnScreenshot', action: () => self.exportMapScreenshot() },
                    null, // séparateur
                    { icon: 'fa-calendar-alt', title: 'Tournée du jour', id: 'btnTour', action: () => self._toggleTourOptimizer() },
                    { icon: 'fa-image', title: 'Photos géolocalisées', id: 'btnPhotos', action: () => self._togglePhotoMode() },
                    { icon: 'fa-chart-area', title: 'Progression par zone', id: 'btnProgressHeatmap', action: () => self._toggleProgressHeatmap() },
                    { icon: 'fa-ruler', title: 'Mesurer', id: 'btnMeasure', action: () => self._toggleMeasure() },
                    { icon: 'fa-pencil-alt', title: 'Annoter', id: 'btnAnnotate', action: () => self._toggleAnnotations() },
                    { icon: 'fa-bell', title: 'Alertes proximité', id: 'btnProximity', action: () => self._toggleProximityAlerts() },
                    { icon: 'fa-wifi', title: 'Mode hors-ligne', id: 'btnOffline', action: () => self._toggleOfflineMode() },
                    { icon: 'fa-history', title: 'Timeline', id: 'btnTimeline', action: () => self._toggleTimeline() },
                    { icon: 'fa-bullseye', title: 'Assignation auto', id: 'btnAssign', action: () => self._toggleSmartAssign() },
                    { icon: 'fa-file-pdf', title: 'Rapport PDF', id: 'btnPdfReport', action: () => self._generatePdfReport() }
                ];

                buttons.forEach(b => {
                    if (!b) {
                        const sep = L.DomUtil.create('div', '', container);
                        sep.style.cssText = 'height:1px;background:#e5e7eb;margin:2px 4px;';
                        return;
                    }
                    const btn = L.DomUtil.create('a', '', container);
                    btn.href = '#';
                    btn.id = b.id;
                    btn.title = b.title;
                    btn.innerHTML = `<i class="fas ${b.icon}"></i>`;
                    btn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:34px;height:34px;font-size:14px;color:#475569;text-decoration:none;border-radius:6px;transition:all 0.15s;';
                    btn.addEventListener('mouseenter', () => { btn.style.background = '#eff6ff'; btn.style.color = '#3b82f6'; });
                    btn.addEventListener('mouseleave', () => { if (!btn.classList.contains('active')) { btn.style.background = ''; btn.style.color = '#475569'; } });
                    btn.addEventListener('click', (e) => { e.preventDefault(); b.action(); });
                });

                return container;
            }
        });
        new ToolbarControl().addTo(this.map);
    }

    /** Bascule l'affichage des polygones de zone */
    _toggleZonePolygons() {
        if (!this._zoneLayer) this._initZonePolygons();

        if (this.map.hasLayer(this._zoneLayer)) {
            this.map.removeLayer(this._zoneLayer);
            return;
        }

        // Regrouper les marqueurs par zone (si disponible via les données)
        const normalize = window.normalizeStatus || (s => s);
        const householdsByZone = {};

        this.markers.eachLayer(layer => {
            if (layer._icon && layer._icon.style.display === 'none') return;
            const ll = layer.getLatLng();
            const status = layer?.options?._status || '';
            // Tentative d'extraction de la zone (si le marqueur a une info de zone)
            const zone = layer?.options?._zone || 'Zone par défaut';
            if (!householdsByZone[zone]) householdsByZone[zone] = [];
            householdsByZone[zone].push({ lat: ll.lat, lon: ll.lng, status: normalize(status) });
        });

        this._renderZonePolygons(householdsByZone);
        this._zoneLayer.addTo(this.map);
    }

    /** Bascule la heatmap des problèmes */
    _toggleProblemsHeatmap() {
        if (this._problemHeatLayer && this.map.hasLayer(this._problemHeatLayer)) {
            this.hideProblemsHeatmap();
        } else {
            this.showProblemsHeatmap();
        }
    }

    // =========================================================================
    //  FEATURE 1 : Optimisation Tournée du Jour (Nearest Neighbor TSP)
    // =========================================================================
    _toggleTourOptimizer() {
        if (this._tourPanel) { this._tourPanel.remove(); this._tourPanel = null; this._clearTourRoute(); return; }

        const panel = document.createElement('div');
        panel.id = 'tourPanel';
        panel.style.cssText = 'position:absolute;top:10px;right:10px;width:320px;max-height:calc(100% - 20px);background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);font-family:Inter,sans-serif;z-index:1000;display:flex;flex-direction:column;overflow:hidden;';
        panel.innerHTML = `
            <div style="padding:14px 16px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:700;font-size:14px;">🗓️ Tournée du jour</span>
                    <button id="closeTourPanel" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:14px;">✕</button>
                </div>
                <p style="font-size:11px;margin-top:6px;opacity:0.9;">Cliquez sur les ménages à visiter puis validez</p>
            </div>
            <div style="padding:12px;flex:1;overflow-y:auto;">
                <div id="tourStops" style="min-height:40px;color:#94a3b8;font-size:12px;text-align:center;padding:12px;">Aucun arrêt sélectionné</div>
            </div>
            <div style="padding:10px 14px;border-top:1px solid #e5e7eb;display:flex;gap:6px;">
                <button id="optimizeTourBtn" style="flex:1;padding:8px;border-radius:8px;background:#f59e0b;color:#fff;font-weight:600;font-size:12px;border:none;cursor:pointer;">🚀 Optimiser</button>
                <button id="clearTourBtn" style="flex:1;padding:8px;border-radius:8px;background:#fee2e2;color:#dc2626;font-weight:600;font-size:12px;border:none;cursor:pointer;">Effacer</button>
            </div>
        `;
        this.map.getContainer().appendChild(panel);
        this._tourPanel = panel;
        this._makeDraggable(panel, panel.querySelector('div'));
        this._tourStops = [];
        this._tourMode = true;

        document.getElementById('closeTourPanel').addEventListener('click', () => { panel.remove(); this._tourPanel = null; this._tourMode = false; });
        document.getElementById('clearTourBtn').addEventListener('click', () => { this._tourStops = []; this._clearTourRoute(); this._updateTourStopsList(); });
        document.getElementById('optimizeTourBtn').addEventListener('click', () => this._runTourOptimization());

        // Intercepter les clics sur les marqueurs pour mode tournée
        this._tourClickHandler = (e) => {
            if (!this._tourMode) return;
            const ll = e.latlng || e.target?.getLatLng?.();
            if (ll) {
                const id = e.target?.options?._customId || `${ll.lat.toFixed(5)},${ll.lng.toFixed(5)}`;
                this._tourStops.push({ lat: ll.lat, lon: ll.lng, id });
                this._updateTourStopsList();
            }
        };
        this.markers.on('click', this._tourClickHandler);
    }

    _updateTourStopsList() {
        const el = document.getElementById('tourStops');
        if (!el) return;
        if (this._tourStops.length === 0) { el.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:12px;">Aucun arrêt sélectionné</div>'; return; }
        el.innerHTML = this._tourStops.map((s, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
            <span style="width:22px;height:22px;border-radius:50%;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i + 1}</span>
            <span style="font-size:12px;color:#334155;flex:1;">${s.id}</span>
            <button onclick="(function(b){var mgr=window.__mapManagerInstance||window.mapManager;if(mgr){mgr._tourStops.splice(${i},1);mgr._updateTourStopsList();}})()" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:14px;">✕</button>
        </div>`).join('');
    }

    _runTourOptimization() {
        if (this._tourStops.length < 2) { this._notifyRoute('Ajoutez au moins 2 arrêts'); return; }
        // Nearest Neighbor TSP
        const stops = [...this._tourStops];
        const optimized = [stops.shift()];
        while (stops.length > 0) {
            const last = optimized[optimized.length - 1];
            let nearest = 0, minDist = Infinity;
            stops.forEach((s, i) => {
                const d = Math.sqrt(Math.pow(s.lat - last.lat, 2) + Math.pow(s.lon - last.lon, 2));
                if (d < minDist) { minDist = d; nearest = i; }
            });
            optimized.push(stops.splice(nearest, 1)[0]);
        }
        this._tourStops = optimized;
        this._updateTourStopsList();
        this._drawTourRoute(optimized);
    }

    _drawTourRoute(stops) {
        this._clearTourRoute();
        this._tourLayer = L.layerGroup().addTo(this.map);
        const latlngs = stops.map(s => [s.lat, s.lon]);
        L.polyline(latlngs, { color: '#f59e0b', weight: 4, opacity: 0.8, dashArray: '10,6' }).addTo(this._tourLayer);
        stops.forEach((s, i) => {
            L.marker([s.lat, s.lon], {
                icon: L.divIcon({
                    className: 'tour-stop',
                    html: `<div style="background:#f59e0b;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${i + 1}</div>`,
                    iconSize: [24, 24], iconAnchor: [12, 12]
                })
            }).addTo(this._tourLayer);
        });
        // Résumé
        let totalDist = 0;
        for (let i = 1; i < latlngs.length; i++) {
            totalDist += this.map.distance(L.latLng(latlngs[i - 1]), L.latLng(latlngs[i]));
        }
        this._notifyRoute(`Tournée optimisée : ${stops.length} arrêts, ~${(totalDist / 1000).toFixed(1)} km`);
    }

    _clearTourRoute() { if (this._tourLayer) { this.map.removeLayer(this._tourLayer); this._tourLayer = null; } }

    // =========================================================================
    //  FEATURE 2 : Photos Géolocalisées
    // =========================================================================
    _togglePhotoMode() {
        this._photoMode = !this._photoMode;
        const btn = document.getElementById('btnPhotos');
        if (btn) { btn.style.background = this._photoMode ? '#3b82f6' : ''; btn.style.color = this._photoMode ? '#fff' : '#475569'; }
        this._notifyRoute(this._photoMode ? 'Mode photo activé : cliquez un ménage pour ajouter une photo' : 'Mode photo désactivé');
    }

    /** Ajoute une section photo dans le popup d'un ménage */
    _getPhotoHtml(householdId) {
        const photos = JSON.parse(localStorage.getItem(`photos_${householdId}`) || '[]');
        const thumbs = photos.slice(-3).map(p => `<img src="${p}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb;">`).join('');
        return `<div style="margin-top:6px;border-top:1px solid #f1f5f9;padding-top:6px;">
            <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
                <span style="font-size:10px;font-weight:600;color:#64748b;">📸 Photos (${photos.length})</span>
                <label style="margin-left:auto;font-size:10px;color:#3b82f6;cursor:pointer;font-weight:600;">
                    + Ajouter<input type="file" accept="image/*" capture="environment" style="display:none;" onchange="(function(inp){var f=inp.files[0];if(!f)return;var r=new FileReader();r.onload=function(e){var photos=JSON.parse(localStorage.getItem('photos_${householdId}')||'[]');photos.push(e.target.result);localStorage.setItem('photos_${householdId}',JSON.stringify(photos));var mgr=window.__mapManagerInstance||window.mapManager;if(mgr)mgr._notifyRoute('Photo enregistrée');};r.readAsDataURL(f);})(this)">
                </label>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;">${thumbs || '<span style="font-size:10px;color:#94a3b8;">Aucune photo</span>'}</div>
        </div>`;
    }

    // =========================================================================
    //  FEATURE 3 : Heatmap de Progression par Zone
    // =========================================================================
    _toggleProgressHeatmap() {
        if (this._progressLayer && this.map.hasLayer(this._progressLayer)) {
            this.map.removeLayer(this._progressLayer);
            return;
        }
        const normalize = window.normalizeStatus || (s => s);
        const HouseholdStatus = window.HouseholdStatus || {};
        const completedStatuses = new Set([normalize(HouseholdStatus.RECEPTION_VALIDATED || 'réception: validée'), normalize(HouseholdStatus.INTERIOR_DONE || 'intérieur: terminé'), normalize(HouseholdStatus.NETWORK_DONE || 'réseau: terminé')]);

        // Grille de zones (carrés de ~5km)
        const gridSize = 0.045; // ~5km
        const cells = {};

        this.markers.eachLayer(layer => {
            if (layer._icon && layer._icon.style.display === 'none') return;
            const ll = layer.getLatLng();
            const status = normalize(layer?.options?._status || '');
            const cellKey = `${(Math.floor(ll.lat / gridSize) * gridSize).toFixed(3)}_${(Math.floor(ll.lng / gridSize) * gridSize).toFixed(3)}`;
            if (!cells[cellKey]) cells[cellKey] = { lat: Math.floor(ll.lat / gridSize) * gridSize, lon: Math.floor(ll.lng / gridSize) * gridSize, total: 0, done: 0 };
            cells[cellKey].total++;
            if (completedStatuses.has(status)) cells[cellKey].done++;
        });

        this._progressLayer = L.layerGroup().addTo(this.map);
        Object.values(cells).forEach(cell => {
            if (cell.total < 1) return;
            const pct = cell.done / cell.total;
            const color = pct >= 0.8 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : pct >= 0.2 ? '#f97316' : '#ef4444';
            L.rectangle(
                [[cell.lat, cell.lon], [cell.lat + gridSize, cell.lon + gridSize]],
                { color, weight: 1, fillColor: color, fillOpacity: 0.25 }
            ).bindPopup(`<b>Zone</b><br>Progression: ${Math.round(pct * 100)}%<br>${cell.done}/${cell.total} terminés`).addTo(this._progressLayer);
        });
    }

    // =========================================================================
    //  FEATURE 4 : Outil de Mesure
    // =========================================================================
    _toggleMeasure() {
        if (this._measureMode) { this._endMeasure(); return; }
        this._measureMode = true;
        this._measurePoints = [];
        this._measureLayer = L.layerGroup().addTo(this.map);
        this.map.getContainer().style.cursor = 'crosshair';
        const btn = document.getElementById('btnMeasure');
        if (btn) { btn.style.background = '#3b82f6'; btn.style.color = '#fff'; btn.classList.add('active'); }
        this._notifyRoute('Mode mesure : cliquez pour ajouter des points. Double-clic pour terminer.');

        this._measureClickHandler = (e) => {
            this._measurePoints.push(e.latlng);
            L.circleMarker(e.latlng, { radius: 5, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }).addTo(this._measureLayer);
            if (this._measurePoints.length > 1) {
                const pts = this._measurePoints;
                L.polyline([pts[pts.length - 2], pts[pts.length - 1]], { color: '#ef4444', weight: 2, dashArray: '6,4' }).addTo(this._measureLayer);
                let totalDist = 0;
                for (let i = 1; i < pts.length; i++) totalDist += this.map.distance(pts[i - 1], pts[i]);
                this._notifyRoute(`Distance : ${totalDist >= 1000 ? (totalDist / 1000).toFixed(2) + ' km' : Math.round(totalDist) + ' m'}`);
            }
        };
        this._measureDblClickHandler = () => this._endMeasure();

        this.map.on('click', this._measureClickHandler);
        this.map.on('dblclick', this._measureDblClickHandler);
    }

    _endMeasure() {
        this._measureMode = false;
        this.map.getContainer().style.cursor = '';
        if (this._measureClickHandler) this.map.off('click', this._measureClickHandler);
        if (this._measureDblClickHandler) this.map.off('dblclick', this._measureDblClickHandler);
        const btn = document.getElementById('btnMeasure');
        if (btn) { btn.style.background = ''; btn.style.color = '#475569'; btn.classList.remove('active'); }
        // Garder le layer visible pour consultation, supprimé au prochain toggle
        if (this._measureLayer && this._measurePoints?.length < 2) {
            this.map.removeLayer(this._measureLayer);
            this._measureLayer = null;
        }
        this._measurePoints = [];
    }

    // =========================================================================
    //  FEATURE 5 : Annotations / Dessins
    // =========================================================================
    _toggleAnnotations() {
        if (this._annotateMode) { this._endAnnotateMode(); return; }
        this._annotateMode = true;
        if (!this._annotateLayer) {
            this._annotateLayer = L.layerGroup().addTo(this.map);
            // Charger annotations sauvegardées
            try {
                const saved = JSON.parse(localStorage.getItem('map_annotations') || '[]');
                saved.forEach(a => {
                    if (a.type === 'marker') {
                        L.marker([a.lat, a.lon]).bindPopup(a.text || 'Note').addTo(this._annotateLayer);
                    } else if (a.type === 'circle') {
                        L.circle([a.lat, a.lon], { radius: a.radius || 200, color: '#8b5cf6', fillOpacity: 0.15 }).addTo(this._annotateLayer);
                    }
                });
            } catch (e) { /* ignore */ }
        } else {
            this._annotateLayer.addTo(this.map);
        }
        this.map.getContainer().style.cursor = 'crosshair';
        const btn = document.getElementById('btnAnnotate');
        if (btn) { btn.style.background = '#8b5cf6'; btn.style.color = '#fff'; btn.classList.add('active'); }
        this._notifyRoute('Mode annotation : cliquez pour ajouter une note. Entrée pour valider le texte.');

        this._annotateClickHandler = (e) => {
            const text = prompt('Note / annotation :');
            if (!text) return;
            L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'annotation-marker',
                    html: `<div style="background:#8b5cf6;color:#fff;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);">📝 ${text.substring(0, 30)}</div>`,
                    iconAnchor: [0, 0]
                })
            }).bindPopup(text).addTo(this._annotateLayer);
            // Sauvegarder
            try {
                const saved = JSON.parse(localStorage.getItem('map_annotations') || '[]');
                saved.push({ type: 'marker', lat: e.latlng.lat, lon: e.latlng.lng, text });
                localStorage.setItem('map_annotations', JSON.stringify(saved));
            } catch (ex) { /* ignore */ }
        };
        this.map.on('click', this._annotateClickHandler);
    }

    _endAnnotateMode() {
        this._annotateMode = false;
        this.map.getContainer().style.cursor = '';
        if (this._annotateClickHandler) this.map.off('click', this._annotateClickHandler);
        const btn = document.getElementById('btnAnnotate');
        if (btn) { btn.style.background = ''; btn.style.color = '#475569'; btn.classList.remove('active'); }
    }

    // =========================================================================
    //  FEATURE 6 : Alertes de Proximité
    // =========================================================================
    _toggleProximityAlerts() {
        if (this._proximityWatchId) {
            navigator.geolocation.clearWatch(this._proximityWatchId);
            this._proximityWatchId = null;
            if (this._proximityCircle) { this.map.removeLayer(this._proximityCircle); this._proximityCircle = null; }
            const btn = document.getElementById('btnProximity');
            if (btn) { btn.style.background = ''; btn.style.color = '#475569'; btn.classList.remove('active'); }
            this._notifyRoute('Alertes de proximité désactivées');
            return;
        }
        if (!navigator.geolocation) { this._notifyRoute('Géolocalisation non disponible'); return; }

        const btn = document.getElementById('btnProximity');
        if (btn) { btn.style.background = '#ef4444'; btn.style.color = '#fff'; btn.classList.add('active'); }
        this._proximityAlerted = new Set();
        const RADIUS = 500; // mètres

        this._proximityWatchId = navigator.geolocation.watchPosition((pos) => {
            const myLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);
            // Cercle de position
            if (this._proximityCircle) this.map.removeLayer(this._proximityCircle);
            this._proximityCircle = L.circle(myLatLng, { radius: RADIUS, color: '#ef4444', fillColor: '#fecaca', fillOpacity: 0.2, weight: 1 }).addTo(this.map);

            // Vérifier la proximité avec les ménages non terminés
            const normalize = window.normalizeStatus || (s => s);
            const HouseholdStatus = window.HouseholdStatus || {};
            const doneStatuses = new Set([normalize(HouseholdStatus.RECEPTION_VALIDATED || 'réception: validée')]);

            this.markers.eachLayer(layer => {
                const ll = layer.getLatLng();
                const dist = myLatLng.distanceTo(ll);
                const status = normalize(layer?.options?._status || '');
                const id = layer?.options?._customId || '';
                if (dist <= RADIUS && !doneStatuses.has(status) && !this._proximityAlerted.has(id)) {
                    this._proximityAlerted.add(id);
                    this._notifyRoute(`🔔 Ménage ${id} à ${Math.round(dist)}m — ${status}`);
                    // son d'alerte
                    try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZqTjH13b3N/ipOdnpaNgXp0dH+KlZ6el46CeXV0f4qVnp6XjoJ5dQ==').play(); } catch (e) { /* ignore */ }
                }
            });
        }, () => { this._notifyRoute('Position GPS non disponible'); }, { enableHighAccuracy: true, maximumAge: 5000 });
        this._notifyRoute(`🔔 Alertes activées — rayon ${RADIUS}m`);
    }

    // =========================================================================
    //  FEATURE 7 : Mode Hors-Ligne
    // =========================================================================
    _toggleOfflineMode() {
        const btn = document.getElementById('btnOffline');
        if (this._offlineCached) {
            this._notifyRoute('Données hors-ligne déjà en cache');
            return;
        }

        // Sauvegarder les données des marqueurs en localStorage
        const data = [];
        this.markers.eachLayer(layer => {
            const ll = layer.getLatLng();
            data.push({
                lat: ll.lat, lon: ll.lng,
                id: layer?.options?._customId || '',
                status: layer?.options?._status || ''
            });
        });

        try {
            localStorage.setItem('offline_markers', JSON.stringify(data));
            localStorage.setItem('offline_timestamp', new Date().toISOString());
            this._offlineCached = true;
            if (btn) { btn.style.background = '#22c55e'; btn.style.color = '#fff'; }
            this._notifyRoute(`📴 ${data.length} marqueurs sauvegardés hors-ligne (${(JSON.stringify(data).length / 1024).toFixed(0)} Ko)`);
        } catch (e) {
            this._notifyRoute('Erreur sauvegarde hors-ligne : espace insuffisant');
        }
    }

    // =========================================================================
    //  FEATURE 8 : Timeline / Historique
    // =========================================================================
    _toggleTimeline() {
        if (this._timelinePanel) { this._timelinePanel.remove(); this._timelinePanel = null; return; }

        const panel = document.createElement('div');
        panel.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:80%;max-width:600px;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:12px 20px;z-index:1000;font-family:Inter,sans-serif;';
        panel.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-weight:700;font-size:13px;color:#334155;white-space:nowrap;">⏱️ Timeline</span>
                <input type="range" id="timelineSlider" min="0" max="30" value="30" style="flex:1;accent-color:#3b82f6;">
                <span id="timelineLabel" style="font-size:12px;color:#64748b;white-space:nowrap;">Aujourd'hui</span>
                <button onclick="this.parentElement.parentElement.remove();var mgr=window.__mapManagerInstance||window.mapManager;if(mgr){mgr._timelinePanel=null;mgr.markers.eachLayer(function(l){if(l._icon)l._icon.style.opacity='1';});}" style="background:none;border:none;font-size:16px;cursor:pointer;color:#94a3b8;">✕</button>
            </div>
        `;
        this.map.getContainer().appendChild(panel);
        this._timelinePanel = panel;
        this._makeDraggable(panel, panel.querySelector('div'));

        const slider = document.getElementById('timelineSlider');
        const label = document.getElementById('timelineLabel');
        slider.addEventListener('input', () => {
            const daysAgo = 30 - parseInt(slider.value);
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            label.textContent = daysAgo === 0 ? "Aujourd'hui" : `il y a ${daysAgo}j (${date.toLocaleDateString('fr-FR')})`;
            // Simuler la progression en réduisant l'opacité des marqueurs "futurs"
            const ratio = parseInt(slider.value) / 30;
            let shown = 0;
            this.markers.eachLayer(layer => {
                shown++;
                if (layer._icon) layer._icon.style.opacity = (shown / this.getMarkerCount()) <= ratio ? '1' : '0.15';
            });
        });
    }

    // =========================================================================
    //  FEATURE 9 : Assignation Intelligente
    // =========================================================================
    _toggleSmartAssign() {
        if (this._assignPanel) { this._assignPanel.remove(); this._assignPanel = null; return; }

        const panel = document.createElement('div');
        panel.style.cssText = 'position:absolute;top:10px;right:10px;width:300px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);font-family:Inter,sans-serif;z-index:1000;overflow:hidden;';
        panel.innerHTML = `
            <div style="padding:14px 16px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:700;font-size:14px;">🎯 Assignation auto</span>
                    <button id="closeAssignPanel" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;">✕</button>
                </div>
            </div>
            <div style="padding:14px;">
                <label style="font-size:11px;color:#64748b;font-weight:600;">Nombre d'équipes :</label>
                <input type="number" id="assignTeamCount" value="3" min="1" max="20" style="width:100%;padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;margin:6px 0 12px;font-size:13px;">
                <label style="font-size:11px;color:#64748b;font-weight:600;">Ménages par équipe :</label>
                <input type="number" id="assignPerTeam" value="10" min="1" max="50" style="width:100%;padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;margin:6px 0 12px;font-size:13px;">
                <button id="runAssignBtn" style="width:100%;padding:8px;border-radius:8px;background:#10b981;color:#fff;font-weight:600;font-size:12px;border:none;cursor:pointer;">Lancer l'assignation</button>
                <div id="assignResults" style="margin-top:10px;"></div>
            </div>
        `;
        this.map.getContainer().appendChild(panel);
        this._assignPanel = panel;
        this._makeDraggable(panel, panel.querySelector('div'));

        document.getElementById('closeAssignPanel').addEventListener('click', () => {
            panel.remove(); this._assignPanel = null;
            if (this._assignLayer) { this.map.removeLayer(this._assignLayer); this._assignLayer = null; }
        });
        document.getElementById('runAssignBtn').addEventListener('click', () => this._runSmartAssignment());
    }

    _runSmartAssignment() {
        const teamCount = parseInt(document.getElementById('assignTeamCount')?.value || 3);
        const perTeam = parseInt(document.getElementById('assignPerTeam')?.value || 10);
        const normalize = window.normalizeStatus || (s => s);
        const HouseholdStatus = window.HouseholdStatus || {};
        const doneStatuses = new Set([normalize(HouseholdStatus.RECEPTION_VALIDATED || 'réception: validée')]);
        const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

        // Collecter ménages non terminés
        const pending = [];
        this.markers.eachLayer(layer => {
            if (layer._icon && layer._icon.style.display === 'none') return;
            const status = normalize(layer?.options?._status || '');
            if (!doneStatuses.has(status)) {
                const ll = layer.getLatLng();
                pending.push({ lat: ll.lat, lon: ll.lng, id: layer?.options?._customId || '' });
            }
        });

        if (pending.length === 0) { this._notifyRoute('Aucun ménage en attente'); return; }

        // K-Means simplifié
        const assignments = Array.from({ length: teamCount }, () => []);
        // Répartir un à un par proximité au centroïde
        const centroids = pending.slice(0, teamCount).map(p => ({ lat: p.lat, lon: p.lon }));
        const sorted = [...pending];
        for (let iter = 0; iter < 3; iter++) {
            assignments.forEach(a => a.length = 0);
            sorted.forEach(p => {
                let nearest = 0, minDist = Infinity;
                centroids.forEach((c, i) => {
                    if (assignments[i].length >= perTeam) return;
                    const d = Math.sqrt(Math.pow(p.lat - c.lat, 2) + Math.pow(p.lon - c.lon, 2));
                    if (d < minDist) { minDist = d; nearest = i; }
                });
                assignments[nearest].push(p);
            });
            // Recalculer centroïdes
            assignments.forEach((group, i) => {
                if (group.length > 0) {
                    centroids[i] = { lat: group.reduce((s, p) => s + p.lat, 0) / group.length, lon: group.reduce((s, p) => s + p.lon, 0) / group.length };
                }
            });
        }

        // Dessiner
        if (this._assignLayer) this.map.removeLayer(this._assignLayer);
        this._assignLayer = L.layerGroup().addTo(this.map);
        const results = document.getElementById('assignResults');
        let html = '';
        assignments.forEach((group, i) => {
            const color = colors[i % colors.length];
            group.forEach(p => {
                L.circleMarker([p.lat, p.lon], { radius: 8, color, fillColor: color, fillOpacity: 0.5, weight: 2 }).addTo(this._assignLayer);
            });
            if (centroids[i]) {
                L.marker([centroids[i].lat, centroids[i].lon], {
                    icon: L.divIcon({
                        className: 'team-center',
                        html: `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);">E${i + 1}</div>`,
                        iconSize: [30, 30], iconAnchor: [15, 15]
                    })
                }).addTo(this._assignLayer);
            }
            html += `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;"><span style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;"></span><span style="font-size:12px;">Équipe ${i + 1} : <b>${group.length}</b> ménages</span></div>`;
        });
        if (results) results.innerHTML = html;
        this._notifyRoute(`${assignments.reduce((s, a) => s + a.length, 0)} ménages répartis en ${teamCount} équipes`);
    }

    // =========================================================================
    //  FEATURE 10 : Rapport PDF Cartographique
    // =========================================================================
    _generatePdfReport() {
        this._notifyRoute('📄 Génération du rapport en cours...');

        // Collecter les KPIs
        const normalize = window.normalizeStatus || (s => s);
        const stats = {};
        let total = 0;
        // Reset internal cache for full refresh
        this._allMarkersCache = [];
        this.markers.eachLayer(l => this._allMarkersCache.push(l));

        const markersToUse = this._allMarkersCache.length ? this._allMarkersCache : [];
        if (markersToUse.length) {
            markersToUse.forEach(layer => {
                const s = normalize(layer?.options?._status || '') || 'Inconnu';
                stats[s] = (stats[s] || 0) + 1;
                total++;
            });
        } else if (this.markers) {
            this.markers.eachLayer(layer => {
                const s = normalize(layer?.options?._status || '') || 'Inconnu';
                stats[s] = (stats[s] || 0) + 1;
                total++;
            });
        }

        // Collecter l'historique récent depuis localStorage
        let recentChanges = [];
        try {
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('status_history_')) {
                    const id = k.replace('status_history_', '');
                    const hist = JSON.parse(localStorage.getItem(k) || '[]');
                    hist.forEach(h => recentChanges.push({ id, ...h }));
                }
            });
            recentChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
            recentChanges = recentChanges.slice(0, 15);
        } catch { }

        // Générer un rapport HTML qu'on peut imprimer comme PDF
        const reportWindow = window.open('', '_blank');
        if (!reportWindow) { this._notifyRoute('Popup bloquée — autorisez les popups'); return; }

        const statusRows = Object.entries(stats).sort((a, b) => b[1] - a[1])
            .map(([s, c]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${s}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${c}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#64748b;">${(c / total * 100).toFixed(1)}%</td></tr>`)
            .join('');

        const activityRows = recentChanges.map(h => {
            const d = new Date(h.date);
            const dateStr = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return `<tr><td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-size:11px;">${dateStr}</td><td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-size:11px;">${h.id}</td><td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-size:11px;text-decoration:line-through;color:#94a3b8;">${h.from}</td><td style="padding:4px 8px;border-bottom:1px solid #f1f5f9;font-size:11px;font-weight:600;">${h.to}</td></tr>`;
        }).join('');

        const done = stats['Réception: Validée'] || 0;
        const problems = (stats['Problème'] || 0) + (stats['Inéligible'] || 0);
        const pct = total > 0 ? ((done / total) * 100).toFixed(1) : 0;
        const now = new Date().toLocaleString('fr-FR');

        reportWindow.document.write(`<!DOCTYPE html><html><head><title>Rapport Cartographique — ${now}</title>
            <style>body{font-family:Inter,Segoe UI,sans-serif;margin:0;padding:40px;color:#1e293b;}
            h1{font-size:24px;color:#1d4ed8;margin-bottom:4px;}
            h2{font-size:16px;margin-top:32px;color:#334155;border-bottom:2px solid #e0e7ff;padding-bottom:4px;}
            table{width:100%;border-collapse:collapse;margin:12px 0;}
            th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;}
            .kpi{display:inline-block;background:#eff6ff;padding:16px 28px;border-radius:12px;margin:8px;text-align:center;}
            .kpi-val{font-size:32px;font-weight:800;color:#1d4ed8;}
            .kpi-label{font-size:11px;color:#64748b;margin-top:4px;}
            .bar{background:#e5e7eb;border-radius:6px;height:10px;overflow:hidden;margin-top:12px;}
            .bar-fill{height:100%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:6px;transition:width 0.5s;}
            @media print{body{padding:20px;}}
            </style></head><body>
            <h1>📊 Rapport Cartographique</h1>
            <p style="color:#64748b;font-size:13px;">Généré le ${now}</p>
            <div style="margin:24px 0;">
                <div class="kpi"><div class="kpi-val">${total}</div><div class="kpi-label">Total Ménages</div></div>
                <div class="kpi"><div class="kpi-val" style="color:#22c55e;">${done}</div><div class="kpi-label">Terminés</div></div>
                <div class="kpi"><div class="kpi-val" style="color:#ef4444;">${problems}</div><div class="kpi-label">Problèmes</div></div>
                <div class="kpi"><div class="kpi-val" style="color:#3b82f6;">${pct}%</div><div class="kpi-label">Progression</div></div>
            </div>
            <div class="bar"><div class="bar-fill" style="width:${pct}%;"></div></div>
            <h2>Répartition par Statut</h2>
            <table><thead><tr><th>Statut</th><th style="text-align:right;">Nombre</th><th style="text-align:right;">%</th></tr></thead><tbody>${statusRows}</tbody></table>
            ${recentChanges.length ? `<h2>📝 Activité Récente (${recentChanges.length})</h2>
            <table><thead><tr><th>Date</th><th>Ménage</th><th>Ancien</th><th>Nouveau</th></tr></thead><tbody>${activityRows}</tbody></table>` : ''}
            <div style="margin-top:24px;padding:16px;background:#fefce8;border-radius:8px;border:1px solid #fde68a;">
                <p style="font-size:12px;color:#92400e;"><strong>💡 Note :</strong> Pour sauvegarder en PDF, utilisez <em>Ctrl+P → Enregistrer en PDF</em></p>
            </div>
            <script>window.print();<\/script>
            </body></html>`);
        reportWindow.document.close();
        this._notifyRoute('📄 Rapport ouvert — Ctrl+P pour sauvegarder en PDF');
    }
}


// La classe est exposée globalement
window.MapManager = MapManager;
