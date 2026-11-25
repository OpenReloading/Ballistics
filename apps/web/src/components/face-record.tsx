'use client'

import { useLingui } from '@lingui/react'
import Link from '@/platform/link.tsx'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import type { Face } from '../lib/face-organization.ts'
import { categoryWord } from '../lib/face-words.ts'
import { type FaceEventRow, targetFaceGroups, targetFaceStrip } from '../lib/target-faces.ts'
import { controlSize } from '../lib/theme.ts'
import { FieldStrip } from './field-strip.tsx'
import { FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { LinkButton } from './record-actions.tsx'
import { PanelTable } from './scroll-region.tsx'
import { shownLength } from './shown-length.tsx'

/** How an event scores a hole, by the stored value. */
const scoredBy = {
  touch: /*i18n*/ { id: 'faceRecord.scoredBy.touch', message: 'Hole edge' },
  centre: /*i18n*/ { id: 'faceRecord.scoredBy.center', message: 'Hole center' },
  outward: /*i18n*/ { id: 'faceRecord.scoredBy.outward', message: 'Hole edge, outward' },
}

/** A face record without its sources, which the page's sources panel shows. */
type FaceValues = Omit<Face, 'provenance'>

/** The face's facts under the page bar. */
export function FaceStrip({ face }: { face: FaceValues }) {
  const { t } = useTranslation()
  return <FieldStrip items={targetFaceStrip(face, t)} />
}

/** The face's ring diameters and scoring values, with the record's note. */
export function FaceValuesPanel({ face }: { face: FaceValues }) {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const title = /*i18n*/ { id: 'faceRecord.rings', message: 'Rings' }
  return (
    <Panel id="record-data" title={i18n._(title)}>
      <FieldTable caption={title} labelledBy="record-data" groups={targetFaceGroups(face, t)} />
      {face.note && <p className="record-note">{face.note}</p>}
    </Panel>
  )
}

/** The events and disciplines shot on the face. */
export function FaceEvents({
  rows,
  listHref,
}: {
  rows: readonly FaceEventRow[]
  /** The discipline list filtered to this face; no link when it is missing. */
  listHref?: string | undefined
}) {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const categories = rows.some((e) => e.category)
  const scoring = rows.some((e) => e.scoring)
  return (
    <Panel
      id="face-events"
      title={i18n._({
        id: 'faceRecord.events',
        message: 'Events ({count})',
        values: { count: rows.length },
      })}
      controls={
        listHref && (
          <LinkButton size={controlSize.row.button} href={listHref}>
            {i18n._({ id: 'faceRecord.inDisciplineList', message: 'In the discipline list' })}
          </LinkButton>
        )
      }
    >
      <PanelTable
        label={i18n._({ id: 'faceRecord.eventsTable', message: 'Events table' })}
        className="face-table"
        caption={
          <span className="visually-hidden">
            {i18n._({
              id: 'faceRecord.eventsCaption',
              message: 'The events and disciplines shot on this target',
            })}
          </span>
        }
        columns={[
          i18n._({ id: 'faceRecord.column.federation', message: 'Federation' }),
          i18n._({ id: 'faceRecord.column.number', message: 'Number' }),
          i18n._({ id: 'faceRecord.column.discipline', message: 'Discipline' }),
          i18n._({ id: 'faceRecord.column.stage', message: 'Stage' }),
          i18n._({ id: 'faceRecord.column.distance', message: 'Distance' }),
          i18n._({ id: 'faceRecord.column.gauge', message: 'Gauge' }),
          i18n._({ id: 'faceRecord.column.shots', message: 'Shots' }),
          ...(categories ? [i18n._({ id: 'faceRecord.column.kind', message: 'Kind' })] : []),
          ...(scoring ? [i18n._({ id: 'faceRecord.column.scoring', message: 'Scoring' })] : []),
          i18n._({ id: 'faceRecord.column.section', message: 'Section' }),
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
            <td className="nowrap">{d.distance.raw ?? `${plainNumber(d.distance.metres)} m`}</td>
            <td className="num">{d.gauge !== undefined && shownLength(d.gauge)}</td>
            <td className="num">{d.shotCount}</td>
            {categories && <td>{d.category && categoryWord(t, d.category)}</td>}
            {scoring && (
              <td>
                {i18n._(
                  d.scoring
                    ? scoredBy[d.scoring]
                    : { id: 'faceRecord.notStated', message: 'Not stated' },
                )}
              </td>
            )}
            <td>{d.section}</td>
          </tr>
        ))}
      </PanelTable>
    </Panel>
  )
}
