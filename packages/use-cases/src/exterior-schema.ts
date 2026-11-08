import { type DragModel, dragModels } from '@open-reloading/ballistics'
import { z } from 'zod'
import type { Exact } from './exact.ts'
import { caps, fitIterations, recordId, steps } from './schemas.ts'
import { stabilityBounds } from './stability-schema.ts'

/** An angle in rad strictly between -pi/2 and pi/2: a value in degrees falls outside. */
const angle = () =>
  z
    .number()
    .gt(-Math.PI / 2)
    .lt(Math.PI / 2)

/** Mach (or other abscissa) and value nodes. */
const nodeTable = (max: number) =>
  z
    .array(z.tuple([z.number(), z.number()]))
    .min(2)
    .max(max)
const coefficient = z.union([z.number(), nodeTable(400)])

const air = z.strictObject({
  altitude: z.number().describe('Altitude above mean sea level, m.'),
  pressure: z.number().describe('Absolute station pressure, Pa, not reduced to sea level.'),
  temperature: z.number().describe('Air temperature, K.'),
  humidity: z.number().describe('Relative humidity as a ratio from 0 to 1.'),
})

const interpolation = z.enum(['linear', 'monotone-cubic'])
const interpolationText = 'How the drag table or curve is read between nodes, default linear.'

const drag = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('bc').describe('A ballistic coefficient against a standard drag model.'),
      model: z.enum(dragModels).describe('Standard drag model of the ballistic coefficient.'),
      bands: z
        .array(
          z.strictObject({
            ballisticCoefficient: z.number().describe('Ballistic coefficient, kg/m2.'),
            minVelocity: z.number().describe('Lowest airspeed of the band, m/s.'),
          }),
        )
        .min(1)
        .max(10)
        .describe(
          'Velocity bands of the ballistic coefficient. A single coefficient is one band with minVelocity 0.',
        ),
      reference: z
        .enum(['icao', 'metro'])
        .optional()
        .describe(
          'Reference atmosphere the published coefficient states. Stored only, it does not scale the drag.',
        ),
      interpolation: interpolation.optional().describe(interpolationText),
    }),
    z.strictObject({
      kind: z.literal('curve').describe("The projectile's own drag coefficient curve."),
      curve: nodeTable(400).describe(
        'Pairs of Mach number and drag coefficient on the area pi d^2 / 4, both dimensionless.',
      ),
      interpolation: interpolation.optional().describe(interpolationText),
    }),
  ])
  .describe('Drag input: ballistic coefficient bands or a drag coefficient curve.')

const overMach = 'A constant, or pairs of Mach number and value interpolated linearly.'
const aerodynamics = z
  .strictObject({
    liftSlope: coefficient.describe(`Lift-force slope, 1/rad. ${overMach}`),
    momentSlope: coefficient
      .optional()
      .describe(
        `Overturning-moment slope, 1/rad, positive, estimated from the stability factor when absent. ${overMach}`,
      ),
    magnusForceSlope: coefficient
      .optional()
      .describe(`Magnus-force slope, 1/rad, default 0. ${overMach}`),
    spinDamping: coefficient
      .optional()
      .describe(
        `Spin-damping coefficient, dimensionless and negative, constant spin when absent. ${overMach}`,
      ),
    axialInertia: z
      .number()
      .optional()
      .describe('Axial moment of inertia, kg m2, estimated as a uniform cylinder when absent.'),
    transverseInertia: z
      .number()
      .optional()
      .describe(
        'Transverse moment of inertia about the centre of mass, kg m2, estimated when absent.',
      ),
  })
  .describe('Aerodynamic coefficients of the modified point mass, ignored by the point mass model.')

const projectile = z.strictObject({
  mass: z
    .number()
    .max(stabilityBounds.mass[1])
    .describe(`Projectile mass, kg, at most ${stabilityBounds.mass[1]}.`),
  diameter: z
    .number()
    .max(stabilityBounds.diameter[1])
    .describe(`Reference diameter, m, at most ${stabilityBounds.diameter[1]}.`),
  length: z
    .number()
    .optional()
    .describe('Projectile length, m. Stability, spin drift and jump need it.'),
  drag,
  aerodynamics: aerodynamics.optional(),
})

/** A bullet record id; resolved to a `Projectile` with the BCs of `dragModel`. */
const bulletRef = z.strictObject({
  bullet: recordId.describe('Id of the bullet record that supplies mass, diameter and length.'),
  dragModel: z
    .enum(['G1', 'G7'])
    .describe('Drag model whose ballistic coefficients of the record become the drag bands.'),
  length: z.number().optional().describe("Projectile length, m, default the record's length."),
  aerodynamics: aerodynamics.optional(),
})

