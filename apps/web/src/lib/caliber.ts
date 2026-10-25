/**
 * Common caliber names of the lists:
 * a bullet diameter (a bullet's, or a cartridge's G1) falls in the group whose span holds it.
 */
import { toSi } from '@open-reloading/schema'
import { inchText, metersPerInch, type UnitSystem } from './units.ts'

/** Name and span [from, to) in inches, by size; set by hand over the bullets and CIP G1 values. */
const commonCalibers: readonly [string, number, number][] = [
  ['.172', 0.168, 0.176],
  ['.204', 0.2, 0.208],
  ['.224', 0.219, 0.2295],
  ['6 mm', 0.24, 0.248],
  ['.257', 0.25, 0.2605],
  ['6.5 mm', 0.2605, 0.27],
  ['.277', 0.274, 0.281],
  ['7 mm', 0.281, 0.29],
  ['.308', 0.3, 0.31],
  ['.311', 0.31, 0.316],
  ['8 mm', 0.316, 0.332],
  ['.338', 0.332, 0.342],
  ['9 mm', 0.35, 0.357],
  ['.357', 0.357, 0.3615],
  ['9.3 mm', 0.362, 0.37],
  ['.375', 0.37, 0.38],
  ['.400', 0.396, 0.403],
  ['.410', 0.4085, 0.4125],
  ['.416', 0.4125, 0.42],
  ['.429', 0.425, 0.4345],
  ['.452', 0.448, 0.456],
  ['.458', 0.456, 0.462],
  ['.475', 0.472, 0.48],
  ['.500', 0.497, 0.507],
  ['.510', 0.507, 0.516],
]

const inches = (mm: number) => toSi('length', mm) / metersPerInch

/** A diameter (mm) as a caliber group: ".308" in inches (3 decimals), "7.82" in mm. */
export function caliberLabel(mm: number, unit: 'in' | 'mm'): string {
  if (unit === 'mm') return mm.toFixed(2)
  return inchText(inches(mm).toFixed(3), 'in')
}

/** The preset's caliber unit: inches when lengths show in inches. */
export const caliberUnit = (system: UnitSystem): 'in' | 'mm' =>
  system.length.symbol === 'in' ? 'in' : 'mm'

/** A diameter (mm) in inches, 3 decimals: ".350", "1.000". */
function inchLabel(mm: number) {
  const s = inches(mm).toFixed(3)
  return s.startsWith('0.') ? s.slice(1) : s
}

/** The common caliber of a diameter (mm): its group's name, else the diameter in inches (".350"). */
export function commonCaliber(mm: number): string {
  const d = inches(mm)
  return commonCalibers.find(([, from, to]) => d >= from && d < to)?.[0] ?? inchLabel(mm)
}

const named = new Set(commonCalibers.map(([name]) => name))

/**
 * The options of the caliber Select: the common calibers, then the other diameters, each by
 * size with its count; an empty group left out.
 */
export function caliberOptions(diameters: readonly number[]) {
  const groups = new Map<string, { mm: number; count: number }>()
  for (const mm of diameters) {
    const name = commonCaliber(mm)
    const g = groups.get(name)
    if (g) g.count++
    else groups.set(name, { mm, count: 1 })
  }
  const items = (common: boolean) =>
    [...groups]
      .filter(([name]) => named.has(name) === common)
      .sort((a, b) => a[1].mm - b[1].mm)
      .map(([value, { count }]) => ({ value, label: `${value} (${count})` }))
  return [
    { group: 'Common calibers', items: items(true) },
    { group: 'Other diameters', items: items(false) },
  ].filter((g) => g.items.length > 0)
}
