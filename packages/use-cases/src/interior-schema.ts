import {
  convectiveDefaults,
  icao,
  interiorDefaults,
  overlay,
  pressureToleranceDefaults,
} from '@open-reloading/ballistics'
import { z } from 'zod'
import type { Exact } from './exact.ts'
import { caps, recordId, steps } from './schemas.ts'

const grainShape = <T extends string>(shape: T) => z.literal(shape).describe('Grain shape.')
const dims = {
  diameter: z.number().describe('Outer grain diameter, m.'),
  perforationDiameter: z.number().describe('Diameter of one perforation, m.'),
  length: z.number().describe('Grain length, m.'),
}
const dimensionless = (text: string) => z.number().describe(`${text}, dimensionless.`)
const burnExponent = dimensionless('Pressure exponent of the burn law')
const stages = {
  a: dimensionless('Coefficient a of the first stage (1 + a z)^m'),
  m: dimensionless('Exponent m of the first stage (1 + a z)^m'),
  q: dimensionless('Exponent q of the second stage, falling as (1 - z)^q'),
  z1: dimensionless('Burnt fraction at the end of the first stage'),
}
const burn = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z
        .literal('geometric')
        .describe('Burn law: a surface regression rate r = coefficient p^exponent on the grain.'),
      coefficient: z
        .number()
        .describe('Burn-rate coefficient of r = coefficient p^exponent, m/s per Pa^exponent.'),
      exponent: burnExponent,
      grain: z
        .discriminatedUnion('shape', [
          z.strictObject({
            shape: grainShape('sphere'),
            diameter: z.number().describe('Grain diameter, m.'),
          }),
          z.strictObject({
            shape: grainShape('cylinder'),
            diameter: z.number().describe('Grain diameter, m.'),
            length: dims.length,
          }),
          z.strictObject({ shape: grainShape('tube'), ...dims }),
          z.strictObject({ shape: grainShape('sevenPerf'), ...dims }),
        ])
        .describe('Propellant grain by shape, dimensions in m.'),
    }),
    z.strictObject({
      kind: z
        .literal('vivacity')
        .describe('Burn law: dz/dt = vivacity phi(z) (p / referencePressure)^exponent.'),
      vivacity: z.number().describe('Vivacity, 1/s.'),
      exponent: burnExponent,
      referencePressure: z.number().describe('Reference pressure of the vivacity, Pa.'),
      form: z
        .discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('constant').describe('Form function phi = 1.') }),
          z.strictObject({
            kind: z
              .literal('twoStage')
              .describe('Form function (1 + a z)^m up to z1, then falling as (1 - z)^q.'),
            ...stages,
          }),
          z.strictObject({
            kind: z
              .literal('threeStage')
              .describe('Form function as twoStage up to z2, then falling as (1 - z)^r.'),
            ...stages,
            z2: dimensionless('Burnt fraction at the end of the second stage'),
            r: dimensionless('Exponent r of the third stage, falling as (1 - z)^r'),
          }),
        ])
        .describe('Form function phi(z): the burning surface over the initial one.'),
    }),
  ])
  .describe(
    'Burn law of the propellant: geometric (grain and burn rate) or vivacity (form function).',
  )

/** Interior defaults of the API: `maxTime` 0.04 s, `outputStep` as core (2e-6 s). */
const interiorApiDefaults = { maxTime: 0.04, outputStep: 2e-6 } as const
/** The options of an M3 run: the API's `maxTime`, `maxSteps`, then the request's `options`. */
export const m3Options = (
  maxSteps: number,
  options?: object,
): { maxTime: typeof interiorApiDefaults.maxTime; maxSteps: number } => ({
  maxTime: interiorApiDefaults.maxTime,
  maxSteps,
  ...options,
})
/** Output points of one interior run at most (about 5 MB of JSON). */
export const maxPoints = 20000

const within = (min: number, max: number, text: string) =>
  z.number().min(min).max(max).describe(text).optional()
const tol = pressureToleranceDefaults
const fraction = (of: string, max: number, value: number) =>
  within(0, max, `Tolerance of ${of} as a fraction of it, dimensionless. Default ${value}.`)
