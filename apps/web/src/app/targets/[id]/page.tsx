import { toSi } from '@open-reloading/schema'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ByLengthUnit } from '../../../components/by-length-unit.tsx'
import { FieldStrip } from '../../../components/field-strip.tsx'
import { FieldTable } from '../../../components/field-table.tsx'
import { Panel } from '../../../components/panel.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { PanelTable } from '../../../components/scroll-region.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { TargetFaceDrawing } from '../../../components/target-face-drawing.tsx'
import {
  buildPlaceholderId,
  getTargetFace,
  getTargetMapping,
  listAllTargetFaces,
  listDisciplines,
  listFederations,
  listTargetMappings,
  staticIds,
} from '../../../lib/api.ts'
import { titleFromKebab } from '../../../lib/record-fields.ts'
import { faceEventRows, targetFaceGroups, targetFaceStrip } from '../../../lib/target-faces.ts'
import { presetUnits, withUnit } from '../../../lib/units.ts'

export function generateStaticParams() {
  return staticIds(listAllTargetFaces, 'target-face')
}

export async function generateMetadata({ params }: PageProps<'/targets/[id]'>): Promise<Metadata> {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
  const r = await getTargetFace(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  return {
    title: r.data.name,
    description: `Ring diameters, black area and the disciplines shot on ${r.data.name}, with sources.`,
  }
}

const scoredBy = { touch: 'Hole edge', centre: 'Hole centre' }

/** A length in mm in the Settings length unit, both laid out on the server. */
const shownLength = (mm: number) => (
  <ByLengthUnit
    mm={withUnit('length', presetUnits('metric-grams'), toSi('length', mm))}
    inch={withUnit('length', presetUnits('us'), toSi('length', mm))}
  />
)

// no Suspense above notFound(): a streamed response keeps status 200
export default async function TargetFacePage({ params }: PageProps<'/targets/[id]'>) {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
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
  const f = r.data
  const rows = faceEventRows(
    f,
    mappings.flatMap((m) => (m.status === 'ok' ? [m.data] : [])),
    disciplines.data,
    federations.data,
  )
  const categories = rows.some((e) => e.category)
  const scoring = rows.some((e) => e.scoring)
  return (
    <RecordPage
      title={f.name}
      badges={[]}
      className="target-face-record"
      groups={`/groups?face=${encodeURIComponent(f.id)}`}
      provenance={f.provenance}
      strip={<FieldStrip items={targetFaceStrip(f)} />}
      figure={
        <Panel id="face-drawing" title="Face">
          <TargetFaceDrawing face={f} />
        </Panel>
      }
      values={
        <Panel id="record-data" title="Rings">
          <FieldTable caption="Rings" labelledBy="record-data" groups={targetFaceGroups(f)} />
          {f.note && <p className="record-note">{f.note}</p>}
        </Panel>
      }
      side={
        <Panel id="face-events" title={`Events (${rows.length})`}>
          <PanelTable
            label="Events table"
            className="face-table"
            caption={
              <span className="visually-hidden">The events and disciplines shot on this face</span>
            }
            columns={[
              'Federation',
              'Number',
              'Discipline',
              'Stage',
              'Distance',
              'Gauge',
              'Shots',
              ...(categories ? ['Kind'] : []),
              ...(scoring ? ['Scoring'] : []),
              'Section',
            ]}
          >
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.federation}</td>
                <td>{d.number}</td>
                <th scope="row">
                  {d.disciplineId ? (
                    <Link href={`/disciplines/${d.disciplineId}`}>{d.discipline}</Link>
                  ) : (
                    d.discipline
                  )}
                </th>
                <td>{d.stage}</td>
                <td className="nowrap">{d.distance}</td>
                <td className="num">{d.gauge !== undefined && shownLength(d.gauge)}</td>
                <td className="num">{d.shotCount}</td>
                {categories && <td>{d.category && titleFromKebab(d.category)}</td>}
                {scoring && <td>{d.scoring ? scoredBy[d.scoring] : 'Not stated'}</td>}
                <td>{d.section}</td>
              </tr>
            ))}
          </PanelTable>
        </Panel>
      }
    />
  )
}
