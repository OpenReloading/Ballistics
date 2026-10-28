import { bulletFits, type CartridgeDiameters } from '@open-reloading/core'
import { msg } from '../i18n/translate.ts'
import type { CartridgeSummary } from './api-types.ts'

/** The fit rule in words, the hover help of the cartridge lists of a bullet and the bullet lists of a cartridge. */
export const fitRule = msg(
  'A bullet fits a cartridge when its diameter is over the middle of the land and groove diameters F and Z and at most the projectile diameter G1, all of the CIP sheet (G1 to its printed 0.01 mm).',
)

/** A cartridge's CIP values the bullet fit reads, mm (a choice of the workbench or a list summary). */
type FitSource = { g1?: number | undefined; land?: number | undefined; groove?: number | undefined }

/** The fit values of a cartridge list summary. */
export const summaryFitSource = (c: CartridgeSummary): FitSource => ({
  g1: c.maxBulletDiameter,
  land: c.boreDiameter,
  groove: c.grooveDiameter,
})

/** The values of `bulletFits` of core, the rule of `GET /bullets?cartridge`; undefined when one is missing. */
export const fitOf = (c: FitSource | undefined): CartridgeDiameters | undefined =>
  c?.g1 !== undefined && c.land !== undefined && c.groove !== undefined
    ? { g1: c.g1, land: c.land, groove: c.groove }
    : undefined

/** The cartridges of `cartridges` a bullet of `diameter` (mm) fits by their CIP values, as id and name. */
export function fitsOf(diameter: number, cartridges: CartridgeSummary[]) {
  return cartridges.flatMap((c) => {
    const fit = fitOf(summaryFitSource(c))
    return fit !== undefined && bulletFits(diameter, fit) ? [{ id: c.id, name: c.name }] : []
  })
}
