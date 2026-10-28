/**
 * Request schema of `POST /interior/charge-target`: the M3
 * `POST /interior` body without `model` and `ladder`, plus the target and `load.propellant.bulkDensity`.
 * `load.charge` is required as in `/interior` and ignored by the solver. `options.maxSteps` is capped
 * at `caps.chargeSteps`: the solver runs up to 152 times in one compute task.
 */
import { z } from 'zod'
import { bulkDensityBound, interiorBase, interiorExample } from './interior-schema.ts'
import { caps } from './schemas.ts'

/** Target quantities with their units: `peakPressure` Pa, `muzzleVelocity` m/s, `loadRatio` 1, `barrelTime` s, `bulletLeadTime` s. */
export const chargeTargetKinds = [
  'peakPressure',
  'muzzleVelocity',
  'loadRatio',
  'barrelTime',
  'bulletLeadTime',
] as const

/** `unit` `percentOfLimit` (peak pressure only): `value` is a percentage of the first compared limit of `cartridge`. */
const target = z
  .strictObject({
    kind: z
      .enum(chargeTargetKinds)
      .describe(
        'Quantity to reach: peakPressure (Pa), muzzleVelocity (m/s), loadRatio (charge over bulk density times chamber volume, dimensionless), barrelTime from shot start to muzzle (s) or bulletLeadTime, muzzle time less the time of 10 % of the peak breech pressure (s).',
      ),
    value: z
      .number()
      .positive()
      .max(1e12)
      .describe('Target value in the unit of kind, or a percentage with unit percentOfLimit.'),
    unit: z
      .literal('percentOfLimit')
      .optional()
      .describe(
        'Only for peakPressure: value is a percentage of the first compared CIP limit of cartridge.',
      ),
  })
  .refine((t) => t.unit === undefined || t.kind === 'peakPressure', {
    message: 'unit percentOfLimit applies to the peakPressure target only',
    path: ['unit'],
  })
  .describe('The quantity the run reaches at the solved charge and its value.')

const m3Load = interiorBase.shape.load

/**
 * Body of `POST /interior/charge-target`; `target.value` is in SI (Pa, m/s, s) or a ratio.
 * Inferred type: {@link ChargeBody}. Request type: {@link ChargeTargetRequest}.
 */
export const chargeBody = interiorBase
  .omit({ model: true, ladder: true, maximumPressure: true })
  .extend({
    load: m3Load
      .extend({
        charge: z.number().describe('Charge mass, kg. Required, the solver does not read it.'),
        propellant: m3Load.shape.propellant
          .extend({
            bulkDensity: bulkDensityBound
              .optional()
              .describe(
                'Bulk density of the propellant, kg/m3. Needed for the loadRatio target unless powder supplies it.',
              ),
          })
          .describe('Propellant: gas properties, solid and bulk density and burn law.'),
      })
      .describe('The load: chamber, barrel, bullet and propellant, SI units.'),
    target,
    powder: interiorBase.shape.cartridge.describe(
      'Powder record id. Its bulk density applies when load.propellant.bulkDensity is absent.',
    ),
  })
  .refine(
    (b) => b.target.kind !== 'loadRatio' || b.load.propellant.bulkDensity !== undefined || b.powder,
    {
      message: 'propellant.bulkDensity or powder is required for the loadRatio target',
      path: ['load', 'propellant', 'bulkDensity'],
    },
  )
  .refine((b) => (b.options?.maxSteps ?? 0) <= caps.chargeSteps, {
    message: `options.maxSteps must be at most ${caps.chargeSteps} for the charge solver`,
    path: ['options', 'maxSteps'],
  })
  .describe(
    'The charge at which one M3 interior run reaches a target value. Results are simulations, not load data.',
  )

/** A parsed `POST /interior/charge-target` body, defaults applied. */
export interface ChargeBody extends z.infer<typeof chargeBody> {}

/** A body of `POST /interior/charge-target` as a client sends it, before defaults. */
export interface ChargeTargetRequest extends z.input<typeof chargeBody> {}

/** A valid `POST /interior/charge-target` body: the charge for a muzzle velocity, no records. */
export const chargeTargetExample: ChargeTargetRequest = {
  load: interiorExample.load,
  target: { kind: 'muzzleVelocity', value: 800 },
}
