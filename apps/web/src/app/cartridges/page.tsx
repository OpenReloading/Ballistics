import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CartridgeList } from '../../components/cartridge-list.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { listAllCartridges } from '../../lib/api.ts'
import { packCartridges } from '../../lib/cartridge-rows.ts'
import { listTitles } from '../../lib/list-titles.ts'

export const metadata: Metadata = {
  title: 'Cartridges',
  description:
    'CIP cartridge and chamber dimensions and maximum pressures, each with its source document.',
}

async function Cartridges() {
  const r = await listAllCartridges()
  if (r.status !== 'ok')
    return (
      <>
        <PageBar title={listTitles.cartridges} translated />
        <ServerDataError what="Cartridge" />
      </>
    )
  // the list renders its own page bar: the count sits in the bar's status line
  return <CartridgeList packed={packCartridges(r.data)} />
}

export default function CartridgesPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={listTitles.cartridges} translated />
          <ListLoading what="cartridges" />
        </>
      }
    >
      <Cartridges />
    </Suspense>
  )
}
