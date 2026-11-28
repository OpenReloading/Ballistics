import type { Powder } from '@rangefoundry/schema'
import { percentile } from '@rangefoundry/statistics'

/** The powder family: propellant base and grain form of the record, `unspecified` where it has none. */
export const familyOf = (
  powder: { propellantBase?: string | undefined; grainForm?: string | undefined } | undefined,
) =>
  powder
    ? `${powder.propellantBase ?? 'unspecified'}/${powder.grainForm ?? 'unspecified'}`
    : 'unknown'

/** The median of `values`, at least one. */
const median = (values: readonly number[]) =>
  percentile(
    values.toSorted((a, b) => a - b),
    0.5,
  )

/** Each field its fit moved (`interior.fitted`) becomes the median of that field over `others` of its family, else over all `others`, its fixed inputs staying its own; undefined without `interior` or without another powder that has one. */
export function unseenPowder(powder: Powder, others: readonly Powder[]): Powder | undefined {
  const own = powder.interior
  const fitted = others.flatMap((p) =>
    p.interior && p.id !== powder.id ? [{ powder: p, interior: p.interior }] : [],
  )
  if (!own || fitted.length === 0) return undefined
  const family = fitted.filter((f) => familyOf(f.powder) === familyOf(powder))
  const set = (family.length > 0 ? family : fitted).map((f) => f.interior)
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
