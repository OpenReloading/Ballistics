/**
 * Research script: extreme spread of circular normal groups against the shot count, its 5th to 95th
 * percentile, the largest and smallest of a series of five-shot groups, and the ratio of three-shot
 * to five-shot means. Every seed is fixed. Run from the repository root:
 * `node tools/research/group-extreme-spread-per-shot-count.ts`.
 */
import { normals } from '../../packages/core/test/random.ts'

/** Groups per shot count in the table. */
const GROUPS = 1_000_000
/** Independent groups per shot count for the coverage of the stated range. */
const CHECK_GROUPS = 200_000
/** Five-shot groups in the pool the series are cut from. */
const POOL = 4_000_000
const SERIES = [8, 12, 20]
/** The reference values of the issue, mean in sigma, for the build rule. */
const REFERENCE: Record<number, number> = { 2: 1.77, 3: 2.41, 5: 3.07, 10: 3.81 }

/** Extreme spreads of `count` circular normal groups of `n` shots, sigma 1 on each axis. */
function spreads(n: number, count: number, seed: number): Float64Array {
  const normal = normals(seed)
  const out = new Float64Array(count)
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  for (let g = 0; g < count; g++) {
    for (let i = 0; i < n; i++) {
      x[i] = normal()
      y[i] = normal()
    }
    let max = 0
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const d = (x[i] as number) - (x[j] as number)
        const e = (y[i] as number) - (y[j] as number)
        const s = d * d + e * e
        if (s > max) max = s
      }
    out[g] = Math.sqrt(max)
  }
  return out
}

const mean = (a: Iterable<number> & { length: number }) => {
  let s = 0
  for (const v of a) s += v
  return s / a.length
}
const quantile = (sorted: Float64Array, p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] as number

const table: { n: number; mean: number; p5: number; p95: number; coverage: number }[] = []
for (let n = 2; n <= 20; n++) {
  const a = spreads(n, GROUPS, 370_000 + n)
  const m = mean(a)
  const sorted = Float64Array.from(a).sort()
  const p5 = quantile(sorted, 0.05)
  const p95 = quantile(sorted, 0.95)
  const check = spreads(n, CHECK_GROUPS, 371_000 + n)
  let inside = 0
  for (const v of check) if (v >= p5 && v <= p95) inside++
  table.push({ n, mean: m, p5, p95, coverage: inside / CHECK_GROUPS })
}

console.log(`Groups per n: ${GROUPS}; coverage check: ${CHECK_GROUPS} independent groups per n\n`)
console.log('| n | mean ES (sigma) | 5th pct | 95th pct | 5th to 95th contains |')
console.log('| --- | --- | --- | --- | --- |')
for (const r of table)
  console.log(
    `| ${r.n} | ${r.mean.toFixed(3)} | ${r.p5.toFixed(2)} | ${r.p95.toFixed(2)} | ${(100 * r.coverage).toFixed(1)} % |`,
  )

console.log('\nTable as data (mean, p5, p95; n = 2 to 20):')
console.log(
  `[${table.map((r) => `[${r.mean.toFixed(3)}, ${r.p5.toFixed(2)}, ${r.p95.toFixed(2)}]`).join(', ')}]`,
)

console.log('\nRule: mean within 2 % of the issue values')
let ok = true
for (const [n, ref] of Object.entries(REFERENCE)) {
  const row = table[Number(n) - 2]
  const rel = (row?.mean ?? Number.NaN) / ref - 1
  if (!(Math.abs(rel) <= 0.02)) ok = false
  console.log(`n = ${n}: ${row?.mean.toFixed(3)} against ${ref}: ${(100 * rel).toFixed(2)} %`)
}
console.log(`build: ${ok ? 'yes' : 'no'}`)

const three = (table[1] as { mean: number }).mean
const five = (table[3] as { mean: number }).mean
console.log(`\nMean ES, 3 shots over 5 shots: ${(three / five).toFixed(3)}`)

const pool = spreads(5, POOL, 372_005)
const poolMean = mean(pool)
console.log(
  `\nSeries of k five-shot groups (${POOL} groups cut into series; pool mean ${poolMean.toFixed(3)} sigma)`,
)
console.log(
  '| k | series | largest / expected ES | smallest / expected ES | largest / series mean | smallest / series mean |',
)
console.log('| --- | --- | --- | --- | --- | --- |')
for (const k of SERIES) {
  const series = Math.floor(POOL / k)
  let hi = 0
  let lo = 0
  let hiRel = 0
  let loRel = 0
  for (let s = 0; s < series; s++) {
    let max = 0
    let min = Number.POSITIVE_INFINITY
    let sum = 0
    for (let i = 0; i < k; i++) {
      const v = pool[s * k + i] as number
      sum += v
      if (v > max) max = v
      if (v < min) min = v
    }
    hi += max
    lo += min
    hiRel += max / (sum / k)
    loRel += min / (sum / k)
  }
  console.log(
    `| ${k} | ${series} | ${(hi / series / poolMean).toFixed(3)} | ${(lo / series / poolMean).toFixed(3)} | ${(hiRel / series).toFixed(3)} | ${(loRel / series).toFixed(3)} |`,
  )
}
