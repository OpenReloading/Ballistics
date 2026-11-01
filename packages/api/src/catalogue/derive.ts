import { leastSpecValue } from '@open-reloading/core'
import {
  type Bullet,
  type CaliberClass,
  type Cartridge,
  type CaseType,
  type CatalogueCase,
  compareKeys,
  type Discipline,
  type Federation,
  leadFree,
  type Manufacturer,
  type Powder,
  type Primer,
  searchKey,
  sortKey,
  type TargetFace,
  type TargetMapping,
} from '@open-reloading/schema'
import type {
  BulletItem,
  CaliberClassItem,
  CartridgeItem,
  CaseItem,
  DisciplineItem,
  FederationItem,
  IndexRow,
  ManufacturerItem,
  PowderItem,
  PrimerItem,
  TargetFaceItem,
  TargetMappingItem,
} from './types.ts'

/** Drops null and undefined fields, so responses match the records' "absent means unknown". */
function compact<T extends Record<string, unknown>>(row: T) {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined))
}

/**
 * The case head from the cartridge R1 (rim), P1 (body at the head) and R3 (belt), mm: belted with
 * an R3, rimmed with the rim more than 0.7 mm wider than the body, semi-rimmed with it more than
 * 0.3 mm and at most 0.7 mm wider, rebated with it more than 0.25 mm narrower, rimless between.
 * Bounds set by hand.
 */
export function caseType(
  r1: number | null,
  p1: number | null,
  r3: number | null,
): CaseType | undefined {
  if (r3 !== null) return 'belted'
  if (r1 === null || p1 === null) return
  // to 0.01 mm, the records' resolution, so a difference on a bound stays on its side
  const d = Math.round((r1 - p1) * 100) / 100
  if (d > 0.7) return 'rimmed'
  if (d > 0.3) return 'semi-rimmed'
  return d < -0.25 ? 'rebated' : 'rimless'
}

/**
 * A hash of `text` for change detection, 14 hex digits (53 bits, synchronous, the same in Node and
 * the browser). Not a security hash.
 */