/** Tolerances of the pressure range; absent keys take `pressureToleranceDefaults`. */
const tolerances = z
  .strictObject({
    chargeFraction: fraction('the charge mass', 0.2, tol.chargeFraction),
    volumeFraction: fraction('the chamber volume', 0.2, tol.volumeFraction),
    massFraction: fraction('the bullet mass', 0.1, tol.massFraction),
    burnRateFraction: fraction('the burn rate', 0.5, tol.burnRateFraction),
    temperatureKelvin: within(
      0,
      30,
      `Tolerance of the propellant temperature, a difference in K. Default ${tol.temperatureKelvin}.`,
    ),
    startPressureFraction: fraction('the shot-start pressure', 1, tol.startPressureFraction),
  })
  .refine((t) => Object.values(overlay(pressureToleranceDefaults, t)).some((v) => v > 0), {
    message: 'at least one tolerance must be above 0',
  })
  .describe(
    'Input tolerances of the peak-pressure range. Absent keys take their defaults, one must be above 0.',
  )
/** Defaults of `sampling`: the draws, the seed and the time budget in ms. */
export const samplingDefaults = { samples: 300, seed: 1, budgetMs: 3000 } as const
/** Draws of the sampled band: each is one model run. */
const sampling = z
  .strictObject({
    samples: z
      .int()
      .min(10)
      .max(2000)
      .optional()
      .describe(`Number of draws, 10 to 2000. Default ${samplingDefaults.samples}.`),
    seed: z
      .int()
      .min(0)
      .max(2 ** 32 - 1)
      .optional()
      .describe(
        `Seed of the generator: the same seed gives the same band. Default ${samplingDefaults.seed}.`,
      ),
    budgetMs: z
      .int()
      .min(1)
      .max(3000)
      .optional()
      .describe(
        `Time in ms after which the run gives the corner-case range only. Default ${samplingDefaults.budgetMs}.`,
      ),
  })
  .describe(
    'The 5th, 50th and 95th percentiles of the peak pressure and the muzzle velocity over draws of the tolerances, as sampled. A single run only, not with a ladder.',
  )
/** A charge ladder from `load.charge`: `stepCount` charges `chargeStep` kg apart. */
const ladder = z
  .strictObject({
    chargeStep: z
      .number()
      .positive()
      .max(0.01)
      .describe('Charge difference between neighbouring steps, kg.'),
    stepCount: z
      .number()
      .int()
      .min(2)
      .max(caps.ladderSteps)
      .describe('Number of charges of the ladder, odd for direction around.'),
    direction: z
      .enum(['up', 'down', 'around'])
      .describe(
        'Steps up or down from load.charge, or around it with load.charge in the middle. Default up.',
      )
      .optional(),
  })
  .refine((l) => l.direction !== 'around' || l.stepCount % 2 === 1, {
    message: 'a ladder around the charge needs an odd number of steps',
    path: ['stepCount'],
  })
  .describe(
    'A charge ladder from load.charge: stepCount runs with charges chargeStep apart. A failed step carries its error; when no step has a result the answer is 422 with the reason of the first step.',
  )
/** Cartridge id for the limit check, range tolerances and a charge ladder. */
const interiorSharedFields = {
  cartridge: recordId
    .describe(
      'Cartridge record id. Adds the comparison of the peak pressure with its CIP Pmax under limits.',
    )
    .optional(),
  pressureLimit: z
    .number()
    .positive()
    .describe(
      'A pressure limit typed by the caller, Pa, in place of the CIP Pmax values of the cartridge: limits holds it as the one compared limit (method typed), and the warnings and the percentage target of the charge-target route read it. The cartridge id is then not needed for a limit.',
    )
    .optional(),
  maximumPressure: z
    .number()
    .positive()
    .describe(
      'A maximum peak pressure entered by the caller, Pa. Adds maximumCheck: where it lies against the simulated pressure range of each run.',
    )
    .optional(),
  tolerances: tolerances.optional(),
  ladder: ladder.optional(),
}

