/**
 * Fooxchange Service Worker (Version 3.0)
 * 
 * Features:
 * - Caching strategy for offline support
 * - Model file caching for faster AI inference
 * - Versioned updates with user control
 * - Security: Limited scope, no third-party interception
 */

const CACHE_VERSION = 'fooxchange-v3.0.0';
const CACHE_NAME = `${CACHE_VERSION}-static`;
const MODEL_CACHE_NAME = `${CACHE_VERSION}-models`;
const API_CACHE_NAME = `${CACHE_VERSION}-api`;

// Files to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

// API routes to cache (stale-while-revalidate)
const CACHEABLE_API_ROUTES = [
    '/api/recipes',
];

/**
 * Install Event: Cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing version:', CACHE_VERSION);

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => {
            // Don't wait for old SW to finish, activate immediately
            return self.skipWaiting();
        })
    );
});

/**
 * Activate Event: Clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating version:', CACHE_VERSION);

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete old versions but keep current version caches
                    if (cacheName.startsWith('fooxchange-') && !cacheName.startsWith(CACHE_VERSION)) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

/**
 * Fetch Event: Implement caching strategies
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) {
        return;
    }

    // Strategy 1: Model files (Cache First - they have integrity checks)
    if (url.pathname.startsWith('/models/')) {
        event.respondWith(cacheFirstStrategy(request, MODEL_CACHE_NAME));
        return;
    }

    // Strategy 2: API routes (Network First with fallback)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstStrategy(request, API_CACHE_NAME));
        return;
    }

    // Strategy 3: Static assets (Cache First with network fallback)
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
        return;
    }

    // Strategy 4: Pages (Network First)
    event.respondWith(networkFirstStrategy(request, CACHE_NAME));
});

/**
 * Cache First Strategy
 * Best for: Static assets, model files
 */
async function cacheFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
        console.log('[SW] Cache hit:', request.url);
        return cached;
    }

    try {
        console.log('[SW] Cache miss, fetching:', request.url);
        const response = await fetch(request);

        // Cache successful responses
        if (response.ok) {
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', request.url, error);

        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return cache.match('/') || new Response('Offline', { status: 503 });
        }

        throw error;
    }
}

/**
 * Network First Strategy
 * Best for: API calls, dynamic pages
 */
async function networkFirstStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);

    try {
        const response = await fetch(request);

        // Cache successful GET requests
        if (response.ok && request.method === 'GET') {
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        const cached = await cache.match(request);

        if (cached) {
            console.log('[SW] Serving from cache (offline):', request.url);
            return cached;
        }

        console.error('[SW] No cache available for:', request.url);
        throw error;
    }
}

/**
 * Check if pathname is a static asset
 */
function isStaticAsset(pathname) {
    const staticExtensions = [
        '.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg',
        '.woff', '.woff2', '.ttf', '.ico', '.json', '.wasm', '.onnx'
    ];

    return staticExtensions.some(ext => pathname.endsWith(ext));
}

/**
 * Message Handler: Communication with app
 */
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CACHE_MODEL') {
        const { modelPath } = event.data;
        event.waitUntil(
            caches.open(MODEL_CACHE_NAME).then((cache) => {
                return cache.add(modelPath);
            })
        );
    }

    if (event.data.type === 'CLEAR_CACHE') {
        const { cacheName } = event.data;
        event.waitUntil(caches.delete(cacheName || CACHE_NAME));
    }
});

/**
 * Background Sync: Queue failed requests
 * (Optional - requires registration in app)
 */
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-recipes') {
        event.waitUntil(syncRecipes());
    }
});

async function syncRecipes() {
    console.log('[SW] Syncing offline recipes...');

    const SYNC_DB_NAME = 'fooxchange-sync-queue';
    const SYNC_STORE = 'pending-recipes';

    try {
        // Open the sync queue IndexedDB
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(SYNC_DB_NAME, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore(SYNC_STORE, { keyPath: 'id' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        // Read all pending recipes
        const pending = await new Promise((resolve, reject) => {
            const tx = db.transaction(SYNC_STORE, 'readonly');
            const store = tx.objectStore(SYNC_STORE);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (!pending || pending.length === 0) {
            console.log('[SW] No pending recipes to sync');
            return;
        }

        console.log(`[SW] Found ${pending.length} pending recipe(s)`);
        let synced = 0;

        for (const recipe of pending) {
            try {
                const response = await fetch('/api/recipes/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(recipe.data),
                });

                if (response.ok) {
                    // Remove from queue on success
                    await new Promise((resolve, reject) => {
                        const tx = db.transaction(SYNC_STORE, 'readwrite');
                        const store = tx.objectStore(SYNC_STORE);
                        const request = store.delete(recipe.id);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                    synced++;
                    console.log(`[SW] Synced recipe: ${recipe.data?.title || recipe.id}`);
                } else {
                    console.warn(`[SW] Sync failed for ${recipe.id}: HTTP ${response.status}`);
                }
            } catch (err) {
                console.error(`[SW] Failed to sync recipe ${recipe.id}:`, err);
            }
        }

        // Notify all clients that sync completed
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                synced,
                total: pending.length,
            });
        });

        console.log(`[SW] Sync complete: ${synced}/${pending.length} recipes synced`);
        db.close();
    } catch (error) {
        console.error('[SW] Background sync failed:', error);
    }
}

console.log('[SW] Service Worker loaded:', CACHE_VERSION);
