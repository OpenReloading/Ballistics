import type { Powder } from '@open-reloading/schema'
import Link from 'next/link'
import { formatNumber } from '../i18n/number.ts'
import {
  classifyPowder,
  isFitted,
  meanRate,
  type RateDomain,
  vivacityUnit,
} from '../lib/burn-rate.ts'
import type { ManufacturerNames } from '../lib/manufacturers.ts'
import type { FieldRow } from '../lib/record-fields.ts'
import { FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { RateBar, RateTicks } from './rate-scale.tsx'

/** A powder of the burn-rate order as a neighbour link. */
export type Neighbour = { id: string; label: string; order: number; rate?: number | undefined }

/** The powder's place in the burn-rate order of all fitted powders (`neighbours` in `burn-rate.ts`). */
export interface BurnRatePlace {
  order: number
  total: number
  faster: Neighbour[]
  slower: Neighbour[]
  /** The log scale of the powder list, so the mark sits where it sits there. */
  domain: RateDomain
}

function Neighbours({ title, rows }: { title: string; rows: Neighbour[] }) {
  return (
    <div>
      <h3 className="record-heading">{title}</h3>
      {rows.length > 0 ? (
        <ol>
          {rows.map((r) => (
            <li key={r.id} value={r.order}>
              <Link
                href={`/powders/${encodeURIComponent(r.id)}`}
                title={`${r.label}, burn-rate order ${r.order}`}
              >
                {r.label}
              </Link>
              {r.rate !== undefined && (
                <span className="burn-rate-of">{formatNumber(r.rate, 2)}</span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p>None</p>
      )}
    </div>
  )
}

/**
 * The powder's burn rate panel: global burn-rate order and mean dynamic vivacity with its interval,
 * the interval on the powder list's log scale beside them, five faster and five slower powders as
 * links; without a curve, the one sentence why.
 */
export function BurnRateSummary({
  powder,
  place,
  names,
}: {
  powder: Powder
  place?: BurnRatePlace | undefined
  names: ManufacturerNames
}) {
  const p = classifyPowder(powder, names)
  const n2 = (x: number) => formatNumber(x, 2)
  const m = isFitted(p) ? meanRate(p) : undefined
  const rows: FieldRow[] = isFitted(p)
    ? [
        ...(place
          ? [
              {
                label: 'Burn-rate order',
                text: `${place.order} of ${place.total}`,
                method: '1 = fastest.',
              },
            ]
          : []),
        {
          label: 'Mean vivacity',
          text: `${n2(m?.value ?? 0)}${m?.low === undefined || m.high === undefined ? '' : ` (${n2(m.low)} to ${n2(m.high)})`}`,
          unit: vivacityUnit,
          method: 'Mean dynamic vivacity over burnt fraction 0.1 to 0.9, with its interval.',
        },
      ]
    : []
  return (
    <Panel id="burn-rate" title="Burn rate (model output)">
      {isFitted(p) ? (
        <>
          <div className="burn-rate-body">
            <FieldTable caption="Burn rate" labelledBy="burn-rate" groups={[{ rows }]} />
            {place && m && (
              <div className="burn-scale">
                <RateTicks domain={place.domain} />
                <RateBar domain={place.domain} mean={m.value} low={m.low} high={m.high} />
              </div>
            )}
          </div>
          {/* the only fitted powder has no neighbours: no "None" twice */}
          {place && place.faster.length + place.slower.length > 0 && (
            <div className="burn-neighbours">
              <Neighbours title="Faster" rows={place.faster} />
              <Neighbours title="Slower" rows={place.slower} />
            </div>
          )}
        </>
      ) : (
        <p className="record-note">{p.reason}</p>
      )}
    </Panel>
  )
}
