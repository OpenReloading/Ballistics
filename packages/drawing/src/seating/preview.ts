import type { Side } from '../cartridge/figures.ts'
import { cipProfile, type Profile } from '../cartridge/profile.ts'
import type { Drawn } from '../core/layout.ts'
import type { SpecValue } from '../core/types.ts'

/** A profile without dimensions, angles, radii and conventions: the outline and its edge lines only. */
const bare = (p: Profile): Profile => ({
  ...p,
  annotation: { dimensions: [], angles: [], radii: [], conventions: [], edges: p.annotation.edges },
})

/**
 * The cartridge (CIP maximum) and the chamber (CIP minimum) of a record for the preview: outlines
 * without dimensions, the chamber's last bore point run out to at least `tip` mm, so the bullet
 * stays inside the drawn bore. Missing values of either side are named.
 */
export function previewDrawn(
  values: SpecValue[],
  table: string | undefined,
  tip: number,
): Drawn<Side, Profile> | { missing: string[] } {
  const [cartridge, chamber] = (['cartridge', 'chamber'] as const).map((side) =>
    cipProfile(values, side, table),
  )
  const missing = [
    ...('missing' in cartridge ? cartridge.missing.map((m) => `cartridge ${m}`) : []),
    ...('missing' in chamber ? chamber.missing.map((m) => `chamber ${m}`) : []),
  ]
  if ('missing' in cartridge || 'missing' in chamber) return { missing }
  const points = [...chamber.points]
  const [r, z] = points[points.length - 1]
  points[points.length - 1] = [r, Math.max(z, tip)]
  return [
    { side: 'cartridge', p: bare(cartridge) },
    { side: 'chamber', p: bare({ ...chamber, points }) },
  ]
}
