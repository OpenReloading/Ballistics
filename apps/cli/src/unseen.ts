import type { Powder } from '@rangefoundry/schema'
import { percentile } from './stats.ts'

/** The powder family: propellant base and grain form of the record, `unspecified` where it has none. */
export const familyOf = (
  powder: { propellantBase?: string | undefined; grainForm?: string | undefined } | undefined,
) =>
  powder
    ? `${powder.propellantBase ?? 'unspecified'}/${powder.grainForm ?? 'unspecified'}`
    : 'unknown'

type Interior = NonNullable<Powder['interior']>

const median = (values: number[]) => percentile(values, 0.5) as number

/** Each field its fit moved (`interior.fitted`) becomes the median of that field over `others` of its family, else over all `others`, its fixed inputs staying its own; undefined without `interior` or without another powder that has one. */
export function unseenPowder(powder: Powder, others: readonly Powder[]): Powder | undefined {
  const own = powder.interior
  const fitted = others.flatMap((p) => (p.interior && p.id !== powder.id ? [p] : []))
  if (!own || fitted.length === 0) return undefined
  const family = fitted.filter((p) => familyOf(p) === familyOf(powder))
  // every powder of `fitted` has interior parameters
  const set = (family.length > 0 ? family : fitted).map((p) => p.interior as Interior)
  const moved = new Set(own.fitted)
  return {
    ...powder,
    interior: {
      ...own,
      ...(moved.has('vivacity') && {
        vivacity: { value: median(set.map((i) => i.vivacity.value)) },
      }),
      ...(moved.has('energy') && { energy: { value: median(set.map((i) => i.energy.value)) } }),
      ...(moved.has('form.a') && {
        burnForm: { ...own.burnForm, a: { value: median(set.map((i) => i.burnForm.a.value)) } },
      }),
    },
  }
}
