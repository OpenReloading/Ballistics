import { createFileRoute } from '@tanstack/react-router'
import { BulletList } from '../../components/bullet-list.tsx'
import type { BulletSummary, CartridgeSummary } from '../../lib/api-types.ts'
import { bulletListData } from '../../lib/list-page-data.ts'
import { readCatalogue } from '../-data.ts'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/bullets/')({
  validateSearch: searchOf(),
  loader: async () => {
    const c = await readCatalogue()
    return bulletListData(
      c.bullets().items as BulletSummary[],
      c.cartridges().items as CartridgeSummary[],
      c.manufacturers().items,
    )
  },
  head: () =>
    listHead(
      'Bullets',
      'Bullet diameters, masses, lengths and ballistic coefficients each with its source.',
    ),
  component: BulletsPage,
})

function BulletsPage() {
  return <BulletList {...Route.useLoaderData()} />
}
