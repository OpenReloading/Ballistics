/**
 * Response schemas of the exterior compute routes, for the contract document. Every object is
 * loose, so fields core adds later do not break the document. Paths where the route writes a NaN or
 * infinite number as null are nullable.
 */
import { dragModels } from '@open-reloading/core'
import { provenance } from '@open-reloading/schema'
import { z } from 'zod'

const num = (description: string) => z.number().describe(description)
const int = (description: string) => z.int().describe(description)
const nullNum = (description: string) => z.number().nullable().describe(description)

const units = z
  .record(z.string(), z.string())
  .describe('Unit of each result field by field name, as unit text such as m, m/s or rad')

// node pairs as arrays of two numbers: Schemathesis does not read `prefixItems` in a response
const table = (description: string) => z.array(z.array(z.number()).length(2)).describe(description)
const coefficient = (description: string) =>
  z.union([z.number(), table('Nodes of Mach and value')]).describe(description)
const interpolation = z
  .enum(['linear', 'monotone-cubic'])
  .describe('How the table is read between nodes')

const drag = z
  .discriminatedUnion('kind', [
    z.looseObject({
      kind: z.literal('bc').describe('Ballistic coefficient against a standard drag model'),
      model: z.enum(dragModels).describe('Standard drag model'),
      bands: z
        .array(
          z.looseObject({
            ballisticCoefficient: num('Ballistic coefficient, kg/m2'),
            minVelocity: num('Lowest airspeed of the band, m/s'),
          }),
        )
        .describe('Velocity bands of the ballistic coefficient'),
      reference: z
        .enum(['icao', 'metro'])
        .optional()
        .describe('Reference atmosphere the maker states, stored only'),
      interpolation: interpolation.optional(),
    }),
    z.looseObject({
      kind: z.literal('curve').describe('Drag coefficient curve of the bullet'),
      curve: table('Drag coefficient on area pi d^2 / 4 against Mach'),
      interpolation: interpolation.optional(),
    }),
  ])
  .describe('Drag input of the projectile')

const aerodynamics = z
  .looseObject({
    liftSlope: coefficient('Lift-force slope, 1/rad'),
    momentSlope: coefficient('Overturning-moment slope, 1/rad').optional(),
    magnusForceSlope: coefficient('Magnus-force slope, 1/rad').optional(),
    spinDamping: coefficient('Spin-damping coefficient, 1').optional(),
    axialInertia: num('Axial moment of inertia, kg m2').optional(),
    transverseInertia: num(
      'Transverse moment of inertia about the centre of mass, kg m2',
    ).optional(),
  })
  .describe('Coefficients of the modified point mass')

const projectile = z
  .looseObject({
    mass: num('Projectile mass, kg'),
    diameter: num('Reference diameter, m'),
    length: num('Length, m').optional(),
    drag,
    aerodynamics: aerodynamics.optional(),
  })
  .describe('Projectile in SI units')

const air = z
  .looseObject({
    altitude: num('Altitude above mean sea level, m'),
    pressure: num('Absolute station pressure, Pa'),
    temperature: num('Temperature, K'),
    humidity: num('Relative humidity, fraction 0 to 1'),
  })
  .describe('Station air')

const wind = z
  .array(
    z.looseObject({
      endDistance: num('Horizontal distance where the segment ends, m'),
      speed: num('Horizontal wind speed, m/s'),
      fromDirection: num('Direction the wind blows from, rad clockwise from the line of fire'),
      vertical: num('Vertical wind component, m/s, positive up').optional(),
    }),
  )
  .describe('Wind by distance segment')

const boreAngles = {
  elevationAngle: num('Angle of the bore above the line of sight, rad'),
  windageAngle: num('Angle of the bore to the right of the line of sight, rad'),
}

