import { z } from 'zod'
import { recordId, ref } from './ids.ts'
import { provenance } from './provenance.ts'
import { text } from './shared.ts'
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

/**
 * What a shot string varies against its load: the charge (g) or the length the bullet is seated
 * by (mm). A temperature ladder is the string's `propellantTemperature`.
 * Inferred type: {@link StringVariation}.
 */
export const stringVariation = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('charge').describe('The string varies the charge.'),
    value: quantity('mass', z.number().positive()).describe('The charge of the string.'),
  }),
  z.object({
    kind: z.literal('seating').describe('The string varies the seating length.'),
    value: quantity('length', z.number().positive()).describe(
      'The length the load seats the bullet by (`seating.by`) in this string.',
    ),
  }),
])

/** All shots of one load in one session. */
export const shotString = z.object({
  load: ref('load')
    .describe(
      'The `Load` the string was fired with. Absent on a session not yet attached to a load, such as a file just read.',
    )
    .optional(),
  label: text(200).describe('Name of the string in the file.').optional(),
  variation: stringVariation
    .describe('What the string varies against its load. Absent: the load as it is.')
    .optional(),
  propellantTemperature: quantity('temperature')
    .describe('Temperature of the powder in this string.')
    .optional(),
  conditions: z
    .object({
      airTemperature: quantity('temperature').describe('Air temperature at the string.').optional(),
      stationPressure: quantity('pressure')
        .describe('Absolute air pressure at the string.')
        .optional(),
      windSpeed: quantity('velocity', z.number().nonnegative())
        .describe('Wind speed at the string.')
        .optional(),
    })
    .describe(
      'The weather at this string, where it differs from the session or was entered by hand.',
    )
    .optional(),
  note: text(2000).describe('Note on the string, plain text.').optional(),
  shots: z.array(chronoShot).min(1).max(5000).describe('Shots of the string in file order.'),
})

/**
 * One chronograph session, for every origin: one device, one place, one day, one or more strings
 * (shots of a load). A catalogue session carries its `id` (the file name), the device's maker (a
 * `catalogue:` reference) and model, the date, the air temperature and the load of every string
 * (a `catalogue:` reference); a user session keeps what the file gave and takes its name from
 * its record. Lengths in mm, masses in g.
 * Inferred type: {@link ChronoSession}.
 */
export const chronoSession = z
  .object({
    id: recordId.describe('Id of a catalogue session, the file name without `.json`.').optional(),
    origin: z
      .enum(['catalogue', 'user', 'shared'])
      .describe('Where the record lives: the git catalogue, this browser, or a received file.'),
    date: z.iso.date().describe('Day of the session, ISO 8601.').optional(),
    device: z
      .object({
        kind: z
          .enum(['doppler-radar', 'optical', 'magnetic', 'other'])
          .describe('How the device measures.'),
        manufacturer: ref('manufacturer').optional(),
        model: z.string().min(1).describe('Model name of the device.').optional(),
        firmware: z.string().min(1).describe('Firmware version of the device.').optional(),
      })
      .describe('The chronograph.'),
    muzzleDistance: quantity('length')
      .describe('Muzzle to the measuring point; optical screens measure downrange.')
      .optional(),
    conditions: z
      .object({
        airTemperature: quantity('temperature').describe('Air temperature.').optional(),
        stationPressure: quantity('pressure')
          .describe('Absolute air pressure at the site.')
          .optional(),
        relativeHumidity: quantity('relativeHumidity').describe('Relative humidity.').optional(),
      })
      .describe('The weather of the session.')
      .optional(),
    strings: z.array(shotString).min(1).max(500).describe('The shot strings of the session.'),
    note: z.string().min(1).describe('Note on the session.').optional(),
    provenance: provenance
      .refine((p) => p.kind === 'measured', { message: 'chronograph data is measured' })
      .describe('Where the values come from: the imported file.'),
  })
  .superRefine((s, ctx) => {
    if (s.origin !== 'catalogue') return
    const issue = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (s.id === undefined) issue(['id'], 'A catalogue session needs an id')
    if (s.date === undefined) issue(['date'], 'A catalogue session needs a date')
    if (s.device.model === undefined)
      issue(['device', 'model'], 'A catalogue session needs a model')
    if (s.device.manufacturer === undefined)
      issue(['device', 'manufacturer'], 'A catalogue session needs a device manufacturer')
    else if (!s.device.manufacturer.startsWith('catalogue:'))
      issue(['device', 'manufacturer'], 'A catalogue session names catalogue records only')
    if (s.conditions?.airTemperature === undefined)
      issue(['conditions', 'airTemperature'], 'A catalogue session needs an air temperature')
    s.strings.forEach((string, i) => {
      if (string.load === undefined)
        issue(['strings', i, 'load'], 'A catalogue session names the load of every string')
      else if (!string.load.startsWith('catalogue:'))
        issue(['strings', i, 'load'], 'A catalogue session names catalogue records only')
    })
  })

/**
 * A session of the catalogue (`records/chrono`): {@link chronoSession} with `origin` `catalogue`,
 * which also carries its id, date, device maker and model, air temperature and the load of every
 * string.
 */
export const catalogueSession: z.ZodType<CatalogueSession> = chronoSession.refine(
  (s): s is CatalogueSession => s.origin === 'catalogue',
  { message: 'A catalogue record has origin catalogue', path: ['origin'] },
)

/** One chronograph shot as parsed: velocity in m/s, cold-bore mark, exclusion reason. */
export interface ChronoShot extends z.infer<typeof chronoShot> {}
/** What a shot string varies against its load: the charge (g) or the seating length (mm). */
export type StringVariation = z.infer<typeof stringVariation>
/** A chronograph session: one device, one day, one or more shot strings. */
export interface ChronoSession extends z.infer<typeof chronoSession> {}
/** A session of the catalogue: the fields {@link chronoSession} requires of one are present. */
export interface CatalogueSession extends ChronoSession {
  id: string
  origin: 'catalogue'
  date: string
  device: ChronoSession['device'] & { manufacturer: string; model: string }
  conditions: NonNullable<ChronoSession['conditions']> & {
    airTemperature: NonNullable<NonNullable<ChronoSession['conditions']>['airTemperature']>
  }
  strings: (ChronoSession['strings'][number] & { load: string })[]
}
