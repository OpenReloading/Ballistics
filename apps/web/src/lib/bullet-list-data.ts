/**
 * The bullet list page's own data: the packed page props, the Diameter, SD, G1, G7 and Type cells,
 * the construction names and the choice filters. Apart from `bullet-rows.ts`, which the site search
 * of every page loads.
 */
import { toSi } from '@open-reloading/schema'
import { formatNumber } from '../i18n/number.ts'
import { msg, type Translator } from '../i18n/translate.ts'
import { bulletSectionalDensity } from './bullet-kinds.ts'
import type { BulletItem, BulletRow } from './bullet-rows.ts'
import { present } from './directory.ts'
import type { Facet } from './facets.ts'
import { rawWording, spacedWording } from './record-values.ts'
import { inchText, type UnitSystem } from './units.ts'
import { say } from './wording.ts'

/** The Diameter (inches to 4 decimals, mm to 3) and SD cells in the preset's units; empty without a value. */
export function listCells(b: BulletRow, system: UnitSystem) {
  const sd = bulletSectionalDensity(b)
  return {
    diameterValue:
      b.diameter === null
        ? ''
        : inchText(
            formatNumber(
              system.length.fromSi(toSi('length', b.diameter)),
              system.length.symbol === 'in' ? 4 : 3,
            ),
            system.length.symbol,
          ),
    sectionalDensity:
      sd === undefined
        ? ''
        : formatNumber(system.sectionalDensity.fromSi(sd), system.sectionalDensity.decimals),
  }
}

/** A G1 or G7 column's cell: the coefficient to 3 decimals, lb/in²; empty without one. */
export const coefficientText = (value: number | null) =>
  value === null ? '' : formatNumber(value, 3)

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** A tip, base or structure value as a word, hyphens as spaces: "hollow point". */
const kindWord = (t: Translator['t'], value: string) =>
  say(t, rawWording(value)).replaceAll('-', ' ')

/** A list item's construction as a name: "Cup and core", "Lead core". */
export function constructionText(t: Translator['t'], value: string) {
  // the one structure that ends in "-core" is no core material
  const core = value === 'cup-and-core' ? undefined : /^(.+)-core$/.exec(value)?.[1]
  return capitalised(
    core ? t('{material} core', { material: say(t, spacedWording(core)) }) : kindWord(t, value),
  )
}

/** A tip or base value as a name: "Hollow point", "Boat tail". */
const kindText = (t: Translator['t'], value: string) => capitalised(kindWord(t, value))

/** The Type column: tip and base, "Hollow point, boat tail"; empty without either. */
export function bulletTypeText(t: Translator['t'], b: Pick<BulletRow, 'tipType' | 'baseType'>) {
  const words = [b.tipType, b.baseType].flatMap((v) => (v ? [kindWord(t, v)] : []))
  return capitalised(words.join(', '))
}

/** URL keys of the bullet list's choice filters. */
export const bulletFacetKeys = ['construction', 'tip', 'base', 'leadfree']

/**
 * The bullet list's choice filters: construction, tip, base and lead-free, each over the values
 * the rows have. A filter whose rows give it one value only is left out (`facetOptions`).
 */
export function bulletFacets(t: Translator['t']): Facet<BulletRow>[] {
  return [
    {
      key: 'construction',
      label: msg('Construction'),
      values: (b) => (b.construction ? [b.construction] : []),
      text: (v) => constructionText(t, v),
    },
    {
      key: 'tip',
      label: msg('Tip'),
      values: (b) => (b.tipType ? [b.tipType] : []),
      text: (v) => kindText(t, v),
    },
    {
      key: 'base',
      label: msg('Base type'),
      values: (b) => (b.baseType ? [b.baseType] : []),
      text: (v) => kindText(t, v),
    },
    {
      key: 'leadfree',
      label: msg('Lead-free'),
      values: (b) => (b.leadFree === undefined ? [] : [b.leadFree ? 'yes' : 'no']),
      text: (v) => t(v === 'yes' ? msg('Yes') : msg('No')),
      order: (a, b) => (a === b ? 0 : a === 'yes' ? -1 : 1),
    },
  ]
}

/** A bullet item as one array: the list page's props carry no key names. */
export type PackedBullet = [
  string,
  string,
  string,
  string,
  number | null,
  number,
  number | null,
  number | null,
  number | null,
  string[] | null,
  string | null,
  string | null,
  string | null,
  boolean | null,
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
    b.manufacturerAliases ?? null,
    b.tipType ?? null,
    b.baseType ?? null,
    b.construction ?? null,
    b.leadFree ?? null,
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
      manufacturerAliases,
      tipType,
      baseType,
      construction,
      leadFree,
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
      ...present({ manufacturerAliases, tipType, baseType, construction, leadFree }),
    }),
  )
