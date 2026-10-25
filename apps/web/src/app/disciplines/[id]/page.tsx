import { compareTargetFaces, toSi } from '@openreloading/schema'
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
  getDiscipline,
  getTargetFace,
  getTargetMapping,
  listCaliberClasses,
  listDisciplines,
  listFederations,
  listTargetMappings,
  staticIds,
} from '../../../lib/api.ts'
import { disciplineGroups, disciplineRuleBook, disciplineStrip } from '../../../lib/disciplines.ts'
import { presetUnits, withUnit } from '../../../lib/units.ts'

export function generateStaticParams() {
  return staticIds(listDisciplines, 'discipline')
}

export async function generateMetadata({
  params,
}: PageProps<'/disciplines/[id]'>): Promise<Metadata> {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
  const r = await getDiscipline(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  return {
    title: r.data.name,
    description: `Distance, caliber classes and the target faces of ${r.data.name}, with its rule book.`,
  }
}

/** A length in mm in the Settings length unit, both laid out on the server. */
const shownLength = (mm: number) => (
  <ByLengthUnit
    mm={withUnit('length', presetUnits('metric-grams'), toSi('length', mm))}
    inch={withUnit('length', presetUnits('us'), toSi('length', mm))}
  />
)

// no Suspense above notFound(): a streamed response keeps status 200
export default async function DisciplinePage({ params }: PageProps<'/disciplines/[id]'>) {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
  const r = await getDiscipline(id)
  if (r.status === 'notFound') notFound()
  const [listed, disciplines, federations, classes] = await Promise.all([
    listTargetMappings(),
    listDisciplines(),
    listFederations(),
    listCaliberClasses(),
  ])
  const own = listed.status === 'ok' ? listed.data.filter((m) => m.discipline === id) : []
  // the list leaves out the shot count, and the stages draw their faces
  const [mappings, faces] = await Promise.all([
    Promise.all(own.map((m) => getTargetMapping(m.id))),
    Promise.all([...new Set(own.map((m) => m.face))].map((f) => getTargetFace(f))),
  ])
  if (
    r.status !== 'ok' ||
    listed.status !== 'ok' ||
    disciplines.status !== 'ok' ||
    federations.status !== 'ok' ||
    classes.status !== 'ok' ||
    [...mappings, ...faces].some((x) => x.status !== 'ok')
  )
    return <ServerDataError what="Discipline" />
  const d = r.data
  const federation = federations.data.find((f) => f.id === d.federation)
  const international = disciplines.data.find((x) => x.id === d.internationalDiscipline)
  const book = disciplineRuleBook(d)
  const faceOf = new Map(faces.flatMap((f) => (f.status === 'ok' ? [[f.data.id, f.data]] : [])))
  // by face in the default face order; the stages of one face keep the mappings' order
  const stages = mappings
    .flatMap((m) => (m.status === 'ok' ? [m.data] : []))
    .toSorted((a, b) => {
      const x = faceOf.get(a.face)
      const y = faceOf.get(b.face)
      return x && y ? compareTargetFaces(x, y) : 0
    })
  const first = stages[0]
  const groupsHref = (m: { face: string; event: string }) =>
    `/groups?face=${encodeURIComponent(m.face)}&event=${encodeURIComponent(m.event)}`
  // two or more stages: each row opens its own; the page bar opens the first
  const perStage = stages.length > 1
  return (
    <RecordPage
      title={d.name}
      badges={[]}
      className="discipline-record"
      groups={first && groupsHref(first)}
      provenance={d.provenance}
      strip={<FieldStrip items={disciplineStrip(d, federation?.abbreviation)} />}
      figure={
        <Panel id="discipline-stages" title={`Faces (${stages.length})`}>
          {stages.length === 0 ? (
            <p className="record-note">No target mapping names this discipline.</p>
          ) : (
            <PanelTable
              label="Faces table"
              className="face-table"
              caption={
                <span className="visually-hidden">The faces and stages of this discipline</span>
              }
              columns={[
                'Face',
                'Event',
                'Stage',
                'Gauge',
                'Shots',
                ...(perStage ? ['Shot groups'] : []),
              ]}
            >
              {stages.map((m) => {
                const f = faceOf.get(m.face)
                return (
                  <tr key={m.id}>
                    <th scope="row">
                      <Link href={`/targets/${m.face}`} className="stage-face">
                        {f && (
                          <span aria-hidden="true">
                            <TargetFaceDrawing face={f} />
                          </span>
                        )}
                        <span>{f?.name ?? m.face}</span>
                      </Link>
                    </th>
                    <td>{f?.events.find((e) => e.id === m.event)?.name ?? m.event}</td>
                    <td>{m.stage}</td>
                    <td className="num">{m.gauge && shownLength(m.gauge.value)}</td>
                    <td className="num">{m.shotCount}</td>
                    {perStage && (
                      <td>
                        <Link
                          href={groupsHref(m)}
                          aria-label={`Open ${m.stage ?? m.event} in shot groups`}
                        >
                          Open
                        </Link>
                      </td>
                    )}
                  </tr>
                )
              })}
            </PanelTable>
          )}
        </Panel>
      }
      values={
        <Panel id="record-data" title="Discipline">
          <FieldTable
            caption="Discipline"
            labelledBy="record-data"
            groups={disciplineGroups(d, classes.data)}
          />
          <dl className="record-links">
            <dt>Federation</dt>
            <dd>
              <Link href={`/federations/${d.federation}`}>{federation?.name ?? d.federation}</Link>
            </dd>
            {book && (
              <>
                <dt>Rule book</dt>
                <dd>
                  {book.url ? <a href={book.url}>{book.title}</a> : book.title}
                  {book.edition && !book.title.includes(book.edition) && `, ${book.edition}`}
                  {`, section ${book.section}, ${book.page}`}
                </dd>
              </>
            )}
            {d.internationalDiscipline && (
              <>
                <dt>International discipline</dt>
                <dd>
                  <Link href={`/disciplines/${d.internationalDiscipline}`}>
                    {international?.name ?? d.internationalDiscipline}
                  </Link>
                </dd>
              </>
            )}
          </dl>
        </Panel>
      }
    />
  )
}
