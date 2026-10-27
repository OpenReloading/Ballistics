/**
 * The pure parts of the offline layer. `scripts/service-worker.mts`
 * writes every export of this module into `public/sw.js` ahead of `src/service-worker.js`, so these
 * are the functions the worker runs: no imports, and each refers only to other exports.
 */

/** The prefix of the shell caches. */
export const shellPrefix = 'openreloading-shell-'
/** Records fetched through `/api/`: JSON that stays valid across builds, so no build in the name. */
export const recordsCache = 'openreloading-records'
export const offlinePage = '/offline'

/** Pages precached per build next to the static output: the tools and the offline page. */
export const shellPages = [
  '/',
  '/offline',
  '/workbench',
  '/session',
  '/groups',
  '/firearms',
  '/my-cases',
  '/range',
  '/bullets/designer',
  '/cartridges/designer',
]

/** Files precached with the pages: the manifest and its icons. */
export const shellFiles = ['/manifest.webmanifest', '/icon.png', '/icon-192.png', '/apple-icon.png']

export const shellCache = (version: string) => shellPrefix + version

/**
 * The caches a worker of `version` deletes on activation: the shells of other builds but the newest
 * of them (`names` in creation order, as `caches.keys()` gives them), whose chunks tabs still on
 * that build load later.
 * shortcut: a tab open across two deploys still loses its chunks; keep more shells if that matters.
 */
export const staleCaches = (names: string[], version: string) =>
  names.filter((n) => n.startsWith(shellPrefix) && n !== shellCache(version)).slice(0, -1)

/** How long a network-first request waits before a cached copy answers (ms). */
export const slowNetwork = 4000

/**
 * Network first: the network's answer, or `cached` when the network fails, answers with a server
 * error or takes longer than `ms`; without a cached copy the network's answer or failure.
 */
export const networkOr = <T extends { status: number }>(
  network: Promise<T>,
  cached: T | undefined,
  ms = slowNetwork,
) =>
  cached
    ? Promise.race([
        network.then(
          (res) => (res.status < 500 ? res : cached),
          () => cached,
        ),
        new Promise<T>((ok) => setTimeout(ok, ms, cached)),
      ])
    : network

/**
 * The URL of an app path under `base` (the Pages edition's base path, `''` in the server edition). A
 * page ends in `slash` (`'/'` in the Pages edition, whose pages are `<path>/index.html`).
 */
export const appUrl = (base: string, path: string, slash = '') =>
  base + (path === '/' ? '/' : path + slash)

/** The Pages edition's catalogue index (`writeStaticApi`), which every list reads: precached, so lists work offline. */
export const catalogueFile = '/api/catalogue/index.json'

/**
 * URLs of the files under `.next/static` (paths relative to it) without maps, in the Pages edition
 * (`pages`) also the catalogue index.
 */
export const precacheList = (files: string[], base = '', pages = false) =>
  [
    ...files.filter((f) => !/\.map$/.test(f)).map((f) => `${base}/_next/static/${f}`),
    ...(pages ? [base + catalogueFile] : []),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/** The cache key of a page: its path and query without Next's `_rsc` parameter. */
export const pageKey = (url: string) => {
  const u = new URL(url)
  u.searchParams.delete('_rsc')
  return u.pathname + u.search
}

/**
 * The shell cache's answer to a request for `destination`. A cached response carries its key without
 * query and fragment, and a worker takes its script response's URL as `location`, so a worker script
 * gets a copy without a URL: the worker keeps the URL it was started with (its bootstrap reads the
 * `#params=` fragment).
 */
export const shellAnswer = (cached: Response, destination: string) =>
  destination === 'worker' ? new Response(cached.body, cached) : cached

/**
 * How the worker answers a request: `static` from the shell cache (the chunks, the manifest and
 * icons, the Pages catalogue index), `records` network-first with
 * the cached record behind it, `page` network-first with the cached page and the offline page
 * behind it, `navigation` (a client navigation fetching RSC) from the network while the page's HTML
 * is stored; undefined leaves the request to the network (POST /interior, searches, prefetches,
 * other origins, paths outside `base` and the docs site under `<base>/docs/`).
 */
export const strategyOf = (
  request: {
    method: string
    url: string
    mode: string
    headers: { get(name: string): string | null }
  },
  origin: string,
  base = '',
) => {
  const u = new URL(request.url)
  if (request.method !== 'GET' || u.origin !== origin || !u.pathname.startsWith(`${base}/`)) return
  const path = u.pathname.slice(base.length)
  if (path.startsWith('/docs/')) return
  // the catalogue index is as old as its build, so it comes from the build's shell cache
  if (path.startsWith('/_next/static/') || shellFiles.includes(path) || path === catalogueFile)
    return 'static'
  // search as you type (`q`) would fill the records cache without limit
  if (path.startsWith('/api/')) return u.searchParams.has('q') ? undefined : 'records'
  if (request.mode === 'navigate') return 'page'
  const h = request.headers
  if (h.get('rsc') && !h.get('next-router-prefetch') && !h.get('next-router-segment-prefetch'))
    return 'navigation'
  return
}
