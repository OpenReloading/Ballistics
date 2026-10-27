/**
 * What the outline of a bullet photograph says about whether the photograph can be measured
 * (`apps/docs/docs/models/bullet-photo.md`): the bullet's width in pixels, its proportions and how
 * ragged its sides are. Plain sentences for the user; a photograph too poor to measure gets no
 * values rather than wrong ones. Pure: no React, DOM or Next.js, so it can run in a Web Worker.
 */
import { shankOf } from './bullet-photo-measure.ts'
import { edgeUncertainty, type Outline } from './bullet-photo-outline.ts'

/** What the outline allows: sentences about its quality, and the reason no value is given. */
export interface OutlineHints {
  hints: string[]
  /** Set when the photograph cannot be measured: no values are given then. */
  unusable?: string
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

/** The sentences the outline's size, proportions and raggedness give, and the reason it cannot be measured. */
export function outlineHints(o: Outline): OutlineHints {
  const width = widthOf(o)
  const ratio = o.length / Math.max(width, 1e-9)
  if (width < minWidthPx)
    return {
      hints: [],
      unusable: `The bullet is only ${Math.round(width)} px across in the photograph, too small to measure. Take the photograph closer, or crop it to the bullet, so that the bullet is at least ${goodWidthPx * 2} px across.`,
    }
  if (ratio < proportions[0] || ratio > proportions[1])
    return {
      hints: [],
      unusable: `The cut-out is ${ratio.toFixed(1)} times as long as it is wide, which is not the shape of a bullet seen from the side. Brush the bullet in and the rest out, or take the photograph again with the bullet alone on a plain background.`,
    }
  const hints: string[] = []
  if (width < goodWidthPx)
    hints.push(
      `The bullet is ${Math.round(width)} px across, so each value is known to about ${((100 * Math.SQRT2 * edgeUncertainty) / width).toFixed(1)} % at best. Take the photograph closer, or crop it to the bullet; at least ${goodWidthPx * 2} px across gives a more exact outline.`,
    )
  const s = shankOf(o)
  if (s.sigma > Math.max(raggedPx, raggedShare * width))
    hints.push(
      `The sides of the bullet are ragged (about ${s.sigma.toFixed(1)} px): a reflection, a shadow or noise in the photograph. Retake it in even, soft light, or brush the cut-out where it is wrong.`,
    )
  return { hints }
}
