import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Bullet,
  compareKeys,
  type Powder,
  type Primer,
  type PublishedLoad,
  type PublishedLoads,
  parseRef,
  publishedLoads,
} from '@open-reloading/schema'
import { readKind } from './read-kind.ts'
import type { SourceIndex } from './sources.ts'

/** A file of published loads and the cartridge folder it is read from. */
export type LocatedPublishedLoads = { folder: string; file: PublishedLoads }

/**
 * The published load files of every roots' `loads/<cartridge id>/` folder, source references
 * resolved. A missing `loads/` folder or a root without one is no error: the plain `Load` records
 * in `loads/` itself are another kind.
 */
export function readPublishedLoads(
  roots: string[],
  sources: SourceIndex,
  errors: string[],
): LocatedPublishedLoads[] {
  const folders = new Set<string>()
  for (const root of roots) {
    const path = join(root, 'loads')
    if (!existsSync(path)) continue
    for (const entry of readdirSync(path, { withFileTypes: true }))
      if (entry.isDirectory()) folders.add(entry.name)
  }
  return [...folders]
    .sort(compareKeys)
    .flatMap((folder) =>
      readKind(roots, `loads/${folder}`, publishedLoads, { errors, sources, optional: true }).map(
        (file) => ({ folder, file }),
      ),
    )
}

/** The records a published load names. */
type Known = {
  cartridges: Set<string>
  manufacturers: Set<string>
  bullets: Set<string>
  powders: Set<string>
  primers: Map<string, Primer>
  /** Old primer ids of `renames.json`, which still resolve. */
  renamedPrimers: Set<string>
}

/** The records published loads are checked against. */
export type PublishedLoadTargets = {
  cartridges: Set<string>
  manufacturers: Set<string>
  bullets: readonly Pick<Bullet, 'id'>[]
  powders: readonly Pick<Powder, 'id'>[]
  primers: readonly Primer[]
  renamedPrimers: readonly string[]
}

/** Units of a printed figure and their factor to the stored unit of the quantity. */
type Printed = 'mass' | 'velocity' | 'pressure' | 'length'
const factors: Record<Printed, Record<string, number>> = {
  mass: { g: 1, gr: 0.06479891, grs: 0.06479891, grain: 0.06479891, grains: 0.06479891 },
  velocity: { 'm/s': 1, ms: 1, 'ft/s': 0.3048, 'ft/sec': 0.3048, fps: 0.3048 },
  // 1 psi = 0.45359237 kg * 9.80665 m/s2 / (0.0254 m)2, in bar
  pressure: { bar: 1, psi: 0.0689475729316836 },
  length: { mm: 1, cm: 10, m: 1000, in: 25.4, '"': 25.4, '″': 25.4, inch: 25.4, inches: 25.4 },
}

/** The relative difference below which a stored value follows its printed number (7 significant digits). */
const tolerance = 1e-6

/** The readings of a printed number: with commas as thousands marks, and with a comma as decimal mark. */
const readings = (text: string) => {
  const plain = /^\.?\d+$|^\d+\.\d+$/.test(text) ? [Number(text)] : []
  const commas = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text) ? [Number(text.replace(/,/g, ''))] : []
  const decimal = /^\d+,\d+$/.test(text) ? [Number(text.replace(',', '.'))] : []
  return [...plain, ...commas, ...decimal]
}

/**
 * Whether `value` follows the printed `raw` of a figure of `kind`: some number printed in `raw`,
 * read in the unit printed next to it (or the assumed unit for the first number), gives `value`
 * to 7 significant digits. A text that prints no number or no known unit (`Flush`) is not checked.
 * A twist `1:12"` is its second number.
 */
