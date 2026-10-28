/**
 * Response schemas of the interior compute routes, for the contract document. Every object is
 * loose, so fields core adds later do not break the document. A non-finite number in an interior
 * answer is a 422, so only the fields core defines as null are nullable.
 */
import { provenance } from '@open-reloading/schema'
import { z } from 'zod'
import { notice } from './answer.ts'
import { chargeTargetKinds } from './charge-schema.ts'
import { identity } from './identity.ts'

const num = (description: string) => z.number().describe(description)
const int = (description: string) => z.int().describe(description)
const text = (description: string) => z.string().describe(description)

const noticeField = z.literal(notice).describe('Results are simulations, not load data')

const m3Units = z
  .looseObject({
    time: text('Unit of times, s'),
    travel: text('Unit of travel, m'),
    velocity: text('Unit of velocities, m/s'),
    pressure: text('Unit of pressures, Pa'),
    gasTemperature: text('Unit of the gas temperature, K'),
    energy: text('Unit of energies, J'),
    burntFraction: text('Unit of the burnt fraction, 1'),
    efficiency: text('Unit of the efficiency, 1'),
    mass: text('Unit of masses, kg'),
  })
  .describe('Unit per field name: a field takes the entry its name ends with')

const point = z
  .looseObject({
    time: num('Time from ignition, s'),
    travel: num('Projectile travel from the seated position, m'),
    velocity: num('Projectile velocity, m/s'),
    burntFraction: num('Burnt fraction of the charge, 1'),
    meanPressure: num('Space-mean gas pressure, Pa'),
    basePressure: num('Pressure at the projectile base, Pa'),
    breechPressure: num('Pressure at the breech, Pa'),
    gasTemperature: z.number().nullable().describe('Gas temperature, K, null without a heat model'),
    leakedMass: num('Gas mass lost through the leak, kg, present only with leakage').optional(),
  })
  .describe('One point of the pressure curve')

/** The fields of a valid M3 run besides its curve. */
const runFields = {
  valid: z.literal(true).describe('The run is valid'),
  peakBreechPressure: num('Peak breech pressure, Pa'),
  maxPressureTime: num('Time of the peak breech pressure from ignition, s'),
  maxPressureTravel: num('Projectile travel at the peak breech pressure, m'),
  maxBasePressure: num('Peak base pressure, Pa'),
  maxMeanPressure: num('Peak mean pressure, Pa'),
  muzzleVelocity: num('Projectile velocity at muzzle exit, m/s'),
  muzzleTime: num('Time of muzzle exit from ignition, s'),
  muzzleMeanPressure: num('Mean pressure at muzzle exit, Pa'),
  muzzleBasePressure: num('Base pressure at muzzle exit, Pa'),
  muzzleBreechPressure: num('Breech pressure at muzzle exit, Pa'),
  shotStartTime: num('Time of shot start from ignition, s'),
  barrelTime: num('Time from shot start to muzzle exit, s'),
  burnout: z
    .looseObject({
      time: num('Time of burnout from ignition, s'),
      travel: num('Projectile travel at burnout, m'),
    })
    .nullable()
    .describe('Burnout of the charge, null when the charge still burns at the muzzle'),
  muzzleBurntFraction: num('Burnt fraction of the charge at muzzle exit, 1'),
  muzzleEnergy: num('Kinetic energy of the projectile at the muzzle, J'),
  efficiency: num('Muzzle energy over the chemical energy of the charge, 1'),
  energy: z
    .looseObject({
      gas: num('Internal energy of the gas left in the bore, J'),
      translation: num('Kinetic energy of the projectile translation, J'),
      rotation: num('Kinetic energy of the projectile rotation, J'),
      gasKinetic: num('Kinetic energy of the gas behind the projectile, J'),
      resistance: num('Work done against bore resistance, J'),
      heat: num('Heat lost to the bore wall, J, 0 without a heat model'),
      leakage: num('Enthalpy carried out by leaking gas, J, 0 without leakage'),
    })
    .describe('Energy split at the muzzle, J'),
  tenPercentPressureTime: num(
    'Last time before the peak with breech pressure at 0.1 of its peak, s, 0 when the start is above it',
  ),
  steps: int('Integrator steps of the run'),
}

