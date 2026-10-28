import {
  type LoadNote,
  type LoadNoteRule,
  loadNotes,
  type SessionReading,
} from '@open-reloading/core'
import { type Load, type SessionRecord, type SessionSnapshot, toSi } from '@open-reloading/schema'
import { msg, type Translator } from '../i18n/translate.ts'
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

/**
 * The stored snapshots with `rule` dismissed for `session`: only that session's snapshot (its
 * `effective` one) becomes stored, the other sessions stay as live as they were.
 */
export function dismissed(
  stored: readonly SessionSnapshot[],
  effective: readonly SessionSnapshot[],
  session: string,
  rule: LoadNoteRule,
): SessionSnapshot[] {
  const own = effective.find((s) => s.session === session)
  if (!own) return [...stored]
  const next = { ...own, dismissed: [...new Set([...(own.dismissed ?? []), rule])] }
  return [...stored.filter((s) => s.session !== session), next]
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

const lotNames = {
  powderLot: msg('Powder lot'),
  primerLot: msg('Primer lot'),
  caseLot: msg('Case lot'),
} as const
const lengthNames = {
  overallLength: msg('Cartridge overall length'),
  baseToOgive: msg('Base to ogive'),
}

/** A note as one sentence: the values it compares, with the sessions they come from. `name` gives a session's name. */
export function noteText(
  n: LoadNote,
  name: (session: string) => string,
  system: UnitSystem,
  t: Translator['t'],
): string {
  switch (n.rule) {
    case 'powderLot':
    case 'primerLot':
    case 'caseLot': {
      const what = t(lotNames[n.rule])
      if (n.change === 'missing') {
        const missing = t('{what} is not recorded for {session}.', {
          what,
          session: name(n.session),
        })
        return n.before
          ? `${missing} ${t('{earlier} has {before}.', { earlier: name(n.earlier ?? ''), before: n.before })}`
          : missing
      }
      return t('{what} is {now} in {session} and was {before} in {earlier}.', {
        what,
        now: n.now ?? '',
        session: name(n.session),
        before: n.before ?? '',
        earlier: name(n.earlier ?? ''),
      })
    }
    case 'seating': {
      const at = (mm: number) => withUnit('length', system, toSi('length', mm))
      return t('{what} is {now} in {session} and was {before} in {earlier}.', {
        what: t(lengthNames[n.by]),
        now: at(n.now),
        session: name(n.session),
        before: at(n.before),
        earlier: name(n.earlier),
      })
    }
    case 'velocity': {
      const v = (ms: number) => withUnit('velocity', system, ms)
      return t(
        "Mean velocity is {now} in {session} and was {before} in {earlier}, a move larger than the sessions' standard deviation of {spread}.",
        {
          now: v(n.now),
          session: name(n.session),
          before: v(n.before),
          earlier: name(n.earlier),
          spread: v(n.spread),
        },
      )
    }
    case 'roundCount':
      return t(
        'The firearm has {now} rounds at {session} and had {before} at {earlier}; you set a note at {threshold} rounds.',
        {
          now: n.now,
          session: name(n.session),
          before: n.before,
          earlier: name(n.earlier),
          threshold: n.threshold,
        },
      )
  }
}
