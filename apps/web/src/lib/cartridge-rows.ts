/** The cartridge list's rows: search text, filters, cells and the packed page props. */
import type { CartridgeSummary } from './api-types.ts'
import { caliberLabel, commonCaliber } from './caliber.ts'
import { countryKeys } from './countries.ts'
import {
  convertBulletDiameter,
  convertPressure,
  type DirectoryState,
  inRange,
  numberRange,
  present,
} from './directory.ts'
import { matchesQuery } from './lists.ts'
import { formatNumber, inchText, type UnitSystem } from './units.ts'

/** A cartridge row of the list: the summary without its table (CIP on every row). */
export type CartridgeRow = Omit<CartridgeSummary, 'table'> & { origin?: 'user' }

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

/** Whether a cartridge passes every filter of `s` (the sort aside); `text` precomputed for speed. */
export function cartridgeMatches(
  c: CartridgeRow,
  s: DirectoryState,
  text: string = cartridgeSearchText(c),
): boolean {
  if (s.caseType && c.caseType !== s.caseType) return false
  if (
    s.caliber &&
    (c.maxBulletDiameter === undefined || commonCaliber(c.maxBulletDiameter) !== s.caliber)
  )
    return false
  if (s.country && !countryKeys(c.country ?? '').includes(s.country)) return false
  const bore = numberRange(s.bulletDiameter ?? '', ['in', 'mm'])
  if (
    bore &&
    !inRange(
      c.maxBulletDiameter === undefined
        ? undefined
        : convertBulletDiameter(c.maxBulletDiameter, 'mm', bore.unit),
      bore,
    )
  )
    return false
  const pmax = numberRange(s.pmax ?? '', ['bar', 'psi'])
  if (
    pmax &&
    !inRange(c.pmax === undefined ? undefined : convertPressure(c.pmax, 'bar', pmax.unit), pmax)
  )
    return false
  return matchesQuery([text], s.query)
}

/** A cartridge's number cells in the preset's units; empty without a value. */
export function cartridgeCells(c: CartridgeRow, system: UnitSystem) {
  const length = (mm: number | undefined) =>
    mm === undefined
      ? ''
      : inchText(
          formatNumber(system.length.fromSi(mm * 1e-3), system.length.symbol === 'in' ? 3 : 2),
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
        : formatNumber(system.pressure.fromSi(c.pmax * 1e5), system.pressure.decimals),
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
  string | null,
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
    c.country ?? null,
  ])

export const unpackCartridges = (rows: readonly PackedCartridge[]): CartridgeRow[] =>
  rows.map(
    ([
      id,
      name,
      aliases,
      maxBulletDiameter,
      caseLength,
      cartridgeLength,
      pmax,
      caseType,
      country,
    ]) => ({
      id,
      name,
      aliases,
      ...present({ maxBulletDiameter, caseLength, cartridgeLength, pmax, caseType, country }),
    }),
  )
