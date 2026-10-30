import { z } from 'zod'
import { ref } from './ids.ts'
import { localId, text } from './shared.ts'
import { quantity } from './units.ts'

const length = () => quantity('length', z.number().nonnegative())
/**
 * Runs a cross-field check while `keys` are valid, also when other fields are not; never on a value
 * that is not an object (an issue without a path).
 */
const whileValid = (...keys: string[]) => ({
  when: (p: z.core.ParsePayload) =>
    !p.issues.some((i) => !i.path?.length || keys.includes(String(i.path[0]))),
})

/**
 * An optic of a firearm: turret click and travel as angles in degrees, magnification range (the
 * highest not below the lowest).
 * Inferred type: {@link Optic}.
 */
export const optic = z
  .object({
    id: localId.describe('Id of the optic, unique in the firearm.'),
    kind: z.enum(['scope', 'redDot', 'ironSights', 'other']).describe('Kind of optic.'),
    name: text(200).describe('Name of the optic.'),
    clickUnit: z
      .enum(['MOA', 'mrad'])
      .describe(
        'How the turrets are marked. `clickValue` and `travel` are angles in degrees either way.',
      )
      .optional(),
    clickValue: quantity('angle', z.number().positive())
      .describe('Angle of one turret click.')
      .optional(),
    travel: quantity('angle', z.number().positive())
      .describe('Total adjustment range of the turret.')
      .optional(),
    reticle: text(200).describe('Name of the reticle.').optional(),
    minMagnification: z.number().positive().describe('Lowest magnification, times.').optional(),
    maxMagnification: z.number().positive().describe('Highest magnification, times.').optional(),
  })
  .refine((o) => (o.minMagnification ?? 0) <= (o.maxMagnification ?? Number.POSITIVE_INFINITY), {
    message: 'Below the lowest magnification',
    path: ['maxMagnification'],
    ...whileValid('minMagnification', 'maxMagnification'),
  })

/**
 * One optic of the firearm as mounted in a configuration, with its own zero.
 * Inferred type: {@link OpticMount}.
 */
export const opticMount = z.object({
  optic: localId.describe('Id of the optic of the firearm.'),
  sightHeight: length().describe('Bore axis to optic centre.'),
  lateralOffset: quantity('length')
    .describe('Optic centre to the right of the bore. Negative to the left.')
    .optional(),
  cant: quantity('angle').describe('Cant of the optic, clockwise as seen from behind.').optional(),
  zeroRange: quantity('length', z.number().positive()).describe('Range of the zero.'),
  zeroNotes: text(1000).describe('Notes on the zero.').optional(),
  zeroTemperature: quantity('temperature', z.number().gt(-273.15))
    .describe('Air temperature of the zero.')
    .optional(),
  zeroPressure: quantity('pressure', z.number().positive())
    .describe('Absolute station pressure of the zero.')
    .optional(),
  zeroHumidity: quantity('relativeHumidity', z.number().min(0).max(100))
    .describe('Relative humidity of the zero, from 0 to 100 %.')
    .optional(),
  dragFactor: z
    .number()
    .positive()
    .meta({ unit: '1' })
    .describe('Factor on the drag of the bullet from truing, 1 for the nominal drag.')
    .optional(),
  dragFactorSource: text(200)
    .describe('Where the drag factor comes from, for example the truing session.')
    .optional(),
})

/** A count of shots, at least 1. */
const shots = () => z.int().positive().max(10000)
/** A number of turret clicks. */
const clicks = (s: z.ZodNumber) => s.meta({ unit: '1' })

/**
 * One distance of a truing string: the mean and the deviation of one shot, as the height above
 * the line of sight of the impacts or as clicks dialled.
 * Inferred type: {@link TruingRow}.
 */
export const truingRow = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('impact').describe('Impacts measured at the zero setting.'),
    range: quantity('length', z.number().positive()).describe('Distance of the row.'),
    shots: shots().describe('Shots of the row.'),
    mean: quantity('length').describe('Mean height of the impacts above the line of sight.'),
    deviation: quantity('length', z.number().positive()).describe(
      'Standard deviation of one shot.',
    ),
  }),
  z.object({
    kind: z.literal('dial').describe('Clicks dialled to hit at the distance.'),
    range: quantity('length', z.number().positive()).describe('Distance of the row.'),
    shots: shots().describe('Shots of the row.'),
    mean: clicks(z.number()).describe('Mean of the clicks dialled.'),
    deviation: clicks(z.number().positive()).describe('Standard deviation of one shot, clicks.'),
  }),
])

