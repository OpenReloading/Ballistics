import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BulletList } from '../../components/bullet-list.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { listAllBullets, listAllCartridges, listManufacturers } from '../../lib/api.ts'
import { fitOf, summaryFitSource } from '../../lib/bullet-fit.ts'
import { packBullets } from '../../lib/bullet-rows.ts'
import { listTitles } from '../../lib/list-titles.ts'
import {
  manufacturerAliases,
  manufacturerNames,
  withManufacturerName,
} from '../../lib/manufacturers.ts'

export const metadata: Metadata = {
  title: 'Bullets',
  description: 'Bullet diameters, masses, lengths and ballistic coefficients each with its source.',
}

async function Bullets() {
  const [r, c, manufacturers] = await Promise.all([
    listAllBullets(),
    listAllCartridges(),
    listManufacturers(),
  ])
  if (r.status !== 'ok')
    return (
      <>
        <PageBar title={listTitles.bullets} translated />
        <ServerDataError what="Bullet" />
      </>
    )
  // the list renders its own page bar: the count sits in the bar's status line
  // the cartridges of the "Fits cartridge" filter; without them the list has no such filter
  const cartridges = (c.status === 'ok' ? c.data : []).flatMap((x) => {
    const fit = fitOf(summaryFitSource(x))
    return fit ? [{ id: x.id, name: x.name, fit }] : []
  })
  const rows = withManufacturerName(
    r.data,
    manufacturerNames(manufacturers),
    manufacturerAliases(manufacturers),
  )
  return <BulletList packed={packBullets(rows)} cartridges={cartridges} />
}

export default function BulletsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.bullets} translated />
          <ListLoading what="bullets" />
        </>
      }
    >
      <Bullets />
    </Suspense>
  )
}
