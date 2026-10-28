// Spike for #338: coverage of the chi-square interval for a velocity SD on non-normal strings,
// against a percentile bootstrap, and the shots needed for a given relative half-width.
// Run: node spikes/sd-interval/simulate.ts [replications] [bootstrap resamples] > table.md
import { chiSquareQuantile } from '../../packages/core/src/groups/chi-square.ts'

const replications = Number(process.argv[2] ?? 10000)
const resamples = Number(process.argv[3] ?? 1000)
const sizes = [3, 5, 10, 20, 30, 50]
const levels = [0.9, 0.95]

// mulberry32, seeded so the tables reproduce
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const uniform = rng(338)
const normal = (): number =>
  Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform())

interface Case {
  name: string
  /** Population SD of `draw`. */
  sd: number
  /** Population excess kurtosis. */
  kurtosis: number
  skewness: number
  draw: () => number
}

const w = Math.exp(0.25)
const cases: Case[] = [
  { name: 'normal', sd: 1, kurtosis: 0, skewness: 0, draw: normal },
  {
    // sum of four unit exponentials: gamma with shape 4
    name: 'skewed (gamma, shape 4)',
    sd: 2,
    kurtosis: 1.5,
    skewness: 1,
    draw: () => {
      let sum = 0
      for (let i = 0; i < 4; i++) sum -= Math.log(1 - uniform())
      return sum
    },
  },
  {
    name: 'strongly skewed (lognormal, sigma 0.5)',
    sd: Math.sqrt((w - 1) * w),
    kurtosis: w ** 4 + 2 * w ** 3 + 3 * w ** 2 - 6,
    skewness: (w + 2) * Math.sqrt(w - 1),
    draw: () => Math.exp(0.5 * normal()),
  },
  {
    // Student t with 5 degrees of freedom: normal over sqrt(chi-square_5 / 5)
    name: 'heavy-tailed (Student t, 5 df)',
    sd: Math.sqrt(5 / 3),
    kurtosis: 6,
    skewness: 0,
    draw: () => {
      let q = 0
      for (let i = 0; i < 5; i++) q += normal() ** 2
      return normal() / Math.sqrt(q / 5)
    },
  },
  {
    // a stray shot: 5 % of the shots from a normal with three times the SD
    name: 'stray shots (95 % N(0,1) + 5 % N(0,3^2))',
    sd: Math.sqrt(1.4),
    kurtosis: 15 / 1.96 - 3,
    skewness: 0,
    draw: () => (uniform() < 0.05 ? 3 * normal() : normal()),
  },
]

function sampleSd(v: ArrayLike<number>, n: number): number {
  let mean = 0
  for (let i = 0; i < n; i++) mean += v[i] as number
  mean /= n
  let s = 0
  for (let i = 0; i < n; i++) s += ((v[i] as number) - mean) ** 2
  return Math.sqrt(s / (n - 1))
}

/** Chi-square interval for the SD at two-sided `level`, as factors of the sample SD. */
function chiFactors(n: number, level: number): { lo: number; hi: number } {
  const a = (1 - level) / 2
  return {
    lo: Math.sqrt((n - 1) / chiSquareQuantile(1 - a, n - 1)),
    hi: Math.sqrt((n - 1) / chiSquareQuantile(a, n - 1)),
  }
}

interface Tally {
  below: number
  above: number
  width: number[]
}
const tally = (): Tally => ({ below: 0, above: 0, width: [] })
function record(t: Tally, lo: number, hi: number, sd: number): void {
  if (sd < lo) t.below++
  else if (sd > hi) t.above++
  t.width.push((hi - lo) / 2 / sd)
}
const cover = (t: Tally): number => 1 - (t.below + t.above) / replications
const median = (a: number[]): number => {
  const s = Float64Array.from(a).sort()
  return s[Math.floor(s.length / 2)] as number
}
const pct = (x: number): string => (100 * x).toFixed(1)

const chi = new Map<string, Tally>()
const boot = new Map<string, Tally>()
const key = (c: string, n: number, level: number): string => `${c}|${n}|${level}`

