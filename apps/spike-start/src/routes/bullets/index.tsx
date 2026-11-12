import { createFileRoute } from '@tanstack/react-router'
import { BulletList } from '../../../../web/src/components/bullet-list.tsx'
import type {
  BulletSummary,
  CartridgeSummary,
  ManufacturerSummary,
} from '../../../../web/src/lib/api-types.ts'
import { fitOf, summaryFitSource } from '../../../../web/src/lib/bullet-fit.ts'
import { packBullets } from '../../../../web/src/lib/bullet-list-data.ts'
import {
  manufacturerAliases,
  manufacturerNames,
  withManufacturerName,
} from '../../../../web/src/lib/manufacturers.ts'
import { catalogueIndex, items } from '../../data.ts'

export const Route = createFileRoute('/bullets/')({
  // as app/bullets/page.tsx builds the props from the API's lists
  loader: async () => {
    const index = await catalogueIndex()
    const bullets = items(index.bullets) as unknown as BulletSummary[]
    const manufacturers = items(index.manufacturers) as unknown as ManufacturerSummary[]
    const cartridges = (items(index.cartridges) as unknown as CartridgeSummary[]).flatMap((x) => {
      const fit = fitOf(summaryFitSource(x))
      return fit ? [{ id: x.id, name: x.name, fit }] : []
    })
    const rows = withManufacturerName(
      bullets,
      manufacturerNames(manufacturers),
      manufacturerAliases(manufacturers),
    )
    return { packed: packBullets(rows), cartridges }
  },
  component: BulletsPage,
})

function BulletsPage() {
  const { packed, cartridges } = Route.useLoaderData()
  return <BulletList packed={packed} cartridges={cartridges} />
}
