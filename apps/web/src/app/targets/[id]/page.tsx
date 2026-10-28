import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FaceEvents, FaceStrip, FaceValuesPanel } from '../../../components/face-record.tsx'
import { Panel } from '../../../components/panel.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { TargetFaceDrawing } from '../../../components/target-face-drawing.tsx'
import { msg } from '../../../i18n/translate.ts'
import {
  getTargetFace,
  getTargetMapping,
  listAllTargetFaces,
  listDisciplines,
  listFederations,
  listTargetMappings,
  staticIds,
} from '../../../lib/api.ts'
import { withOrganization } from '../../../lib/face-organization.ts'
import { faceEventRows } from '../../../lib/target-faces.ts'

export function generateStaticParams() {
  return staticIds(listAllTargetFaces, 'target-face')
}

export async function generateMetadata({ params }: PageProps<'/targets/[id]'>): Promise<Metadata> {
  const { id } = await params
  const r = await getTargetFace(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  return {
    title: r.data.name,
    description: `Ring diameters, black area and the disciplines shot on ${r.data.name}, with sources.`,
  }
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function TargetFacePage({ params }: PageProps<'/targets/[id]'>) {
  const { id } = await params
  const r = await getTargetFace(id)
  if (r.status === 'notFound') notFound()
  const [listed, disciplines, federations] = await Promise.all([
    listTargetMappings(id),
    listDisciplines(),
    listFederations(),
  ])
  // the list leaves out the shot count: the records hold it
  const mappings =
    listed.status === 'ok' ? await Promise.all(listed.data.map((m) => getTargetMapping(m.id))) : []
  if (
    r.status !== 'ok' ||
    listed.status !== 'ok' ||
    disciplines.status !== 'ok' ||
    federations.status !== 'ok' ||
    mappings.some((m) => m.status !== 'ok')
  )
    return <ServerDataError what="Target face" />
  const f = withOrganization(r.data, federations.data)
  const rows = faceEventRows(
    f,
    mappings.flatMap((m) => (m.status === 'ok' ? [m.data] : [])),
    disciplines.data,
    federations.data,
  )
  // the sources are the page's own panel
  const { provenance: _, ...face } = f
  return (
    <RecordPage
      title={f.name}
      badges={[]}
      className="target-face-record"
      groups={`/groups?face=${encodeURIComponent(f.id)}`}
      provenance={f.provenance}
      strip={<FaceStrip face={face} />}
      figure={
        <Panel id="face-drawing" title={msg('Face')} translated>
          <TargetFaceDrawing face={f} />
        </Panel>
      }
      values={<FaceValuesPanel face={face} />}
      side={<FaceEvents rows={rows} />}
    />
  )
}
