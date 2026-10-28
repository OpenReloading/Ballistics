/**
 * Spike #339: tables from the cells of `extrapolation.mts`.
 *   node spikes/339/summarise.mts spikes/339/out > spikes/339/tables.md
 */

import { readdirSync, readFileSync } from 'node:fs'

interface Row {
  key: string
  n: number
  fail: number
  covV: number
  covP: number
  covPR: number | null
  halfV: number
  halfP: number
  kV: number
  kP: number
}
const dir = process.argv[2] ?? 'spikes/339/out'
const rows: Row[] = []
let reps = 0
const failures: [string, number][] = []
for (const d of readdirSync(dir)) {
  const j = JSON.parse(readFileSync(`${dir}/${d}/cells.json`, 'utf8'))
  reps = j.reps
  rows.push(...j.rows)
  failures.push(...j.failures)
}
const worlds = ['exact', 'inputs', 'structure-mild', 'structure']
const byKey = new Map(rows.map((r) => [r.key, r]))

const parse = (key: string) => {
  const [world, ladder, axis, side, d] = key.split('|') as [string, string, string, string, string]
  return { world, ladder, axis, side, d }
}
/** Signed distance of a cell label: below negative. */
const dist = (side: string, d: string, axis = '') =>
  side === 'in'
    ? 0
    : (side === 'below' ? -1 : 1) *
      Number(d.replace(/^p/, '')) *
      // the value axes are binned by upper edge as a fraction, the others by percent
      (axis === 'velocity' || axis === 'pressure' ? 100 : 1)
const label = (side: string, d: string) =>
  side === 'in' ? 'inside' : `${side === 'below' ? '-' : '+'}${d.replace(/^p/, '')} %`

type Metric = 'covV' | 'covP' | 'covPR'
const fmt = (x: number | null | undefined) => (x === null || x === undefined ? '' : `${Math.round(x * 100)}`)

function table(ladder: string, axis: string, metric: Metric, binned = false): string {
  const dists = new Map<number, { side: string; d: string }>()
  for (const r of rows) {
    const p = parse(r.key)
    if (p.ladder === ladder && p.axis === axis) dists.set(dist(p.side, p.d, p.axis), { side: p.side, d: p.d })
  }
  const keys = [...dists.entries()].sort((a, b) => a[0] - b[0])
  const head = `| distance | ${worlds.join(' | ')} | n (exact) |\n|---|${worlds.map(() => '---:').join('|')}|---:|\n`
  const body = keys
    .map(([, { side, d }]) => {
      const cols = worlds.map((w) => fmt(byKey.get(`${w}|${ladder}|${axis}|${side}|${d}`)?.[metric]))
      const n = byKey.get(`exact|${ladder}|${axis}|${side}|${d}`)?.n ?? ''
      const lab = binned && side !== 'in' ? (d === 'Infinity' ? `${side === 'below' ? '-' : '+'}over 40 %` : `${side === 'below' ? '-' : '+'}up to ${Number(d) * 100} %`) : label(side, d)
      return `| ${lab} | ${cols.join(' | ')} | ${n} |`
    })
    .join('\n')
  return head + body
}

function kTable(ladder: string, axis: string): string {
  const dists = new Map<number, { side: string; d: string }>()
  for (const r of rows) {
    const p = parse(r.key)
    if (p.ladder === ladder && p.axis === axis) dists.set(dist(p.side, p.d, p.axis), { side: p.side, d: p.d })
  }
  const keys = [...dists.entries()].sort((a, b) => a[0] - b[0])
  return (
    `| distance | ${worlds.join(' | ')} |\n|---|${worlds.map(() => '---:').join('|')}|\n` +
    keys
      .map(([, { side, d }]) => `| ${label(side, d)} | ${worlds.map((w) => (byKey.get(`${w}|${ladder}|${axis}|${side}|${d}`)?.kV ?? Number.NaN).toFixed(1)).join(' | ')} |`)
      .join('\n')
  )
}

/** Largest distance, from the inside outwards on one side, with the coverage at least `floor`. */
function margin(world: string, ladder: string, axis: string, side: string, metric: Metric, floor: number) {
  const base = byKey.get(`${world}|${ladder}|${axis}|in|0`)?.[metric]
  const need = base === null || base === undefined ? floor : Math.min(floor, base - 0.05)
  const cells = rows
    .map((r) => ({ r, p: parse(r.key) }))
    .filter(({ p }) => p.world === world && p.ladder === ladder && p.axis === axis && p.side === side)
    .map(({ r, p }) => ({ d: dist(p.side, p.d, p.axis), cov: r[metric] }))
    .sort((a, b) => Math.abs(a.d) - Math.abs(b.d))
  let ok = 0
  for (const c of cells) {
    if (c.cov === null || c.cov < need) return ok
    ok = Math.abs(c.d)
  }
  return ok
}

