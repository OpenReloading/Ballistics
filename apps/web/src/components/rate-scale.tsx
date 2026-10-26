import { type RateDomain, rateAt, rateTicks } from '../lib/burn-rate.ts'
import { formatNumber } from '../lib/units.ts'

/** Width of the scale in px: the list's cells and its header ticks share it. */
export const scaleWidth = 160
const x = (d: RateDomain, v: number) => 12 + rateAt(d, v) * (scaleWidth - 24)

/** The labelled ticks: the powers of ten only where all of them would crowd the width. */
const labelTicks = (domain: RateDomain) => {
  const all = rateTicks(domain)
  return all.length > 5 ? all.filter((t) => /^10*$/.test(String(t).replace(/^0\.0*/, ''))) : all
}

/** The tick labels of the log scale, for the header above the bars. */
export function RateTicks({ domain }: { domain: RateDomain }) {
  return (
    <svg width={scaleWidth} height="14" aria-hidden="true" className="rate-ticks">
      {labelTicks(domain).map((t) => (
        <text key={t} x={x(domain, t)} y="11" textAnchor="middle">
          {formatNumber(t, t < 1 ? 1 : 0)}
        </text>
      ))}
    </svg>
  )
}

/** Dot at the mean and a bar over the interval on the log scale of `domain`, beside the numbers. */
export function RateBar({
  domain,
  mean,
  low,
  high,
}: {
  domain: RateDomain
  mean: number
  low?: number | undefined
  high?: number | undefined
}) {
  return (
    <svg width={scaleWidth} height="28" aria-hidden="true">
      {/* a ruler under every row, one path: the header's labelled ticks long, the 5 steps short */}
      <path
        d={rateTicks(domain)
          .filter(
            (t) => labelTicks(domain).includes(t) || /^5/.test(String(t).replace(/^0\.0*/, '')),
          )
          .map((t) => {
            const major = labelTicks(domain).includes(t)
            return `M${x(domain, t).toFixed(1)} ${major ? 4 : 10}V${major ? 24 : 18}`
          })
          .join('')}
        stroke="var(--border)"
        strokeWidth="1"
        fill="none"
      />
      {low !== undefined && high !== undefined && (
        <line
          x1={x(domain, low)}
          x2={x(domain, high)}
          y1="14"
          y2="14"
          stroke="var(--muted)"
          strokeWidth="2"
        />
      )}
      <circle
        cx={x(domain, mean)}
        cy="14"
        r="4"
        fill="var(--link)"
        stroke="var(--bg)"
        strokeWidth="2"
      />
    </svg>
  )
}
