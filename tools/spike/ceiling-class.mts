/**
 * Spike: where does a stored Pmax fall against the tolerance range of a reference load?
 *
 *   node tools/spike/ceiling-class.mts [--rows <csv>...] <records root>...
 *
 * Ceiling: every Pmax of a cartridge sheet measured by transducer or piezo (or without a stated
 * method), as the limit check compares them. Reference load: a row of a load table file with a
 * start-or-max flag `max`, the cartridge's water capacity from a capacity or case record, a powder
 * record with a fitted interior model. Without row files no record holds a charge or a barrel
 * length, so every ceiling is left out, with the missing inputs counted.
 * Prints counts only. Throwaway: not part of the build.
 */
// biome-ignore-all lint/correctness/noUndeclaredDependencies: throwaway script, run from the repository root
import { readFileSync } from 'node:fs'
import {
  cartridgeBoreAreaMm2,
  cartridgeDiameters,
  type InteriorLoad,
  interior,
  interiorLoad,
  interiorPressureRange,
  leastSpecValue,
  type PressureInput,
  type PressureRange,
  powderModelValues,
  pressureToleranceDefaults,
  recordResistance,
} from '@open-reloading/core'
import { readRecords } from '@open-reloading/data'
import { toSi } from '@open-reloading/schema'

const args = process.argv.slice(2)
const rowFiles: string[] = []
const roots: string[] = []
let startTolerance = pressureToleranceDefaults.startPressureFraction
for (let i = 0; i < args.length; i++) {
  const a = args[i] as string
  if (a === '--rows') rowFiles.push(args[++i] as string)
  else if (a === '--start-tolerance') startTolerance = Number(args[++i])
  else roots.push(a)
}

const { bundle, errors } = readRecords(roots)
// sources no remaining record cites are harmless for a partial local copy
const fatal = errors.filter((e) => !e.includes('no record cites it'))
if (fatal.length > 0) throw new Error(`records: ${fatal.length} errors`)

const options = { maxTime: 0.04, maxSteps: 50000 }
const comparable = new Set<string | null>(['transducer', 'piezo', null])
const bare = (ref: string) => ref.replace(/^catalogue:/, '')
const lowerMedian = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length / 2) - 1]
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}

/** Minimal CSV reader: quoted fields with doubled quotes, no newline inside a field. */
function parseCsv(text: string): Record<string, string>[] {
  const [head, ...lines] = text.split('\n').filter((l) => l.length > 0)
  const split = (line: string) =>
    line
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((v) => v.replace(/^"(.*)"$/, '$1').replaceAll('""', '"'))
  const names = split(head as string)
  return lines.map((l) => Object.fromEntries(split(l).map((v, i) => [names[i], v])))
}

const rows = rowFiles
  .flatMap((f) => parseCsv(readFileSync(f, 'utf8')))
  .filter((r) => r.start_or_max === 'max')
const rowsByCartridge = Map.groupBy(rows, (r) => r.cartridge_id as string)

const powders = new Map(bundle.powders.map((p) => [p.id, p]))
const fitted = bundle.powders.filter((p) => p.interior).length

// water capacity in g (= cm3) per cartridge: capacity records and case products, lower median
const capacityGrams = new Map<string, number[]>()
for (const c of bundle.capacities)
  capacityGrams.set(bare(c.cartridge), [
    ...(capacityGrams.get(bare(c.cartridge)) ?? []),
    c.waterCapacity.value,
  ])
for (const c of bundle.cases)
  if (c.waterCapacity)
    capacityGrams.set(bare(c.cartridge), [
      ...(capacityGrams.get(bare(c.cartridge)) ?? []),
      c.waterCapacity.value,
    ])

interface Reference {
  nominal: number
  range: PressureRange
  dominant: PressureInput
  incomplete: boolean
  estimated: boolean
}

