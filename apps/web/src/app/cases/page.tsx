import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CaseList } from '../../components/case-list.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { listAllCartridges, listAllCases, listManufacturers } from '../../lib/api.ts'
import { caseListData } from '../../lib/list-page-data.ts'
import { listTitles } from '../../lib/list-titles.ts'

export const metadata: Metadata = {
  title: 'Brass',
  description:
    'Brass by cartridge, with material, primer pocket, flash hole, mass and the water capacity the manufacturer states, each with its sources.',
}

async function Cases() {
  const [r, cartridges, manufacturers] = await Promise.all([
    listAllCases(),
    listAllCartridges(),
    listManufacturers(),
  ])
  if (r.status !== 'ok')
    return (
      <>
        <PageBar title={listTitles.cases} translated />
        <ServerDataError what="Case" />
      </>
    )
  return (
    <CaseList
      {...caseListData(r.data, cartridges.status === 'ok' ? cartridges.data : [], manufacturers)}
    />
  )
}

export default function CasesPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.cases} translated />
          <ListLoading what="cases" />
        </>
      }
    >
      <Cases />
    </Suspense>
  )
}
