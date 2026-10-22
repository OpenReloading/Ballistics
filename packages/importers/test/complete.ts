import { type ChronoSession, chronoSession } from '@openreloading/schema'
import type { ChronoImport } from '../src/index.ts'

const fill: Record<string, unknown> = {
  id: 'test-session',
  date: '2026-03-01',
  manufacturerName: 'Manufacturer',
  model: 'Model',
  firmware: '1.0',
  muzzleDistance: { value: 3000 },
  airTemperature: { value: 15 },
  load: 'test-load',
  title: 'test.csv',
}

/** Fills exactly the paths in `missing` and validates the result as a `ChronoSession`. */
export function complete(result: ChronoImport): ChronoSession {
  const record: Record<string, unknown> = JSON.parse(JSON.stringify(result.session))
  for (const path of result.missingPaths) {
    const keys = path.split('.')
    let node = record
    for (const key of keys.slice(0, -1)) {
      node[key] ??= {}
      node = node[key] as Record<string, unknown>
    }
    const last = keys[keys.length - 1]
    node[last] = fill[last]
  }
  return chronoSession.parse(record)
}
