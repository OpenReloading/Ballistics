'use client'

import { useLingui } from '@lingui/react'
import type { ReactNode } from 'react'
import Link from '@/platform/link.tsx'
import { useTranslation } from '../i18n/language.ts'
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
  /** The sighters, series and time limits the stage's rule book gives, as one text. */
  course?: string | undefined
  /** Where the stage opens in the shot groups. */
  groupsHref: string
}

/** The faces and stages of a discipline; with several stages each row opens its own in the shot groups. */
export function DisciplineStages({ rows }: { rows: readonly DisciplineStageRow[] }) {
  const { i18n } = useLingui()
  const perStage = rows.length > 1
  const hasCourse = rows.some((m) => m.course)
  return (
    <Panel
      id="discipline-stages"
      title={i18n._({
        id: 'disciplineRecord.targets',
        message: 'Targets ({count})',
        values: { count: rows.length },
      })}
    >
      {rows.length === 0 ? (
        <p className="record-note">
          {i18n._({
            id: 'disciplineRecord.noTargets',
            message: 'No target mapping names this discipline.',
          })}
        </p>
      ) : (
        <PanelTable
          label={i18n._({ id: 'disciplineRecord.targetsTable', message: 'Targets table' })}
          className="face-table"
          caption={
            <span className="visually-hidden">
              {i18n._({
                id: 'disciplineRecord.targetsCaption',
                message: 'The targets and stages of this discipline',
              })}
            </span>
          }
          columns={[
            i18n._({ id: 'disciplineRecord.column.target', message: 'Target' }),
            i18n._({ id: 'disciplineRecord.column.event', message: 'Event' }),
            i18n._({ id: 'disciplineRecord.column.stage', message: 'Stage' }),
            i18n._({ id: 'disciplineRecord.column.gauge', message: 'Gauge' }),
            i18n._({ id: 'disciplineRecord.column.shots', message: 'Shots' }),
            ...(hasCourse
              ? [i18n._({ id: 'disciplineRecord.column.course', message: 'Course of fire' })]
              : []),
            ...(perStage
              ? [i18n._({ id: 'disciplineRecord.column.groups', message: 'Shot groups' })]
              : []),
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
              {hasCourse && <td>{m.course}</td>}
              {perStage && (
                <td>
                  <Link
                    href={m.groupsHref}
                    aria-label={i18n._({
                      id: 'disciplineRecord.openStage',
                      message: 'Open {name} in shot groups',
                      values: { name: m.stage ?? m.event },
                    })}
                  >
                    {i18n._({ id: 'disciplineRecord.open', message: 'Open' })}
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
  const { i18n } = useLingui()
  return <FieldStrip items={disciplineStrip(record, i18n, t, federation)} />
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
  record: Pick<DisciplineRecord, 'number' | 'section' | 'page' | 'caliberClasses' | 'rules'>
  classes: readonly { id: string; name: string }[]
  federation: { id: string; name: string }
  book?: RuleBookCitation | undefined
  international?: { id: string; name: string } | undefined
}) {
  const { i18n } = useLingui()
  const title = /*i18n*/ { id: 'disciplineRecord.data', message: 'Discipline' }
  return (
    <Panel id="record-data" title={i18n._(title)}>
      <FieldTable
        caption={title}
        labelledBy="record-data"
        groups={disciplineGroups(record, classes, i18n)}
      />
      <dl className="record-links">
        <dt>{i18n._({ id: 'disciplineRecord.federation', message: 'Federation' })}</dt>
        <dd>
          <Link href={`/federations/${federation.id}`}>{federation.name}</Link>
        </dd>
        {book && (
          <>
            <dt>{i18n._({ id: 'disciplineRecord.ruleBook', message: 'Rule book' })}</dt>
            <dd>
              {book.url ? <a href={book.url}>{book.title}</a> : book.title}
              {book.edition && !book.title.includes(book.edition) && `, ${book.edition}`}
              {`, ${i18n._({ id: 'disciplineRecord.section', message: 'section {section}, {page}', values: { section: book.section, page: book.page } })}`}
            </dd>
          </>
        )}
        {international && (
          <>
            <dt>
              {i18n._({
                id: 'disciplineRecord.international',
                message: 'International discipline',
              })}
            </dt>
            <dd>
              <Link href={`/disciplines/${international.id}`}>{international.name}</Link>
            </dd>
          </>
        )}
      </dl>
    </Panel>
  )
}
