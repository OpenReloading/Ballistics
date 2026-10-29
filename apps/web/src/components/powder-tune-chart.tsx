import type { PowderPrediction } from '@open-reloading/core'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import type { ChargeRow } from '../lib/measurements.ts'
import type { HandPoint } from '../lib/powder-fit.ts'
import { niceTicks, tickDecimals } from '../lib/ticks.ts'
import type { UnitSystem } from '../lib/units.ts'
import { PanelTable } from './scroll-region.tsx'

const W = 520
const H = 220
const m = { l: 48, r: 10, t: 8, b: 32 }

/**
 * Muzzle velocity against charge: the ladder's charge range shaded, the band and the curve of the
 * fit (the hand-tuned `curve` in its place when given), and each charge's measured mean with one
 * SD. Drawn as plain SVG, so the route loads no chart library. The Chart data table below it lists
 * the drawn curve and band per charge step.
 */
export function TuneChart({
  band,
  curve = band.map((p) => ({ charge: p.charge, velocity: p.velocity.value })),
  ladder,
  rows,
  system,
}: {
  band: readonly PowderPrediction[]
  curve?: readonly HandPoint[] | undefined
  ladder: { min: number; max: number }
  rows: readonly ChargeRow[]
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const c = system.charge
  const v = system.velocity
  const measured = rows.flatMap((r) => (r.velocityStats ? [r] : []))
  const xs = [...band.map((p) => p.charge), ...measured.map((r) => r.charge)].map(c.fromSi)
  const ys = [
    ...band.flatMap((p) => [p.velocity.lower, p.velocity.upper]),
    ...curve.map((p) => p.velocity),
    ...measured.flatMap(({ velocityStats: s }) =>
      s ? [s.mean - (s.standardDeviation ?? 0), s.mean + (s.standardDeviation ?? 0)] : [],
    ),
  ].map(v.fromSi)
  if (band.length < 2) return null
  const xt = niceTicks(Math.min(...xs), Math.max(...xs))
  const yt = niceTicks(Math.min(...ys), Math.max(...ys))
  const [x0, x1, y0, y1] = [xt[0], xt.at(-1), yt[0], yt.at(-1)]
  if (x0 === undefined || x1 === undefined || y0 === undefined || y1 === undefined) return null
  const X = (kg: number) => m.l + ((c.fromSi(kg) - x0) / (x1 - x0)) * (W - m.l - m.r)
  const Y = (ms: number) => H - m.b - ((v.fromSi(ms) - y0) / (y1 - y0)) * (H - m.t - m.b)
  const at = (kg: number, ms: number) => `${X(kg).toFixed(1)},${Y(ms).toFixed(1)}`
  const name = t(
    'Simulated muzzle velocity with its band and measured mean velocity against charge',
  )
  // the hand-tuned curve leaves out a charge the model cannot run
  const tuned = new Map(curve.map((p) => [p.charge, p.velocity]))
  const speed = (ms: number) => formatNumber(v.fromSi(ms), 1)
  return (
    <>
      <svg className="tune-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={name}>
        <title>{name}</title>
        <rect
          className="ladder-range"
          x={X(ladder.min)}
          width={X(ladder.max) - X(ladder.min)}
          y={m.t}
          height={H - m.t - m.b}
        />
        {yt.map((y) => (
          <g key={y}>
            <line className="grid" x1={m.l} x2={W - m.r} y1={Y(v.toSi(y))} y2={Y(v.toSi(y))} />
            <text x={m.l - 4} y={Y(v.toSi(y)) + 4} textAnchor="end">
              {formatNumber(y, tickDecimals(yt))}
            </text>
          </g>
        ))}
        {xt.map((x) => (
          <text key={x} x={X(c.toSi(x))} y={H - m.b + 14} textAnchor="middle">
            {formatNumber(x, tickDecimals(xt))}
          </text>
        ))}
        <text x={(m.l + W - m.r) / 2} y={H - 3} textAnchor="middle">
          {t('Charge ({unit})', { unit: c.symbol })}
        </text>
        <text x={10} y={H / 2} transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle">
          {t('Velocity ({unit})', { unit: v.symbol })}
        </text>
        <polygon
          className="band"
          points={[
            ...band.map((p) => at(p.charge, p.velocity.upper)),
            ...[...band].reverse().map((p) => at(p.charge, p.velocity.lower)),
          ].join(' ')}
        />
        <polyline className="curve" points={curve.map((p) => at(p.charge, p.velocity)).join(' ')} />
        {measured.map(({ charge, velocityStats: s }) =>
          s ? (
            <g key={charge} className="measured">
              <line
                x1={X(charge)}
                x2={X(charge)}
                y1={Y(s.mean - (s.standardDeviation ?? 0))}
                y2={Y(s.mean + (s.standardDeviation ?? 0))}
              />
              <circle cx={X(charge)} cy={Y(s.mean)} r={3.5} />
            </g>
          ) : null,
        )}
      </svg>
      <details className="values-details">
        <summary>{t('Chart data')}</summary>
        <PanelTable
          label={t('Chart data')}
          caption={t('Velocity and band per charge step (simulation)')}
          columns={[
            t('Charge ({unit})', { unit: c.symbol }),
            t('Velocity ({unit})', { unit: v.symbol }),
            t('{level} % band ({unit})', {
              level: formatNumber((band[0]?.level ?? 0) * 100, 0),
              unit: v.symbol,
            }),
          ]}
        >
          {band.map((p) => {
            const velocity = tuned.get(p.charge)
            return (
              <tr key={p.charge}>
                <td className="num">{formatNumber(c.fromSi(p.charge), c.decimals)}</td>
                <td className="num">{velocity === undefined ? '' : speed(velocity)}</td>
                <td className="num">
                  {t('{lower} to {upper}', {
                    lower: speed(p.velocity.lower),
                    upper: speed(p.velocity.upper),
                  })}
                </td>
              </tr>
            )
          })}
        </PanelTable>
      </details>
    </>
  )
}
