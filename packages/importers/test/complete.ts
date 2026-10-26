import { type CatalogueSession, catalogueSession } from '@open-reloading/schema'
import type { ChronoImport } from '../src/index.ts'
import { defined } from './defined.ts'

const fill: Record<string, unknown> = {
  id: 'test-session',
  date: '2026-03-01',
  manufacturer: 'catalogue:test-maker',
  model: 'Model',
  firmware: '1.0',
  muzzleDistance: { value: 3000 },
  airTemperature: { value: 15 },
  load: 'catalogue:test-load',
  title: 'test.csv',
}

/** Fills exactly the paths in `missing` and validates the result as a catalogue session. */
export function complete(result: ChronoImport): CatalogueSession {
  const record: Record<string, unknown> = {
    origin: 'catalogue',
    ...JSON.parse(JSON.stringify(result.session)),
  }
  for (const path of result.missingPaths) {
    const keys = path.split('.')
    const last = defined(keys.pop(), 'path')
    let node = record
    for (const key of keys) {
      node[key] ??= {}
      node = node[key] as Record<string, unknown>
    }
    node[last] = fill[last]
  }
  return catalogueSession.parse(record)
}
