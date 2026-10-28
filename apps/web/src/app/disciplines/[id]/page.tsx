import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { DisciplineRecordPage } from '../../../components/discipline-record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { getDiscipline, listDisciplines, staticIds } from '../../../lib/api.ts'
import { recordHeadText, recordMetadata } from '../../../lib/record-metadata.ts'

export function generateStaticParams() {
  return staticIds(listDisciplines, 'discipline')
}

export async function generateMetadata(
  { params }: PageProps<'/disciplines/[id]'>,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const r = await getDiscipline(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const { title, description } = recordHeadText('disciplines', r.data)
  return recordMetadata(parent, title, description)
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function DisciplinePage({ params }: PageProps<'/disciplines/[id]'>) {
  const { id } = await params
  const r = await getDiscipline(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Discipline" />
  return <DisciplineRecordPage id={id} name={r.data.name} />
}