/** A value of a truing parameter in the stored unit of its kind. */
const parameterValue = {
  muzzleVelocity: () => quantity('velocity'),
  dragFactor: () => z.number().meta({ unit: '1' }),
  clickValue: () => quantity('angle'),
  zeroOffset: () => quantity('angle'),
}

const truingParameter = <N extends keyof typeof parameterValue>(name: N) => {
  const value = parameterValue[name]
  return z.object({
    name: z.literal(name).describe('Which parameter.'),
    status: z
      .enum(['identified', 'weak', 'unresolved'])
      .describe('Whether the strings identify the parameter.'),
    reasons: z
      .array(z.enum(['no-information', 'collinear', 'imprecise', 'fit-failed']))
      .max(4)
      .describe('Why a parameter is weak or unresolved.'),
    value: value().describe('Fitted value, only when identified.').optional(),
    lower: value().describe('Lower end of the confidence interval.').optional(),
    upper: value().describe('Upper end of the confidence interval.').optional(),
    confidenceLevel: z
      .number()
      .gt(0)
      .lt(1)
      .meta({ unit: '1' })
      .describe('Level of the interval, a fraction.')
      .optional(),
  })
}

/**
 * One truing result stored with the configuration it was shot with: the strings as entered, the
 * nominal shot they were fitted against, and the fitted parameters. A parameter that is not
 * identified has no value.
 * Inferred type: {@link Truing}.
 */
export const truing = z.object({
  date: z.iso.date().describe('Date the result was stored, ISO 8601.'),
  load: ref('load').describe('Reference to the load the strings were shot with.').optional(),
  bullet: text(200).describe('The bullet of the nominal shot as the workbench named it.'),
  muzzleVelocity: quantity('velocity', z.number().positive()).describe(
    'Muzzle velocity of the nominal shot.',
  ),
  zeroRange: quantity('length', z.number().positive()).describe('Zero range of the nominal shot.'),
  temperature: quantity('temperature', z.number().gt(-273.15)).describe('Air temperature.'),
  pressure: quantity('pressure', z.number().positive()).describe('Absolute station pressure.'),
  humidity: quantity('relativeHumidity', z.number().min(0).max(100)).describe(
    'Relative humidity, from 0 to 100 %.',
  ),
  clickValue: quantity('angle', z.number().positive()).describe('Nominal angle of one click.'),
  fitZeroOffset: z.boolean().describe('Whether a zero offset was fitted.'),
  rows: z.array(truingRow).min(1).max(50).describe('Distances shot.'),
  chronograph: z
    .object({
      shots: shots().describe('Chronograph readings.'),
      mean: quantity('velocity', z.number().positive()).describe('Mean muzzle velocity.'),
      deviation: quantity('velocity', z.number().positive()).describe(
        'Standard deviation of one reading.',
      ),
    })
    .describe('Muzzle velocity readings.')
    .optional(),
  parameters: z
    .array(
      z.discriminatedUnion('name', [
        truingParameter('muzzleVelocity'),
        truingParameter('dragFactor'),
        truingParameter('clickValue'),
        truingParameter('zeroOffset'),
      ]),
    )
    .max(4)
    .describe('Fitted parameters.'),
  consistent: z
    .boolean()
    .describe('Whether the residuals agree with the stated uncertainties; absent without a check.')
    .optional(),
  intervalsTrusted: z.boolean().describe('Whether the intervals are to be relied on.'),
})

/**
 * The optics mounted on a firearm between a mount date and a removal date: 1 to 4 mounts, removal
 * not before mounting.
 * Inferred type: {@link OpticConfiguration}.
 */
export const opticConfiguration = z
  .object({
    id: localId.describe('Id of the configuration, unique in the firearm.'),
    name: text(200).describe('Name of the configuration.'),
    mounts: z.array(opticMount).min(1).max(4).describe('The optics mounted, 1 to 4.'),
    mounted: z.iso.date().describe('Mount date, ISO 8601.').optional(),
    removed: z.iso.date().describe('Removal date, ISO 8601, not before `mounted`.').optional(),
    truing: z
      .array(truing)
      .max(100)
      .describe('Truing results shot with this configuration, oldest first.')
      .optional(),
  })
  // ISO dates compare as strings
  .refine((c) => !c.mounted || !c.removed || c.mounted <= c.removed, {
    message: 'Before the mount date',
    path: ['removed'],
    ...whileValid('mounted', 'removed'),
  })

const unique = (ids: string[], path: (i: number) => PropertyKey[], ctx: z.RefinementCtx) =>
  ids.forEach((id, i) => {
    if (ids.indexOf(id) !== i)
      ctx.addIssue({ code: 'custom', message: 'Duplicate id', path: path(i) })
  })

