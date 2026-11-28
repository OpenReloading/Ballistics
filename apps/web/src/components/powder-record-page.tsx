import { useLingui } from '@lingui/react'
import type { Cartridge, Powder } from '@rangefoundry/schema'
import { ChartColumn } from 'lucide-react'
import { loadEnglish } from '../i18n/lingui.ts'
import { fetchPowderList } from '../lib/api-client.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { PowderSummary } from '../lib/api-types.ts'
import {
  classifyPowder,
  isFitted,
  neighbours,
  orderPowders,
  rateDomain,
  uncertaintyFactor,
} from '../lib/burn-rate.ts'
import { powderIncomplete } from '../lib/complete-records.ts'
import { countryOf } from '../lib/countries.ts'
import {
  fetchManufacturerNames,
  type ManufacturerNames,
  productLabel,
  withManufacturerName,
} from '../lib/manufacturers.ts'
import { fittedEnergyRatio } from '../lib/powder-record.ts'
import { workbenchHref } from '../lib/query.ts'
import { powderParameterGroups, powderRowGroups, powderStrip } from '../lib/record-fields.ts'
import { tunePowderHref } from '../lib/tune-href.ts'
import englishMessages from '../locales/en/components/powder-record-page.json' with { type: 'json' }
import { type BurnRatePlace, BurnRateSummary, type Neighbour } from './burn-rate-section.tsx'
import { FieldStrip } from './field-strip.tsx'
import { FieldPanel, FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { PowderFit } from './powder-fit.tsx'
import { LinkButton } from './record-actions.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'
import { SimulationNotice } from './simulation-notice.tsx'
import { VivacityPanel } from './vivacity-panel.tsx'

loadEnglish(englishMessages)

/** The powder's burn-rate order among all fitted powders and its neighbors; undefined without one. */
function place(
  list: PowderSummary[],
  names: ManufacturerNames,
  p: Powder,
): BurnRatePlace | undefined {
  const rows = orderPowders(withManufacturerName(list, names))
  const n = neighbours(rows, p.id)
  if (!n) return undefined
  const link = (r: (typeof n.faster)[number]): Neighbour => ({
    id: r.id,
    // a neighbor of the same manufacturer by its name alone: the page names the manufacturer
    label: r.manufacturer === p.manufacturer ? r.name : productLabel(r),
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

/** Besides the record: the manufacturer names, a fitted powder's place in the burn-rate order, the cartridges the manufacturer lists it for. */
interface Extras {
  names: ManufacturerNames
  placed: BurnRatePlace | undefined
  cartridgeNames: ReadonlyMap<string, string>
}

/** The names of the cartridge records `ids`; a record that does not load is left out. */
async function cartridgeNamesOf(ids: string[], signal: AbortSignal) {
  const records = await Promise.all(
    ids.map((id) => fetchRecord<Cartridge>('cartridges', id, signal).catch(() => undefined)),
  )
  return new Map(records.flatMap((c) => (c ? [[c.id, c.name] as const] : [])))
}

function PowderRecord({ p, names, placed, cartridgeNames }: { p: Powder } & Extras) {
  const { i18n } = useLingui()
  const manufacturerName = names.get(p.manufacturer)
  const curve = classifyPowder(p, names)
  const ratio = fittedEnergyRatio(p)
  const parameters = powderParameterGroups(
    p,
    uncertaintyFactor,
    ratio === undefined ? undefined : { value: ratio },
  )
  const data = powderRowGroups(p, cartridgeNames).filter((g) => g.rows.length > 0)
  const properties = /*i18n*/ { id: 'powderRecord.data', message: 'Properties' }
  return (
    <RecordPage
      title={productLabel(p, names)}
      // a phone: the name alone, the strip's first card names the manufacturer
      short={p.name}
      // form and base are cards of the strip
      badges={
        powderIncomplete(p)
          ? [
              /*i18n*/ {
                id: 'powderRecord.valuesMissing',
                message: 'Values missing: no burn values',
              },
            ]
          : []
      }
      className="record-chart"
      compare={isFitted(curve) ? `/powders/burn-rates?add=${encodeURIComponent(p.id)}` : undefined}
      workbench={workbenchHref('powder', p.id)}
      more={
        <LinkButton
          href={tunePowderHref(`catalogue:${p.id}`)}
          icon={<ChartColumn aria-hidden="true" />}
        >
          {i18n._({ id: 'powderRecord.tuneFromStrings', message: 'Tune from strings' })}
        </LinkButton>
      }
      provenance={p.provenance}
      kind="powders"
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
          {p.interior && <SimulationNotice />}
          {isFitted(curve) && parameters.length > 0 && (
            <FieldPanel
              id="model-parameters"
              title={/*i18n*/ { id: 'powderRecord.modelParameters', message: 'Model parameters' }}
              groups={parameters}
            />
          )}
          {/* a record with no values beyond the strip (only a name and its sources) gets no empty table */}
          {(data.length > 0 || p.note) && (
            <Panel id="record-data" title={properties} translated>
              {data.length > 0 && (
                <FieldTable caption={properties} labelledBy="record-data" groups={data} />
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

/** The powder record page: the record from its data file, the burn-rate chart and tables rendered in the browser. */
export function PowderRecordPage({ id, name }: { id: string; name: string }) {
  return (
    <RecordViewWith<Powder, Extras>
      kind="powders"
      id={id}
      name={name}
      what="Powder"
      extras={async (p, signal) => {
        const names = await fetchManufacturerNames()
        const placed = isFitted(classifyPowder(p, names))
          ? place(await fetchPowderList(signal), names, p)
          : undefined
        const cartridgeNames = await cartridgeNamesOf(p.listedCartridges ?? [], signal)
        return { names, placed, cartridgeNames }
      }}
    >
      {(p, extras) => <PowderRecord p={p} {...extras} />}
    </RecordViewWith>
  )
}
