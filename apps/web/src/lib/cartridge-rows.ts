/** The cartridge list's rows: search text, cells and the packed page props. */
import { toSi } from '@open-reloading/schema'
import type { CartridgeSummary } from './api-types.ts'
import { caliberLabel, commonCaliber } from './caliber.ts'
import { present } from './directory.ts'
import { matchesQuery } from './lists.ts'
import { formatNumber, inchText, type UnitSystem } from './units.ts'

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
