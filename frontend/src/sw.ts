/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>;
};

const SW_VERSION = 'v2';
const RUNTIME_CACHE_PREFIXES = ['google-fonts-cache', 'gstatic-fonts-cache', 'api-products-cache'];

const CACHE_NAMES = {
  googleFonts: `google-fonts-cache-${SW_VERSION}`,
  gstaticFonts: `gstatic-fonts-cache-${SW_VERSION}`,
  apiProducts: `api-products-cache-${SW_VERSION}`,
};

console.info(`[SW ${SW_VERSION}] Booting service worker`);

self.skipWaiting();
clientsClaim();

self.addEventListener('install', () => {
  console.info(`[SW ${SW_VERSION}] install -> skipWaiting()`);
});

self.addEventListener('activate', (event) => {
  console.info(`[SW ${SW_VERSION}] activate -> clientsClaim() and cache cleanup`);

  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      const validRuntimeCaches = new Set(Object.values(CACHE_NAMES));
      const staleRuntimeCaches = cacheNames.filter((cacheName) => {
        const isManagedRuntimeCache = RUNTIME_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix));
        return isManagedRuntimeCache && !validRuntimeCaches.has(cacheName);
      });

      if (staleRuntimeCaches.length > 0) {
        console.info(`[SW ${SW_VERSION}] deleting stale caches:`, staleRuntimeCaches);
      }

      await Promise.all(staleRuntimeCaches.map((cacheName) => caches.delete(cacheName)));
      console.info(`[SW ${SW_VERSION}] cache cleanup completed`);
    }),
  );
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  /^https?:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: CACHE_NAMES.googleFonts,
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  /^https?:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: CACHE_NAMES.gstaticFonts,
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  /\/api\/products$/,
  new NetworkFirst({
    cacheName: CACHE_NAMES.apiProducts,
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);
