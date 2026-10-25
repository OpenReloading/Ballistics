import { z } from 'zod'
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

const loadShape = z.object({
  id: recordId.describe('Id of a catalogue load, the file name without `.json`.').optional(),
  origin: z
    .enum(['catalogue', 'user', 'shared'])
    .describe('Where the record lives: the git catalogue, this browser, or a received file.'),
  name: text(200)
    .min(1)
    .describe('Name of a catalogue load. A user load is named by its record.')
    .optional(),
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
  charge: quantity('mass', z.number().positive()).describe('Powder mass of one round.').optional(),
  capacity: ref('case capacity')
    .describe('The water capacity of the case: a catalogue capacity, or one the user measured.')
    .optional(),
  primer: z
    .object({ ...component, model: z.string().min(1).describe('Model name of the primer.') })
    .describe('The primer as described.')
    .optional(),
  case: z
    .strictObject({
      manufacturerName: component.manufacturerName.optional(),
      lot: component.lot,
      firingCount: z.int().min(0).describe('Times the case was fired before this load.').optional(),
    })
    .describe('The case as described. Its water capacity is the `capacity` reference.')
    .optional(),
  seating: z
    .object({
      by: z
        .enum(['overallLength', 'baseToOgive'])
        .describe('The length the bullet is seated by: cartridge overall length or base to ogive.'),
      value: quantity('length', z.number().positive()).describe('That length.'),
    })
    .describe('The length the bullet is seated by. The other one is derived.')
    .optional(),
  note: text(10000).describe('Notes of the load, plain text.').optional(),
  analysis: loadAnalysis
    .describe('The typed solver values and the ladder the load is analysed with.')
    .optional(),
  sessions: z
    .array(ref('session'))
    .max(50)
    .describe(
      "Chronograph sessions read on the Measurements tab. Each names its strings' load and what they vary.",
    )
    .optional(),
  provenance: provenance
    .describe('Where the values come from. Required for a catalogue load.')
    .optional(),
})

type LoadIssue = (path: PropertyKey[], message: string) => void
type LoadFields = z.infer<typeof loadShape>

const checkCatalogueFields = (l: LoadFields, issue: LoadIssue) => {
  if (l.id === undefined) issue(['id'], 'A catalogue load needs an id')
  if (l.name === undefined) issue(['name'], 'A catalogue load needs a name')
  if (l.provenance === undefined) issue(['provenance'], 'A catalogue load needs provenance')
  for (const k of ['cartridge', 'bullet', 'powder', 'charge'] as const)
    if (l[k] === undefined) issue([k], `A catalogue load needs a ${k}`)
  if (l.capacity !== undefined && !l.capacity.startsWith('catalogue:'))
    issue(['capacity'], 'A catalogue load names catalogue records only')
}

const checkRecordReferences = (l: LoadFields, issue: LoadIssue) => {
  const catalogue = l.origin === 'catalogue'
  const measured = catalogue && l.provenance?.kind === 'measured'
  for (const k of ['cartridge', 'firearm', 'bullet', 'powder'] as const) {
    const target = l[k]
    if (typeof target !== 'string') {
      if (target !== undefined && !measured)
        issue([k], `Name a ${k} record: a description is for measured catalogue data only`)
    } else if (catalogue && !target.startsWith('catalogue:'))
      issue([k], `A catalogue load names catalogue records only`)
  }
}

/**
 * One cartridge recipe fired from one firearm, for every origin. The cartridge, firearm, bullet, powder
 * and the case capacity are references; a catalogue load of publication data (provenance `measured`) may describe
 * its bullet and powder by maker and name where no record exists. A catalogue load carries its `id`
 * (the file name), `name`, `provenance`, cartridge, bullet, powder and charge; a user load keeps
 * what the workbench had and takes its name from its record. Charge and masses in g, lengths in mm,
 * the typed solver values in `analysis`.
 * Inferred type: {@link Load}.
 */
export const load = loadShape.superRefine((l, ctx) => {
  const issue: LoadIssue = (path, message) => ctx.addIssue({ code: 'custom', path, message })
  const catalogue = l.origin === 'catalogue'
  if (catalogue) checkCatalogueFields(l, issue)
  l.sessions?.forEach((target, i) => {
    if (catalogue && !target.startsWith('catalogue:'))
      issue(['sessions', i], 'A catalogue load names catalogue records only')
  })
  checkRecordReferences(l, issue)
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
/** A cartridge recipe in stored units: references to its records, charge, seating and analysis. */
export interface Load extends z.infer<typeof load> {}
/** A load of the catalogue: the fields {@link load} requires of one are present. */
export interface CatalogueLoad extends Load {
  id: string
  name: string
  origin: 'catalogue'
  cartridge: string
  bullet: NonNullable<Load['bullet']>
  powder: NonNullable<Load['powder']>
  charge: NonNullable<Load['charge']>
  provenance: Provenance
}
