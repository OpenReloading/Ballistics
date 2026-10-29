'use client'

import { compareTargetFaces, type TargetFace, type TargetMapping } from '@open-reloading/schema'
import { useTranslation } from '../i18n/language.ts'
import {
  type CaliberClassSummary,
  courseRows,
  type DisciplineRecord,
  disciplineRuleBook,
  type FederationListItem,
} from '../lib/disciplines.ts'
import type { DisciplineSummary, MappingSummary } from '../lib/face-disciplines.ts'
import { rowText } from '../lib/record-fields.ts'
import { readItems, readRecord } from '../lib/record-reads.ts'
import { say } from '../lib/wording.ts'
import { DisciplineData, DisciplineStages, DisciplineStrip } from './discipline-record.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'
import { TargetFaceDrawing } from './target-face-drawing.tsx'

/** What the page reads besides the record: the stages with their faces, the other disciplines and federations, the caliber classes. */
interface Extras {
  mappings: TargetMapping[]
  faces: TargetFace[]
  disciplines: DisciplineSummary[]
  federations: FederationListItem[]
  classes: CaliberClassSummary[]
}

/** The record page's content: re-rendered on a language change, which the stages' decimal marks follow. */
export function DisciplineRecordView({
  d,
  mappings,
  faces,
  disciplines,
  federations,
  classes,
}: { d: DisciplineRecord } & Extras) {
  const { t } = useTranslation()
  const federation = federations.find((f) => f.id === d.federation)
  const international = disciplines.find((x) => x.id === d.internationalDiscipline)
  const book = disciplineRuleBook(d)
  const faceOf = new Map(faces.map((f) => [f.id, f]))
  // by face in the default face order; the stages of one face keep the mappings' order
  const stages = mappings.toSorted((a, b) => {
    const x = faceOf.get(a.face)
    const y = faceOf.get(b.face)
    return x && y ? compareTargetFaces(x, y) : 0
  })
  const first = stages[0]
  const groupsHref = (m: { face: string; event: string }) =>
    `/groups?face=${encodeURIComponent(m.face)}&event=${encodeURIComponent(m.event)}`
  // the sighters, series and time limits a stage's rule book gives itself
  const courseOf = (m: TargetMapping) =>
    courseRows(m)
      .map((r) => `${say(t, r.label)}: ${rowText(r, t)}`)
      .join('; ')
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
              course: courseOf(m),
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
            rules: d.rules,
          }}
          classes={classes}
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

/** The discipline record page: the record from its data file, with the faces of its stages drawn in the browser. */
export function DisciplineRecordPage({ id, name }: { id: string; name: string }) {
  return (
    <RecordViewWith<DisciplineRecord, Extras>
      kind="disciplines"
      id={id}
      name={name}
      what="Discipline"
      extras={async (_, signal) => {
        const [listed, disciplines, federations, classes] = await Promise.all([
          readItems<MappingSummary>(`target-mappings?discipline=${encodeURIComponent(id)}`, signal),
          readItems<DisciplineSummary>('disciplines', signal),
          readItems<FederationListItem>('federations', signal),
          readItems<CaliberClassSummary>('caliber-classes', signal),
        ])
        // the list leaves out the shot count, and the stages draw their faces
        const [mappings, faces] = await Promise.all([
          Promise.all(
            listed.map((m) => readRecord<TargetMapping>('target-mappings', m.id, signal)),
          ),
          Promise.all(
            [...new Set(listed.map((m) => m.face))].map((f) =>
              readRecord<TargetFace>('target-faces', f, signal),
            ),
          ),
        ])
        return { mappings, faces, disciplines, federations, classes }
      }}
    >
      {(d, extras) => <DisciplineRecordView d={d} {...extras} />}
    </RecordViewWith>
  )
}
