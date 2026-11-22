import { z } from 'zod'
import type { Cartridge } from './cartridge.ts'
import type { Case } from './case.ts'
import type { Exact } from './exact.ts'
import { parseRef, recordId, ref } from './ids.ts'
import { compareKeys } from './order.ts'
import { provenance } from './provenance.ts'
import { type QuantitySchema, quantity } from './units.ts'

const caseCapacityParser = z
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
    note: z.string().min(1).describe('Notes on the measurement.').optional(),
    provenance: provenance
      .describe('Where the value comes from, wherever the record has a source.')
      .optional(),
  })
  .superRefine((c, ctx) => {
    if (c.origin !== 'catalogue') return
    const issue = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (c.id === undefined) issue(['id'], 'A catalogue capacity needs an id')
    for (const k of ['cartridge', 'caseManufacturer'] as const)
      if (c[k] !== undefined && !c[k].startsWith('catalogue:'))
        issue([k], 'A catalogue capacity names catalogue records only')
  })

/**
 * Water capacity of a case of one cartridge, from one source: the one entity of a catalogue
 * record (`records/capacities`), the user record of kind `caseCapacity` (a capacity the user
 * measured) and the capacity a load references. A catalogue capacity carries its `id` (the file
 * name) and catalogue references only; a user capacity is named by its record.
 * Inferred type: {@link CaseCapacity}.
 */
export const caseCapacity: z.ZodObject<{
  id: z.ZodOptional<typeof recordId>
  origin: z.ZodEnum<z.core.util.ToEnum<'catalogue' | 'user' | 'shared'>>
  cartridge: z.ZodString
  waterCapacity: QuantitySchema
  caseManufacturer: z.ZodOptional<z.ZodString>
  caseCondition: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'new' | 'fired' | 'sized'>>>
  primerState: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'primed-spent' | 'unprimed'>>>
  fillLevel: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'mouth'>>>
  note: z.ZodOptional<z.ZodString>
  provenance: z.ZodOptional<typeof provenance>
}> = caseCapacityParser satisfies Exact<typeof caseCapacity, typeof caseCapacityParser>

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
}

/** Whether a capacity is an estimate (provenance kind `derived`), not a measured or published figure. */
export const isEstimatedCapacity = (capacity: Pick<CaseCapacity, 'provenance'>): boolean =>
  capacity.provenance?.kind === 'derived'

/**
 * The default capacity of a cartridge among its capacity records, never an estimate: the one
 * `defaults.capacity` names, and no other when that one is absent or an estimate. For a cartridge
 * that names none, the first by id.
 */
export function defaultCapacity<T extends Pick<CatalogueCaseCapacity, 'id' | 'provenance'>>(
  cartridge: Pick<Cartridge, 'defaults'>,
  capacities: readonly T[],
): T | undefined {
  const figures = capacities.filter((c) => !isEstimatedCapacity(c))
  const named = cartridge.defaults?.capacity
  if (named !== undefined) return figures.find((c) => c.id === parseRef(named)?.id)
  return figures.toSorted((a, b) => compareKeys(a.id, b.id))[0]
}

/** Where the water capacity a load uses comes from: its capacity record, the case product's stated figure, or the default of its cartridge. */
export type CapacitySource = 'capacity' | 'case' | 'default'

/** What `loadWaterCapacity` chooses from, in the order of its fields. */
export interface LoadCapacityRecords {
  /** The capacity record the load names. */
  capacity?: Pick<CaseCapacity, 'waterCapacity'> | undefined
  /** The case record the load names. */
  case?: Pick<Case, 'waterCapacity'> | undefined
  /** The default capacity of the load's cartridge ({@link defaultCapacity}). */
  cartridgeDefault?: Pick<CaseCapacity, 'waterCapacity'> | undefined
}

/** The water capacity (g) of the records a load names, for a caller that gives no default of the cartridge. */
export function loadWaterCapacity(
  records: LoadCapacityRecords & { cartridgeDefault?: undefined },
): { grams: number; source: Exclude<CapacitySource, 'default'> } | undefined
/**
 * The water capacity (g) a load uses and where it comes from. A capacity record the load names
 * (one the user measured, or a catalogue figure chosen) takes precedence, then the stated capacity
 * of the case record, then the default of the cartridge; with none the capacity is unknown.
 */
export function loadWaterCapacity(
  records: LoadCapacityRecords,
): { grams: number; source: CapacitySource } | undefined
export function loadWaterCapacity(
  records: LoadCapacityRecords,
): { grams: number; source: CapacitySource } | undefined {
  if (records.capacity) return { grams: records.capacity.waterCapacity.value, source: 'capacity' }
  if (records.case?.waterCapacity)
    return { grams: records.case.waterCapacity.value, source: 'case' }
  if (records.cartridgeDefault)
    return { grams: records.cartridgeDefault.waterCapacity.value, source: 'default' }
  return undefined
}
