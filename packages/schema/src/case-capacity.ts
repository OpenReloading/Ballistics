import { z } from 'zod'
import type { Case } from './case.ts'
import { recordId, ref } from './ids.ts'
import { type Provenance, provenance } from './provenance.ts'
import { quantity } from './units.ts'

/**
 * Water capacity of a case of one cartridge, from one source: the one entity of a catalogue
 * record (`records/capacities`), the user record of kind `caseCapacity` (a capacity the user
 * measured) and the capacity a load references. A catalogue capacity carries its `id` (the file
 * name), `provenance` and catalogue references only; a user capacity is named by its record.
 * Inferred type: {@link CaseCapacity}.
 */
export const caseCapacity = z
  .object({
    id: recordId.describe('Id of a catalogue capacity, the file name without `.json`.').optional(),
    origin: z
      .enum(['catalogue', 'user', 'shared'])
      .describe('Where the record lives: the git catalogue, this browser, or a received file.'),
    cartridge: ref('cartridge'),
    waterCapacity: quantity('mass').describe('Mass of water filling the case to `fillLevel`.'),
    caseManufacturer: ref('manufacturer')
      .describe('The manufacturer of the case, when the source names one.')
      .optional(),
    caseCondition: z
      .enum(['new', 'fired', 'sized'])
      .describe('The condition of the measured case.')
      .optional(),
    primerState: z
      .enum(['primed-spent', 'unprimed'])
      .describe('Primer pocket when filled: a spent primer seated, or none. Absent: not stated.')
      .optional(),
    fillLevel: z
      .enum(['mouth'])
      .describe('How high the water was filled. Absent: not stated, the mouth is taken.')
      .optional(),
    convention: z
      .never({ error: 'Replaced by primerState and fillLevel' })
      .describe('Refused, see primerState.')
      .optional(),
    note: z.string().min(1).describe('Notes on the measurement.').optional(),
    provenance: provenance
      .describe('Where the value comes from. Required for a catalogue capacity.')
      .optional(),
  })
  .superRefine((c, ctx) => {
    if (c.origin !== 'catalogue') return
    const issue = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (c.id === undefined) issue(['id'], 'A catalogue capacity needs an id')
    if (c.provenance === undefined) issue(['provenance'], 'A catalogue capacity needs provenance')
    for (const k of ['cartridge', 'caseManufacturer'] as const)
      if (c[k] !== undefined && !c[k].startsWith('catalogue:'))
        issue([k], 'A catalogue capacity names catalogue records only')
  })

/** A capacity of the catalogue (`records/capacities`): {@link caseCapacity} with `origin` `catalogue`. */
export const catalogueCaseCapacity: z.ZodType<CatalogueCaseCapacity> = caseCapacity.refine(
  (c): c is CatalogueCaseCapacity => c.origin === 'catalogue',
  { message: 'A catalogue record has origin catalogue', path: ['origin'] },
)

/** One water capacity figure (g) of a cartridge case, from one source. */
export interface CaseCapacity extends z.infer<typeof caseCapacity> {}

/** A capacity of the catalogue: the fields {@link caseCapacity} requires of one are present. */
export interface CatalogueCaseCapacity extends CaseCapacity {
  id: string
  origin: 'catalogue'
  provenance: Provenance
}

/** Where the water capacity a load uses comes from: its capacity record, or the case product's stated figure. */
export type CapacitySource = 'capacity' | 'case'

/**
 * The water capacity (g) a load uses and where it comes from. A capacity record the load names
 * (one the user measured, or a catalogue figure chosen) takes precedence; without one the stated
 * capacity of the case record is the default; with neither the capacity is unknown.
 */
export function loadWaterCapacity(records: {
  capacity?: Pick<CaseCapacity, 'waterCapacity'> | undefined
  case?: Pick<Case, 'waterCapacity'> | undefined
}): { grams: number; source: CapacitySource } | undefined {
  if (records.capacity) return { grams: records.capacity.waterCapacity.value, source: 'capacity' }
  if (records.case?.waterCapacity)
    return { grams: records.case.waterCapacity.value, source: 'case' }
}
