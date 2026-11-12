/** A Next href (`/bullets/?q=x#y`, or an external URL) as the router's `to`, `search` and `hash`. */
export function routerTarget(href: string) {
  const url = new URL(href, 'http://app.invalid')
  return {
    external: url.origin !== 'http://app.invalid',
    to: url.pathname,
    search: Object.fromEntries(url.searchParams),
    hash: url.hash.slice(1) || undefined,
  }
}

/** Next's `UrlObject` form of `href`, as a string. */
export function hrefString(
  href: string | { pathname?: string | null; search?: string | null; hash?: string | null },
) {
  if (typeof href === 'string') return href
  return `${href.pathname ?? ''}${href.search ?? ''}${href.hash ?? ''}`
}