const shot = z
  .looseObject({
    projectile,
    muzzleVelocity: num('Muzzle velocity along the bore, m/s'),
    firearm: z
      .looseObject({
        sightHeight: num('Line of sight above the bore axis at the muzzle, m'),
        sightOffset: num('Sight to the right of the bore, m').optional(),
        twist: num('Twist length per turn, m').optional(),
        twistHand: z.enum(['right', 'left']).optional().describe('Twist direction'),
      })
      .describe('Sight and twist of the firearm'),
    air,
    lookAngle: num('Angle of the line of sight above the horizontal, rad').optional(),
    wind: wind.optional(),
    site: z
      .looseObject({
        latitude: num('Latitude, rad, positive north').optional(),
        azimuth: num('Azimuth of fire, rad clockwise from true north').optional(),
      })
      .optional()
      .describe('Latitude and azimuth for Coriolis'),
    zero: z
      .union([
        z.looseObject({
          range: num('Zero slant range, m'),
          lookAngle: num('Look angle of the zero, rad').optional(),
          air: air.optional(),
          wind: wind.optional(),
        }),
        z.looseObject(boreAngles),
      ])
      .describe('Zero conditions, or the bore angles themselves'),
  })
  .describe('Shot inputs in SI units')

const resolvedBullet = {
  id: z.string().describe('Bullet record id'),
  manufacturer: z.string().describe('Manufacturer record id'),
  name: z.string().describe('Product name'),
  suppliedFields: z.array(z.string()).describe('Names of the request values the record supplied'),
  provenance: provenance.describe('Provenance of the bullet record'),
}

const exteriorResolved = z
  .looseObject({
    bullet: z
      .looseObject({
        ...resolvedBullet,
        dragModel: z.enum(['G1', 'G7']).describe('Drag model of the ballistic coefficients used'),
      })
      .describe('The bullet record the request named'),
    projectile: projectile.describe('Projectile built from the record and the request'),
  })
  .optional()
  .describe('Present when the request names a bullet record')

const trajectoryPoint = z.looseObject({
  range: num('Slant range along the line of sight, m'),
  distance: num('Horizontal distance, m'),
  heightAboveFiringPoint: num('Height above the firing point, m'),
  time: num('Time of flight, s'),
  velocity: num('Ground-relative speed, m/s'),
  mach: num('Airspeed over the local speed of sound, 1'),
  energy: num('Kinetic energy, J'),
  height: num('Height above the line of sight including jump, m'),
  windage: num('Right of the line of sight including spin drift, m'),
  spinDrift: nullNum(
    'Spin drift alone, m, included in windage. Null beyond the point-mass twin run of the modified point mass',
  ),
  jump: num('Aerodynamic jump alone, m, included in height'),
  pathAngle: num('Angle of the velocity above the horizontal, rad'),
  elevationHold: num('Angle to hold or dial, rad, positive up'),
  windageHold: num('Angle to hold or dial, rad, positive right'),
  transonic: z.boolean().describe('True when the Mach number is from 0.8 to 1.2'),
  subsonic: z.boolean().describe('True when the Mach number is below 1'),
  dragClamped: z.boolean().describe('True when a coefficient was held at a table end'),
  yaw: num('Modified point mass only: yaw of repose, rad').optional(),
  spin: num(
    'Modified point mass only: axial spin rate, rad/s, positive for right-hand twist',
  ).optional(),
})

/** 200 body of `POST /exterior/trajectory`. */
export const trajectoryResponse = z.looseObject({
  units,
  result: z
    .looseObject({
      points: z.array(trajectoryPoint).describe('One point per reached requested range, ascending'),
      bore: z.looseObject(boreAngles).describe('Bore angles of the run'),
      stability: num('Gyroscopic stability factor at the muzzle, 1').optional(),
      stop: z.enum(['done', 'apex', 'atmosphere', 'maxTime', 'yaw']).describe('Why the run ended'),
      omitted: z
        .array(z.enum(['coriolis', 'coriolisVertical', 'spinDrift', 'jump', 'spinDecay', 'magnus']))
        .describe('Effects left out of this run'),
      estimated: z
        .array(z.enum(['axialInertia', 'transverseInertia', 'momentSlope']))
        .optional()
        .describe('Modified point mass only: inputs estimated instead of given'),
      dragModel: z
        .enum([...dragModels, 'custom'])
        .describe('Standard drag model of the ballistic coefficient, or custom for a curve'),
      steps: int('Integration steps, accepted plus rejected'),
    })
    .describe('The trajectory'),
  resolved: exteriorResolved,
})

