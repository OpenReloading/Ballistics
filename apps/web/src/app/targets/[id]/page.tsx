import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { ServerDataError } from '../../../components/states.tsx'
import { TargetFaceRecordPage } from '../../../components/target-face-record-page.tsx'
import { getTargetFace, listAllTargetFaces, staticIds } from '../../../lib/api.ts'
import { recordHeadText, recordMetadata } from '../../../lib/record-metadata.ts'

export function generateStaticParams() {
  return staticIds(listAllTargetFaces, 'target-face')
}

export async function generateMetadata(
  { params }: PageProps<'/targets/[id]'>,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const r = await getTargetFace(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const { title, description } = recordHeadText('target-faces', r.data)
  return recordMetadata(parent, title, description)
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function TargetFacePage({ params }: PageProps<'/targets/[id]'>) {
  const { id } = await params
  const r = await getTargetFace(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Target face" />
  return <TargetFaceRecordPage id={id} name={r.data.name} />
}
