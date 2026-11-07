import type { Complete } from '../key-list.ts'
import { defaultStartPressure, handgunBarrelLengthLimit } from './start-pressure.ts'

/** A field key of the `values` of `interiorLoad`. */
export type InteriorValueKey =
  | 'volume'
  | 'boreDiameter'
  | 'boreArea'
  | 'travel'
  | 'twist'
  | 'bulletMass'
  | 'charge'
  | 'propellantEnergy'
  | 'gamma'
  | 'density'
  | 'covolume'
  | 'vivacity'
  | 'exponent'
  | 'referencePressure'
  | 'propellantTemperature'
  | 'ignitionPressure'
  | 'startPressure'
  | 'sebert'
  | 'formA'
  | 'formM'
  | 'formQ'
  | 'formZ1'
  | 'leakArea'
  | 'throatWear'
  | 'boreFriction'
  | 'engravingPressure'
  | 'engravingLength'

// in field order; the type checks below fail on a key missing from the list or not in the type
const interiorKeys = [
  'volume',
  'boreDiameter',
  'boreArea',
  'travel',
  'twist',
  'bulletMass',
  'charge',
  'propellantEnergy',
  'gamma',
  'density',
  'covolume',
  'vivacity',
  'exponent',
  'referencePressure',
  'propellantTemperature',
  'ignitionPressure',
  'startPressure',
  'sebert',
  'formA',
  'formM',
  'formQ',
  'formZ1',
  'leakArea',
  'throatWear',
  'boreFriction',
  'engravingPressure',
  'engravingLength',
] as const satisfies readonly InteriorValueKey[]

/** The SI field values `interiorLoad` reads, one per key of {@link interiorValueKeys}. */
export interface InteriorValues extends Record<InteriorValueKey, number> {}

/** Field keys of the `values` of `interiorLoad`, the workbench fields a load keeps (`charge` and `analysis.overrides`). */
export const interiorValueKeys: readonly InteriorValueKey[] = interiorKeys satisfies Complete<
  InteriorValueKey,
  typeof interiorKeys
>

/** Keys of a load the interior solver does not take: the gun weight (kg, free recoil) and the typed bullet values (m, lb/in2 in SI, the base dimensions in m) and the values of the records the solver does not read as such: the typed Pmax (Pa), the case length L3 (m) and the powder's bulk density (kg/m3) the exterior tabs and the bore resistance read. */
const otherKeys = [
  'firearmMass',
  'bulletDiameter',
  'bulletLength',
  'bulletBcG1',
  'bulletBcG7',
  'bulletBaseLength',
  'bulletBaseDiameter',
  'bulletCavityDiameter',
  'bulletCavityDepth',
  'pmax',
  'caseLength',
  'bulkDensity',
] as const satisfies readonly Exclude<WorkbenchValueKey, InteriorValueKey>[]

/** A key a load keeps: an {@link InteriorValueKey} or a key the interior solver does not take. */
export type WorkbenchValueKey =
  | InteriorValueKey
  | 'firearmMass'
  | 'bulletDiameter'
  | 'bulletLength'
  | 'bulletBcG1'
  | 'bulletBcG7'
  | 'bulletBaseLength'
  | 'bulletBaseDiameter'
  | 'bulletCavityDiameter'
  | 'bulletCavityDepth'
  | 'pmax'
  | 'caseLength'
  | 'bulkDensity'

/** Every key a load keeps: `interiorValueKeys` and the keys the interior solver does not take. */
export const workbenchValueKeys: readonly WorkbenchValueKey[] = [
  ...interiorKeys,
  ...(otherKeys satisfies Complete<Exclude<WorkbenchValueKey, InteriorValueKey>, typeof otherKeys>),
]

/** Fields of the two-stage burn form, with their names in the solver. */
export const burnFormKeys = { formA: 'a', formM: 'm', formQ: 'q', formZ1: 'z1' } as const

/** The keys of `values` the workbench never saves (none for a valid set). */
export const unknownValueKeys = (values: Record<string, unknown>): string[] =>
  Object.keys(values).filter((k) => !(workbenchValueKeys as readonly string[]).includes(k))

/** The M3 parameters of a powder record in stored units, as far as {@link powderModelValues} reads them. */
export interface PowderInteriorRecord {
  interior?:
    | {
        energy: { value: number }
        gamma: number
        /** g/cm3. */
        density: { value: number }
        covolume: { value: number }
        vivacity: { value: number }
        pressureExponent: number
        /** bar. */
        referencePressure: { value: number }
        /** bar. */
        ignitionPressure: { value: number }
        /** bar. */
        startPressure?: { value: number } | undefined
        burnForm: { a: { value: number }; m: number; q: number; z1: number }
      }
    | undefined
}

/**
 * The SI workbench field values a powder record's model parameters fill, by field key; undefined for
 * a record without them. A record without a start pressure gets the fit's rule for barrels from 300 mm.
 */
export function powderModelValues(p: PowderInteriorRecord): Record<string, number> | undefined {
  const i = p.interior
  if (!i) return undefined
  return {
    propellantEnergy: i.energy.value,
    gamma: i.gamma,
    density: i.density.value * 1e3,
    covolume: i.covolume.value,
    vivacity: i.vivacity.value,
    exponent: i.pressureExponent,
    referencePressure: i.referencePressure.value * 1e5,
    ignitionPressure: i.ignitionPressure.value * 1e5,
    startPressure: i.startPressure
      ? i.startPressure.value * 1e5
      : defaultStartPressure(handgunBarrelLengthLimit).value,
    formA: i.burnForm.a.value,
    formM: i.burnForm.m,
    formQ: i.burnForm.q,
    formZ1: i.burnForm.z1,
  }
}
