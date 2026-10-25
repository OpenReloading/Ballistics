import { type LadderFlatSpots, ladderFlatSpots } from '@open-reloading/core'
import type { ChronoImport } from '@open-reloading/importers'
import { fromSi, type SessionRecord, toSi } from '@open-reloading/schema'
import { type Shot, type StringStats, stringStats } from './chrono.ts'

type SessionString = SessionRecord['data']['strings'][number]

const storedMass = (si: number) => Number(fromSi('mass', si).toPrecision(12))

/** The reference a load keeps for the stored session `id`. */
export const sessionRef = (id: string) => `user:${id}`

/** The charge string `s` is mapped to, kg; undefined: not used. */
export const stringCharge = (s: SessionString) =>
  s.variation?.kind === 'charge' ? toSi('mass', s.variation.value.value) : undefined

/** `s` mapped to the charge `kg` as the session keeps it (g), or not used without one. */
export function withCharge(s: SessionString, kg: number | undefined): SessionString {
  const { variation: _, ...rest } = s
  return kg === undefined
    ? rest
    : { ...rest, variation: { kind: 'charge', value: { value: storedMass(kg) } } }
}

/**
 * A read file as the session record the Measurements tab holds: string `i` with its label and the
 * charge `charges[i]` (kg) it is mapped to, `manufacturer` the reference of the device's maker.
 * Texts are cut to the schema's caps.
 */
export function sessionOf(
  name: string,
  data: ChronoImport,
  charges: (number | undefined)[],
  record: { id: string; manufacturer?: string; now: Date },
): SessionRecord {
  const { session: c } = data
  return {
    kind: 'session',
    id: record.id,
    name: name.slice(0, 200),
    saved: record.now.toISOString(),
    data: {
      origin: 'user',
      ...(c.date && { date: c.date }),
      device: {
        kind: c.device.kind,
        ...(record.manufacturer && { manufacturer: record.manufacturer }),
        ...(c.device.model && { model: c.device.model }),
      },
      ...(c.muzzleDistance && { muzzleDistance: c.muzzleDistance }),
      strings: c.strings.map((s, i) => {
        const label = data.stringLabels[i]?.slice(0, 200)
        return withCharge({ ...(label && { label }), shots: s.shots }, charges[i])
      }),
      ...(c.note && { note: c.note }),
      provenance: {
        kind: 'measured',
        sources: c.provenance.sources.map((x) => ({ ...x, title: x.title ?? name })),
      },
    },
  }
}

/**
 * `session` with the load `load` named by every string that is mapped to a charge and names no
 * load yet; the same session when none does.
 */
export function attachLoad(session: SessionRecord, load: string | undefined): SessionRecord {
  if (!load) return session
  const strings = session.data.strings.map((s) => (s.variation && !s.load ? { ...s, load } : s))
  return strings.every((s, i) => s === session.data.strings[i])
    ? session
    : { ...session, data: { ...session.data, strings } }
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
