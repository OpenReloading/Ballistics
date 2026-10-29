// Per-row dump of one interior model on the training and validation splits, for the fits and the
// bootstrap of this study. Never reads the test split. Output is local, one JSON object per line.
// node spikes/391/rows-dump.mts <rows> <out.jsonl> <m3|module> <records>...
import { writeFileSync } from 'node:fs'
import { predict } from '../../packages/cli/dist/evaluate.js'
import { loadModel } from '../../packages/cli/dist/model.js'
import { loadRecords } from '../../packages/cli/dist/records.js'
import { readRows } from '../../packages/cli/dist/rows.js'
import { splitOf } from '../../packages/cli/dist/split.js'
import { familyOf, unseenPowder } from '../../packages/cli/dist/unseen.js'
import { type InteriorLoad, interior as m3 } from '../../packages/core/dist/index.js'

const [rowsPath, out, spec = 'm3', ...roots] = process.argv.slice(2)
if (!rowsPath || !out)
  throw new Error('usage: rows-dump.mts <rows> <out.jsonl> <m3|module> <records>...')
const model = spec === 'm3' ? m3 : (await loadModel(spec)).interior
const records = loadRecords(roots)
const { rows } = readRows(rowsPath)

let load: InteriorLoad | undefined
let result: ReturnType<typeof m3> | undefined
const traced = ((l: InteriorLoad, o?: Parameters<typeof m3>[1]) => {
  load = l
  result = model(l, o)
  return result
}) as typeof m3

// the fitted set: powders the rows name whose record has interior parameters
const fittedSet = [...new Set(rows.map((r) => r.powder))].flatMap((id) => {
  const p = records.powders.get(id)
  return p?.interior ? [p] : []
})
const unseen = new Map(fittedSet.map((p) => [p.id, unseenPowder(p, fittedSet)]))

/** Features of a load and its result, the inputs of the correctors. */
const features = (l: InteriorLoad, r: typeof result) => ({
  mass: l.bullet.mass,
  volume: l.chamber.volume,
  boreArea: l.chamber.boreArea,
  travel: l.barrel.length,
  density: l.charge / l.chamber.volume,
  chargeRatio: l.charge / l.bullet.mass,
  expansion: (l.chamber.volume + l.chamber.boreArea * l.barrel.length) / l.chamber.volume,
  burnt: r?.valid ? r.muzzleBurntFraction : null,
  startPressure: l.startPressure,
  energy: l.propellant.specificEnergy,
  ...(l.propellant.burn.kind === 'vivacity' && { vivacity: l.propellant.burn.vivacity }),
})

const lines: string[] = []
for (const row of rows) {
  const split = splitOf(row.cartridge)
  if (split === 'test') continue
  load = undefined
  result = undefined
  const p = predict(row, records, traced)
  const powder = records.powders.get(row.powder)
  const base = {
    split,
    cartridge: row.cartridge,
    powder: row.powder,
    family: familyOf(powder),
    table: row.table,
    session: row.session,
    lot: row.lot,
    charge: row.charge,
    barrel: row.barrel,
    printedV: row.velocity,
    printedP: row.pressure,
  }
  if ('reason' in p) {
    lines.push(JSON.stringify({ ...base, reason: p.reason }))
    continue
  }
  const l = load as unknown as InteriorLoad
  const r0 = result
  const shift = (r: typeof row, recs = records) => {
    const q = predict(r, recs, traced)
    return 'reason' in q || !load
      ? null
      : { v: q.velocity, p: q.pressure / 1e5, ...features(load, result) }
  }
  lines.push(
    JSON.stringify({
      ...base,
      v: p.velocity,
      p: p.pressure / 1e5,
      ...features(l, r0),
      // perturbed loads for the direction check, validation only
      ...(split === 'validation' && {
        vCharge: shift({ ...row, charge: row.charge * 1.02 }),
        vShort: row.barrel === undefined ? null : shift({ ...row, barrel: row.barrel * 0.9 }),
        vUnseen: (() => {
          const u = unseen.get(row.powder)
          if (!u) return null
          return shift(row, { ...records, powders: new Map([...records.powders, [row.powder, u]]) })
        })(),
      }),
    }),
  )
}
writeFileSync(out, `${lines.join('\n')}\n`)
console.error(`${lines.length} rows`)
