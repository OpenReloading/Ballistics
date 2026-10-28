import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { PrimerRecordPage } from '../../../components/primer-record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { getManufacturerNames, getPrimer, listAllPrimers, staticIds } from '../../../lib/api.ts'
import { recordHeadText, recordMetadata } from '../../../lib/record-metadata.ts'

export function generateStaticParams() {
  return staticIds(listAllPrimers, 'primer')
}

export async function generateMetadata(
  { params }: PageProps<'/primers/[id]'>,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const r = await getPrimer(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const { title, description } = recordHeadText('primers', r.data, await getManufacturerNames())
  return recordMetadata(parent, title, description)
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function PrimerPage({ params }: PageProps<'/primers/[id]'>) {
  const { id } = await params
  const r = await getPrimer(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Primer" />
  const { title } = recordHeadText('primers', r.data, await getManufacturerNames())
  return <PrimerRecordPage id={id} name={title} />
}
