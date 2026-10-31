import { toSi, type UserRecord } from '@open-reloading/schema'
import { encode } from 'uqr'
import type { Translator } from '../i18n/translate.ts'
import { localDay } from './dates.ts'
import type { LoadRecord } from './load-tabs.ts'
import type { NameOf } from './records-csv.ts'
import { seatingLengthName } from './seating-ladder.ts'
import { type UnitSystem, withUnit } from './units.ts'
import type { InvalidRecord } from './user-data.ts'

/**
 * The QR text of a saved load's box label: format version 1, kind `L` (a saved load) and the load's
 * record id. It names the load only, so an old label never goes stale (docs, Box label).
 */
export const labelPayload = (id: string) => `OR1:L:${id}`

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const payloadPattern = new RegExp(`OR(\\d+):([A-Z]):(${uuid})`, 'i')

/**
 * The load id of a box label's text found anywhere in `text` (a scan, a web address that carries
 * it, the printed line), or the bare id alone. Another format version or kind gives none.
 */
export function readLabel(text: string): string | undefined {
  let plain = text
  try {
    plain = decodeURIComponent(text)
  } catch {}
  const m = payloadPattern.exec(plain)
  if (m) return m[1] === '1' && m[2]?.toUpperCase() === 'L' ? m[3]?.toLowerCase() : undefined
  if (/OR\d+:/i.test(plain)) return undefined
  return new RegExp(`^\\s*(${uuid})\\s*$`, 'i').exec(plain)?.[1]?.toLowerCase()
}

/**
 * The saved load of `id` in the browser store's `records`, `invalid` when the id is stored but
 * fails the schema, or `missing`.
 */
export function labelledLoad(
  id: string,
  stored: { records: readonly UserRecord[]; invalid: readonly InvalidRecord[] },
): LoadRecord | 'invalid' | 'missing' {
  const found = stored.records.find((r) => r.id === id)
  if (found?.kind === 'load') return found
  return stored.invalid.some((i) => i.id === id) ? 'invalid' : 'missing'
}

/** The modules of the QR code of `text`, dark `true`, with the 4-module quiet zone of the standard. */
export const qrModules = (text: string) => encode(text, { ecc: 'M', border: 4 }).data

/** What a box label prints: the load's name, label and value rows, and the QR text. */
export type BoxLabel = { title: string; rows: [string, string][]; payload: string }

/**
 * The box label of a saved load, from the stored record alone: the same record gives the same label
 * (the date is the day it was saved). A row without a value is left out, so a lot prints only when
 * typed.
 */
export function boxLabel(
  r: LoadRecord,
  nameOf: NameOf,
  system: UnitSystem,
  t: Translator['t'],
): BoxLabel {
  const d = r.data
  const powder = typeof d.powder === 'object' ? d.powder.name : nameOf('powders', d.powder)
  const charge = d.charge && withUnit('charge', system, toSi('mass', d.charge.value))
  const rows: [string, string | undefined][] = [
    [t('Cartridge'), nameOf('cartridges', d.cartridge)],
    [t('Bullet'), typeof d.bullet === 'object' ? d.bullet.model : nameOf('bullets', d.bullet)],
    [t('Powder'), [powder, charge].filter(Boolean).join(', ')],
    [t('Primer'), nameOf('primers', d.primer?.record)],
    [
      d.seating ? seatingLengthName[d.seating.by] : '',
      d.seating && withUnit('length', system, toSi('length', d.seating.value.value)),
    ],
    [t('Saved'), localDay(new Date(r.saved))],
    [t('Powder lot'), d.powderLot],
    [t('Primer lot'), d.primer?.lot],
    [t('Case lot'), d.case?.lot],
  ]
  return {
    title: r.name,
    rows: rows.filter((row): row is [string, string] => Boolean(row[0] && row[1])),
    payload: labelPayload(r.id),
  }
}
