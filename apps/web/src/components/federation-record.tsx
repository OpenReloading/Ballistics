'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import { countryName } from '../lib/countries.ts'
import { categoryWord } from '../lib/face-words.ts'
import { controlSize } from '../lib/theme.ts'
import { FieldTable } from './field-table.tsx'
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
  const { t } = useTranslation()
  return (
    <Panel id="federation-rule-books" title={t('Rule books ({count})', { count: books.length })}>
      <PanelTable
        label={t('Rule books table')}
        className="face-table"
        caption={<span className="visually-hidden">{t('The rule books the records cite')}</span>}
        columns={[t('Title'), t('Edition')]}
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

/** The federation's own values and its links: abbreviation, country, the international body, homepage. */
export function FederationData({
  abbreviation,
  country,
  member,
  website,
}: {
  abbreviation: string
  /** An ISO 3166-1 alpha-2 code, or `international` for a world body. */
  country: string
  /** The international federation this one belongs to: its id and name. */
  member?: { id: string; name: string } | undefined
  website?: string | undefined
}) {
  const { t } = useTranslation()
  const place =
    country === 'international'
      ? t('International')
      : /^[A-Z]{2}$/.test(country)
        ? countryName(country, country)
        : country
  return (
    <Panel id="record-data" title={t('Federation')}>
      <FieldTable
        caption={msg('Federation')}
        labelledBy="record-data"
        groups={[
          {
            rows: [
              { label: msg('Abbreviation'), text: abbreviation },
              { label: msg('Country'), text: place },
            ],
          },
        ]}
      />
      {(member || website) && (
        <dl className="record-links">
          {member && (
            <>
              <dt>{t('Member of')}</dt>
              <dd>
                <Link href={`/federations/${member.id}`}>{member.name}</Link>
              </dd>
            </>
          )}
          {website && (
            <>
              <dt>{t('Homepage')}</dt>
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

/** A federation's disciplines, with the link to the discipline list filtered to it. */
export function FederationDisciplines({
  rows,
  listHref,
}: {
  rows: readonly FederationDisciplineRow[]
  listHref: string
}) {
  const { t } = useTranslation()
  return (
    <Panel
      id="federation-disciplines"
      title={t('Disciplines ({count})', { count: rows.length })}
      controls={
        rows.length > 0 && (
          <LinkButton size={controlSize.row.button} href={listHref}>
            {t('In the discipline list')}
          </LinkButton>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="record-note">{t('No discipline record names this federation.')}</p>
      ) : (
        <PanelTable
          label={t('Disciplines table')}
          className="face-table"
          caption={
            <span className="visually-hidden">{t('The disciplines of this federation')}</span>
          }
          columns={[t('Number'), t('Discipline'), t('Distance'), t('Category'), t('Targets')]}
        >
          {rows.map((d) => (
            <tr key={d.id}>
              <td>{d.number}</td>
              <th scope="row">
                <Link href={`/disciplines/${d.id}`}>{d.name}</Link>
              </th>
              <td className="nowrap">{`${plainNumber(d.distanceM)} m`}</td>
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
  const { t } = useTranslation()
  return (
    <Panel id="federation-faces" title={t('Targets ({count})', { count: rows.length })}>
      {rows.length === 0 ? (
        <p className="record-note">{t('No target mapping of its disciplines names a target.')}</p>
      ) : (
        <PanelTable
          label={t('Targets table')}
          className="face-table"
          caption={
            <span className="visually-hidden">{t('The targets its disciplines are shot on')}</span>
          }
          columns={[t('Target'), t('Disciplines')]}
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
