'use client'

import type { Primer } from '@open-reloading/schema'
import { msg } from '../i18n/translate.ts'
import {
  fetchManufacturerNames,
  type ManufacturerNames,
  productLabel,
} from '../lib/manufacturers.ts'
import { primerRowGroups, primerStrip } from '../lib/record-fields.ts'
import { FieldStrip } from './field-strip.tsx'
import { FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'

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
            values={
              <Panel id="record-data" title={msg('Properties')} translated>
                <FieldTable caption={msg('Properties')} labelledBy="record-data" groups={groups} />
                {p.note && <p className="record-note">{p.note}</p>}
              </Panel>
            }
          />
        )
      }}
    </RecordViewWith>
  )
}
