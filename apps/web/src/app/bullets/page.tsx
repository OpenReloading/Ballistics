import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BulletList } from '../../components/bullet-list.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { listAllBullets, listAllCartridges, listManufacturers } from '../../lib/api.ts'
import { bulletListData } from '../../lib/list-page-data.ts'
import { listTitles } from '../../lib/list-titles.ts'

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
  return <BulletList {...bulletListData(r.data, c.status === 'ok' ? c.data : [], manufacturers)} />
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
