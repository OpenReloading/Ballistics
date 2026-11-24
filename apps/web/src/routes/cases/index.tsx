import { createFileRoute } from '@tanstack/react-router'
import { CaseList } from '../../components/case-list.tsx'
import type { CartridgeSummary, CaseSummary } from '../../lib/api-types.ts'
import { caseListData } from '../../lib/list-page-data.ts'
import { readCatalogue } from '../-data.ts'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/cases/')({
  validateSearch: searchOf(),
  loader: async () => {
    const c = await readCatalogue()
    return caseListData(
      c.cases().items as CaseSummary[],
      c.cartridges().items as CartridgeSummary[],
      c.manufacturers().items,
    )
  },
  head: () =>
    listHead(
      'Brass',
      'Brass by cartridge, with material, primer pocket, flash hole, mass and the water capacity the manufacturer states, each with its sources.',
    ),
  component: CasesPage,
})

function CasesPage() {
  return <CaseList {...Route.useLoaderData()} />
}
