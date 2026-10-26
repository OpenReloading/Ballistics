import { burnFormKeys, type InteriorLoad, interiorLoad } from '@open-reloading/core'
import type { FieldSpec } from './field-spec.ts'

/**
 * M3 load fields (`apps/docs/docs/models/interior-m3.md`). The load-defining ones start empty so
 * no value reads as a load; the workbench fills the ambient and secondary ones from `workbench-defaults.ts`.
 */
export const interiorFields = [
  {
    key: 'volume',
    label: 'Usable case volume',
    help: 'The volume behind the seated bullet: case capacity less the bullet inside the case.',
    quantity: 'capacity',
    required: true,
    min: 0,
  },
  { key: 'boreDiameter', label: 'Bore diameter', quantity: 'length', required: true, min: 0 },
  {
    key: 'boreArea',
    label: 'Bore area',
    help: "Optional. Empty: the cartridge record's bore area Q, else the circle of the mean of the bore and groove diameters, else of the bore diameter.",
    quantity: 'area',
    min: 0,
  },
  {
    key: 'travel',
    label: 'Bullet travel',
    help: 'From the seated bullet base to the muzzle.',
    quantity: 'length',
    required: true,
    min: 0,
  },
  {
    key: 'twist',
    label: 'Twist',
    help: 'Length per turn; 0 without rifling.',
    quantity: 'twist',
    required: true,
    min: 0,
  },
  { key: 'bulletMass', label: 'Bullet mass', quantity: 'mass', required: true, min: 0 },
  { key: 'charge', label: 'Charge mass', quantity: 'charge', required: true, min: 0 },
  {
    key: 'propellantEnergy',
    label: 'Propellant energy',
    help: 'At constant volume.',
    quantity: 'specificEnergy',
    required: true,
    min: 0,
  },
  { key: 'gamma', label: 'Ratio of specific heats', quantity: 'ratio', required: true, min: 1 },
  {
    key: 'density',
    label: 'Solid density',
    help: 'Of the propellant grains.',
    quantity: 'density',
    required: true,
    min: 0,
  },
  { key: 'covolume', label: 'Covolume', quantity: 'covolume', required: true, min: 0 },
  { key: 'vivacity', label: 'Vivacity', quantity: 'vivacity', required: true, min: 0 },
  { key: 'exponent', label: 'Pressure exponent', quantity: 'ratio', required: true, min: 0 },
  {
    key: 'referencePressure',
    label: 'Reference pressure',
    quantity: 'pressure',
    required: true,
    min: 0,
  },
  {
    key: 'propellantTemperature',
    label: 'Powder temperature',
    quantity: 'temperature',
    required: true,
  },
  {
    key: 'ignitionPressure',
    label: 'Ignition pressure',
    quantity: 'pressure',
    required: true,
    min: 0,
  },
  { key: 'startPressure', label: 'Start pressure', quantity: 'pressure', required: true, min: 0 },
  {
    key: 'sebert',
    label: 'Sébert factor',
    help: 'Optional. Share of the charge mass moved with the bullet, usually 0.25 to 0.5. Empty: the Lagrange gradient.',
    quantity: 'ratio',
    min: 0,
    max: 1,
  },
  {
    key: 'formA',
    label: 'Burn form a',
    help: 'Two-stage form; a, m, q and z1 all empty: constant form.',
    quantity: 'ratio',
  },
  { key: 'formM', label: 'Burn form m', quantity: 'ratio' },
  { key: 'formQ', label: 'Burn form q', quantity: 'ratio', min: 0 },
  { key: 'formZ1', label: 'Burn form z1', quantity: 'ratio', min: 0, max: 1 },
  {
    key: 'leakArea',
    label: 'Leak area',
    help: 'Optional. Gas leaking past the bullet through an area that is the same over the whole travel. Empty: no leakage.',
    quantity: 'area',
    min: 0,
  },
  {
    key: 'boreFriction',
    label: 'Bore friction',
    help: "Optional. Friction pressure along the bore. Empty: the powder record's value, else none.",
    quantity: 'pressure',
    min: 0,
  },
  {
    key: 'engravingPressure',
    label: 'Engraving pressure',
    help: "Optional. Pressure at the start of the engraving ramp, which falls linearly to 0 over the engraving length. Empty: the powder record's ramp, else none.",
    quantity: 'pressure',
    min: 0,
  },
  {
    key: 'engravingLength',
    label: 'Engraving length',
    help: "Optional. Travel over which the engraving ramp falls to 0. Empty: the powder record's ramp, else none.",
    quantity: 'length',
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

/** A partly filled burn form's error on the empty field `key`; undefined otherwise. */
export function burnFormError(values: Record<string, number | undefined>, key: string) {
  if (!(key in burnFormKeys) || values[key] !== undefined) return
  return Object.keys(burnFormKeys).some((k) => values[k] !== undefined)
    ? 'Needed with the other burn form values, or leave all four empty.'
    : undefined
}

export type InteriorKey = (typeof interiorFields)[number]['key']

export type InteriorBody = { model: 'm3'; load: InteriorLoad; cartridge?: string | undefined }

/**
 * `POST /interior` body from SI field values; the mapping is `interiorLoad` of core, shared with
 * `POST /interior/load-file`. `grooveDiameter` (m) is the fallback of an empty bore area.
 */
export function interiorBody(
  values: Record<string, number | undefined>,
  cartridge?: string,
  grooveDiameter?: number,
): InteriorBody {
  const label = (key: string) => interiorFields.find((s) => s.key === key)?.label ?? key
  return {
    model: 'm3',
    load: interiorLoad(values, label, grooveDiameter),
    ...(cartridge && { cartridge }),
  }
}
