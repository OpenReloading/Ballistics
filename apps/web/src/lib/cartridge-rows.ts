/** The cartridge list's rows: search text, cells and the packed page props. */
import { fold, toSi } from '@open-reloading/schema'
import { formatNumber } from '../i18n/number.ts'
import type { CartridgeSummary } from './api-types.ts'
import { caliberLabel, commonCaliber } from './caliber.ts'
import { present } from './directory.ts'
import { matchesQuery } from './lists.ts'
import { inchText, type UnitSystem } from './units.ts'

/** A cartridge row of the list: the summary without its table (CIP on every row). */
export type CartridgeRow = Omit<CartridgeSummary, 'table'> & { origin?: 'user' | undefined }

/** Search text of a cartridge: name, aliases, its common caliber and its G1 in mm and inches. */
export const cartridgeSearchText = (c: CartridgeRow) =>
  [
    c.name,
    ...c.aliases,
    ...(c.maxBulletDiameter === undefined
      ? []
      : [
          commonCaliber(c.maxBulletDiameter),
          caliberLabel(c.maxBulletDiameter, 'mm'),
          caliberLabel(c.maxBulletDiameter, 'in'),
        ]),
  ].join(' ')

/** Whether a cartridge matches the search `query`; `text` precomputed for speed. */
export const cartridgeMatches = (
  c: CartridgeRow,
  query: string,
  text: string = cartridgeSearchText(c),
) => matchesQuery([text], query)

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
const leadingNumber = /^\s*(\d+(?:[.,]\d+)?)(.*)$/s

/** Orders cartridge names: a leading number by value (5,6 after 5,56), then the rest with numbers by value. */
export function compareCartridgeNames(a: string, b: string): number {
  const x = leadingNumber.exec(a)
  const y = leadingNumber.exec(b)
  if (x?.[1] && y?.[1])
    return (
      Number(x[1].replace(',', '.')) - Number(y[1].replace(',', '.')) ||
      collator.compare(x[2] ?? '', y[2] ?? '')
    )
  return x ? -1 : y ? 1 : collator.compare(a, b)
}

/** A name or query as typed words compare: folded, a dot ending a word, spaces and hyphens left out. */
const plain = (s: string) =>
  fold(s)
    .replace(/\.(?=\s|$)/g, '')
    .replace(/[\s-]+/g, '')

/** 3 for the name typed in full, 2 for its start, 1 for the start of an alias, else 0. */
export function cartridgeRank(c: CartridgeRow, query: string): number {
  const q = plain(query)
  if (!q) return 0
  const name = plain(c.name)
  if (name === q) return 3
  if (name.startsWith(q)) return 2
  return c.aliases.some((a) => plain(a).startsWith(q)) ? 1 : 0
}

/** A cartridge's number cells in the preset's units; empty without a value. */
export function cartridgeCells(c: CartridgeRow, system: UnitSystem) {
  const length = (mm: number | undefined) =>
    mm === undefined
      ? ''
      : inchText(
          formatNumber(
            system.length.fromSi(toSi('length', mm)),
            system.length.symbol === 'in' ? 3 : 2,
          ),
          system.length.symbol,
        )
  return {
    caliber: c.maxBulletDiameter === undefined ? '' : commonCaliber(c.maxBulletDiameter),
    maxBulletDiameter: length(c.maxBulletDiameter),
    caseLength: length(c.caseLength),
    cartridgeLength: length(c.cartridgeLength),
    // stored in bar
    pmax:
      c.pmax === undefined
        ? ''
        : formatNumber(system.pressure.fromSi(toSi('pressure', c.pmax)), system.pressure.decimals),
  }
}

export type PackedCartridge = [
  string,
  string,
  string[],
  number | null,
  number | null,
  number | null,
  number | null,
  CartridgeRow['caseType'] | null,
]

/**
 * A cartridge without values: none of the summary's G1, L3, L6 and Pmax (every record with
 * a value has one of them).
 */
export const noValues = (c: CartridgeRow) =>
  c.maxBulletDiameter === undefined &&
  c.caseLength === undefined &&
  c.cartridgeLength === undefined &&
  c.pmax === undefined

/** Cartridges as arrays: the list page's props carry no key names. */
export const packCartridges = (rows: readonly CartridgeRow[]): PackedCartridge[] =>
  rows.map((c) => [
    c.id,
    c.name,
    c.aliases,
    c.maxBulletDiameter ?? null,
    c.caseLength ?? null,
    c.cartridgeLength ?? null,
    c.pmax ?? null,
    c.caseType ?? null,
  ])

export const unpackCartridges = (rows: readonly PackedCartridge[]): CartridgeRow[] =>
  rows.map(
    ([id, name, aliases, maxBulletDiameter, caseLength, cartridgeLength, pmax, caseType]) => ({
      id,
      name,
      aliases,
      ...present({ maxBulletDiameter, caseLength, cartridgeLength, pmax, caseType }),
    }),
  )
