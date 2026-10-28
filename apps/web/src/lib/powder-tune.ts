import type { ChronographString, InteriorLoad } from '@open-reloading/core'
import type { SessionRecord, UserRecord } from '@open-reloading/schema'
import { parseNumber } from '../i18n/number.ts'
import type { Shot } from './chrono.ts'
import { storageName } from './edition.ts'
import { sessionRef, stringCharge } from './measurements.ts'

/** A string on the tuning screen: charge, kg, and its shots. */
export type TuneString = { charge: number; shots: Pick<Shot, 'velocity' | 'excluded'>[] }

/** The tuning route with the strings of the stored sessions `ids` preloaded. */
export const tuneHref = (ids: readonly string[]) =>
  `/powders/tune${ids.length > 0 ? `?${new URLSearchParams(ids.map((id) => ['session', id]))}` : ''}`

/** The session storage key of the load the workbench hands to the tuning route for load `load`, a reference. */
export const tuneLoadKey = (load: string) => storageName(`tuneLoad:${load}`)

/**
 * Hands `interior`, the load the workbench's run simulates, to the tuning route for the strings of
 * load `load` (a reference); undefined removes one handed over before.
 */
export function writeTuneLoad(load: string, interior: InteriorLoad | undefined) {
  try {
    if (interior) sessionStorage.setItem(tuneLoadKey(load), JSON.stringify(interior))
    else sessionStorage.removeItem(tuneLoadKey(load))
  } catch {}
}

/** The tuning route opened for the powder `powder` (a reference): it lists the saved loads that use it. */
export const tunePowderHref = (powder: string) =>
  `/powders/tune?${new URLSearchParams([['powder', powder]])}`

/** The powder reference a search string of the tuning route names. */
export const tunePowder = (search: string) => new URLSearchParams(search).get('powder') ?? undefined

/** The saved loads of `records` that use the powder `powder` (a reference) and have strings mapped to a charge, by name. */
export function loadsWithPowder(records: readonly UserRecord[], powder: string) {
  const sessions = new Map(
    records.flatMap((r) => (r.kind === 'session' ? [[sessionRef(r.id), r] as const] : [])),
  )
  return records
    .flatMap((r) => {
      if (r.kind !== 'load' || r.data.powder !== powder) return []
      const own = (r.data.sessions ?? []).flatMap((ref) => sessions.get(ref) ?? [])
      return sessionStrings(own).length > 0 ? [{ id: r.id, name: r.name }] : []
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The session ids a search string of the tuning route names, in order. */
export const tuneSessionIds = (search: string) => new URLSearchParams(search).getAll('session')

/** The strings of `sessions` mapped to a charge, in session and file order. */
export const sessionStrings = (sessions: readonly SessionRecord[]): TuneString[] =>
  sessions.flatMap((s) =>
    s.data.strings.flatMap((str) => {
      const charge = stringCharge(str)
      return charge === undefined ? [] : [{ charge, shots: str.shots }]
    }),
  )

/**
 * The strings of `sessions` mapped to a charge, split by load: those of the load the first of them
 * names (`load`, a reference; none for a string fired before its load was saved) and those of other
 * loads, which the fit leaves out.
 */
export function loadStrings(sessions: readonly SessionRecord[]) {
  const mapped = sessions.flatMap((s) =>
    s.data.strings.flatMap((str) => {
      const charge = stringCharge(str)
      return charge === undefined ? [] : [{ load: str.load, string: { charge, shots: str.shots } }]
    }),
  )
  const load = mapped[0]?.load
  const pick = (same: boolean) =>
    mapped.filter((m) => (m.load === load) === same).map((m) => m.string)
  return { load, strings: pick(true), left: pick(false) }
}

/** The strings as the powder fit reads them: the velocities of the shots not excluded; a string without one is left out. */
export const fitStrings = (strings: readonly TuneString[]): ChronographString[] =>
  strings.flatMap(({ charge, shots }) => {
    const velocities = shots.filter((s) => !s.excluded).map((s) => s.velocity.value)
    return velocities.length > 0 ? [{ charge, velocities }] : []
  })

/**
 * Shot velocities typed in one field, separated by spaces or semicolons (a comma may be the
 * decimal mark), in the unit `toSi` reads; undefined when there is none or one is no positive number.
 */
export function parseVelocities(text: string, toSi: (x: number) => number) {
  const parts = text.split(/[\s;]+/).filter((p) => p !== '')
  const values = parts.map((p) => parseNumber(p, { min: 0 }))
  if (values.length === 0) return
  const si: number[] = []
  for (const v of values) {
    if (v.kind !== 'number' || !(v.value > 0)) return
    si.push(toSi(v.value))
  }
  return si
}
