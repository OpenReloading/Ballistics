/** The bullet list page's own data, apart from `bullet-rows.ts`, which the site search of every page loads. */
import type { I18n } from '@lingui/core'
import { toSi } from '@rangefoundry/schema'
import { loadEnglish } from '../i18n/lingui.ts'
import { formatNumber } from '../i18n/number.ts'
import englishMessages from '../locales/en/lib/bullet-list-data.json' with { type: 'json' }
import { bulletSectionalDensity } from './bullet-kinds.ts'
import type { BulletItem, BulletRow } from './bullet-rows.ts'
import { present } from './directory.ts'
import type { Facet } from './facets.ts'
import { materialCore, rawWording, spacedWording, yesNo } from './record-values.ts'
import { inchText, type UnitSystem } from './units.ts'
import { sayLingui } from './wording.ts'

loadEnglish(englishMessages)

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
const kindWord = (i18n: I18n, value: string) =>
  sayLingui(i18n, rawWording(value)).replaceAll('-', ' ')

/** A list item's construction as a name: "Cup and core", "Lead core". */
export function constructionText(i18n: I18n, value: string) {
  // the one structure that ends in "-core" is no core material
  const core = value === 'cup-and-core' ? undefined : /^(.+)-core$/.exec(value)?.[1]
  return capitalised(
    core
      ? i18n._({ ...materialCore, values: { material: sayLingui(i18n, spacedWording(core)) } })
      : kindWord(i18n, value),
  )
}

/** A tip or base value as a name: "Hollow point", "Boat tail". */
const kindText = (i18n: I18n, value: string) => capitalised(kindWord(i18n, value))

/** The Type column: tip and base, "Hollow point, boat tail"; empty without either. */
export function bulletTypeText(i18n: I18n, b: Pick<BulletRow, 'tipType' | 'baseType'>) {
  const words = [b.tipType, b.baseType].flatMap((v) => (v ? [kindWord(i18n, v)] : []))
  return capitalised(words.join(', '))
}

/** URL keys of the bullet list's choice filters. */
export const bulletFacetKeys = ['construction', 'tip', 'base', 'leadfree']

/** A filter whose rows give it one value only is left out (`facetOptions`). */
export function bulletFacets(i18n: I18n): Facet<BulletRow>[] {
  return [
    {
      key: 'construction',
      label: /*i18n*/ { id: 'bullets.facet.construction', message: 'Construction' },
      values: (b) => (b.construction ? [b.construction] : []),
      text: (v) => constructionText(i18n, v),
    },
    {
      key: 'tip',
      label: /*i18n*/ { id: 'bullets.facet.tip', message: 'Tip' },
      values: (b) => (b.tipType ? [b.tipType] : []),
      text: (v) => kindText(i18n, v),
    },
    {
      key: 'base',
      label: /*i18n*/ { id: 'bullets.facet.base', message: 'Base type' },
      values: (b) => (b.baseType ? [b.baseType] : []),
      text: (v) => kindText(i18n, v),
    },
    {
      key: 'leadfree',
      label: /*i18n*/ { id: 'bullets.facet.leadfree', message: 'Lead-free' },
      values: (b) => (b.leadFree === undefined ? [] : [b.leadFree ? 'yes' : 'no']),
      text: (v) => i18n._(yesNo(v === 'yes', true)),
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
  true | null,
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
    b.nameOnly ?? null,
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
      nameOnly,
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
      ...present({ manufacturerAliases, tipType, baseType, construction, leadFree, nameOnly }),
    }),
  )
