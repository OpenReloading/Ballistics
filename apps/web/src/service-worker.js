// The service worker of the offline layer. `scripts/service-worker.mts`
// writes it to out/sw.js after `next build`, preceded by
// `version` (the build id), `precache` (the static output), `base` and `slash` (`appUrl`), `edition` and the
// exports of src/lib/offline.ts. It never opens IndexedDB.

const shell = shellCache(version, edition)
const records = recordsCache(edition)

/** Stores a page's HTML once per build; failures are ignored (the page is fetched again later). */
async function keepPage(key) {
  const cache = await caches.open(shell)
  if (await cache.match(key)) return
  const res = await fetch(key)
  if (res.ok) await cache.put(key, res)
}

/** Stores an ok response in the background, so the page gets the response while it streams. */
function store(event, name, key, res) {
  if (!res.ok) return
  const copy = res.clone()
  event.waitUntil(
    caches
      .open(name)
      .then((cache) => cache.put(key, copy))
      .catch(() => {}),
  )
}

async function fromShell(event) {
  // this build's shell first: the manifest and icons keep their names across builds; the previous
  // shell then answers the chunks of tabs still on that build
  const cached =
    (await (await caches.open(shell)).match(event.request, { ignoreSearch: true })) ??
    (await caches.match(event.request, { ignoreSearch: true }))
  if (cached) return shellAnswer(cached, event.request.destination)
  const res = await fetch(event.request)
  store(event, shell, event.request, res)
  return res
}

/** The network's answer, stored under `key` in `name` while `cached` stands behind it (networkOr). */
function networkFirst(event, name, key, cached) {
  const network = fetch(event.request).then((res) => {
    store(event, name, key, res)
    return res
  })
  // a copy that answered first: the network's answer is still stored
  event.waitUntil(network.catch(() => {}))
  return networkOr(network, cached)
}

async function fromNetworkPage(event) {
  const key = pageKey(event.request.url)
  const cache = await caches.open(shell)
  const stored = slashedKey(key, slash)
  // a copied link carries a query the stored page lacks
  const cached =
    (await cache.match(key)) ??
    (await cache.match(stored)) ??
    (await cache.match(stored, { ignoreSearch: true })) ??
    (await cache.match(key, { ignoreSearch: true }))
  try {
    return await networkFirst(event, shell, key, cached)
  } catch (error) {
    const offline = await cache.match(appUrl(base, offlinePage, slash))
    if (offline) return offline
    throw error
  }
}

async function fromNetworkRecord(event) {
  const cached = await caches.match(event.request, { cacheName: records })
  return networkFirst(event, records, event.request, cached)
}

self.addEventListener('install', (event) => {
  const urls = [
    ...shellPages.map((p) => appUrl(base, p, slash)),
    ...shellFiles.map((f) => appUrl(base, f)),
    ...precache,
  ]
  event.waitUntil(
    caches
      .open(shell)
      .then((cache) => cache.addAll(urls.map((u) => new Request(u, { cache: 'reload' })))),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(staleCaches(names, version, edition).map((n) => caches.delete(n)))
      await self.clients.claim()
      // the page that registered the worker loaded before it: store it too (its data files it stores itself, `keepForOffline` in `data-file.ts`)
      const windows = await self.clients.matchAll({ type: 'window' })
      await Promise.all(windows.map((w) => keepPage(pageKey(w.url)).catch(() => {})))
    })(),
  )
})

// the page's Reload on the update notice; the waiting worker never takes over on its own
self.addEventListener('message', (event) => {
  if (event.origin === self.location.origin && event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const kind = strategyOf(event.request, self.location.origin, base)
  if (kind === 'static') event.respondWith(fromShell(event))
  else if (kind === 'records') event.respondWith(fromNetworkRecord(event))
  else if (kind === 'page') event.respondWith(fromNetworkPage(event))
  else if (kind === 'navigation')
    event.waitUntil(keepPage(pageKey(event.request.url)).catch(() => {}))
})
