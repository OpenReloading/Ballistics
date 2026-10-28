import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { interior } from '@open-reloading/core'
import { predict } from '../src/evaluate.ts'
import { loadRecords } from '../src/records.ts'
import type { Row } from '../src/rows.ts'

/** The records of the data package and a synthetic root with case capacities and two more powders. */
export const recordRoots = [
  join(import.meta.dirname, '../../data/records'),
  join(import.meta.dirname, 'fixtures/records'),
]

export const records = loadRecords(recordRoots)

/** A row of the synthetic set: the printed values are the model's, moved by `velocity` and `pressure`. */
export interface Spec {
  cartridge: string
  bullet?: string
  powder?: string
  charge: number
  barrel?: number | null
  /** The printed velocity is the model's divided by 1 + this, so the absolute relative error is |this|. */
  velocity: number
  /** The same for the peak pressure; none prints no pressure. */
  pressure?: number
  table?: string
}

const columns = 'cartridge,bullet,powder,charge_g,velocity_ms,pressure_bar,barrel_mm,table'

/** The CSV text of `specs`; a row the model refuses prints 800 m/s. */
export function rowsCsv(specs: readonly Spec[]): string {
  const lines = specs.map((s) => {
    const barrel = s.barrel === undefined ? 600 : s.barrel
    const row: Row = {
      line: 0,
      cartridge: s.cartridge,
      bullet: s.bullet ?? 'demo-bullet-168',
      powder: s.powder ?? 'demo-powder-dp40',
      charge: s.charge,
      velocity: 0,
      ...(barrel !== null && { barrel }),
    }
    const p = predict(row, records, interior)
    const ok = 'velocity' in p
    const velocity = ok ? p.velocity / (1 + s.velocity) : 800
    const pressure = ok && s.pressure !== undefined ? p.pressure / 1e5 / (1 + s.pressure) : ''
    return [
      row.cartridge,
      row.bullet,
      row.powder,
      s.charge,
      velocity,
      pressure,
      barrel ?? '',
      s.table ?? '',
    ].join(',')
  })
  return `${columns}\n${lines.join('\n')}\n`
}

/** Writes `text` to a new folder and returns the file's path. */
export function writeRows(text: string, name = 'rows.csv'): string {
  const dir = mkdtempSync(join(tmpdir(), 'cli-rows-'))
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  writeFileSync(path, text)
  return path
}
