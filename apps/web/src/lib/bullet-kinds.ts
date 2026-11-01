/**
 * The list fields a bullet record gives a design's row, as the API's list item gives them, and the
 * sectional density of the SD column. Apart from `bullet-rows.ts`, so the bullet list hands it to
 * `userBulletRows` and the other pages that list designs (the site search of every page) load none of it.
 */
import { type Bullet, bulletListFields, toSi } from '@open-reloading/schema'
import { present } from './directory.ts'

/** Sectional density, mass over diameter squared, kg/m² (as `computedBulletRows`); undefined without both. */
export function bulletSectionalDensity(b: { mass: number | null; diameter: number | null }) {
  if (b.mass === null || b.diameter === null || b.diameter <= 0) return
  return toSi('mass', b.mass) / toSi('length', b.diameter) ** 2
}

/**
 * The list fields a bullet record gives a design's row as the API gives a catalogue item: the
 * first G1 and G7, tip, base, construction and lead-free.
 */
export function bulletKinds(
  b: Pick<Bullet, 'tip' | 'base' | 'construction' | 'ballisticCoefficients'>,
) {
  const f = bulletListFields(b)
  return {
    ballisticCoefficientG1: f.ballisticCoefficientG1,
    ballisticCoefficientG7: f.ballisticCoefficientG7,
    ...present({
      tipType: f.tipType ?? null,
      baseType: f.baseType ?? null,
      construction: f.construction ?? null,
      leadFree: f.leadFree ?? null,
    }),
  }
}
