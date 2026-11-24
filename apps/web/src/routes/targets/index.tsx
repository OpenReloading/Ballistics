import type { TargetFace } from '@rangefoundry/schema'
import { createFileRoute } from '@tanstack/react-router'
import { TargetFaceList } from '../../components/target-face-list.tsx'
import type { FederationListItem } from '../../lib/disciplines.ts'
import type { DisciplineSummary, MappingSummary } from '../../lib/face-disciplines.ts'
import { targetListData } from '../../lib/list-page-data.ts'
import { readCatalogue, readRecords } from '../-data.ts'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/targets/')({
  validateSearch: searchOf(),
  // the loader reads one file per target face: a revisit keeps the first load
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  loader: async () => {
    const c = await readCatalogue()
    return targetListData(
      await readRecords<TargetFace>('target-faces', c.targetFaces().items),
      c.targetMappings().items as MappingSummary[],
      c.federations().items as FederationListItem[],
      c.disciplines().items as DisciplineSummary[],
    )
  },
  head: () =>
    listHead(
      'Targets',
      'Rule-book targets with ring diameters, black area, distances and the disciplines shot on them, each with its sources.',
    ),
  component: TargetsPage,
})

function TargetsPage() {
  return <TargetFaceList {...Route.useLoaderData()} />
}
