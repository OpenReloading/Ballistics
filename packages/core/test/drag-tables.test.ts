import { describe, expect, it } from 'vitest'
import { dragTables } from '../src/index.ts'

describe('dragTables', () => {
  it('holds every JBM table with its printed end points', () => {
    const ends = Object.fromEntries(
      Object.entries(dragTables).map(([model, t]) => [model, [t.length, t[0], t.at(-1)]]),
    )
    expect(ends).toEqual({
      G1: [79, [0, 0.2629], [5, 0.4988]],
      G2: [85, [0, 0.2303], [5, 0.1648]],
      G5: [76, [0, 0.171], [5, 0.228]],
      G6: [79, [0, 0.2617], [5, 0.1574]],
      G7: [84, [0, 0.1198], [5, 0.1618]],
      G8: [78, [0, 0.2105], [5, 0.1713]],
      GI: [81, [0, 0.2282], [5, 0.4082]],
      GS: [81, [0, 0.4662], [4, 0.928]],
    })
  })

  it('rises in Mach with positive drag coefficients', () => {
    for (const table of Object.values(dragTables)) {
      table.forEach(([mach, cd], k) => {
        expect(cd).toBeGreaterThan(0)
        if (k > 0) expect(mach).toBeGreaterThan(table[k - 1][0])
      })
    }
  })
})