const wind = z
  .array(
    z.strictObject({
      endDistance: z
        .number()
        .describe(
          'Horizontal distance where the segment ends, m. The last segment extends to infinity.',
        ),
      speed: z.number().describe('Horizontal wind speed, m/s.'),
      fromDirection: z
        .number()
        .describe(
          'Direction the wind blows from, rad clockwise from the line of fire: 0 headwind, pi/2 from the right.',
        ),
      vertical: z
        .number()
        .optional()
        .describe('Vertical wind component, m/s, positive up, default 0.'),
    }),
  )
  .max(20)

/** The zod type of a constant, or pairs of Mach number and value. */
export type CoefficientSchema = z.ZodUnion<
  readonly [z.ZodNumber, z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>]
>

/** The zod type of the station air of a shot or a zero. */
export type AirSchema = z.ZodObject<
  { altitude: z.ZodNumber; pressure: z.ZodNumber; temperature: z.ZodNumber; humidity: z.ZodNumber },
  z.core.$strict
>
/** The zod type of the wind segments of a shot or a zero. */
export type WindSchema = z.ZodArray<
  z.ZodObject<
    {
      endDistance: z.ZodNumber
      speed: z.ZodNumber
      fromDirection: z.ZodNumber
      vertical: z.ZodOptional<z.ZodNumber>
    },
    z.core.$strict
  >
>
/** The zod type of the aerodynamic coefficients of the modified point mass. */
export type AerodynamicsSchema = z.ZodObject<
  {
    liftSlope: CoefficientSchema
    momentSlope: z.ZodOptional<CoefficientSchema>
    magnusForceSlope: z.ZodOptional<CoefficientSchema>
    spinDamping: z.ZodOptional<CoefficientSchema>
    axialInertia: z.ZodOptional<z.ZodNumber>
    transverseInertia: z.ZodOptional<z.ZodNumber>
  },
  z.core.$strict
>
/** The zod type of how a drag table or curve is read between nodes. */
export type InterpolationSchema = z.ZodOptional<
  z.ZodEnum<{ linear: 'linear'; 'monotone-cubic': 'monotone-cubic' }>
>

/** The zod shape of `shot`, the muzzle state of one trajectory. */
export type ShotShape = {
  projectile: z.ZodUnion<
    readonly [
      z.ZodObject<
        {
          mass: z.ZodNumber
          diameter: z.ZodNumber
          length: z.ZodOptional<z.ZodNumber>
          drag: z.ZodDiscriminatedUnion<
            [
              z.ZodObject<
                {
                  kind: z.ZodLiteral<'bc'>
                  model: z.ZodEnum<{ [K in DragModel]: K }>
                  bands: z.ZodArray<
                    z.ZodObject<
                      { ballisticCoefficient: z.ZodNumber; minVelocity: z.ZodNumber },
                      z.core.$strict
                    >
                  >
                  reference: z.ZodOptional<z.ZodEnum<{ icao: 'icao'; metro: 'metro' }>>
                  interpolation: InterpolationSchema
                },
                z.core.$strict
              >,
              z.ZodObject<
                {
                  kind: z.ZodLiteral<'curve'>
                  curve: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>
                  interpolation: InterpolationSchema
                },
                z.core.$strict
              >,
            ],
            'kind'
          >
          aerodynamics: z.ZodOptional<AerodynamicsSchema>
        },
        z.core.$strict
      >,
      z.ZodObject<
        {
          bullet: z.ZodString
          dragModel: z.ZodEnum<{ G1: 'G1'; G7: 'G7' }>
          length: z.ZodOptional<z.ZodNumber>
          aerodynamics: z.ZodOptional<AerodynamicsSchema>
        },
        z.core.$strict
      >,
    ]
  >
  muzzleVelocity: z.ZodNumber
  firearm: z.ZodObject<
    {
      sightHeight: z.ZodNumber
      sightOffset: z.ZodOptional<z.ZodNumber>
      twist: z.ZodOptional<z.ZodNumber>
      twistHand: z.ZodOptional<z.ZodEnum<{ right: 'right'; left: 'left' }>>
    },
    z.core.$strict
  >
  air: AirSchema
  lookAngle: z.ZodOptional<z.ZodNumber>
  wind: z.ZodOptional<WindSchema>
  site: z.ZodOptional<
    z.ZodObject<
      { latitude: z.ZodOptional<z.ZodNumber>; azimuth: z.ZodOptional<z.ZodNumber> },
      z.core.$strict
    >
  >
  zero: z.ZodUnion<
    readonly [
      z.ZodObject<
        {
          range: z.ZodNumber
          lookAngle: z.ZodOptional<z.ZodNumber>
          air: z.ZodOptional<AirSchema>
          wind: z.ZodOptional<WindSchema>
        },
        z.core.$strict
      >,
      z.ZodObject<{ elevationAngle: z.ZodNumber; windageAngle: z.ZodNumber }, z.core.$strict>,
    ]
  >
}

