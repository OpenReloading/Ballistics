'use client'

import {
  compareDisciplines,
  compareTargetFaces,
  type TargetFace,
  toSi,
} from '@open-reloading/schema'
import { emptyDirectory, writeDirectory } from '../lib/directory.ts'
import {
  disciplineFaceIds,
  type FederationListItem,
  type FederationRecord,
  federationScope,
} from '../lib/disciplines.ts'
import type { DisciplineSummary, MappingSummary } from '../lib/face-disciplines.ts'
import { readItems, readRecord } from '../lib/record-reads.ts'
import { verbatim } from '../lib/wording.ts'
import {
  FederationData,
  FederationDisciplines,
  FederationFaces,
  FederationRuleBooks,
} from './federation-record.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'
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
      badges={[verbatim(f.abbreviation)]}
      className="federation-record"
      provenance={f.provenance}
      figure={<FederationRuleBooks books={f.ruleBooks} />}
      values={
        <FederationData
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
            listHref={`/disciplines${writeDirectory({ ...emptyDirectory, facets: { org: [f.abbreviation] } }, '')}`}
            rows={own.map((d) => ({
              id: d.id,
              number: d.number,
              name: d.name,
              distanceM: toSi('length', d.distanceMm),
              category: d.category,
              faces: disciplineFaceIds(mappings, d.id).length,
            }))}
          />
          <FederationFaces
            rows={ordered.map((x) => ({
              id: x.id,
              name: x.name,
              uses: usedBy(x.id),
              drawing: <TargetFaceDrawing face={x} />,
            }))}
          />
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
