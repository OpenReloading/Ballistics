import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FieldStrip } from '../../../components/field-strip.tsx'
import { FieldTable } from '../../../components/field-table.tsx'
import { Panel } from '../../../components/panel.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { msg } from '../../../i18n/translate.ts'
import { getManufacturerNames, getPrimer, listAllPrimers, staticIds } from '../../../lib/api.ts'
import { productLabel } from '../../../lib/manufacturers.ts'
import { primerRowGroups, primerStrip } from '../../../lib/record-fields.ts'

export function generateStaticParams() {
  return staticIds(listAllPrimers, 'primer')
}

export async function generateMetadata({ params }: PageProps<'/primers/[id]'>): Promise<Metadata> {
  const { id } = await params
  const r = await getPrimer(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const names = await getManufacturerNames()
  const label = productLabel({ name: r.data.name, manufacturer: r.data.manufacturer }, names)
  return {
    title: label,
    description: `Recorded properties of the primer ${label}, with sources.`,
  }
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function PrimerPage({ params }: PageProps<'/primers/[id]'>) {
  const { id } = await params
  const r = await getPrimer(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Primer" />
  const p = r.data
  const maker = (await getManufacturerNames()).get(p.manufacturer)
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
}
