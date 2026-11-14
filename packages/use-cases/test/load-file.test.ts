import { interiorLoad, interiorValueKeys, overrideResistance } from '@rangefoundry/ballistics'
import { describe, expect, it } from 'vitest'
import { filePath } from '../src/load-file.ts'

/** The numbers of `x` with their paths. */
function leaves(x: unknown, path: string[]): [string[], number][] {
  if (typeof x === 'number') return [[path, x]]
  if (!x || typeof x !== 'object') return []
  return Object.entries(x).flatMap(([k, v]) => leaves(v, [...path, k]))
}

describe('the file path of a load field', () => {
  const at = ['records', 0, 'data']

  it('maps every load field of a file to its value in the file', () => {
    const values = Object.fromEntries(interiorValueKeys.map((k, i) => [k, 1 + i / 64]))
    const load = { ...interiorLoad(values), resistance: overrideResistance(undefined, values) }
    const mapped = new Set<string>()
    for (const [path, x] of leaves(load, [])) {
      const key = interiorValueKeys.find((k) => values[k] === x)
      if (key === undefined) continue
      expect(filePath(['load', ...path], at)).toEqual(
        key === 'charge' ? [...at, 'charge'] : [...at, 'analysis', 'overrides', key],
      )
      mapped.add(key)
    }
    expect([...mapped].toSorted()).toEqual([...interiorValueKeys].toSorted())
  })

  it('maps the ladder fields to the file ladder and keeps other paths', () => {
    expect(filePath(['ladder', 'chargeStep'], at)).toEqual([...at, 'analysis', 'ladder', 'step'])
    expect(filePath(['ladder', 'stepCount'], at)).toEqual([
      ...at,
      'analysis',
      'ladder',
      'stepCount',
    ])
    expect(filePath(['load', 'unknown'], at)).toEqual(['load', 'unknown'])
    expect(filePath(['curves'], at)).toEqual(['curves'])
  })
})
