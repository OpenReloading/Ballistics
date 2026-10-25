import { expect, it } from 'vitest'
import { caliberOptions, commonCaliber } from '../src/lib/caliber.ts'

it('names the common caliber of a cartridge G1 as the CIP record gives it', () => {
  // smallest cartridge G1 of the CIP record, mm
  const g1: [number, string][] = [
    [5.7, '.224'], // 223 Rem.
    [6.17, '6 mm'], // 243 Win.
    [6.72, '6.5 mm'], // 6,5 Creedmoor
    [7.06, '.277'], // 270 Win.
    [7.23, '7 mm'], // 7 mm Rem. Mag.
    [7.85, '.308'], // 308 Win., 30-06 Spring., 300 Win. Mag.
    [7.92, '.311'], // 7,62 x 39, 303 British
    [8.22, '8 mm'], // 8 x 57 IS
    [8.61, '.338'], // 338 Lapua Mag.
    [9.03, '9 mm'], // 9 mm Luger
    [9.3, '9.3 mm'], // 9,3 x 62
    [9.55, '.375'], // 375 H&H Mag.
    [10.97, '.429'], // 44 Rem. Mag.
    [11.48, '.452'], // 45 Auto
    [11.63, '.458'], // 45-70 Govt.
  ]
  for (const [mm, name] of g1) expect(commonCaliber(mm), `${mm} mm`).toBe(name)
})

it('names the common caliber of a bullet diameter', () => {
  expect(commonCaliber(7.823)).toBe('.308')
  expect(commonCaliber(6.706)).toBe('6.5 mm')
  expect(commonCaliber(5.69)).toBe('.224')
  expect(commonCaliber(9.017)).toBe('9 mm')
  expect(commonCaliber(9.068)).toBe('.357')
  expect(commonCaliber(9.093)).toBe('.357')
})

it('gives a diameter outside every group as its inch label', () => {
  // 348 Win.: .350 in
  expect(commonCaliber(8.88)).toBe('.350')
  expect(commonCaliber(25.4)).toBe('1.000')
})

it('lists the common calibers first, then the others, each by size with its count', () => {
  expect(caliberOptions([7.82, 7.85, 8.88, 6.72, 25.4])).toEqual([
    {
      group: 'Common calibers',
      items: [
        { value: '6.5 mm', label: '6.5 mm (1)' },
        { value: '.308', label: '.308 (2)' },
      ],
    },
    {
      group: 'Other diameters',
      items: [
        { value: '.350', label: '.350 (1)' },
        { value: '1.000', label: '1.000 (1)' },
      ],
    },
  ])
  expect(caliberOptions([7.82])).toEqual([
    { group: 'Common calibers', items: [{ value: '.308', label: '.308 (1)' }] },
  ])
})
