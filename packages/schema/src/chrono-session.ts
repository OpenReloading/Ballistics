import { z } from 'zod'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { quantity } from './units.ts'

/**
 * One chronograph shot: velocity in m/s, with optional cold-bore mark and exclusion reason.
 * Inferred type: {@link ChronoShot}.
 */
export const chronoShot = z.object({
  velocity: quantity('velocity').describe('Velocity of the shot, m/s.'),
  coldBore: z.boolean().describe('First shot from a cold or clean barrel.').optional(),
  excluded: z
    .string()
    .min(1)
    .describe('Reason the shot is left out of statistics, for example a misread.')
    .optional(),
})

/** All shots of one load in one session. */
export const shotString = z.object({
  /** Id of the `Load` record the string was fired with. */
  load: recordId,
  propellantTemperature: quantity('temperature').optional(),
  shots: z.array(chronoShot).min(1),
})

/**
 * One chronograph session: one device, one place, one day, one or more loads.
 * Inferred type: {@link ChronoSession}.
 */
export const chronoSession = z.object({
  id: recordId,
  date: z.iso.date(),
  device: z.object({
    kind: z.enum(['doppler-radar', 'optical', 'magnetic', 'other']),
    manufacturerName: z.string().min(1),
    model: z.string().min(1),
    firmware: z.string().min(1).optional(),
  }),
  /** Muzzle to the measuring point; optical screens measure downrange. */
  muzzleDistance: quantity('length').optional(),
  conditions: z.object({
    airTemperature: quantity('temperature'),
    stationPressure: quantity('pressure').optional(),
    relativeHumidity: quantity('relativeHumidity').optional(),
  }),
  strings: z.array(shotString).min(1),
  note: z.string().min(1).optional(),
  provenance: provenance.refine((p) => p.kind === 'measured', {
    message: 'chronograph data is measured',
  }),
})

/** One chronograph shot as parsed: velocity in m/s, cold-bore mark, exclusion reason. */
export interface ChronoShot extends z.infer<typeof chronoShot> {}
/** A chronograph session record: one device, one day, one or more shot strings. */
export interface ChronoSession extends z.infer<typeof chronoSession> {}
