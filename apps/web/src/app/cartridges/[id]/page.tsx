import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { CartridgeRecordPage } from '../../../components/cartridge-record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { getCartridge, listAllCartridges, staticIds } from '../../../lib/api.ts'
import { cartridgeHeadText, recordMetadata } from '../../../lib/record-metadata.ts'

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
  const { title, description } = cartridgeHeadText(r.data.name)
  return recordMetadata(parent, title, description)
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function CartridgePage({ params }: PageProps<'/cartridges/[id]'>) {
  const { id } = await params
  const r = await getCartridge(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Cartridge" />
  return <CartridgeRecordPage id={id} name={r.data.name} />
}
