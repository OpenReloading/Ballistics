import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageBar } from '../../components/page-bar.tsx'
import { PrimerList } from '../../components/primer-list.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { listAllPrimers, listManufacturers } from '../../lib/api.ts'
import { listTitles } from '../../lib/list-titles.ts'
import { manufacturerAliases, manufacturerNames } from '../../lib/manufacturers.ts'
import { primerRows } from '../../lib/primer-rows.ts'

export const metadata: Metadata = {
  title: 'Primers',
  description:
    'Primer products by manufacturer, with size, magnum flag, cup and priming compound, each with its sources.',
}

async function Primers() {
  const [r, manufacturers] = await Promise.all([listAllPrimers(), listManufacturers()])
  if (r.status !== 'ok')
    return (
      <>
        <PageBar title={listTitles.primers} translated />
        <ServerDataError what="Primer" />
      </>
    )
  return (
    <PrimerList
      rows={primerRows(
        r.data,
        manufacturerNames(manufacturers),
        manufacturerAliases(manufacturers),
      )}
    />
  )
}

export default function PrimersPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.primers} translated />
          <ListLoading what="primers" />
        </>
      }
    >
      <Primers />
    </Suspense>
  )
}
