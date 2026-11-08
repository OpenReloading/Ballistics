/** Apart from `bullet-rows.ts`, so the pages that list designs through the site search load none of it. */
import { type Bullet, bulletListFields, toSi } from '@open-reloading/schema'
import { present } from './directory.ts'

/** Sectional density, mass over diameter squared, kg/m² (as `computedBulletRows`); undefined without both. */
export function bulletSectionalDensity(b: { mass: number | null; diameter: number | null }) {
  if (b.mass === null || b.diameter === null || b.diameter <= 0) return
  return toSi('mass', b.mass) / toSi('length', b.diameter) ** 2
}

/** As the API gives a catalogue item: the first G1 and G7, tip, base, construction and lead-free. */
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
