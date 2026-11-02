import { z } from 'zod'
import { baseTypes } from './bullet.ts'
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
  bulletDiameter: 'length',
  bulletLength: 'length',
  bulletBcG1: 'ballisticCoefficient',
  bulletBcG7: 'ballisticCoefficient',
  bulletBaseLength: 'length',
  bulletBaseDiameter: 'length',
  bulletCavityDiameter: 'length',
  bulletCavityDepth: 'length',
  pmax: 'pressure',
  caseLength: 'length',
  bulkDensity: 'density',
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
  throatWear: 'length',
  boreFriction: 'pressure',
  engravingPressure: 'pressure',
  engravingLength: 'length',
  firearmMass: 'mass',
} as const satisfies Record<string, QuantityKind>

/** A solver value a load may override: a key of {@link analysisKinds}. */
export type AnalysisKey = keyof typeof kinds

/**
 * The stored quantity of each value a load may override under `analysis.overrides`, the keys of the
 * workbench without `charge` (the load's own `charge`). A bullet key takes the place of the
 * referenced bullet record's value, and a ballistic coefficient replaces all bands of its drag
 * model. The values are in the stored unit of the quantity and become SI at the solver call.
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
    .describe(
      'Values the user typed: solver values, the bullet diameter, length, ballistic coefficients and base dimensions (boat-tail length, base face diameter, hollow-base cavity diameter), the Pmax (`pmax`, a limit typed in place of the cartridge sheet), the case length L3 and the powder bulk density. Every other value follows the referenced records.',
    )
    .optional(),
  bulletBase: baseTypes
    .describe(
      'The base form the user chose for the bullet instead of the one of its record (`base.type`).',
    )
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
  powders: z
    .strictObject({
      mode: z.enum(['typed', 'fill', 'target']).describe('Charge of each run.'),
      fill: z.number().min(10).max(120).describe('Case fill, %.').optional(),
      targetPressure: z.number().positive().describe('Target peak pressure, bar.').optional(),
      targetPercent: z.number().positive().describe('Target, % of CIP Pmax.').optional(),
      manufacturer: catalogueRef('manufacturer').optional(),
      base: text(200).min(1).describe('Base filter.').optional(),
      form: text(200).min(1).describe('Form filter.').optional(),
    })
    .describe('Powders tab mode and filters (GLOSSARY `powders`).')
    .optional(),
})

const component = {
  manufacturer: ref('manufacturer').describe('Manufacturer record of the component.'),
  lot: z.string().min(1).describe('Lot number as printed on the package.').optional(),
}

const bulletDescription = z
  .strictObject({
    ...component,
    model: z.string().min(1).describe('Model name of the bullet.'),
    bulletMass: quantity('mass').describe('Mass of the bullet.'),
  })
  .describe('The bullet as the publication describes it, where no record exists.')
const powderDescription = z
  .strictObject({ ...component, name: z.string().min(1).describe('Product name of the powder.') })
  .describe('The powder as the publication describes it, where no record exists.')

/**
 * What a load was when a chronograph session was attached to it, kept for the notes on a saved
 * load: the lots, the seating, the firearm's round count and the notes the user dismissed.
 * Inferred type: {@link SessionSnapshot}.
 */
export const sessionSnapshot = z.strictObject({
  session: ref('session').describe('The session the snapshot belongs to: one of `Load.sessions`.'),
  powderLot: component.lot.describe('Powder lot of the load at the session.').optional(),
  primerLot: component.lot.describe('Primer lot of the load at the session.').optional(),
  caseLot: component.lot.describe('Case lot of the load at the session.').optional(),
  seating: z
    .object({
      by: z
        .enum(['overallLength', 'baseToOgive'])
        .describe(
          'The length the bullet was seated by: cartridge overall length or base to ogive.',
        ),
      value: quantity('length', z.number().positive()).describe('That length.'),
    })
    .describe('The seating of the load at the session.')
    .optional(),
  roundCount: z
    .int()
    .nonnegative()
    .describe('Rounds fired through the firearm at the session.')
    .optional(),
  dismissed: z
    .array(z.string().min(1).max(40))
    .max(10)
    .describe('Ids of the notes on this session that the user dismissed.')
    .optional(),
})

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
    .union([ref('powder'), powderDescription])
    .describe(
      'The powder: a reference, or a description in a measured catalogue load. A catalogue load names a catalogue powder.',
    )
    .optional(),
  powderLot: component.lot
    .describe('Lot number of the powder, as printed on the package.')
    .optional(),
  charge: quantity('mass', z.number().positive()).describe('Powder mass of one round.').optional(),
  capacity: ref('case capacity')
    .describe('The water capacity of the case: a catalogue capacity, or one the user measured.')
    .optional(),
  primer: z
    .strictObject({
      lot: component.lot,
      record: catalogueRef('primer').describe('The primer: a catalogue product.').optional(),
    })
    .describe('The primer: the catalogue product and the lot.')
    .optional(),
  case: z
    .strictObject({
      manufacturer: component.manufacturer.optional(),
      lot: component.lot,
      firingCount: z.int().min(0).describe('Times the case was fired before this load.').optional(),
      record: ref('case')
        .describe(
          'The case: a catalogue product, whose stated water capacity is the default of `capacity`, or a case group of the user.',
        )
        .optional(),
    })
    .describe(
      'The case as described. Its measured water capacity is the `capacity` reference, which takes precedence over the stated capacity of `record`.',
    )
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
  snapshots: z
    .array(sessionSnapshot)
    .max(50)
    .describe('What the load was at each of its sessions, at most one per session of `sessions`.')
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
  if (l.case?.record !== undefined && !l.case.record.startsWith('catalogue:'))
    issue(['case', 'record'], 'A catalogue load names catalogue records only')
}

const checkComponentMakers = (l: LoadFields, issue: LoadIssue) => {
  const makers: [PropertyKey[], string | undefined][] = [
    [['bullet', 'manufacturer'], typeof l.bullet === 'object' ? l.bullet.manufacturer : undefined],
    [['powder', 'manufacturer'], typeof l.powder === 'object' ? l.powder.manufacturer : undefined],
    [['case', 'manufacturer'], l.case?.manufacturer],
  ]
  for (const [path, maker] of makers)
    if (maker !== undefined && !maker.startsWith('catalogue:'))
      issue(path, 'A catalogue load names catalogue records only')
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
  if (catalogue) checkComponentMakers(l, issue)
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
  l.snapshots?.forEach((snapshot, i) => {
    if (!l.sessions?.includes(snapshot.session))
      issue(['snapshots', i, 'session'], 'Not a session of this load')
    else if (l.snapshots?.findIndex((x) => x.session === snapshot.session) !== i)
      issue(['snapshots', i, 'session'], 'A second snapshot of one session')
  })
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
/** What a load was at one of its chronograph sessions: lots, seating, round count, dismissed notes. */
export interface SessionSnapshot extends z.infer<typeof sessionSnapshot> {}
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
