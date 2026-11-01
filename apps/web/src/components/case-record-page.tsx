'use client'

import type { CatalogueCase } from '@open-reloading/schema'
import { msg } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { CartridgeDetail } from '../lib/api-types.ts'
import {
  fetchManufacturerNames,
  type ManufacturerNames,
  productLabel,
} from '../lib/manufacturers.ts'
import { caseRowGroups, caseStrip } from '../lib/record-fields.ts'
import { refId } from '../lib/record-metadata.ts'
import { CaseCartridgeNote } from './case-cartridge-note.tsx'
import { FieldStrip } from './field-strip.tsx'
import { FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'

/** What the page reads besides the record: the manufacturer names and the cartridge the case is for. */
interface Extras {
  names: ManufacturerNames
  cartridge: CartridgeDetail | undefined
}

function CaseRecord({ c, names, cartridge }: { c: CatalogueCase } & Extras) {
  const maker = names.get(refId(c.manufacturer))
  const groups = caseRowGroups(c).filter((g) => g.rows.length > 0)
  return (
    <RecordPage
      title={productLabel({ name: c.name, ...(maker && { manufacturerName: maker }) })}
      badges={[]}
      provenance={c.provenance}
      strip={<FieldStrip items={caseStrip(c, maker)} />}
      values={
        <Panel id="record-data" title={msg('Properties')} translated>
          <FieldTable caption={msg('Properties')} labelledBy="record-data" groups={groups} />
          {cartridge && <CaseCartridgeNote id={cartridge.id} name={cartridge.name} />}
          {c.note && <p className="record-note">{c.note}</p>}
        </Panel>
      }
    />
  )
}

/** The case record page: the record from its data file, rendered in the browser. */
export function CaseRecordPage({ id, name }: { id: string; name: string }) {
  return (
    <RecordViewWith<CatalogueCase, Extras>
      kind="cases"
      id={id}
      name={name}
      what="Case"
      extras={async (c, signal) => {
        const [names, cartridge] = await Promise.all([
          fetchManufacturerNames(),
          fetchRecord<CartridgeDetail>('cartridges', refId(c.cartridge), signal),
        ])
        return { names, cartridge }
      }}
    >
      {(c, extras) => <CaseRecord c={c} {...extras} />}
    </RecordViewWith>
  )
}
