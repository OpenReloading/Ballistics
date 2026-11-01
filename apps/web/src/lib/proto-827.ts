/**
 * Throwaway prototype of #827 behind `?proto=a|b|c`: the published load rows that match the shown
 * run, each simulated at the maker's own charge, COAL and test barrel, with the deviation against
 * the empirical validation band. Rules from #823 (`research/comparable-deviation.md` on the branch
 * `research/comparable-deviation`). Remove with `proto-827-loads.json`, `proto-827-published.tsx`
 * and `proto.ts` once the build replaces it.
 */
import { handgunBarrelLengthLimit } from '@open-reloading/core'
import { type PublishedLoad, type PublishedLoads, toSi } from '@open-reloading/schema'
import { type Message, msg } from '../i18n/translate.ts'
import type { InteriorBody } from './interior-input.ts'
import fixture from './proto-827-loads.json'

/** The cited fixture: Hodgdon Annual Manual 2025, 308 Winchester; the unit test parses it with the schema. */
export const publishedFile = fixture as PublishedLoads

/** P90 of the absolute validation error, percent (#823 note, `[fit]`): the band a deviation is drawn against. */
const velocityBand = { rifle: 7.24, handgun: 12.53 } as const
const pressureBand: Partial<Record<string, number>> = { 'case-contact': 37.9, transducer: 43.74 }

type PublishedCharge = PublishedLoad['charges'][number]

/** One printed charge of a matching load. */
export interface Entry {
  key: string
  load: PublishedLoad
  charge: PublishedCharge
}

/** Where the shown run seats its bullet, m: the COAL and the seating's barrel length. */
export interface Seating {
  overallLength?: number | undefined
  barrel?: number | undefined
}

const idOf = (ref: string | undefined) => ref?.replace(/^catalogue:/, '')

/**
 * Whether `grams` is the printed mass: it rounds to the printed figure at the digits printed, so a
 * record of 11.34 g matches a printed `175 GR.` (11.33981 g).
 */
export function withinPrinted(printed: { value: number; raw: string }, grams: number): boolean {
  const number = /\d+(?:\.(\d+))?/.exec(printed.raw)
  if (!number) return false
  const perUnit = printed.value / Number(number[0])
  return Math.abs(grams - printed.value) <= 0.5 * 10 ** -(number[1]?.length ?? 0) * perUnit
}

/** The charges of `file` for the run's cartridge, powder record and bullet mass (g), in printed order. */
export function matchingRows(
  file: PublishedLoads,
  run: { cartridge?: string | undefined; powder?: string | undefined; bulletMass: number },
): Entry[] {
  if (!run.cartridge || idOf(file.cartridge) !== run.cartridge || !run.powder) return []
  return file.loads
    .filter(
      (l) => idOf(l.powder.record) === run.powder && withinPrinted(l.bullet.mass, run.bulletMass),
    )
    .flatMap((load) =>
      load.charges.map((charge) => ({ key: `${load.id}/${charge.kind}`, load, charge })),
    )
}

/** Why a row's velocity or pressure is not compared; undefined where it is. */
export function notComparable(entry: Entry): { velocity?: Message; pressure?: Message } {
  const { charge, load } = entry
  const out: { velocity?: Message; pressure?: Message } = {}
  if (!load.barrel?.length) {
    out.velocity = msg('Barrel not printed')
    out.pressure = out.velocity
  } else if (!charge.velocity) out.velocity = msg('No velocity printed')
  else if (charge.velocity.point)
    out.velocity = msg('Velocity printed at a distance: not corrected to the muzzle yet')
  if (out.pressure) return out
  const p = charge.pressure
  if (!p) out.pressure = msg('No pressure printed')
  else if (p.method === 'crusher')
    out.pressure = msg('Crusher pressure (CUP, LUP): compared by velocity only')
  else if (!p.method || pressureBand[p.method] === undefined)
    out.pressure = msg('Pressure method not stated')
  return out
}

/**
 * The run's load at the row's charge, COAL and test barrel: the bullet base moves with the COAL, so
 * the travel is the test barrel less the moved base. Undefined without a seated bullet.
 */
export function rowLoad(
  load: InteriorBody['load'],
  seating: Seating,
  entry: Entry,
): InteriorBody['load'] | undefined {
  const barrel = entry.load.barrel?.length?.value
  if (seating.barrel === undefined || barrel === undefined) return undefined
  const coal = entry.load.coal?.value
  const shift =
    coal === undefined || seating.overallLength === undefined
      ? 0
      : toSi('length', coal) - seating.overallLength
  const base = seating.barrel - load.barrel.length + shift
  return {
    ...load,
    charge: toSi('mass', entry.charge.charge.value),
    // shortcut: the volume moves by the bore area times the COAL step, not the case's inner area at the base; the build seats the bullet with @open-reloading/drawing
    chamber: { ...load.chamber, volume: load.chamber.volume + load.chamber.boreArea * shift },
    barrel: { ...load.barrel, length: toSi('length', barrel) - base },
  }
}

/** A signed deviation in percent of the printed value, with the band it is drawn against. */
export interface Deviation {
  percent: number
  band: number
  /** Simulated minus printed velocity, m/s. */
  delta?: number
}

/** Simulated minus printed for the comparable parts of `entry`; `sim` in m/s and Pa. */
export function deviationOf(entry: Entry, sim: { velocity: number; pressure: number }) {
  const reasons = notComparable(entry)
  const out: { velocity?: Deviation; pressure?: Deviation } = {}
  const v = entry.charge.velocity?.value
  const barrel = entry.load.barrel?.length?.value
  if (!reasons.velocity && v !== undefined && barrel !== undefined) {
    const handgun = toSi('length', barrel) < handgunBarrelLengthLimit
    out.velocity = {
      delta: sim.velocity - v,
      percent: (100 * (sim.velocity - v)) / v,
      band: handgun ? velocityBand.handgun : velocityBand.rifle,
    }
  }
  const p = entry.charge.pressure
  const band = p?.method && pressureBand[p.method]
  if (!reasons.pressure && p?.peak.value !== undefined && band) {
    const printed = toSi('pressure', p.peak.value)
    out.pressure = { percent: (100 * (sim.pressure - printed)) / printed, band }
  }
  return out
}

/** The row whose charge is nearest to `charge` (kg); undefined without rows. */
export const nearestRow = (entries: readonly Entry[], charge: number) =>
  entries.reduce<Entry | undefined>(
    (best, e) =>
      !best ||
      Math.abs(toSi('mass', e.charge.charge.value) - charge) <
        Math.abs(toSi('mass', best.charge.charge.value) - charge)
        ? e
        : best,
    undefined,
  )

/** Whether a powder was fitted on the rows of `cartridge`: its training split, as `splitOf` of the CLI. */
export async function inSample(cartridge: string): Promise<boolean> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(cartridge.toLowerCase()),
  )
  return (new Uint8Array(digest)[0] ?? 0) >= 102
}
