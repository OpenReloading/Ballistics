'use client'

import { compareTargetFaces, type TargetFace, type TargetMapping } from '@open-reloading/schema'
import Link from 'next/link'
import { localizeDecimals } from '../i18n/number.ts'
import {
  type CaliberClassSummary,
  courseRows,
  type DisciplineRecord,
  disciplineGroups,
  disciplineRuleBook,
  disciplineStrip,
  type FederationListItem,
} from '../lib/disciplines.ts'
import type { DisciplineSummary, MappingSummary } from '../lib/face-disciplines.ts'
import { readItems, readRecord } from '../lib/record-reads.ts'
import { FieldStrip } from './field-strip.tsx'
import { FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'
import { PanelTable } from './scroll-region.tsx'
import { shownLength } from './shown-length.tsx'
import { TargetFaceDrawing } from './target-face-drawing.tsx'

/** What the page reads besides the record: the stages with their faces, the other disciplines and federations, the caliber classes. */
interface Extras {
  mappings: TargetMapping[]
  faces: TargetFace[]
  disciplines: DisciplineSummary[]
  federations: FederationListItem[]
  classes: CaliberClassSummary[]
}

function DisciplineRecordView({
  d,
  mappings,
  faces,
  disciplines,
  federations,
  classes,
}: { d: DisciplineRecord } & Extras) {
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
  // two or more stages: each row opens its own; the page bar opens the first
  const perStage = stages.length > 1
  // the sighters, series and time limits a stage's rule book gives itself
  const courseOf = (m: TargetMapping) =>
    courseRows(m)
      .map((r) => `${r.label}: ${r.numeric ? localizeDecimals(r.text ?? '') : r.text}`)
      .join('; ')
  const hasCourse = stages.some((m) => courseOf(m) !== '')
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
                ...(hasCourse ? ['Course of fire'] : []),
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
                    {hasCourse && <td>{courseOf(m)}</td>}
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
            groups={disciplineGroups(d, classes)}
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
