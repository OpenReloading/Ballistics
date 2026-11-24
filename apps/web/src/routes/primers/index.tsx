import { createFileRoute } from '@tanstack/react-router'
import { PrimerList } from '../../components/primer-list.tsx'
import { primerListData } from '../../lib/list-page-data.ts'
import { readCatalogue } from '../-data.ts'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/primers/')({
  validateSearch: searchOf(),
  loader: async () => {
    const c = await readCatalogue()
    return primerListData(c.primers().items, c.manufacturers().items)
  },
  head: () =>
    listHead(
      'Primers',
      'Primer products by manufacturer, with size, magnum flag, cup and priming compound, each with its sources.',
    ),
  component: PrimersPage,
})

function PrimersPage() {
  return <PrimerList {...Route.useLoaderData()} />
}