/** The zod shape of `exteriorOptions`, the integrator and model options of every exterior request. */
export type ExteriorOptionsShape = {
  relativeTolerance: z.ZodOptional<z.ZodNumber>
  absoluteTolerance: z.ZodOptional<z.ZodNumber>
  maxTime: z.ZodOptional<z.ZodNumber>
  gravity: z.ZodOptional<z.ZodNumber>
  coriolis: z.ZodOptional<z.ZodBoolean>
  spinDrift: z.ZodOptional<z.ZodBoolean>
  jump: z.ZodOptional<z.ZodBoolean>
  zeroTolerance: z.ZodOptional<z.ZodNumber>
  model: z.ZodOptional<
    z.ZodEnum<{ 'point-mass': 'point-mass'; 'modified-point-mass': 'modified-point-mass' }>
  >
  maxYaw: z.ZodOptional<z.ZodNumber>
}

/** The zod shape of the options of one trajectory's integrations: those of every request and the step cap. */
export type TrajectoryOptionsShape = ExteriorOptionsShape & { maxSteps: z.ZodOptional<z.ZodNumber> }

const shotParser = z
  .strictObject({
    projectile: z
      .union([projectile, bulletRef])
      .describe('An explicit projectile, or a bullet record id with a drag model.'),
    muzzleVelocity: z
      .number()
      .min(stabilityBounds.muzzleVelocity[0])
      .max(stabilityBounds.muzzleVelocity[1])
      .describe(
        `Muzzle velocity along the bore, relative to the ground, m/s, ${stabilityBounds.muzzleVelocity[0]} to ${stabilityBounds.muzzleVelocity[1]}.`,
      ),
    firearm: z
      .strictObject({
        sightHeight: z
          .number()
          .describe('Height of the line of sight above the bore axis at the muzzle, m.'),
        sightOffset: z
          .number()
          .optional()
          .describe('Sight to the right of the bore, m, default 0.'),
        twist: z.number().optional().describe('Twist length per turn, m.'),
        twistHand: z
          .enum(['right', 'left'])
          .optional()
          .describe('Direction of the twist. Spin drift and jump need it.'),
      })
      .describe('Sight position, twist and twist direction of the firearm.'),
    air: air.describe('Station air at the firing point.'),
    lookAngle: angle()
      .optional()
      .describe('Angle of the line of sight above the horizontal, rad, default 0.'),
    wind: wind.optional().describe('Wind by horizontal distance segment, default none.'),
    site: z
      .strictObject({
        latitude: z
          .number()
          .optional()
          .describe('Latitude, rad, positive north. Coriolis is applied only with it.'),
        azimuth: z
          .number()
          .optional()
          .describe(
            'Azimuth of fire, rad clockwise from true north. Without it the vertical Coriolis effect is left out.',
          ),
      })
      .optional()
      .describe('Position and direction of fire for the Coriolis acceleration, default none.'),
    zero: z
      .union([
        z.strictObject({
          range: z.number().describe('Zero slant range, m.'),
          lookAngle: angle().optional().describe('Look angle of the zero, rad, default 0.'),
          air: air.optional().describe("Air of the zero, default the shot's air."),
          wind: wind.optional().describe('Wind of the zero, default none.'),
        }),
        z.strictObject({
          elevationAngle: angle().describe('Angle of the bore above the line of sight, rad.'),
          windageAngle: angle().describe(
            'Angle of the bore to the right of the line of sight, rad.',
          ),
        }),
      ])
      .describe('Zero conditions, from which the bore angles are searched, or the bore angles.'),
  })
  .describe('Projectile, muzzle velocity, firearm, air, wind, site and zero of the shot.')

/** The muzzle state of one trajectory: projectile, muzzle velocity, firearm, air, wind, site and zero. */
export const shot: z.ZodObject<ShotShape, z.core.$strict> = shotParser satisfies Exact<
  typeof shot,
  typeof shotParser
