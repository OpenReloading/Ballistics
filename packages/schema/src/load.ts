import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { quantity } from './units.ts'

const component = {
  /** Manufacturer as the label names it. */
  manufacturerName: z.string().min(1),
  /** Lot number as printed on the package. */
  lot: z.string().min(1).optional(),
}

/** One cartridge recipe fired from one firearm. Inferred type: {@link Load}. */
export const load = z.object({
  id: recordId,
  cartridge: recordId,
  firearm: z.object({
    name: z.string().min(1),
    barrelLength: quantity('length'),
    twist: quantity('length').optional(),
    twistHand: z.enum(['right', 'left']).optional(),
  }),
  bullet: z.object({ ...component, model: z.string().min(1), bulletMass: quantity('mass') }),
  powder: z.object({ ...component, name: z.string().min(1) }),
  /** Powder mass of one round. */
  charge: quantity('mass'),
  primer: z.object({ ...component, model: z.string().min(1) }),
  case: z.object({
    ...component,
    /** Times the case was fired before this load. */
    firingCount: z.int().min(0).optional(),
    waterCapacity: quantity('mass').optional(),
  }),
  /** Cartridge overall length of the loaded round. */
  overallLength: quantity('length').optional(),
  /** Cartridge base to ogive of the loaded round. */
  baseToOgive: quantity('length').optional(),
  note: z.string().min(1).optional(),
  provenance,
})

/** A cartridge recipe record: components, charge in g, seating lengths in mm. */
export interface Load extends z.infer<typeof load> {}
