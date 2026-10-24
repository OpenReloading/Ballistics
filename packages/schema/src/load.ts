import { z } from 'zod'
import { chronoShot } from './chrono-session.ts'
import { catalogueRef, recordId, ref } from './ids.ts'
import { type Provenance, provenance } from './provenance.ts'
import { text } from './shared.ts'
import { type QuantityKind, quantity, units } from './units.ts'

const kinds = {
  volume: 'volume',
  boreDiameter: 'length',
  boreArea: 'area',
  travel: 'length',
  twist: 'length',
  bulletMass: 'mass',
  propellantEnergy: 'specificEnergy',
  gamma: 'dimensionless',
  density: 'density',
  covolume: 'specificVolume',
  vivacity: 'burnRate',
  exponent: 'dimensionless',
  referencePressure: 'pressure',
  propellantTemperature: 'temperature',
  ignitionPressure: 'pressure',
  startPressure: 'pressure',
  sebert: 'dimensionless',
  formA: 'dimensionless',
  formM: 'dimensionless',
  formQ: 'dimensionless',
  formZ1: 'dimensionless',
  leakArea: 'area',
  boreFriction: 'pressure',
  engravingPressure: 'pressure',
  engravingLength: 'length',
  firearmMass: 'mass',
} as const satisfies Record<string, QuantityKind>

/** A solver value a load may override: a key of {@link analysisKinds}. */
export type AnalysisKey = keyof typeof kinds

/**
 * The stored quantity of each solver value a load may override under `analysis.overrides`, the keys
 * of the workbench without `charge` (the load's own `charge`). The values are in the stored unit of
 * the quantity and become SI at the solver call.
 */
export const analysisKinds: Readonly<Record<AnalysisKey, QuantityKind>> = kinds

/** The stored quantity of each kind of ladder: the charge in g, the seating length in mm, the propellant temperature step in K. */
export const ladderStepKinds = {
  charge: 'mass',
  seating: 'length',
  temperature: 'absoluteTemperature',
} as const satisfies Record<string, QuantityKind>

const overrideValue = ([key, kind]: [string, QuantityKind]) => [
  key,
  z
    .number()
    .meta({ unit: units[kind] })
    .describe(`The value of \`${key}\` in ${units[kind]}.`)
    .optional(),
]

/**
 * The solver values the user typed instead of taking them from the records the load references,
 * each in its stored unit. A key that is not a workbench value fails.
 * Inferred type: {@link AnalysisOverrides}.
 */
export const analysisOverrides = z.strictObject(
  Object.fromEntries(Object.entries(analysisKinds).map(overrideValue)) as Record<
    AnalysisKey,
    z.ZodOptional<z.ZodNumber>
  >,
)

const ladderKind = z
  .enum(['charge', 'seating', 'temperature'])
  .describe(
    'What the ladder varies: the charge, the length the bullet is seated by (`seating.by`) or the propellant temperature. Absent: the charge.',
  )
  .optional()
const ladderStep = z
  .number()
  .positive()
  .describe(
    'Step between ladder steps in the stored unit of its kind: g for a charge ladder, mm for a seating ladder, K for a temperature ladder. Absent until entered.',
  )
  .optional()

/**
 * What the load is analysed with: the typed solver values and the ladder.
 * Inferred type: {@link LoadAnalysis}.
 */
export const loadAnalysis = z.object({
  overrides: analysisOverrides
    .describe('Solver values the user typed. Every other value follows the referenced records.')
    .optional(),
  ladder: z
    .union([
      z.object({
        kind: ladderKind,
        stepCount: z.int().min(2).max(21).describe('Number of ladder steps.'),
        step: ladderStep,
        direction: z
          .enum(['up', 'down'])
          .describe('Steps from the charge (or seating length) up or down.'),
      }),
      z.object({
        kind: ladderKind,
        stepCount: z
          .literal([3, 5, 7, 9, 11, 13, 15, 17, 19, 21])
          .describe('Number of ladder steps, odd so the steps centre on the charge.'),
        step: ladderStep,
        direction: z.literal('around').describe('Steps centred on the charge (or seating length).'),
      }),
    ])
    .describe('The ladder of the load: step count, step size and direction.')
    .optional(),
})

/**
 * One chronograph file of a load: what the Measurements tab shows of it. Lengths in mm, the mass in g.
 * Inferred type: {@link MeasurementSeries}.
 */
export const measurementSeries = z.object({
  name: text(200).describe('Name of the imported chronograph file, shown on the Measurements tab.'),
  date: text(64).describe('Date of the session as the file gives it.').optional(),
  device: text(400).describe('Manufacturer and model of the device.').optional(),
  muzzleDistance: quantity('length', z.number().nonnegative())
    .describe('Muzzle to the measuring point.')
    .optional(),
  strings: z
    .array(
      z.object({
        label: text(200).describe('Name of the string in the file.').optional(),
        charge: quantity('mass', z.number().positive())
          .describe('The charge the string is mapped to. Absent: not used.')
          .optional(),
        shots: z.array(chronoShot).max(5000).describe('Shots of the string in file order.'),
      }),
    )
    .max(500)
    .describe('Shot strings of the file.'),
})

const component = {
  manufacturerName: z.string().min(1).describe('Manufacturer as the label names it.'),
  lot: z.string().min(1).describe('Lot number as printed on the package.').optional(),
}