const travel = z.number().describe('Bullet travel from the seated position, m.')
/** `load` of the M3 body, SI. */
const m3Load = z
  .strictObject({
    chamber: z
      .strictObject({
        volume: z.number().describe('Chamber volume behind the seated bullet base, m3.'),
        boreArea: z.number().describe('Bore cross-section area, m2.'),
        boreDiameter: z
          .number()
          .describe(
            'Bore diameter, m. Sets the heat-loss area and the default radius of gyration.',
          ),
        throatWear: z
          .number()
          .min(0)
          .describe(
            'Throat wear, m: length a worn throat adds behind the bullet; the run adds it times the bore area to the volume. Default 0.',
          )
          .optional(),
      })
      .describe('Chamber and bore.'),
    barrel: z
      .strictObject({
        length: z.number().describe('Bullet travel from the seated position to the muzzle, m.'),
        twist: z.number().describe('Twist length, m per turn, 0 without rifling.'),
      })
      .describe('Barrel.'),
    bullet: z
      .strictObject({
        mass: z.number().describe('Bullet mass, kg.'),
        gyrationRadius: z
          .number()
          .describe(
            'Axial radius of gyration, m. Default boreDiameter / (2 sqrt 2), that of a solid cylinder.',
          )
          .optional(),
      })
      .describe('Bullet.'),
    charge: z.number().describe('Charge mass, kg.'),
    propellant: z
      .strictObject({
        specificEnergy: z
          .number()
          .describe(
            'Specific energy at constant volume, J/kg. The force constant is (gamma - 1) times it.',
          ),
        gamma: dimensionless('Ratio of specific heats of the gas'),
        density: z.number().describe('Solid density of the propellant, kg/m3.'),
        covolume: z.number().describe('Covolume of the gas, m3/kg.'),
        burn,
        temperatureSensitivity: z
          .strictObject({
            reference: z.number().describe('Reference temperature, K.'),
            cold: z
              .number()
              .describe('Burn-rate sensitivity below the reference temperature, 1/K.'),
            hot: z
              .number()
              .describe('Burn-rate sensitivity at and above the reference temperature, 1/K.'),
          })
          .describe(
            'Burn-rate factor exp(sensitivity (propellantTemperature - reference)). Without it the burn rate does not depend on propellantTemperature.',
          )
          .optional(),
      })
      .describe('Propellant: gas properties, solid density and burn law.'),
    propellantTemperature: z.number().describe('Propellant temperature, K.'),
    ignitionPressure: z.number().describe('Gas pressure when the integration starts, Pa.'),
    startPressure: z.number().describe('Mean pressure at which the bullet may start to move, Pa.'),
    resistance: z
      .strictObject({
        friction: z.number().describe('Constant friction pressure, Pa. Default 0.').optional(),
        engraving: z
          .array(
            z.strictObject({
              travel,
              pressure: z.number().describe('Engraving pressure at this travel, Pa.'),
            }),
          )
          .max(100)
          .describe('Engraving pressure over travel, interpolated linearly, 0 outside the points.')
          .optional(),
      })
      .describe('Bore resistance as pressures on the bore area. Default none.')
      .optional(),
    gradient: z
      .strictObject({
        energy: z
          .number()
          .describe(
            'Coefficient delta, dimensionless: mean pressure = base pressure + delta m_c a / A (charge mass m_c, bullet acceleration a, bore area A).',
          ),
        breech: z
          .number()
          .describe(
            'Coefficient epsilon, dimensionless: breech pressure = base pressure + epsilon m_c a / A.',
          ),
      })
      .describe(
        'Pressure-gradient coefficients. Default the Lagrange values, energy 1/3 and breech 1/2.',
      )
      .optional(),
    heat: z
      .discriminatedUnion('model', [
        z.strictObject({ model: z.literal('none').describe('Heat model: no heat loss.') }),
        z.strictObject({
          model: z
            .literal('convective')
            .describe('Heat model: convective heat loss to the bore wall.'),
          flameTemperature: z.number().describe('Flame temperature of the propellant, K.'),
          wallTemperature: z
            .number()
            .describe(`Bore wall temperature, K. Default ${convectiveDefaults.wallTemperature}.`)
            .optional(),
          viscosity: z
            .number()
            .describe(`Gas viscosity, Pa s. Default ${convectiveDefaults.viscosity}.`)
            .optional(),
          prandtl: z
            .number()
            .describe(
              `Prandtl number of the gas, dimensionless. Default ${convectiveDefaults.prandtl}.`,
            )
            .optional(),
          factor: z
            .number()
            .describe('Factor on the heat flux, dimensionless. Default 1.')
            .optional(),
        }),
      ])
      .describe('Heat loss to the bore. Default none.')
      .optional(),
    leakage: z
      .strictObject({
        area: z
          .array(
            z.strictObject({ travel, area: z.number().describe('Leak area at this travel, m2.') }),
          )
          .min(1)
          .max(100)
          .describe(
            'Leak area over travel, interpolated linearly, 0 outside the points. While the bullet is held, the area at travel 0 applies.',
          ),
        backPressure: z
          .number()
          .describe(
            `Pressure ahead of the bullet, Pa. Default the ICAO sea-level pressure, ${icao.pressure} Pa.`,
          )
          .optional(),
        discharge: z
          .number()
          .describe('Discharge coefficient on the leak area, dimensionless. Default 1.')
          .optional(),
      })
      .describe('Gas leakage past the bullet. Default none.')
      .optional(),
  })
  .describe('The load: chamber, barrel, bullet, charge and propellant, SI units.')

