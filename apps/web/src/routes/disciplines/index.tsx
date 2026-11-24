import { createFileRoute } from '@tanstack/react-router'
import { DisciplineList } from '../../components/discipline-list.tsx'
import type {
  CaliberClassSummary,
  DisciplineRecord,
  FederationListItem,
} from '../../lib/disciplines.ts'
import type { MappingSummary } from '../../lib/face-disciplines.ts'
import { disciplineListData } from '../../lib/list-page-data.ts'
import { readCatalogue, readRecords } from '../-data.ts'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/disciplines/')({
  validateSearch: searchOf(),
  // the loader reads one file per discipline: a revisit keeps the first load
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  loader: async () => {
    const c = await readCatalogue()
    return disciplineListData(
      await readRecords<DisciplineRecord>('disciplines', c.disciplines().items),
      c.federations().items as FederationListItem[],
      c.targetMappings().items as MappingSummary[],
      c.caliberClasses().items as CaliberClassSummary[],
      c.targetFaces().items,
    )
  },
  head: () =>
    listHead(
      'Disciplines',
      'Rule-book disciplines of the shooting federations with distance, category, caliber classes and the targets they are shot on, each with its sources.',
    ),
  component: DisciplinesPage,
})

function DisciplinesPage() {
  return <DisciplineList {...Route.useLoaderData()} />
}
