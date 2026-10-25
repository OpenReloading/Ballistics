/** Directory lists: filters and sort kept in the URL, number ranges and the units they compare in. */
import { fromSi } from '@openreloading/schema'
import type { SortDirection } from './lists.ts'
import { kilogramsPerGrain, metersPerInch, psi } from './units.ts'

export type DirectorySort = { column: string; dir: SortDirection } | undefined

/**
 * A list's filters and sort as the URL keeps them: `query` search, `manufacturer` (a manufacturer
 * id), `caliber` a common caliber
 * (`commonCaliber`: ".308", "6.5 mm", the same under every unit preset), `mass` a range with its
 * unit ("150-180gr", "9.5-g"), `sort` a column key, "-" first for descending.
 */
export interface DirectoryState {
  /** Search text, URL key `q`. */
  query: string
  manufacturer: string
  caliber: string
  mass: string
  sort: DirectorySort
  /** Cartridges: case type, URL key `type`. */
  caseType?: string
  /** Powders: base, form, "1" for powders with a curve only. */
  base?: string
  form?: string
  curve?: string
  /** Bullets: the drag model of the BC column, "G1" or "G7"; empty for any. URL key `drag`. */
  dragModel?: string
  /** The sources that are on, comma-separated; empty for all (`sources.ts`). URL key `src`. */
  sources?: string
  /** All lists: a country, the ISO code of a record or the name a cartridge record prints. */
  country?: string
  /**
   * Cartridges: ranges of the G1 ("7-8mm", ".28-.31in", URL key `bore`) and of Pmax ("3000-4000bar",
   * "50000-60000psi").
   */
  bulletDiameter?: string
  pmax?: string
  /** Bullets: a range of the BC the column shows ("0.2-0.3", URL key `bc`), the tip type. */
  ballisticCoefficient?: string
  tipType?: string
  /** Bullets: the construction structure, else "<core material>-core". */
  construction?: string
  /** Powders: a range of the burn-rate order ("1-50"), URL key `rank`. */
  burnRateOrder?: string
  /** Bullets and powders: the rows ticked for Compare, ids comma-separated, in the order ticked. URL key `pick`. */
  compareIds?: string
  /** Bullets: the id of a cartridge; only the bullets that fit it by the CIP rule (`fitRule`). */
  fits?: string
  /** Target faces and disciplines: the federation or issuer (its abbreviation). URL key `org`. */
  organization?: string
  /** Disciplines: the category id, URL key `cat`; the distance in m, URL key `dist`; a caliber class id, URL key `class`. */
  category?: string
  distance?: string
  caliberClass?: string
}

export const emptyDirectory: DirectoryState = {
  query: '',
  manufacturer: '',
  caliber: '',
  mass: '',
  sort: undefined,
}

/** No filter of any list: the state Clear filters sets, the sort kept apart. */
export const noFilters: Partial<DirectoryState> = {
  ...emptyDirectory,
  caseType: '',
  base: '',
  form: '',
  curve: '',
  dragModel: '',
  sources: '',
  country: '',
  bulletDiameter: '',
  pmax: '',
  ballisticCoefficient: '',
  tipType: '',
  construction: '',
  burnRateOrder: '',
  fits: '',
  organization: '',
  category: '',
  distance: '',
  caliberClass: '',
}

/** Each field with its URL key, in the URL's order; the first four are in every state. */
const urlKeys = [
  ['query', 'q'],
  ['manufacturer', 'manufacturer'],
  ['caliber', 'caliber'],
  ['mass', 'mass'],
  ['caseType', 'type'],
  ['base', 'base'],
  ['form', 'form'],
  ['curve', 'curve'],
  ['dragModel', 'drag'],
  ['sources', 'src'],
  ['country', 'country'],
  ['bulletDiameter', 'bore'],
  ['pmax', 'pmax'],
  ['ballisticCoefficient', 'bc'],
  ['tipType', 'tipType'],
  ['construction', 'construction'],
  ['burnRateOrder', 'rank'],
  ['compareIds', 'pick'],
  ['fits', 'fits'],
  ['organization', 'org'],
  ['category', 'cat'],
  ['distance', 'dist'],
  ['caliberClass', 'class'],
] as const satisfies readonly (readonly [Exclude<keyof DirectoryState, 'sort'>, string])[]

