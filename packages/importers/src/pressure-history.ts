// A pressure-time trace of the user's own measurement: time and pressure columns, the units and the
// sensor position named by the user or the file, an optional zero-phase low-pass.
import { detectDelimiter, splitCells } from './generic.ts'
import { psi } from './record-fields.ts'
import { bracketed, splitLines } from './text.ts'

/** A pressure unit the trace importer recognises (any case in the file). */
export type PressureUnit = 'bar' | 'mbar' | 'MPa' | 'kPa' | 'Pa' | 'psi' | 'kpsi'

/** A time unit the trace importer recognises (`µs` reads as `us`). */
export type TimeUnit = 's' | 'ms' | 'us'

/** Factor of each pressure unit to the stored unit, bar. */
const pressureUnits: Record<PressureUnit, number> = {
  bar: 1,
  mbar: 1e-3,
  MPa: 10,
  kPa: 0.01,
  Pa: 1e-5,
  psi,
  kpsi: psi * 1000,
}

/** Factor of each time unit to s. */
const timeUnits: Record<TimeUnit, number> = { s: 1, ms: 1e-3, us: 1e-6 }

/** Where the sensor measured: at the breech, the space mean in the chamber, or at the projectile base. */
export type SensorPosition = 'breech' | 'mean' | 'base'

const sensors: readonly SensorPosition[] = ['breech', 'mean', 'base']

/** Options of `parsePressureHistory`. */
export interface PressureHistoryOptions {
  /** Sensor position, always asked from the user: the file cannot tell it. */
  sensor: SensorPosition
  /** Pressure unit when the file names none in its header. */
  pressureUnit?: PressureUnit | undefined
  /** Time unit when the file names none in its header. */
  timeUnit?: TimeUnit | undefined
  /** Column of the times and of the pressures, counted from 1; default 1 and 2. */
  columns?: { time: number; pressure: number } | undefined
  /** Cell separator; detected when absent. */
  delimiter?: ',' | ';' | '\t' | undefined
  /**
   * One-pole low-pass of the pressure, run forwards and backwards (no delay): -3 dB at about 0.64
   * times `cutoff`, Hz. It smooths the peak when the cutoff is not well above the trace's content.
   */
  lowPass?: { cutoff: number } | undefined
}

/** A trace as the importer returns it: times in s, pressures in bar (the stored unit), the sensor. */
export interface PressureHistoryImport {
  sensor: SensorPosition
  /** Sample times, s, strictly increasing. */
  time: number[]
  /** Pressures, bar (the fit of core takes Pa: multiply by 1e5). */
  pressureBar: number[]
  /** The units read and where each came from: the file's header or the caller. */
  units: {
    time: { unit: TimeUnit; source: 'file' | 'caller' }
    pressure: { unit: PressureUnit; source: 'file' | 'caller' }
  }
  /** The low-pass applied, or absent. */
  lowPass?: { cutoff: number }
  warnings: string[]
}

/**
 * A number with a decimal point or comma and optional exponent (`1.0E-05`), NaN otherwise. A lone
 * comma is a decimal comma (`0,125`): the delimiter is a semicolon or a tab when cells hold one.
 */
function reading(text: string): number {
  const t = text.trim()
  if (t.includes(',') && t.includes('.')) return Number.NaN
  const s = t.replace(',', '.')
  return /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s) ? Number(s) : Number.NaN
}

/** The text in `(...)` or `[...]` of a header cell, else undefined. */
function bracketedUnit(cell: string): string | undefined {
  return bracketed(cell) ?? squareBracketed(cell)?.trim()
}

/** The text between the first `[` and the next `]` that encloses some, else undefined; linear time. */
function squareBracketed(cell: string): string | undefined {
  for (let a = cell.indexOf('['); a >= 0; a = cell.indexOf('[', a + 1)) {
    const b = cell.indexOf(']', a + 1)
    if (b < 0) return undefined
    if (b > a + 1) return cell.slice(a + 1, b)
  }
  return undefined
}

/** The unit text of a header cell: in brackets, else the last word when it is a unit, else none. */
function namedUnit(table: Record<string, number>, cell: string): string {
  const word = cell.trim().split(/\s+/).at(-1) ?? ''
  return (bracketedUnit(cell) ?? (lookup(table, word) ? word : '')).trim()
}

/**
 * The unit of `table` that `text` names: the exact spelling, else any case when the text is all
 * lower or all upper case (`mPa` and `Mbar` name no unit of the table, they are not `MPa`, `mbar`).
 */
function lookup<T extends string>(table: Record<T, number>, text: string): T | undefined {
  const key = text.replace('µ', 'u').replace('μ', 'u')
  // the keys of the table are its units
  const units = Object.keys(table) as T[]
  const exact = units.find((k) => k === key)
  const loose = key === key.toLowerCase() || key === key.toUpperCase()
  return exact ?? (loose ? units.find((k) => k.toLowerCase() === key.toLowerCase()) : undefined)
}

/** A sample of the trace: its time and its value. */
interface Sample {
  time: number
  value: number
}

/** One pass of the one-pole low-pass over the samples, in their order. */
function pass(samples: Sample[], rc: number): Sample[] {
  const out: Sample[] = []
  for (const s of samples) {
    const before = out.at(-1)
    if (!before) {
      out.push(s)
      continue
    }
    const dt = s.time - before.time
    out.push({ time: s.time, value: before.value + (dt / (rc + dt)) * (s.value - before.value) })
  }
  return out
}

