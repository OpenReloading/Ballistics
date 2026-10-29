// Per-powder refits on training rows only, on the loads the CLI builds from the rows.
// node spikes/391/fit.mts <exponent|rich> <shard>/<shards> <out.json> <rows> <records>...
// exponent: for each pressure exponent of the grid, the vivacity factor of each powder (1-D).
// rich: vivacity and energy factors and the form constants a and m of each powder (4 constants).
import { writeFileSync } from 'node:fs'
import { predict } from '../../packages/cli/dist/evaluate.js'
import { loadRecords } from '../../packages/cli/dist/records.js'
import { readRows } from '../../packages/cli/dist/rows.js'
import { splitOf } from '../../packages/cli/dist/split.js'
import { type InteriorLoad, interior } from '../../packages/core/dist/index.js'

// every index read through it is inside the array: the simplex has n + 1 points, each powder a row
const nth = <T,>(a: readonly T[], i: number) => a[i] as T

export const exponents = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3]

const [mode, shardText = '0/1', out, rowsPath, ...roots] = process.argv.slice(2)
if (!mode || !out || !rowsPath)
  throw new Error('usage: fit.mts <exponent|rich> <i>/<n> <out.json> <rows> <records>...')
const [shard, shards] = shardText.split('/').map(Number) as [number, number]
const records = loadRecords(roots)
const { rows } = readRows(rowsPath)

// the load of every used training row, by powder
const byPowder = new Map<string, { load: InteriorLoad; printed: number }[]>()
for (const row of rows) {
  if (splitOf(row.cartridge) !== 'training') continue
  let load: InteriorLoad | undefined
  const p = predict(row, records, ((l: InteriorLoad) => {
    load = l
    return interior(l)
  }) as typeof interior)
  if ('reason' in p || !load) continue
  byPowder.set(row.powder, [...(byPowder.get(row.powder) ?? []), { load, printed: row.velocity }])
}

type Burn = Extract<InteriorLoad['propellant']['burn'], { kind: 'vivacity' }>
type Twostage = Extract<Burn['form'], { kind: 'twoStage' }>
/** The load with the burn law and energy changed. */
export function changed(
  load: InteriorLoad,
  x: { viv: number; energy?: number; n?: number; a?: number; m?: number },
) {
  const burn = load.propellant.burn as Burn
  const form = burn.form as Twostage
  return {
    ...load,
    propellant: {
      ...load.propellant,
      specificEnergy: load.propellant.specificEnergy * (x.energy ?? 1),
      burn: {
        ...burn,
        vivacity: burn.vivacity * x.viv,
        exponent: x.n ?? burn.exponent,
        form: { ...form, a: x.a ?? form.a, m: x.m ?? form.m },
      },
    },
  } as InteriorLoad
}

const penalty = 1 // squared log error of a refused run
function sse(set: { load: InteriorLoad; printed: number }[], x: Parameters<typeof changed>[1]) {
  let s = 0
  for (const { load, printed } of set) {
    try {
      const r = interior(changed(load, x))
      s += r.valid && r.muzzleVelocity > 0 ? Math.log(r.muzzleVelocity / printed) ** 2 : penalty
    } catch {
      s += penalty
    }
  }
  return s
}

function golden(f: (t: number) => number, lo: number, hi: number, iterations = 24) {
  const g = (Math.sqrt(5) - 1) / 2
  let a = lo,
    b = hi,
    c = b - g * (b - a),
    d = a + g * (b - a),
    fc = f(c),
    fd = f(d)
  for (let i = 0; i < iterations; i++) {
    if (fc < fd) {
      b = d
      d = c
      fd = fc
      c = b - g * (b - a)
      fc = f(c)
    } else {
      a = c
      c = d
      fc = fd
      d = a + g * (b - a)
      fd = f(d)
    }
  }
  return fc < fd ? { t: c, f: fc } : { t: d, f: fd }
}

function nelderMead(f: (x: number[]) => number, x0: number[], step: number[], iterations = 160) {
  let s = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + (step[j] ?? 0.1) : v)))].map(
    (x) => ({ x, f: f(x) }),
  )
  for (let k = 0; k < iterations; k++) {
    s.sort((p, q) => p.f - q.f)
    const n = x0.length
    const c = x0.map((_, j) => s.slice(0, n).reduce((t, p) => t + (p.x[j] ?? 0), 0) / n)
    const worst = nth(s, n)
    const at = (t: number) => c.map((v, j) => v + t * ((worst.x[j] ?? 0) - v))
    const r = { x: at(-1), f: 0 }
    r.f = f(r.x)
    if (r.f < nth(s, 0).f) {
      const e = { x: at(-2), f: 0 }
      e.f = f(e.x)
      s[n] = e.f < r.f ? e : r
    } else if (r.f < nth(s, n - 1).f) s[n] = r
    else {
      const ct = { x: at(0.5), f: 0 }
      ct.f = f(ct.x)
      if (ct.f < worst.f) s[n] = ct
      else
        s = s.map((p, i) =>
          i === 0
            ? p
            : (() => {
                const x = p.x.map(
                  (v, j) => (nth(s, 0).x[j] ?? 0) + 0.5 * (v - (nth(s, 0).x[j] ?? 0)),
                )
                return { x, f: f(x) }
              })(),
        )
    }
  }
  s.sort((p, q) => p.f - q.f)
  return nth(s, 0)
}

const result: Record<string, unknown> = {}
const powders = [...byPowder.keys()].sort().filter((_, i) => i % shards === shard)
for (const id of powders) {
  const set = byPowder.get(id) ?? []
  const burn = nth(set, 0).load.propellant.burn as Burn
  const key = `${burn.vivacity}|${nth(set, 0).load.propellant.specificEnergy}`
  if (mode === 'exponent') {
    result[id] = {
      key,
      rows: set.length,
      fits: exponents.map((n) => {
        const g = golden((t) => sse(set, { viv: Math.exp(t), n }), -6, 6, 30)
        return { n, viv: Math.exp(g.t), sse: g.f }
      }),
    }
  } else {
    const form = burn.form as Twostage
    // log factors of vivacity and energy, then a and m; 1 + a z1 > 0 kept by a penalty
    const f = (x: number[]) => {
      const [lv = 0, le = 0, a = 0, m = 0] = x
      if (1 + a * form.z1 <= 0 || Math.abs(le) > 0.4) return 1e9
      return sse(set, { viv: Math.exp(lv), energy: Math.exp(le), a, m })
    }
    const best = nelderMead(f, [0, 0, form.a, form.m], [0.2, 0.05, 0.3, 0.2])
    const base = sse(set, { viv: 1 })
    const [lv = 0, le = 0, a = 0, m = 0] = best.x
    result[id] = {
      key,
      rows: set.length,
      viv: Math.exp(lv),
      energy: Math.exp(le),
      a,
      m,
      z1: form.z1,
      q: form.q,
      sse: best.f,
      sseRecord: base,
    }
  }
}
writeFileSync(out, JSON.stringify(result))
console.error(`${powders.length} powders`)