const out: string[] = []
out.push(`Replicates per world: ${reps}. Coverage in % of the 90 % interval, true value inside.\n`)
const sections: [string, string, string, Metric][] = [
  ['narrow', 'charge', 'Charge, velocity interval, ladder 2.2 to 2.6 g (5 charges)', 'covV'],
  ['narrow', 'charge', 'Charge, pressure interval of `predictPowder`, velocity-only ladder', 'covP'],
  ['narrow', 'charge', 'Charge, pressure range with fixed inputs (`powderPressureRange`), velocity-only ladder', 'covPR'],
  ['narrow+p', 'charge', 'Charge, pressure interval of `predictPowder`, ladder with pressure rows', 'covP'],
  ['narrow+p', 'charge', 'Charge, pressure range with fixed inputs, ladder with pressure rows', 'covPR'],
  ['wide', 'charge', 'Charge, velocity interval, ladder 1.9 to 2.7 g (6 charges)', 'covV'],
  ['narrow', 'barrel', 'Barrel length, one fitted length (0.6 m), velocity interval', 'covV'],
  ['narrow', 'barrel', 'Barrel length, one fitted length, pressure interval of `predictPowder`', 'covP'],
  ['two-barrels', 'barrel', 'Barrel length, fitted lengths 0.5 and 0.6 m, velocity interval', 'covV'],
  ['narrow', 'bore', 'Bore diameter (geometric scale), velocity interval', 'covV'],
  ['narrow', 'bore', 'Bore diameter (geometric scale), pressure interval', 'covP'],
]
for (const [ladder, axis, title, metric] of sections) {
  out.push(`### ${title}\n`, table(ladder, axis, metric), '')
}
out.push('### Coverage factor needed for 90 % (90th percentile of |error| / standard uncertainty; the fit uses 1.645), velocity, narrow ladder\n')
for (const axis of ['charge', 'barrel', 'bore']) {
  out.push(`Axis ${axis}\n`, kTable('narrow', axis), '')
}
for (const ladder of ['narrow', 'narrow+p']) {
  out.push(`### Velocity axis, ${ladder}: velocity interval by distance of the predicted velocity above or below the ladder's velocities\n`)
  out.push(table(ladder, 'velocity', 'covV', true), '')
  out.push(`### Pressure axis, ${ladder}: pressure interval of \`predictPowder\` by distance of the predicted pressure outside the ladder's pressures\n`)
  out.push(table(ladder, 'pressure', 'covP', true), '')
  out.push(`### Pressure axis, ${ladder}: pressure range with fixed inputs\n`)
  out.push(table(ladder, 'pressure', 'covPR', true), '')
}

out.push('### Largest relative distance with coverage of at least 85 %, or within 5 points of the coverage inside the ladder where that is lower (nominal 90 %)\n')
out.push('| axis, interval, ladder | side | ' + worlds.join(' | ') + ' |', '|---|---|' + worlds.map(() => '---:').join('|') + '|')
const marginRows: [string, string, string, Metric][] = [
  ['charge velocity narrow', 'narrow', 'charge', 'covV'],
  ['charge velocity wide', 'wide', 'charge', 'covV'],
  ['charge pressure narrow', 'narrow', 'charge', 'covP'],
  ['charge pressure range narrow', 'narrow', 'charge', 'covPR'],
  ['charge pressure narrow+p', 'narrow+p', 'charge', 'covP'],
  ['charge pressure range narrow+p', 'narrow+p', 'charge', 'covPR'],
  ['barrel velocity, one length', 'narrow', 'barrel', 'covV'],
  ['barrel velocity, two lengths', 'two-barrels', 'barrel', 'covV'],
  ['barrel pressure, one length', 'narrow', 'barrel', 'covP'],
  ['bore velocity', 'narrow', 'bore', 'covV'],
  ['bore pressure', 'narrow', 'bore', 'covP'],
  ['velocity axis (value distance)', 'narrow', 'velocity', 'covV'],
  ['pressure axis (value distance)', 'narrow', 'pressure', 'covP'],
  ['pressure axis, range (value distance)', 'narrow', 'pressure', 'covPR'],
]
for (const [name, ladder, axis, metric] of marginRows) {
  for (const side of ['above', 'below']) {
    const cols = worlds.map((w) => {
      const inside = byKey.get(`${w}|${ladder}|${axis}|in|0`)?.[metric]
      const m = margin(w, ladder, axis, side, metric, 0.85)
      const base = inside === null || inside === undefined ? '' : inside < 0.85 ? ` (inside ${fmt(inside)} %)` : ''
      if (inside !== null && inside !== undefined && inside < 0.5) return `n/a (inside ${fmt(inside)} %)`
      return `${m} %${base}`
    })
    out.push(`| ${name} | ${side} | ${cols.join(' | ')} |`)
  }
}

out.push('\n### Failures (fits, ladders, ranges, predictions)\n')
const failMap = new Map<string, number>()
for (const [k, n] of failures) failMap.set(k, n)
out.push(failMap.size === 0 ? 'No failed fit, ladder or range.' : [...failMap].map(([k, n]) => `- ${k}: ${n}`).join('\n'))
const predFail = rows.filter((r) => r.fail > 0)
out.push(
  predFail.length === 0
    ? 'No failed prediction.'
    : `Predictions skipped (truth or prediction invalid): ${predFail.reduce((s, r) => s + r.fail, 0)} in ${predFail.length} cells, for example ${predFail.slice(0, 5).map((r) => `${r.key} (${r.fail})`).join(', ')}.`,
)
console.log(out.join('\n'))
