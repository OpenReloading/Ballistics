/** `scripts/service-worker.mts` writes every export into `out/sw.js`, so no imports and only references to other exports. */

/** The editions of one origin keep separate databases, local storage keys and caches. */
export const editionName = (edition: string, name: string) =>
  edition ? `${edition}:${name}` : name

/** The prefix of the shell caches of `edition`. */
export const shellPrefix = (edition = '') => editionName(edition, 'openreloading-shell-')
/** Records fetched through `/api/`: JSON that stays valid across builds, so no build in the name. */
export const recordsCache = (edition = '') => editionName(edition, 'openreloading-records')
export const offlinePage = '/offline'

/** Every page route but the record pages, which stay network-first. */
export const shellPages = [
  '/',
  '/offline',
  '/workbench',
  '/session',
  '/groups',
  '/firearms',
  '/firearms/log',
  '/events',
  '/cases/editor',
  '/range',
  '/bullets/designer',
  '/cartridges/designer',
  '/cartridges',
  '/bullets',
  '/powders',
  '/cases',
  '/primers',
  '/targets',
  '/disciplines',
  '/federations',
  '/bullets/compare',
  '/powders/burn-rates',
  '/powders/designer',
  '/powders/tune',
  '/targets/designer',
]

/** Files precached with the pages: the manifest and its icons. */
export const shellFiles = ['/manifest.webmanifest', '/icon.png', '/icon-192.png', '/apple-icon.png']

export const shellCache = (version: string, edition = '') => shellPrefix(edition) + version

/** The newest other shell stays for tabs still on that build; shortcut: a tab open across two deploys loses its chunks, keep more shells if that matters. */
export const staleCaches = (names: string[], version: string, edition = '') =>
  names
    .filter((n) => n.startsWith(shellPrefix(edition)) && n !== shellCache(version, edition))
    .slice(0, -1)

/** How long a network-first request waits before a cached copy answers (ms). */
export const slowNetwork = 4000

/** `cached` answers a network failure, a server error or a wait over `ms`. */
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

/** Pages are `<path>/index.html`, hence `slash`. */
export const appUrl = (base: string, path: string, slash = '') =>
  base + (path === '/' ? '/' : path + slash)

/** The catalogue index (`writeStaticApi`), which every list reads: precached, so lists work offline. */
export const catalogueFile = '/api/catalogue/index.json'

/** URLs of the files under `.next/static` (paths relative to it) without maps, and the catalogue index. */
export const precacheList = (files: string[], base = '') =>
  [
    ...files.filter((f) => !/\.map$/.test(f)).map((f) => `${base}/_next/static/${f}`),
    base + catalogueFile,
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/** The cache key of a page: its path and query without Next's `_rsc` parameter. */
export const pageKey = (url: string) => {
  const u = new URL(url)
  u.searchParams.delete('_rsc')
  return u.pathname + u.search
}

/** The shell stores pages under `appUrl`, while a typed or linked address keeps its path as given. */
export const slashedKey = (key: string, slash = '') => {
  const i = key.indexOf('?')
  const path = i < 0 ? key : key.slice(0, i)
  return slash && !path.endsWith(slash) ? path + slash + key.slice(path.length) : key
}

/** A worker takes its script response's URL as `location`, so it gets a copy without a URL and keeps its `#params=` fragment. */
export const shellAnswer = (cached: Response, destination: string) =>
  destination === 'worker' ? new Response(cached.body, cached) : cached

/** Undefined leaves the request to the network, including the docs and the `next` edition, whose own worker has that scope. */
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
  if (path.startsWith('/docs/') || path.startsWith('/next/')) return
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
