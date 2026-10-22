import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { chargeBody, chargeTargetExample } from '../src/compute/charge-schema.ts'
import { interiorBody, interiorExample } from '../src/compute/interior-schema.ts'
import { loadFileExample } from '../src/compute/load-file-example.ts'
import { API_PREFIX } from '../src/version.ts'
import { undescribed, withApi } from './setup.ts'

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

describe('interior examples', () => {
  const api = withApi()

  it.each([
    ['/interior', interiorExample],
    ['/interior/charge-target', chargeTargetExample],
    ['/interior/load-file', loadFileExample],
  ])('POST %s answers 200', async (path, payload) => {
    const res = await api.app.inject({ method: 'POST', url: `${API_PREFIX}${path}`, payload })
    expect(res.statusCode).toBe(200)
  })
})