const result = z
  .looseObject({ ...runFields, points: z.array(point).describe('The pressure curve') })
  .describe('The M3 run')

const pressureInputs = [
  'chargeFraction',
  'volumeFraction',
  'massFraction',
  'burnRateFraction',
  'temperatureKelvin',
  'startPressureFraction',
] as const
const side = z.literal([-1, 0, 1]).describe('Side of the input, 0 for nominal')

const pressureRange = z
  .looseObject({
    quantity: z.literal('maxPressure').describe('The quantity ranged: the peak breech pressure'),
    nominalPressure: num('Peak pressure of the nominal load, Pa'),
    lowPressure: num('Lowest of the nominal and the valid case pressures, Pa'),
    highPressure: num('Highest of the nominal and the valid case pressures, Pa'),
    complete: z.boolean().describe('False when a case could not be computed'),
    tolerances: z
      .looseObject({
        chargeFraction: num('Tolerance of the charge mass, relative, 1'),
        volumeFraction: num('Tolerance of the chamber volume, relative, 1'),
        massFraction: num('Tolerance of the bullet mass, relative, 1'),
        burnRateFraction: num('Tolerance of the burn rate, relative, 1'),
        temperatureKelvin: num('Tolerance of the propellant temperature, K'),
        startPressureFraction: num('Tolerance of the shot-start pressure, relative, 1'),
      })
      .describe('The tolerances used'),
    cases: z
      .array(
        z.looseObject({
          input: z
            .enum([...pressureInputs, 'all'])
            .describe('The input moved, or all for every input at once'),
          side: z
            .literal([1, -1])
            .describe(
              'For a single input, 1 raises it by its tolerance and -1 lowers it. For input all, 1 selects pressure-raising ends and -1 pressure-lowering ends, with each applied direction in sides.',
            ),
          sides: z
            .looseObject(Object.fromEntries(pressureInputs.map((i) => [i, side])))
            .optional()
            .describe('For input all: the side used per input'),
          maxPressure: z
            .number()
            .nullable()
            .describe('Peak pressure of the case, Pa, null when the run is invalid'),
          reason: text('Why maxPressure is null').optional(),
        }),
      )
      .describe('Each input at both ends, then every input together at both ends'),
  })
  .describe('Peak pressure over the input tolerances of the load')

const percentiles = (what: string) =>
  z
    .looseObject({
      p05: num(`5th percentile of the ${what}`),
      p50: num(`Median of the ${what}`),
      p95: num(`95th percentile of the ${what}`),
    })
    .optional()
    .describe(`Percentiles of the ${what}, present with status sampled`)

const sampled = z
  .looseObject({
    status: z
      .enum(['sampled', 'overBudget', 'invalid'])
      .describe(
        'sampled: percentiles present. overBudget: the draws did not finish in the time budget, use pressureRange. invalid: no draw stayed in the model.',
      ),
    samples: int('Number of draws asked for'),
    seed: int('Seed of the generator'),
    failed: int('Draws that left the model, left out of the percentiles'),
    budgetMs: num('Time budget, ms'),
    pressure: percentiles('peak breech pressure, Pa'),
    velocity: percentiles('muzzle velocity, m/s'),
  })
  .optional()
  .describe(
    'Percentiles of the peak pressure and muzzle velocity over draws of the input tolerances. Absent unless the request has sampling.',
  )

const limits = z
  .array(
    z.looseObject({
      cartridge: text('Id of the cartridge'),
      revised: text('Date of the sheet revision'),
      symbol: text('Symbol of the limit, Pmax for CIP'),
      method: z.string().nullable().describe('Measuring method, null when the record states none'),
      variant: text('Variant of the value').optional(),
      pressure: num('The limit, Pa, absent when the record holds no value').optional(),
      compared: z.boolean().describe('The limit is compared with the simulated range'),
      reason: text('Why the limit is not compared: noValue or the measuring method').optional(),
      exceeded: z.boolean().optional().describe('The high end of the range is above the limit'),
      nominalExceeded: z.boolean().optional().describe('The nominal pressure is above the limit'),
    }),
  )
  .optional()
  .describe('CIP pressure limits of the cartridge, absent without a cartridge id')

