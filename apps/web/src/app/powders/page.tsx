import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageBar } from '../../components/page-bar.tsx'
import { PowderList } from '../../components/powder-list.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { listAllPowders, listManufacturers } from '../../lib/api.ts'
import { powderListData } from '../../lib/list-page-data.ts'
import { listTitles } from '../../lib/list-titles.ts'

export const metadata: Metadata = {
  title: 'Powders',
  description:
    'Propellants with form, base and a burn-rate order from fitted model parameters; each powder page lists the recorded properties with their sources.',
}

async function Powders() {
  const [r, manufacturers] = await Promise.all([listAllPowders(), listManufacturers()])
  if (r.status !== 'ok')
    return (
      <>
        <PageBar title={listTitles.powders} translated />
        <ServerDataError what="Powder" />
      </>
    )
  return <PowderList {...powderListData(r.data, manufacturers)} />
}

export default function PowdersPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.powders} translated />
          <ListLoading what="powders" />
        </>
      }
    >
      <Powders />
    </Suspense>
  )
}