export function contentHash(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (h2 & 2097151) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

/** The revision of a stored record: the hash of its JSON text. */
export const revisionOf = (record: object) => contentHash(JSON.stringify(record))

/** The highest `Pmax` of a sheet that has no side (the pressure is not one of the cartridge or chamber), as the list gives it. */
function greatestPmax(values: Cartridge['values']): number | undefined {
  const xs = values.flatMap((v) =>
    v.side === undefined && v.symbol === 'Pmax' && typeof v.value === 'number' ? [v.value] : [],
  )
  return xs.length > 0 ? Math.max(...xs) : undefined
}

/** The list item of a cartridge: the smallest values of its sheet and the case head derived from them. */
export function cartridgeItem(c: Cartridge): CartridgeItem {
  const { values } = c
  const least = (side: string, symbol: string) => leastSpecValue(values, side, symbol)
  return {
    id: c.id,
    name: c.name,
    aliases: c.aliases ?? [],
    table: c.table,
    ...compact({
      maxBulletDiameter: least('cartridge', 'G1'),
      boreDiameter: least('chamber', 'F'),
      grooveDiameter: least('chamber', 'Z'),
      caseLength: least('cartridge', 'L3'),
      cartridgeLength: least('cartridge', 'L6'),
      pmax: greatestPmax(values),
      caseType: caseType(
        least('cartridge', 'R1') ?? null,
        least('cartridge', 'P1') ?? null,
        least('cartridge', 'R3') ?? null,
      ),
      country: c.country,
    }),
  }
}

/** The index row of a cartridge, searched by its name and aliases. */
export const cartridgeRow = (c: Cartridge): IndexRow<CartridgeItem> => ({
  item: cartridgeItem(c),
  sortKey: sortKey(c.name),
  search: searchKey([c.name, ...(c.aliases ?? [])]),
})

/** The index row of a manufacturer. */
export const manufacturerRow = (m: Manufacturer): IndexRow<ManufacturerItem> => ({
  item: { id: m.id, name: m.name, ...compact({ aliases: m.aliases, website: m.website }) },
  sortKey: sortKey(m.name),
  search: searchKey([m.name, ...(m.aliases ?? [])]),
})

/**
 * The key a component is ordered and searched by: the manufacturer's name or one of its aliases
 * followed by the product name (and the product's own aliases).
 */
function componentKeys(m: Manufacturer, c: { name: string; aliases?: string[] | undefined }) {
  const names = [m.name, ...(m.aliases ?? [])]
  const products = [c.name, ...(c.aliases ?? [])]
  return {
    sortKey: sortKey(m.name, c.name),
    search: searchKey(
      names.flatMap((n) => products.map((p) => `${n} ${p}`)),
      c.name,
    ),
  }
}

/**
 * The part of the M3 parameters of a powder that the burn-rate curve reads, with the training rows
 * and cartridges of the fit and the day its fitted sources were read (the latest of them).
 */
function interiorItem({ interior, provenance }: Powder): PowderItem['interior'] {
  if (!interior) return
  const {
    vivacity,
    pressureExponent,
    referencePressure,
    burnForm,
    trainingRows,
    trainingCartridges,
  } = interior
  const retrieved = provenance.sources
    .filter(
      (s) =>
        (s.kind ?? provenance.kind) === 'fitted' &&
        (!s.fields || s.fields.some((f) => f === 'interior' || f.startsWith('interior.'))),
    )
    .flatMap((s) => (s.retrieved ? [s.retrieved] : []))
    .sort()
    .at(-1)
  return compact({
    vivacity,
    pressureExponent,
    referencePressure,
    burnForm,
    trainingRows,
    trainingCartridges,
    retrieved,
  })
}

/** The index row of a powder of manufacturer `m`. */
export const powderRow = (p: Powder, m: Manufacturer): IndexRow<PowderItem> => ({
  item: {
    id: p.id,
    manufacturer: p.manufacturer,
    name: p.name,
    ...compact({
      grainForm: p.grainForm,
      propellantBase: p.propellantBase,
      country: p.country,
      interior: interiorItem(p),
    }),
  },
  ...componentKeys(m, p),
})

/** The index row of a primer of manufacturer `m`, searched by the manufacturer with its name or product number. */
export const primerRow = (p: Primer, m: Manufacturer): IndexRow<PrimerItem> => ({
  item: {
    id: p.id,
    manufacturer: p.manufacturer,
    name: p.name,
    size: p.size,
    ...compact({ productNumber: p.productNumber, magnum: p.magnum, compound: p.compound }),
  },
  ...componentKeys(m, { name: p.name, aliases: p.productNumber ? [p.productNumber] : undefined }),
})

/** The first coefficient of a drag model, null without one (a banded sheet lists the top band first). */
const firstCoefficient = (b: Bullet, model: 'G1' | 'G7') =>
  b.ballisticCoefficients?.find((c) => c.dragModel === model)?.value ?? null

/** The structure of a bullet's construction, else its core material as `<material>-core`. */
function constructionOf({ construction }: Bullet) {
  const material = construction?.core?.material
  return construction?.structure ?? (material ? `${material}-core` : undefined)
}

/** The index row of a bullet of manufacturer `m`. */
export const bulletRow = (b: Bullet, m: Manufacturer): IndexRow<BulletItem> => ({
  item: {
    id: b.id,
    manufacturer: b.manufacturer,
    name: b.name,
    diameter: b.diameter?.value ?? null,
    mass: b.mass.value,
    length: b.length?.value ?? null,
    ballisticCoefficientG1: firstCoefficient(b, 'G1'),
    ballisticCoefficientG7: firstCoefficient(b, 'G7'),
    ...compact({
      country: b.country,
      tipType: b.tip?.type,
      baseType: b.base?.type,
      construction: constructionOf(b),
      leadFree: leadFree(b.construction),
      nameOnly: b.nameOnly,
    }),
  },
  ...componentKeys(m, b),
})

/**
 * The index row of a case of manufacturer `m` for the cartridge with id `cartridge` (the current
 * ids its references resolve to), searched by the manufacturer with its name or product number.
 */
export const caseRow = (
  c: CatalogueCase,
  m: Manufacturer,
  cartridge: string,
): IndexRow<CaseItem> => ({
  item: {
    id: c.id,
    manufacturer: m.id,
    cartridge,
    name: c.name,
    productNumber: c.productNumber,
    material: c.material,
    ...compact({ waterCapacity: c.waterCapacity?.value, mass: c.mass?.value }),
  },
  ...componentKeys(m, { name: c.name, aliases: [c.productNumber] }),
})

/** The distinct defined values of `values`, sorted. */
const distinct = (values: (string | undefined)[]) =>
  [...new Set(values.filter((v) => v !== undefined))].sort((a, b) => a.localeCompare(b, 'en'))

/** The index row of a target face, with the disciplines mapped to it (their caliber classes and categories) and its federation. */
export const targetFaceRow = (
  f: TargetFace,
  disciplines: readonly Discipline[],
  federation?: Federation,
): IndexRow<TargetFaceItem> => ({
  item: {
    id: f.id,
    ...compact({ federation: f.federation, organization: federation?.abbreviation }),
    name: f.name,
    caliberClasses: distinct(disciplines.flatMap((d) => d.caliberClasses?.ids ?? [])),
    categories: distinct([...f.events, ...disciplines].map((e) => e.category)),
  },
  sortKey: sortKey(f.federation ?? '', f.name),
  search: searchKey([federation?.abbreviation, f.name], f.name),
})

/** The index row of a federation. */
export const federationRow = (f: Federation): IndexRow<FederationItem> => ({
  item: {
    id: f.id,
    name: f.name,
    abbreviation: f.abbreviation,
    ...compact({
      country: f.country,
      internationalFederation: f.internationalFederation,
      website: f.website,
    }),
  },
  sortKey: sortKey(f.abbreviation),
  search: searchKey([f.abbreviation, f.name]),
})

/** The index row of a discipline. */
export const disciplineRow = (d: Discipline): IndexRow<DisciplineItem> => ({
  item: {
    id: d.id,
    federation: d.federation,
    name: d.name,
    distanceMm: d.distance.value,
    ...compact({ number: d.number, category: d.category }),
  },
  sortKey: sortKey(d.name),
  search: searchKey([d.name, d.number]),
})

/** The index row of a target mapping. */
export const targetMappingRow = (m: TargetMapping): IndexRow<TargetMappingItem> => ({
  item: {
    id: m.id,
    discipline: m.discipline,
    face: m.face,
    ...compact({ event: m.event, stage: m.stage, gaugeMm: m.gauge?.value }),
  },
  sortKey: sortKey(m.id),
  search: searchKey([m.id, m.event]),
})

/** The index row of a caliber class. */
export const caliberClassRow = (c: CaliberClass): IndexRow<CaliberClassItem> => ({
  item: { id: c.id, name: c.name, diameterMm: c.diameter.value },
  sortKey: sortKey(c.name),
  search: searchKey([c.name]),
})

/** Rows in the order of their sort keys, ties by id. */
export function byKey<T extends { id: string }>(rows: IndexRow<T>[]): IndexRow<T>[] {
  return rows.toSorted(
    (a, b) => compareKeys(a.sortKey, b.sortKey) || compareKeys(a.item.id, b.item.id),
  )
}
