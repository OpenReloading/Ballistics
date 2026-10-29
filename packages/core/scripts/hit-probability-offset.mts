// Offset of the point of impact and shots needed against a seeded Monte Carlo
// (apps/docs/docs/research/hit-probability-offset-shots-needed.md).
// Run: node packages/core/scripts/hit-probability-offset.mts
// Synthetic case: a circular normal dispersion of 1 (all lengths in units of sigma).
import { ellipseProbability, shotsToHit } from '../src/index.ts'
import { normals } from './rng.mts'

const draws = 400_000
const offsets = [0, 0.5, 1, 1.5, 2, 3, 4]
const radii = [0.25, 0.5, 1, 2, 3, 4]
const sigma = { horizontal: 1, vertical: 1 }

const draw = normals(369)
let worst = 0
console.log('d/sigma,R/sigma,model,monte_carlo,difference_pp')
for (const d of offsets) {
  for (const r of radii) {
    let hits = 0
    for (let i = 0; i < draws; i++) {
      const x = d + draw()
      const y = draw()
      if (x * x + y * y <= r * r) hits++
    }
    const model = ellipseProbability(r, r, sigma, { dx: d, dy: 0 })
    const diff = 100 * (model - hits / draws)
    worst = Math.max(worst, Math.abs(diff))
    console.log(`${d},${r},${model.toFixed(5)},${(hits / draws).toFixed(5)},${diff.toFixed(3)}`)
  }
}
console.log(`largest difference ${worst.toFixed(3)} percentage points`)

console.log(
  'probability against sigma/R for a zone of radius R, offset d (d > R rises, then falls)',
)
for (const dOverR of [0.5, 1, 1.5, 2, 3]) {
  let best = { s: 0, p: 0 }
  const row: string[] = []
  for (let s = 0.05; s <= 5.001; s += 0.05) {
    const p = ellipseProbability(1, 1, { horizontal: s, vertical: s }, { dx: dOverR, dy: 0 })
    if (p > best.p) best = { s, p }
    if ([0.1, 0.25, 0.5, 1, 2, 4].some((q) => Math.abs(q - s) < 1e-9))
      row.push(`${s.toFixed(2)}:${p.toFixed(4)}`)
  }
  console.log(
    `d/R ${dOverR}: maximum ${best.p.toFixed(4)} at sigma/R ${best.s.toFixed(2)}; ${row.join(' ')}`,
  )
}

console.log('size of the centred assumption: probability with the offset over the centred one')
for (const r of radii) {
  const centred = ellipseProbability(r, r, sigma)
  const shifted = ellipseProbability(r, r, sigma, { dx: 0.5, dy: 0 })
  console.log(
    `R/sigma ${r}: centred ${centred.toFixed(4)}, d = 0.5 sigma ${shifted.toFixed(4)}, ratio ${(shifted / centred).toFixed(4)}, difference ${(100 * (shifted - centred)).toFixed(2)} pp`,
  )
}

console.log('shots needed (wanted 0.5, 0.9, 0.99) and mean shots to the first hit')
for (const p of [0.02, 0.1, 0.3, 0.632, 0.9]) {
  const row = [0.5, 0.9, 0.99].map((w) => shotsToHit(p, w).shots)
  const n = Math.round(1 / p)
  console.log(
    `p ${p}: ${row.join(', ')}; mean ${(1 / p).toFixed(2)}; chance after ${n} shots ${(1 - (1 - p) ** n).toFixed(4)}`,
  )
}
