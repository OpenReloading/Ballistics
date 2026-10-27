import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  bullet,
  cartridge,
  caseCapacity,
  chronoSession,
  discipline,
  federation,
  firearm,
  firingSeries,
  load,
  manufacturer,
  powder,
  primer,
  rangeFirings,
  targetFace,
  targetMapping,
  targetSheet,
  userRecord,
} from '../src/index.ts'

const entities = {
  manufacturer,
  cartridge,
  bullet,
  powder,
  primer,
  caseCapacity,
  firearm,
  chronoSession,
  firingSeries,
  rangeFirings,
  federation,
  discipline,
  targetMapping,
  targetFace,
  targetSheet,
  userRecord,
  load,
}

type Node = { properties?: Record<string, Node>; type?: string; pattern?: string } & Record<
  string,
  unknown
>

const hasPattern = (n: Node): boolean =>
  !!n.pattern || (Array.isArray(n.allOf) && (n.allOf as Node[]).some(hasPattern))

/** Whether a string schema is bound by a pattern, also as one of several (`allOf`). */
const patterned = (n: Node) => n.type === 'string' && hasPattern(n)

/** Every property of a JSON Schema with its path, through objects, arrays and unions. */
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

describe('manufacturers in entity schemas', () => {
  const found = Object.entries(entities).map(
    ([name, schema]) =>
      [name, [...properties(z.toJSONSchema(schema, { unrepresentable: 'any' }))]] as const,
  )

  it('keep no manufacturer name text', () => {
    const named = found.flatMap(([name, props]) =>
      props.filter(([, key]) => key === 'manufacturerName').map(([path]) => `${name}${path}`),
    )
    expect(named).toEqual([])
  })

  it('name a manufacturer by an id or a reference, never by free text', () => {
    const text = found.flatMap(([name, props]) =>
      props
        .filter(([, key]) => /manufacturer|maker/i.test(key) && key !== 'manufacturerName')
        .filter(([, , node]) => !patterned(node))
        .map(([path]) => `${name}${path}`),
    )
    expect(text).toEqual([])
  })
})
