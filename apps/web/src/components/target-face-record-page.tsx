'use client'

import type { TargetFace, TargetMapping } from '@open-reloading/schema'
import { msg } from '../i18n/translate.ts'
import { emptyDirectory, writeDirectory } from '../lib/directory.ts'
import type { FederationListItem } from '../lib/disciplines.ts'
import type { DisciplineSummary, MappingSummary } from '../lib/face-disciplines.ts'
import { withOrganization } from '../lib/face-organization.ts'
import { readItems, readRecord } from '../lib/record-reads.ts'
import { faceEventRows } from '../lib/target-faces.ts'
import { FaceEvents, FaceStrip, FaceValuesPanel } from './face-record.tsx'
import { Panel } from './panel.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'
import { TargetFaceDrawing } from './target-face-drawing.tsx'

/** What the page reads besides the record: the mappings of the face (the list leaves out the shot count), the disciplines and the federations. */
interface Extras {
  mappings: TargetMapping[]
  disciplines: DisciplineSummary[]
  federations: FederationListItem[]
}

function TargetFaceRecord({
  face,
  mappings,
  disciplines,
  federations,
}: { face: TargetFace } & Extras) {
  const f = withOrganization(face, federations)
  const rows = faceEventRows(f, mappings, disciplines, federations)
  // the sources are the page's own panel
  const { provenance: _, ...values } = f
  return (
    <RecordPage
      title={f.name}
      badges={[]}
      className="target-face-record"
      groups={`/groups?face=${encodeURIComponent(f.id)}`}
      provenance={f.provenance}
      strip={<FaceStrip face={values} />}
      figure={
        <Panel id="face-drawing" title={msg('Face')} translated>
          <TargetFaceDrawing face={f} />
        </Panel>
      }
      values={<FaceValuesPanel face={values} />}
      side={
        <FaceEvents
          rows={rows}
          listHref={
            mappings.length > 0
              ? `/disciplines${writeDirectory({ ...emptyDirectory, facets: { face: [f.id] } }, '')}`
              : undefined
          }
        />
      }
    />
  )
}

/** The target face record page: the face drawing and its events, rendered in the browser from the face's data file. */
export function TargetFaceRecordPage({ id, name }: { id: string; name: string }) {
  return (
    <RecordViewWith<TargetFace, Extras>
      kind="target-faces"
      id={id}
      name={name}
      what="Target face"
      extras={async (_, signal) => {
        const [listed, disciplines, federations] = await Promise.all([
          readItems<MappingSummary>(`target-mappings?face=${encodeURIComponent(id)}`, signal),
          readItems<DisciplineSummary>('disciplines', signal),
          readItems<FederationListItem>('federations', signal),
        ])
        // the list leaves out the shot count: the records hold it
        const mappings = await Promise.all(
          listed.map((m) => readRecord<TargetMapping>('target-mappings', m.id, signal)),
        )
        return { mappings, disciplines, federations }
      }}
    >
      {(face, extras) => <TargetFaceRecord face={face} {...extras} />}
    </RecordViewWith>
  )
}
