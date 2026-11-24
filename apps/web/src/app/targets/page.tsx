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
import { targetListData } from '../../lib/list-page-data.ts'
import { listTitles } from '../../lib/list-titles.ts'

export const metadata: Metadata = {
  title: 'Targets',
  description:
    'Rule-book targets with ring diameters, black area, distances and the disciplines shot on them, each with its sources.',
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
        <PageBar title={listTitles.targets} translated />
        <ServerDataError what="Target face" />
      </>
    )
  const data = faces.flatMap((f) => (f.status === 'ok' ? [f.data] : []))
  return (
    <TargetFaceList {...targetListData(data, mappings.data, federations.data, disciplines.data)} />
  )
}

export default function TargetsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.targets} translated />
          <ListLoading what="target faces" />
        </>
      }
    >
      <Targets />
    </Suspense>
  )
}
