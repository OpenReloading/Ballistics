import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  trajectoryBody,
  trajectoryExample,
  truingBody,
  truingExample,
} from '../src/compute/exterior-schema.ts'
import {
  rangeStringsFitBody,
  rangeStringsFitExample,
  rangeStringsPlanBody,
  rangeStringsPlanExample,
} from '../src/compute/strings-schema.ts'
import { undescribed } from './setup.ts'

const bodies = {
  trajectory: [trajectoryBody, trajectoryExample],
  truing: [truingBody, truingExample],
  rangeStringsPlan: [rangeStringsPlanBody, rangeStringsPlanExample],
  rangeStringsFit: [rangeStringsFitBody, rangeStringsFitExample],
} as const

describe('exterior request schemas', () => {
  it.each(Object.entries(bodies))('the %s example is a valid body', (_, [body, example]) => {
    expect(() => body.parse(example)).not.toThrow()
  })

  it.each(Object.entries(bodies))(
    'every property of the %s schema has a description',
    (_, [schema]) => {
      const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
      expect(undescribed(json)).toEqual([])
    },
  )
})
