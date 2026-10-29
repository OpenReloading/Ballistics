// Aggregates of one split that `verify` does not print: used rows, velocity median and P90, mean
// signed peak-pressure error, mean bearing length and the velocity median per bearing-length tercile.
// node spikes/360/aggregate.mts <split> <rows> <records>... [--limits a,b]
// The variants read SPIKE_CP and SPIKE_LREF_MM from the environment.

import { outcomes } from '../../packages/cli/dist/evaluate.js'
import { loadRecords } from '../../packages/cli/dist/records.js'
import { readRows } from '../../packages/cli/dist/rows.js'
import { percentile } from '../../packages/cli/dist/stats.js'
import { interior } from '../../packages/core/dist/index.js'
import { fromSi } from '../../packages/schema/dist/index.js'

const args = process.argv.slice(2)
const at = args.indexOf('--limits')
const given = at < 0 ? undefined : args.splice(at, 2)[1]?.split(',').map(Number)
const [split, rowsPath, ...roots] = args
if (!split || !rowsPath) throw new Error('usage: <split> <rows> <records>... [--limits a,b]')

const records = loadRecords(roots)
const { rows } = readRows(rowsPath)
const used = outcomes(rows, records, interior, [split as 'training']).flatMap((o) =>
  'velocity' in o.prediction
    ? [
        {
          error: Math.abs(o.prediction.velocity - o.row.velocity) / o.row.velocity,
          pressure:
            o.row.pressure === undefined
              ? undefined
              : (fromSi('pressure', o.prediction.pressure) - o.row.pressure) / o.row.pressure,
          length: records.bullets.get(o.row.bullet)?.length?.value ?? Number.NaN,
        },
      ]
    : [],
)
const median = (v: number[]) => percentile(v, 0.5)
const lengths = used.map((u) => u.length).filter(Number.isFinite)
const limits = given ?? [
  percentile(lengths, 1 / 3) ?? Number.NaN,
  percentile(lengths, 2 / 3) ?? Number.NaN,
]
const [low = Number.NaN, high = Number.NaN] = limits
const tercile = (pick: (l: number) => boolean) => {
  const e = used.filter((u) => pick(u.length)).map((u) => u.error)
  return { rows: e.length, velocityMedian: median(e) }
}
const signed = used.flatMap((u) => (u.pressure === undefined ? [] : [u.pressure]))
console.log(
  JSON.stringify({
    split,
    usedRows: used.length,
    velocityMedian: median(used.map((u) => u.error)),
    velocityP90: percentile(
      used.map((u) => u.error),
      0.9,
    ),
    pressureRows: signed.length,
    pressureMeanSigned: signed.reduce((a, b) => a + b, 0) / signed.length,
    meanLengthMm: lengths.reduce((a, b) => a + b, 0) / lengths.length,
    limits,
    terciles: [
      tercile((l) => l <= low),
      tercile((l) => l > low && l <= high),
      tercile((l) => l > high),
    ],
  }),
)
