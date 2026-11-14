import {
  type Bullet,
  type Cartridge,
  conversions,
  type Powder,
  type Primer,
  type PublishedLoad,
  type PublishedLoads,
  parseRef,
} from '@rangefoundry/schema'
import type { Finding } from './plausibility.ts'

/** A file of published loads and the cartridge folder it is read from. */
export type LocatedPublishedLoads = { folder: string; file: PublishedLoads }

/** The records a published load names. */
type Known = {
  cartridges: Set<string>
  manufacturers: Set<string>
  bullets: Set<string>
  powders: Set<string>
  primers: Map<string, Primer>
}

/** The records published loads are checked against. */
export type PublishedLoadTargets = {
  cartridges: Set<string>
  manufacturers: Set<string>
  bullets: readonly Pick<Bullet, 'id'>[]
  powders: readonly Pick<Powder, 'id'>[]
  primers: readonly Primer[]
}

/** Units of a printed figure and their factor to the stored unit of the quantity. */
type Printed = 'mass' | 'velocity' | 'pressure' | 'length'
// * 1000, not / conversions.g.factor: the division lands one ulp below the exact 0.06479891 g
const grain = conversions.gr.factor * 1000
const foot = conversions.ft.factor
const psi = conversions.psi.factor / conversions.bar.factor
const inch = conversions.in.factor / conversions.mm.factor
const factors: Record<Printed, Record<string, number>> = {
  mass: { g: 1, gr: grain, grs: grain, grain, grains: grain },
  velocity: { 'm/s': 1, ms: 1, 'ft/s': foot, 'ft/sec': foot, fps: foot },
  pressure: { bar: 1, psi },
  length: { mm: 1, cm: 10, m: 1000, in: inch, '"': inch, '″': inch, inch, inches: inch },
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

/** Some number printed in `raw`, read in the unit printed next to it (or the assumed unit for the first number), gives `value` to 7 significant digits; a text that prints no number or no known unit (`Flush`) is not checked, and a twist `1:12"` is its second number. */
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
      readings(number ?? '').some(
        (n) => Math.abs(n * factor - figure.value) <= tolerance * Math.abs(figure.value),
      )
    )
      return true
  }
  return !known
}

/** A printed figure of a load: its path, quantity, whether it is a twist, and the figure. */
type Figure = {
  path: string
  kind: Printed
  twist: boolean
  figure: { value: number; raw: string; assumedUnit?: string | undefined }
}

/** The figure at `path`, none when it has no value. */
const figureAt = (
  path: string,
  kind: Printed,
  figure: { value?: number | undefined; raw: string; assumedUnit?: string | undefined },
  twist = false,
): Figure[] =>
  figure.value === undefined
    ? []
    : [{ path, kind, twist, figure: { ...figure, value: figure.value } }]

/** The printed figures of charge `i` of a load. */
function chargeFigures(c: PublishedLoad['charges'][number], i: number): Figure[] {
  const distance = c.velocity?.point?.distance
  return [
    ...figureAt(`charges.${i}.charge`, 'mass', c.charge),
    ...(c.velocity ? figureAt(`charges.${i}.velocity`, 'velocity', c.velocity) : []),
    ...(distance ? figureAt(`charges.${i}.velocity.point.distance`, 'length', distance) : []),
    ...(c.pressure
      ? figureAt(`charges.${i}.pressure.peak`, 'pressure', {
          ...c.pressure.peak,
          assumedUnit: c.pressure.peak.assumedUnit ?? c.pressure.unit,
        })
      : []),
  ]
}

