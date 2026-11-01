import { expect, it } from 'vitest'
import { withCaseLength } from '../src/lib/cartridge-sheet.ts'
import {
  effectiveSpecValues,
  pmaxBar,
  recordSpecValues,
  typedCaseLength,
  typedSpec,
} from '../src/lib/record-specs.ts'

it('gives the record values in SI and none for a value the record lacks', () => {
  const v = recordSpecValues({ pmax: 3800, caseLength: 51, bulkDensity: 900 })
  expect(v.pmax).toBeCloseTo(3.8e8, 3)
  expect(v.caseLength).toBeCloseTo(0.051, 9)
  expect(v.bulkDensity).toBe(900)
  expect(
    recordSpecValues({ pmax: undefined, caseLength: undefined, bulkDensity: undefined }).pmax,
  ).toBeUndefined()
})

it('lets a typed value above 0 replace the record value, and nothing else', () => {
  const record = recordSpecValues({ pmax: 3800, caseLength: 51, bulkDensity: 900 })
  const values = effectiveSpecValues(record, {
    pmax: { si: 3.5e8 },
    caseLength: { si: 0 },
    bulkDensity: { si: undefined },
  })
  expect(values.pmax).toBe(3.5e8)
  expect(values.caseLength).toBe(record.caseLength)
  expect(values.bulkDensity).toBe(900)
  expect(typedSpec({ pmax: { si: 0 } }, 'pmax')).toBeUndefined()
  expect(typedSpec({ pmax: { si: 3.5e8 } }, 'pmax')).toBe(3.5e8)
})

it('reads the Pmax in bar and the typed case length in mm', () => {
  expect(pmaxBar(3.5e8)).toBeCloseTo(3500, 9)
  expect(pmaxBar(undefined)).toBeUndefined()
  expect(typedCaseLength({ caseLength: { si: 0.0512 } })).toBeCloseTo(51.2, 9)
  expect(typedCaseLength({})).toBeUndefined()
})

it("replaces the cartridge side's L3 of a sheet and leaves the chamber's", () => {
  const spec = {
    values: [
      { side: 'cartridge', symbol: 'L3', value: 51 },
      { side: 'chamber', symbol: 'L3', value: 52 },
      { side: 'cartridge', symbol: 'L6', value: 71 },
    ],
  }
  const typed = withCaseLength(spec as never, 50.5) as typeof spec
  expect(typed.values.map((v) => v.value)).toEqual([50.5, 52, 71])
  expect(spec.values[0]?.value).toBe(51)
})
