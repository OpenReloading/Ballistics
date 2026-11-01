import type { ChronographString, InteriorLoad } from '@open-reloading/core'
import {
  type Firearm,
  type Powder,
  type SessionRecord,
  toSi,
  type UserRecord,
} from '@open-reloading/schema'
import { parseNumber } from '../i18n/number.ts'
import type { Shot } from './chrono.ts'
import { storageName } from './edition.ts'
import { cartridgeClass } from './input-defaults.ts'
import { sessionRef, stringCharge } from './measurements.ts'

/** A string on the tuning screen: charge, kg, its shots and the powder temperature, K; default the load's. */
export type TuneString = {
  charge: number
  shots: Pick<Shot, 'velocity' | 'excluded'>[]
  temperature?: number | undefined
}

/** `str` as a string of the tuning screen, mapped to `charge`, kg. */
const tuneString = (str: SessionRecord['data']['strings'][number], charge: number): TuneString => ({
  charge,
  shots: str.shots,
  ...(str.propellantTemperature && {
    temperature: toSi('temperature', str.propellantTemperature.value),
  }),
})

/** The tuning route with the strings of the stored sessions `ids` preloaded. */
export const tuneHref = (ids: readonly string[]) =>
  `/powders/tune${ids.length > 0 ? `?${new URLSearchParams(ids.map((id) => ['session', id]))}` : ''}`

/** The session storage key of the load the workbench hands to the tuning route for load `load`, a reference. */
export const tuneLoadKey = (load: string) => storageName(`tuneLoad:${load}`)

/** The session storage key of the powder record of the load handed over for load `load`, a reference. */
export const tuneBaseKey = (load: string) => storageName(`tunePowder:${load}`)

/** The session storage key of the CIP table of the cartridge record of the load handed over for load `load`, a reference. */
export const tuneTableKey = (load: string) => storageName(`tuneTable:${load}`)

/**
 * The session storage key of the id of the cartridge record of the load handed over for load
 * `load`, a reference, kept when the record was still loading, so the tuning route reads its table.
 */
export const tuneCartridgeKey = (load: string) => storageName(`tuneCartridge:${load}`)

/** The session storage key of the `action` of the firearm the load links, handed over for load `load`, a reference. */
export const tuneActionKey = (load: string) => storageName(`tuneAction:${load}`)

/**
 * Whether the workbench holds the tuning link: a record the load may take values from (a bore
 * diameter from the cartridge record, say) is asked for and not loaded yet, so no load could be
 * handed over. A record that could not be fetched (`failed`) does not hold it.
 */
export const tuneHeld = (asked: Record<string, { id: string; failed?: true } | undefined>) =>
  Object.values(asked).some((a) => a !== undefined && !a.failed)

/**
 * Hands `interior`, the load the workbench's run simulates, `powder`, its powder record, and
 * `table`, the CIP table of its cartridge record, to the tuning route for the strings of load
 * `load` (a reference); undefined removes one handed over before. `cartridge`, the id of a
 * cartridge record still loading, is handed over without a table, for the route to fetch it.
 * `action` is that of the firearm the load links, where its record states one.
 */
export function writeTuneLoad(
  load: string,
  interior: InteriorLoad | undefined,
  powder?: Powder | undefined,
  table?: string | undefined,
  cartridge?: string | undefined,
  action?: Firearm['action'],
) {
  const put = (key: string, value: unknown) => {
    if (value) sessionStorage.setItem(key, JSON.stringify(value))
    else sessionStorage.removeItem(key)
  }
  try {
    put(tuneLoadKey(load), interior)
    put(tuneBaseKey(load), interior && powder)
    put(tuneTableKey(load), interior && table)
    put(tuneCartridgeKey(load), interior && !table && cartridge)
    put(tuneActionKey(load), interior && action)
  } catch {}
}

/**
 * Whether the fit of `load` gets the revolver note: the load has no leak area above 0, so a fit puts
 * the cylinder gap loss into the burn values, and it may be fired from a revolver: the `action` of
 * the firearm it links is `revolver`, or, where no firearm states its action, the cartridge record
 * is in the CIP table of the pistol and revolver cartridges (`table`, see `cartridgeClass`).
 */
export const revolverLeakNote = (
  table: string | undefined,
  load: InteriorLoad | undefined,
  action?: Firearm['action'],
) =>
  load !== undefined &&
  (action ? action === 'revolver' : cartridgeClass(table) === 'pistol') &&
  !load.leakage?.area.some((p) => p.area > 0)

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
      return charge === undefined ? [] : [tuneString(str, charge)]
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
      return charge === undefined ? [] : [{ load: str.load, string: tuneString(str, charge) }]
    }),
  )
  const load = mapped[0]?.load
  const pick = (same: boolean) =>
    mapped.filter((m) => (m.load === load) === same).map((m) => m.string)
  return { load, strings: pick(true), left: pick(false) }
}

/**
 * The strings as the powder fit reads them: the velocities of the shots not excluded and the
 * temperature; a string without a shot is left out.
 */
export const fitStrings = (strings: readonly TuneString[]): ChronographString[] =>
  strings.flatMap(({ charge, shots, temperature }) => {
    const velocities = shots.filter((s) => !s.excluded).map((s) => s.velocity.value)
    if (velocities.length === 0) return []
    return [{ charge, velocities, ...(temperature && { propellantTemperature: temperature }) }]
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
