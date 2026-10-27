import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { CartridgeRecordPage } from '../../../components/cartridge-record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { getCartridge, listAllCartridges, staticIds } from '../../../lib/api.ts'
import { recordMetadata } from '../../../lib/record-metadata.ts'

export function generateStaticParams() {
  return staticIds(listAllCartridges, 'cartridge')
}

export async function generateMetadata(
  { params }: PageProps<'/cartridges/[id]'>,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const r = await getCartridge(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  return recordMetadata(
    parent,
    `${r.data.name} dimensions and pressures`,
    `CIP dimensions and maximum pressures of ${r.data.name}, with sources.`,
  )
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function CartridgePage({ params }: PageProps<'/cartridges/[id]'>) {
  const { id } = await params
  const r = await getCartridge(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Cartridge" />
  return <CartridgeRecordPage id={id} name={r.data.name} />
}
