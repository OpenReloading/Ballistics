import { burnFormKeys, type InteriorLoad, interiorLoad } from '@open-reloading/core'
import { msg, type Translator } from '../i18n/translate.ts'
import type { FieldSpec } from './field-spec.ts'

/**
 * M3 load fields (`apps/docs/docs/models/interior-m3.md`). The load-defining ones start empty so
 * no value reads as a load; the workbench fills the ambient and secondary ones from `workbench-defaults.ts`.
 */
export const interiorFields = [
  {
    key: 'volume',
    label: msg('Usable case volume'),
    help: msg(
      'The volume behind the seated bullet: case capacity less the bullet inside the case.',
    ),
    quantity: 'capacity',
    required: true,
    min: 0,
  },
  { key: 'boreDiameter', label: msg('Bore diameter'), quantity: 'length', required: true, min: 0 },
  {
    key: 'boreArea',
    label: msg('Bore area'),
    help: msg(
      "Optional. Empty: the cartridge record's bore area Q while the bore diameter is the record's, else the circle of the mean of the bore and groove diameters, else of the bore diameter.",
    ),
    quantity: 'area',
    min: 0,
  },
  {
    key: 'travel',
    label: msg('Bullet travel'),
    help: msg('From the seated bullet base to the muzzle.'),
    quantity: 'length',
    required: true,
    min: 0,
  },
  {
    key: 'twist',
    label: msg('Twist'),
    help: msg('Length per turn; 0 without rifling.'),
    quantity: 'twist',
    required: true,
    min: 0,
  },
  { key: 'bulletMass', label: msg('Bullet mass'), quantity: 'mass', required: true, min: 0 },
  { key: 'charge', label: msg('Charge mass'), quantity: 'charge', required: true, min: 0 },
  {
    key: 'propellantEnergy',
    label: msg('Propellant energy'),
    help: msg('At constant volume.'),
    quantity: 'specificEnergy',
    required: true,
    min: 0,
  },
  {
    key: 'gamma',
    label: msg('Ratio of specific heats'),
    quantity: 'ratio',
    required: true,
    min: 1,
  },
  {
    key: 'density',
    label: msg('Solid density'),
    help: msg('Of the propellant grains.'),
    quantity: 'density',
    required: true,
    min: 0,
  },
  { key: 'covolume', label: msg('Covolume'), quantity: 'covolume', required: true, min: 0 },
  { key: 'vivacity', label: msg('Vivacity'), quantity: 'vivacity', required: true, min: 0 },
  { key: 'exponent', label: msg('Pressure exponent'), quantity: 'ratio', required: true, min: 0 },
  {
    key: 'referencePressure',
    label: msg('Reference pressure'),
    quantity: 'pressure',
    required: true,
    min: 0,
  },
  {
    key: 'propellantTemperature',
    label: msg('Powder temperature'),
    quantity: 'temperature',
    required: true,
  },
  {
    key: 'ignitionPressure',
    label: msg('Ignition pressure'),
    quantity: 'pressure',
    required: true,
    min: 0,
  },
  {
    key: 'startPressure',
    label: msg('Start pressure'),
    quantity: 'pressure',
    required: true,
    min: 0,
  },
  {
    key: 'sebert',
    label: msg('Sébert factor'),
    help: msg(
      'Optional. Share of the charge mass moved with the bullet, usually 0.25 to 0.5. Empty: the Lagrange gradient.',
    ),
    quantity: 'ratio',
    min: 0,
    max: 1,
  },
  {
    key: 'formA',
    label: msg('Burn form a'),
    help: msg('Two-stage form; a, m, q and z1 all empty: constant form.'),
    quantity: 'ratio',
  },
  { key: 'formM', label: msg('Burn form m'), quantity: 'ratio' },
  { key: 'formQ', label: msg('Burn form q'), quantity: 'ratio', min: 0 },
  { key: 'formZ1', label: msg('Burn form z1'), quantity: 'ratio', min: 0, max: 1 },
  {
    key: 'leakArea',
    label: msg('Leak area'),
    help: msg(
      'Optional. Gas leaking past the bullet through an area that is the same over the whole travel. Empty: no leakage.',
    ),
    quantity: 'area',
    min: 0,
  },
  {
    key: 'boreFriction',
    label: msg('Bore friction'),
    help: msg(
      "Optional. Friction pressure along the bore. Empty: the powder record's value, else none.",
    ),
    quantity: 'pressure',
    min: 0,
  },
  {
    key: 'engravingPressure',
    label: msg('Engraving pressure'),
    help: msg(
      "Optional. Pressure at the start of the engraving ramp, which falls linearly to 0 over the engraving length. Empty: the powder record's ramp, else none.",
    ),
    quantity: 'pressure',
    min: 0,
  },
  {
    key: 'engravingLength',
    label: msg('Engraving length'),
    help: msg(
      "Optional. Travel over which the engraving ramp falls to 0. Empty: the powder record's ramp, else none.",
    ),
    quantity: 'length',
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

/**
 * The Bullet card's values a record gives and the user may type over it (`typedBullet` in `bullet.ts`).
 * Not interior inputs, so not in `interiorFields`: the diameter reaches the interior run only as the
 * default bore diameter, the length only through the bore resistance of a fitted powder, the base
 * dimensions only the drawing and the seating.
 */
export const bulletFields = [
  {
    key: 'bulletDiameter',
    label: msg('Diameter'),
    help: msg(
      'Used by the trajectory, the stability estimate and the groups. The interior run takes the bore diameter of the Cartridge card.',
    ),
    quantity: 'length',
    min: 0,
    positive: true,
  },
  {
    key: 'bulletLength',
    label: msg('Length'),
    help: msg(
      'Used by the stability estimate and by the bore resistance of a fitted powder, not by the cartridge drawing. Empty: the length of the record.',
    ),
    quantity: 'length',
    min: 0,
    positive: true,
  },
  {
    key: 'bulletBcG7',
    label: msg('BC G7'),
    help: msg('A typed value replaces every velocity band of the record. Empty: the record.'),
    quantity: 'ballisticCoefficient',
    min: 0,
    positive: true,
  },
  {
    key: 'bulletBcG1',
    label: msg('BC G1'),
    help: msg('A typed value replaces every velocity band of the record. Empty: the record.'),
    quantity: 'ballisticCoefficient',
    min: 0,
    positive: true,
  },
  {
    key: 'bulletBaseLength',
    label: msg('Boat-tail length'),
    quantity: 'length',
    min: 0,
    positive: true,
  },
  {
    key: 'bulletBaseDiameter',
    label: msg('Base diameter'),
    help: msg('Diameter of the base face at the end of the boat tail.'),
    quantity: 'length',
    min: 0,
    positive: true,
  },
  {
    key: 'bulletCavityDiameter',
    label: msg('Cavity diameter'),
    help: msg('Opening of the hollow base. Its depth follows from it.'),
    quantity: 'length',
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

/**
 * The cartridge sheet's and the powder record's values the user may type over them
 * (`record-specs.ts`). Not interior inputs: the Pmax is the limit the readouts, the chart and the
 * charge target compare with, the case length L3 the seating reads, the bulk density the load ratio.
 */
export const specFields = [
  {
    key: 'pmax',
    label: msg('Pmax'),
    help: msg('A typed value is your limit, not a CIP value. Empty: the CIP sheet.'),
    quantity: 'pressure',
    min: 0,
    positive: true,
  },
  {
    key: 'caseLength',
    label: msg('Case length L3'),
    help: msg('Used by the seating and the cartridge figure. Empty: the CIP sheet.'),
    quantity: 'length',
    min: 0,
    positive: true,
  },
  {
    key: 'bulkDensity',
    label: msg('Bulk density'),
    help: msg('Used by the load ratio and the case fill. Empty: the powder record.'),
    quantity: 'density',
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

/** A partly filled burn form's error on the empty field `key`; undefined otherwise. */
export function burnFormError(
  values: Record<string, number | undefined>,
  key: string,
  t: Translator['t'],
) {
  if (!(key in burnFormKeys) || values[key] !== undefined) return
  return Object.keys(burnFormKeys).some((k) => values[k] !== undefined)
    ? t('Needed with the other burn form values, or leave all four empty.')
    : undefined
}

export type InteriorKey = (typeof interiorFields)[number]['key']

export type InteriorBody = {
  model: 'm3'
  load: InteriorLoad
  cartridge?: string | undefined
  /** A pressure limit the user typed, Pa: the one limit instead of the cartridge's CIP Pmax. */
  pressureLimit?: number | undefined
}

/**
 * `POST /interior` body from SI field values; the mapping is `interiorLoad` of core, shared with
 * `POST /interior/load-file`. `grooveDiameter` (m) is the fallback of an empty bore area.
 */
export function interiorBody(
  values: Record<string, number | undefined>,
  cartridge?: string | undefined,
  grooveDiameter?: number | undefined,
  pressureLimit?: number | undefined,
): InteriorBody {
  const label = (key: string) => interiorFields.find((s) => s.key === key)?.label ?? key
  return {
    model: 'm3',
    load: interiorLoad(values, label, grooveDiameter),
    ...(cartridge && { cartridge }),
    ...(pressureLimit !== undefined && { pressureLimit }),
  }
}
