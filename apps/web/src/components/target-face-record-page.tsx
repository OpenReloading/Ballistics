'use client'

import type { TargetFace, TargetMapping } from '@open-reloading/schema'
import Link from 'next/link'
import { emptyDirectory, writeDirectory } from '../lib/directory.ts'
import type { FederationListItem } from '../lib/disciplines.ts'
import type { DisciplineSummary, MappingSummary } from '../lib/face-disciplines.ts'
import { withOrganization } from '../lib/face-organization.ts'
import { titleFromKebab } from '../lib/record-fields.ts'
import { readItems, readRecord } from '../lib/record-reads.ts'
import { faceEventRows, targetFaceGroups, targetFaceStrip } from '../lib/target-faces.ts'
import { controlSize } from '../lib/theme.ts'
import { FieldStrip } from './field-strip.tsx'
import { FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { LinkButton } from './record-actions.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'
import { PanelTable } from './scroll-region.tsx'
import { shownLength } from './shown-length.tsx'
import { TargetFaceDrawing } from './target-face-drawing.tsx'

const scoredBy = { touch: 'Hole edge', centre: 'Hole centre' }

/** What the page reads besides the record: the mappings of the face (the list leaves out the shot count), the disciplines and the federations. */
interface Extras {
  mappings: TargetMapping[]
  disciplines: DisciplineSummary[]
  federations: FederationListItem[]
}

function TargetFaceRecord({
  face,
  mappings,
  disciplines,
  federations,
}: { face: TargetFace } & Extras) {
  const f = withOrganization(face, federations)
  const rows = faceEventRows(f, mappings, disciplines, federations)
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
        <Panel
          id="face-events"
          title={`Events (${rows.length})`}
          controls={
            mappings.length > 0 && (
              <LinkButton
                size={controlSize.row.button}
                href={`/disciplines${writeDirectory({ ...emptyDirectory, facets: { face: [f.id] } }, '')}`}
              >
                In the discipline list
              </LinkButton>
            )
          }
        >
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

/** The target face record page: the face drawing and its events, rendered in the browser from the face's data file. */
export function TargetFaceRecordPage({ id, name }: { id: string; name: string }) {
  return (
    <RecordViewWith<TargetFace, Extras>
      kind="target-faces"
      id={id}
      name={name}
      what="Target face"
      extras={async (_, signal) => {
        const [listed, disciplines, federations] = await Promise.all([
          readItems<MappingSummary>(`target-mappings?face=${encodeURIComponent(id)}`, signal),
          readItems<DisciplineSummary>('disciplines', signal),
          readItems<FederationListItem>('federations', signal),
        ])
        // the list leaves out the shot count: the records hold it
        const mappings = await Promise.all(
          listed.map((m) => readRecord<TargetMapping>('target-mappings', m.id, signal)),
        )
        return { mappings, disciplines, federations }
      }}
    >
      {(face, extras) => <TargetFaceRecord face={face} {...extras} />}
    </RecordViewWith>
  )
}
