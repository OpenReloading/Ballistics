import type { UserRecord } from '@open-reloading/schema'
import { parseNumber } from '../i18n/number.ts'
import { sessionRef } from './measurements.ts'
import { parseVelocities, sessionStrings, type TuneString } from './powder-tune.ts'

// The parts of the tuning screen the workbench does not use, out of `powder-tune.ts`, which its
// Measurements tab loads

/**
 * The powders (references) of the saved loads of `records` that have strings mapped to a charge,
 * each once: the choices of the tuning route opened without a powder.
 */
export function powdersWithStrings(records: readonly UserRecord[]) {
  const sessions = new Map(
    records.flatMap((r) => (r.kind === 'session' ? [[sessionRef(r.id), r] as const] : [])),
  )
  const powders = records.flatMap((r) => {
    // a powder typed by name, no record, has no reference to choose
    if (r.kind !== 'load' || typeof r.data.powder !== 'string') return []
    const own = (r.data.sessions ?? []).flatMap((ref) => sessions.get(ref) ?? [])
    return sessionStrings(own).length > 0 ? [r.data.powder] : []
  })
  return [...new Set(powders)]
}

/**
 * The velocity residual of each of `strings`, in their order, from `residuals` of a fit of
 * `fitStrings(strings)`: undefined for a string the fit left out (no shot), and for every string
 * while the residuals belong to other strings (a fit of strings since changed).
 */
export function stringResiduals<R extends { kind: string; charge: number }>(
  strings: readonly TuneString[],
  residuals: readonly R[] | undefined,
): (R | undefined)[] {
  const velocity = (residuals ?? []).filter((r) => r.kind === 'velocity')
  const fitted = strings.map((s) => s.shots.some((x) => !x.excluded))
  const none = strings.map(() => undefined)
  if (velocity.length !== fitted.filter(Boolean).length) return none
  const out: (R | undefined)[] = []
  let k = 0
  for (const [i, s] of strings.entries()) {
    if (!fitted[i]) {
      out.push(undefined)
      continue
    }
    const r = velocity[k++]
    if (!r || Math.abs(r.charge - s.charge) >= 1e-9) return none
    out.push(r)
  }
  return out
}

/** The fields of the form that adds a string, as typed. */
export type StringForm = { charge: string; shots: string; temperature: string }

/** The fields of `StringForm` that do not read: the charge, the velocities, the temperature. */
export type StringFormErrors = Partial<Record<keyof StringForm, true>>

/**
 * The string typed in `form`, in SI by the converters of the charge, velocity and temperature
 * units, or the fields that do not read: a charge and one or more velocities, each above 0, and a
 * temperature or none.
 */
export function readStringForm(
  form: StringForm,
  units: {
    charge: (x: number) => number
    velocity: (x: number) => number
    temperature: (x: number) => number
  },
): { string: TuneString } | { errors: StringFormErrors } {
  const charge = parseNumber(form.charge, { min: 0 })
  const shots = parseVelocities(form.shots, units.velocity)
  const temperature = parseNumber(form.temperature)
  const errors: StringFormErrors = {
    ...(!(charge.kind === 'number' && charge.value > 0) && { charge: true }),
    ...(!shots && { shots: true }),
    ...(temperature.kind !== 'number' && temperature.kind !== 'empty' && { temperature: true }),
  }
  if (charge.kind !== 'number' || !shots || Object.keys(errors).length > 0) return { errors }
  return {
    string: {
      charge: units.charge(charge.value),
      shots: shots.map((value) => ({ velocity: { value } })),
      ...(temperature.kind === 'number' && { temperature: units.temperature(temperature.value) }),
    },
  }
}
