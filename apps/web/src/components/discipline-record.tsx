'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import type { DisciplineRecord } from '../lib/disciplines.ts'
import { disciplineGroups, disciplineStrip } from '../lib/disciplines.ts'
import { FieldStrip } from './field-strip.tsx'
import { FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { PanelTable } from './scroll-region.tsx'
import { shownLength } from './shown-length.tsx'

/** One stage of a discipline: the face it is shot on, the event, the gauge and the shot count. */
interface DisciplineStageRow {
  id: string
  face: string
  faceName: string
  drawing?: ReactNode
  event: string
  stage?: string | undefined
  /** The scoring gauge, mm. */
  gauge?: number | undefined
  shotCount?: number | undefined
  /** Where the stage opens in the shot groups. */
  groupsHref: string
}

/** The faces and stages of a discipline; with several stages each row opens its own in the shot groups. */
export function DisciplineStages({ rows }: { rows: readonly DisciplineStageRow[] }) {
  const { t } = useTranslation()
  const perStage = rows.length > 1
  return (
    <Panel id="discipline-stages" title={t('Faces ({count})', { count: rows.length })}>
      {rows.length === 0 ? (
        <p className="record-note">{t('No target mapping names this discipline.')}</p>
      ) : (
        <PanelTable
          label={t('Faces table')}
          className="face-table"
          caption={
            <span className="visually-hidden">{t('The faces and stages of this discipline')}</span>
          }
          columns={[
            t('Face'),
            t('Event'),
            t('Stage'),
            t('Gauge'),
            t('Shots'),
            ...(perStage ? [t('Shot groups')] : []),
          ]}
        >
          {rows.map((m) => (
            <tr key={m.id}>
              <th scope="row">
                <Link href={`/targets/${m.face}`} className="stage-face">
                  {m.drawing && <span aria-hidden="true">{m.drawing}</span>}
                  <span>{m.faceName}</span>
                </Link>
              </th>
              <td>{m.event}</td>
              <td>{m.stage}</td>
              <td className="num">{m.gauge !== undefined && shownLength(m.gauge)}</td>
              <td className="num">{m.shotCount}</td>
              {perStage && (
                <td>
                  <Link
                    href={m.groupsHref}
                    aria-label={t('Open {name} in shot groups', { name: m.stage ?? m.event })}
                  >
                    {t('Open')}
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </PanelTable>
      )}
    </Panel>
  )
}

/** The discipline's facts under the page bar. */
export function DisciplineStrip({
  record,
  federation,
}: {
  record: Pick<DisciplineRecord, 'federation' | 'distance' | 'category'>
  /** The federation's abbreviation. */
  federation?: string | undefined
}) {
  const { t } = useTranslation()
  return <FieldStrip items={disciplineStrip(record, t, federation)} />
}

/** The rule book that defines a discipline, with the section and page of the record. */
interface RuleBookCitation {
  title: string
  url?: string | undefined
  edition?: string | undefined
  section: string
  page: string
}

/** The discipline's values and its links: federation, rule book, the international discipline. */
export function DisciplineData({
  record,
  classes,
  federation,
  book,
  international,
}: {
  record: Pick<DisciplineRecord, 'number' | 'section' | 'page' | 'caliberClasses'>
  classes: readonly { id: string; name: string }[]
  federation: { id: string; name: string }
  book?: RuleBookCitation | undefined
  international?: { id: string; name: string } | undefined
}) {
  const { t } = useTranslation()
  return (
    <Panel id="record-data" title={t('Discipline')}>
      <FieldTable
        caption={msg('Discipline')}
        labelledBy="record-data"
        groups={disciplineGroups(record, classes, t)}
      />
      <dl className="record-links">
        <dt>{t('Federation')}</dt>
        <dd>
          <Link href={`/federations/${federation.id}`}>{federation.name}</Link>
        </dd>
        {book && (
          <>
            <dt>{t('Rule book')}</dt>
            <dd>
              {book.url ? <a href={book.url}>{book.title}</a> : book.title}
              {book.edition && !book.title.includes(book.edition) && `, ${book.edition}`}
              {`, ${t('section {section}, {page}', { section: book.section, page: book.page })}`}
            </dd>
          </>
        )}
        {international && (
          <>
            <dt>{t('International discipline')}</dt>
            <dd>
              <Link href={`/disciplines/${international.id}`}>{international.name}</Link>
            </dd>
          </>
        )}
      </dl>
    </Panel>
  )
}
