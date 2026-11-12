import { chargeTargetExample, interiorExample, loadFileExample } from '@rangefoundry/use-cases'
import { describe, expect, it } from 'vitest'
import { API_PREFIX } from '../src/version.ts'
import { withApi } from './setup.ts'

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