function follows(
  kind: Printed,
  figure: { value: number; raw: string; assumedUnit?: string | undefined },
  twist: boolean,
) {
  const table = factors[kind]
  const text = twist ? figure.raw.replace(/^\s*1\s*(?:[:/-]|in\b)\s*/, '') : figure.raw
  const found = [...text.matchAll(/(\d[\d.,]*|\.\d+)\s*("|″|[A-Za-z]+(?:\/[A-Za-z]+)?)?/g)]
  let known = false
  for (const [i, [, number, unit]] of found.entries()) {
    const factor = table[(unit ?? (i === 0 ? figure.assumedUnit : undefined) ?? '').toLowerCase()]
    if (factor === undefined) continue
    known = true
    if (
      // group 1 always takes part in a match
      readings(number as string).some(
        (n) => Math.abs(n * factor - figure.value) <= tolerance * Math.abs(figure.value),
      )
    )
      return true
  }
  return !known
}

/** Every printed figure of a load with its path, quantity and whether it is a twist. */
function* figures(l: PublishedLoad) {
  const at = (
    path: string,
    kind: Printed,
    figure: { value?: number | undefined; raw: string; assumedUnit?: string | undefined },
    twist = false,
  ) =>
    figure.value === undefined
      ? []
      : [{ path, kind, twist, figure: { ...figure, value: figure.value } }]
  yield* at('bullet.mass', 'mass', l.bullet.mass)
  if (l.bullet.diameter) yield* at('bullet.diameter', 'length', l.bullet.diameter)
  if (l.coal) yield* at('coal', 'length', l.coal)
  if (l.barrel?.length) yield* at('barrel.length', 'length', l.barrel.length)
  if (l.barrel?.twist) yield* at('barrel.twist', 'length', l.barrel.twist, true)
  for (const [i, c] of l.charges.entries()) {
    yield* at(`charges.${i}.charge`, 'mass', c.charge)
    if (c.velocity) yield* at(`charges.${i}.velocity`, 'velocity', c.velocity)
    if (c.velocity?.point?.distance)
      yield* at(`charges.${i}.velocity.point.distance`, 'length', c.velocity.point.distance)
    if (c.pressure)
      yield* at(`charges.${i}.pressure.peak`, 'pressure', {
        ...c.pressure.peak,
        assumedUnit: c.pressure.peak.assumedUnit ?? c.pressure.unit,
      })
  }
}

/** A pressure whose printed text names a unit other than its `unit`. */
function checkPressureUnits(l: PublishedLoad, where: string, errors: string[]) {
  for (const [i, c] of l.charges.entries()) {
    const p = c.pressure
    if (p && /[a-z]/i.test(p.peak.raw) && !p.peak.raw.toLowerCase().includes(p.unit.toLowerCase()))
      errors.push(
        `${where}: loads ${l.id}: charges.${i}.pressure.unit ${p.unit} is not in "${p.peak.raw}"`,
      )
  }
}

/** The findings of one load's printed figures: a value that does not follow its printed text. */
function checkPrintedFigures(l: PublishedLoad, where: string, errors: string[]) {
  for (const { path, kind, twist, figure } of figures(l))
    if (!follows(kind, figure, twist))
      errors.push(
        `${where}: loads ${l.id}: ${path}: value ${figure.value} does not follow "${figure.raw}"`,
      )
}

/** The primers of one load: each named record exists, and a printed size or magnum agrees with it. */
function checkLoadPrimers(l: PublishedLoad, where: string, known: Known, errors: string[]) {
  const { records = [], size, magnum } = l.primer ?? {}
  const said = (message: string) => errors.push(`${where}: loads ${l.id}: ${message}`)
  for (const ref of records) {
    const id = parseRef(ref)?.id ?? ref
    const record = known.primers.get(id)
    if (!record) {
      if (!known.renamedPrimers.has(id)) said(`unknown primer "${ref}"`)
      continue
    }
    if (size !== undefined && size !== record.size)
      said(`primer size ${size} differs from ${record.id} (${record.size})`)
    // a primer record leaves magnum out when no source states it, which is not a disagreement
    if (magnum !== undefined && record.magnum !== undefined && magnum !== record.magnum)
      said(`primer magnum differs from ${record.id}`)
  }
}

/** The references of one load: bullet, powder and primers exist, and a printed size agrees with them. */
function checkLoadReferences(l: PublishedLoad, where: string, known: Known, errors: string[]) {
  const id = (ref: string) => parseRef(ref)?.id ?? ref
  const unknown = (field: string, ref: string) =>
    errors.push(`${where}: loads ${l.id}: unknown ${field} "${ref}"`)
  if (l.bullet.record !== undefined && !known.bullets.has(id(l.bullet.record)))
    unknown('bullet', l.bullet.record)
  if (l.powder.record !== undefined && !known.powders.has(id(l.powder.record)))
    unknown('powder', l.powder.record)
  checkLoadPrimers(l, where, known, errors)
}

/** Load ids are unique in their file and the loads are sorted by id, so a re-import edits in place. */
function checkLoadOrder(file: PublishedLoads, where: string, errors: string[]) {
  const ids = file.loads.map((l) => l.id)
  let previous: string | undefined
  for (const [i, id] of ids.entries()) {
    if (ids.indexOf(id) !== i) errors.push(`${where}: duplicate load id "${id}"`)
    else if (previous !== undefined && previous > id)
      errors.push(`${where}: load "${id}" is not in id order`)
    previous = id
  }
}

/**
 * The rules of published load files, each finding one error:
 * - the folder is the file's cartridge, which exists;
 * - the maker is a manufacturer record, and the file name is the maker's id (`<maker>-customer`
 *   for a table of loads customers sent);
 * - the loads have unique ids and are sorted by them;
 * - a bullet, powder or primer record a load names exists (an old id of a bullet or powder does not
 *   count, so a rename rewrites its loads), and a printed primer size agrees with the records;
 * - the value of a printed figure follows its printed text.
 */
export function checkPublishedLoads(
  files: readonly LocatedPublishedLoads[],
  targets: PublishedLoadTargets,
  errors: string[],
) {
  const known: Known = {
    cartridges: targets.cartridges,
    manufacturers: targets.manufacturers,
    bullets: new Set(targets.bullets.map((b) => b.id)),
    powders: new Set(targets.powders.map((p) => p.id)),
    primers: new Map(targets.primers.map((p) => [p.id, p])),
    renamedPrimers: new Set(targets.renamedPrimers),
  }
  for (const { folder, file } of files) {
    const where = `loads/${folder}/${file.id}.json`
    const cartridge = parseRef(file.cartridge)?.id ?? file.cartridge
    if (cartridge !== folder)
      errors.push(`${where}: cartridge "${file.cartridge}" is not the folder "${folder}"`)
    else if (!known.cartridges.has(cartridge))
      errors.push(`${where}: unknown cartridge "${file.cartridge}"`)
    if (!known.manufacturers.has(file.maker)) errors.push(`${where}: unknown maker "${file.maker}"`)
    const name = file.producedBy === 'customer' ? `${file.maker}-customer` : file.maker
    if (file.id !== name)
      errors.push(`${where}: a table produced by the ${file.producedBy} is named "${name}"`)
    checkLoadOrder(file, where, errors)
    for (const l of file.loads) {
      checkLoadReferences(l, where, known, errors)
      checkPrintedFigures(l, where, errors)
      checkPressureUnits(l, where, errors)
    }
  }
}
