import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { TargetFaceList } from '../../components/target-face-list.tsx'
import {
  getTargetFace,
  listAllTargetFaces,
  listDisciplines,
  listFederations,
  listTargetMappings,
} from '../../lib/api.ts'
import { withOrganization } from '../../lib/face-organization.ts'
import { listTitles } from '../../lib/list-titles.ts'
import { targetFaceRow } from '../../lib/target-faces.ts'

export const metadata: Metadata = {
  title: 'Targets',
  description:
    'Rule-book target faces with ring diameters, black area, distances and the disciplines shot on them, each with its sources.',
}

async function Targets() {
  const [list, mappings, federations, disciplines] = await Promise.all([
    listAllTargetFaces(),
    listTargetMappings(),
    listFederations(),
    listDisciplines(),
  ])
  const faces =
    list.status === 'ok' ? await Promise.all(list.data.map(({ id }) => getTargetFace(id))) : []
  if (
    list.status !== 'ok' ||
    mappings.status !== 'ok' ||
    federations.status !== 'ok' ||
    disciplines.status !== 'ok' ||
    faces.some((f) => f.status !== 'ok')
  )
    return (
      <>
        <PageBar title={listTitles.targets} />
        <ServerDataError what="Target face" />
      </>
    )
  const rows = faces.flatMap((f) =>
    f.status === 'ok'
      ? [targetFaceRow(withOrganization(f.data, federations.data), mappings.data)]
      : [],
  )
  return (
    <TargetFaceList
      items={rows}
      disciplines={disciplines.data.map(({ id, name, federation }) => ({
        id,
        name: `${federations.data.find((f) => f.id === federation)?.abbreviation ?? federation} ${name}`,
      }))}
    />
  )
}

export default function TargetsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.targets} />
          <ListLoading what="target faces" />
        </>
      }
    >
      <Targets />
    </Suspense>
  )
}
