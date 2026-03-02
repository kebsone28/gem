/**
 * ApiService.js — HTTP client for the Express REST API
 * Provides dual-mode operation: API (online) or IndexedDB (offline)
 */
(function () {
    'use strict';

    class ApiService {
        constructor() {
            // Auto-detect API URL: same origin when served by Nginx, or explicit
            this._baseUrl = this._detectBaseUrl();
            this._token = localStorage.getItem('auth_token') || null;
            this._user = JSON.parse(localStorage.getItem('auth_user') || 'null');
            this._online = null; // null = not checked yet
            this._listeners = [];

            // Check connectivity on init
            this._checkOnline();

            // Listen for network changes
            window.addEventListener('online', () => this._checkOnline());
            window.addEventListener('offline', () => { this._online = false; this._notify(); });
        }

        // ====== Config ======
        _detectBaseUrl() {
            // If served by Nginx (same origin), use relative path
            if (window.location.protocol !== 'file:') {
                return '/api';
            }
            // Local dev: point to Docker API
            return localStorage.getItem('api_url') || 'http://localhost:3000/api';
        }

        get baseUrl() { return this._baseUrl; }
        set baseUrl(url) { this._baseUrl = url; localStorage.setItem('api_url', url); }

        // ====== Auth ======
        get isAuthenticated() { return !!this._token; }
        get currentUser() { return this._user; }
        get token() { return this._token; }

        async login(username, password) {
            const res = await this._fetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: username, password })
            });
            if (res.accessToken || res.token) {
                this._token = res.accessToken || res.token;
                // normalize role to lowercase for consistency
                if (res.user && res.user.role) {
                    res.user.role = res.user.role.toLowerCase();
                }
                this._user = res.user;
                localStorage.setItem('auth_token', this._token);
                localStorage.setItem('auth_user', JSON.stringify(res.user));
            }
            return res;
        }

        logout() {
            this._token = null;
            this._user = null;
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
        }

        // ====== Online/Offline ======
        get isOnline() { return this._online === true; }

        async _checkOnline() {
            try {
                const resp = await fetch(this._baseUrl + '/health', { method: 'GET', signal: AbortSignal.timeout(5000) });
                this._online = resp.ok;
            } catch (e) {
                this._online = false;
            }
            this._notify();
            return this._online;
        }

        onStatusChange(cb) { this._listeners.push(cb); }
        _notify() { this._listeners.forEach(cb => cb(this._online)); }

        // ====== HTTP Helper ======
        async _fetch(path, options = {}) {
            const url = this._baseUrl + path;
            const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
            if (this._token) headers['Authorization'] = 'Bearer ' + this._token;

            const resp = await fetch(url, {
                ...options,
                headers,
                signal: options.signal || AbortSignal.timeout(30000)
            });

            if (resp.status === 401 || resp.status === 403) {
                this.logout();
                throw new Error('Session expirée — veuillez vous reconnecter');
            }

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || `Erreur ${resp.status}`);
            return data;
        }

        // ====== Households ======
        async getHouseholds(filters = {}) {
            const params = new URLSearchParams();
            if (filters.zone) params.set('zone', filters.zone);
            if (filters.status) params.set('status', filters.status);
            if (filters.commune) params.set('commune', filters.commune);
            if (filters.limit) params.set('limit', filters.limit);
            if (filters.offset) params.set('offset', filters.offset);
            const qs = params.toString();
            return this._fetch('/households' + (qs ? '?' + qs : ''));
        }

        async getHousehold(id) {
            return this._fetch('/households/' + encodeURIComponent(id));
        }

        async saveHousehold(household) {
            return this._fetch('/households', {
                method: 'POST',
                body: JSON.stringify(household)
            });
        }

        async updateHousehold(id, data) {
            return this._fetch('/households/' + encodeURIComponent(id), {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        }

        async deleteHousehold(id) {
            return this._fetch('/households/' + encodeURIComponent(id), { method: 'DELETE' });
        }

        // ====== Projects ======
        async getProjects() { return this._fetch('/projects'); }
        async saveProject(project) { return this._fetch('/projects', { method: 'POST', body: JSON.stringify(project) }); }
        async updateProject(id, data) { return this._fetch('/projects/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(data) }); }

        // ====== Teams ======
        async getTeams(projectId) {
            const qs = projectId ? '?project_id=' + encodeURIComponent(projectId) : '';
            return this._fetch('/teams' + qs);
        }
        async saveTeam(team) { return this._fetch('/teams', { method: 'POST', body: JSON.stringify(team) }); }

        // ====== Deliveries ======
        async getDeliveries(filters = {}) {
            const params = new URLSearchParams();
            if (filters.household_id) params.set('household_id', filters.household_id);
            if (filters.agent) params.set('agent', filters.agent);
            if (filters.from) params.set('from', filters.from);
            if (filters.to) params.set('to', filters.to);
            return this._fetch('/deliveries?' + params.toString());
        }

        // ====== Sync (Bulk) ======
        /**
         * Push all local IndexedDB data to server
         */
        async pushToServer() {
            if (!this.isOnline || !this.isAuthenticated) {
                throw new Error('Impossible de synchroniser: pas connecté ou pas authentifié');
            }

            const db = window.db;
            if (!db) throw new Error('Base locale non initialisée');

            const [households, projects, teams] = await Promise.all([
                db.households.toArray(),
                db.projects.toArray(),
                db.teams ? db.teams.toArray() : Promise.resolve([])
            ]);

            console.log(`📤 Pushing to server: ${households.length} households, ${projects.length} projects, ${teams.length} teams`);

            const result = await this._fetch('/sync', {
                method: 'POST',
                body: JSON.stringify({ households, projects, teams }),
                signal: AbortSignal.timeout(120000) // 2 min for large syncs
            });

            console.log('📤 Sync results:', result);
            return result;
        }

        /**
         * Pull all server data into local IndexedDB
         * @param {string} since - ISO date, only pull records updated after this
         */
        async pullFromServer(since = null) {
            if (!this.isOnline || !this.isAuthenticated) {
                throw new Error('Impossible de récupérer: pas connecté ou pas authentifié');
            }

            const qs = since ? '?since=' + encodeURIComponent(since) : '';
            const data = await this._fetch('/sync/pull' + qs, {
                signal: AbortSignal.timeout(120000)
            });

            console.log(`📥 Pulled from server: ${data.households?.length} households, ${data.projects?.length} projects, ${data.teams?.length} teams`);

            // Upsert into local IndexedDB
            const db = window.db;
            if (!db) throw new Error('Base locale non initialisée');

            if (data.projects?.length) {
                await db.projects.bulkPut(data.projects);
            }
            if (data.teams?.length && db.teams) {
                await db.teams.bulkPut(data.teams);
            }
            if (data.households?.length) {
                await db.households.bulkPut(data.households);
            }

            // Store last sync time
            localStorage.setItem('last_sync_pull', data.syncedAt || new Date().toISOString());

            return data;
        }

        /**
         * Full bidirectional sync
         */
        async fullSync() {
            const pushResult = await this.pushToServer();
            const lastSync = localStorage.getItem('last_sync_pull');
            const pullResult = await this.pullFromServer(lastSync);
            return { push: pushResult, pull: pullResult };
        }
    }

    // ====== Global Instance ======
    window.apiService = new ApiService();
    console.log('🌐 ApiService initialized, base URL:', window.apiService.baseUrl);

})();