const warnings = z
  .array(
    z.looseObject({
      code: z
        .enum([
          'limitExceeded',
          'noCartridge',
          'noComparableLimit',
          'rangeIncomplete',
          'chargeTooSmall',
          'resistanceNotApplied',
          'loadRatioHigh',
        ])
        .describe('The rule of the message'),
      message: text('The message'),
      spec: text('Id of the C.I.P. sheet the message refers to').optional(),
      symbol: text('Symbol of the limit a limitExceeded message refers to').optional(),
      variant: text('Variant of that limit').optional(),
      method: z
        .string()
        .nullable()
        .optional()
        .describe('Measuring method of that limit, null when the record states none'),
    }),
  )
  .describe('Messages on the limits, the range and the model')

const maximumCheck = z
  .looseObject({
    maximum: num('The maximum pressure entered with the request, Pa'),
    class: z
      .enum(['inputPlausible', 'modelDiscrepancy', 'aboveRange'])
      .describe(
        'inputPlausible: the maximum is inside the pressure range, ends included. modelDiscrepancy: below its low end. aboveRange: above its high end.',
      ),
    dominantInput: z
      .enum(pressureInputs)
      .nullable()
      .describe(
        'The input whose two tolerance ends differ most in peak pressure, null when no input moves it',
      ),
    message: text('A statement about the simulated range and the maximum'),
  })
  .optional()
  .describe(
    'Where the entered maximumPressure lies against pressureRange. Absent without maximumPressure.',
  )

const cartridge = z
  .looseObject({
    id: text('Cartridge id'),
    name: text('Cartridge name'),
    provenance,
  })
  .describe('The cartridge record of the request')

const record = (description: string) =>
  z
    .looseObject({
      id: text('Record id'),
      manufacturer: text('Manufacturer id'),
      name: text('Product name'),
      suppliedFields: z
        .array(z.string())
        .describe('Names of the request values the record supplied'),
      provenance,
    })
    .describe(description)

const error = z
  .looseObject({
    message: text('Why the run is invalid'),
    reason: text('Reason of the model').optional(),
    field: text('The first invalid input field, with reason input').optional(),
  })
  .describe('The invalid run of the step')

const charge = num('Charge mass, kg')

/** The fields of a valid run shared by the interior answers. */
const checked = { pressureRange, sampled, limits, warnings }
/** The fields of a valid run of `POST /interior`: the shared ones and the check of an entered maximum. */
const interiorChecked = { ...checked, maximumCheck }

/** 200 body of `POST /interior`: one M3 run, or the steps of a charge ladder. */
export const interiorResponse = z.union([
  z.looseObject({
    ...identity,
    notice: noticeField,
    model: z.literal('m3').describe('The interior model'),
    units: m3Units,
    result,
    ...interiorChecked,
    resolved: z
      .looseObject({ cartridge: cartridge.optional() })
      .optional()
      .describe('The records of the request, absent without a cartridge id'),
  }),
  z.looseObject({
    ...identity,
    notice: noticeField,
    model: z.literal('m3').describe('The interior model'),
    units: m3Units,
    ladderSteps: z
      .array(
        z.union([
          z.looseObject({ charge, result, ...interiorChecked }),
          z.looseObject({ charge, error }),
        ]),
      )
      .describe('One run per charge of the ladder, or its error'),
    resolved: z
      .looseObject({ cartridge: cartridge.optional() })
      .optional()
      .describe('The records of the request, absent without a cartridge id or a valid step'),
  }),
])

