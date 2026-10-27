/**
 * The API over the catalogue of the data bundle, and the data files the web app
 * serves instead of an API (`@open-reloading/api/static`, used at build time only).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildApp } from './app.ts'
import { loadBundle } from './bundle.ts'
import { buildCatalogue } from './catalogue/build.ts'
import { openCatalogue } from './catalogue/open.ts'
import type { Catalogue, CatalogueData, Catalogued, CatalogueKind } from './catalogue/types.ts'
import { inlineRunner } from './compute/tasks.ts'
import { cartridgeAnswer } from './routes/cartridges.ts'
import { originated, revised, stored } from './routes/common.ts'

/** The records `writeStaticApi` writes, by the name of their route and the list of the index. */
const recordFiles = [
  ['cartridges', 'cartridge', 'cartridges'],
  ['bullets', 'bullet', 'bullets'],
  ['powders', 'powder', 'powders'],
  ['primers', 'primer', 'primers'],
  ['cases', 'case', 'cases'],
  ['manufacturers', 'manufacturer', 'manufacturers'],
  ['target-faces', 'targetFace', 'targetFaces'],
  ['federations', 'federation', 'federations'],
  ['disciplines', 'discipline', 'disciplines'],
  ['target-mappings', 'targetMapping', 'targetMappings'],
  ['caliber-classes', 'caliberClass', 'caliberClasses'],
] as const satisfies readonly (readonly [string, CatalogueKind, keyof CatalogueData['index']])[]

/**
 * Starts the API on 127.0.0.1 at a free port over the catalogue of the bundle, compute in this
 * thread. `url` is its origin, `close` stops it, `data` is the catalogue's index and records.
 */
export async function startBundleApi() {
  const data = buildCatalogue(loadBundle())
  const app = buildApp({ catalogue: openCatalogue(data), compute: inlineRunner })
  const url = await app.listen({ host: '127.0.0.1', port: 0 })
  return { app, url, data, close: () => app.close() }
}

/** The body the API's `GET /<kind>/<id>` answers for a record of the catalogue. */
function recordAnswer(catalogue: Catalogue, kind: CatalogueKind, id: string) {
  if (kind === 'cartridge') return cartridgeAnswer(catalogue, id)
  const found = catalogue.get(kind, id)
  if (!found) return
  if (kind === 'bullet') return revised(found as Catalogued<'bullet'>)
  return kind === 'case' ? originated(found) : stored(found)
}

/**
 * Writes the data files of the static site under `dir`: `catalogue/index.json` (the catalogue
 * index, which the browser opens with `openCatalogue` and answers every list from) and
 * `<kind>/<id>.json` for each record, the body of the API's `GET /<kind>/<id>`.
 */
export async function writeStaticApi(data: CatalogueData, dir: string) {
  const catalogue = openCatalogue(data)
  const write = async (file: string, value: unknown) => {
    const to = path.join(dir, `${file}.json`)
    await mkdir(path.dirname(to), { recursive: true })
    await writeFile(to, JSON.stringify(value))
  }
  await write('catalogue/index', data.index)
  for (const [route, kind, list] of recordFiles)
    for (const { item } of data.index[list])
      await write(`${route}/${item.id}`, recordAnswer(catalogue, kind, item.id))
}
