class KoboApiService {
    constructor() {
        this.servers = [
            'https://kf.kobotoolbox.org/api/v2',              // Global Server (Default)
            'https://kobo.humanitarianresponse.info/api/v2'   // OCHA Server
        ];
        this.activeUrl = this.servers[0];
    }

    /**
     * Teste la connexion et détecte le bon serveur
     * @param {string} token - Clé API
     * @param {string} assetUid - (Optionnel) ID pour vérifier l'accès spécifique
     */
    async testConnection(token, assetUid = null) {
        // Si proxy Electron dispo, utiliser le canal sécurisé
        if (typeof window !== 'undefined' && window.koboProxy?.testConnection) {
            return window.koboProxy.testConnection(token, assetUid);
        }

        const tryFetch = async (url, useProxy = false) => {
            const finalUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(url)}` : url;
            try {
                const response = await fetch(finalUrl, {
                    method: 'GET',
                    headers: { 'Authorization': `Token ${token}` }
                });
                return response;
            } catch (e) {
                if (e.message.includes('Failed to fetch') && !useProxy) {
                    throw new Error('CORS_ERROR');
                }
                throw e;
            }
        };

        for (const baseUrl of this.servers) {
            console.log(`📡 Test connexion sur: ${baseUrl}...`);
            const endpoint = assetUid ? `${baseUrl}/assets/${assetUid}/` : `${baseUrl}/assets/`;

            try {
                // FORCE PROXY : Pour éviter l'erreur rouge "CORS" dans la console
                // On assume qu'on est en web/local et que l'API Kobo bloque l'accès direct
                let response;

                try {
                    // Tentative PROXY directe (Priority 1)
                    console.log('🛡️ Tentative via Proxy (Priority)...');
                    response = await tryFetch(endpoint, true);
                } catch (e) {
                    // Fallback Direct (Peu probable que ça marche si Proxy échoue, mais sait-on jamais)
                    console.log('⚠️ Proxy échoué, tentative directe...');
                    response = await tryFetch(endpoint, false);
                }

                if (response.ok) {
                    this.activeUrl = baseUrl;
                    console.log(`✅ Serveur détecté: ${baseUrl}`);
                    return { success: true, server: baseUrl };
                } else if (response.status === 404 && assetUid) {
                    console.warn(`Serveur ${baseUrl}: UID non trouvé`);
                } else if (response.status === 401) {
                    return { success: false, error: 'Token invalide' };
                }

            } catch (error) {
                console.warn(`Échec total sur ${baseUrl}:`, error.message);
            }
        }
        return { success: false, error: 'Connexion impossible (Vérifiez Token/UID/Internet)' };
    }

    /**
     * Récupère les données
     */
    async fetchData(token, assetUid) {
        if (!token || !assetUid) throw new Error('Token et ID requis');

        // Si on est dans Electron avec proxy, utiliser l'IPC
        if (typeof window !== 'undefined' && window.koboProxy?.fetchData) {
            return window.koboProxy.fetchData(token, assetUid);
        }

        const url = `${this.activeUrl}/assets/${assetUid}/data/?format=json`;

        const doFetch = async (targetUrl) => {
            return fetch(targetUrl, {
                headers: { 'Authorization': `Token ${token}` }
            });
        };

        try {
            // CHAINAGE DE PROXYS (Anti-CORS Robustesse)
            // 1. ThingProxy (Freeboard) - Supporte souvent les headers
            // 2. CorsProxy.io - Rapide mais parfois bloqué
            // 3. Cors-Anywhere - Nécessite parfois une activation temporaire

            const proxies = [
                (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
                (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
                (u) => `https://cors-anywhere.herokuapp.com/${u}`
            ];

            let lastError;
            for (const proxyGen of proxies) {
                try {
                    const proxyUrl = proxyGen(url);
                    console.log(`Trying Proxy: ${proxyUrl.substring(0, 50)}...`);
                    const response = await doFetch(proxyUrl);

                    if (response.ok) {
                        console.log('✅ Proxy success!');
                        const data = await response.json();
                        return data.results || data;
                    } else {
                        // Si 403/Forbidden sur Cors-Anywhere, c'est spécifique
                        if (response.status === 403 && proxyUrl.includes('cors-anywhere')) {
                            console.warn('Cors-Anywhere requires demo activation');
                        }
                        throw new Error(`Status ${response.status}`);
                    }
                } catch (e) {
                    console.warn(`Proxy failed:`, e.message);
                    lastError = e;
                }
            }

            // Si on arrive ici, tout a échoué.
            // On lance une erreur spécifique pour l'UI
            throw new Error('CORS_ALL_FAILED');

        } catch (error) {
            console.error('Kobo Fetch Error:', error);
            throw error;
        }
    }
}

// Export global
window.KoboApiService = new KoboApiService();
