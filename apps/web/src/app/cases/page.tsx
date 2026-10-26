import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CaseList } from '../../components/case-list.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { listAllCartridges, listAllCases, listManufacturers } from '../../lib/api.ts'
import { caseRows } from '../../lib/case-rows.ts'
import { listTitles } from '../../lib/list-titles.ts'
import { manufacturerAliases, manufacturerNames } from '../../lib/manufacturers.ts'

export const metadata: Metadata = {
  title: 'Cases',
  description:
    'Cartridge case products by cartridge, with material, primer pocket, flash hole, mass and the water capacity the manufacturer states, each with its sources.',
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
        <PageBar title={listTitles.cases} />
        <ServerDataError what="Case" />
      </>
    )
  const cartridgeNames = new Map(
    cartridges.status === 'ok' ? cartridges.data.map((c) => [c.id, c.name]) : [],
  )
  return (
    <CaseList
      rows={caseRows(
        r.data,
        manufacturerNames(manufacturers),
        manufacturerAliases(manufacturers),
        cartridgeNames,
      )}
    />
  )
}

export default function CasesPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.cases} />
          <ListLoading what="cases" />
        </>
      }
    >
      <Cases />
    </Suspense>
  )
}
