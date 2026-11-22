import { z } from 'zod'

/** A marked shot hole: its center in photo px; `uncertain` when the labeler could not tell it from a tear or a print mark. */
export type LabelledHole = { x: number; y: number; uncertain: boolean }

/** One labeler's marks on one photo: `size` in px, `session` the shooting day and setup (a split keeps it in one set), `complete` when every hole is marked. */
export type LabelledPhoto = {
  sha256: string
  source: string
  license: string
  author: string
  session: string
  kind: string
  usable: boolean
  complete: boolean
  size: [number, number]
  visibleDiameterPx: number
  holes: LabelledHole[]
}

/** One labeler's photo set, the photos keyed by file name. */
export type LabelSet = { photos: Record<string, LabelledPhoto> }

const text = z.string().min(1)
const px = z.number().int().positive()

const photo = z
  .strictObject({
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    source: text,
    license: text,
    author: text,
    session: text,
    kind: text,
    usable: z.boolean(),
    complete: z.boolean(),
    size: z.tuple([px, px]),
    visibleDiameterPx: z.number().positive(),
    holes: z.array(z.strictObject({ x: z.number(), y: z.number(), uncertain: z.boolean() })),
  })
  .superRefine((p, ctx) => {
    const [width, height] = p.size
    p.holes.forEach((h, i) => {
      if (h.x < 0 || h.x > width || h.y < 0 || h.y > height)
        ctx.addIssue({ code: 'custom', message: 'hole outside the photo', path: ['holes', i] })
    })
  })

/** Schema of a label set file. */
export const labelSet: z.ZodType<LabelSet> = z.strictObject({ photos: z.record(z.string(), photo) })