for (const c of cases) {
  for (const n of sizes) {
    const factors = levels.map((level) => chiFactors(n, level))
    for (const level of levels) {
      chi.set(key(c.name, n, level), tally())
      boot.set(key(c.name, n, level), tally())
    }
    const x = new Float64Array(n)
    const y = new Float64Array(n)
    const sds = new Float64Array(resamples)
    for (let r = 0; r < replications; r++) {
      for (let i = 0; i < n; i++) x[i] = c.draw()
      const s = sampleSd(x, n)
      for (let b = 0; b < resamples; b++) {
        for (let i = 0; i < n; i++) y[i] = x[Math.floor(uniform() * n)] as number
        sds[b] = sampleSd(y, n)
      }
      sds.sort()
      levels.forEach((level, l) => {
        const f = factors[l] as { lo: number; hi: number }
        record(chi.get(key(c.name, n, level)) as Tally, s * f.lo, s * f.hi, c.sd)
        const a = (1 - level) / 2
        const lo = sds[Math.floor(a * resamples)] as number
        const hi = sds[Math.min(resamples - 1, Math.floor((1 - a) * resamples))] as number
        record(boot.get(key(c.name, n, level)) as Tally, lo, hi, c.sd)
      })
    }
  }
}

const out: string[] = []
const mcse = Math.sqrt((0.95 * 0.05) / replications)
out.push(
  `Replications per cell: ${replications}, bootstrap resamples: ${resamples}, seed 338. Monte Carlo standard error of a coverage near 95 %: ${pct(mcse)} points.`,
  '',
  '### Distributions',
  '',
  '| Case | Skewness | Excess kurtosis |',
  '|---|---|---|',
  ...cases.map((c) => `| ${c.name} | ${c.skewness.toFixed(2)} | ${c.kurtosis.toFixed(2)} |`),
)
for (const level of levels) {
  out.push(
    '',
    `### Coverage of the true SD, ${level * 100} % intervals (percent; miss below / miss above in brackets)`,
    '',
    `| Case | Method | ${sizes.map((n) => `n=${n}`).join(' | ')} |`,
    `|---|---|${sizes.map(() => '---').join('|')}|`,
  )
  for (const c of cases) {
    for (const [method, map] of [
      ['chi-square', chi],
      ['bootstrap', boot],
    ] as const) {
      const cells = sizes.map((n) => {
        const t = map.get(key(c.name, n, level)) as Tally
        return `${pct(cover(t))} (${pct(t.below / replications)} / ${pct(t.above / replications)})`
      })
      out.push(`| ${c.name} | ${method} | ${cells.join(' | ')} |`)
    }
  }
}
for (const level of levels) {
  out.push(
    '',
    `### Median half-width of the interval over the true SD, ${level * 100} % (percent)`,
    '',
    `| Case | Method | ${sizes.map((n) => `n=${n}`).join(' | ')} |`,
    `|---|---|${sizes.map(() => '---').join('|')}|`,
  )
  for (const c of cases) {
    for (const [method, map] of [
      ['chi-square', chi],
      ['bootstrap', boot],
    ] as const) {
      const cells = sizes.map((n) => pct(median((map.get(key(c.name, n, level)) as Tally).width)))
      out.push(`| ${c.name} | ${method} | ${cells.join(' | ')} |`)
    }
  }
}

// Shots needed (normal theory, no simulation): half-width (hi - lo) / 2 of the interval relative to
// the sample SD depends on n and the level only.
out.push(
  '',
  '### Chi-square interval as factors of the sample SD',
  '',
  '| n | 90 % lower | 90 % upper | 90 % half-width | 95 % lower | 95 % upper | 95 % half-width |',
  '|---|---|---|---|---|---|---|',
)
for (const n of [3, 4, 5, 6, 8, 10, 15, 20, 30, 50]) {
  const cells = levels.flatMap((level) => {
    const { lo, hi } = chiFactors(n, level)
    return [lo.toFixed(2), hi.toFixed(2), `${pct((hi - lo) / 2)} %`]
  })
  out.push(`| ${n} | ${cells.join(' | ')} |`)
}
out.push(
  '',
  '### Shots needed for a relative half-width of the SD interval',
  '',
  '| Half-width | 90 % | 95 % |',
  '|---|---|---|',
)
for (const target of [0.5, 0.3, 0.2]) {
  const cells = levels.map((level) => {
    for (let n = 2; n < 1000; n++) {
      const { lo, hi } = chiFactors(n, level)
      if ((hi - lo) / 2 <= target) return String(n)
    }
    return '> 1000'
  })
  out.push(`| ${target * 100} % | ${cells.join(' | ')} |`)
}
console.log(out.join('\n'))