/** The load of a row on a cartridge, or why it is left out. */
function buildLoad(
  cartridge: (typeof bundle.cartridges)[number],
  row: Record<string, string>,
  grams: number,
): { load: InteriorLoad; estimated: boolean } | string {
  const powder = powders.get(row.powder_id as string)
  const model = powder && powderModelValues(powder)
  if (!powder || !model) return 'no powder record with an interior model'
  const d = cartridgeDiameters(cartridge)
  if (!d) return 'no G1, F and Z on the sheet'
  const l6 = leastSpecValue(cartridge.values, 'cartridge', 'L6')
  const l3 = leastSpecValue(cartridge.values, 'cartridge', 'L3')
  if (l6 === undefined || l3 === undefined) return 'no L6 and L3 for the seating depth'
  const [mass, charge, travel, stated] = [
    row.bullet_mass_g,
    row.charge_g,
    row.barrel_mm,
    row.bullet_length_mm,
  ].map((x) => (x === undefined || x === '' ? Number.NaN : Number(x)))
  if (![mass, charge, travel].every(Number.isFinite))
    return 'row without bullet mass, charge or barrel'
  // a row without a bullet length gets one from the mass, a solid of the sheet's G1 at 10.5 g/cm3
  const estimated = !Number.isFinite(stated)
  const length = estimated
    ? ((mass as number) / 10.5 / ((Math.PI / 4) * d.g1 ** 2)) * 1000
    : (stated as number)
  // the bullet part inside the case, a cylinder of the sheet's G1, comes off the water capacity
  const inside = Math.min(length, Math.max(0, length - (l6 - l3)))
  const volume = grams - ((Math.PI / 4) * d.g1 ** 2 * inside) / 1000
  if (!(volume > 0.2 * grams)) return 'seated volume under a fifth of the capacity'
  const q = cartridgeBoreAreaMm2(cartridge)
  const si = {
    ...model,
    volume: volume * 1e-6,
    boreDiameter: d.land * 1e-3,
    ...(q !== undefined && { boreArea: q * 1e-6 }),
    travel: (travel as number) * 1e-3,
    twist: 0.305,
    bulletMass: (mass as number) * 1e-3,
    charge: (charge as number) * 1e-3,
    propellantTemperature: 294.15,
  }
  const load = interiorLoad(si, undefined, d.groove * 1e-3)
  const { resistance, missing } = recordResistance(powder, {
    boreDiameter: load.chamber.boreDiameter,
    boreArea: load.chamber.boreArea,
    startPressure: load.startPressure,
    cartridge: { g1: d.g1, z: d.groove },
    bulletLengthMm: length,
  })
  if (missing.length > 0) return 'resistance law without its inputs'
  return { load: resistance ? { ...load, resistance } : load, estimated }
}

function reference(load: InteriorLoad, estimated: boolean): Reference | string {
  const run = interior(load, options)
  if (!run.valid) return `nominal run invalid: ${run.reason}`
  const range = interiorPressureRange(
    load,
    run.peakBreechPressure,
    { ...pressureToleranceDefaults, startPressureFraction: startTolerance },
    options,
  )
  let best: { input: PressureInput; spread: number } | undefined
  for (const input of new Set(range.cases.flatMap((c) => (c.input === 'all' ? [] : [c.input])))) {
    const [up, down] = [1, -1].map(
      (s) => range.cases.find((c) => c.input === input && c.side === s)?.maxPressure,
    )
    if (up == null || down == null) continue
    const spread = Math.abs(up - down)
    if (!best || spread > best.spread) best = { input, spread }
  }
  return {
    nominal: run.peakBreechPressure,
    range,
    dominant: best?.input ?? 'chargeFraction',
    incomplete: !range.complete,
    estimated,
  }
}

const tally = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n)
const sorted = (m: Map<string, number>) => Object.fromEntries([...m].sort())

type Klass = 'below' | 'inside' | 'above'
const classOf = (p: number, r: PressureRange): Klass =>
  p < r.lowPressure ? 'below' : p > r.highPressure ? 'above' : 'inside'

const pmaxValues = bundle.cartridges.flatMap((c) =>
  c.values
    .filter((v) => v.symbol === 'Pmax' && v.value !== undefined)
    .map((v) => ({ c, pa: toSi('pressure', v.value as number), method: c.pressureMethod ?? null })),
)
const cartridgesWith = new Set(pmaxValues.map((p) => p.c.id))

const leftOut = new Map<string, number>()
const byValue = { class: new Map<string, number>(), dominant: new Map<string, number>() }
const byRow = { class: new Map<string, number>(), dominant: new Map<string, number>() }
const byRowDominant = new Map<string, number>()
const byRowLength = new Map<string, number>()
const byClassDominant = new Map<string, number>()
const widths: number[] = []
const ratios: number[] = []
const lowOver: number[] = []
const highOver: number[] = []
let incomplete = 0
let rowsRun = 0
const rowReasons = new Map<string, number>()

