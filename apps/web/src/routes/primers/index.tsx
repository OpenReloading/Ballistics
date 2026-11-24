import { createFileRoute } from '@tanstack/react-router'
import { PrimerList } from '../../components/primer-list.tsx'
import { primerListData } from '../../lib/list-page-data.ts'
import { readCatalogue } from '../-data.ts'
import { listHead, listSearch } from '../-list-route.ts'

export const Route = createFileRoute('/primers/')({
  validateSearch: listSearch,
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