/** The zod type of `load.propellant.burn`: a geometric or a vivacity burn law. */
export type BurnSchema = z.ZodDiscriminatedUnion<
  [
    z.ZodObject<
      {
        kind: z.ZodLiteral<'geometric'>
        coefficient: z.ZodNumber
        exponent: z.ZodNumber
        grain: z.ZodDiscriminatedUnion<
          [
            z.ZodObject<{ shape: z.ZodLiteral<'sphere'>; diameter: z.ZodNumber }, z.core.$strict>,
            z.ZodObject<
              { shape: z.ZodLiteral<'cylinder'>; diameter: z.ZodNumber; length: z.ZodNumber },
              z.core.$strict
            >,
            z.ZodObject<
              {
                diameter: z.ZodNumber
                perforationDiameter: z.ZodNumber
                length: z.ZodNumber
                shape: z.ZodLiteral<'tube'>
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                diameter: z.ZodNumber
                perforationDiameter: z.ZodNumber
                length: z.ZodNumber
                shape: z.ZodLiteral<'sevenPerf'>
              },
              z.core.$strict
            >,
          ],
          'shape'
        >
      },
      z.core.$strict
    >,
    z.ZodObject<
      {
        kind: z.ZodLiteral<'vivacity'>
        vivacity: z.ZodNumber
        exponent: z.ZodNumber
        referencePressure: z.ZodNumber
        form: z.ZodDiscriminatedUnion<
          [
            z.ZodObject<{ kind: z.ZodLiteral<'constant'> }, z.core.$strict>,
            z.ZodObject<
              {
                a: z.ZodNumber
                m: z.ZodNumber
                q: z.ZodNumber
                z1: z.ZodNumber
                kind: z.ZodLiteral<'twoStage'>
              },
              z.core.$strict
            >,
            z.ZodObject<
              {
                a: z.ZodNumber
                m: z.ZodNumber
                q: z.ZodNumber
                z1: z.ZodNumber
                kind: z.ZodLiteral<'threeStage'>
                z2: z.ZodNumber
                r: z.ZodNumber
              },
              z.core.$strict
            >,
          ],
          'kind'
        >
      },
      z.core.$strict
    >,
  ],
  'kind'
>

