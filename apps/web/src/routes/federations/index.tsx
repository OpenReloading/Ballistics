import { createFileRoute } from '@tanstack/react-router'
import { FederationList } from '../../components/discipline-list.tsx'
import type { FederationListItem } from '../../lib/disciplines.ts'
import type { DisciplineSummary } from '../../lib/face-disciplines.ts'
import { federationListData } from '../../lib/list-page-data.ts'
import { readCatalogue } from '../-data.ts'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/federations/')({
  validateSearch: searchOf(),
  loader: async () => {
    const c = await readCatalogue()
    return federationListData(
      c.federations().items as FederationListItem[],
      c.disciplines().items as DisciplineSummary[],
    )
  },
  head: () =>
    listHead(
      'Federations',
      'Shooting federations with their rule books and the disciplines and targets read from them.',
    ),
  component: FederationsPage,
})

function FederationsPage() {
  return <FederationList {...Route.useLoaderData()} />
}
