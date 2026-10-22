import { expect, it } from 'vitest'
import { bulletFits, bulletWindow } from '../src/bullet-fit.ts'

// C.I.P. G1, F and Z of the records, mm; bullets by their nominal diameter in inches
const cartridges = {
  '223 Rem.': { g1: 5.7, land: 5.56, groove: 5.69 },
  '22 Savage': { g1: 5.79, land: 5.61, groove: 5.74 },
  '7 x 57': { g1: 7.25, land: 6.98, groove: 7.24 },
  '308 Win.': { g1: 7.85, land: 7.62, groove: 7.82 },
  '303 British': { g1: 7.92, land: 7.7, groove: 7.98 },
  '7,62 x 39': { g1: 7.92, land: 7.62, groove: 7.92 },
  '7,5 x 55 Suisse': { g1: 7.78, land: 7.51, groove: 7.77 },
  '8 x 57 I': { g1: 8.09, land: 7.8, groove: 8.07 },
  '8 x 57 IS': { g1: 8.22, land: 7.89, groove: 8.2 },
  '45 Colt': { g1: 11.58, land: 11.23, groove: 11.43 },
}
const bullets = {
  '.224': 5.69,
  '.228': 5.791,
  '.277': 7.036,
  '.284': 7.214,
  '.308': 7.823,
  '.310': 7.874,
  '.311': 7.899,
  '.312': 7.925,
  '.318': 8.077,
  '.323': 8.204,
  '.452': 11.481,
}
const fitting = (name: keyof typeof cartridges) =>
  Object.entries(bullets)
    .filter(([, d]) => bulletFits(d, cartridges[name]))
    .map(([b]) => b)

it('fits the bullets above the middle of land and groove, up to G1', () => {
  expect(fitting('223 Rem.')).toEqual(['.224'])
  expect(fitting('22 Savage')).toEqual(['.224', '.228'])
  expect(fitting('7 x 57')).toEqual(['.284'])
  expect(fitting('308 Win.')).toEqual(['.308'])
  expect(fitting('303 British')).toEqual(['.310', '.311', '.312'])
  expect(fitting('7,62 x 39')).toEqual(['.308', '.310', '.311', '.312'])
  expect(fitting('8 x 57 I')).toEqual(['.318'])
  expect(fitting('8 x 57 IS')).toEqual(['.318', '.323'])
  expect(fitting('45 Colt')).toEqual(['.452'])
})

it('lists no .308 for a G1 below it (7,5 x 55 Suisse)', () => {
  expect(fitting('7,5 x 55 Suisse')).toEqual([])
})

it('keeps a bullet on G1 plus the rounding, not past it or on the middle', () => {
  const c = { g1: 7.85, land: 7.62, groove: 7.82 }
  expect(bulletWindow(c).above).toBeCloseTo(7.72, 12)
  expect(bulletFits(7.855, c)).toBe(true)
  expect(bulletFits(7.856, c)).toBe(false)
  expect(bulletFits(7.72, c)).toBe(false)
})
