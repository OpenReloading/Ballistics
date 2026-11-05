import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import {
  bullet,
  caliberClass,
  cartridge,
  cartridgeCase,
  caseCapacity,
  chronoSession,
  discipline,
  eventType,
  federation,
  firingSeries,
  load,
  loadTables,
  manufacturer,
  powder,
  primer,
  publishedLoads,
  rangeFirings,
  sourceRecord,
  targetFace,
  targetMapping,
  targetSheet,
  userDataFile,
} from '../src/index.ts'

// the JSON Schema of each record kind, which the package exports as `./json-schema/*`
const out = new URL('../dist/json-schema/', import.meta.url)
mkdirSync(out, { recursive: true })
for (const [name, schema] of Object.entries({
  load,
  'chrono-session': chronoSession,
  cartridge,
  powder,
  primer,
  bullet,
  case: cartridgeCase,
  'case-capacity': caseCapacity,
  'source-record': sourceRecord,
  'firing-series': firingSeries,
  'load-tables': loadTables,
  'published-loads': publishedLoads,
  'range-firings': rangeFirings,
  'user-data-file': userDataFile,
  'target-sheet': targetSheet,
  'target-face': targetFace,
  'caliber-class': caliberClass,
  federation,
  discipline,
  manufacturer,
  'target-mapping': targetMapping,
  'event-type': eventType,
})) {
  const json = z.toJSONSchema(schema, { io: 'input' })
  writeFileSync(new URL(`${name}.schema.json`, out), `${JSON.stringify(json, null, 2)}\n`)
}
