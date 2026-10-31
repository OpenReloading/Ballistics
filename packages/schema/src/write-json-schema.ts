import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { bullet } from './bullet.ts'
import { caliberClass } from './caliber-class.ts'
import { cartridge } from './cartridge.ts'
import { cartridgeCase } from './case.ts'
import { caseCapacity } from './case-capacity.ts'
import { chronoSession } from './chrono-session.ts'
import { discipline, federation, targetMapping } from './federation.ts'
import { firingSeries } from './firing.ts'
import { load } from './load.ts'
import { loadTables } from './load-tables.ts'
import { manufacturer } from './manufacturer.ts'
import { powder } from './powder.ts'
import { primer } from './primer.ts'
import { sourceRecord } from './provenance.ts'
import { publishedLoads } from './published-load.ts'
import { rangeFirings } from './range.ts'
import { targetFace } from './target-face.ts'
import { targetSheet } from './target-sheet.ts'
import { userDataFile } from './user-data.ts'

const out = join(import.meta.dirname, 'json-schema')
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
})) {
  const json = z.toJSONSchema(schema, { io: 'input' })
  writeFileSync(join(out, `${name}.schema.json`), `${JSON.stringify(json, null, 2)}\n`)
}