/** The zod shape of `load` of the M3 body. */
export type M3LoadShape = {
  chamber: z.ZodObject<
    {
      volume: z.ZodNumber
      boreArea: z.ZodNumber
      boreDiameter: z.ZodNumber
      throatWear: z.ZodOptional<z.ZodNumber>
    },
    z.core.$strict
  >
  barrel: z.ZodObject<{ length: z.ZodNumber; twist: z.ZodNumber }, z.core.$strict>
  bullet: z.ZodObject<
    { mass: z.ZodNumber; gyrationRadius: z.ZodOptional<z.ZodNumber> },
    z.core.$strict
  >
  charge: z.ZodNumber
  propellant: z.ZodObject<
    {
      specificEnergy: z.ZodNumber
      gamma: z.ZodNumber
      density: z.ZodNumber
      covolume: z.ZodNumber
      burn: BurnSchema
      temperatureSensitivity: z.ZodOptional<
        z.ZodObject<{ reference: z.ZodNumber; cold: z.ZodNumber; hot: z.ZodNumber }, z.core.$strict>
      >
    },
    z.core.$strict
  >
  propellantTemperature: z.ZodNumber
  ignitionPressure: z.ZodNumber
  startPressure: z.ZodNumber
  resistance: z.ZodOptional<
    z.ZodObject<
      {
        friction: z.ZodOptional<z.ZodNumber>
        engraving: z.ZodOptional<
          z.ZodArray<z.ZodObject<{ travel: z.ZodNumber; pressure: z.ZodNumber }, z.core.$strict>>
        >
      },
      z.core.$strict
    >
  >
  gradient: z.ZodOptional<z.ZodObject<{ energy: z.ZodNumber; breech: z.ZodNumber }, z.core.$strict>>
  heat: z.ZodOptional<
    z.ZodDiscriminatedUnion<
      [
        z.ZodObject<{ model: z.ZodLiteral<'none'> }, z.core.$strict>,
        z.ZodObject<
          {
            model: z.ZodLiteral<'convective'>
            flameTemperature: z.ZodNumber
            wallTemperature: z.ZodOptional<z.ZodNumber>
            viscosity: z.ZodOptional<z.ZodNumber>
            prandtl: z.ZodOptional<z.ZodNumber>
            factor: z.ZodOptional<z.ZodNumber>
          },
          z.core.$strict
        >,
      ],
      'model'
    >
  >
  leakage: z.ZodOptional<
    z.ZodObject<
      {
        area: z.ZodArray<z.ZodObject<{ travel: z.ZodNumber; area: z.ZodNumber }, z.core.$strict>>
        backPressure: z.ZodOptional<z.ZodNumber>
        discharge: z.ZodOptional<z.ZodNumber>
      },
      z.core.$strict
    >
  >
}

/** The zod shape of `interiorBase`, the fields the interior and charge-target bodies share. */
export type InteriorBaseShape = {
  model: z.ZodLiteral<'m3'>
  load: z.ZodObject<M3LoadShape, z.core.$strict>
  options: z.ZodOptional<
    z.ZodObject<
      {
        relativeTolerance: z.ZodOptional<z.ZodNumber>
        absoluteTolerance: z.ZodOptional<z.ZodNumber>
        outputStep: z.ZodOptional<z.ZodNumber>
        maxSteps: z.ZodOptional<z.ZodNumber>
        maxTime: z.ZodOptional<z.ZodNumber>
      },
      z.core.$strict
    >
  >
  cartridge: z.ZodOptional<z.ZodString>
  pressureLimit: z.ZodOptional<z.ZodNumber>
  maximumPressure: z.ZodOptional<z.ZodNumber>
  tolerances: z.ZodOptional<
    z.ZodObject<
      {
        chargeFraction: z.ZodOptional<z.ZodNumber>
        volumeFraction: z.ZodOptional<z.ZodNumber>
        massFraction: z.ZodOptional<z.ZodNumber>
        burnRateFraction: z.ZodOptional<z.ZodNumber>
        temperatureKelvin: z.ZodOptional<z.ZodNumber>
        startPressureFraction: z.ZodOptional<z.ZodNumber>
      },
      z.core.$strict
    >
  >
  ladder: z.ZodOptional<
    z.ZodObject<
      {
        chargeStep: z.ZodNumber
        stepCount: z.ZodNumber
        direction: z.ZodOptional<z.ZodEnum<{ up: 'up'; down: 'down'; around: 'around' }>>
      },
      z.core.$strict
    >
  >
}

