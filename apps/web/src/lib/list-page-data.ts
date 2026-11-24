/** The props of each list page from the records it reads, the same for the Next pages and the Start routes. */

import type { TargetFace } from '@rangefoundry/schema'
import type {
  BulletSummary,
  CartridgeSummary,
  CaseSummary,
  ManufacturerSummary,
  PowderSummary,
  PrimerSummary,
} from './api-types.ts'
import { fitOf, summaryFitSource } from './bullet-fit.ts'
import { packBullets } from './bullet-list-data.ts'
import { orderPowders } from './burn-rate.ts'
import { packCartridges } from './cartridge-rows.ts'
import { caseRows } from './case-rows.ts'
import {
  type CaliberClassSummary,
  type DisciplineRecord,
  disciplineRow,
  type FederationListItem,
  federationRow,
} from './disciplines.ts'
import type { DisciplineSummary, MappingSummary } from './face-disciplines.ts'
import { withOrganization } from './face-organization.ts'
import { manufacturerAliases, manufacturerNames, withManufacturerName } from './manufacturers.ts'
import { packPowders } from './powder-rows.ts'
import { primerRows } from './primer-rows.ts'
import { targetFaceRow } from './target-faces.ts'

export function bulletListData(
  bullets: BulletSummary[],
  cartridges: CartridgeSummary[],
  manufacturers: ManufacturerSummary[],
) {
  // the list renders its own page bar, the count in its status line; these are the cartridges of the "Fits cartridge" filter, without which the list has no such filter
  const fits = cartridges.flatMap((x) => {
    const fit = fitOf(summaryFitSource(x))
    return fit ? [{ id: x.id, name: x.name, fit }] : []
  })
  const rows = withManufacturerName(
    bullets,
    manufacturerNames(manufacturers),
    manufacturerAliases(manufacturers),
  )
  return { packed: packBullets(rows), cartridges: fits }
}

// the list renders its own page bar: the count sits in the bar's status line
export const cartridgeListData = (cartridges: CartridgeSummary[]) => ({
  packed: packCartridges(cartridges),
})

export function caseListData(
  cases: CaseSummary[],
  cartridges: CartridgeSummary[],
  manufacturers: ManufacturerSummary[],
) {
  const cartridgeNames = new Map(cartridges.map((c) => [c.id, c.name]))
  return {
    rows: caseRows(
      cases,
      manufacturerNames(manufacturers),
      manufacturerAliases(manufacturers),
      cartridgeNames,
    ),
    cartridgeNames: Object.fromEntries(cartridgeNames),
  }
}

// the list leaves out the caliber classes: the records hold them
export const disciplineListData = (
  records: DisciplineRecord[],
  federations: FederationListItem[],
  mappings: MappingSummary[],
  classes: CaliberClassSummary[],
  faces: readonly { id: string; name: string }[],
) => ({
  items: records.map((r) => disciplineRow(r, federations, mappings, classes)),
  faces: faces.map(({ id, name }) => ({ id, name })),
})

export const federationListData = (
  federations: FederationListItem[],
  disciplines: DisciplineSummary[],
) => ({ items: federations.map((f) => federationRow(f, disciplines)) })

// ordered on the server: the page passes row values, not the burn laws
export const powderListData = (powders: PowderSummary[], manufacturers: ManufacturerSummary[]) => ({
  packed: packPowders(
    orderPowders(
      withManufacturerName(
        powders,
        manufacturerNames(manufacturers),
        manufacturerAliases(manufacturers),
      ),
    ),
  ),
})

export const primerListData = (primers: PrimerSummary[], manufacturers: ManufacturerSummary[]) => ({
  rows: primerRows(primers, manufacturerNames(manufacturers), manufacturerAliases(manufacturers)),
})

export const targetListData = (
  faces: TargetFace[],
  mappings: MappingSummary[],
  federations: FederationListItem[],
  disciplines: DisciplineSummary[],
) => ({
  items: faces.map((f) => targetFaceRow(withOrganization(f, federations), mappings)),
  disciplines: disciplines.map(({ id, name, federation }) => ({
    id,
    name: `${federations.find((f) => f.id === federation)?.abbreviation ?? federation} ${name}`,
  })),
})
