import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CaseCartridgeNote } from '../../../components/case-cartridge-note.tsx'
import { FieldStrip } from '../../../components/field-strip.tsx'
import { FieldTable } from '../../../components/field-table.tsx'
import { Panel } from '../../../components/panel.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { msg } from '../../../i18n/translate.ts'
import {
  getCase,
  getManufacturerNames,
  listAllCartridges,
  listAllCases,
  staticIds,
} from '../../../lib/api.ts'
import { productLabel } from '../../../lib/manufacturers.ts'
import { caseRowGroups, caseStrip } from '../../../lib/record-fields.ts'

export function generateStaticParams() {
  return staticIds(listAllCases, 'case')
}

/** The id a `catalogue:<id>` reference names. */
const idOf = (ref: string) => ref.slice(ref.indexOf(':') + 1)

export async function generateMetadata({ params }: PageProps<'/cases/[id]'>): Promise<Metadata> {
  const { id } = await params
  const r = await getCase(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const names = await getManufacturerNames()
  const label = productLabel(
    { name: r.data.name ?? id, manufacturer: idOf(r.data.manufacturer) },
    names,
  )
  return {
    title: label,
    description: `Recorded properties of the case ${label}, with sources.`,
  }
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function CasePage({ params }: PageProps<'/cases/[id]'>) {
  const { id } = await params
  const r = await getCase(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Case" />
  const c = r.data
  // a catalogue record always has its provenance
  if (!c.provenance) return <ServerDataError what="Case" />
  const [names, cartridges] = await Promise.all([getManufacturerNames(), listAllCartridges()])
  const maker = names.get(idOf(c.manufacturer))
  const cartridgeId = idOf(c.cartridge)
  const cartridge =
    cartridges.status === 'ok' ? cartridges.data.find((x) => x.id === cartridgeId) : undefined
  const groups = caseRowGroups(c).filter((g) => g.rows.length > 0)
  return (
    <RecordPage
      title={productLabel({ name: c.name ?? id, ...(maker && { manufacturerName: maker }) })}
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
