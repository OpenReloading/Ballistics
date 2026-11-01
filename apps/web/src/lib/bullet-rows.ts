/** The bullet list's rows: search text, filters, cells, the BC column and the packed page props. */
import { fold, score, searchKey, toSi } from '@open-reloading/schema'
import { formatNumber } from '../i18n/number.ts'
import type { BulletSummary } from './api-types.ts'
import { caliberLabel, commonCaliber } from './caliber.ts'
import { inchText, kilogramsPerGrain, type UnitSystem } from './units.ts'

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
  manufacturer?: string | undefined
  mass: number | null
  origin?: 'user' | undefined
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

/** The key a bullet is searched by: its search text, its name for an exact match (`searchKey` of the schema). */
export const bulletKey = (b: BulletRow) => searchKey([bulletSearchText(b)], b.name)

/** A number with an optional unit as typed: "168", "168gr", "10.9g". */
const massWord = /^(\d+(?:\.\d+)?)(gr|g)?$/

/** The number and unit of a typed mass word ("168gr"); undefined for any other word. */
export function typedMass(word: string): { number: string; unit: string | undefined } | undefined {
  const [, number, unit] = massWord.exec(word) ?? []
  return number === undefined ? undefined : { number, unit }
}

/** The typed words, folded; a number and grains apart ("168 gr") count as one word ("168gr"). */
export const typedWords = (query: string) =>
  fold(query)
    .replace(/(\d)\s+gr(?=\s|$)/g, '$1gr')
    .split(/\s+/)
    .filter(Boolean)

/**
 * Whether a bullet weighs what a typed number says: "168" and "168gr" grains, "10.9g" grams,
 * within half a unit of the last typed digit.
 */
export function sameMass(b: BulletRow, number: string, unit: string | undefined) {
  if (b.mass === null) return false
  const half = 0.5 * 10 ** -(number.split('.')[1]?.length ?? 0)
  const typed = unit === 'g' ? b.mass : toSi('mass', b.mass) / kilogramsPerGrain
  return Math.abs(typed - Number(number)) <= half + 1e-9
}

/**
 * The schema's rank of the typed words in a bullet (`score`), `undefined` where a word is nowhere
 * in its `key`. A number with a unit is a weight the text does not hold: it must be the mass.
 */
export function bulletScore(b: BulletRow, key: string, query: string): number | undefined {
  const words = typedWords(query)
  const weights = words.map(typedMass).filter((m) => m?.unit)
  if (!weights.every((w) => w && sameMass(b, w.number, w.unit))) return undefined
  return score(key, words.filter((w) => !typedMass(w)?.unit).join(' '))
}

/** Whether a bullet matches the search `query`; `key` precomputed for speed. */
export function bulletMatches(b: BulletRow, query: string, key: string = bulletKey(b)): boolean {
  return bulletScore(b, key, query) !== undefined
}

/** A bullet's cells in the preset's units, rounded for display; empty without a value. */
export function bulletCells(b: BulletRow, system: UnitSystem) {
  const lengthIn = system.length.symbol === 'in'
  return {
    caliber: commonCaliber(b.diameter),
    // the exact diameter, on hover
    diameter:
      b.diameter === null
        ? ''
        : `${inchText(formatNumber(system.length.fromSi(toSi('length', b.diameter)), lengthIn ? 4 : 3), system.length.symbol)} ${system.length.symbol}`,
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
 * The BC column: the manufacturer's published coefficient, G7 where given, else G1; `other` the
 * other model's.
 */
export function bulletBallisticCoefficient(
  b: Pick<BulletSummary, 'ballisticCoefficientG1' | 'ballisticCoefficientG7'>,
): (BallisticCoefficient & { other?: BallisticCoefficient }) | undefined {
  const g1: BallisticCoefficient | undefined =
    b.ballisticCoefficientG1 === null ? undefined : { model: 'G1', value: b.ballisticCoefficientG1 }
  const g7: BallisticCoefficient | undefined =
    b.ballisticCoefficientG7 === null ? undefined : { model: 'G7', value: b.ballisticCoefficientG7 }
  const [shown, other] = g7 ? [g7, g1] : [g1]
  return shown && (other ? { ...shown, other } : shown)
}

/** A BC as the list shows it: "0.264 G7". */
export const ballisticCoefficientText = (bc: BallisticCoefficient) =>
  `${formatNumber(bc.value, 3)} ${bc.model}`
