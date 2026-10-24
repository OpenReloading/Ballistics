import { z } from 'zod'
import { recordId } from './ids.ts'
import { localId, text } from './shared.ts'

/** A finite number in SI units (m, kg, rad), as the `siValues` of the other kinds. */
const si = (unit: string) => z.number().meta({ unit })
const length = () => si('m').nonnegative()
/**
 * Runs a cross-field check while `keys` are valid, also when other fields are not; never on a value
 * that is not an object (an issue without a path).
 */
const whileValid = (...keys: string[]) => ({
  when: (p: z.core.ParsePayload) =>
    !p.issues.some((i) => !i.path?.length || keys.includes(String(i.path[0]))),
})

/**
 * An optic of a firearm: turret click and travel as angles in rad, magnification range (the highest
 * not below the lowest).
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
        'How the turrets are marked. `clickValue` and `travel` are angles in rad either way.',
      )
      .optional(),
    clickValue: si('rad').positive().describe('Angle of one turret click, rad.').optional(),
    travel: si('rad').positive().describe('Total adjustment range of the turret, rad.').optional(),
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
  sightHeight: length().describe('Bore axis to optic centre, m.'),
  lateralOffset: si('m')
    .describe('Optic centre to the right of the bore, m. Negative to the left.')
    .optional(),
  cant: si('rad').describe('Cant of the optic, clockwise as seen from behind, rad.').optional(),
  zeroRange: si('m').positive().describe('Range of the zero, m.'),
  zeroNotes: text(1000).describe('Notes on the zero.').optional(),
  zeroTemperature: si('K').positive().describe('Air temperature of the zero, K.').optional(),
  zeroPressure: si('Pa')
    .positive()
    .describe('Absolute station pressure of the zero, Pa.')
    .optional(),
  zeroHumidity: si('1')
    .min(0)
    .max(1)
    .describe('Relative humidity of the zero, fraction from 0 to 1.')
    .optional(),
  dragFactor: si('1')
    .positive()
    .describe('Factor on the drag of the bullet from truing, 1 for the nominal drag.')
    .optional(),
  dragFactorSource: text(200)
    .describe('Where the drag factor comes from, for example the truing session.')
    .optional(),
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
 * A firearm of the library, lengths in m, mass in kg, angles in rad. Optic and configuration ids
 * are unique, each mount names an optic of the firearm and `active` names one of its configurations.
 * Inferred type: {@link Firearm}.
 */
export const firearm = z
  .object({
    name: text(200).describe('Name of the firearm as the library lists it.'),
    manufacturerName: text(200).describe('Manufacturer name.').optional(),
    model: text(200).describe('Model name.').optional(),
    cartridge: recordId
      .describe('Id of the cartridge record the firearm is chambered for.')
      .optional(),
    barrelLength: length().describe('Barrel length, m.').optional(),
    twist: length().describe('Rifling twist as length per turn, m.').optional(),
    twistHand: z.enum(['right', 'left']).describe('Direction of the rifling twist.'),
    grooveDiameter: length().describe('Groove diameter, m.').optional(),
    boreDiameter: length().describe('Bore diameter, m.').optional(),
    freebore: length()
      .describe('Unrifled length of the throat from the case mouth to the start of the rifling, m.')
      .optional(),
    baseToOgiveAtLands: length()
      .describe('Cartridge base to ogive with the bullet touching the lands, measured, m.')
      .optional(),
    firearmMass: si('kg').positive().describe('Mass of the firearm, kg.').optional(),
    roundCount: z.int().nonnegative().describe('Rounds fired through the barrel.').optional(),
    notes: text(10000).describe('Notes on the firearm, plain text.').optional(),
    optics: z.array(optic).max(20).describe('Optics of the firearm.'),
    configurations: z
      .array(opticConfiguration)
      .max(20)
      .describe('Optic configurations of the firearm.'),
    active: localId.describe('Id of the configuration on the firearm now.').optional(),
  })
  .superRefine((f, ctx) => {
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

/** A firearm of the library: lengths in m, mass in kg, optics and configurations. */
export interface Firearm extends z.infer<typeof firearm> {}
/** An optic: click and travel in rad, magnification range. */
export interface Optic extends z.infer<typeof optic> {}
/** The optics mounted on a firearm between a mount date and a removal date. */
export interface OpticConfiguration extends z.infer<typeof opticConfiguration> {}
/** One optic as mounted, with sight height and zero range in m, zero air and drag factor. */
export interface OpticMount extends z.infer<typeof opticMount> {}
