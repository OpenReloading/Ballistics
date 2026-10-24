/** The bullet list's rows: search text, filters, cells, the BC column and the packed page props. */
import { fold, toSi } from '@openreloading/schema'
import type { BulletSummary } from './api-types.ts'
import { caliberLabel, commonCaliber } from './caliber.ts'
import {
  convertMass,
  type DirectoryState,
  inRange,
  massRange,
  numberRange,
  present,
} from './directory.ts'
import { formatNumber, inchText, kilogramsPerGrain, type UnitSystem } from './units.ts'

/** Whether `word` occurs in `hay` at a word start (after no letter or digit): "7.8" not in "17.80". */
export function atWordStart(hay: string, word: string) {
  for (let i = hay.indexOf(word); i >= 0; i = hay.indexOf(word, i + 1))
    if (i === 0 || !/[a-z0-9]/.test(hay[i - 1])) return true
  return false
}

/** A catalogue bullet of the list: the summary with the name of its manufacturer. */
export type BulletItem = BulletSummary & {
  manufacturerName: string
  manufacturerAliases?: string[]
}

/**
 * A bullet row of the list: a catalogue item, or a design of the browser (`origin: 'user'`) that
 * may have no mass and names its manufacturer as text only.
 */
export type BulletRow = Omit<BulletItem, 'mass' | 'manufacturer'> & {
  manufacturer?: string
  mass: number | null
  origin?: 'user'
}

/** Search text of a bullet: manufacturer, name, diameter in mm and inches, mass in grains and grams. */
export function bulletSearchText(b: BulletRow): string {
  const gr = b.mass === null ? undefined : toSi('mass', b.mass) / kilogramsPerGrain
  return [
    b.manufacturerName,
    ...(b.manufacturerAliases ?? []),
    b.name,
    commonCaliber(b.diameter),
    caliberLabel(b.diameter, 'mm'),
    caliberLabel(b.diameter, 'in'),
    ...(gr === undefined || b.mass === null
      ? []
      : [formatNumber(gr, 1), formatNumber(gr, 0), formatNumber(b.mass, 2)]),
  ].join(' ')
}

/** Whether a bullet passes every filter of `s` (the sort aside); `text` precomputed for speed. */
export function bulletMatches(
  b: BulletRow,
  s: DirectoryState,
  text: string = bulletSearchText(b),
): boolean {
  if (s.manufacturer && b.manufacturer !== s.manufacturer) return false
  if (s.caliber && commonCaliber(b.diameter) !== s.caliber) return false
  if (
    (s.dragModel === 'G1' && b.ballisticCoefficientG1 === null) ||
    (s.dragModel === 'G7' && b.ballisticCoefficientG7 === null)
  )
    return false
  if (s.country && b.country !== s.country) return false
  if (s.tipType && b.tipType !== s.tipType) return false
  if (s.construction && b.construction !== s.construction) return false
  // the BC the column shows, at its 3 decimals
  const bc = numberRange(s.ballisticCoefficient ?? '', [''])
  const shownBc = bc && bulletBallisticCoefficient(b, s.dragModel)
  if (bc && !inRange(shownBc && Number(shownBc.value.toFixed(3)), bc)) return false
  const range = massRange(s.mass)
  if (range) {
    if (b.mass === null) return false
    // compared at the display rounding, so 168 gr lies in 150-168gr
    const shown = convertMass(b.mass, 'g', range.unit)
    if (range.min !== undefined && shown < range.min) return false
    if (range.max !== undefined && shown > range.max) return false
  }
  const hay = fold(text)
  return fold(s.query)
    .split(/\s+/)
    .every((word) => atWordStart(hay, word))
}

/** A bullet's cells in the preset's units, rounded for display; empty without a value. */
export function bulletCells(b: BulletRow, system: UnitSystem) {
  const lengthIn = system.length.symbol === 'in'
  return {
    caliber: commonCaliber(b.diameter),
    // the exact diameter, on hover
    diameter: `${inchText(formatNumber(system.length.fromSi(toSi('length', b.diameter)), lengthIn ? 4 : 3), system.length.symbol)} ${system.length.symbol}`,
    mass:
      b.mass === null
        ? ''
        : formatNumber(system.mass.fromSi(toSi('mass', b.mass)), system.mass.decimals),
    length:
      b.length === null
        ? ''
        : inchText(
            formatNumber(system.length.fromSi(toSi('length', b.length)), lengthIn ? 3 : 2),
            system.length.symbol,
          ),
  }
}

type BallisticCoefficient = { model: 'G1' | 'G7'; value: number }

/**
 * The BC column: the manufacturer's published coefficient of the drag model
 * `drag` ("G1", "G7"), or with any model G7 where given, else G1; `other` the other model's.
 */
export function bulletBallisticCoefficient(
  b: Pick<BulletSummary, 'ballisticCoefficientG1' | 'ballisticCoefficientG7'>,
  drag: string | undefined,
): (BallisticCoefficient & { other?: BallisticCoefficient }) | undefined {
  const g1: BallisticCoefficient | undefined =
    b.ballisticCoefficientG1 === null ? undefined : { model: 'G1', value: b.ballisticCoefficientG1 }
  const g7: BallisticCoefficient | undefined =
    b.ballisticCoefficientG7 === null ? undefined : { model: 'G7', value: b.ballisticCoefficientG7 }
  const [shown, other] = drag === 'G1' ? [g1, g7] : drag === 'G7' ? [g7, g1] : g7 ? [g7, g1] : [g1]
  return shown && (other ? { ...shown, other } : shown)
}

/** Sort key of the BC column: with any model the drag model first (G1, then G7), then the value. */
export function bulletBallisticCoefficientSort(
  b: Pick<BulletSummary, 'ballisticCoefficientG1' | 'ballisticCoefficientG7'>,
  drag: string | undefined,
) {
  const bc = bulletBallisticCoefficient(b, drag)
  if (!bc) return
  // BCs lie below 10 lb/in²
  return drag === 'G1' || drag === 'G7' || bc.model === 'G1' ? bc.value : 10 + bc.value
}

/** A BC as the list shows it: "0.264 G7". */
export const ballisticCoefficientText = (bc: BallisticCoefficient) =>
  `${formatNumber(bc.value, 3)} ${bc.model}`

/** A bullet item as one array: the list page's props carry no key names. */
export type PackedBullet = [
  string,
  string,
  string,
  string,
  number,
  number,
  number | null,
  number | null,
  number | null,
  string | null,
  string | null,
  string | null,
  string[] | null,
]

export const packBullets = (rows: readonly BulletItem[]): PackedBullet[] =>
  rows.map((b) => [
    b.id,
    b.manufacturer,
    b.manufacturerName,
    b.name,
    b.diameter,
    b.mass,
    b.length,
    b.ballisticCoefficientG1,
    b.ballisticCoefficientG7,
    b.country ?? null,
    b.tipType ?? null,
    b.construction ?? null,
    b.manufacturerAliases ?? null,
  ])

export const unpackBullets = (rows: readonly PackedBullet[]): BulletItem[] =>
  rows.map(
    ([
      id,
      manufacturer,
      manufacturerName,
      name,
      diameter,
      mass,
      length,
      ballisticCoefficientG1,
      ballisticCoefficientG7,
      country,
      tipType,
      construction,
      manufacturerAliases,
    ]) => ({
      id,
      manufacturer,
      manufacturerName,
      name,
      diameter,
      mass,
      length,
      ballisticCoefficientG1,
      ballisticCoefficientG7,
      ...present({ country, tipType, construction, manufacturerAliases }),
    }),
  )
