// Exponent choices of RULE.md from the per-powder fits of fit.mts, the parameter files of
// candidate.mts, and a per-row dump of every candidate on the validation split. Never reads the
// test split. Everything written is local.
// node spikes/594/dump.mts <fit.json> <out dir> <rows> <records>...
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { predict } from '../../packages/cli/dist/evaluate.js'
import { loadRecords, type Records } from '../../packages/cli/dist/records.js'
import { readRows } from '../../packages/cli/dist/rows.js'
import { splitOf } from '../../packages/cli/dist/split.js'
import { byText, percentile } from '../../packages/cli/dist/stats.js'
import { familyOf, unseenPowder } from '../../packages/cli/dist/unseen.js'
import { interior as m3 } from '../../packages/core/dist/index.js'

type Powder = NonNullable<ReturnType<Records['powders']['get']>>
interface Fit {
  key: string
  rows: number
  fits: { n: number; viv: number; sse: number }[]
}

const [fitPath, out, rowsPath, ...roots] = process.argv.slice(2)
if (!fitPath || !out || !rowsPath)
  throw new Error('usage: dump.mts <fit.json> <out dir> <rows> <records>...')
const fit = JSON.parse(readFileSync(fitPath, 'utf8')) as Record<string, Fit>
const records = loadRecords(roots)
const { rows } = readRows(rowsPath)
const grid = Object.values(fit)[0]?.fits.map((f) => f.n) ?? []
const median = (xs: number[]) => percentile(xs, 0.5) as number

// training cartridges of the rows each fitted powder was fitted on
const cartridgesOf = new Map<string, Set<string>>()
for (const row of rows) {
  if (splitOf(row.cartridge) !== 'training' || !fit[row.powder]) continue
  if ('reason' in predict(row, records, m3)) continue
  cartridgesOf.set(row.powder, (cartridgesOf.get(row.powder) ?? new Set()).add(row.cartridge))
}

const familyOfId = (id: string) => familyOf(records.powders.get(id))
const fitted = Object.keys(fit).sort(byText)

/** The grid exponent with the least summed objective over `ids`. */
function choose(ids: string[]) {
  const total = grid.map((_, k) => ids.reduce((s, id) => s + (fit[id]?.fits[k]?.sse ?? 0), 0))
  return grid[total.indexOf(Math.min(...total))] as number
}
const factorAt = (id: string, n: number) => fit[id]?.fits.find((f) => f.n === n)?.viv

// in sample: one exponent per family over all its powders
const inSample = new Map<string, number>()
for (const family of new Set(fitted.map(familyOfId)))
  inSample.set(family, choose(fitted.filter((id) => familyOfId(id) === family)))

// leave one powder out, with the size test and the pooled fallback of RULE.md
interface Choice {
  n: number
  fallback: boolean
  others: string[]
}
const lopo = new Map<string, Choice>()
const named = [...new Set(rows.map((r) => r.powder))].filter(
  (id) => records.powders.get(id)?.interior,
)
for (const id of named) {
  const others = fitted.filter((q) => q !== id && familyOfId(q) === familyOfId(id))
  const cartridges = new Set(others.flatMap((q) => [...(cartridgesOf.get(q) ?? [])]))
  const small = others.length < 3 || cartridges.size < 5
  lopo.set(id, {
    n: choose(small ? fitted.filter((q) => q !== id) : others),
    fallback: small,
    others,
  })
}

const withPowder = (base: Records, p: Powder): Records => ({
  ...base,
  powders: new Map([...base.powders, [p.id, p]]),
})
const scaled = (p: Powder, viv: number, n: number, energy?: number): Powder => {
  const i = p.interior as NonNullable<Powder['interior']>
  return {
    ...p,
    interior: {
      ...i,
      pressureExponent: n,
      vivacity: { ...i.vivacity, value: viv },
      ...(energy !== undefined && { energy: { ...i.energy, value: energy } }),
    },
  }
}

