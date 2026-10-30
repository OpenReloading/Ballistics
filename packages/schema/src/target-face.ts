import { z } from 'zod'
import { disciplineCategory } from './federation.ts'
import { recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { positiveLength } from './shared.ts'
import { quantity } from './units.ts'

/** Printed colour of a ring zone or ring line. */
export const faceColour = z.enum([
  'black',
  'white',
  'grey',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'brown',
])

/** Paper formats the sheet size can name; `other` for a sheet of no ISO A size. */
export const paperFormat = z.enum(['A2', 'A3', 'A4', 'A5', 'A6', 'other'])

const isoA: Record<string, [number, number]> = {
  A2: [420, 594],
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  A6: [105, 148],
}

const targetFaceFields = z.object({
  id: recordId,
  /** The face as the rule book names it. */
  name: z.string().min(1),
  /**
   * Id of the federation record whose rule book publishes the face. Absent: no federation, a face
   * a user draws for their own use.
   */
  federation: recordId.optional(),
  /**
   * Outer to inner; values rise by one ring to ring. `diameter` is the width of the ring; for an
   * oval ring `height` is its height (axis-aligned, the face upright; absent: a circle). A
   * `square` ring has the edge `diameter` and no `height` (absent: a circle). A `stadium` ring has
   * straight vertical sides and a half circle of the radius `diameter / 2` at each end, so its
   * `height` is at least its `diameter`; a face has stadium rings on all rings or on none, and its
   * inner ten and black area are stadiums too.
   * `fill` is the colour of the zone that the ring line bounds on the outside (the area up to the
   * next ring, for the innermost ring the whole disc), `line` the colour of the ring line.
   */
  rings: z
    .array(
      z.object({
        value: z.int().positive(),
        diameter: positiveLength(),
        height: positiveLength().optional(),
        shape: z.enum(['circle', 'square', 'stadium']).optional(),
        fill: faceColour.optional(),
        line: faceColour.optional(),
      }),
    )
    .min(2),
  /**
   * The inner ten: `touch` counts a hole that touches its circle, `cover` only a hole that
   * covers it completely (shot out). Absent: the rule book does not state it; scored as `touch`.
   */
  innerTen: z
    .object({
      diameter: positiveLength(),
      height: positiveLength().optional(),
      rule: z.enum(['touch', 'cover']).optional(),
    })
    .optional(),
  /** Diameter (width) of the black aiming area: the outside of the outermost black zone. */
  blackDiameter: positiveLength(),
  /** Height of the black aiming area of an oval face. */
  blackHeight: positiveLength().optional(),
  /**
   * The rule book allows decimal (tenth-ring) values for an event on this face (`true`) or states
   * whole rings only (`false`). Absent: the rule book does not state it; scored in whole rings.
   */
  decimal: z.boolean().optional(),
  /** Events shot on this face, with the gauge diameter that scores them where the rules fix one. */
  events: z
    .array(
      // strict: an event key this schema does not know rejects the record
      z.strictObject({
        /** Id of the event within its face; a target mapping names the event by it. */
        id: recordId,
        name: z.string().min(1),
        distance: positiveLength(),
        /** Diameter of the hole as scored: a gauge's measuring edge, or its equivalent hole. */
        gauge: positiveLength().optional(),
        /**
         * `touch`: the hole counts a ring when it touches the ring line. `centre`: only when the
         * centre of the hole lies on its line or inside it (black-powder events); the hole size is
         * ignored. `outward`: only when the hole edge furthest from the centre stays inside the
         * outer edge of the ring line; a hole touching the outside of the line takes the lower
         * value (outward gauging, circular rings and whole rings only). Absent: the rule book does
         * not state it; scored as `touch`.
         */
        scoring: z.enum(['touch', 'centre', 'outward']).optional(),
        /** Id of the federation whose rule book lists the event, where it is not the face's. */
        federation: recordId.optional(),
        /** Section of that federation's rule book that lists the event. */
        section: z.string().min(1).optional(),
        /** Kind of firearm the event is shot with, for example `rifle` or `service-pistol`. */
        category: disciplineCategory.optional(),
      }),
    )
    .min(1),
  /**
   * Paper size of the sheet the face is printed on, `width` and `height` as the sheet lies
   * upright.
   */
  paper: z
    .object({
      format: paperFormat.optional(),
      width: positiveLength(),
      height: positiveLength(),
    })
    .optional(),
  /**
   * Several scoring centres on one sheet: position of each centre from the sheet centre (x right,
   * y up), all with the rings of this record. Two scoring zones on one card are two entries with
   * a `zone` label each. Absent: one bull.
   */
  bulls: z
    .array(
      z.object({
        x: quantity('length'),
        y: quantity('length'),
        zone: z.string().min(1).optional(),
      }),
    )
    .min(1)
    .optional(),
  /** The ring values are printed on the face. */
  numerals: z.boolean().optional(),
  /**
   * `false`: the photo face search skips the face, the user picks it from the face list. Absent:
   * the face search tries it.
   */
  photoSearch: z.boolean().optional(),
  note: z.string().min(1).optional(),
  provenance,
})

type Issue = (path: PropertyKey[], message: string) => void

/** Ring values and diameters from outer to inner, the inner ten, and oval heights. */
function checkRings(f: z.infer<typeof targetFaceFields>, issue: Issue) {
  f.rings.forEach((r, i) => {
    const outer = f.rings[i - 1]
    if (!outer) return
    if (r.value !== outer.value + 1)
      issue(['rings', i, 'value'], 'must be one above the ring outside it')
    if (r.diameter.value >= outer.diameter.value)
      issue(['rings', i, 'diameter'], 'must be below the ring outside it')
  })
  const inner = f.rings.at(-1)
  if (f.innerTen && inner && f.innerTen.diameter.value > inner.diameter.value)
    issue(['innerTen', 'diameter'], 'must not exceed the innermost ring')
  const oval = f.rings.filter((r) => r.height).length
  f.rings.forEach((r, i) => {
    if (r.shape === 'square' && r.height) issue(['rings', i, 'height'], 'a square has no height')
  })
  if (oval > 0 && oval < f.rings.length) issue(['rings'], 'height on all rings or on none')
  checkStadium(f, issue)
  if (f.decimal && (oval > 0 || f.rings.some((r) => r.shape === 'square')))
    issue(['decimal'], 'tenth-ring values need circular rings')
  if (f.innerTen?.height && f.innerTen.rule === 'cover')
    issue(['innerTen', 'rule'], 'cover needs a circular inner ten')
  if (oval === 0 && (f.blackHeight || f.innerTen?.height))
    issue(['rings'], 'a height needs oval rings')
  f.rings.forEach((r, i) => {
    const outer = f.rings[i - 1]
    if (r.height && outer?.height && r.height.value >= outer.height.value)
      issue(['rings', i, 'height'], 'must be below the ring outside it')
  })
}

/** Stadium rings on all rings, each with its height, the inner ten a stadium too. */
function checkStadium(f: z.infer<typeof targetFaceFields>, issue: Issue) {
  const stadiums = f.rings.filter((r) => r.shape === 'stadium').length
  if (stadiums === 0) return
  if (stadiums < f.rings.length) issue(['rings'], 'stadium on all rings or on none')
  f.rings.forEach((r, i) => {
    if (r.shape !== 'stadium') return
    if (!r.height) issue(['rings', i, 'height'], 'a stadium needs a height')
    else if (r.height.value < r.diameter.value)
      issue(['rings', i, 'height'], 'a stadium is at least as high as it is wide')
  })
  const { innerTen } = f
  if (innerTen && !innerTen.height)
    issue(['innerTen', 'height'], 'a stadium inner ten needs a height')
  else if (innerTen?.height && innerTen.height.value < innerTen.diameter.value)
    issue(['innerTen', 'height'], 'a stadium is at least as high as it is wide')
  if (f.blackHeight && f.blackHeight.value < f.blackDiameter.value)
    issue(['blackHeight'], 'a stadium is at least as high as it is wide')
}

/** Event ids are unique within the face; outward gauging needs circular rings in whole rings. */
function checkEvents(f: z.infer<typeof targetFaceFields>, issue: Issue) {
  const seen = new Set<string>()
  const circular = f.rings.every((r) => !r.height && !r.shape)
  f.events.forEach((e, i) => {
    if (seen.has(e.id)) issue(['events', i, 'id'], 'must be unique within the face')
    seen.add(e.id)
    if (e.scoring !== 'outward') return
    if (!circular) issue(['events', i, 'scoring'], 'outward gauging needs circular rings')
    if (f.decimal) issue(['events', i, 'scoring'], 'outward gauging scores whole rings only')
  })
}

/** Black zones on adjacent rings, the outermost one as wide as `blackDiameter`. */
function checkBlack(f: z.infer<typeof targetFaceFields>, issue: Issue) {
  const fills = f.rings.map((r, i) => ({ r, i })).filter(({ r }) => r.fill === 'black')
  const outermost = fills[0]
  if (!outermost) return
  if (fills.some(({ i }, k) => i !== outermost.i + k))
    issue(['rings'], 'black zones must be adjacent rings')
  if (outermost.r.diameter.value !== f.blackDiameter.value)
    issue(['blackDiameter'], 'must equal the diameter of the outermost black ring')
}

/** Sheet size against its ISO A format, and every bull on the sheet. */
function checkSheet(f: z.infer<typeof targetFaceFields>, issue: Issue) {
  if (!f.paper) return
  const { format, width, height } = f.paper
  const size = format ? isoA[format] : undefined
  const short = Math.min(width.value, height.value)
  const long = Math.max(width.value, height.value)
  if (size && (Math.abs(short - size[0]) > 1 || Math.abs(long - size[1]) > 1))
    issue(['paper'], `must have the size of ${format}`)
  f.bulls?.forEach((b, i) => {
    if (Math.abs(b.x.value) > width.value / 2 || Math.abs(b.y.value) > height.value / 2)
      issue(['bulls', i], 'must lie on the sheet')
  })
}

/**
 * A printed target face as a rule book defines it: scoring rings (diameters to the outside edge of
 * the ring line), the inner ten, the aiming black and the events that use it with their scoring
 * gauge. Scoring: `apps/docs/docs/models/ring-scoring.md`.
 * Inferred type: {@link TargetFace}.
 */
export const targetFace = targetFaceFields.superRefine((f, ctx) => {
  const issue: Issue = (path, message) => ctx.addIssue({ code: 'custom', path, message })
  checkRings(f, issue)
  checkEvents(f, issue)
  checkBlack(f, issue)
  checkSheet(f, issue)
})

/** A printed target face record: ring diameters in mm, inner ten, events. */
export interface TargetFace extends z.infer<typeof targetFace> {}