/**
 * A firearm, one shape for every origin: lengths in mm, mass in g, angles in degrees, zero air in
 * degC, bar and %. The maker is a manufacturer reference. Optic and configuration ids are unique, each
 * mount names an optic of the firearm and `active` names one of its configurations. A record of an
 * older format with the maker as text fails the schema.
 * Inferred type: {@link Firearm}.
 */
export const firearm = z
  .strictObject({
    origin: z
      .enum(['catalogue', 'user', 'shared'])
      .describe('Where the record lives: the git catalogue, this browser, or a received file.'),
    name: text(200).describe('Name of the firearm as the library lists it.'),
    manufacturer: ref('manufacturer').describe('Reference to the maker of the firearm.').optional(),
    model: text(200).describe('Model name.').optional(),
    cartridge: ref('cartridge')
      .describe('Reference to the cartridge the firearm is chambered for.')
      .optional(),
    barrelLength: length().describe('Barrel length.').optional(),
    twist: length().describe('Rifling twist as length per turn.').optional(),
    twistHand: z.enum(['right', 'left']).describe('Direction of the rifling twist.'),
    grooveDiameter: length().describe('Groove diameter.').optional(),
    boreDiameter: length().describe('Bore diameter.').optional(),
    freebore: length()
      .describe('Unrifled length of the throat from the case mouth to the start of the rifling.')
      .optional(),
    baseToOgiveAtLands: length()
      .describe('Cartridge base to ogive with the bullet touching the lands, measured.')
      .optional(),
    overallLengthAtLands: length()
      .describe('Cartridge overall length with the bullet touching the lands, measured.')
      .optional(),
    landsBullet: ref('bullet')
      .describe('Reference to the bullet the lands contact was measured with.')
      .optional(),
    firearmMass: quantity('mass', z.number().positive())
      .describe('Mass of the firearm.')
      .optional(),
    roundCount: z.int().nonnegative().describe('Rounds fired through the barrel.').optional(),
    roundCountDate: z.iso.date().describe('Day the round count was last set, ISO 8601.').optional(),
    countedSessions: z
      .array(
        z.strictObject({
          session: ref('session').describe('Reference to the session.'),
          rounds: z.int().nonnegative().describe('Rounds of the session added to `roundCount`.'),
        }),
      )
      .max(200)
      .describe(
        'Sessions whose rounds were added to `roundCount`, the latest last, so a session is counted once.',
      )
      .optional(),
    noteAtRoundCount: z
      .int()
      .positive()
      .describe(
        'Round count the user set: a saved load shot from this firearm gets a note when a session passes it.',
      )
      .optional(),
    notes: text(10000).describe('Notes on the firearm, plain text.').optional(),
    optics: z.array(optic).max(20).describe('Optics of the firearm.'),
    configurations: z
      .array(opticConfiguration)
      .max(20)
      .describe('Optic configurations of the firearm.'),
    active: localId.describe('Id of the configuration on the firearm now.').optional(),
  })
  .superRefine((f, ctx) => {
    if (
      (f.baseToOgiveAtLands !== undefined || f.overallLengthAtLands !== undefined) &&
      f.landsBullet === undefined
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Name the bullet the lands contact was measured with',
        path: ['landsBullet'],
      })
    const optics = f.optics.map((o) => o.id)
    const configs = f.configurations.map((c) => c.id)
    unique(optics, (i) => ['optics', i, 'id'], ctx)
    unique(configs, (i) => ['configurations', i, 'id'], ctx)
    f.configurations.forEach((c, i) => {
      c.mounts.forEach((m, j) => {
        if (!optics.includes(m.optic))
          ctx.addIssue({
            code: 'custom',
            message: 'Not an optic of this firearm',
            path: ['configurations', i, 'mounts', j, 'optic'],
          })
      })
    })
    if (f.active !== undefined && !configs.includes(f.active))
      ctx.addIssue({
        code: 'custom',
        message: 'Not a configuration of this firearm',
        path: ['active'],
      })
  })

/** A firearm: lengths in mm, mass in g, optics and configurations. */
export interface Firearm extends z.infer<typeof firearm> {}
/** An optic: click and travel in degrees, magnification range. */
export interface Optic extends z.infer<typeof optic> {}
/** The optics mounted on a firearm between a mount date and a removal date. */
export interface OpticConfiguration extends z.infer<typeof opticConfiguration> {}
/** A truing result with its strings, nominal shot and fitted parameters. */
export interface Truing extends z.infer<typeof truing> {}
/** One distance of a truing string, an impact or a dial. */
export type TruingRow = z.infer<typeof truingRow>
/** One optic as mounted, with sight height and zero range in mm, zero air and drag factor. */
export interface OpticMount extends z.infer<typeof opticMount> {}
