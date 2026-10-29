/**
 * The scale of a bullet photograph when the user also gives sizes measured with a caliper: the
 * diameter and the overall length of the bullet give a scale where the photograph has no ruler, and
 * check the ruler's scale (or each other) where it has (`apps/docs/docs/models/bullet-photo.md`).
 * Pure: no React, DOM or Next.js, so it can run in a Web Worker.
 */
import { msg } from '../i18n/translate.ts'
import type { Scale } from './bullet-photo.ts'
import type { BulletMeasurement } from './bullet-photo-measure.ts'
import { type Wording, worded } from './wording.ts'

/** Sizes of the bullet read off a caliper, mm. */
export interface Known {
  diameter?: number | undefined
  length?: number | undefined
}

/** Standard uncertainty of a caliper reading of a bullet, mm: the caliper's resolution and where on the bullet it was set. */
const caliperUncertainty = 0.02

type Key = 'diameter' | 'length'

/** A scale one known size gives: the size in the photograph in px over the size entered, and its relative uncertainty. */
interface Estimate {
  key: Key
  ppm: number
  rel: number
}

/** The scale of each known size that the photograph measures, from `px` (a measurement at 1 px per mm). */
function estimatesOf(px: BulletMeasurement, known: Known): Estimate[] {
  return (['diameter', 'length'] as const).flatMap((key): Estimate[] => {
    const [mm, v] = [known[key], px.values[key]]
    if (!(mm !== undefined && mm > 0 && v && v.value > 0)) return []
    return [
      {
        key,
        ppm: v.value / mm,
        rel: Math.hypot(v.uncertainty / v.value, caliperUncertainty / mm),
      },
    ]
  })
}

/**
 * The scale of several estimates: the mean weighted by the inverse square of the relative
 * uncertainty, with half of the spread between them, as a rectangular distribution, joining the
 * weighted mean's uncertainty in quadrature.
 */
function combined(es: readonly Estimate[]): Scale {
  const weights = es.map((e) => 1 / e.rel ** 2)
  const total = weights.reduce((a, w) => a + w, 0)
  const mean = es.reduce((a, e, i) => a + (weights[i] ?? 0) * e.ppm, 0) / total
  const half = (Math.max(...es.map((e) => e.ppm)) - Math.min(...es.map((e) => e.ppm))) / 2
  return {
    pxPerMm: mean,
    relUncertainty: Math.hypot(Math.sqrt(1 / total), half / Math.sqrt(3) / mean),
  }
}

/** True when two scales differ by more than three standard uncertainties and 2 %. */
function apart(a: { ppm: number; rel: number }, b: { ppm: number; rel: number }): boolean {
  const away = Math.abs(a.ppm - b.ppm)
  return away > 3 * Math.hypot(a.rel * a.ppm, b.rel * b.ppm) && away > 0.02 * Math.min(a.ppm, b.ppm)
}

/** How far apart two scales are, %, to one decimal. */
const percent = (from: number, to: number) => Number((100 * Math.abs(from / to - 1)).toFixed(1))

/** The note for a known size whose scale is away from the ruler's. */
const againstRuler = (e: Estimate, ruler: { ppm: number }) =>
  worded(
    e.key === 'diameter'
      ? msg(
          "The diameter in the photograph is {percent} % away from the diameter entered at the ruler's scale. Check the scale points and the cut-out, and that the bullet lies flat and square to the camera.",
        )
      : msg(
          "The overall length in the photograph is {percent} % away from the overall length entered at the ruler's scale. Check the scale points and the cut-out, and that the bullet lies flat and square to the camera.",
        ),
    { percent: percent(e.ppm, ruler.ppm) },
  )

/** The note for two known sizes that give scales apart. */
const againstEach = (a: Estimate, b: Estimate) =>
  worded(
    msg(
      'The diameter and the overall length entered give scales {percent} % apart. Check the scale points and the cut-out, and that the bullet lies flat and square to the camera. The scale used is their weighted mean, with the difference in its uncertainty.',
    ),
    { percent: percent(a.ppm, b.ppm) },
  )

/**
 * The scale to measure with and what to tell the user. `px` is the photograph's measurement at 1 px
 * per mm, `ruler` the scale of the placed ruler points. The ruler's scale is used when there is
 * one, and each known size is checked against it. Without a ruler the known sizes give the scale
 * (combined when there are two, which are checked against each other). Undefined when nothing
 * gives a scale.
 */
export function resolveScale(
  px: BulletMeasurement,
  ruler: Scale | undefined,
  known: Known,
): { scale: Scale | undefined; notes: Wording[] } {
  const es = estimatesOf(px, known)
  if (ruler) {
    const against = { ppm: ruler.pxPerMm, rel: ruler.relUncertainty }
    return {
      scale: ruler,
      notes: es.filter((e) => apart(e, against)).map((e) => againstRuler(e, against)),
    }
  }
  if (es.length === 0) return { scale: undefined, notes: [] }
  const [a, b] = es
  return {
    scale: combined(es),
    notes: a && b && apart(a, b) ? [againstEach(a, b)] : [],
  }
}
