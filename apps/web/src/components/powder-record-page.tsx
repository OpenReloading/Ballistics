'use client'

import type { Powder } from '@open-reloading/schema'
import { fetchPowderList } from '../lib/api-client.ts'
import type { PowderSummary } from '../lib/api-types.ts'
import {
  classifyPowder,
  isFitted,
  neighbours,
  orderPowders,
  rateDomain,
  uncertaintyFactor,
} from '../lib/burn-rate.ts'
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
import { type BurnRatePlace, BurnRateSummary, type Neighbour } from './burn-rate-section.tsx'
import { FieldStrip } from './field-strip.tsx'
import { FieldPanel, FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { PowderFit } from './powder-fit.tsx'
import { RecordPage } from './record-page.tsx'
import { RecordViewWith } from './record-view.tsx'
import { VivacityPanel } from './vivacity-panel.tsx'

/** The powder's burn-rate order among all fitted powders and its neighbours; undefined without one. */
function place(
  list: PowderSummary[],
  names: ManufacturerNames,
  id: string,
): BurnRatePlace | undefined {
  const rows = orderPowders(withManufacturerName(list, names))
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

/** What the page reads besides the record: the manufacturer names and, for a fitted powder, its place in the burn-rate order. */
interface Extras {
  names: ManufacturerNames
  placed: BurnRatePlace | undefined
}

function PowderRecord({ p, names, placed }: { p: Powder } & Extras) {
  const manufacturerName = names.get(p.manufacturer)
  const curve = classifyPowder(p, names)
  const ratio = fittedEnergyRatio(p)
  const parameters = powderParameterGroups(
    p,
    uncertaintyFactor,
    ratio === undefined ? undefined : { value: ratio },
  )
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
            <FieldPanel id="model-parameters" title="Model parameters" groups={parameters} />
          )}
          {/* a record with no values beyond the strip (only a name and its sources) gets no empty table */}
          {(data.length > 0 || p.note) && (
            <Panel id="record-data" title="Properties">
              {data.length > 0 && (
                <FieldTable caption="Properties" labelledBy="record-data" groups={data} />
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
          ? place(await fetchPowderList(signal), names, p.id)
          : undefined
        return { names, placed }
      }}
    >
      {(p, extras) => <PowderRecord p={p} {...extras} />}
    </RecordViewWith>
  )
}
