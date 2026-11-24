import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FederationList } from '../../components/discipline-list.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { listDisciplines, listFederations } from '../../lib/api.ts'
import { federationListData } from '../../lib/list-page-data.ts'
import { listTitles } from '../../lib/list-titles.ts'

export const metadata: Metadata = {
  title: 'Federations',
  description:
    'Shooting federations with their rule books and the disciplines and targets read from them.',
}

async function Federations() {
  const [list, disciplines] = await Promise.all([listFederations(), listDisciplines()])
  if (list.status !== 'ok' || disciplines.status !== 'ok')
    return (
      <>
        <PageBar title={listTitles.federations} translated />
        <ServerDataError what="Federation" />
      </>
    )
  return <FederationList {...federationListData(list.data, disciplines.data)} />
}

export default function FederationsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.federations} translated />
          <ListLoading what="federations" />
        </>
      }
    >
      <Federations />
    </Suspense>
  )
}
