'use client'

import Link from 'next/link'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import type { Face } from '../lib/face-organization.ts'
import { categoryWord } from '../lib/face-words.ts'
import { type FaceEventRow, targetFaceGroups, targetFaceStrip } from '../lib/target-faces.ts'
import { FieldStrip } from './field-strip.tsx'
import { FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { PanelTable } from './scroll-region.tsx'
import { shownLength } from './shown-length.tsx'

/** How an event scores a hole, by the stored value. */
const scoredBy = { touch: msg('Hole edge'), centre: msg('Hole centre') }

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
  return (
    <Panel id="record-data" title={t('Rings')}>
      <FieldTable
        caption={msg('Rings')}
        labelledBy="record-data"
        groups={targetFaceGroups(face, t)}
      />
      {face.note && <p className="record-note">{face.note}</p>}
    </Panel>
  )
}

/** The events and disciplines shot on the face. */
export function FaceEvents({ rows }: { rows: readonly FaceEventRow[] }) {
  const { t } = useTranslation()
  const categories = rows.some((e) => e.category)
  const scoring = rows.some((e) => e.scoring)
  return (
    <Panel id="face-events" title={t('Events ({count})', { count: rows.length })}>
      <PanelTable
        label={t('Events table')}
        className="face-table"
        caption={
          <span className="visually-hidden">
            {t('The events and disciplines shot on this face')}
          </span>
        }
        columns={[
          t('Federation'),
          t('Number'),
          t('Discipline'),
          t('Stage'),
          t('Distance'),
          t('Gauge'),
          t('Shots'),
          ...(categories ? [t('Kind')] : []),
          ...(scoring ? [t('Scoring')] : []),
          t('Section'),
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
            {scoring && <td>{d.scoring ? t(scoredBy[d.scoring]) : t('Not stated')}</td>}
            <td>{d.section}</td>
          </tr>
        ))}
      </PanelTable>
    </Panel>
  )
}
