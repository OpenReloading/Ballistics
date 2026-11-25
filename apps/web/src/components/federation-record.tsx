'use client'

import { useLingui } from '@lingui/react'
import type { ReactNode } from 'react'
import Link from '@/platform/link.tsx'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { countryName } from '../lib/countries.ts'
import { categoryWord } from '../lib/face-words.ts'
import { controlSize } from '../lib/theme.ts'
import { FieldTable, SlashBreaks } from './field-table.tsx'
import { HomepageLink } from './homepage-link.tsx'
import { Panel } from './panel.tsx'
import { LinkButton } from './record-actions.tsx'
import { PanelTable } from './scroll-region.tsx'

/** The rule books a federation's records cite, each linked, with its edition. */
export function FederationRuleBooks({
  books,
}: {
  books: readonly { title: string; edition: string; url: string }[]
}) {
  const { i18n } = useLingui()
  return (
    <Panel
      id="federation-rule-books"
      title={i18n._({
        id: 'federationRecord.ruleBooks',
        message: 'Rule books ({count})',
        values: { count: books.length },
      })}
    >
      <PanelTable
        label={i18n._({ id: 'federationRecord.ruleBooksTable', message: 'Rule books table' })}
        className="face-table"
        caption={
          <span className="visually-hidden">
            {i18n._({
              id: 'federationRecord.ruleBooksCaption',
              message: 'The rule books the records cite',
            })}
          </span>
        }
        columns={[
          i18n._({ id: 'federationRecord.column.title', message: 'Title' }),
          i18n._({ id: 'federationRecord.column.edition', message: 'Edition' }),
        ]}
      >
        {books.map((b) => (
          <tr key={b.url}>
            <th scope="row">
              <a href={b.url}>{b.title}</a>
            </th>
            <td>{b.edition}</td>
          </tr>
        ))}
      </PanelTable>
    </Panel>
  )
}

/** The abbreviation is the chip beside the page title. */
export function FederationData({
  country,
  member,
  website,
}: {
  /** An ISO 3166-1 alpha-2 code, or `international` for a world body. */
  country: string
  /** The international federation this one belongs to: its id and name. */
  member?: { id: string; name: string } | undefined
  website?: string | undefined
}) {
  const { i18n } = useLingui()
  const title = /*i18n*/ { id: 'federationRecord.data', message: 'Federation' }
  const place =
    country === 'international'
      ? i18n._({ id: 'federationRecord.international', message: 'International' })
      : /^[A-Z]{2}$/.test(country)
        ? countryName(country, country)
        : country
  return (
    <Panel id="record-data" title={i18n._(title)}>
      <FieldTable
        caption={title}
        labelledBy="record-data"
        groups={[
          {
            rows: [
              {
                label: /*i18n*/ { id: 'federationRecord.country', message: 'Country' },
                text: place,
              },
            ],
          },
        ]}
      />
      {(member || website) && (
        <dl className="record-links">
          {member && (
            <>
              <dt>{i18n._({ id: 'federationRecord.memberOf', message: 'Member of' })}</dt>
              <dd>
                <Link href={`/federations/${member.id}`}>{member.name}</Link>
              </dd>
            </>
          )}
          {website && (
            <>
              <dt>{i18n._({ id: 'federationRecord.homepage', message: 'Homepage' })}</dt>
              <dd>
                <HomepageLink url={website} />
              </dd>
            </>
          )}
        </dl>
      )}
    </Panel>
  )
}

/** One discipline of a federation: its distance in m and the number of faces it is shot on. */
interface FederationDisciplineRow {
  id: string
  number?: string | undefined
  name: string
  distanceM: number
  category?: string | undefined
  faces: number
}

/** The Number column only where a discipline has one; numeric columns aligned right, head and values. */
export function FederationDisciplines({
  rows,
  listHref,
}: {
  rows: readonly FederationDisciplineRow[]
  listHref: string
}) {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const numbered = rows.some((d) => d.number)
  return (
    <Panel
      id="federation-disciplines"
      title={i18n._({
        id: 'federationRecord.disciplines',
        message: 'Disciplines ({count})',
        values: { count: rows.length },
      })}
      controls={
        rows.length > 0 && (
          <LinkButton size={controlSize.row.button} href={listHref}>
            {i18n._({ id: 'federationRecord.inDisciplineList', message: 'In the discipline list' })}
          </LinkButton>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="record-note">
          {i18n._({
            id: 'federationRecord.noDisciplines',
            message: 'No discipline record names this federation.',
          })}
        </p>
      ) : (
        <PanelTable
          label={i18n._({ id: 'federationRecord.disciplinesTable', message: 'Disciplines table' })}
          className="face-table"
          caption={
            <span className="visually-hidden">
              {i18n._({
                id: 'federationRecord.disciplinesCaption',
                message: 'The disciplines of this federation',
              })}
            </span>
          }
          columns={[
            ...(numbered
              ? [i18n._({ id: 'federationRecord.column.number', message: 'Number' })]
              : []),
            i18n._({ id: 'federationRecord.column.discipline', message: 'Discipline' }),
            {
              label: i18n._({ id: 'federationRecord.column.distance', message: 'Distance' }),
              num: true,
            },
            i18n._({ id: 'federationRecord.column.category', message: 'Category' }),
            {
              label: i18n._({ id: 'federationRecord.column.targets', message: 'Targets' }),
              num: true,
            },
          ]}
        >
          {rows.map((d) => (
            <tr key={d.id}>
              {numbered && <td>{d.number && <SlashBreaks text={d.number} />}</td>}
              <th scope="row">
                <Link href={`/disciplines/${d.id}`}>{d.name}</Link>
              </th>
              <td className="num nowrap">{`${plainNumber(d.distanceM)} m`}</td>
              <td>{d.category && categoryWord(t, d.category)}</td>
              <td className="num">{d.faces}</td>
            </tr>
          ))}
        </PanelTable>
      )}
    </Panel>
  )
}

/** One face a federation's disciplines are shot on: its drawing and the number of disciplines using it. */
interface FederationFaceRow {
  id: string
  name: string
  uses: number
  drawing: ReactNode
}

/** The faces a federation's disciplines are shot on. */
export function FederationFaces({ rows }: { rows: readonly FederationFaceRow[] }) {
  const { i18n } = useLingui()
  return (
    <Panel
      id="federation-faces"
      title={i18n._({
        id: 'federationRecord.targets',
        message: 'Targets ({count})',
        values: { count: rows.length },
      })}
    >
      {rows.length === 0 ? (
        <p className="record-note">
          {i18n._({
            id: 'federationRecord.noTargets',
            message: 'No target mapping of its disciplines names a target.',
          })}
        </p>
      ) : (
        <PanelTable
          label={i18n._({ id: 'federationRecord.targetsTable', message: 'Targets table' })}
          className="face-table"
          caption={
            <span className="visually-hidden">
              {i18n._({
                id: 'federationRecord.targetsCaption',
                message: 'The targets its disciplines are shot on',
              })}
            </span>
          }
          columns={[
            i18n._({ id: 'federationRecord.column.target', message: 'Target' }),
            {
              label: i18n._({ id: 'federationRecord.column.disciplines', message: 'Disciplines' }),
              num: true,
            },
          ]}
        >
          {rows.map((x) => (
            <tr key={x.id}>
              <th scope="row">
                <Link href={`/targets/${x.id}`} className="stage-face">
                  <span aria-hidden="true">{x.drawing}</span>
                  <span>{x.name}</span>
                </Link>
              </th>
              <td className="num">{x.uses}</td>
            </tr>
          ))}
        </PanelTable>
      )}
    </Panel>
  )
}
