import { advisoryText } from '@open-reloading/use-cases'
import { describe, expect, it } from 'vitest'
import { buildOpenApi } from '../src/openapi.ts'

const d = await buildOpenApi()

interface Schema {
  anyOf?: Schema[]
  oneOf?: Schema[]
  properties?: Record<string, { const?: unknown }>
  required?: string[]
}

interface Operation {
  tags?: string[]
  responses: Record<string, { content?: Record<string, { schema: Schema }> }>
}

/** The object schemas an answer can take: every branch of an `anyOf` or `oneOf`, else the schema itself. */
function variants(s: Schema): Schema[] {
  const branches = [...(s.anyOf ?? []), ...(s.oneOf ?? [])]
  return branches.length > 0 ? branches.flatMap(variants) : [s]
}

describe('safety wording: results are simulations, not load data', () => {
  it('requires the notice in every success answer of an interior route', () => {
    const answers = Object.values(d.paths).flatMap((methods) =>
      Object.values(methods as Record<string, Operation>)
        .filter((op) => op.tags?.includes('Interior'))
        .map((op) => op.responses['200']?.content?.['application/json']?.schema ?? {}),
    )
    expect(answers.length).toBeGreaterThan(0)
    for (const v of answers.flatMap(variants)) {
      expect(v.required).toContain('notice')
      expect(v.properties?.notice?.const).toBe('simulation, not load data')
    }
  })

  it('never calls a load or a result safe in the words of an advisory', () => {
    for (const { name, message, fix } of Object.values(advisoryText))
      expect(`${name} ${message} ${fix}`).not.toMatch(/\bsafe/i)
  })
})
