import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import * as schema from '../src/index.ts'

type Node = Record<string, unknown> & { properties?: Record<string, Node>; unit?: string }

/** Every property of a JSON Schema as `[path, key, node]`, through objects, arrays and unions. */
function* properties(node: unknown, path = ''): Generator<[string, string, Node]> {
  if (Array.isArray(node)) for (const n of node) yield* properties(n, path)
  else if (node && typeof node === 'object') {
    const n = node as Node
    for (const [key, child] of Object.entries(n.properties ?? {})) {
      yield [`${path}.${key}`, key, child]
      yield* properties(child, `${path}.${key}`)
    }
    for (const [key, child] of Object.entries(n))
      if (key !== 'properties') yield* properties(child, path)
  }
}

const entities = {
  caseCapacity: schema.caseCapacity,
  cartridgeCase: schema.cartridgeCase,
  load: schema.load,
  userRecord: schema.userRecord,
  cartridge: schema.cartridge,
  firearm: schema.firearm,
  bullet: schema.bullet,
  powder: schema.powder,
  firingSeries: schema.firingSeries,
  rangeFirings: schema.rangeFirings,
  chronoSession: schema.chronoSession,
}

describe('the case capacity in the schema', () => {
  const found = Object.entries(entities).flatMap(([name, s]) =>
    [...properties(z.toJSONSchema(s, { unrepresentable: 'any' }))].map(([path, key, node]) => ({
      path: `${name}${path}`,
      key,
      node,
    })),
  )
  const capacities = found.filter((p) => /water|capacity/i.test(p.key))

  it('is one measured entity, a load and a case group of the user reference it; a case holds the stated one, a powder fit a copy as a volume', () => {
    expect(capacities.map((p) => p.path).sort()).toEqual([
      'cartridgeCase.capacity',
      'cartridgeCase.waterCapacity',
      'caseCapacity.waterCapacity',
      'load.capacity',
      'userRecord.data.capacity',
      'userRecord.data.capacity',
      'userRecord.data.fit.input.caseCapacity',
      'userRecord.data.waterCapacity',
      'userRecord.data.waterCapacity',
    ])
  })

  it('is stored in one unit, g', () => {
    for (const p of capacities.filter((c) => c.key === 'waterCapacity'))
      expect(p.node.unit, p.path).toBe('g')
    expect(schema.units.mass).toBe('g')
  })
})