const observationKind = z
  .enum(['height', 'elevationHold', 'velocity'])
  .describe('Quantity observed: height m, elevationHold rad or velocity m/s')

/** 200 body of `POST /exterior/truing`. */
export const truingResponse = z.looseObject({
  units,
  result: z
    .looseObject({
      shot: shot.describe('The input shot with the fitted values applied'),
      parameters: z
        .array(
          z.looseObject({
            name: z
              .enum(['muzzleVelocity', 'dragFactor'])
              .describe('Muzzle velocity m/s, or drag factor 1'),
            mach: num('Knot Mach number of a Mach-dependent drag factor').optional(),
            session: int('Session index of a per-session muzzle velocity').optional(),
            initial: num('Value before the fit, unit of the parameter'),
            value: num('Fitted value, unit of the parameter'),
            standardUncertainty: nullNum(
              'Standard uncertainty, unit of the parameter. Absent when it cannot be estimated, null when its variance is below 0',
            ).optional(),
          }),
        )
        .describe('Fitted parameters, in the order they were fitted'),
      correlation: z
        .array(z.array(z.number().nullable()))
        .optional()
        .describe(
          'Correlation matrix of the parameters, 1. Null entries for an exact unweighted fit',
        ),
      residuals: z
        .array(
          z.looseObject({
            kind: observationKind,
            range: num('Slant range, m'),
            observed: num('Observed value, unit of kind'),
            predicted: num('Predicted value of the fitted shot, unit of kind'),
            residual: num('Predicted minus observed, unit of kind'),
            mach: num('Predicted Mach number at the range, 1'),
            session: int('Session index of the observation').optional(),
          }),
        )
        .describe('One row per observation, in input order'),
      chiSquare: num('Sum of squared residuals over sigma, 1'),
      degreesOfFreedom: int('Observations minus parameters'),
      conditionNumber: num('Condition number of the column-scaled Jacobian, 1'),
      iterations: int('Iterations of the solver'),
      trajectoryCount: int('Trajectories computed, zero searches not counted'),
      steps: int('Integration steps of all trajectories, accepted plus rejected'),
    })
    .describe('The truing fit'),
  resolved: exteriorResolved,
})

const parameterName = z
  .enum(['muzzleVelocity', 'dragFactor', 'clickValue', 'zeroOffset'])
  .describe('Muzzle velocity m/s, drag factor 1, click value rad per click or zero offset rad')

const stringParameter = z.looseObject({
  name: parameterName,
  nominal: num('Start value, held when the parameter is not fitted, unit of the parameter'),
  status: z.enum(['identified', 'weak', 'unresolved']).describe('Identification status'),
  reasons: z
    .array(z.enum(['no-information', 'collinear', 'imprecise', 'fit-failed']))
    .describe('Why the parameter is not identified, empty when it is'),
  relativeStandardUncertainty: nullNum(
    'Standard error of ln q from the data alone, 1. Null when infinite',
  ).optional(),
  varianceInflation: nullNum('Variance inflation factor, 1. Null when infinite').optional(),
  standardUncertainty: nullNum(
    'Standard error at the nominal or fitted value, unit of the parameter. Null when infinite',
  ).optional(),
  posteriorSigma: nullNum(
    'With priors: posterior standard error of ln q, rad for the zero offset. Null when infinite',
  ).optional(),
  prior: z
    .looseObject({
      sigma: num('Prior sigma on the scale of posteriorSigma'),
      ratio: nullNum('Posterior over prior sigma, 1. Null when infinite'),
    })
    .optional()
    .describe('The prior on this parameter, when one is given'),
  value: num('Fitted value of an identified parameter, unit of the parameter').optional(),
  interval: z
    .looseObject({
      lower: num('Lower bound, unit of the parameter'),
      upper: num('Upper bound, unit of the parameter'),
      confidenceLevel: num('Two-sided confidence level, 1'),
    })
    .optional()
    .describe('Confidence interval of an identified parameter'),
  intervalsTrusted: z
    .boolean()
    .optional()
    .describe('Fit only: false when the residual check failed or the interval is conditional'),
  conditionalOn: z
    .array(parameterName)
    .optional()
    .describe('Fit only: parameters held at their nominal value while this one was fitted'),
})

