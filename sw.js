const CACHE_NAME = 'proquelec-v3-cache-v3';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './logistique.html',
    './cahier-equipes.html',
    './terrain.html',
    './audit_systeme.html',
    './parametres.html',
    './rapports.html',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('👷 [Service Worker] Caching App Shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME).map(name => {
                    console.log('👷 [Service Worker] Deleting old cache:', name);
                    return caches.delete(name);
                })
            );
        })
    );
    self.clients.claim();
});

// Stale-While-Revalidate
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);

    // Don't cache third‑party resources
    if (url.origin !== location.origin) {
        return;
    }

    // bypass cache for scripts (especially those that were previously missing)
    if (url.pathname.endsWith('.js')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // only cache basic same‑origin GET responses (not JS, see above)
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // offline and no cache
            });

            return cachedResponse || fetchPromise;
        })
    );
});
