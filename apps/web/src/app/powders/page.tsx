import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageBar } from '../../components/page-bar.tsx'
import { PowderList } from '../../components/powder-list.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { listAllPowders, listManufacturers } from '../../lib/api.ts'
import { orderPowders } from '../../lib/burn-rate.ts'
import { listTitles } from '../../lib/list-titles.ts'
import {
  manufacturerAliases,
  manufacturerNames,
  withManufacturerName,
} from '../../lib/manufacturers.ts'
import { packPowders } from '../../lib/powder-rows.ts'

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
  // ordered on the server: the page passes row values, not the burn laws
  const rows = withManufacturerName(
    r.data,
    manufacturerNames(manufacturers),
    manufacturerAliases(manufacturers),
  )
  return <PowderList packed={packPowders(orderPowders(rows))} />
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