/** Zero-phase one-pole low-pass: forwards, then backwards on the reversed series. */
function zeroPhase(samples: Sample[], cutoff: number): number[] {
  const rc = 1 / (2 * Math.PI * cutoff)
  const forward = pass(samples, rc).map((s) => ({ time: -s.time, value: s.value }))
  return pass(forward.toReversed(), rc)
    .toReversed()
    .map((s) => s.value)
}

/** The time and pressure column numbers and the low-pass cutoff of the options, checked. */
function checkedOptions(options: PressureHistoryOptions): {
  tc: number
  pc: number
  cutoff: number | undefined
} {
  if (!sensors.includes(options.sensor))
    throw new Error('the sensor position is missing: name breech, mean or base')
  const { time: tc = 1, pressure: pc = 2 } = options.columns ?? {}
  if (![tc, pc].every((c) => Number.isInteger(c) && c >= 1) || tc === pc)
    throw new Error('columns: two different column numbers counted from 1')
  return { tc, pc, cutoff: checkedCutoff(options.lowPass?.cutoff) }
}

/** The low-pass cutoff, refused unless it is a frequency above 0 Hz. */
function checkedCutoff(cutoff: number | undefined): number | undefined {
  if (cutoff !== undefined && !(Number.isFinite(cutoff) && cutoff > 0))
    throw new Error('lowPass cutoff must be a frequency above 0 Hz')
  return cutoff
}

/** Removes and returns the first row when its time cell is not a number: the header row. */
function takeHeader(rows: string[][], tc: number): string[] | undefined {
  const [top] = rows
  return top && Number.isNaN(reading(top[tc - 1] ?? '')) ? rows.shift() : undefined
}

/**
 * The unit of a column: the one its header cell names, else the caller's; refused when the two
 * differ or neither names one, and a warning when the header names an unknown unit.
 */
function columnUnit<T extends string>(
  column: { name: string; header: string },
  table: Record<T, number>,
  caller: T | undefined,
  warnings: string[],
): { unit: T; source: 'file' | 'caller' } {
  const named = namedUnit(table, column.header)
  const file = lookup(table, named)
  if (file && caller && file !== caller)
    throw new Error(
      `${column.name} unit "${named}" in the file differs from ${caller} named by the caller`,
    )
  const unit = file ?? caller
  if (!unit) throw new Error(`${column.name} unit is missing: name the unit to import this file`)
  if (!file && named)
    warnings.push(
      `${column.name} unit "${named}" in the file is unknown; using ${unit} as named by the caller`,
    )
  return { unit, source: file ? 'file' : 'caller' }
}

/**
 * The samples of the rows in s and bar, with the factors of the time and pressure units;
 * refused for a cell that is not a finite number and for times that do not increase. `first` is
 * the line number of the first row.
 */
function readSamples(
  rows: string[][],
  { tc, pc, first }: { tc: number; pc: number; first: number },
  { tf, pf }: { tf: number; pf: number },
): Sample[] {
  const samples: Sample[] = []
  rows.forEach((cells, i) => {
    const [t, p] = [reading(cells[tc - 1] ?? ''), reading(cells[pc - 1] ?? '')]
    if (Number.isNaN(t) || Number.isNaN(p))
      throw new Error(`line ${i + first}: time or pressure is not a number`)
    const [seconds, bar] = [t * tf, p * pf]
    if (!Number.isFinite(seconds) || !Number.isFinite(bar))
      throw new Error(`line ${i + first}: time or pressure is not finite`)
    const before = samples.at(-1)
    if (before && seconds <= before.time) throw new Error(`line ${i + first}: times must increase`)
    samples.push({ time: seconds, value: bar })
  })
  return samples
}

/**
 * Reads a pressure-time trace from delimited text (the caller turns bytes into text): one sample per
 * row, a header row optional. Units come from the header (`time (ms)`, `pressure [MPa]`) or the options; a unit that is neither throws with a message naming the column, and one
 * the file names differently from the option throws. Times must increase. Pressures are returned
 * in bar and times in s; the sensor position is the caller's. A simulation input, never load data.
 */
export function parsePressureHistory(
  text: string,
  options: PressureHistoryOptions,
): PressureHistoryImport {
  const { tc, pc, cutoff } = checkedOptions(options)
  const lines = splitLines(text).filter((l) => l.trim())
  const delimiter = options.delimiter ?? detectDelimiter(lines)
  const rows = lines.map((l) => splitCells(l, delimiter))
  const header = takeHeader(rows, tc)
  const headerCell = (c: number) => header?.[c - 1] ?? ''
  const warnings: string[] = []
  const timeUnit = columnUnit(
    { name: 'time', header: headerCell(tc) },
    timeUnits,
    options.timeUnit,
    warnings,
  )
  const pressureUnit = columnUnit(
    { name: 'pressure', header: headerCell(pc) },
    pressureUnits,
    options.pressureUnit,
    warnings,
  )
  const factors = { tf: timeUnits[timeUnit.unit], pf: pressureUnits[pressureUnit.unit] }
  const samples = readSamples(rows, { tc, pc, first: header ? 2 : 1 }, factors)
  if (samples.length < 3) throw new Error('a trace needs at least 3 samples')
  const time = samples.map((s) => s.time)
  const pressure = samples.map((s) => s.value)
  return {
    sensor: options.sensor,
    time,
    pressureBar: cutoff === undefined ? pressure : zeroPhase(samples, cutoff),
    units: { time: timeUnit, pressure: pressureUnit },
    ...(cutoff === undefined ? {} : { lowPass: { cutoff } }),
    warnings,
  }
}
