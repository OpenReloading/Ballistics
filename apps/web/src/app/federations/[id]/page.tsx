import { compareDisciplines, compareTargetFaces, toSi } from '@open-reloading/schema'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  FederationData,
  FederationDisciplines,
  FederationFaces,
  FederationRuleBooks,
} from '../../../components/federation-record.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { TargetFaceDrawing } from '../../../components/target-face-drawing.tsx'
import {
  getFederation,
  getTargetFace,
  listDisciplines,
  listFederations,
  listTargetMappings,
  staticIds,
} from '../../../lib/api.ts'
import { emptyDirectory, writeDirectory } from '../../../lib/directory.ts'
import { disciplineFaceIds, federationScope } from '../../../lib/disciplines.ts'
import { verbatim } from '../../../lib/wording.ts'

export function generateStaticParams() {
  return staticIds(listFederations, 'federation')
}

export async function generateMetadata({
  params,
}: PageProps<'/federations/[id]'>): Promise<Metadata> {
  const { id } = await params
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
      badges={[verbatim(f.abbreviation)]}
      className="federation-record"
      provenance={f.provenance}
      figure={<FederationRuleBooks books={f.ruleBooks} />}
      values={
        <FederationData
          abbreviation={f.abbreviation}
          country={f.country}
          member={
            f.internationalFederation
              ? {
                  id: f.internationalFederation,
                  name: international?.name ?? f.internationalFederation,
                }
              : undefined
          }
          website={f.website}
        />
      }
      side={
        <>
          <FederationDisciplines
            listHref={`/disciplines${writeDirectory({ ...emptyDirectory, organization: f.abbreviation }, '')}`}
            rows={own.map((d) => ({
              id: d.id,
              number: d.number,
              name: d.name,
              distanceM: toSi('length', d.distanceMm),
              category: d.category,
              faces: disciplineFaceIds(mappings.data, d.id).length,
            }))}
          />
          <FederationFaces
            rows={ordered.flatMap((x) =>
              x.status === 'ok'
                ? [
                    {
                      id: x.data.id,
                      name: x.data.name,
                      uses: usedBy(x.data.id),
                      drawing: <TargetFaceDrawing face={x.data} />,
                    },
                  ]
                : [],
            )}
          />
        </>
      }
    />
  )
}
