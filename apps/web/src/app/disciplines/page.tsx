import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DisciplineList } from '../../components/discipline-list.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import {
  getDiscipline,
  listCaliberClasses,
  listDisciplines,
  listFederations,
  listTargetMappings,
} from '../../lib/api.ts'
import { disciplineRow } from '../../lib/disciplines.ts'
import { listTitles } from '../../lib/list-titles.ts'

export const metadata: Metadata = {
  title: 'Disciplines',
  description:
    'Rule-book disciplines of the shooting federations with distance, category, caliber classes and the target faces they are shot on, each with its sources.',
}

async function Disciplines() {
  const [list, federations, mappings, classes] = await Promise.all([
    listDisciplines(),
    listFederations(),
    listTargetMappings(),
    listCaliberClasses(),
  ])
  // the list leaves out the caliber classes: the records hold them
  const records =
    list.status === 'ok' ? await Promise.all(list.data.map(({ id }) => getDiscipline(id))) : []
  if (
    list.status !== 'ok' ||
    federations.status !== 'ok' ||
    mappings.status !== 'ok' ||
    classes.status !== 'ok' ||
    records.some((r) => r.status !== 'ok')
  )
    return (
      <>
        <PageBar title={listTitles.disciplines} />
        <ServerDataError what="Discipline" />
      </>
    )
  const rows = records.flatMap((r) =>
    r.status === 'ok' ? [disciplineRow(r.data, federations.data, mappings.data, classes.data)] : [],
  )
  return <DisciplineList items={rows} />
}

export default function DisciplinesPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.disciplines} />
          <ListLoading what="disciplines" />
        </>
      }
    >
      <Disciplines />
    </Suspense>
  )
}
