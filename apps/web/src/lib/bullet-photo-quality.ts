/**
 * What the outline of a bullet photograph says about whether the photograph can be measured
 * (`apps/docs/docs/models/bullet-photo.md`): the bullet's width in pixels, its proportions, a
 * shadow on one side, a typed axis off the bullet's and how ragged its sides are. Plain sentences
 * for the user; a photograph too poor to measure gets no values rather than wrong ones. Pure: no
 * React, DOM or Next.js, so it can run in a Web Worker.
 */
import { msg } from '../i18n/translate.ts'
import { shankOf } from './bullet-photo-measure.ts'
import { edgeUncertainty, type Outline } from './bullet-photo-outline.ts'
import { type Wording, worded } from './wording.ts'

/** What the outline allows: sentences about its quality, and the reason no value is given. */
export interface OutlineHints {
  hints: Wording[]
  /** Set when the photograph cannot be measured: no values are given then. */
  unusable?: Wording
}

/** The bullet is narrower than this, px, and it is not measured: the nose circle and the boat tail cone have too few samples. */
export const minWidthPx = 16

/** The bullet is narrower than this, px, and its diameter is known to 1 % or worse. */
const goodWidthPx = 40

/** A bullet is between these multiples of its diameter long. */
const proportions = [1, 10] as const

/** The sides of the shank scatter by more than this many px, or this share of the width, and the outline is called ragged. */
const raggedPx = 1.5
const raggedShare = 0.02

/** The width of the bullet in px: twice the half width that 95 % of the samples stay within. */
const widthOf = (o: Outline) =>
  2 * ([...o.r].sort((a, b) => a - b)[Math.floor(0.95 * (o.r.length - 1))] ?? 0)

/** A value to one decimal, for a sentence. */
const tenths = (x: number) => Math.round(10 * x) / 10

/** The sentences the outline's size, proportions, shadow and raggedness give, and the reason it cannot be measured. */
export function outlineHints(o: Outline): OutlineHints {
  const width = widthOf(o)
  const ratio = o.length / Math.max(width, 1e-9)
  if (width < minWidthPx)
    return {
      hints: [],
      unusable: worded(
        msg(
          'The bullet is only {width} px across in the photograph, too small to measure. Take the photograph closer, or crop it to the bullet, so that the bullet is at least {good} px across.',
        ),
        { width: Math.round(width), good: goodWidthPx * 2 },
      ),
    }
  if (ratio < proportions[0] || ratio > proportions[1])
    return {
      hints: [],
      unusable: worded(
        msg(
          'The cut-out is {ratio} times as long as it is wide, which is not the shape of a bullet seen from the side. Brush the bullet in and the rest out, or take the photograph again with the bullet alone on a plain background.',
        ),
        { ratio: tenths(ratio) },
      ),
    }
  const hints: Wording[] = []
  if (width < goodWidthPx)
    hints.push(
      worded(
        msg(
          'The bullet is {width} px across, so each value is known to about {percent} % at best. Take the photograph closer, or crop it to the bullet; at least {good} px across gives a more exact outline.',
        ),
        {
          width: Math.round(width),
          percent: tenths((100 * Math.SQRT2 * edgeUncertainty) / width),
          good: goodWidthPx * 2,
        },
      ),
    )
  if (o.typedOff !== undefined)
    hints.push(
      worded(
        msg(
          "The bullet's sides are not parallel to the axis direction typed: it is about {degrees} degrees off the bullet's own axis, or a shadow beside the bullet widens one side. The lengths and the base may read wrong; clear the axis direction to let the tool find it, or type it again.",
        ),
        { degrees: tenths(o.typedOff) },
      ),
    )
  if (o.shadow)
    hints.push(
      o.shadow.removed
        ? msg(
            'A shadow beside the bullet widens one side of the cut-out: that side is left out and the other side, mirrored about the axis, is measured. Brush the shadow out of the cut-out, or take the photograph in even light, for a more exact outline.',
          )
        : msg(
            'One side of the cut-out is wider than the other, as a shadow beside the bullet makes it: the diameter and every length may be off by more than their uncertainty. Brush the shadow out of the cut-out, or take the photograph in even light.',
          ),
    )
  const s = shankOf(o)
  if (s.sigma > Math.max(raggedPx, raggedShare * width))
    hints.push(
      worded(
        msg(
          'The sides of the bullet are ragged (about {sigma} px): a reflection, a shadow or noise in the photograph. Retake it in even, soft light, or brush the cut-out where it is wrong.',
        ),
        { sigma: tenths(s.sigma) },
      ),
    )
  return { hints }
}