const identification = {
  parameters: z.array(stringParameter).describe('The parameters, in name order'),
  conditionNumber: nullNum(
    'Condition number of the column-scaled information of the resolved parameters, 1. Null when singular',
  ),
  confounded: z
    .array(parameterName)
    .describe('Parameters in the direction of the smallest eigenvalue'),
  correlation: z
    .record(z.string(), z.number())
    .describe('Correlation of each pair of resolved parameters, keyed first:second, 1'),
}

/** 200 body of `POST /exterior/range-strings/plan`. */
export const rangeStringsPlanResponse = z.looseObject({
  units,
  result: z
    .array(
      z.looseObject({
        name: z.string().optional().describe('Name of the candidate'),
        shotCount: int('Planned shots of the entries and the chronograph'),
        plan: z
          .looseObject({
            ...identification,
            observationCount: int('Planned rows: entries plus the chronograph'),
          })
          .describe('Statuses, standard errors and predicted intervals'),
      }),
    )
    .describe('One plan per candidate, in request order'),
  resolved: exteriorResolved,
})

/** 200 body of `POST /exterior/range-strings/fit`. */
export const rangeStringsFitResponse = z.looseObject({
  units,
  result: z
    .looseObject({
      ...identification,
      held: z.array(parameterName).describe('Parameters held at their nominal value'),
      residuals: z
        .array(
          z.looseObject({
            kind: z
              .enum(['impact', 'dial', 'velocity'])
              .describe('Row kind: impact m, dial clicks or velocity m/s'),
            range: num('Slant range, m, the instrument distance for velocity'),
            observed: num('Observed value, unit of kind'),
            predicted: num('Predicted value, unit of kind'),
            residual: num('Predicted minus observed, unit of kind'),
            standardized: num('Residual over the standard uncertainty of the row, 1'),
          }),
        )
        .describe('One row per entry in input order, then the chronograph'),
      chiSquare: num('Chi-square of the reported model, 1'),
      degreesOfFreedom: int('Rows minus the parameters fitted'),
      pValue: num('Probability of a chi-square at least this large, 1').optional(),
      consistent: z
        .boolean()
        .optional()
        .describe('Whether the residuals agree with the stated uncertainties'),
      intervalsTrusted: z.boolean().describe('False when the intervals are not to be relied on'),
      intervalScale: num('Factor on the standard errors in the intervals, 1'),
      failures: z
        .array(
          z.looseObject({
            reason: z
              .enum(['unresolved', 'ill-conditioned', 'unreachable', 'not-converged'])
              .describe('Why the iteration failed'),
            parameters: z.array(parameterName).describe('Parameters left out of the fit'),
          }),
        )
        .describe('Failures of the iteration, in order'),
      iterations: int('Iterations of the final solver run'),
      shot: shot.describe('The input shot with the identified values applied'),
    })
    .describe('The fit'),
  resolved: exteriorResolved,
})

/** 200 body of `GET /exterior/stability`. */
export const stabilityResponse = z.looseObject({
  units,
  method: z.literal('miller').describe('Stability rule'),
  result: num('Gyroscopic stability factor, 1'),
  resolved: z
    .looseObject({
      bullet: z.looseObject(resolvedBullet).describe('The bullet record the request named'),
    })
    .optional()
    .describe('Present when the request names a bullet record'),
})
