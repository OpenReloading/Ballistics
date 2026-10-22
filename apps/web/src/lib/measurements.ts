import type { ChronoImport } from '@openreloading/importers'
import type { MeasuredSeries } from '@openreloading/schema'
import { type Shot, type StringStats, stringStats } from './chrono.ts'

/** A chronograph file on the Measurements tab: the load file's entry and an id for this page. */
export type IdentifiedSeries = MeasuredSeries & { id: number }

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
    muzzleDistance: session.muzzleDistance && session.muzzleDistance.value / 1000,
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