/** Every printed figure of a load with its path, quantity and whether it is a twist. */
function figures(l: PublishedLoad): Figure[] {
  const { diameter } = l.bullet
  const length = l.barrel?.length
  const twist = l.barrel?.twist
  return [
    ...figureAt('bullet.mass', 'mass', l.bullet.mass),
    ...(diameter ? figureAt('bullet.diameter', 'length', diameter) : []),
    ...(l.coal ? figureAt('coal', 'length', l.coal) : []),
    ...(length ? figureAt('barrel.length', 'length', length) : []),
    ...(twist ? figureAt('barrel.twist', 'length', twist, true) : []),
    ...l.charges.flatMap((c, i) => chargeFigures(c, i)),
  ]
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

/** The record id a reference names, or the reference as it is. */
const refId = (ref: string) => parseRef(ref)?.id ?? ref

type PrintedPrimer = NonNullable<PublishedLoad['primer']>

/** Where a printed primer size or magnum disagrees with the primer record it names. */
function primerDifferences(
  record: Primer,
  { size, magnum }: { size: PrintedPrimer['size']; magnum: PrintedPrimer['magnum'] },
): string[] {
  const found: string[] = []
  if (size !== undefined && size !== record.size)
    found.push(`primer size ${size} differs from ${record.id} (${record.size})`)
  // a primer record leaves magnum out when no source states it, which is not a disagreement
  if (magnum !== undefined && record.magnum !== undefined && magnum !== record.magnum)
    found.push(`primer magnum differs from ${record.id}`)
  return found
}

/** The primers of one load: each named record exists, and a printed size or magnum agrees with it. */
function checkLoadPrimers(l: PublishedLoad, where: string, known: Known, errors: string[]) {
  const { records = [], size, magnum } = l.primer ?? {}
  for (const ref of records) {
    const record = known.primers.get(refId(ref))
    const messages = record
      ? primerDifferences(record, { size, magnum })
      : [`unknown primer "${ref}"`]
    for (const message of messages) errors.push(`${where}: loads ${l.id}: ${message}`)
  }
}

/** The references of one load: bullet, powder and primers exist, and a printed size agrees with them. */
function checkLoadReferences(l: PublishedLoad, where: string, known: Known, errors: string[]) {
  const unknown = (field: string, ref: string) =>
    errors.push(`${where}: loads ${l.id}: unknown ${field} "${ref}"`)
  if (l.bullet.record !== undefined && !known.bullets.has(refId(l.bullet.record)))
    unknown('bullet', l.bullet.record)
  if (l.powder.record !== undefined && !known.powders.has(refId(l.powder.record)))
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
 * - a bullet, powder or primer record a load names exists, and a printed primer size agrees with
 *   the records;
 * - the value of a printed figure follows its printed text.
 */
export function checkPublishedLoads(
  files: readonly LocatedPublishedLoads[],
  targets: PublishedLoadTargets,
  errors: string[],
): void {
  const known: Known = {
    cartridges: targets.cartridges,
    manufacturers: targets.manufacturers,
    bullets: new Set(targets.bullets.map((b) => b.id)),
    powders: new Set(targets.powders.map((p) => p.id)),
    primers: new Map(targets.primers.map((p) => [p.id, p])),
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

/** A plausibility finding of one load of a published load file. */
export type PublishedLoadFinding = Finding & { load: string }

type Charge = PublishedLoad['charges'][number]

/** The start and the max charge of a load, where it prints both. */
function startAndMax(l: PublishedLoad): [Charge, Charge] | undefined {
  const start = l.charges.find((c) => c.kind === 'start')
  const max = l.charges.find((c) => c.kind === 'max')
  return start && max ? [start, max] : undefined
}

/** The largest value of `symbol` (any variant) of a cartridge record, where it has one. */
function largest(cartridge: Pick<Cartridge, 'values'>, symbol: string, side?: string) {
  const values = cartridge.values
    .filter((v) => v.symbol === symbol && (side === undefined || v.side === side))
    .flatMap((v) => (v.value === undefined ? [] : [v.value]))
  return values.length > 0 ? Math.max(...values) : undefined
}

/** Two printed distances agree where both are printed. */
const sameDistance = (d: number | undefined, e: number | undefined) =>
  d === undefined || e === undefined || d === e

type Velocity = NonNullable<Charge['velocity']>

/** Where two velocities apply: the same printed symbol (or none), and the same distance where both print one. */
function samePoint(a: Velocity, b: Velocity) {
  const [p, q] = [a.point, b.point]
  if (p?.label !== q?.label) return false
  return sameDistance(p?.distance?.value, q?.distance?.value)
}

/** The start charge above the max charge. */
function chargeOrder(start: Charge, max: Charge): Finding[] {
  if (!(start.charge.value > max.charge.value)) return []
  return [
    {
      finding: 'start-above-max',
      message: `the start charge ${start.charge.raw} is above the max charge ${max.charge.raw}`,
    },
  ]
}

/** The velocity of the max charge below that of the start charge, at the same point. */
function velocityOrder(start: Charge, max: Charge): Finding[] {
  const [v, w] = [start.velocity, max.velocity]
  if (!v || !w || !samePoint(v, w) || !(w.value < v.value)) return []
  return [
    {
      finding: 'velocity-order',
      message: `the velocity of the max charge, ${w.raw}, is below that of the start charge, ${v.raw}`,
    },
  ]
}

/** The pressure of the max charge below that of the start charge, on the same unit and method. */
function pressureOrder(start: Charge, max: Charge): Finding[] {
  const [p, q] = [start.pressure, max.pressure]
  if (p?.peak.value === undefined || q?.peak.value === undefined) return []
  if (p.unit !== q.unit || p.method !== q.method || !(q.peak.value < p.peak.value)) return []
  return [
    {
      finding: 'pressure-order',
      message: `the pressure of the max charge, ${q.peak.raw}, is below that of the start charge, ${p.peak.raw}`,
    },
  ]
}

/** The order findings of a load's start and max charge: charge, velocity and pressure. */
function orderFindings(l: PublishedLoad): Finding[] {
  const pair = startAndMax(l)
  if (!pair) return []
  const [start, max] = pair
  return [...chargeOrder(start, max), ...velocityOrder(start, max), ...pressureOrder(start, max)]
}

type CartridgeLimits = Pick<Cartridge, 'id' | 'pressureMethod' | 'values'>

/** The pressures on the cartridge record's own basis above its largest Pmax. */
function pressureAboveMax(l: PublishedLoad, cartridge: CartridgeLimits): Finding[] {
  const pmax = largest(cartridge, 'Pmax')
  const method = cartridge.pressureMethod
  // only a value on the record's own basis; no value is converted between bases
  if (pmax === undefined || method === undefined) return []
  return l.charges.flatMap((c) => {
    const p = c.pressure
    // a case-contact gauge reads on its own basis: Pmax is not its limit (#855)
    if (p?.peak.value === undefined || p.method !== method || p.method === 'case-contact') return []
    if (!(p.peak.value > pmax)) return []
    return [
      {
        finding: 'pressure-above-cartridge-max',
        message: `the ${c.kind} pressure ${p.peak.raw} (${p.method}) is above Pmax ${pmax} bar of ${cartridge.id}`,
      },
    ]
  })
}

/** COAL above the cartridge record's largest L6. */
function coalAboveMax(l: PublishedLoad, cartridge: CartridgeLimits): Finding[] {
  const l6 = largest(cartridge, 'L6', 'cartridge')
  if (l6 === undefined || l.coal?.value === undefined || !(l.coal.value > l6)) return []
  return [
    {
      finding: 'coal-above-cartridge-max',
      message: `COAL ${l.coal.raw} is above L6 ${l6} mm of ${cartridge.id}`,
    },
  ]
}

/** The findings of a load against its cartridge record: pressure above Pmax, COAL above L6. */
function cartridgeFindings(l: PublishedLoad, cartridge: CartridgeLimits): Finding[] {
  return [...pressureAboveMax(l, cartridge), ...coalAboveMax(l, cartridge)]
}

/**
 * The plausibility findings of a published load file, each a warning: a printed value that looks
 * wrong is still the maker's value and stays as printed. Findings:
 * - `start-above-max`: the start charge is above the max charge of the same load;
 * - `velocity-order`: the velocity of the max charge is below that of the start charge (same point);
 * - `pressure-order`: the pressure of the max charge is below that of the start charge (same unit
 *   and method, both with a value in bar);
 * - `pressure-above-cartridge-max`: a pressure with a value in bar whose method is the cartridge
 *   record's `pressureMethod` is above the record's largest `Pmax`. Other methods, and case-contact
 *   pressure always, are not compared: no value is converted between pressure bases;
 * - `coal-above-cartridge-max`: COAL above the record's largest `L6` (maximum cartridge length).
 * Without a cartridge record only the order findings apply.
 */
export function checkPublishedLoadPlausibility(
  file: PublishedLoads,
  cartridge: Pick<Cartridge, 'id' | 'pressureMethod' | 'values'> | undefined,
): PublishedLoadFinding[] {
  return file.loads.flatMap((l) =>
    [...orderFindings(l), ...(cartridge ? cartridgeFindings(l, cartridge) : [])].map((f) => ({
      ...f,
      load: l.id,
    })),
  )
}
