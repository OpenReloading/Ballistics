import { compareDisciplines, compareTargetFaces } from '@openreloading/schema'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FieldTable } from '../../../components/field-table.tsx'
import { Panel } from '../../../components/panel.tsx'
import { LinkButton } from '../../../components/record-actions.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { PanelTable } from '../../../components/scroll-region.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { TargetFaceDrawing } from '../../../components/target-face-drawing.tsx'
import {
  buildPlaceholderId,
  getFederation,
  getTargetFace,
  listDisciplines,
  listFederations,
  listTargetMappings,
  staticIds,
} from '../../../lib/api.ts'
import { emptyDirectory, writeDirectory } from '../../../lib/directory.ts'
import { countryText, disciplineFaceIds, federationScope } from '../../../lib/disciplines.ts'
import { titleFromKebab } from '../../../lib/record-fields.ts'
import { controlSize } from '../../../lib/theme.ts'

export function generateStaticParams() {
  return staticIds(listFederations, 'federation')
}

export async function generateMetadata({
  params,
}: PageProps<'/federations/[id]'>): Promise<Metadata> {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
  const r = await getFederation(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  return {
    title: r.data.name,
    description: `The rule books of ${r.data.name}, its disciplines and the target faces they use.`,
  }
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function FederationPage({ params }: PageProps<'/federations/[id]'>) {
  const { id } = await params
  if (id === buildPlaceholderId) notFound()
  const r = await getFederation(id)
  if (r.status === 'notFound') notFound()
  const [disciplines, federations, mappings] = await Promise.all([
    listDisciplines(),
    listFederations(),
    listTargetMappings(),
  ])
  const scope =
    disciplines.status === 'ok' && mappings.status === 'ok'
      ? federationScope(id, disciplines.data, mappings.data)
      : { disciplines: [], faces: [] }
  const faces = await Promise.all(scope.faces.map((f) => getTargetFace(f)))
  if (
    r.status !== 'ok' ||
    disciplines.status !== 'ok' ||
    federations.status !== 'ok' ||
    mappings.status !== 'ok' ||
    faces.some((f) => f.status !== 'ok')
  )
    return <ServerDataError what="Federation" />
  const f = r.data
  const international = federations.data.find((x) => x.id === f.internationalFederation)
  const own = scope.disciplines.toSorted(compareDisciplines)
  const ordered = faces.toSorted((a, b) =>
    a.status === 'ok' && b.status === 'ok' ? compareTargetFaces(a.data, b.data) : 0,
  )
  const usedBy = (face: string) =>
    own.filter((d) => disciplineFaceIds(mappings.data, d.id).includes(face)).length
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
          {f.internationalFederation && (
            <dl className="record-links">
              <dt>Member of</dt>
              <dd>
                <Link href={`/federations/${f.internationalFederation}`}>
                  {international?.name ?? f.internationalFederation}
                </Link>
              </dd>
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
                    <td className="nowrap">{`${d.distanceMm / 1e3} m`}</td>
                    <td>{d.category && titleFromKebab(d.category)}</td>
                    <td className="num">{disciplineFaceIds(mappings.data, d.id).length}</td>
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
                {ordered.flatMap((x) =>
                  x.status === 'ok'
                    ? [
                        <tr key={x.data.id}>
                          <th scope="row">
                            <Link href={`/targets/${x.data.id}`} className="stage-face">
                              <span aria-hidden="true">
                                <TargetFaceDrawing face={x.data} />
                              </span>
                              <span>{x.data.name}</span>
                            </Link>
                          </th>
                          <td className="num">{usedBy(x.data.id)}</td>
                        </tr>,
                      ]
                    : [],
                )}
              </PanelTable>
            )}
          </Panel>
        </>
      }
    />
  )
}
