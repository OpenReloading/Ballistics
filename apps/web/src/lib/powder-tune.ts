import type { SessionRecord } from '@open-reloading/schema'
import { parseNumber } from '../i18n/number.ts'
import type { Shot } from './chrono.ts'
import { stringCharge } from './measurements.ts'

/** A string on the tuning screen: charge, kg, and its shots. */
export type TuneString = { charge: number; shots: Pick<Shot, 'velocity' | 'excluded'>[] }

/** The tuning route with the strings of the stored sessions `ids` preloaded. */
export const tuneHref = (ids: readonly string[]) =>
  `/powders/tune${ids.length > 0 ? `?${new URLSearchParams(ids.map((id) => ['session', id]))}` : ''}`

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
