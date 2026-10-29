import type { Change, CompareResult, Metrics, VerifyResult } from './result.ts'

/** A fraction as percent with one decimal, `-` for none. */
const pct = (x: number | null | undefined) => (x == null ? '-' : `${(100 * x).toFixed(1)}`)
/** A change in percentage points with its sign, `-` for none. */
const signed = (x: number | null | undefined) =>
  x == null ? '-' : `${x > 0 ? '+' : ''}${(100 * x).toFixed(2)}`

/** Left-aligned first column, right-aligned others, two spaces apart. */
function table(head: string[], body: string[][]): string {
  const all = [head, ...body]
  const widths = head.map((_, i) => Math.max(...all.map((r) => (r[i] ?? '').length)))
  return all
    .map((r) =>
      r.map((c, i) => (i === 0 ? c.padEnd(widths[i] ?? 0) : c.padStart(widths[i] ?? 0))).join('  '),
    )
    .join('\n')
}

const rowsOf = (name: string, m: Metrics) => [
  name,
  `${m.rows.used}/${m.rows.inSplit}`,
  pct(m.velocity?.median),
  pct(m.velocity?.p90),
  pct(m.pressure?.median),
  pct(m.pressure?.p90),
  pct(m.interval?.coverage),
]

const metricHead = ['group', 'used', 'v med %', 'v P90 %', 'p med %', 'p P90 %', 'cover %']

/** `verify` as text: the version, the interval and one line per group. */
export function verifyTable(r: VerifyResult): string {
  const groups = [
    rowsOf('all', r.overall),
    ...Object.entries(r.byFamily).map(([k, m]) => rowsOf(`family ${k}`, m)),
    ...Object.entries(r.byPowder).map(([k, m]) => rowsOf(`powder ${k}`, m)),
    ...Object.entries(r.grouped?.groups ?? {}).map(([k, m]) => rowsOf(`${r.grouped?.by} ${k}`, m)),
    ...(r.notInFittedSet
      ? [
          rowsOf(
            `powder not in the fitted set: no data (${r.notInFittedSet.powders} powders without a value)`,
            r.notInFittedSet,
          ),
        ]
      : []),
  ]
  const reasons = Object.entries(r.overall.rows.notUsed).map(([k, n]) => `${k} ${n}`)
  return [
    `model ${r.model}  version ${r.modelVersion}`,
    `split ${r.split}  interval half width ${pct(r.interval.halfWidth)} % from ${r.interval.trainingRows} training rows`,
    table(metricHead, groups),
    ...(reasons.length > 0 ? [`not used: ${reasons.join(', ')}`] : []),
  ].join('\n')
}

const changeRow = (name: string, c: Change) => [
  name,
  `${c.usedRows > 0 ? '+' : ''}${c.usedRows}`,
  signed(c.velocityMedian),
  signed(c.velocityP90),
  signed(c.pressureMedian),
  signed(c.pressureP90),
  signed(c.intervalCoverage),
]

/** `compare` as text: both versions and the change per group, in percentage points. */
export function compareTable(r: CompareResult): string {
  const groups = [
    changeRow('all', r.change.overall),
    ...Object.entries(r.change.byFamily).map(([k, c]) => changeRow(`family ${k}`, c)),
    ...Object.entries(r.change.grouped ?? {}).map(([k, c]) =>
      changeRow(`${r.candidate.grouped?.by} ${k}`, c),
    ),
  ]
  return [
    `baseline ${r.baseline.model}  version ${r.baseline.modelVersion}`,
    `candidate ${r.candidate.model}  version ${r.candidate.modelVersion}`,
    `split ${r.split}  change = candidate minus baseline, percentage points`,
    table(
      metricHead.map((h, i) => (i === 1 ? 'used' : h)),
      groups,
    ),
  ].join('\n')
}
