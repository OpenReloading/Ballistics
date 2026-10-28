import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { PowderRecordPage } from '../../../components/powder-record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { getManufacturerNames, getPowder, listAllPowders, staticIds } from '../../../lib/api.ts'
import { recordHeadText, recordMetadata } from '../../../lib/record-metadata.ts'

export function generateStaticParams() {
  return staticIds(listAllPowders, 'powder')
}

export async function generateMetadata(
  { params }: PageProps<'/powders/[id]'>,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const r = await getPowder(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const { title, description } = recordHeadText('powders', r.data, await getManufacturerNames())
  return recordMetadata(parent, title, description)
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function PowderPage({ params }: PageProps<'/powders/[id]'>) {
  const { id } = await params
  const r = await getPowder(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Powder" />
  const { title } = recordHeadText('powders', r.data, await getManufacturerNames())
  return <PowderRecordPage id={id} name={title} />
}
