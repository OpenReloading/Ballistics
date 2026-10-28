import { compareTargetFaces } from '@open-reloading/schema'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  DisciplineData,
  DisciplineStages,
  DisciplineStrip,
} from '../../../components/discipline-record.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { TargetFaceDrawing } from '../../../components/target-face-drawing.tsx'
import {
  getDiscipline,
  getTargetFace,
  getTargetMapping,
  listCaliberClasses,
  listDisciplines,
  listFederations,
  listTargetMappings,
  staticIds,
} from '../../../lib/api.ts'
import { disciplineRuleBook } from '../../../lib/disciplines.ts'

export function generateStaticParams() {
  return staticIds(listDisciplines, 'discipline')
}

export async function generateMetadata({
  params,
}: PageProps<'/disciplines/[id]'>): Promise<Metadata> {
  const { id } = await params
  const r = await getDiscipline(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  return {
    title: r.data.name,
    description: `Distance, caliber classes and the target faces of ${r.data.name}, with its rule book.`,
  }
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function DisciplinePage({ params }: PageProps<'/disciplines/[id]'>) {
  const { id } = await params
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
  return (
    <RecordPage
      title={d.name}
      badges={[]}
      className="discipline-record"
      groups={first && groupsHref(first)}
      provenance={d.provenance}
      strip={
        <DisciplineStrip
          record={{ federation: d.federation, distance: d.distance, category: d.category }}
          federation={federation?.abbreviation}
        />
      }
      figure={
        <DisciplineStages
          rows={stages.map((m) => {
            const f = faceOf.get(m.face)
            return {
              id: m.id,
              face: m.face,
              faceName: f?.name ?? m.face,
              ...(f && { drawing: <TargetFaceDrawing face={f} /> }),
              event: f?.events.find((e) => e.id === m.event)?.name ?? m.event,
              stage: m.stage,
              gauge: m.gauge?.value,
              shotCount: m.shotCount,
              groupsHref: groupsHref(m),
            }
          })}
        />
      }
      values={
        <DisciplineData
          record={{
            number: d.number,
            section: d.section,
            page: d.page,
            caliberClasses: d.caliberClasses,
          }}
          classes={classes.data}
          federation={{ id: d.federation, name: federation?.name ?? d.federation }}
          book={
            book && {
              title: book.title,
              url: book.url,
              edition: book.edition,
              section: book.section,
              page: book.page,
            }
          }
          international={
            d.internationalDiscipline
              ? {
                  id: d.internationalDiscipline,
                  name: international?.name ?? d.internationalDiscipline,
                }
              : undefined
          }
        />
      }
    />
  )
}
