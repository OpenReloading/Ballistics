/** The root `404.html` of the Pages site: GitHub Pages answers every miss with it, also under `next/`, so it hands the miss to its edition's `404.edition.html` (that edition's app shell). */

/** The `404.edition.html` that answers a miss at `pathname`; undefined for a stable path when `onlyNext`. Runs in the browser too (embedded as source), so it uses nothing outside itself. */
export function editionFallback(pathname: string, siteBase: string, onlyNext: boolean) {
  // GitHub Pages may match the repository segment without regard to case
  if (pathname.toLowerCase().startsWith(`${siteBase}/next/`.toLowerCase()))
    return `${siteBase}/next/404.edition.html`
  return onlyNext ? undefined : `${siteBase}/404.edition.html`
}

const fallbackMarkup = (home: string) =>
  `<meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found</title><h1>Page not found</h1><p><a href="${home}">RangeFoundry Workbench</a></p>`

const fallbackPage = (home: string, script: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8">${script}${fallbackMarkup(home)}</html>\n`

/** JSON for an inline script: no `</script>` can end it early. */
const embed = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')

/** The inline script, first in `head`: a `next/` miss shows that edition's fallback at once and the rest of the page as hidden inert text (no `window.stop()`, after which `document.open()` does nothing); an ok answer of the edition's `404.edition.html` replaces the document after parsing, once `readyState` is `complete`; a non-ok answer or a failed fetch leaves the fallback on screen, so a missing file cannot loop or go blank. */
function dispatchScript(siteBase: string, onlyNext: boolean) {
  return `<script>(() => {
const editionFallback = ${String(editionFallback)}
const base = ${embed(siteBase)}
const u = editionFallback(location.pathname, base, ${onlyNext})
if (!u) return
if (u === base + '/next/404.edition.html') document.write(${embed(fallbackMarkup(`${siteBase}/next/`))} + '<plaintext hidden>')
fetch(u).then((r) => r.ok ? r.text() : undefined).then((t) => {
  if (t === undefined) return
  const write = () => { document.open(); document.write(t); document.close() }
  if (document.readyState === 'complete') write()
  else addEventListener('load', write)
}, () => {})
})()</script>`
}

/** The root `404.html` once both editions build with Start; its static body is what a browser without scripts and a crawler see. `siteBase`: "" or a path such as /Ballistics. */
export const rootNotFound = (siteBase: string) =>
  fallbackPage(`${siteBase}/`, dispatchScript(siteBase, false))

/** Next's exported 404 page with the script after its charset element, before any Next script or preload; acts only under `next/`. */
export function withNextDispatch(html: string, siteBase: string) {
  const charsets = html.match(/<meta charset=[^>]*>/gi) ?? []
  if (charsets.length !== 1)
    throw new Error(`Expected one charset element in the 404 page, found ${charsets.length}`)
  return html.replace(/<meta charset=[^>]*>/i, (meta) => `${meta}${dispatchScript(siteBase, true)}`)
}
