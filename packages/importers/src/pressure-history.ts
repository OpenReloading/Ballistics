// A pressure-time trace of the user's own measurement: time and pressure columns, the units and the
// sensor position named by the user or the file, an optional zero-phase low-pass.
import { detectDelimiter, splitCells } from './generic.ts'
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
  // 1 psi = 0.45359237 kg * 9.80665 m/s2 / (0.0254 m)^2 = 6894.757293168 Pa, NIST SP 811 Appendix B.9
  psi: 6894.757293168e-5,
  kpsi: 6894.757293168e-2,
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
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ? Number(s) : Number.NaN
}

/** The text in `(...)` or `[...]` of a header cell, else undefined. */
function bracketedUnit(cell: string): string | undefined {
  return bracketed(cell) ?? /\[([^\]]+)\]/.exec(cell)?.[1]?.trim()
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
  const units = Object.keys(table) as T[]
  const exact = units.find((k) => k === key)
  const loose = key === key.toLowerCase() || key === key.toUpperCase()
  return exact ?? (loose ? units.find((k) => k.toLowerCase() === key.toLowerCase()) : undefined)
}

/** One pass of the one-pole low-pass over `v` at times `t`. */
function pass(t: number[], v: number[], rc: number): number[] {
  const out = [...v]
  for (let i = 1; i < v.length; i++) {
    const dt = (t[i] as number) - (t[i - 1] as number)
    out[i] = (out[i - 1] as number) + (dt / (rc + dt)) * ((v[i] as number) - (out[i - 1] as number))
  }
  return out
}

/** Zero-phase one-pole low-pass: forwards, then backwards on the reversed series. */
function zeroPhase(t: number[], v: number[], cutoff: number): number[] {
  const rc = 1 / (2 * Math.PI * cutoff)
  const reversed = t.map((x) => -x).reverse()
  return pass(reversed, pass(t, v, rc).reverse(), rc).reverse()
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
  if (!sensors.includes(options.sensor))
    throw new Error('the sensor position is missing: name breech, mean or base')
  const { time: tc = 1, pressure: pc = 2 } = options.columns ?? {}
  if (![tc, pc].every((c) => Number.isInteger(c) && c >= 1) || tc === pc)
    throw new Error('columns: two different column numbers counted from 1')
  const cutoff = options.lowPass?.cutoff
  if (cutoff !== undefined && !(Number.isFinite(cutoff) && cutoff > 0))
    throw new Error('lowPass cutoff must be a frequency above 0 Hz')
  const lines = splitLines(text).filter((l) => l.trim())
  const delimiter = options.delimiter ?? detectDelimiter(lines)
  const rows = lines.map((l) => splitCells(l, delimiter))
  const header = rows[0] && Number.isNaN(reading(rows[0][tc - 1] ?? '')) ? rows.shift() : undefined
  const warnings: string[] = []
  const resolve = <T extends string>(
    column: string,
    table: Record<T, number>,
    caller: T | undefined,
    cell: number,
  ) => {
    const named = namedUnit(table, header?.[cell - 1] ?? '')
    const file = lookup(table, named)
    if (file && caller && file !== caller)
      throw new Error(
        `${column} unit "${named}" in the file differs from ${caller} named by the caller`,
      )
    const unit = file ?? caller
    if (!unit) throw new Error(`${column} unit is missing: name the unit to import this file`)
    if (!file && named)
      warnings.push(
        `${column} unit "${named}" in the file is unknown; using ${unit} as named by the caller`,
      )
    return { unit, source: file ? ('file' as const) : ('caller' as const) }
  }
  const timeUnit = resolve<TimeUnit>('time', timeUnits, options.timeUnit, tc)
  const pressureUnit = resolve<PressureUnit>('pressure', pressureUnits, options.pressureUnit, pc)
  const tf = timeUnits[timeUnit.unit]
  const pf = pressureUnits[pressureUnit.unit]
  const first = header ? 2 : 1
  const time: number[] = []
  const pressure: number[] = []
  rows.forEach((cells, i) => {
    const [t, p] = [reading(cells[tc - 1] ?? ''), reading(cells[pc - 1] ?? '')]
    if (Number.isNaN(t) || Number.isNaN(p))
      throw new Error(`line ${i + first}: time or pressure is not a number`)
    if (time.length > 0 && t * tf <= (time.at(-1) as number))
      throw new Error(`line ${i + first}: times must increase`)
    time.push(t * tf)
    pressure.push(p * pf)
  })
  if (time.length < 3) throw new Error('a trace needs at least 3 samples')
  return {
    sensor: options.sensor,
    time,
    pressureBar: cutoff === undefined ? pressure : zeroPhase(time, pressure, cutoff),
    units: { time: timeUnit, pressure: pressureUnit },
    ...(cutoff === undefined ? {} : { lowPass: { cutoff } }),
    warnings,
  }
}
