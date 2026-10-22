import { type FieldSpec, type Fields, initialFields } from './field-spec.ts'
import type { UnitSystem } from './units.ts'

/** Form fields holding `values` (SI) in `system`; specs without a value stay empty. */
export function exampleFields(
  specs: readonly FieldSpec[],
  values: Partial<Record<string, number>>,
  system: UnitSystem,
  text?: Parameters<typeof initialFields>[2],
): Fields {
  return initialFields(
    specs.map((s) => ({ ...s, initial: values[s.key] })),
    system,
    text,
  )
}

/** Start-card picks: common cartridges with their CIP G1, F and Z, mm (checked against the records by `test/examples.test.ts`). */
export const quickCartridges = [
  { id: '308-win', name: '308 Win.', g1: 7.85, land: 7.62, groove: 7.82 },
  { id: '6-5-creedmoor', name: '6,5 Creedmoor', g1: 6.72, land: 6.5, groove: 6.71 },
  { id: '223-rem', name: '223 Rem.', g1: 5.7, land: 5.56, groove: 5.69 },
  { id: '30-06-spring', name: '30-06 Spring.', g1: 7.85, land: 7.62, groove: 7.82 },
  { id: '300-win-mag', name: '300 Win. Mag.', g1: 7.85, land: 7.62, groove: 7.82 },
  { id: '6-5-x-55-se', name: '6,5 x 55 SE', g1: 6.71, land: 6.5, groove: 6.73 },
  { id: '243-win', name: '243 Win.', g1: 6.17, land: 6.02, groove: 6.17 },
  { id: '338-lapua-mag', name: '338 Lapua Mag.', g1: 8.61, land: 8.38, groove: 8.58 },
] as const
