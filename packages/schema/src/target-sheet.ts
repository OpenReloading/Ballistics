import { z } from 'zod'
import { recordId } from './ids.ts'
import { hexColour, localId } from './shared.ts'

/** A pixel of the photo as the browser shows it (orientation applied), x right, y down. */
const pixel = z.number().meta({ unit: 'px' })
const imagePoint = z
  .object({ x: pixel.describe('Right, px.'), y: pixel.describe('Down, px.') })
  .describe('A point of the photo as the browser shows it, px from its top left.')
/** SI like the other user data kinds: lengths m, angles rad. */
const meters = () => z.number().meta({ unit: 'm' })
const positiveMeters = () => z.number().positive().meta({ unit: 'm' })

/** A scale or perspective reference on the photo. Inferred type: {@link CalibrationReference}. */
export const calibrationReference = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('line').describe('Two points a known length apart.'),
    a: imagePoint,
    b: imagePoint,
    length: positiveMeters().describe('Length from `a` to `b` on the target, m.'),
  }),
  z.object({
    kind: z
      .literal('ringCentre')
      .describe('A ring of known diameter: its centre and a point on it.'),
    centre: imagePoint,
    edge: imagePoint,
    diameter: positiveMeters().describe('Ring diameter, m.'),
  }),
  z.object({
    kind: z.literal('ringEdge').describe('A ring of known diameter: three points on it.'),
    points: z.tuple([imagePoint, imagePoint, imagePoint]).describe('Three points on the ring.'),
    diameter: positiveMeters().describe('Ring diameter, m.'),
  }),
  z.object({
    kind: z.literal('rectangle').describe('A rectangle of known size, for perspective.'),
    corners: z
      .tuple([imagePoint, imagePoint, imagePoint, imagePoint])
      .describe('Corners: top left, top right, bottom right, bottom left.'),
    width: positiveMeters().describe('Rectangle width, m.'),
    height: positiveMeters().describe('Rectangle height, m.'),
  }),
])

/**
 * One shot of a group in target m, x right, y up. Not a chronograph `shot`.
 * Inferred type: {@link GroupShot}.
 */
export const groupShot = z.object({
  x: meters().describe('Right of the target origin, m.'),
  y: meters().describe('Up from the target origin, m.'),
  excluded: z.boolean().describe('Left out of the statistics, still shown.').optional(),
  placement: z
    .enum(['detected', 'placed'])
    .describe('Found by hole detection or placed by the user.'),
  holeDiameter: positiveMeters()
    .describe(
      'Measured diameter of the hole of a shot accepted from hole detection as a single hole, m.',
    )
    .optional(),
  chrono: z
    .object({
      session: localId.describe('Id of the chronograph session.'),
      string: z.int().nonnegative().describe('Index of the string in the session, from 0.'),
      shot: z.int().nonnegative().describe('Index of the shot in the string, from 0.'),
    })
    .describe('The chronograph shot of this round.')
    .optional(),
})

/**
 * The shots at one distance on a sheet, in target m (x right, y up), with the point of aim, the
 * hole detection choices and the ring-scoring face.
 * Inferred type: {@link ShotGroup}.
 */
export const shotGroup = z.object({
  id: localId.describe('Id of the group, unique in the sheet.'),
  name: z.string().min(1).max(200).describe('Name of the group.'),
  colour: hexColour.describe('Colour of the group, `#rrggbb`.'),
  distance: positiveMeters().describe('Muzzle to target, m.'),
  aim: z
    .object({
      x: meters().describe('Right of the target origin, m.'),
      y: meters().describe('Up from the target origin, m.'),
    })
    .describe('Point of aim in target m.')
    .optional(),
  ladderStep: z
    .int()
    .nonnegative()
    .describe("Index of the ladder step of the sheet's load, 0 for the first charge.")
    .optional(),
  shots: z.array(groupShot).max(1000).describe('Shots of the group.'),
  detection: z
    .object({
      region: z
        .array(imagePoint)
        .min(3)
        .max(64)
        .describe('Photo points of the polygon searched. A rectangle as its four corners.')
        .optional(),
      expectedHoleDiameter: positiveMeters()
        .describe(
          'Expected hole diameter typed by the user, m. Absent: learned, the bullet or the marker.',
        )
        .optional(),
      backing: hexColour
        .describe('Colour seen through a hole, picked in one, `#rrggbb`. Absent: off.')
        .optional(),
      minContrast: z
        .number()
        .min(0.01)
        .max(1)
        .describe('Least contrast of a hole, a fraction of the local paper white. Absent: 0.15.')
        .optional(),
      polarity: z
        .enum(['dark', 'light'])
        .describe(
          'Holes darker or lighter than their surroundings, from a picked example hole. Absent: both.',
        )
        .optional(),
    })
    .describe('The choices of hole detection on the photo, kept for the next run.')
    .optional(),
  face: z
    .object({
      id: recordId.describe('Id of the `TargetFace` record.'),
      event: z
        .string()
        .min(1)
        .max(200)
        .describe(
          "Id of the face's event whose gauge is the scored hole. Absent: the bullet diameter.",
        )
        .optional(),
      marks: z
        .array(
          z.object({
            ring: z.int().positive().describe('Ring number of the face.'),
            x: meters().describe('Right of the target origin, m.'),
            y: meters().describe('Up from the target origin, m.'),
          }),
        )
        .min(4)
        .max(64)
        .refine((ms) => new Set(ms.map((x) => x.ring)).size >= 2, 'Marks on two rings at least')
        .describe(
          "Points marked on the face's rings in target m, on two rings at least. Absent: centred on the point of aim.",
        )
        .optional(),
    })
    .describe(
      'Ring scoring: the target face record, the event whose gauge scores it, its alignment.',
    )
    .optional(),
})

