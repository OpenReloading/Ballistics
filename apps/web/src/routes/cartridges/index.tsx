import { createFileRoute } from '@tanstack/react-router'
import { CartridgeList } from '../../components/cartridge-list.tsx'
import type { CartridgeSummary } from '../../lib/api-types.ts'
import { cartridgeListData } from '../../lib/list-page-data.ts'
import { readCatalogue } from '../-data.ts'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/cartridges/')({
  validateSearch: searchOf(),
  loader: async () =>
    cartridgeListData((await readCatalogue()).cartridges().items as CartridgeSummary[]),
  head: () =>
    listHead(
      'Cartridges',
      'CIP cartridge and chamber dimensions and maximum pressures, each with its source document.',
    ),
  component: CartridgesPage,
})

function CartridgesPage() {
  return <CartridgeList {...Route.useLoaderData()} />
}
