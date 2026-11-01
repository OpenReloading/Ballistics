/**
 * The list fields a bullet record gives a design's row, as the API's list item gives them, and the
 * sectional density of the SD column. Apart from `bullet-rows.ts`, so the bullet list hands it to
 * `userBulletRows` and the other pages that list designs (the site search of every page) load none of it.
 */
import { type Bullet, leadFree, toSi } from '@open-reloading/schema'
import { present } from './directory.ts'

/** Sectional density, mass over diameter squared, kg/m² (as `computedBulletRows`); undefined without both. */
export function bulletSectionalDensity(b: { mass: number | null; diameter: number | null }) {
  if (b.mass === null || b.diameter === null || b.diameter <= 0) return
  return toSi('mass', b.mass) / toSi('length', b.diameter) ** 2
}

/** The structure of a bullet's construction, else its core material as `<material>-core`: the list item's `construction`. */
function constructionKey(c: Bullet['construction']) {
  const material = c?.core?.material
  return c?.structure ?? (material ? `${material}-core` : undefined)
}

/** The record's first coefficient of drag model `model`, lb/in², as the list item gives it. */
const firstCoefficient = (b: Pick<Bullet, 'ballisticCoefficients'>, model: 'G1' | 'G7') =>
  b.ballisticCoefficients?.find((c) => c.dragModel === model)?.value ?? null

/**
 * The list fields a bullet record gives a design's row as the API gives a catalogue item: the
 * first G1 and G7, tip, base, construction and lead-free.
 */
export const bulletKinds = (
  b: Pick<Bullet, 'tip' | 'base' | 'construction' | 'ballisticCoefficients'>,
) => ({
  ballisticCoefficientG1: firstCoefficient(b, 'G1'),
  ballisticCoefficientG7: firstCoefficient(b, 'G7'),
  ...present({
    tipType: b.tip?.type ?? null,
    baseType: b.base?.type ?? null,
    construction: constructionKey(b.construction) ?? null,
    leadFree: leadFree(b.construction) ?? null,
  }),
})
