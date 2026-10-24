/**
 * The API over the catalogue of the data bundle, and the files of its read answers that the web
 * app's Pages edition serves instead of an API (`@openreloading/api/static`, used at build time
 * only).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildApp } from './app.ts'
import { loadBundle } from './bundle.ts'
import { buildCatalogue } from './catalogue/build.ts'
import { openCatalogue } from './catalogue/open.ts'
import { inlineRunner } from './compute/tasks.ts'
import { API_PREFIX } from './version.ts'

/** The list routes whose answers `writeStaticApi` writes. */
const staticKinds = [
  'cartridges',
  'bullets',
  'powders',
  'manufacturers',
  'target-faces',
  'federations',
  'disciplines',
  'target-mappings',
] as const

type App = ReturnType<typeof buildApp>
type Item = { id: string }
type List = { total: number; items: Item[] }

/**
 * Starts the API on 127.0.0.1 at a free port over the catalogue of the bundle, compute in this
 * thread. `url` is its origin, `close` stops it.
 */
export async function startBundleApi() {
  const catalogue = openCatalogue(buildCatalogue(loadBundle()))
  const app = buildApp({ catalogue, compute: inlineRunner })
  const url = await app.listen({ host: '127.0.0.1', port: 0 })
  return { app, url, close: () => app.close() }
}

async function get<T>(app: App, url: string): Promise<T> {
  const res = await app.inject({ url: `${API_PREFIX}${url}` })
  if (res.statusCode !== 200) throw new Error(`GET ${url} answered ${res.statusCode}`)
  return res.json() as T
}

/** Every item of a list route, in pages of 200 where the route pages. */
async function listAll(app: App, url: string): Promise<List> {
  const first = await get<List>(app, url)
  if (first.items.length >= first.total) return first
  const items: Item[] = []
  const join = url.includes('?') ? '&' : '?'
  while (items.length < first.total) {
    const page = await get<List>(app, `${url}${join}limit=200&offset=${items.length}`)
    if (page.items.length === 0) break
    items.push(...page.items)
  }
  return { total: items.length, items }
}

/**
 * Writes the read answers of `app` under `dir`, as the Pages edition reads them:
 * `<kind>/index.json` (every item of the list), `<kind>/<id>.json` (each record),
 * `<kind>/search.json` for cartridges, bullets and powders (by id, the search key of the
 * catalogue's index that `q` is ranked against) and `bullets/cartridge/<cartridge id>.json` (the bullets that fit it, none written when
 * none fits).
 */
export async function writeStaticApi(app: App, dir: string) {
  const write = async (file: string, value: unknown) => {
    const to = path.join(dir, `${file}.json`)
    await mkdir(path.dirname(to), { recursive: true })
    await writeFile(to, JSON.stringify(value))
  }
  const lists = new Map<string, List>()
  for (const kind of staticKinds) {
    const list = await listAll(app, `/${kind}`)
    lists.set(kind, list)
    await write(`${kind}/index`, list)
    for (const { id } of list.items)
      await write(`${kind}/${id}`, await get<Record<string, unknown>>(app, `/${kind}/${id}`))
  }

  const { index } = buildCatalogue(loadBundle())
  for (const kind of ['cartridges', 'bullets', 'powders'] as const)
    await write(
      `${kind}/search`,
      Object.fromEntries(index[kind].map((row) => [row.item.id, row.search])),
    )
  for (const { id } of lists.get('cartridges')?.items ?? []) {
    const fits = await listAll(app, `/bullets?cartridge=${id}`)
    if (fits.items.length > 0) await write(`bullets/cartridge/${id}`, fits)
  }
}