const interiorBaseParser = z
  .strictObject({
    model: z.literal('m3').describe('Interior model: m3, one gas state with a Noble-Abel gas.'),
    load: m3Load,
    options: z
      .strictObject({
        relativeTolerance: within(
          1e-12,
          1e-3,
          `Relative error tolerance of the integrator, dimensionless. Default ${interiorDefaults.relativeTolerance}.`,
        ),
        absoluteTolerance: within(
          1e-15,
          1e-3,
          `Absolute error tolerance on the scaled state, dimensionless. Default ${interiorDefaults.absoluteTolerance}.`,
        ),
        outputStep: within(
          1e-7,
          1e-4,
          `Spacing of the curve points and largest step, s. Default ${interiorApiDefaults.outputStep}.`,
        ),
        maxSteps: steps(caps.interiorSteps).describe(
          `Accepted plus rejected integrator steps after which a run is invalid. Default and maximum ${caps.interiorSteps}, ${caps.chargeSteps} on the charge-target route.`,
        ),
        maxTime: z
          .number()
          .positive()
          .max(interiorApiDefaults.maxTime)
          .describe(
            `Time from ignition after which a run is invalid, s. Default and maximum ${interiorApiDefaults.maxTime}.`,
          )
          .optional(),
      })
      .refine(
        (c) =>
          (c.maxTime ?? interiorApiDefaults.maxTime) /
            (c.outputStep ?? interiorApiDefaults.outputStep) <=
          maxPoints * (1 + 1e-9),
        { message: `maxTime / outputStep must be at most ${maxPoints}` },
      )
      .describe(`Integrator settings of each run. maxTime / outputStep is at most ${maxPoints}.`)
      .optional(),
    ...interiorSharedFields,
  })
  .describe(
    'One run of the M3 interior model, or a charge ladder, in SI units. Results are simulations, not load data.',
  )

/**
 * The fields of the M3 interior body and of the charge-target body
 * (`apps/docs/docs/models/interior-m3.md`): SI, `load.propellantTemperature` in K.
 * `interiorBody` adds the sampling field.
 */
export const interiorBase: z.ZodObject<InteriorBaseShape, z.core.$strict> =
  interiorBaseParser satisfies Exact<typeof interiorBase, typeof interiorBaseParser>

const interiorBodyParser = interiorBase
  .extend({ sampling: sampling.optional() })
  .refine((b) => !(b.ladder && b.sampling), {
    message: 'sampling applies to a single run, not to a ladder',
    path: ['sampling'],
  })
  .describe(
    'One run of the M3 interior model with an optional sampled band, or a charge ladder, in SI units. Results are simulations, not load data.',
  )

/**
 * Body of `POST /interior` for the M3 model (`apps/docs/docs/models/interior-m3.md`): SI,
 * `load.propellantTemperature` in K.
 * Inferred type: {@link InteriorBody}. Request type: {@link InteriorRequest}.
 */
export const interiorBody: z.ZodObject<
  InteriorBaseShape & {
    sampling: z.ZodOptional<
      z.ZodObject<
        {
          samples: z.ZodOptional<z.ZodInt>
          seed: z.ZodOptional<z.ZodInt>
          budgetMs: z.ZodOptional<z.ZodInt>
        },
        z.core.$strict
      >
    >
  },
  z.core.$strict
> = interiorBodyParser satisfies Exact<typeof interiorBody, typeof interiorBodyParser>

const positive = (max: number) => z.number().positive().max(max)
/** Bound of `propellant.bulkDensity`, kg/m3; also applied to the value of a powder record. */
export const bulkDensityBound: z.ZodNumber = positive(5000)

/** A parsed `POST /interior` body, defaults applied. */
export interface InteriorBody extends z.infer<typeof interiorBody> {}

/** A body of `POST /interior` as a client sends it, before defaults. */
export interface InteriorRequest extends z.input<typeof interiorBody> {}

/** A valid `POST /interior` body: a rifle-sized load with a vivacity burn law and no records. */
export const interiorExample: InteriorRequest = {
  model: 'm3',
  load: {
    chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 0.00691 },
    barrel: { length: 0.6, twist: 0 },
    bullet: { mass: 0.0095 },
    charge: 0.0028,
    propellant: {
      specificEnergy: 3.9e6,
      gamma: 1.23,
      density: 1600,
      covolume: 0.000625,
      burn: {
        kind: 'vivacity',
        vivacity: 0.56,
        exponent: 1,
        referencePressure: 98066.5,
        form: { kind: 'constant' },
      },
    },
    propellantTemperature: 294.15,
    ignitionPressure: 1e6,
    startPressure: 0,
  },
}
