/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>;
};

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';
const STATIC_CACHE = `combar-static-v${APP_VERSION}`;
const API_CACHE = `combar-api-v${APP_VERSION}`;
const SHELL_CACHE = `combar-shell-v${APP_VERSION}`;
const CURRENT_CACHES = new Set([STATIC_CACHE, API_CACHE, SHELL_CACHE]);

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => {
        const isCurrent = CURRENT_CACHES.has(cacheName);
        const isWorkboxPrecache = cacheName.startsWith('workbox-precache');
        if (isCurrent || isWorkboxPrecache) return Promise.resolve(false);
        return caches.delete(cacheName);
      }),
    );
  })());
});

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['script', 'style', 'image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'GET',
);

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
  new CacheFirst({
    cacheName: SHELL_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    return (await matchPrecache('/index.html')) || Response.error();
  }
  return Response.error();
});