// one records set per powder and candidate
const variants = new Map<string, Record<string, Records>>()
const params: Record<string, Record<string, { viv: number; n: number }>> = { in: {}, lopo: {} }
const fittedSet = named.flatMap((id) => {
  const p = records.powders.get(id)
  return p ? [p] : []
})
for (const id of named) {
  const p = records.powders.get(id) as Powder
  const viv = (p.interior as NonNullable<Powder['interior']>).vivacity.value
  const v: Record<string, Records> = {}
  const nIn = inSample.get(familyOfId(id))
  const fIn = nIn === undefined ? undefined : factorAt(id, nIn)
  if (nIn !== undefined && fIn !== undefined) {
    v.in = withPowder(records, scaled(p, viv * fIn, nIn))
    params.in[fit[id]?.key as string] = { viv: fIn, n: nIn }
  }
  const c = lopo.get(id) as Choice
  const fL = factorAt(id, c.n)
  if (fL !== undefined) {
    v.lopo = withPowder(records, scaled(p, viv * fL, c.n))
    params.lopo[fit[id]?.key as string] = { viv: fL, n: c.n }
  }
  const u = unseenPowder(p, fittedSet)
  if (u) v.unseenBase = withPowder(records, u)
  // the unseen powder at the leave-one-out exponent: family medians of the others at that exponent
  const pool = c.others.length > 0 ? c.others : fitted.filter((q) => q !== id)
  const vivs = pool.flatMap((q) => {
    const f = factorAt(q, c.n)
    const r = records.powders.get(q)?.interior
    return f !== undefined && r ? [r.vivacity.value * f] : []
  })
  const energies = pool.flatMap((q) => {
    const r = records.powders.get(q)?.interior
    return r ? [r.energy.value] : []
  })
  if (vivs.length > 0)
    v.unseen = withPowder(records, scaled(p, median(vivs), c.n, median(energies)))
  variants.set(id, v)
}

const run = (row: (typeof rows)[number], recs: Records | undefined) => {
  if (!recs) return null
  const q = predict(row, recs, m3)
  return 'reason' in q ? { reason: q.reason } : { v: q.velocity, p: q.pressure / 1e5 }
}

const lines: string[] = []
for (const row of rows) {
  const split = splitOf(row.cartridge)
  if (split !== 'validation') continue
  const v = variants.get(row.powder) ?? {}
  const base = run(row, records)
  const lopoRecs = v.lopo ?? records
  lines.push(
    JSON.stringify({
      cartridge: row.cartridge,
      powder: row.powder,
      family: familyOfId(row.powder),
      table: row.table,
      printedV: row.velocity,
      printedP: row.pressure ?? null,
      base,
      in: run(row, v.in ?? records),
      lopo: run(row, lopoRecs),
      lopoFitted: v.lopo !== undefined,
      unseenBase: run(row, v.unseenBase),
      unseen: run(row, v.unseen),
      baseCharge: run({ ...row, charge: row.charge * 1.02 }, records),
      baseShort:
        row.barrel === undefined ? null : run({ ...row, barrel: row.barrel * 0.9 }, records),
      lopoCharge: run({ ...row, charge: row.charge * 1.02 }, lopoRecs),
      lopoShort:
        row.barrel === undefined ? null : run({ ...row, barrel: row.barrel * 0.9 }, lopoRecs),
    }),
  )
}
writeFileSync(join(out, 'rows.jsonl'), `${lines.join('\n')}\n`)
writeFileSync(join(out, 'params-in.json'), JSON.stringify({ powders: params.in }))
writeFileSync(join(out, 'params-lopo.json'), JSON.stringify({ powders: params.lopo }))
writeFileSync(
  join(out, 'choices.json'),
  JSON.stringify({
    grid,
    inSample: Object.fromEntries(inSample),
    lopo: Object.fromEntries(
      [...lopo].map(([id, c]) => [
        id,
        {
          n: c.n,
          fallback: c.fallback,
          others: c.others.length,
          family: familyOfId(id),
          nIn: inSample.get(familyOfId(id)) ?? null,
          trainingRows: fit[id]?.rows ?? 0,
          factor: factorAt(id, c.n) ?? null,
        },
      ]),
    ),
    familyCartridges: Object.fromEntries(
      [...new Set(fitted.map(familyOfId))].map((f) => [
        f,
        {
          powders: fitted.filter((q) => familyOfId(q) === f).length,
          cartridges: new Set(
            fitted
              .filter((q) => familyOfId(q) === f)
              .flatMap((q) => [...(cartridgesOf.get(q) ?? [])]),
          ).size,
        },
      ]),
    ),
  }),
)
console.error(`${lines.length} validation rows`)