// per cartridge: references of its usable rows, then the reference row (lower median nominal)
const refs = new Map<string, Reference[]>()
for (const c of bundle.cartridges) {
  const grams = capacityGrams.get(c.id)
  const cap = grams && lowerMedian(grams)
  for (const row of rowsByCartridge.get(c.id) ?? []) {
    if (!cap) {
      tally(rowReasons, 'no water capacity record')
      continue
    }
    const load = buildLoad(c, row, cap)
    const ref = typeof load === 'string' ? load : reference(load.load, load.estimated)
    if (typeof ref === 'string') tally(rowReasons, ref.replace(/:.*/, ''))
    else {
      rowsRun++
      refs.set(c.id, [...(refs.get(c.id) ?? []), ref])
    }
  }
}

for (const p of pmaxValues) {
  if (!comparable.has(p.method)) {
    tally(leftOut, `Pmax measured by ${p.method}`)
    continue
  }
  const list = refs.get(p.c.id)
  if (!list) {
    const missing = [
      ...(capacityGrams.has(p.c.id) ? [] : ['water capacity record']),
      ...((rowsByCartridge.get(p.c.id)?.length ?? 0) > 0
        ? []
        : ['published maximum load row (charge, barrel)']),
      ...((rowsByCartridge.get(p.c.id)?.length ?? 0) > 0 && capacityGrams.has(p.c.id)
        ? ['usable row (powder model, seating)']
        : []),
    ]
    tally(leftOut, `missing: ${missing.join(' + ')}`)
    continue
  }
  const ref = [...list].sort((a, b) => a.nominal - b.nominal)[
    Math.ceil(list.length / 2) - 1
  ] as Reference
  const k = classOf(p.pa, ref.range)
  tally(byValue.class, k)
  tally(byValue.dominant, ref.dominant)
  tally(byClassDominant, `${k} / ${ref.dominant}`)
  if (ref.incomplete) incomplete++
  for (const r of list) {
    tally(byRow.class, classOf(p.pa, r.range))
    tally(byRowLength, `${r.estimated ? 'estimated' : 'stated'} length: ${classOf(p.pa, r.range)}`)
    tally(byRow.dominant, r.dominant)
    tally(byRowDominant, `${classOf(p.pa, r.range)} / ${r.dominant}`)
    widths.push((r.range.highPressure - r.range.lowPressure) / r.nominal)
    ratios.push(r.nominal / p.pa)
    lowOver.push(r.range.lowPressure / p.pa)
    highOver.push(r.range.highPressure / p.pa)
  }
}

const q = (xs: number[]) =>
  xs.length === 0
    ? null
    : Object.fromEntries(
        ([0.1, 0.5, 0.9] as const).map((x) => [
          `p${x * 100}`,
          +(quantile(xs, x) as number).toFixed(3),
        ]),
      )

console.log(
  JSON.stringify(
    {
      startTolerance,
      cartridges: bundle.cartridges.length,
      cartridgesWithPmax: cartridgesWith.size,
      pmaxValues: pmaxValues.length,
      powders: bundle.powders.length,
      powdersWithInterior: fitted,
      cartridgesWithCapacity: capacityGrams.size,
      maxRows: rows.length,
      rowsRun,
      rowsLeftOut: sorted(rowReasons),
      pmaxValuesLeftOut: sorted(leftOut),
      perCartridgeReferenceRow: {
        classified: [...byValue.class.values()].reduce((a, b) => a + b, 0),
        class: sorted(byValue.class),
        dominant: sorted(byValue.dominant),
        classByDominant: sorted(byClassDominant),
        incompleteRange: incomplete,
      },
      perRow: {
        classified: [...byRow.class.values()].reduce((a, b) => a + b, 0),
        class: sorted(byRow.class),
        classByLengthSource: sorted(byRowLength),
        dominant: sorted(byRow.dominant),
        classByDominant: sorted(byRowDominant),
        relativeWidth: q(widths),
        nominalOverCeiling: q(ratios),
        lowOverCeiling: q(lowOver),
        highOverCeiling: q(highOver),
      },
    },
    null,
    2,
  ),
)
