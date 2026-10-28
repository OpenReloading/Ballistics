// Rifle cant against its closed form and a seeded simulation
// (apps/docs/docs/research/hit-probability-cant.md). Run: node packages/core/scripts/hit-probability-cant.mts
// The drops are the issue's example figures (inches), a synthetic case.
import { normals } from './rng.mts'

const deg = Math.PI / 180
const cases = [
  { distance: 200, drop: 7.93 },
  { distance: 1000, drop: 296 },
]
const samples = 400_000

/** Impact shift of a rifle rolled by `c` rad about the bore: the drop vector rotated about the origin. */
const rotated = (drop: number, c: number) => ({
  x: drop * Math.sin(c),
  y: -drop * Math.cos(c) + drop,
})
const sd = (xs: number[]) => {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

console.log('closed form against the rotation of the drop vector, cant 1 degree')
for (const c of cases) {
  const r = rotated(c.drop, deg)
  const horizontal = c.drop * Math.sin(deg)
  const vertical = c.drop * (1 - Math.cos(deg))
  console.log(
    `${c.distance} yd drop ${c.drop} in: horizontal ${horizontal.toFixed(4)} in (rotation ${r.x.toFixed(4)}), vertical ${vertical.toFixed(5)} in (rotation ${r.y.toFixed(5)})`,
  )
}

console.log(
  'seeded simulation, normally distributed cant: horizontal SD against drop x SD x pi/180',
)
const draw = normals(369)
let worst = 0
for (const c of cases) {
  for (const s of [0.5, 1, 2, 3, 5]) {
    const xs: number[] = []
    const ys: number[] = []
    for (let n = 0; n < samples; n++) {
      const r = rotated(c.drop, s * deg * draw())
      xs.push(r.x)
      ys.push(r.y)
    }
    const model = c.drop * s * deg
    const err = sd(xs) / model - 1
    worst = Math.max(worst, Math.abs(err))
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
    console.log(
      `${c.distance} yd, cant SD ${s} deg: model ${model.toFixed(4)} in, simulated ${sd(xs).toFixed(4)} in, error ${err.toFixed(4)}; mean vertical ${meanY.toFixed(5)} in`,
    )
  }
}
console.log(`worst error ${worst.toFixed(4)}`)
