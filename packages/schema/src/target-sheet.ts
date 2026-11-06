import { z } from 'zod'
import type { Exact } from './exact.ts'
import { recordId, ref } from './ids.ts'
import { hexColour, localId } from './shared.ts'

/** A pixel of the photo as the browser shows it (orientation applied), x right, y down. */
const pixel = z.number().meta({ unit: 'px' })
const imagePoint = z
  .object({ x: pixel.describe('Right, px.'), y: pixel.describe('Down, px.') })
  .describe('A point of the photo as the browser shows it, px from its top left.')
/** SI like the other user data kinds: lengths m, angles rad. */
const meters = () => z.number().meta({ unit: 'm' })
const positiveMeters = () => z.number().positive().meta({ unit: 'm' })

const calibrationReferenceParser = z.discriminatedUnion('kind', [
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

/** A scale or perspective reference on the photo. Inferred type: {@link CalibrationReference}. */
export const calibrationReference: z.ZodDiscriminatedUnion<
  [
    z.ZodObject<{
      kind: z.ZodLiteral<'line'>
      a: z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>
      b: z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>
      length: z.ZodNumber
    }>,
    z.ZodObject<{
      kind: z.ZodLiteral<'ringCentre'>
      centre: z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>
      edge: z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>
      diameter: z.ZodNumber
    }>,
    z.ZodObject<{
      kind: z.ZodLiteral<'ringEdge'>
      points: z.ZodTuple<
        [
          z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>,
          z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>,
          z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>,
        ],
        null
      >
      diameter: z.ZodNumber
    }>,
    z.ZodObject<{
      kind: z.ZodLiteral<'rectangle'>
      corners: z.ZodTuple<
        [
          z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>,
          z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>,
          z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>,
          z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>,
        ],
        null
      >
      width: z.ZodNumber
      height: z.ZodNumber
    }>,
  ],
  'kind'
> = calibrationReferenceParser satisfies Exact<
  typeof calibrationReference,
  typeof calibrationReferenceParser
>

const groupShotParser = z.object({
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
      session: ref('session').describe('The chronograph session of the round.'),
      string: z.int().nonnegative().describe('Index of the string in the session, from 0.'),
      shot: z.int().nonnegative().describe('Index of the shot in the string, from 0.'),
    })
    .describe('The chronograph shot of this round.')
    .optional(),
})

/**
 * One shot of a group in target m, x right, y up. Not a chronograph `shot`.
 * Inferred type: {@link GroupShot}.
 */
export const groupShot: z.ZodObject<{
  x: z.ZodNumber
  y: z.ZodNumber
  excluded: z.ZodOptional<z.ZodBoolean>
  placement: z.ZodEnum<z.core.util.ToEnum<'detected' | 'placed'>>
  holeDiameter: z.ZodOptional<z.ZodNumber>
  chrono: z.ZodOptional<z.ZodObject<{ session: z.ZodString; string: z.ZodInt; shot: z.ZodInt }>>
}> = groupShotParser satisfies Exact<typeof groupShot, typeof groupShotParser>

const shotGroupParser = z.object({
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
      event: recordId
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
 * The shots at one distance on a sheet, in target m (x right, y up), with the point of aim, the
 * hole detection choices and the ring-scoring face.
 * Inferred type: {@link ShotGroup}.
 */
export const shotGroup: z.ZodObject<{
  id: z.ZodString
  name: z.ZodString
  colour: z.ZodString
  distance: z.ZodNumber
  aim: z.ZodOptional<z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>>
  ladderStep: z.ZodOptional<z.ZodInt>
  shots: z.ZodArray<typeof groupShot>
  detection: z.ZodOptional<
    z.ZodObject<{
      region: z.ZodOptional<z.ZodArray<z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>>>
      expectedHoleDiameter: z.ZodOptional<z.ZodNumber>
      backing: z.ZodOptional<z.ZodString>
      minContrast: z.ZodOptional<z.ZodNumber>
      polarity: z.ZodOptional<z.ZodEnum<z.core.util.ToEnum<'dark' | 'light'>>>
    }>
  >
  face: z.ZodOptional<
    z.ZodObject<{
      id: z.ZodString
      event: z.ZodOptional<z.ZodString>
      marks: z.ZodOptional<
        z.ZodArray<z.ZodObject<{ ring: z.ZodInt; x: z.ZodNumber; y: z.ZodNumber }>>
      >
    }>
  >
}> = shotGroupParser satisfies Exact<typeof shotGroup, typeof shotGroupParser>

const sheetNoteParser = z.object({
  id: localId.describe('Id of the note, unique in the sheet.'),
  x: meters().describe('Right of the target origin, m.'),
  y: meters().describe('Up from the target origin, m.'),
  text: z
    .string()
    .max(1000)
    .describe('Text of the note. `{key.unit}` placeholders show values of `group`.'),
  group: localId.describe('Id of the group whose values the placeholders show.').optional(),
})

/**
 * A text on the target in target m; `{key.unit}` placeholders show values of `group`.
 * Inferred type: {@link SheetNote}.
 */
export const sheetNote: z.ZodObject<{
  id: z.ZodString
  x: z.ZodNumber
  y: z.ZodNumber
  text: z.ZodString
  group: z.ZodOptional<z.ZodString>
}> = sheetNoteParser satisfies Exact<typeof sheetNote, typeof sheetNoteParser>

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

const targetSheetParser = z
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

/**
 * A target sheet: a photo (a user file, kept on the device) or a drawn target, its calibration and
 * its shot groups. Shots are in target m, so a new calibration keeps them on the target.
 * Inferred type: {@link TargetSheet}.
 */
export const targetSheet: z.ZodObject<{
  photo: z.ZodOptional<z.ZodString>
  references: z.ZodArray<typeof calibrationReference>
  targetRotation: z.ZodNumber
  targetOrigin: z.ZodOptional<z.ZodObject<{ x: z.ZodNumber; y: z.ZodNumber }>>
  photoRotation: z.ZodOptional<z.ZodNumber>
  groups: z.ZodArray<typeof shotGroup>
  load: z.ZodOptional<z.ZodString>
  markerDiameter: z.ZodOptional<z.ZodNumber>
  notes: z.ZodOptional<z.ZodArray<typeof sheetNote>>
  overlays: z.ZodOptional<
    z.ZodObject<{
      spread: z.ZodOptional<z.ZodBoolean>
      box: z.ZodOptional<z.ZodBoolean>
      aim: z.ZodOptional<z.ZodBoolean>
      ellipses: z.ZodOptional<z.ZodBoolean>
      dispersion: z.ZodOptional<z.ZodBoolean>
      axis: z.ZodOptional<z.ZodBoolean>
      excluded: z.ZodOptional<z.ZodBoolean>
      numbers: z.ZodOptional<z.ZodBoolean>
      stats: z.ZodOptional<z.ZodBoolean>
      rings: z.ZodOptional<z.ZodBoolean>
    }>
  >
}> = targetSheetParser satisfies Exact<typeof targetSheet, typeof targetSheetParser>

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