export function readDirectory(search: string): DirectoryState {
  const p = new URLSearchParams(search)
  const sort = p.get('sort') ?? ''
  return {
    query: p.get('q') ?? '',
    manufacturer: p.get('manufacturer') ?? '',
    caliber: p.get('caliber') ?? '',
    mass: p.get('mass') ?? '',
    // the keys of one list only where the URL has them
    ...Object.fromEntries(
      urlKeys.slice(4).flatMap(([field, key]) => (p.has(key) ? [[field, p.get(key)]] : [])),
    ),
    sort: sort
      ? sort.startsWith('-')
        ? { column: sort.slice(1), dir: 'descending' }
        : { column: sort, dir: 'ascending' }
      : undefined,
  }
}

/** `search` with the state's parameters replaced; other parameters (such as `units`) stay. */
export function writeDirectory(state: DirectoryState, search: string): string {
  const p = new URLSearchParams(search)
  for (const k of [...urlKeys.map(([, key]) => key), 'sort']) p.delete(k)
  for (const [field, key] of urlKeys) {
    const v = state[field]
    if (v?.trim()) p.set(key, v)
  }
  if (state.sort) p.set('sort', `${state.sort.dir === 'descending' ? '-' : ''}${state.sort.column}`)
  const s = p.toString().replaceAll('%2C', ',').replaceAll('%2F', '/')
  return s ? `?${s}` : ''
}

/**
 * A range of the URL ("150-180gr", "0.3-0.5" with `units` `['']`), undefined when it does not
 * parse or names no known unit. Either bound may be left out.
 */
export function numberRange<U extends string>(text: string, units: readonly U[]) {
  const names = [...units].sort((a, b) => b.length - a.length).join('|')
  const m = new RegExp(`^\\s*(\\d*\\.?\\d*)\\s*-\\s*(\\d*\\.?\\d*)\\s*(${names})\\s*$`).exec(text)
  if (!m) return
  // "." alone is no number: no bound
  const n = (s: string) => (s && s !== '.' ? Number(s) : undefined)
  const [min, max] = [n(m[1]), n(m[2])]
  if (min === undefined && max === undefined) return
  return { min, max, unit: m[3] as U }
}

/** A mass range of the URL ("150-180gr", "9.5-g"), undefined when it does not parse. */
export const massRange = (text: string) => numberRange(text, ['gr', 'g'])

/** Whether `x` lies in `range` (no range: always); a row without a value lies in no range. */
export const inRange = (
  x: number | null | undefined,
  range: { min?: number; max?: number } | undefined,
) =>
  !range ||
  (x !== null &&
    x !== undefined &&
    (range.min === undefined || x >= range.min) &&
    (range.max === undefined || x <= range.max))

const gramsPer = { g: 1, gr: fromSi('mass', kilogramsPerGrain) }
/** Decimals a mass shows with, and is compared at, in the list. */
const massDigits = { gr: 1, g: 2 }

/** A mass `x` in `from` as `to` shows it: rounded to that unit's decimals. */
export const convertMass = (x: number, from: 'gr' | 'g', to: 'gr' | 'g') =>
  Number(((x * gramsPer[from]) / gramsPer[to]).toFixed(massDigits[to]))

const boreMm = { in: fromSi('length', metersPerInch), mm: 1 }
const pressureBar = { bar: 1, psi: fromSi('pressure', psi) }

/** A bullet diameter G1 in `from` as the list shows it in `to`, rounded to its decimals (`caliberLabel`). */
export const convertBulletDiameter = (x: number, from: 'in' | 'mm', to: 'in' | 'mm') =>
  Number(((x * boreMm[from]) / boreMm[to]).toFixed(to === 'in' ? 3 : 2))

/** A Pmax in `from` as the list shows it in `to`, a whole number. */
export const convertPressure = (x: number, from: 'bar' | 'psi', to: 'bar' | 'psi') =>
  Number(((x * pressureBar[from]) / pressureBar[to]).toFixed(0))

/** Fields of `values` that are not null, so an absent value stays absent. */
export const present = <T extends object>(values: T) =>
  Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null)) as {
    [K in keyof T]?: Exclude<T[K], null>
  }
