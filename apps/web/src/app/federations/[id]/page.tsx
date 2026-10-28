import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { FederationRecordPage } from '../../../components/federation-record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { getFederation, listFederations, staticIds } from '../../../lib/api.ts'
import { recordHeadText, recordMetadata } from '../../../lib/record-metadata.ts'

export function generateStaticParams() {
  return staticIds(listFederations, 'federation')
}

export async function generateMetadata(
  { params }: PageProps<'/federations/[id]'>,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const r = await getFederation(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const { title, description } = recordHeadText('federations', r.data)
  return recordMetadata(parent, title, description)
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function FederationPage({ params }: PageProps<'/federations/[id]'>) {
  const { id } = await params
  const r = await getFederation(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Federation" />
  return <FederationRecordPage id={id} name={r.data.name} />
}
