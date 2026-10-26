import {
  type LoadNote,
  type LoadNoteRule,
  loadNotes,
  type SessionReading,
} from '@open-reloading/core'
import { type Load, type SessionRecord, type SessionSnapshot, toSi } from '@open-reloading/schema'
import { sessionRef } from './measurements.ts'
import { stringStats } from './string-stats.ts'
import { type UnitSystem, withUnit } from './units.ts'

/** Strings mapped to a charge closer than this to the load's charge are the load's own, kg (0.1 mg). */
const sameCharge = 1e-7

/** The lots of the load, as typed. */
export interface Lots {
  powder: string
  primer: string
  case: string
}

/** No lot typed. */
export const noLots: Lots = { powder: '', primer: '', case: '' }

/** What the workbench holds of the load when a session is attached to it. */
export interface LoadMoment {
  lots: Lots
  /** The seating in stored units (mm). */
  seating?: { by: 'overallLength' | 'baseToOgive'; value: number } | undefined
  /** Rounds through the chosen firearm. */
  roundCount?: number | undefined
}

/** The lots a load carries. */
export const lotsFrom = (d: Load): Lots => ({
  powder: d.powderLot ?? '',
  primer: d.primer?.lot ?? '',
  case: d.case?.lot ?? '',
})

const lot = (text: string) => text.trim() || undefined

/** The snapshot of `session` (a reference) for the load as it is now. */
export function snapshotOf(session: string, now: LoadMoment): SessionSnapshot {
  const lots = {
    powderLot: lot(now.lots.powder),
    primerLot: lot(now.lots.primer),
    caseLot: lot(now.lots.case),
  }
  return {
    session,
    ...Object.fromEntries(Object.entries(lots).filter(([, v]) => v !== undefined)),
    ...(now.seating && { seating: { by: now.seating.by, value: { value: now.seating.value } } }),
    ...(now.roundCount !== undefined && { roundCount: now.roundCount }),
  }
}

/**
 * One snapshot per session in `refs`, in that order: the stored one, else the load as it is now
 * (it becomes stored when the load is saved).
 */
export function effectiveSnapshots(
  refs: readonly string[],
  stored: readonly SessionSnapshot[],
  now: LoadMoment,
): SessionSnapshot[] {
  return refs.map((ref) => stored.find((s) => s.session === ref) ?? snapshotOf(ref, now))
}

/** `snapshots` with `rule` dismissed for `session`. */
export function dismissed(
  snapshots: readonly SessionSnapshot[],
  session: string,
  rule: LoadNoteRule,
): SessionSnapshot[] {
  return snapshots.map((s) =>
    s.session === session && !s.dismissed?.includes(rule)
      ? { ...s, dismissed: [...(s.dismissed ?? []), rule] }
      : s,
  )
}

/**
 * The velocity statistics of the strings of `record` mapped to `charge` (kg), the load's own
 * charge; none without such a string or counted shot.
 */
function velocityOf(record: SessionRecord | undefined, charge: number | undefined) {
  if (!record || charge === undefined) return
  const shots = record.data.strings
    .filter(
      (s) =>
        s.variation?.kind === 'charge' &&
        Math.abs(toSi('mass', s.variation.value.value) - charge) < sameCharge,
    )
    .flatMap((s) => s.shots)
  const st = stringStats(shots)
  return st && { mean: st.mean, standardDeviation: st.standardDeviation, count: st.count }
}

/** The notes of a load: its sessions' snapshots and records (those this browser holds) and its charge, kg. */
export function notesOf(
  refs: readonly string[],
  snapshots: readonly SessionSnapshot[],
  records: readonly SessionRecord[],
  charge: number | undefined,
  threshold: number | undefined,
): LoadNote[] {
  const readings = refs.map((ref): SessionReading => {
    const snap = snapshots.find((s) => s.session === ref)
    const record = records.find((r) => sessionRef(r.id) === ref)
    return {
      id: ref,
      date: record?.data.date,
      powderLot: snap?.powderLot,
      primerLot: snap?.primerLot,
      caseLot: snap?.caseLot,
      seating: snap?.seating && { by: snap.seating.by, value: snap.seating.value.value },
      roundCount: snap?.roundCount,
      velocity: velocityOf(record, charge),
      dismissed: snap?.dismissed,
    }
  })
  return loadNotes(readings, threshold)
}

const lotNames = { powderLot: 'powder', primerLot: 'primer', caseLot: 'case' } as const
const lengthNames = { overallLength: 'Cartridge overall length', baseToOgive: 'Base to ogive' }

/** A note as one sentence: the values it compares, with the sessions they come from. `name` gives a session's name. */
export function noteText(
  n: LoadNote,
  name: (session: string) => string,
  system: UnitSystem,
): string {
  switch (n.rule) {
    case 'powderLot':
    case 'primerLot':
    case 'caseLot': {
      const what = `${lotNames[n.rule][0]?.toUpperCase()}${lotNames[n.rule].slice(1)} lot`
      if (n.change === 'missing')
        return `${what} is not recorded for ${name(n.session)}.${
          n.before ? ` ${name(n.earlier ?? '')} has ${n.before}.` : ''
        }`
      return `${what} is ${n.now} in ${name(n.session)} and was ${n.before} in ${name(n.earlier ?? '')}.`
    }
    case 'seating': {
      const at = (mm: number) => withUnit('length', system, toSi('length', mm))
      return `${lengthNames[n.by]} is ${at(n.now)} in ${name(n.session)} and was ${at(n.before)} in ${name(n.earlier)}.`
    }
    case 'velocity': {
      const v = (ms: number) => withUnit('velocity', system, ms)
      return `Mean velocity is ${v(n.now)} in ${name(n.session)} and was ${v(n.before)} in ${name(n.earlier)}, a move larger than the sessions' standard deviation of ${v(n.spread)}.`
    }
    case 'roundCount':
      return `The firearm has ${n.now} rounds at ${name(n.session)} and had ${n.before} at ${name(n.earlier)}; you set a note at ${n.threshold} rounds.`
  }
}
