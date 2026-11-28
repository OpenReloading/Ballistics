import { lstatSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Cartridge, CatalogueCaseCapacity } from '@rangefoundry/schema'
import { isEstimatedCapacity } from '@rangefoundry/schema'
import { storedValue } from '@rangefoundry/svg-drawings/cartridge'
import { waterDensityGramsPerCm3 } from '@rangefoundry/units'
import { DataError, Refusal } from './errors.ts'
import { loadRecords, type Records } from './records.ts'
import { percentile } from './stats.ts'

/** Volume (mm3) of the cones through the case outline of a cartridge record from the head to the mouth: P1 at the head, P2 at L1, H2 at L2 and the mouth (H1, else H2, else G1) at L3, cartridge values first, else the chamber's; undefined without P1 or L3. */
export function outlineVolume(cartridge: Pick<Cartridge, 'values'>): number | undefined {
  const v = (symbol: string) =>
    storedValue(cartridge.values, 'cartridge', symbol)?.value ??
    storedValue(cartridge.values, 'chamber', symbol)?.value
  const [p1, l3] = [v('P1'), v('L3')]
  const mouth = v('H1') ?? v('H2') ?? v('G1')
  if (!p1 || !l3 || !mouth) return undefined
  const points: [number, number][] = [[0, p1]]
  for (const [l, d] of [
    [v('L1'), v('P2')],
    [v('L2'), v('H2')],
  ])
    if (l && d && l < l3 && l > (points.at(-1)?.[0] ?? 0)) points.push([l, d])
  points.push([l3, mouth])
  let volume = 0
  for (let i = 1; i < points.length; i++) {
    const [[z0, d0], [z1, d1]] = [points[i - 1] as [number, number], points[i] as [number, number]]
    const [r0, r1] = [d0 / 2, d1 / 2]
    volume += ((Math.PI * (z1 - z0)) / 3) * (r0 * r0 + r0 * r1 + r1 * r1)
  }
  return volume
}

/** The median of water capacity over outline volume (both mm3) of `pairs`, and the root mean square of the relative error each pair's capacity gets from the median of the others. */
export function fillFactor(pairs: readonly { capacity: number; outline: number }[]) {
  const ratios = pairs.map((p) => p.capacity / p.outline)
  if (ratios.length < 3)
    throw new DataError('fewer than 3 cartridges have a capacity and an outline')
  const median = (xs: readonly number[]) => percentile(xs, 0.5) as number
  const loo = ratios.map((r, i) => median(ratios.filter((_, j) => j !== i)) / r - 1)
  return {
    factor: median(ratios),
    cartridges: ratios.length,
    looRms: Math.sqrt(loo.reduce((s, e) => s + e * e, 0) / loo.length),
  }
}

const milliliters = (grams: number) => (grams * 1000) / waterDensityGramsPerCm3

/** The fill factor over the cartridges of `records` with a capacity that is no estimate and an outline, and an estimated capacity record for each cartridge with an outline and neither a capacity nor a case with one. */
export function estimateCapacities(records: Records) {
  const pairs = [...records.capacities].flatMap(([id, c]) => {
    const outline =
      records.cartridges.get(id) && outlineVolume(records.cartridges.get(id) as Cartridge)
    return outline && !isEstimatedCapacity(c)
      ? [{ capacity: milliliters(c.waterCapacity.value), outline }]
      : []
  })
  const fill = fillFactor(pairs)
  const note = `Outline volume times ${fill.factor.toFixed(4)}, the median of capacity over outline volume of ${fill.cartridges} cartridges with a capacity record; leave-one-out root mean square error ${(100 * fill.looRms).toFixed(1)} %.`
  const estimates = [...records.cartridges.values()].flatMap(
    (cartridge): CatalogueCaseCapacity[] => {
      if (records.capacities.has(cartridge.id) || records.cases.has(cartridge.id)) return []
      const outline = outlineVolume(cartridge)
      if (!outline) return []
      const grams = (fill.factor * outline * waterDensityGramsPerCm3) / 1000
      return [
        {
          id: `${cartridge.id}-outline-estimate`,
          origin: 'catalogue',
          cartridge: `catalogue:${cartridge.id}`,
          waterCapacity: { value: Number(grams.toFixed(3)) },
          fillLevel: 'mouth',
          provenance: {
            kind: 'derived',
            sources: [
              {
                title: 'Case capacity estimated from the case outline of the cartridge record',
                fields: ['waterCapacity'],
                note,
              },
            ],
          },
        },
      ]
    },
  )
  return { fill, estimates }
}

/** `estimate-capacities`: writes the estimated capacity records of the records of `roots` to `<out>/capacities/`, which must not exist yet as a folder, file or symbolic link. */
export function writeEstimatedCapacities(roots: readonly string[], out: string) {
  const folder = join(out, 'capacities')
  // lstat, as a dangling symbolic link passes existsSync
  if (lstatSync(folder, { throwIfNoEntry: false }))
    // NOSONAR: the path is the argument the user gave
    throw new Refusal(`${folder} exists: give a new --out folder`)
  const { fill, estimates } = estimateCapacities(loadRecords(roots))
  mkdirSync(out, { recursive: true }) // NOSONAR: as above
  mkdirSync(folder) // NOSONAR: as above; fails on anything created there since the check
  for (const record of estimates)
    writeFileSync(join(folder, `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`) // NOSONAR: as above
  return { command: 'estimate-capacities', ...fill, written: estimates.length, folder }
}
