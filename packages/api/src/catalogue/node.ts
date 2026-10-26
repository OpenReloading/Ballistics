import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadBundle } from '../bundle.ts'
import { buildCatalogue } from './build.ts'
import { openCatalogue } from './open.ts'
import type { Catalogue, CatalogueSource } from './types.ts'

/** The files the build writes: the index and the record file. */
const catalogueFiles = { index: 'index.json', records: 'records.json' } as const

/** Writes the index and the record file of `source` into `dir` (created where missing). */
export function writeCatalogue(source: CatalogueSource, dir: string) {
  const { index, records } = buildCatalogue(source)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, catalogueFiles.index), JSON.stringify(index))
  writeFileSync(join(dir, catalogueFiles.records), JSON.stringify(records))
}

/**
 * Opens the catalogue from the files `writeCatalogue` wrote into `dir` (default: next to this
 * module, where `npm run build` puts them); without them, builds it from the data bundle.
 */
export function loadCatalogue(dir = import.meta.dirname): Catalogue {
  const index = join(dir, catalogueFiles.index)
  const records = join(dir, catalogueFiles.records)
  if (!existsSync(index) || !existsSync(records)) return openCatalogue(buildCatalogue(loadBundle()))
  return openCatalogue({
    index: JSON.parse(readFileSync(index, 'utf8')),
    records: () => JSON.parse(readFileSync(records, 'utf8')),
  })
}
