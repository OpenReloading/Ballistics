import { createFileRoute } from '@tanstack/react-router'
import { PowderList } from '../../components/powder-list.tsx'
import type { PowderSummary } from '../../lib/api-types.ts'
import { powderListData } from '../../lib/list-page-data.ts'
import { readCatalogue } from '../-data.ts'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/powders/')({
  validateSearch: searchOf(),
  loader: async () => {
    const c = await readCatalogue()
    return powderListData(c.powders().items as PowderSummary[], c.manufacturers().items)
  },
  head: () =>
    listHead(
      'Powders',
      'Propellants with form, base and a burn-rate order from fitted model parameters; each powder page lists the recorded properties with their sources.',
    ),
  component: PowdersPage,
})

function PowdersPage() {
  return <PowderList {...Route.useLoaderData()} />
}
