/** Whether a photograph can be measured (`apps/docs/docs/models/bullet-photo.md`): one too poor gets no values rather than wrong ones. */
import { shankOf } from './bullet-photo-measure.ts'
import { edgeUncertainty, type Outline } from './bullet-photo-outline.ts'
import type { LinguiWording } from './wording.ts'

/** What the outline allows: sentences about its quality, and the reason no value is given. */
export interface OutlineHints {
  hints: LinguiWording[]
  /** Set when the photograph cannot be measured: no values are given then. */
  unusable?: LinguiWording
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
      unusable: /*i18n*/ {
        id: 'bulletPhoto.tooNarrow',
        message:
          'The bullet is only {width} px across, too small to measure. Take the photograph closer or crop it to the bullet, to at least {good} px across.',
        values: { width: Math.round(width), good: goodWidthPx * 2 },
      },
    }
  if (ratio < proportions[0] || ratio > proportions[1])
    return {
      hints: [],
      unusable: /*i18n*/ {
        id: 'bulletPhoto.notSideView',
        message:
          'The cut-out is {ratio, decimal} times as long as wide, not a bullet seen from the side. Brush the bullet in and the rest out, or retake the photograph with the bullet alone on a plain background.',
        values: { ratio: tenths(ratio) },
      },
    }
  const hints: LinguiWording[] = []
  if (width < goodWidthPx)
    hints.push(
      /*i18n*/ {
        id: 'bulletPhoto.fewPixels',
        message:
          'The bullet is {width} px across, so each value is known to about {percent, decimal} % at best. Take the photograph closer or crop it to the bullet; {good} px across or more is more exact.',
        values: {
          width: Math.round(width),
          percent: tenths((100 * Math.SQRT2 * edgeUncertainty) / width),
          good: goodWidthPx * 2,
        },
      },
    )
  if (o.typedOff !== undefined)
    hints.push(
      /*i18n*/ {
        id: 'bulletPhoto.offAxis',
        message:
          "The bullet's sides are not parallel to the typed axis direction: it is about {degrees, decimal} degrees off, or a shadow widens one side. Lengths and base may read wrong; clear the axis direction to detect it, or type it again.",
        values: { degrees: tenths(o.typedOff) },
      },
    )
  if (o.shadow)
    hints.push(
      o.shadow.removed
        ? /*i18n*/ {
            id: 'bulletPhoto.shadowMirrored',
            message:
              'A shadow beside the bullet widens one side of the cut-out: that side is left out and the other side, mirrored about the axis, is measured. Brush the shadow out or take the photograph in even light for a more exact outline.',
          }
        : /*i18n*/ {
            id: 'bulletPhoto.shadowWidens',
            message:
              'One side of the cut-out is wider than the other, as from a shadow beside the bullet: the diameter and every length may be off by more than their uncertainty. Brush the shadow out or take the photograph in even light.',
          },
    )
  const s = shankOf(o)
  if (s.sigma > Math.max(raggedPx, raggedShare * width))
    hints.push(
      /*i18n*/ {
        id: 'bulletPhoto.raggedSides',
        message:
          "The bullet's sides are ragged (about {sigma, decimal} px): a reflection, shadow or noise. Retake the photograph in even, soft light, or brush the cut-out where it is wrong.",
        values: { sigma: tenths(s.sigma) },
      },
    )
  return { hints }
}