const bulletDescription = z
  .object({
    ...component,
    model: z.string().min(1).describe('Model name of the bullet.'),
    bulletMass: quantity('mass').describe('Mass of the bullet.'),
  })
  .describe('The bullet as the publication describes it, where no record exists.')
const powderDescription = z
  .object({ ...component, name: z.string().min(1).describe('Product name of the powder.') })
  .describe('The powder as the publication describes it, where no record exists.')

/**
 * One cartridge recipe fired from one firearm, for every origin. The cartridge, firearm, bullet and
 * powder are references; a catalogue load of publication data (provenance `measured`) may describe
 * its bullet and powder by maker and name where no record exists. A catalogue load carries its `id`
 * (the file name), `provenance`, cartridge, bullet, powder and charge; a user load keeps what the
 * workbench had. Charge and masses in g, lengths in mm, the typed solver values in `analysis`.
 * Inferred type: {@link Load}.
 */
export const load = z
  .object({
    id: recordId.describe('Id of a catalogue load, the file name without `.json`.').optional(),
    origin: z
      .enum(['catalogue', 'user', 'shared'])
      .describe('Where the record lives: the git catalogue, this browser, or a received file.'),
    name: text(200).min(1).describe('Name of the load as the library lists it.'),
    cartridge: ref('cartridge').optional(),
    firearm: ref('firearm').optional(),
    bullet: z
      .union([ref('bullet'), bulletDescription])
      .describe('The bullet: a reference, or a description in a measured catalogue load.')
      .optional(),
    powder: z
      .union([catalogueRef('powder'), powderDescription])
      .describe('The powder: a catalogue reference, or a description in a measured catalogue load.')
      .optional(),
    charge: quantity('mass', z.number().positive())
      .describe('Powder mass of one round.')
      .optional(),
    primer: z
      .object({ ...component, model: z.string().min(1).describe('Model name of the primer.') })
      .describe('The primer as described.')
      .optional(),
    case: z
      .object({
        manufacturerName: component.manufacturerName.optional(),
        lot: component.lot,
        firingCount: z
          .int()
          .min(0)
          .describe('Times the case was fired before this load.')
          .optional(),
        waterCapacity: quantity('mass', z.number().positive())
          .describe('Water to the mouth of the case, the measured capacity.')
          .optional(),
      })
      .describe('The case as described, with its measured capacity.')
      .optional(),
    seating: z
      .object({
        by: z
          .enum(['overallLength', 'baseToOgive'])
          .describe(
            'The length the bullet is seated by: cartridge overall length or base to ogive.',
          ),
        value: quantity('length', z.number().positive()).describe('That length.'),
      })
      .describe('The length the bullet is seated by. The other one is derived.')
      .optional(),
    note: text(10000).describe('Notes of the load, plain text.').optional(),
    analysis: loadAnalysis
      .describe('The typed solver values and the ladder the load is analysed with.')
      .optional(),
    measurements: z
      .array(measurementSeries)
      .max(50)
      .describe(
        'Chronograph files read on the Measurements tab, one series each, strings mapped to charges.',
      )
      .optional(),
    provenance: provenance
      .describe('Where the values come from. Required for a catalogue load.')
      .optional(),
  })
  .superRefine((l, ctx) => {
    const issue = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    const catalogue = l.origin === 'catalogue'
    const measured = catalogue && l.provenance?.kind === 'measured'
    if (catalogue) {
      if (l.id === undefined) issue(['id'], 'A catalogue load needs an id')
      if (l.provenance === undefined) issue(['provenance'], 'A catalogue load needs provenance')
      for (const k of ['cartridge', 'bullet', 'powder', 'charge'] as const)
        if (l[k] === undefined) issue([k], `A catalogue load needs a ${k}`)
    }
    for (const k of ['cartridge', 'firearm', 'bullet', 'powder'] as const) {
      const target = l[k]
      if (typeof target !== 'string') {
        if (target !== undefined && !measured)
          issue([k], `Name a ${k} record: a description is for measured catalogue data only`)
      } else if (catalogue && !target.startsWith('catalogue:'))
        issue([k], `A catalogue load names catalogue records only`)
    }
  })

/**
 * A load of the catalogue (`records/loads`): {@link load} with `origin` `catalogue`, which also
 * carries its id, provenance, cartridge, bullet, powder and charge.
 */
export const catalogueLoad: z.ZodType<CatalogueLoad> = load.refine(
  (l): l is CatalogueLoad => l.origin === 'catalogue',
  {
    message: 'A catalogue record has origin catalogue',
    path: ['origin'],
  },
)

/** The solver values a load overrides, in stored units. */
export interface AnalysisOverrides extends z.infer<typeof analysisOverrides> {}
/** What a load is analysed with: the typed solver values and the ladder. */
export interface LoadAnalysis extends z.infer<typeof loadAnalysis> {}
/** One imported chronograph file with its shot strings mapped to charges. */
export interface MeasurementSeries extends z.infer<typeof measurementSeries> {}
/** A cartridge recipe in stored units: references to its records, charge, seating and analysis. */
export interface Load extends z.infer<typeof load> {}
/** A load of the catalogue: the fields {@link load} requires of one are present. */
export interface CatalogueLoad extends Load {
  id: string
  origin: 'catalogue'
  cartridge: string
  bullet: NonNullable<Load['bullet']>
  powder: NonNullable<Load['powder']>
  charge: NonNullable<Load['charge']>
  provenance: Provenance
}
