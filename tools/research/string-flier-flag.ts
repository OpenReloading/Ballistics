/**
 * Research script: a flier screen for a string of N shots. The shot farthest from the string mean is
 * compared with the mean and sample standard deviation of the other N - 1 shots. The factor k is
 * calibrated on one seed for a false-flag rate per clean string of 5, 1 and 0.1 percent, the rate is
 * measured on an independent seed, and planted fliers of 4, 6 and 8 standard deviations give the
 * detection rate. Every seed is fixed. Run from the repository root:
 * `node tools/research/string-flier-flag.ts`.
 */
import { normals } from '../../packages/core/test/random.ts'

const CALIBRATION = 1_000_000
const VALIDATION = 300_000
const DETECTION = 300_000
const LEVELS = [0.05, 0.01, 0.001]
const PLANTED = [4, 6, 8]

interface Statistic {
  /** Distance of the shot farthest from the string mean, from the mean of the other shots, in their SDs. */
  either: number
  /** Same for the highest shot, signed. */
  high: number
  /** Index of the shot farthest from the string mean. */
  farthest: number
}

/** The statistics of one string held in `x`. */
function statistic(x: Float64Array): Statistic {
  const n = x.length
  let sum = 0
  let sq = 0
  for (const v of x) {
    sum += v
    sq += v * v
  }
  const m = sum / n
  let far = 0
  let top = 0
  for (let i = 1; i < n; i++) {
    if (Math.abs((x[i] as number) - m) > Math.abs((x[far] as number) - m)) far = i
    if ((x[i] as number) > (x[top] as number)) top = i
  }
  const against = (i: number) => {
    const v = x[i] as number
    const mo = (sum - v) / (n - 1)
    const variance = (sq - v * v - (n - 1) * mo * mo) / (n - 2)
    return (v - mo) / Math.sqrt(variance)
  }
  return { either: Math.abs(against(far)), high: against(top), farthest: far }
}

/** Statistics of `count` clean strings of `n` shots, sigma 1. */
function clean(n: number, count: number, seed: number) {
  const normal = normals(seed)
  const either = new Float64Array(count)
  const high = new Float64Array(count)
  const x = new Float64Array(n)
  for (let s = 0; s < count; s++) {
    for (let i = 0; i < n; i++) x[i] = normal()
    const st = statistic(x)
    either[s] = st.either
    high[s] = st.high
  }
  return { either, high }
}

const quantile = (a: Float64Array, p: number) =>
  Float64Array.from(a).sort()[Math.min(a.length - 1, Math.floor(p * a.length))] as number
const rate = (a: Float64Array, k: number) => {
  let c = 0
  for (const v of a) if (v > k) c++
  return c / a.length
}

/** Share of strings in which the planted shot, `shift` SD above the true mean, is the one flagged. */
function detection(n: number, shift: number, k: number, count: number, seed: number): number {
  const normal = normals(seed)
  const x = new Float64Array(n)
  let found = 0
  for (let s = 0; s < count; s++) {
    for (let i = 0; i < n; i++) x[i] = normal()
    x[0] = (x[0] as number) + shift
    const st = statistic(x)
    if (st.farthest === 0 && st.either > k) found++
  }
  return found / count
}

const f = (x: number, d = 2) => x.toFixed(d)
const rows: { n: number; k: number[]; kHigh: number[]; rateAt1: number; detect: number[] }[] = []
for (let n = 5; n <= 30; n++) {
  const cal = clean(n, CALIBRATION, 370_100 + n)
  const k = LEVELS.map((a) => quantile(cal.either, 1 - a))
  const kHigh = LEVELS.map((a) => quantile(cal.high, 1 - a))
  const val = clean(n, VALIDATION, 370_200 + n)
  const k1 = k[1] as number
  rows.push({
    n,
    k,
    kHigh,
    rateAt1: rate(val.either, k1),
    detect: PLANTED.map((d, j) => detection(n, d, k1, DETECTION, 370_300 + 100 * j + n)),
  })
}

console.log(
  `Calibration ${CALIBRATION} clean strings per N, validation ${VALIDATION}, detection ${DETECTION} per planted size\n`,
)
console.log('| N | k 5 % | k 1 % | k 0.1 % | high only 5 % | 1 % | 0.1 % |')
console.log('| --- | --- | --- | --- | --- | --- | --- |')
for (const r of rows)
  console.log(
    `| ${r.n} | ${r.k.map((v) => f(v)).join(' | ')} | ${r.kHigh.map((v) => f(v)).join(' | ')} |`,
  )
console.log(
  '\n| N | false-flag rate at the 1 % k, independent seed | found, planted 4 SD | 6 SD | 8 SD |',
)
console.log('| --- | --- | --- | --- | --- |')
for (const r of rows)
  console.log(
    `| ${r.n} | ${f(100 * r.rateAt1, 3)} % | ${r.detect.map((v) => `${f(100 * v, 1)} %`).join(' | ')} |`,
  )

console.log('\nk at 1 %, either end, N = 10 to 30 (data):')
console.log(
  `[${rows
    .filter((r) => r.n >= 10)
    .map((r) => f(r.k[1] as number))
    .join(', ')}]`,
)

const falseOk = rows.filter((r) => r.n >= 8).every((r) => r.rateAt1 >= 0.005 && r.rateAt1 <= 0.015)
const powerOk = rows.filter((r) => r.n >= 10).every((r) => (r.detect[2] as number) > 0.9)
console.log(`\nRule: false-flag rate 0.5 to 1.5 % for N = 8 to 30: ${falseOk}`)
console.log(`Rule: planted 8 SD flier found in more than 90 % of strings for N >= 10: ${powerOk}`)
console.log(`build: ${falseOk && powerOk ? 'yes' : 'no'}`)