/**
 * A text on the target in target m; `{key.unit}` placeholders show values of `group`.
 * Inferred type: {@link SheetNote}.
 */
export const sheetNote = z.object({
  id: localId.describe('Id of the note, unique in the sheet.'),
  x: meters().describe('Right of the target origin, m.'),
  y: meters().describe('Up from the target origin, m.'),
  text: z
    .string()
    .max(1000)
    .describe('Text of the note. `{key.unit}` placeholders show values of `group`.'),
  group: localId.describe('Id of the group whose values the placeholders show.').optional(),
})

/** Overlay switches of the editor, as the sheet was last shown. */
const optionalFlag = (description: string) => z.boolean().describe(description).optional()
const overlaySwitches = z
  .object({
    spread: optionalFlag('Extreme spread.'),
    box: optionalFlag('Width and height.'),
    aim: optionalFlag('Point of aim line.'),
    ellipses: optionalFlag('Prediction ellipses (50 %, 95 %).'),
    dispersion: optionalFlag('Dispersion ellipses (50 %, 95 %).'),
    axis: optionalFlag('Major axis.'),
    excluded: optionalFlag('Excluded direction.'),
    numbers: optionalFlag('Shot numbers.'),
    stats: optionalFlag('Statistics box.'),
    rings: optionalFlag('Face rings and scores.'),
  })
  .describe('Overlay switches of the editor, as the sheet was last shown.')

/**
 * A target sheet: a photo (a user file, kept on the device) or a drawn target, its calibration and
 * its shot groups. Shots are in target m, so a new calibration keeps them on the target.
 * Inferred type: {@link TargetSheet}.
 */
export const targetSheet = z
  .object({
    photo: localId
      .describe(
        "Id of the photo's user file (`files` of the user data file). Absent for a drawn target.",
      )
      .optional(),
    references: z
      .array(calibrationReference)
      .max(20)
      .describe('Scale and perspective references on the photo, one rectangle at most.'),
    targetRotation: z.number().meta({
      unit: 'rad',
      description: "Angle of the target's x axis on the photo, counter-clockwise, rad.",
    }),
    targetOrigin: imagePoint.describe('Photo point of target (0, 0).').optional(),
    photoRotation: z
      .number()
      .meta({
        unit: 'rad',
        description:
          'Turn of the photo on screen about its middle, counter-clockwise, rad. References, `targetOrigin` and detection regions are points on the turned photo. Absent: not turned.',
      })
      .optional(),
    groups: z.array(shotGroup).max(50).describe('Shot groups of the sheet.'),
    load: localId.describe('Id of the saved load the groups belong to.').optional(),
    markerDiameter: positiveMeters()
      .describe('Diameter of the shot marks, m. Absent: a fixed size on screen.')
      .optional(),
    notes: z.array(sheetNote).max(50).describe('Texts on the target.').optional(),
    overlays: overlaySwitches.optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (s.references.filter((r) => r.kind === 'rectangle').length > 1)
      issue(['references'], 'One rectangle at most')
    if (s.references.length && s.photo === undefined)
      issue(['references'], 'References need a photo')
    const ids = s.groups.map((g) => g.id)
    ids.forEach((id, i) => {
      if (ids.indexOf(id) !== i) issue(['groups', i, 'id'], 'Duplicate id')
    })
    const notes = (s.notes ?? []).map((n) => n.id)
    notes.forEach((id, i) => {
      if (notes.indexOf(id) !== i) issue(['notes', i, 'id'], 'Duplicate id')
    })
    s.groups.forEach((g, i) => {
      if (g.ladderStep !== undefined && s.load === undefined)
        issue(['groups', i, 'ladderStep'], 'A ladder step needs a load')
    })
  })

/** A scale or perspective reference on a target photo: line, ring or rectangle. */
export type CalibrationReference = z.infer<typeof calibrationReference>
/** One shot of a group in target m, with how it was found. */
export interface GroupShot extends z.infer<typeof groupShot> {}
/** The shots at one distance on a sheet, with point of aim and scoring face. */
export interface ShotGroup extends z.infer<typeof shotGroup> {}
/** A target photo or drawn target with its calibration and shot groups. */
export interface TargetSheet extends z.infer<typeof targetSheet> {}
/** A text placed on a target sheet, with value placeholders of one group. */
export interface SheetNote extends z.infer<typeof sheetNote> {}
/** Ring-scoring settings of a {@link ShotGroup}: face record id, event and ring marks. */
export type GroupFace = NonNullable<ShotGroup['face']>
