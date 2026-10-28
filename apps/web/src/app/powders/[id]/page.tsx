import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  type BurnRatePlace,
  BurnRateSummary,
  type Neighbour,
} from '../../../components/burn-rate-section.tsx'
import { FieldStrip } from '../../../components/field-strip.tsx'
import { FieldPanel, FieldTable } from '../../../components/field-table.tsx'
import { Panel } from '../../../components/panel.tsx'
import { PowderFit } from '../../../components/powder-fit.tsx'
import { RecordPage } from '../../../components/record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import { VivacityPanel } from '../../../components/vivacity-panel.tsx'
import { msg } from '../../../i18n/translate.ts'
import { getManufacturerNames, getPowder, listAllPowders, staticIds } from '../../../lib/api.ts'
import {
  classifyPowder,
  isFitted,
  neighbours,
  orderPowders,
  rateDomain,
  uncertaintyFactor,
} from '../../../lib/burn-rate.ts'
import { countryOf } from '../../../lib/countries.ts'
import { productLabel, withManufacturerName } from '../../../lib/manufacturers.ts'
import { fittedEnergyRatio } from '../../../lib/powder-record.ts'
import { workbenchHref } from '../../../lib/query.ts'
import { powderParameterGroups, powderRowGroups, powderStrip } from '../../../lib/record-fields.ts'

export function generateStaticParams() {
  return staticIds(listAllPowders, 'powder')
}

export async function generateMetadata({ params }: PageProps<'/powders/[id]'>): Promise<Metadata> {
  const { id } = await params
  const r = await getPowder(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const label = productLabel(r.data, await getManufacturerNames())
  return {
    title: label,
    description: `Recorded properties of ${label}, with sources.`,
  }
}

/** The powder's burn-rate order among all fitted powders and its neighbours; undefined without one. */
async function place(id: string): Promise<BurnRatePlace | undefined> {
  const [list, names] = await Promise.all([listAllPowders(), getManufacturerNames()])
  if (list.status !== 'ok') return undefined
  const rows = orderPowders(withManufacturerName(list.data, names))
  const n = neighbours(rows, id)
  if (!n) return undefined
  const link = (r: (typeof n.faster)[number]): Neighbour => ({
    id: r.id,
    label: productLabel(r),
    order: r.burnRateOrder ?? 0,
    rate: r.meanVivacity,
  })
  return {
    order: n.order,
    total: n.total,
    faster: n.faster.map(link),
    slower: n.slower.map(link),
    domain: rateDomain(rows),
  }
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function PowderPage({ params }: PageProps<'/powders/[id]'>) {
  const { id } = await params
  const r = await getPowder(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Powder" />
  const p = r.data
  const names = await getManufacturerNames()
  const manufacturerName = names.get(p.manufacturer)
  const curve = classifyPowder(p, names)
  const ratio = fittedEnergyRatio(p)
  const parameters = powderParameterGroups(
    p,
    uncertaintyFactor,
    ratio === undefined ? undefined : { value: ratio },
  )
  const placed = isFitted(curve) ? await place(p.id) : undefined
  const data = powderRowGroups(p).filter((g) => g.rows.length > 0)
  return (
    <RecordPage
      title={productLabel(p, names)}
      // form and base are cards of the strip
      badges={[]}
      className="record-chart"
      compare={isFitted(curve) ? `/powders/burn-rates?add=${encodeURIComponent(p.id)}` : undefined}
      workbench={workbenchHref('powder', p.id)}
      provenance={p.provenance}
      strip={
        <FieldStrip
          items={powderStrip(p, placed, manufacturerName)}
          country={p.country ? countryOf(p.country) : undefined}
        />
      }
      figure={
        <>
          <BurnRateSummary powder={p} place={placed} names={names} />
          {isFitted(curve) && <VivacityPanel powder={curve} z1={p.interior?.burnForm.z1} />}
        </>
      }
      values={
        <>
          {isFitted(curve) && parameters.length > 0 && (
            <FieldPanel id="model-parameters" title={msg('Model parameters')} groups={parameters} />
          )}
          {/* a record with no values beyond the strip (only a name and its sources) gets no empty table */}
          {(data.length > 0 || p.note) && (
            <Panel id="record-data" title={msg('Properties')} translated>
              {data.length > 0 && (
                <FieldTable caption={msg('Properties')} labelledBy="record-data" groups={data} />
              )}
              {p.note && <p className="record-note">{p.note}</p>}
            </Panel>
          )}
          {isFitted(curve) && <PowderFit powder={p} />}
        </>
      }
    />
  )
}
