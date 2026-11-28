import { useLingui } from '@lingui/react'
import type { Powder } from '@rangefoundry/schema'
import Link from '@/platform/link.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
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
import { verbatim } from '../lib/wording.ts'
import englishMessages from '../locales/en/components/burn-rate-section.json' with { type: 'json' }
import { Decimal } from './decimal.tsx'
import { FieldTable } from './field-table.tsx'
import { Panel } from './panel.tsx'
import { RateBar, RateTicks } from './rate-scale.tsx'

loadEnglish(englishMessages)

/** A powder of the burn-rate order as a neighbor link; `label` leaves out the page powder's manufacturer. */
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

/** A neighbor list: the unit of the mean vivacities once, in the heading. */
function Neighbours({ title, rows }: { title: string; rows: Neighbour[] }) {
  const { i18n } = useLingui()
  return (
    <div>
      <h3 className="record-heading">{title}</h3>
      {rows.length > 0 ? (
        <ol>
          {rows.map((r) => (
            <li key={r.id} value={r.order}>
              <Link
                href={`/powders/${encodeURIComponent(r.id)}`}
                title={i18n._({
                  id: 'powderRecord.neighbor',
                  message: '{label}, burn-rate order {order}',
                  values: { label: r.label, order: r.order },
                })}
              >
                {r.label}
              </Link>
              {r.rate !== undefined && (
                <span className="burn-rate-of">
                  <Decimal text={formatNumber(r.rate, 2)} />
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p>{i18n._({ id: 'powderRecord.none', message: 'None' })}</p>
      )}
    </div>
  )
}

/** The interval on the powder list's log scale; without a curve, the one sentence why. */
export function BurnRateSummary({
  powder,
  place,
  names,
}: {
  powder: Powder
  place?: BurnRatePlace | undefined
  names: ManufacturerNames
}) {
  const { i18n } = useLingui()
  const p = classifyPowder(powder, names)
  const n2 = (x: number) => formatNumber(x, 2)
  const m = isFitted(p) ? meanRate(p) : undefined
  // the burn-rate order is the strip's Burn rate card: not repeated here
  const rows: FieldRow[] = isFitted(p)
    ? [
        {
          label: /*i18n*/ { id: 'powderRecord.meanVivacity', message: 'Mean vivacity' },
          text: `${n2(m?.value ?? 0)}${m?.low === undefined || m.high === undefined ? '' : ` (${n2(m.low)} to ${n2(m.high)})`}`,
          words:
            m?.low === undefined || m.high === undefined
              ? [verbatim(n2(m?.value ?? 0))]
              : [
                  /*i18n*/ {
                    id: 'powderRecord.meanInterval',
                    message: '{value} ({low} to {high})',
                    values: { value: n2(m.value), low: n2(m.low), high: n2(m.high) },
                  },
                ],
          unit: vivacityUnit,
          numeric: true as const,
          method: /*i18n*/ {
            id: 'powderRecord.meanMethod',
            message: 'Mean dynamic vivacity over burnt fraction 0.1 to 0.9, with its interval.',
          },
        },
      ]
    : []
  return (
    <Panel
      id="burn-rate"
      title={/*i18n*/ { id: 'powderRecord.burnRate', message: 'Burn rate (model output)' }}
      translated
    >
      {isFitted(p) ? (
        <>
          <div className="burn-rate-body">
            <FieldTable
              caption={/*i18n*/ { id: 'powderRecord.burnRateTable', message: 'Burn rate' }}
              labelledBy="burn-rate"
              groups={[{ rows }]}
            />
            {place && m && (
              <div className="burn-scale">
                <RateTicks domain={place.domain} />
                <RateBar domain={place.domain} mean={m.value} low={m.low} high={m.high} />
              </div>
            )}
          </div>
          {/* the only fitted powder has no neighbors: no "None" twice */}
          {place && place.faster.length + place.slower.length > 0 && (
            <div className="burn-neighbours">
              <Neighbours
                title={i18n._({
                  id: 'powderRecord.faster',
                  message: 'Faster ({unit})',
                  values: { unit: vivacityUnit },
                })}
                rows={place.faster}
              />
              <Neighbours
                title={i18n._({
                  id: 'powderRecord.slower',
                  message: 'Slower ({unit})',
                  values: { unit: vivacityUnit },
                })}
                rows={place.slower}
              />
              <p className="record-note">
                {i18n._({
                  id: 'powderRecord.neighborNote',
                  message:
                    'A neighbor is a candidate, not a substitute: it needs a new charge workup before it replaces this powder.',
                })}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="record-note">{i18n._(p.why)}</p>
      )}
    </Panel>
  )
}
