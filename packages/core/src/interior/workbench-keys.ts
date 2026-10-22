// the literal list: `InteriorValues` reads its keys
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
  'boreFriction',
  'engravingPressure',
  'engravingLength',
] as const

/** The SI field values `interiorLoad` reads, one per key of {@link interiorValueKeys}. */
export interface InteriorValues extends Record<(typeof interiorKeys)[number], number> {}

/** Field keys of the `values` of `interiorLoad`, as the workbench saves them in `siValues`. */
export const interiorValueKeys: readonly (keyof InteriorValues)[] = interiorKeys

/** Every key the workbench saves in `siValues`: `interiorValueKeys` and `firearmMass` (kg, for the free recoil). */
export const workbenchValueKeys: readonly (keyof InteriorValues | 'firearmMass')[] = [
  ...interiorKeys,
  'firearmMass',
]

/** Fields of the two-stage burn form, with their names in the solver. */
export const burnFormKeys = { formA: 'a', formM: 'm', formQ: 'q', formZ1: 'z1' } as const
