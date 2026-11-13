/** The API over the catalogue of the data bundle, and the data files the web app serves in its place (`@open-reloading/api/static`, build time only). */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { inlineRunner } from '@rangefoundry/use-cases'
import {
  buildCatalogue,
  type Catalogue,
  type CatalogueData,
  type Catalogued,
  type CatalogueKind,
  openCatalogue,
} from '@rangefoundry/use-cases/catalog'
import { buildApp } from './app.ts'
import { loadBundle } from './bundle.ts'
import { cartridgeAnswer } from './routes/cartridges.ts'
import { originated, revised, stored } from './routes/record-answers.ts'

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
  ['event-types', 'eventType', 'eventTypes'],
] as const satisfies readonly (readonly [string, CatalogueKind, keyof CatalogueData['index']])[]

/** On 127.0.0.1 at a free port, compute in this thread; `url` is its origin, `close` stops it, `data` the catalogue's index and records. */
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

/** `catalogue/index.json` (the index the browser opens with `openCatalogue` and answers every list from) and `<kind>/<id>.json` per record, the body of the API's `GET /<kind>/<id>`. */
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
