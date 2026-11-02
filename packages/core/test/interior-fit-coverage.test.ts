import { describe, expect, it } from 'vitest'
import { nth } from '../src/errors.ts'
import { fitPowder, interior, predictPowder } from '../src/index.ts'
import { load } from './powder-load.ts'
import { normals } from './random.ts'

// apart from interior-fit.test.ts so this long test runs on its own worker
describe('powder fit prediction bands', () => {
  const truth = load()

  it('covers the true value at held-out charges in 85 to 95 % of noisy repeats', () => {
    // coarser integration than the default keeps 1000 fits quick; the true values use it too
    const coarse = { relativeTolerance: 1e-8, absoluteTolerance: 1e-10, outputStep: 1e-5 }
    const truthAt = (charge: number) => {
      const r = interior({ ...truth, charge }, coarse)
      if (!r.valid) throw new Error(r.reason)
      return r
    }
    const rows = [2.6e-3, 2.8e-3, 3e-3].map((charge) => ({ charge, ...truthAt(charge) }))
    // inside the fired range, and just above it (an extrapolation)
    const held = [2.7e-3, 3.1e-3].map((charge) => ({ charge, ...truthAt(charge) }))
    const covered = held.map(() => ({ velocity: 0, pressure: 0 }))
    const draw = normals(58)
    const repeats = 1000
    for (let n = 0; n < repeats; n++) {
      const noisy = rows.map((r) => ({
        charge: r.charge,
        muzzleVelocity: r.muzzleVelocity + 3 * draw(),
        velocitySigma: 3,
      }))
      const fit = fitPowder(load(0.43), noisy, { options: coarse })
      held.forEach((t, i) => {
        const p = predictPowder(fit, t.charge, { options: coarse })
        if (p.velocity.lower <= t.muzzleVelocity && t.muzzleVelocity <= p.velocity.upper)
          nth(covered, i).velocity++
        if (p.pressure.lower <= t.peakBreechPressure && t.peakBreechPressure <= p.pressure.upper)
          nth(covered, i).pressure++
      })
    }
    for (const c of covered) {
      expect(c.velocity / repeats).toBeGreaterThan(0.85)
      expect(c.velocity / repeats).toBeLessThan(0.95)
      expect(c.pressure / repeats).toBeGreaterThan(0.85)
      expect(c.pressure / repeats).toBeLessThan(0.95)
    }
  }, 360_000)
})
