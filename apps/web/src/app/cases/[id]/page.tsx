import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { CaseRecordPage } from '../../../components/case-record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { getCase, getManufacturerNames, listAllCases, staticIds } from '../../../lib/api.ts'
import { recordHeadText, recordMetadata } from '../../../lib/record-metadata.ts'

export function generateStaticParams() {
  return staticIds(listAllCases, 'case')
}

export async function generateMetadata(
  { params }: PageProps<'/cases/[id]'>,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const r = await getCase(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const { title, description } = recordHeadText('cases', r.data, await getManufacturerNames())
  return recordMetadata(parent, title, description)
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function CasePage({ params }: PageProps<'/cases/[id]'>) {
  const { id } = await params
  const r = await getCase(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Case" />
  const { title } = recordHeadText('cases', r.data, await getManufacturerNames())
  return <CaseRecordPage id={id} name={title} />
}
