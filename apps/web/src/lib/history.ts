import { type FieldSpec, type Fields, type FieldValue, switchFields } from './field-spec.ts'
import { roundedFieldText, type UnitSystem } from './units.ts'

/** Undo history; `last` is the field of the last edit, whose next edit replaces the present. */
export interface History<D> {
  past: D[]
  present: D
  future: D[]
  last?: string
}

export const historyOf = <D>(present: D): History<D> => ({ past: [], present, future: [] })

/** History limit: older steps are dropped. */
const depth = 100

/** Adds `present` as an undo step, clears redo and records `last` as the field edited. */
export const pushHistory = <D>(h: History<D>, present: D, last?: string): History<D> => ({
  past: [...h.past, h.present].slice(-depth),
  present,
  future: [],
  last,
})

/** An edit of field `key`: a run of edits to one field is one step. */
export const editHistory = <D>(h: History<D>, present: D, key: string): History<D> =>
  h.last === key ? { ...h, present, future: [] } : pushHistory(h, present, key)

export function undo<D>(h: History<D>): History<D> {
  const prev = h.past.at(-1)
  return prev ? { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] } : h
}

export function redo<D>(h: History<D>): History<D> {
  const [next, ...future] = h.future
  return next ? { past: [...h.past, h.present], present: next, future } : h
}

/** Every step rewritten, as on a unit switch. */
export const mapHistory = <D>(h: History<D>, f: (d: D) => D): History<D> => ({
  ...h,
  past: h.past.map(f),
  present: f(h.present),
  future: h.future.map(f),
})

/** The actions both designers reduce alike. */
export type DesignAction<D> =
  | { type: 'field'; key: string; value: FieldValue }
  | { type: 'start'; design: D }
  | { type: 'reset'; system: UnitSystem }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

/** The designer actions of `DesignAction`; `fromOrigin` is the design of the record it started from. */
export function designReduce<D extends { fields: Fields; origin?: O; parent?: unknown }, O>(
  h: History<D>,
  a: DesignAction<D>,
  specs: readonly FieldSpec[],
  fromOrigin: (origin: O, system: UnitSystem) => D,
): History<D> {
  switch (a.type) {
    case 'field':
      return editHistory(
        h,
        { ...h.present, fields: { ...h.present.fields, [a.key]: a.value } },
        a.key,
      )
    case 'start':
      // a new record: undo never crosses into the record before
      return historyOf(a.design)
    case 'reset':
      return h.present.origin
        ? pushHistory(h, { ...fromOrigin(h.present.origin, a.system), parent: h.present.parent })
        : h
    case 'undo':
      return undo(h)
    case 'redo':
      return redo(h)
    case 'units':
      return mapHistory(h, (d) => ({
        ...d,
        fields: switchFields(d.fields, specs, a.system, roundedFieldText),
      }))
  }
}
