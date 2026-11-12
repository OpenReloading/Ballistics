/// <reference lib="webworker" />
// The worker of one edition on Serwist core: built by scripts/inject-precache.ts, which injects the precache list.
import { CacheFirst, NetworkFirst, type PrecacheEntry, Serwist } from 'serwist'
import { edition, storageName } from './edition.ts'

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: (PrecacheEntry | string)[] }

const base = import.meta.env.BASE_URL

/** Same origin and this edition's folder; the stable worker leaves `/next/` and `/docs/` to the network. */
const mine = (url: URL) =>
  url.origin === self.location.origin &&
  url.pathname.startsWith(base) &&
  !(edition === '' && /^\/(next|docs)\//.test(url.pathname))

// before Serwist's listeners: today's page (offline-layer.tsx) sends this string, Serwist itself only `{ type: 'SKIP_WAITING' }`
self.addEventListener('message', (event) => {
  if (event.origin === self.location.origin && event.data === 'skip-waiting')
    void self.skipWaiting()
})

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // not `cacheId`: the constructor names the precache before it applies `cacheId` (serwist dist/index.mjs:1323, 1335)
  precacheOptions: { cacheName: storageName('openreloading-app-precache') },
  skipWaiting: false,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) => request.mode === 'navigate' && mine(url),
      handler: new NetworkFirst({ cacheName: storageName('openreloading-app-pages') }),
    },
    {
      // hashed names: a stored copy never goes stale
      matcher: ({ url }) => mine(url) && url.pathname.startsWith(`${base}assets/`),
      handler: new CacheFirst({ cacheName: storageName('openreloading-app-assets') }),
    },
    {
      // search as you type (`q`) would fill the cache without limit
      matcher: ({ url }) =>
        mine(url) && url.pathname.startsWith(`${base}api/`) && !url.searchParams.has('q'),
      handler: new NetworkFirst({ cacheName: storageName('openreloading-app-records') }),
    },
  ],
  fallbacks: {
    entries: [{ url: `${base}_shell.html`, matcher: ({ request }) => request.mode === 'navigate' }],
  },
})
serwist.addEventListeners()
