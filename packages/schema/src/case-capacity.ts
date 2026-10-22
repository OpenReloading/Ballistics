import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { quantity } from './units.ts'

/**
 * Water capacity of a case of one cartridge, from one source.
 * Inferred type: {@link CaseCapacity}.
 */
export const caseCapacity = z.object({
  id: recordId,
  cartridge: recordId,
  /** Mass of water filling the case to the mouth. */
  waterCapacity: quantity('mass'),
  /** Id of the manufacturer record of the case, when the source names one. */
  caseManufacturer: recordId.optional(),
  caseCondition: z.enum(['new', 'fired', 'sized']).optional(),
  note: z.string().min(1).optional(),
  provenance,
})

/** One water capacity figure (g) of a cartridge case, from one source. */
export interface CaseCapacity extends z.infer<typeof caseCapacity> {}