>

const exteriorOptionsParser = z.strictObject({
  relativeTolerance: z
    .number()
    .min(1e-12)
    .max(1e-3)
    .optional()
    .describe(
      'Relative error tolerance of the integrator, dimensionless. Default 1e-8 for a trajectory, 1e-10 for truing and range strings.',
    ),
  absoluteTolerance: z
    .number()
    .min(1e-12)
    .max(1)
    .optional()
    .describe(
      'Absolute error tolerance of the integrator, m for positions and m/s for velocities. Default 1e-6 for a trajectory, 1e-9 for truing and range strings.',
    ),
  maxTime: z
    .number()
    .positive()
    .max(120)
    .optional()
    .describe('Time of flight at which the run stops, s, default 120.'),
  gravity: z
    .number()
    .positive()
    .max(20)
    .optional()
    .describe('Constant gravity, m/s2, default 9.80665.'),
  coriolis: z
    .boolean()
    .optional()
    .describe('Apply the Coriolis acceleration, default true. It needs a site latitude.'),
  spinDrift: z
    .boolean()
    .optional()
    .describe('Add spin drift, default true. It needs length, twist and twist hand.'),
  jump: z
    .boolean()
    .optional()
    .describe('Add aerodynamic jump, default true. It needs length, twist and twist hand.'),
  zeroTolerance: z
    .number()
    .min(1e-10)
    .max(0.01)
    .optional()
    .describe(
      'Largest miss of the zero search in height and windage, m. Default 1e-6 for a trajectory, 1e-9 for truing and range strings.',
    ),
  model: z
    .enum(['point-mass', 'modified-point-mass'])
    .optional()
    .describe('Trajectory model, default point-mass.'),
  maxYaw: z
    .number()
    .positive()
    .max(0.5)
    .optional()
    .describe('Largest yaw of repose before a modified point mass run stops, rad, default 0.1.'),
})
/** Integrator and model options of every exterior request. */
export const exteriorOptions: z.ZodObject<ExteriorOptionsShape, z.core.$strict> =
  exteriorOptionsParser satisfies Exact<typeof exteriorOptions, typeof exteriorOptionsParser>

const trajectoryBodyParser = z
  .strictObject({
    shot,
    ranges: z
      .array(z.number().min(0).max(1e5))
      .min(1)
      .max(500)
      .describe('Slant ranges at which the trajectory is reported, m.'),
    options: z
      .strictObject({
        ...exteriorOptions.shape,
        maxSteps: steps(caps.trajectorySteps).describe(
          `Accepted plus rejected integrator steps per integration before the run fails, default ${caps.trajectorySteps}.`,
        ),
      })
      .optional()
      .describe('Integrator tolerances, limits and model switches.'),
  })
  .describe('A shot and the slant ranges at which to report its trajectory. Units SI, rad, K.')

/** Body of `POST /exterior/trajectory`: SI, rad, K. Request type: {@link TrajectoryRequest}. */
export const trajectoryBody: z.ZodObject<
  {
    shot: z.ZodObject<ShotShape, z.core.$strict>
    ranges: z.ZodArray<z.ZodNumber>
    options: z.ZodOptional<z.ZodObject<TrajectoryOptionsShape, z.core.$strict>>
  },
  z.core.$strict
> = trajectoryBodyParser satisfies Exact<typeof trajectoryBody, typeof trajectoryBodyParser>

