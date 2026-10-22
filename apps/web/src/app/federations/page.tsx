import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FederationList } from '../../components/discipline-list.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import {
  getFederation,
  listDisciplines,
  listFederations,
  listTargetMappings,
} from '../../lib/api.ts'
import { federationRow } from '../../lib/disciplines.ts'
import { listTitles } from '../../lib/list-titles.ts'

export const metadata: Metadata = {
  title: 'Federations',
  description:
    'Shooting federations with their rule books and the disciplines and target faces read from them.',
}

async function Federations() {
  const [list, disciplines, mappings] = await Promise.all([
    listFederations(),
    listDisciplines(),
    listTargetMappings(),
  ])
  // the list leaves out the rule books: the records hold them
  const records =
    list.status === 'ok' ? await Promise.all(list.data.map(({ id }) => getFederation(id))) : []
  if (
    list.status !== 'ok' ||
    disciplines.status !== 'ok' ||
    mappings.status !== 'ok' ||
    records.some((r) => r.status !== 'ok')
  )
    return (
      <>
        <PageBar title={listTitles.federations} />
        <ServerDataError what="Federation" />
      </>
    )
  const rows = records.flatMap((r) =>
    r.status === 'ok' ? [federationRow(r.data, disciplines.data, mappings.data)] : [],
  )
  return <FederationList items={rows} />
}

export default function FederationsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.federations} />
          <ListLoading what="federations" />
        </>
      }
    >
      <Federations />
    </Suspense>
  )
}
