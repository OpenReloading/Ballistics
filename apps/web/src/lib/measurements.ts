import { type LadderFlatSpots, ladderFlatSpots } from '@open-reloading/core'
import type { ChronoImport } from '@open-reloading/importers'
import { fromSi, type MeasurementSeries, toSi } from '@open-reloading/schema'
import { type Shot, type StringStats, stringStats } from './chrono.ts'

/** One chronograph file as the Measurements tab holds it: the muzzle distance in m, the charges in kg. */
export interface MeasuredSeries extends Omit<MeasurementSeries, 'muzzleDistance' | 'strings'> {
  muzzleDistance?: number
  strings: (Omit<MeasurementSeries['strings'][number], 'charge'> & { charge?: number })[]
}

/** A chronograph file on the Measurements tab with an id for this page. */
export type IdentifiedSeries = MeasuredSeries & { id: number }

const stored = (kind: 'length' | 'mass', si: number) => Number(fromSi(kind, si).toPrecision(12))

/** `s` as the load keeps it: the muzzle distance in mm, the charges in g. */
export const seriesToLoad = (s: MeasuredSeries): MeasurementSeries => ({
  ...s,
  muzzleDistance:
    s.muzzleDistance === undefined ? undefined : { value: stored('length', s.muzzleDistance) },
  strings: s.strings.map((x) => ({
    ...x,
    charge: x.charge === undefined ? undefined : { value: stored('mass', x.charge) },
  })),
})

/** The series of a load as the Measurements tab holds it: the inverse of {@link seriesToLoad}. */
export const seriesFromLoad = (s: MeasurementSeries): MeasuredSeries => ({
  ...s,
  muzzleDistance: s.muzzleDistance && toSi('length', s.muzzleDistance.value),
  strings: s.strings.map((x) => ({ ...x, charge: x.charge && toSi('mass', x.charge.value) })),
})

let lastId = 0
/** Next integer id for an `IdentifiedSeries`, counted from 1 per page load. */
export const seriesId = () => ++lastId

/**
 * A read file as the load file keeps it: string `i` with its label and `charges[i]`, kg.
 * Texts are cut to the file's caps, so a saved load opens again.
 */
export function seriesOf(
  name: string,
  data: ChronoImport,
  charges: (number | undefined)[],
): MeasuredSeries {
  const { session } = data
  const device = [session.device.manufacturerName, session.device.model].filter(Boolean).join(' ')
  return {
    name: name.slice(0, 200),
    date: session.date?.slice(0, 64) || undefined,
    device: device.slice(0, 400) || undefined,
    // mm in the session, m in the load file
    muzzleDistance: session.muzzleDistance && toSi('length', session.muzzleDistance.value),
    strings: session.strings.map((s, i) => ({
      label: data.stringLabels[i]?.slice(0, 200) || undefined,
      charge: charges[i],
      shots: s.shots,
    })),
  }
}

/** A chronograph string mapped to a charge, kg; `undefined`: not used. */
type MappedString = { charge: number | undefined; shots: Shot[] }
/** A ladder step of the last run: charge, kg, and muzzle velocity, m/s; no velocity for an invalid step. */
export type SimulatedStep = { charge: number; muzzleVelocity: number | undefined }

/** The flat spots over the charges of one series; undefined below two charges with two or more shots. */
export function seriesFlatSpots(rows: readonly ChargeRow[]): LadderFlatSpots | undefined {
  const steps = rows.flatMap(({ charge, velocityStats: st }) =>
    st?.standardDeviation === undefined
      ? []
      : [{ charge, mean: st.mean, standardDeviation: st.standardDeviation, count: st.count }],
  )
  return steps.length >= 2 ? ladderFlatSpots(steps) : undefined
}

export interface ChargeRow {
  /** kg. */
  charge: number
  /** Over the pooled shots of every string mapped to the charge; undefined when every shot is excluded. */
  velocityStats: StringStats | undefined
  /** m/s, with the importer's reason. */
  excludedShots: { velocity: number; reason: string }[]
  /** Simulated muzzle velocity of the step at this charge, m/s. */
  simulatedVelocity: number | undefined
  /** Measured mean minus simulated, m/s. */
  velocityDifference: number | undefined
  /** Difference in percent of the simulated velocity. */
  differencePercent: number | undefined
}

/** Charges closer than this are one charge, kg: 0.1 mg, below the shown 0.01 g and 0.1 gr. */
const tolerance = 1e-7

/** One row per charge in charge order, the shots of the strings mapped to it pooled. */
export function chargeRows(strings: MappedString[], steps: SimulatedStep[]): ChargeRow[] {
  const groups: { charge: number; shots: Shot[] }[] = []
  for (const s of strings) {
    if (s.charge === undefined) continue
    const c = s.charge
    const g = groups.find((x) => Math.abs(x.charge - c) < tolerance)
    if (g) g.shots.push(...s.shots)
    else groups.push({ charge: c, shots: [...s.shots] })
  }
  return groups
    .sort((a, b) => a.charge - b.charge)
    .map(({ charge, shots }) => {
      const stats = stringStats(shots)
      const simulated = steps.find((s) => Math.abs(s.charge - charge) < tolerance)?.muzzleVelocity
      const difference = stats && simulated !== undefined ? stats.mean - simulated : undefined
      return {
        charge,
        velocityStats: stats,
        excludedShots: shots.flatMap((s) =>
          s.excluded ? [{ velocity: s.velocity.value, reason: s.excluded }] : [],
        ),
        simulatedVelocity: simulated,
        velocityDifference: difference,
        differencePercent:
          difference !== undefined && simulated ? (100 * difference) / simulated : undefined,
      }
    })
}

/** The steps with a velocity in charge order: the simulated curve over charge. */
export function simulatedCurve(steps: SimulatedStep[]) {
  return steps.filter((s) => s.muzzleVelocity !== undefined).sort((a, b) => a.charge - b.charge)
}