const summary = z
  .looseObject({
    peakPressure: num('Nominal peak breech pressure, Pa'),
    muzzleVelocity: num('Projectile velocity at muzzle exit, m/s'),
    muzzleEnergy: num('Kinetic energy of the projectile at the muzzle, J'),
    barrelTime: num('Time from shot start to muzzle exit, s'),
    loadRatio: num(
      'Charge over bulk density times chamber volume, 1, absent without a bulk density',
    ).optional(),
    muzzleBurntFraction: num('Burnt fraction of the charge at muzzle exit, 1'),
  })
  .describe('The values the workbench shows for the step')

const summaryStep = { charge, summary, ...checked }

/** 200 body of `POST /interior/load-file`: the summary of the shown step, its curve on request and the ladder. */
export const loadFileResponse = z.looseObject({
  ...identity,
  notice: noticeField,
  units: z
    .looseObject({
      charge: text('Unit of the charge, kg'),
      summary: z
        .looseObject({
          peakPressure: text('Unit of the peak pressure, Pa'),
          muzzleVelocity: text('Unit of the muzzle velocity, m/s'),
          muzzleEnergy: text('Unit of the muzzle energy, J'),
          barrelTime: text('Unit of the barrel time, s'),
          loadRatio: text('Unit of the load ratio, 1'),
          muzzleBurntFraction: text('Unit of the burnt fraction at the muzzle, 1'),
        })
        .describe('Units of the summary'),
      points: m3Units,
    })
    .describe('Units of the answer'),
  loadName: text('Name of the load in the file'),
  ...summaryStep,
  points: z.array(point).optional().describe('Curve of the shown step, present with curves=true'),
  shown: int('Index of the shown step in ladderSteps, present with a ladder').optional(),
  ladderSteps: z
    .array(z.union([z.looseObject(summaryStep), z.looseObject({ charge, error })]))
    .optional()
    .describe('Summary per charge of the ladder, or its error, present with a ladder'),
  resolved: z
    .looseObject({
      cartridge: cartridge.optional(),
      bullet: record('The bullet record of the file').optional(),
      powder: record('The powder record of the file').optional(),
    })
    .describe('The records the file names'),
})

const extreme = (description: string) =>
  z
    .looseObject({
      value: num('Target value, unit of the target kind'),
      charge: num('Charge mass that gives the value, kg'),
    })
    .describe(description)

/** 200 body of `POST /interior/charge-target`: the charge that reaches the target and its run without the curve. */
export const chargeTargetResponse = z.looseObject({
  ...identity,
  notice: noticeField,
  model: z.literal('m3').describe('The interior model'),
  units: m3Units,
  target: z
    .looseObject({
      kind: z.enum(chargeTargetKinds).describe('Quantity to reach'),
      value: num(
        'Target value: Pa, m/s, 1, s or s for peakPressure, muzzleVelocity, loadRatio, barrelTime, bulletLeadTime',
      ),
      percentOfLimit: num(
        'The requested percentage of the limit, present with a percentage target',
      ).optional(),
      limit: z
        .looseObject({
          cartridge: text('Id of the cartridge'),
          revised: text('Date of the sheet revision'),
          symbol: text('Symbol of the limit'),
          pressure: num('The limit, Pa'),
        })
        .optional()
        .describe('The compared limit, present with a percentage target'),
    })
    .describe('The target the solver ran to'),
  charge: num('Charge mass that reaches the target, kg'),
  achievedValue: num('Target quantity of the run at the charge, unit of the target kind'),
  relativeTolerance: num('Relative tolerance on the target, 1'),
  evaluationCount: int('Model runs made, scan included'),
  reachable: z
    .looseObject({
      minValue: extreme('Lowest target value over the valid scanned charges'),
      maxValue: extreme('Highest target value over the valid scanned charges'),
    })
    .describe('Reachable values over the scanned charges'),
  burnoutInBarrel: z.boolean().describe('The charge burns out before muzzle exit'),
  result: z.looseObject(runFields).describe('The M3 run at the charge, without the curve'),
  ...checked,
  resolved: z
    .looseObject({
      powder: record('The powder record of the request').optional(),
      cartridge: cartridge.optional(),
    })
    .optional()
    .describe('The records of the request, absent without a powder or cartridge id'),
})
