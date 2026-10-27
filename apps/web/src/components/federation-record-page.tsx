'use client'

import {
  compareDisciplines,
  compareTargetFaces,
  type TargetFace,
  toSi,
} from '@open-reloading/schema'
import Link from 'next/link'
import { emptyDirectory, writeDirectory } from '../lib/directory.ts'
import {
  countryText,
  disciplineFaceIds,
  type FederationListItem,
  type FederationRecord,
  federationScope,
} from '../lib/disciplines.ts'
import type { DisciplineSummary, MappingSummary } from '../lib/face-disciplines.ts'
import { titleFromKebab } from '../lib/record-fields.ts'
import { readItems, readRecord } from '../lib/record-reads.ts'
import { controlSize } from '../lib/theme.ts'
import { FieldTable } from './field-table.tsx'
import { HomepageLink } from './homepage-link.tsx'
import { Panel } from './panel.tsx'
import { LinkButton } from './record-actions.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'
import { PanelTable } from './scroll-region.tsx'
import { TargetFaceDrawing } from './target-face-drawing.tsx'

/** What the page reads besides the record: the disciplines, federations and target mappings, and the faces its disciplines are shot on. */
interface Extras {
  disciplines: DisciplineSummary[]
  federations: FederationListItem[]
  mappings: MappingSummary[]
  faces: TargetFace[]
}

function FederationRecordView({
  f,
  disciplines,
  federations,
  mappings,
  faces,
}: { f: FederationRecord } & Extras) {
  const international = federations.find((x) => x.id === f.internationalFederation)
  const own = federationScope(f.id, disciplines, mappings).disciplines.toSorted(compareDisciplines)
  const ordered = faces.toSorted(compareTargetFaces)
  const usedBy = (face: string) =>
    own.filter((d) => disciplineFaceIds(mappings, d.id).includes(face)).length
  return (
    <RecordPage
      title={f.name}
      badges={[f.abbreviation]}
      className="federation-record"
      provenance={f.provenance}
      figure={
        <Panel id="federation-rule-books" title={`Rule books (${f.ruleBooks.length})`}>
          <PanelTable
            label="Rule books table"
            className="face-table"
            caption={<span className="visually-hidden">The rule books the records cite</span>}
            columns={['Title', 'Edition']}
          >
            {f.ruleBooks.map((b) => (
              <tr key={b.url}>
                <th scope="row">
                  <a href={b.url}>{b.title}</a>
                </th>
                <td>{b.edition}</td>
              </tr>
            ))}
          </PanelTable>
        </Panel>
      }
      values={
        <Panel id="record-data" title="Federation">
          <FieldTable
            caption="Federation"
            labelledBy="record-data"
            groups={[
              {
                rows: [
                  { label: 'Abbreviation', text: f.abbreviation },
                  { label: 'Country', text: countryText(f.country) },
                ],
              },
            ]}
          />
          {(f.internationalFederation || f.website) && (
            <dl className="record-links">
              {f.internationalFederation && (
                <>
                  <dt>Member of</dt>
                  <dd>
                    <Link href={`/federations/${f.internationalFederation}`}>
                      {international?.name ?? f.internationalFederation}
                    </Link>
                  </dd>
                </>
              )}
              {f.website && (
                <>
                  <dt>Homepage</dt>
                  <dd>
                    <HomepageLink url={f.website} />
                  </dd>
                </>
              )}
            </dl>
          )}
        </Panel>
      }
      side={
        <>
          <Panel
            id="federation-disciplines"
            title={`Disciplines (${own.length})`}
            controls={
              own.length > 0 && (
                <LinkButton
                  size={controlSize.row.button}
                  href={`/disciplines${writeDirectory({ ...emptyDirectory, organization: f.abbreviation }, '')}`}
                >
                  In the discipline list
                </LinkButton>
              )
            }
          >
            {own.length === 0 ? (
              <p className="record-note">No discipline record names this federation.</p>
            ) : (
              <PanelTable
                label="Disciplines table"
                className="face-table"
                caption={
                  <span className="visually-hidden">The disciplines of this federation</span>
                }
                columns={['Number', 'Discipline', 'Distance', 'Category', 'Faces']}
              >
                {own.map((d) => (
                  <tr key={d.id}>
                    <td>{d.number}</td>
                    <th scope="row">
                      <Link href={`/disciplines/${d.id}`}>{d.name}</Link>
                    </th>
                    <td className="nowrap">{`${toSi('length', d.distanceMm)} m`}</td>
                    <td>{d.category && titleFromKebab(d.category)}</td>
                    <td className="num">{disciplineFaceIds(mappings, d.id).length}</td>
                  </tr>
                ))}
              </PanelTable>
            )}
          </Panel>
          <Panel id="federation-faces" title={`Faces (${faces.length})`}>
            {faces.length === 0 ? (
              <p className="record-note">No target mapping of its disciplines names a face.</p>
            ) : (
              <PanelTable
                label="Faces table"
                className="face-table"
                caption={
                  <span className="visually-hidden">The faces its disciplines are shot on</span>
                }
                columns={['Face', 'Disciplines']}
              >
                {ordered.map((x) => (
                  <tr key={x.id}>
                    <th scope="row">
                      <Link href={`/targets/${x.id}`} className="stage-face">
                        <span aria-hidden="true">
                          <TargetFaceDrawing face={x} />
                        </span>
                        <span>{x.name}</span>
                      </Link>
                    </th>
                    <td className="num">{usedBy(x.id)}</td>
                  </tr>
                ))}
              </PanelTable>
            )}
          </Panel>
        </>
      }
    />
  )
}

/** The federation record page: the record from its data file, with the faces its disciplines are shot on drawn in the browser. */
export function FederationRecordPage({ id, name }: { id: string; name: string }) {
  return (
    <RecordViewWith<FederationRecord, Extras>
      kind="federations"
      id={id}
      name={name}
      what="Federation"
      extras={async (_, signal) => {
        const [disciplines, federations, mappings] = await Promise.all([
          readItems<DisciplineSummary>('disciplines', signal),
          readItems<FederationListItem>('federations', signal),
          readItems<MappingSummary>('target-mappings', signal),
        ])
        const faces = await Promise.all(
          federationScope(id, disciplines, mappings).faces.map((face) =>
            readRecord<TargetFace>('target-faces', face, signal),
          ),
        )
        return { disciplines, federations, mappings, faces }
      }}
    >
      {(f, extras) => <FederationRecordView f={f} {...extras} />}
    </RecordViewWith>
  )
}