const truingBodyParser = z
  .strictObject({
    shot,
    observations: z
      .array(
        z.strictObject({
          kind: z
            .enum(['height', 'elevationHold', 'velocity'])
            .describe(
              'Observed quantity: height above the line of sight, elevation hold or speed.',
            ),
          range: z.number().min(0).max(1e5).describe('Slant range of the observation, m.'),
          value: z
            .number()
            .min(-1e5)
            .max(1e5)
            .describe('Observed value: m for height, rad for elevationHold, m/s for velocity.'),
          standardUncertainty: z
            .number()
            .optional()
            .describe(
              'One standard deviation in the unit of value. Give it for all observations or none.',
            ),
        }),
      )
      .min(1)
      .max(100)
      .describe('Measured values at slant ranges.'),
    fit: z
      .discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('muzzleVelocity').describe('Fit the muzzle velocity.'),
        }),
        z.strictObject({
          kind: z
            .literal('drag')
            .describe('Fit a drag factor that multiplies the drag coefficient.'),
          knots: z
            .array(z.number().positive().max(10))
            .min(2)
            .max(4)
            .optional()
            .describe(
              'Mach numbers, dimensionless and rising, with one drag factor each. Without knots one constant factor is fitted.',
            ),
          fitMuzzleVelocity: z
            .boolean()
            .optional()
            .describe('Fit the muzzle velocity together with the drag, default false.'),
        }),
      ])
      .describe('Parameters to fit: the muzzle velocity, or drag factors.'),
    options: z
      .strictObject({
        ...exteriorOptions.shape,
        maxSteps: steps(caps.truingSteps).describe(
          `Accepted plus rejected integrator steps per integration before the run fails, default ${caps.truingSteps}.`,
        ),
        maxIterations: fitIterations,
        maxCondition: z
          .number()
          .min(1)
          .max(1e6)
          .optional()
          .describe(
            'Largest condition number of the column-scaled Jacobian, dimensionless, default 1e3.',
          ),
      })
      .optional()
      .describe('Trajectory options of every evaluation and the limits of the fit.'),
  })
  .describe('A shot, observations and the parameters to fit to them. Units SI, rad, K.')

/** Body of `POST /exterior/truing`: SI, rad, K. Request type: {@link TruingRequest}. */
export const truingBody: z.ZodObject<
  {
    shot: z.ZodObject<ShotShape, z.core.$strict>
    observations: z.ZodArray<
      z.ZodObject<
        {
          kind: z.ZodEnum<{
            height: 'height'
            elevationHold: 'elevationHold'
            velocity: 'velocity'
          }>
          range: z.ZodNumber
          value: z.ZodNumber
          standardUncertainty: z.ZodOptional<z.ZodNumber>
        },
        z.core.$strict
      >
    >
    fit: z.ZodDiscriminatedUnion<
      [
        z.ZodObject<{ kind: z.ZodLiteral<'muzzleVelocity'> }, z.core.$strict>,
        z.ZodObject<
          {
            kind: z.ZodLiteral<'drag'>
            knots: z.ZodOptional<z.ZodArray<z.ZodNumber>>
            fitMuzzleVelocity: z.ZodOptional<z.ZodBoolean>
          },
          z.core.$strict
        >,
      ],
      'kind'
    >
    options: z.ZodOptional<
      z.ZodObject<
        TrajectoryOptionsShape & {
          maxIterations: z.ZodOptional<z.ZodNumber>
          maxCondition: z.ZodOptional<z.ZodNumber>
        },
        z.core.$strict
      >
    >
  },
  z.core.$strict
> = truingBodyParser satisfies Exact<typeof truingBody, typeof truingBodyParser>

/** A parsed `POST /exterior/trajectory` body, defaults applied. */
export interface TrajectoryBody extends z.infer<typeof trajectoryBody> {}

/** A body of `POST /exterior/trajectory` as a client sends it, before defaults. */
export interface TrajectoryRequest extends z.input<typeof trajectoryBody> {}

/** A valid body of `POST /exterior/trajectory`: a .30 calibre bullet of 11.34 g, G7 BC 0.243 lb/in2. */
export const trajectoryExample: TrajectoryRequest = {
  shot: {
    projectile: {
      mass: 0.01134,
      diameter: 0.00782,
      length: 0.0312,
      drag: { kind: 'bc', model: 'G7', bands: [{ ballisticCoefficient: 170.85, minVelocity: 0 }] },
    },
    muzzleVelocity: 800,
    firearm: { sightHeight: 0.04, twist: 0.254, twistHand: 'right' },
    air: { altitude: 0, pressure: 101325, temperature: 288.15, humidity: 0.5 },
    wind: [{ endDistance: 1e6, speed: 4, fromDirection: Math.PI / 2 }],
    zero: { range: 100 },
  },
  ranges: [0, 100, 200, 300, 500],
}

/** A parsed `POST /exterior/truing` body, defaults applied. */
export interface TruingBody extends z.infer<typeof truingBody> {}

/** A body of `POST /exterior/truing` as a client sends it, before defaults. */
export interface TruingRequest extends z.input<typeof truingBody> {}

/** A valid body of `POST /exterior/truing`. */
export const truingExample: TruingRequest = {
  shot: trajectoryExample.shot,
  observations: [
    { kind: 'height', range: 300, value: -0.4409 },
    { kind: 'height', range: 500, value: -1.8831 },
  ],
  fit: { kind: 'muzzleVelocity' },
}
