import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { chargeBody, interiorBody } from '../src/index.ts'
import { undescribed } from './described.ts'

describe('interior request schemas', () => {
  it('describe every property and the body', () => {
    for (const body of [interiorBody, chargeBody]) {
      const schema = z.toJSONSchema(body, { io: 'input', unrepresentable: 'any' })
      expect(schema).not.toHaveProperty('$defs')
      expect(schema.description).toBeTruthy()
      expect(undescribed(schema)).toEqual([])
    }
  })
})
