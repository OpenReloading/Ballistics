'use client'

import type { Primer } from '@rangefoundry/schema'
import { loadEnglish } from '../i18n/lingui.ts'
import {
  fetchManufacturerNames,
  type ManufacturerNames,
  productLabel,
} from '../lib/manufacturers.ts'
import { primerRowGroups, primerStrip } from '../lib/record-fields.ts'
import englishMessages from '../locales/en/components/primer-record-page.json' with { type: 'json' }
import { FieldStrip } from './field-strip.tsx'
import { FieldPanel } from './field-table.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'

loadEnglish(englishMessages)

/** The primer record page: the record from its data file, rendered in the browser. */
export function PrimerRecordPage({ id, name }: { id: string; name: string }) {
  return (
    <RecordViewWith<Primer, ManufacturerNames>
      kind="primers"
      id={id}
      name={name}
      what="Primer"
      extras={() => fetchManufacturerNames()}
    >
      {(p, names) => {
        const maker = names.get(p.manufacturer)
        const groups = primerRowGroups(p).filter((g) => g.rows.length > 0)
        return (
          <RecordPage
            title={productLabel({ name: p.name, ...(maker && { manufacturerName: maker }) })}
            badges={[]}
            provenance={p.provenance}
            strip={<FieldStrip items={primerStrip(p, maker)} />}
            className="plain-record"
            values={
              <FieldPanel
                id="record-data"
                title={/*i18n*/ { id: 'primerRecord.data', message: 'Properties' }}
                groups={groups}
                symbols={false}
              >
                {p.note && <p className="record-note">{p.note}</p>}
              </FieldPanel>
            }
          />
        )
      }}
    </RecordViewWith>
  )
}
